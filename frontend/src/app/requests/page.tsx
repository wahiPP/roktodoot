"use client";

import { useEffect, useState } from "react";
import { BloodTag } from "@/components/BloodTag";
import { Icon } from "@/components/Icon";
import { Button, Card, Fab, ListItem, PageTitle } from "@/components/md";
import { useLang } from "@/components/Providers";
import { RequireAuth } from "@/components/RequireAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { BloodRequest } from "@/lib/types";

function MyRequests() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<BloodRequest[] | null>(null);

  useEffect(() => {
    api<BloodRequest[]>("/requests/mine").then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 md:pt-8">
      <PageTitle>{t("myRequests")}</PageTitle>
      {items === null ? (
        <p className="text-body-l text-on-surface-variant">Loading…</p>
      ) : items.length === 0 ? (
        <Card variant="outlined" className="flex flex-col items-center p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="bloodtype" size={28} />
          </span>
          <p className="mt-4 text-title-m text-on-surface">You have not asked for blood yet</p>
          <p className="mt-1 text-body-m text-on-surface-variant">Describe the need and we contact donors near the hospital.</p>
          <Button className="mt-4" icon="search" href="/">
            Start a request
          </Button>
        </Card>
      ) : (
        <Card variant="outlined" className="divide-y divide-outline-variant overflow-hidden">
          {items.map((r) => (
            <ListItem
              key={r.id}
              href={r.status === "PARSED" ? `/request/new?id=${r.id}` : `/requests/${r.id}`}
              leading={<BloodTag group={r.blood_group} size="md" />}
              headline={r.hospital_name ?? "Hospital not set"}
              supporting={
                <span className="mt-1 flex flex-col items-start gap-1.5">
                  <span>{formatDateTime(r.created_at, lang)}</span>
                  <StatusBadge status={r.status} lang={lang} />
                </span>
              }
            />
          ))}
        </Card>
      )}
      <Fab icon="bloodtype" label={lang === "bn" ? "নতুন অনুরোধ" : "New request"} href="/" />
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <MyRequests />
    </RequireAuth>
  );
}
