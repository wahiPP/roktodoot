"""WebSocket for the live escalation map.

The server re-reads the database every 1.5 s and pushes a fresh snapshot only
when something changed. Because state lives in the database, this works with
several server processes. The browser falls back to polling GET /requests/{id}/map.
"""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import db as dbmod
from ..auth import AuthError, decode_token, user_from_claims
from ..config import get_settings
from ..mapview import snapshot
from ..models import BloodRequest

router = APIRouter()
POLL_SECONDS = 1.5


def _load(request_id: int, token: str) -> tuple[dict | None, str | None]:
    settings = get_settings()
    with dbmod.SessionLocal() as db:
        try:
            user = user_from_claims(db, decode_token(token, settings), settings)
        except AuthError as e:
            return None, str(e)
        req = db.get(BloodRequest, request_id)
        if req is None:
            return None, "not found"
        if user.role != "admin" and req.requester_id != user.id:
            return None, "forbidden"
        return snapshot(db, req), None


@router.websocket("/ws/requests/{request_id}")
async def map_socket(ws: WebSocket, request_id: int, token: str = ""):
    await ws.accept()
    last = None
    try:
        while True:
            snap, err = await asyncio.to_thread(_load, request_id, token)
            if err:
                await ws.send_json({"error": err})
                await ws.close(code=4403)
                return
            # seconds_left changes every tick; compare without it
            key = json.dumps({k: v for k, v in snap.items() if k != "seconds_left"}, sort_keys=True, default=str)
            if key != last:
                await ws.send_json(snap)
                last = key
            await asyncio.sleep(POLL_SECONDS)
    except WebSocketDisconnect:
        return
