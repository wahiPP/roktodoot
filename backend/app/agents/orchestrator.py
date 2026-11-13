"""Orchestrator: LangGraph graphs that run the request lifecycle.

confirm graph     trust -> publish (wave 1) | hold | reject
escalation graph  check -> next_wave | fallback | done

The database session and the current time are passed through the graph config,
so the graphs stay pure and are easy to test.
"""

from datetime import datetime
from typing import TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..events import record
from ..models import BloodRequest, OutreachAttempt, RequestStatus
from ..notify import notify
from . import outreach, trust

DECISION_TEXT = {
    trust.PUBLISH: "published to donors",
    trust.HOLD: "held for a volunteer to check",
    trust.REJECT: "rejected",
}


class ConfirmState(TypedDict, total=False):
    request_id: int
    score: int
    decision: str


class EscalationState(TypedDict, total=False):
    request_id: int
    action: str


def _ctx(config: RunnableConfig) -> tuple[Session, datetime]:
    c = config["configurable"]
    return c["db"], c["now"]


# ---------- confirm graph ----------


def _trust_node(state: ConfirmState, config: RunnableConfig) -> ConfirmState:
    db, now = _ctx(config)
    req = db.get(BloodRequest, state["request_id"])
    result = trust.evaluate(db, req, now)
    req.trust_score = result["score"]
    req.trust_reasons = result["reasons"]
    req.parsed = {**(req.parsed or {}), "trust_note": result["note"]}
    record(
        db,
        req.id,
        "trust_scored",
        f"Trust score {result['score']}/100: {DECISION_TEXT[result['decision']]}",
        {
            "score": result["score"],
            "decision": result["decision"],
            "reasons": result["reasons"],
            "note": result["note"],
        },
        now=now,
    )
    return {"score": result["score"], "decision": result["decision"]}


def _publish_node(state: ConfirmState, config: RunnableConfig) -> ConfirmState:
    db, now = _ctx(config)
    req = db.get(BloodRequest, state["request_id"])
    outreach.start_wave(db, req, 1, now)
    return {}


def _hold_node(state: ConfirmState, config: RunnableConfig) -> ConfirmState:
    db, now = _ctx(config)
    req = db.get(BloodRequest, state["request_id"])
    req.status = RequestStatus.HELD
    record(db, req.id, "held", "Held for admin review", now=now)
    notify(db, req.requester, "status_change", request_id=req.id, status="HELD")
    return {}


def _reject_node(state: ConfirmState, config: RunnableConfig) -> ConfirmState:
    db, now = _ctx(config)
    req = db.get(BloodRequest, state["request_id"])
    req.status = RequestStatus.REJECTED
    record(db, req.id, "rejected", "Rejected automatically: trust score too low", now=now)
    notify(db, req.requester, "request_rejected", request_id=req.id, reason="trust score too low")
    return {}


def _build_confirm_graph():
    g = StateGraph(ConfirmState)
    g.add_node("trust", _trust_node)
    g.add_node("publish", _publish_node)
    g.add_node("hold", _hold_node)
    g.add_node("reject", _reject_node)
    g.add_edge(START, "trust")
    g.add_conditional_edges(
        "trust",
        lambda s: s["decision"],
        {
            trust.PUBLISH: "publish",
            trust.HOLD: "hold",
            trust.REJECT: "reject",
        },
    )
    for n in ("publish", "hold", "reject"):
        g.add_edge(n, END)
    return g.compile()


# ---------- escalation graph ----------


def _check_node(state: EscalationState, config: RunnableConfig) -> EscalationState:
    db, now = _ctx(config)
    req = db.get(BloodRequest, state["request_id"])
    if req.status not in (RequestStatus.WAVE_1, RequestStatus.WAVE_2, RequestStatus.WAVE_3):
        return {"action": "done"}
    if req.wave_deadline and req.wave_deadline <= now:
        return {"action": "escalate"}
    return {"action": "done"}


def _escalate_node(state: EscalationState, config: RunnableConfig) -> EscalationState:
    db, now = _ctx(config)
    req = db.get(BloodRequest, state["request_id"])
    outreach.finish_wave_and_escalate(db, req, now, reason="timeout")
    return {}


def _build_escalation_graph():
    g = StateGraph(EscalationState)
    g.add_node("check", _check_node)
    g.add_node("escalate", _escalate_node)
    g.add_edge(START, "check")
    g.add_conditional_edges("check", lambda s: s["action"], {"escalate": "escalate", "done": END})
    g.add_edge("escalate", END)
    return g.compile()


confirm_graph = _build_confirm_graph()
escalation_graph = _build_escalation_graph()


def run_confirm(db: Session, req: BloodRequest, now: datetime) -> str:
    record(db, req.id, "confirmed", "Requester confirmed the details", now=now)
    out = confirm_graph.invoke({"request_id": req.id}, config={"configurable": {"db": db, "now": now}})
    return out["decision"]


def run_escalation_check(db: Session, req: BloodRequest, now: datetime) -> str:
    out = escalation_graph.invoke({"request_id": req.id}, config={"configurable": {"db": db, "now": now}})
    return out["action"]


def approve_held(db: Session, req: BloodRequest, now: datetime) -> None:
    outreach.start_wave(db, req, 1, now)


def pending_in_wave(db: Session, req: BloodRequest) -> int:
    return len(
        db.scalars(
            select(OutreachAttempt.id).where(
                OutreachAttempt.request_id == req.id,
                OutreachAttempt.wave == req.current_wave,
                OutreachAttempt.response == "pending",
            )
        ).all()
    )
