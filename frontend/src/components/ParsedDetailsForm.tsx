"use client";

import { useState } from "react";
import { fromDhakaInput, toDhakaInput } from "@/lib/format";
import { BLOOD_GROUPS, type BloodRequest, type Hospital } from "@/lib/types";
import { Icon } from "./Icon";
import { Button, SelectField, TextField } from "./md";
import { useLang } from "./Providers";

export interface ParsedValues {
  blood_group: string;
  units: string;
  hospital_id: string;
  needed_by: string; // datetime-local in Dhaka time
  urgency: "normal" | "critical";
  contact_phone: string;
}

export function initialValues(r: BloodRequest | null): ParsedValues {
  return {
    blood_group: r?.blood_group ?? "",
    units: r?.units ? String(r.units) : "",
    hospital_id: r?.hospital_id ? String(r.hospital_id) : "",
    needed_by: toDhakaInput(r?.needed_by ?? null),
    urgency: r?.urgency ?? "normal",
    contact_phone: r?.contact_phone ?? "",
  };
}

export function toPayload(v: ParsedValues) {
  return {
    blood_group: v.blood_group || null,
    units: v.units ? Number(v.units) : null,
    hospital_id: v.hospital_id ? Number(v.hospital_id) : null,
    needed_by: fromDhakaInput(v.needed_by),
    urgency: v.urgency,
    contact_phone: v.contact_phone || null,
  };
}

const FIELD_FOR_MISSING: Record<string, keyof ParsedValues> = {
  blood_group: "blood_group",
  units: "units",
  hospital: "hospital_id",
  contact_phone: "contact_phone",
};

/** The eight blood groups as M3 filter chips (radio semantics). */
export function GroupPicker({ value, onChange, name, error }: { value: string; onChange: (g: string) => void; name: string; error?: boolean }) {
  return (
    <div className={`mt-2 grid grid-cols-4 gap-2 ${error ? "rounded-sm outline outline-1 outline-offset-4 outline-error" : ""}`}>
      {BLOOD_GROUPS.map((g) => {
        const on = value === g;
        return (
          <label
            key={g}
            className={`state-layer flex h-10 cursor-pointer items-center justify-center gap-1 rounded-sm text-label-l has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-secondary ${
              on ? "bg-secondary-container text-on-secondary-container" : "border border-outline-variant text-on-surface-variant"
            }`}
          >
            <input type="radio" name={name} value={g} checked={on} onChange={() => onChange(g)} className="sr-only" />
            {on && <Icon name="check" size={18} />}
            <span aria-hidden="true">{g.replace("-", "−")}</span>
            <span className="sr-only">{g}</span>
          </label>
        );
      })}
    </div>
  );
}

interface Props {
  request: BloodRequest | null;
  hospitals: Hospital[];
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: ParsedValues) => void;
}

/** Shows what the Intake agent understood and lets the requester fix it (FR-06). */
export function ParsedDetailsForm({ request, hospitals, submitLabel, busy, onSubmit }: Props) {
  const { t, lang } = useLang();
  const [v, setV] = useState<ParsedValues>(() => initialValues(request));
  const missing = new Set((request?.missing ?? []).map((m) => FIELD_FOR_MISSING[m]));
  const set = (k: keyof ParsedValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const err = (k: keyof ParsedValues) => missing.has(k) && !v[k];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-6"
    >
      {request?.follow_up && missing.size > 0 && (
        <p role="status" className="flex items-start gap-3 rounded-md bg-tertiary-container p-4 text-body-m text-on-tertiary-container">
          <Icon name="info" size={20} />
          {request.follow_up[lang]}
        </p>
      )}

      <fieldset>
        <legend className="text-title-s text-on-surface">{t("bloodGroup")}</legend>
        <GroupPicker name="blood_group" value={v.blood_group} onChange={(g) => setV({ ...v, blood_group: g })} error={err("blood_group")} />
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <TextField label={t("bags")} type="number" min={1} max={10} value={v.units} onChange={set("units")} error={err("units") && "Required"} />
        <SelectField label={t("urgency")} value={v.urgency} onChange={set("urgency")}>
          <option value="normal">{t("normal")}</option>
          <option value="critical">{t("critical")}</option>
        </SelectField>
      </div>

      <SelectField label={t("hospital")} value={v.hospital_id} onChange={set("hospital_id")} error={err("hospital_id") && "Choose the hospital"}>
        <option value="">{request?.hospital_name && !request.hospital_id ? `${request.hospital_name} (not on our list)` : "Choose a hospital"}</option>
        {hospitals.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </SelectField>

      <TextField label={t("neededBy")} type="datetime-local" value={v.needed_by} onChange={set("needed_by")} />

      <TextField
        label={t("contactPhone")}
        type="tel"
        inputMode="tel"
        leadingIcon="call"
        value={v.contact_phone}
        onChange={set("contact_phone")}
        error={err("contact_phone") && "Required"}
        supporting="Shared with a donor only after they say yes"
      />

      <Button type="submit" size="lg" icon="send" full disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
