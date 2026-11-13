"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Card, ListItem, PageTitle } from "@/components/md";
import { useLang } from "@/components/Providers";
import { RequireAuth } from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Notification } from "@/lib/types";

const ICON: Record<string, IconName> = {
  donor_request: "bloodtype",
  donor_accepted: "favorite",
  status_change: "info",
  thanks: "favorite",
  eligible_again: "play",
  request_rejected: "close",
  bank_fallback: "bank",
};

function Notifications() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    api<Notification[]>("/notifications").then(setItems).catch(() => setItems([]));
  }, []);

  function open(n: Notification) {
    if (!n.read) api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 md:pt-8">
      <PageTitle>{t("alerts")}</PageTitle>
      {items?.length === 0 && (
        <Card variant="outlined" className="flex flex-col items-center p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="bell" size={28} />
          </span>
          <p className="mt-4 text-title-m text-on-surface">No alerts yet</p>
        </Card>
      )}
      {!!items?.length && (
        <Card variant="outlined" className="divide-y divide-outline-variant overflow-hidden">
          {items.map((n) => {
            const href =
              n.type === "donor_request" ? "/donor/inbox" : n.payload.request_id ? `/requests/${n.payload.request_id}` : "/notifications";
            return (
              <ListItem
                key={n.id}
                href={href}
                onClick={() => open(n)}
                leading={
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full ${
                      n.read ? "bg-surface-container-highest text-on-surface-variant" : "bg-primary-container text-on-primary-container"
                    }`}
                  >
                    <Icon name={ICON[n.type] ?? "bell"} size={20} />
                  </span>
                }
                headline={<span className={n.read ? "" : "font-medium"}>{n.payload.text?.[lang] ?? n.type}</span>}
                supporting={formatDateTime(n.created_at, lang)}
                trailing={!n.read ? <span className="block h-2 w-2 rounded-full bg-primary" aria-label="Unread" /> : undefined}
              />
            );
          })}
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}
