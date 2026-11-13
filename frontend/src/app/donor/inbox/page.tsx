"use client";

import { useCallback, useEffect, useState } from "react";
import { BloodTag } from "@/components/BloodTag";
import { DonorCard } from "@/components/DonorCard";
import { Icon } from "@/components/Icon";
import { Button, Card, ListItem, PageTitle, Snackbar } from "@/components/md";
import { useLang } from "@/components/Providers";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import type { InboxItem } from "@/lib/types";

function Inbox() {
  const { t } = useLang();
  const [data, setData] = useState<{ open: InboxItem[]; history: InboxItem[] } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<{ open: InboxItem[]; history: InboxItem[] }>("/donors/inbox").then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [load]);

  async function respond(id: number, accept: boolean) {
    setBusy(id);
    try {
      await api(`/requests/${id}/respond`, { method: "POST", body: { accept } });
      setMsg(accept ? "Thank you. Open the request below to see the family's number." : "Okay. We'll ask someone else.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not send your answer");
    }
    setBusy(null);
    load();
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 md:pt-8">
      <div className="flex items-start justify-between gap-2">
        <PageTitle>{t("inbox")}</PageTitle>
        <Button variant="text" icon="person" href="/donor">
          {t("profile")}
        </Button>
      </div>
      {!data ? (
        <p className="text-body-l text-on-surface-variant">Loading…</p>
      ) : data.open.length === 0 ? (
        <Card variant="outlined" className="flex flex-col items-center p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-success-container text-on-success-container">
            <Icon name="inbox" size={28} />
          </span>
          <p className="mt-4 text-title-m text-on-surface">Nobody near you needs your group right now</p>
          <p className="mt-1 text-body-m text-on-surface-variant">We&apos;ll notify you when someone does.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.open.map((i) => (
            <DonorCard key={i.request_id} item={i} busy={busy === i.request_id} onRespond={(a) => respond(i.request_id, a)} />
          ))}
        </div>
      )}
      {data && data.history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-title-m text-on-surface">Earlier requests</h2>
          <Card variant="outlined" className="divide-y divide-outline-variant overflow-hidden">
            {data.history.map((i) =>
              i.response === "accepted" ? (
                <ListItem
                  key={i.request_id}
                  href={`/requests/${i.request_id}`}
                  leading={<BloodTag group={i.blood_group} size="sm" />}
                  headline={i.hospital_name}
                  supporting={<span className="text-success">You said yes. Tap for the family&apos;s number</span>}
                />
              ) : (
                <ListItem
                  key={i.request_id}
                  leading={<BloodTag group={i.blood_group} size="sm" />}
                  headline={i.hospital_name}
                  supporting={i.response === "declined" ? "You declined" : "Closed"}
                />
              ),
            )}
          </Card>
        </section>
      )}
      <Snackbar message={msg} onClose={() => setMsg("")} />
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Inbox />
    </RequireAuth>
  );
}
