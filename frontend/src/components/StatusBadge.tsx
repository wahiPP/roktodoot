import { statusTone } from "@/lib/format";
import { STATUS_TEXT, type Lang } from "@/lib/i18n";
import type { RequestStatus } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

const TONE: Record<string, { cls: string; icon: IconName }> = {
  rokto: { cls: "bg-primary-container text-on-primary-container", icon: "radar" },
  ok: { cls: "bg-success-container text-on-success-container", icon: "task" },
  wait: { cls: "bg-tertiary-container text-on-tertiary-container", icon: "schedule" },
  muted: { cls: "bg-surface-container-highest text-on-surface-variant", icon: "info" },
};

/** Request status as an M3 chip with a leading icon. */
export function StatusBadge({ status, lang = "en" }: { status: RequestStatus; lang?: Lang }) {
  const tone = statusTone(status);
  const t = TONE[tone];
  return (
    <span data-tone={tone} className={`inline-flex min-h-8 items-center gap-2 rounded-sm py-1 pl-2 pr-3 text-label-l ${t.cls}`}>
      <Icon name={t.icon} size={18} />
      {STATUS_TEXT[status]?.[lang] ?? status}
    </span>
  );
}

export function UrgencyTag({ urgency, label }: { urgency: "normal" | "critical"; label: string }) {
  if (urgency !== "critical") return null;
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-error px-2 text-label-m text-on-error">
      <Icon name="bolt" size={14} />
      {label}
    </span>
  );
}
