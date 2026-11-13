"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BloodTag } from "@/components/BloodTag";
import { Icon } from "@/components/Icon";
import { DOT_LEGEND } from "@/components/legend";
import { Button, Card, LinearProgress, ListItem } from "@/components/md";
import { useAuth, useLang } from "@/components/Providers";
import { RequireAuth } from "@/components/RequireAuth";
import { StatusBadge, UrgencyTag } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import { WaveStepper } from "@/components/WaveStepper";
import { api, ApiError } from "@/lib/api";
import { formatCountdown, formatDateTime, isSearching } from "@/lib/format";
import type { BloodRequest } from "@/lib/types";
import { useRequestMap } from "@/lib/useRequestMap";

const EscalationMap = dynamic(() => import("@/components/EscalationMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-container-high" />,
});

function RequestPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [req, setReq] = useState<BloodRequest | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canSeeMap = !!req && (req.is_mine || user?.role === "admin");
  const { snap, live, secondsLeft } = useRequestMap(id, canSeeMap);

  // Longest countdown seen for this wave, so the progress bar can show how much is left.
  const waveTotal = useRef<{ wave: number; total: number }>({ wave: 0, total: 0 });
  if (snap && secondsLeft !== null) {
    if (waveTotal.current.wave !== snap.current_wave) waveTotal.current = { wave: snap.current_wave, total: secondsLeft };
    waveTotal.current.total = Math.max(waveTotal.current.total, secondsLeft);
  }

  const load = useCallback(() => {
    api<BloodRequest>(`/requests/${id}`)
      .then(setReq)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load"));
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    if (snap && req && snap.status !== req.status) load();
  }, [snap, req, load]);

  async function act(path: string) {
    setBusy(true);
    try {
      setReq(await api<BloodRequest>(`/requests/${id}/${path}`, { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed");
    }
    setBusy(false);
  }

  if (error && !req) return <p className="p-6 text-body-l text-error">{error}</p>;
  if (!req) return <p className="p-6 text-body-l text-on-surface-variant">Loading…</p>;

  const waveRunning = isSearching(req.status) && req.status !== "BANK_FALLBACK";
  const showMap = canSeeMap && !["PARSED", "HELD", "REJECTED"].includes(req.status);
  const showStepper = req.current_wave > 0 || req.status === "BANK_FALLBACK";
  const pctLeft = waveTotal.current.total && secondsLeft !== null ? (secondsLeft / waveTotal.current.total) * 100 : 0;
  const countdownLabel =
    req.current_wave < 3
      ? lang === "bn"
        ? `ধাপ ${req.current_wave + 1} শুরু হবে`
        : `Wave ${req.current_wave + 1} starts in`
      : lang === "bn"
        ? "ব্লাড ব্যাংক দেখানো হবে"
        : "Blood banks listed in";

  return (
    <div className="mx-auto max-w-6xl px-0 md:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6">
      {showMap && (
        <section className="relative h-[46vh] min-h-[300px] overflow-hidden md:rounded-xl lg:sticky lg:top-20 lg:h-[calc(100vh-112px)]" aria-label="Live escalation map">
          {snap ? <EscalationMap snap={snap} /> : <div className="h-full bg-surface-container-high" />}
          {waveRunning && (
            <Card variant="elevated" className="pointer-events-none absolute right-3 top-3 z-[500] w-48 bg-surface-container-lowest p-3">
              <p className="text-label-m text-on-surface-variant">{countdownLabel}</p>
              <p className="text-headline-m text-on-surface" aria-live="polite">
                {formatCountdown(secondsLeft)}
              </p>
              <LinearProgress value={pctLeft} className="mt-2" />
            </Card>
          )}
          <span className="absolute bottom-3 left-3 z-[500] inline-flex h-8 items-center gap-2 rounded-sm bg-surface-container-lowest px-3 text-label-m text-on-surface shadow-elev-1">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-success" : "bg-tertiary"}`} />
            {live ? "Live" : "Updating every few seconds"}
          </span>
        </section>
      )}

      <div className={`space-y-4 px-4 pt-4 md:px-0 ${showMap ? "" : "lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-2xl"}`}>
        <Card variant="filled" className="p-5">
          <div className="flex items-start gap-4">
            <BloodTag group={req.blood_group} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-headline-s text-on-surface">
                  {req.units} {req.units === 1 ? t("bag") : t("bagsLower")}
                </p>
                <UrgencyTag urgency={req.urgency} label={t("critical")} />
              </div>
              <p className="mt-1 flex items-start gap-1.5 text-body-l text-on-surface">
                <Icon name="hospital" size={20} className="mt-0.5 text-primary" />
                {req.hospital_name}
              </p>
              {req.needed_by && (
                <p className="mt-0.5 flex items-center gap-1.5 text-body-m text-on-surface-variant">
                  <Icon name="schedule" size={18} />
                  {t("neededBy")} {formatDateTime(req.needed_by, lang)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <StatusBadge status={req.status} lang={lang} />
          </div>
          {showStepper && (
            <div className="mt-5">
              <WaveStepper status={req.status} currentWave={req.current_wave} lang={lang} />
            </div>
          )}
        </Card>

        {req.status === "HELD" && (
          <Card variant="filled" className="flex gap-3 bg-tertiary-container p-4 text-on-tertiary-container">
            <Icon name="shield" />
            <p className="text-body-m">{t("heldReview")}</p>
          </Card>
        )}

        {req.donor_contact && (
          <Card variant="filled" className="bg-success-container p-5 text-on-success-container">
            <div className="flex items-center gap-3">
              <Icon name="favorite" />
              <p className="text-title-l">{t("donorFound")}</p>
            </div>
            <p className="mt-2 text-body-l">
              {req.donor_contact.name}, {req.donor_contact.blood_group}
            </p>
            {req.donor_contact.phone && (
              <a
                href={`tel:${req.donor_contact.phone}`}
                className="state-layer mt-4 flex h-14 items-center justify-center gap-2 rounded-full bg-success text-title-m text-on-success"
              >
                <Icon name="call" />
                {t("callDonor")} {req.donor_contact.phone}
              </a>
            )}
          </Card>
        )}

        {req.requester_contact?.phone && (
          <Card variant="filled" className="bg-success-container p-5 text-on-success-container">
            <p className="text-body-l">Thank you. Call the family to arrange the donation.</p>
            <a
              href={`tel:${req.requester_contact.phone}`}
              className="state-layer mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-success text-label-l text-on-success"
            >
              <Icon name="call" size={20} />
              {req.requester_contact.phone}
            </a>
          </Card>
        )}

        {snap && snap.blood_banks.length > 0 && (
          <Card variant="outlined" className="overflow-hidden">
            <h2 className="px-4 pt-4 text-title-m text-on-surface">{t("bloodBanks")}</h2>
            <div className="divide-y divide-outline-variant">
              {snap.blood_banks.map((b) => (
                <ListItem
                  key={b.id}
                  leading={
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
                      <Icon name="bank" size={20} />
                    </span>
                  }
                  headline={b.name}
                  supporting={`${b.distance_km} km away`}
                  trailing={
                    <a href={`tel:${b.phone}`} aria-label={`Call ${b.name}`} className="state-layer grid h-10 w-10 place-items-center rounded-full text-primary">
                      <Icon name="call" />
                    </a>
                  }
                />
              ))}
            </div>
          </Card>
        )}

        {req.is_mine && (req.status === "ACCEPTED" || !["FULFILLED", "CANCELLED", "EXPIRED", "REJECTED"].includes(req.status)) && (
          <div className="flex flex-wrap justify-end gap-2">
            {!["FULFILLED", "CANCELLED", "EXPIRED", "REJECTED"].includes(req.status) && (
              <Button variant="text" disabled={busy} onClick={() => act("cancel")}>
                {t("cancelRequest")}
              </Button>
            )}
            {req.status === "ACCEPTED" && (
              <Button variant="tonal" icon="task" disabled={busy} onClick={() => act("fulfil")}>
                {t("donationDone")}
              </Button>
            )}
          </div>
        )}

        {snap && snap.donors.length > 0 && (
          <div className="grid grid-cols-4 gap-2" aria-label="Donors contacted">
            {DOT_LEGEND.map((d) => (
              <Card key={d.status} variant="outlined" className="px-2 py-3 text-center">
                <span className="block text-headline-s text-on-surface">{snap.donors.filter((x) => x.status === d.status).length}</span>
                <span className="inline-flex items-center gap-1 text-label-s text-on-surface-variant">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.label}
                </span>
              </Card>
            ))}
          </div>
        )}

        {snap && snap.timeline.length > 0 && (
          <Card variant="outlined" className="p-4">
            <h2 className="mb-4 text-title-m text-on-surface">{t("timeline")}</h2>
            <Timeline items={snap.timeline} lang={lang} />
          </Card>
        )}
        {error && <p className="text-body-m text-error">{error}</p>}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <RequestPage />
    </RequireAuth>
  );
}
