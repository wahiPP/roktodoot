"use client";

import { formatDateTime } from "@/lib/format";
import type { InboxItem } from "@/lib/types";
import { BloodTag } from "./BloodTag";
import { Icon } from "./Icon";
import { Button, Card } from "./md";
import { useLang } from "./Providers";
import { UrgencyTag } from "./StatusBadge";

interface Props {
  item: InboxItem;
  busy?: boolean;
  onRespond?: (accept: boolean) => void;
}

/** A request as a donor sees it. Never shows the family's phone number. */
export function DonorCard({ item, busy, onRespond }: Props) {
  const { t, lang } = useLang();
  return (
    <Card variant="elevated" className="p-4">
      <div className="flex items-start gap-4">
        <BloodTag group={item.blood_group} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-title-m text-on-surface">
              {item.units} {item.units === 1 ? t("bag") : t("bagsLower")} at {item.hospital_name}
            </p>
            <UrgencyTag urgency={item.urgency} label={t("critical")} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-body-m text-on-surface-variant">
            <Icon name="location" size={16} />
            <span>{item.distance_km} km</span> from you
          </p>
          {item.needed_by && (
            <p className="flex items-center gap-1 text-body-m text-on-surface-variant">
              <Icon name="schedule" size={16} />
              Needed by {formatDateTime(item.needed_by, lang)}
            </p>
          )}
        </div>
      </div>
      {onRespond && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outlined" disabled={busy} onClick={() => onRespond(false)}>
            {t("decline")}
          </Button>
          <Button icon="favorite" disabled={busy} onClick={() => onRespond(true)}>
            {t("accept")}
          </Button>
        </div>
      )}
    </Card>
  );
}
