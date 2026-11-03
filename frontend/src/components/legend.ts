import type { DonorDotStatus } from "@/lib/types";

// Kept separate from EscalationMap so it can be used without loading Leaflet.
export const DOT_LEGEND: { status: DonorDotStatus; label: string; color: string }[] = [
  { status: "waiting", label: "Waiting", color: "#8C6A1F" },
  { status: "accepted", label: "Accepted", color: "#186D33" },
  { status: "declined", label: "Declined", color: "#857371" },
  { status: "no_reply", label: "No reply", color: "#D8C2BF" },
];
