import type { Lang } from "@/lib/i18n";
import type { RequestStatus } from "@/lib/types";
import { Icon } from "./Icon";

const STEPS: Record<Lang, string[]> = {
  en: ["5 km", "10 km", "25 km", "Banks"],
  bn: ["৫ কিমি", "১০ কিমি", "২৫ কিমি", "ব্যাংক"],
};

/** Which ring the search has reached, as a horizontal stepper. */
export function WaveStepper({ status, currentWave, lang = "en" }: { status: RequestStatus; currentWave: number; lang?: Lang }) {
  const searching = status.startsWith("WAVE") || status === "BANK_FALLBACK";
  const reached = status === "BANK_FALLBACK" ? 4 : currentWave;
  const steps = STEPS[lang];
  return (
    <ol className="flex items-center" aria-label="Search progress">
      {steps.map((label, i) => {
        const step = i + 1;
        const active = searching && step === reached;
        const done = step < reached || (!searching && step <= reached);
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={active ? "step" : undefined}>
            <span className="flex flex-col items-center gap-1">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-label-s ${
                  active ? "bg-primary text-on-primary ring-4 ring-primary/20" : done ? "bg-on-surface-variant text-surface" : "border border-outline text-on-surface-variant"
                }`}
              >
                {done ? <Icon name="check" size={14} /> : step}
              </span>
              <span className={`whitespace-nowrap text-label-m ${active ? "text-primary" : "text-on-surface-variant"}`}>{label}</span>
            </span>
            {step < steps.length && <span className={`mx-1 mb-5 h-px flex-1 ${done ? "bg-on-surface-variant" : "bg-outline-variant"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
