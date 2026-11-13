import { formatTime } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { MapSnapshot } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

const LOOK: Record<string, { icon: IconName; cls: string }> = {
  parsed: { icon: "edit", cls: "bg-surface-container-highest text-on-surface-variant" },
  confirmed: { icon: "check", cls: "bg-surface-container-highest text-on-surface-variant" },
  trust_scored: { icon: "shield", cls: "bg-secondary-container text-on-secondary-container" },
  held: { icon: "schedule", cls: "bg-tertiary-container text-on-tertiary-container" },
  approved: { icon: "verified", cls: "bg-success-container text-on-success-container" },
  rejected: { icon: "close", cls: "bg-error-container text-on-error-container" },
  wave_started: { icon: "radar", cls: "bg-primary-container text-on-primary-container" },
  wave_empty: { icon: "info", cls: "bg-surface-container-highest text-on-surface-variant" },
  wave_finished: { icon: "timer", cls: "bg-surface-container-highest text-on-surface-variant" },
  donor_declined: { icon: "close", cls: "bg-surface-container-highest text-on-surface-variant" },
  donor_accepted: { icon: "favorite", cls: "bg-success-container text-on-success-container" },
  bank_fallback: { icon: "bank", cls: "bg-inverse-surface text-inverse-on-surface" },
  fulfilled: { icon: "task", cls: "bg-success text-on-success" },
  cancelled: { icon: "close", cls: "bg-surface-container-highest text-on-surface-variant" },
  expired: { icon: "history", cls: "bg-surface-container-highest text-on-surface-variant" },
};

/** The agents' decisions in order, as an M3 list with a connecting line. */
export function Timeline({ items, lang = "en" }: { items: MapSnapshot["timeline"]; lang?: Lang }) {
  if (!items.length) return null;
  return (
    <ol>
      {items.map((e, i) => {
        const look = LOOK[e.type] ?? LOOK.parsed;
        return (
          <li key={e.id} className="relative flex gap-4 pb-4 last:pb-0">
            {i < items.length - 1 && <span className="absolute bottom-0 left-[19px] top-10 w-0.5 bg-outline-variant" aria-hidden="true" />}
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${look.cls}`}>
              <Icon name={look.icon} size={20} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-body-l text-on-surface">{e.message}</span>
              <time className="text-body-s text-on-surface-variant">{formatTime(e.created_at, lang)}</time>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
