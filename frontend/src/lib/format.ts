import type { RequestStatus } from "./types";
import type { Lang } from "./i18n";

export function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDateTime(iso: string | null, lang: Lang = "en"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string, lang: Lang = "en"): string {
  return new Date(iso).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Turns a UTC ISO string into a value for <input type="datetime-local"> in Dhaka time. */
export function toDhakaInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 6 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function fromDhakaInput(value: string): string | null {
  if (!value) return null;
  return new Date(value + ":00+06:00").toISOString();
}

export function statusTone(status: RequestStatus): "rokto" | "ok" | "wait" | "muted" {
  if (status === "ACCEPTED" || status === "FULFILLED") return "ok";
  if (status.startsWith("WAVE") || status === "BANK_FALLBACK") return "rokto";
  if (status === "HELD" || status === "PARSED") return "wait";
  return "muted";
}

export function isSearching(status: RequestStatus): boolean {
  return status.startsWith("WAVE") || status === "BANK_FALLBACK";
}
