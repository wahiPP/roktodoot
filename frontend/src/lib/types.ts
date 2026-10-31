export type BloodGroup = "O-" | "O+" | "A-" | "A+" | "B-" | "B+" | "AB-" | "AB+";
export const BLOOD_GROUPS: BloodGroup[] = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export type RequestStatus =
  | "PARSED" | "HELD" | "REJECTED" | "WAVE_1" | "WAVE_2" | "WAVE_3"
  | "BANK_FALLBACK" | "ACCEPTED" | "FULFILLED" | "CANCELLED" | "EXPIRED";

export interface User {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  phone: string | null;
  phone_verified: boolean;
  is_donor: boolean;
}

export interface Bilingual { en: string; bn: string }

export interface TrustReason { signal: string; effect: number; detail: string }

export interface BloodRequest {
  id: number;
  status: RequestStatus;
  blood_group: BloodGroup | null;
  units: number | null;
  hospital_id: number | null;
  hospital_name: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  needed_by: string | null;
  urgency: "normal" | "critical";
  current_wave: number;
  wave_deadline: string | null;
  trust_score: number | null;
  created_at: string;
  accepted_at: string | null;
  fulfilled_at: string | null;
  is_mine: boolean;
  raw_text?: string;
  contact_phone?: string | null;
  parse_source?: string;
  missing?: string[];
  follow_up?: Bilingual | null;
  donor_contact: { name: string; phone: string | null; blood_group: string | null; label: string | null } | null;
  requester_contact: { phone: string | null } | null;
  trust_reasons?: TrustReason[];
  trust_note?: string;
}

export interface Hospital { id: number; name: string; city: string; lat: number; lng: number; verified: boolean }

export interface DonorProfile {
  blood_group: BloodGroup;
  lat: number;
  lng: number;
  area: string;
  last_donation_date: string | null;
  available: boolean;
  label: string;
  contacted_count: number;
  accepted_count: number;
}

export interface InboxItem {
  request_id: number;
  blood_group: BloodGroup;
  units: number;
  hospital_name: string;
  city: string | null;
  urgency: "normal" | "critical";
  needed_by: string | null;
  distance_km: number;
  wave: number;
  status: RequestStatus;
  response: string;
  sent_at: string;
}

export type DonorDotStatus = "waiting" | "accepted" | "declined" | "no_reply" | "closed";

export interface MapSnapshot {
  request_id: number;
  status: RequestStatus;
  blood_group: string | null;
  urgency: string;
  hospital: { name: string | null; lat: number | null; lng: number | null };
  current_wave: number;
  rings: { wave: number; radius_km: number; state: "active" | "done" | "pending" }[];
  donors: { label: string; lat: number; lng: number; status: DonorDotStatus; wave: number; distance_km: number }[];
  wave_deadline: string | null;
  seconds_left: number | null;
  blood_banks: { id: number; name: string; phone: string; lat: number; lng: number; distance_km: number }[];
  timeline: { id: number; type: string; message: string; created_at: string }[];
}

export interface Notification {
  id: number;
  type: string;
  payload: { text?: Bilingual; request_id?: number };
  read: boolean;
  created_at: string;
}
