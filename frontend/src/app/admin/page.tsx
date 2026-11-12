"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BloodTag } from "@/components/BloodTag";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Card, PageTitle, Snackbar, TextField } from "@/components/md";
import { useLang } from "@/components/Providers";
import { RequireAuth } from "@/components/RequireAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { BloodRequest } from "@/lib/types";

interface Stats {
  requests_by_blood_group: Record<string, number>;
  requests_by_status: Record<string, number>;
  fulfilment_rate: number | null;
  avg_minutes_to_accept: number | null;
  donors_by_blood_group: Record<string, number>;
  donors_available: number;
  donors_total: number;
}

interface Event {
  id: number;
  type: string;
  message: string;
  created_at: string;
}

function Bars({ data }: { data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="text-body-m text-on-surface-variant">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3">
          <BloodTag group={k === "unknown" ? null : k} size="sm" />
          <span className="h-2 overflow-hidden rounded-full bg-primary-container">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="text-right text-label-l text-on-surface">{v}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ icon, label, value, unit }: { icon: IconName; label: string; value: string; unit?: string }) {
  return (
    <Card variant="filled" className="p-4">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon name={icon} size={20} />
      </span>
      <p className="mt-3 text-body-m text-on-surface-variant">{label}</p>
      <p className="text-headline-m text-on-surface">
        {value}
        {unit && <span className="text-title-m text-on-surface-variant"> {unit}</span>}
      </p>
    </Card>
  );
}

/** Trust score on a 0–100 track with the reject / hold / publish bands marked. */
function TrustMeter({ score }: { score: number }) {
  return (
    <div aria-label={`Trust score ${score} of 100`}>
      <div className="relative h-2 rounded-full">
        <div className="absolute inset-y-0 left-0 w-[30%] rounded-l-full bg-error-container" />
        <div className="absolute inset-y-0 left-[30%] w-[30%] bg-tertiary-container" />
        <div className="absolute inset-y-0 left-[60%] right-0 rounded-r-full bg-success-container" />
        <div className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-surface bg-on-surface shadow-elev-1" style={{ left: `${score}%` }} />
      </div>
      <div className="relative mt-2 h-4 text-label-s text-on-surface-variant">
        <span className="absolute left-0">Reject</span>
        <span className="absolute left-[30%]">Hold</span>
        <span className="absolute left-[60%]">Publish</span>
      </div>
    </div>
  );
}

function Admin() {
  const { lang } = useLang();
  const [held, setHeld] = useState<BloodRequest[]>([]);
  const [recent, setRecent] = useState<BloodRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<Record<number, Event[]>>({});
  const [reason, setReason] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<BloodRequest[]>("/admin/requests?status=HELD").then(setHeld).catch(() => {});
    api<BloodRequest[]>("/admin/requests").then((r) => setRecent(r.slice(0, 15))).catch(() => {});
    api<Stats>("/admin/stats").then(setStats).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function decide(id: number, approve: boolean) {
    try {
      await api(`/admin/requests/${id}/decision`, { method: "POST", body: { approve, reason: reason[id] || "" } });
      setMsg(approve ? `Request #${id} approved. Wave 1 started.` : `Request #${id} rejected.`);
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Failed");
    }
  }

  async function toggleEvents(id: number) {
    if (events[id]) {
      const rest = { ...events };
      delete rest[id];
      setEvents(rest);
      return;
    }
    setEvents({ ...events, [id]: await api<Event[]>(`/admin/requests/${id}/events`) });
  }

  async function demo(id: number, action: "skip-wave" | "simulate") {
    try {
      await api(`/dev/requests/${id}/${action}${action === "simulate" ? "?action=accept" : ""}`, { method: "POST" });
      setMsg(action === "simulate" ? `A donor accepted request #${id}.` : `Moved request #${id} to the next wave.`);
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:pt-8">
      <PageTitle>Admin</PageTitle>

      {stats && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon="task" label="Fulfilment rate" value={stats.fulfilment_rate === null ? "n/a" : `${Math.round(stats.fulfilment_rate * 100)}%`} />
          <Stat
            icon="timer"
            label="Time to first yes"
            value={stats.avg_minutes_to_accept === null ? "n/a" : String(stats.avg_minutes_to_accept)}
            unit={stats.avg_minutes_to_accept === null ? undefined : "min"}
          />
          <Stat icon="group" label="Donors available" value={String(stats.donors_available)} unit={`of ${stats.donors_total}`} />
          <Stat icon="schedule" label="Held for review" value={String(held.length)} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-title-l text-on-surface">Held for review</h2>
        {held.length === 0 && (
          <Card variant="outlined" className="flex items-center gap-3 p-4 text-body-m text-on-surface-variant">
            <Icon name="task" className="text-success" />
            Nothing to review.
          </Card>
        )}
        <div className="space-y-4">
          {held.map((r) => (
            <Card key={r.id} variant="elevated" className="overflow-hidden">
              <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  <div className="flex items-center gap-3">
                    <BloodTag group={r.blood_group} size="md" />
                    <div>
                      <p className="text-title-m text-on-surface">{r.hospital_name}</p>
                      <p className="text-body-s text-on-surface-variant">
                        Request #{r.id}, {formatDateTime(r.created_at, lang)}
                      </p>
                    </div>
                  </div>
                  {r.raw_text && <p className="mt-4 rounded-sm bg-surface-container p-3 text-body-m text-on-surface">{r.raw_text}</p>}
                  <ul className="mt-3 space-y-1">
                    {r.trust_reasons
                      ?.filter((x) => x.signal !== "base")
                      .map((x, i) => (
                        <li key={i} className="flex items-center gap-2 text-body-m text-on-surface">
                          <span
                            className={`inline-flex h-6 min-w-10 items-center justify-center rounded-full px-2 text-label-m ${
                              x.effect < 0 ? "bg-error-container text-on-error-container" : "bg-success-container text-on-success-container"
                            }`}
                          >
                            {x.effect > 0 ? "+" : "−"}
                            {Math.abs(x.effect)}
                          </span>
                          {x.detail}
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="text-body-m text-on-surface-variant">Trust score</p>
                  <p className="mb-3 text-display-s text-on-surface">
                    {r.trust_score}
                    <span className="text-title-m text-on-surface-variant">/100</span>
                  </p>
                  <TrustMeter score={r.trust_score ?? 0} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 bg-surface-container px-5 py-3">
                <TextField
                  label="Reason (optional)"
                  value={reason[r.id] || ""}
                  onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })}
                  labelBg="bg-surface-container"
                  className="min-w-0 flex-1"
                />
                <Button variant="outlined" onClick={() => decide(r.id, false)}>
                  Reject
                </Button>
                <Button icon="check" onClick={() => decide(r.id, true)}>
                  Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {stats && (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Card variant="outlined" className="p-5">
            <h2 className="mb-4 text-title-m text-on-surface">Requests by blood group</h2>
            <Bars data={stats.requests_by_blood_group} />
          </Card>
          <Card variant="outlined" className="p-5">
            <h2 className="mb-4 text-title-m text-on-surface">Donors by blood group</h2>
            <Bars data={stats.donors_by_blood_group} />
          </Card>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-title-l text-on-surface">Recent requests</h2>
        <Card variant="outlined" className="divide-y divide-outline-variant overflow-hidden">
          {recent.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <BloodTag group={r.blood_group} size="sm" />
                <Link href={`/requests/${r.id}`} className="text-body-l text-on-surface hover:underline">
                  #{r.id} {r.hospital_name}
                </Link>
                <span className="text-body-s text-on-surface-variant">{formatDateTime(r.created_at, lang)}</span>
                <span className="md:ml-auto">
                  <StatusBadge status={r.status} lang={lang} />
                </span>
              </div>
              <div className="-ml-3 mt-1 flex flex-wrap">
                <Button variant="text" icon="history" onClick={() => toggleEvents(r.id)}>
                  {events[r.id] ? "Hide audit log" : "Audit log"}
                </Button>
                {r.status.startsWith("WAVE") && (
                  <>
                    <Button variant="text" icon="timer" onClick={() => demo(r.id, "skip-wave")}>
                      Demo: end wave
                    </Button>
                    <Button variant="text" icon="favorite" onClick={() => demo(r.id, "simulate")}>
                      Demo: donor accepts
                    </Button>
                  </>
                )}
              </div>
              {events[r.id] && (
                <ol className="mb-2 ml-1 mt-1 space-y-1 border-l-2 border-outline-variant pl-4 text-body-m">
                  {events[r.id].map((e) => (
                    <li key={e.id} className="grid grid-cols-[3.5rem_1fr] gap-2">
                      <time className="text-on-surface-variant">{formatDateTime(e.created_at, lang).split(", ").pop()}</time>
                      <span className="text-on-surface">{e.message}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </Card>
      </section>
      <Snackbar message={msg} onClose={() => setMsg("")} />
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth admin>
      <Admin />
    </RequireAuth>
  );
}
