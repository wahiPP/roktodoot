"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, PageTitle, Snackbar, Switch, TextField } from "@/components/md";
import { GroupPicker } from "@/components/ParsedDetailsForm";
import { useAuth, useLang } from "@/components/Providers";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import type { DonorProfile } from "@/lib/types";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-md bg-surface-container-high" />,
});

function DonorPage() {
  const { user, refresh } = useAuth();
  const { t } = useLang();
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [group, setGroup] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [last, setLast] = useState("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    api<DonorProfile>("/donors/me")
      .then((p) => {
        setProfile(p);
        setGroup(p.blood_group);
        setArea(p.area);
        setLast(p.last_donation_date ?? "");
        setPos({ lat: p.lat, lng: p.lng });
        setConsent(true);
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!group) return setError("Choose your blood group.");
    if (!pos) return setError("Tap the map to mark roughly where you live or work.");
    try {
      const p = await api<DonorProfile>("/donors", {
        method: "POST",
        body: { blood_group: group, lat: pos.lat, lng: pos.lng, area, phone, last_donation_date: last || null, consent, available: profile?.available ?? true },
      });
      setProfile(p);
      setMsg("Profile saved. You'll only be asked for nearby requests that match your group.");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    }
  }

  async function toggle(v: boolean) {
    if (!profile) return;
    setProfile(await api<DonorProfile>("/donors/me/availability", { method: "PATCH", body: { available: v } }));
    setMsg(v ? "You're available again." : "Paused. You won't be contacted until you turn this back on.");
  }

  async function remove() {
    if (!window.confirm("Delete your donor profile and phone number? You will not be contacted again.")) return;
    await api("/donors/me", { method: "DELETE" });
    setProfile(null);
    setGroup("");
    setPos(null);
    setConsent(false);
    setMsg("Your donor data has been deleted.");
    refresh();
  }

  async function verify() {
    try {
      await api("/me/phone/verify", { method: "POST", body: { code } });
      setMsg("Phone verified.");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Wrong code");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 md:pt-8">
      <PageTitle supporting={profile ? undefined : "Families never see your name or exact location. Your number is shared only after you say yes."}>
        {profile ? t("profile") : t("beDonor")}
      </PageTitle>

      {profile && (
        <Card variant="filled" className="mb-6 flex items-center gap-4 p-4">
          <span
            className={`grid h-10 w-10 place-items-center rounded-full ${
              profile.available ? "bg-success-container text-on-success-container" : "bg-surface-container-highest text-on-surface-variant"
            }`}
          >
            <Icon name={profile.available ? "play" : "pause"} size={22} />
          </span>
          <div className="flex-1">
            <p className="text-title-m text-on-surface">{profile.available ? t("available") : t("paused")}</p>
            <p className="text-body-m text-on-surface-variant">
              Asked {profile.contacted_count} times, said yes {profile.accepted_count} times
            </p>
          </div>
          <Switch checked={profile.available} onChange={toggle} label={t("available")} />
        </Card>
      )}

      {user?.phone && !user.phone_verified && (
        <Card variant="filled" className="mb-6 bg-tertiary-container p-4 text-on-tertiary-container">
          <p className="flex items-center gap-2 text-title-s">
            <Icon name="verified" size={20} />
            Verify {user.phone}
          </p>
          <p className="mt-1 text-body-m">Verified donors are trusted more by families. Demo code: 123456</p>
          <div className="mt-3 flex items-start gap-2">
            <TextField label="Code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} labelBg="bg-tertiary-container" className="w-40" />
            <Button className="mt-2" onClick={verify}>
              Verify
            </Button>
          </div>
        </Card>
      )}

      <form onSubmit={save} className="space-y-6">
        <fieldset>
          <legend className="text-title-s text-on-surface">{t("bloodGroup")}</legend>
          <GroupPicker name="g" value={group} onChange={setGroup} />
        </fieldset>

        <div>
          <p className="text-title-s text-on-surface">Where are you usually?</p>
          <p className="mb-2 text-body-m text-on-surface-variant">Tap the map. Families only ever see this rounded to about 1 km.</p>
          <LocationPicker lat={pos?.lat ?? null} lng={pos?.lng ?? null} onPick={(lat, lng) => setPos({ lat, lng })} />
        </div>

        <TextField label="Area name" leadingIcon="location" value={area} onChange={(e) => setArea(e.target.value)} />
        <TextField label="Phone" type="tel" leadingIcon="call" required value={phone} onChange={(e) => setPhone(e.target.value)} supporting="01XXXXXXXXX" />
        <TextField label="Last time you gave blood" type="date" value={last} onChange={(e) => setLast(e.target.value)} supporting="Leave empty if you never have" />

        <label className="flex cursor-pointer items-start gap-3 rounded-md bg-surface-container-low p-4 text-body-m text-on-surface">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary" />
          I agree to be contacted for urgent blood requests near me. My phone number is shared with a family only after I say yes.
        </label>

        {error && (
          <p role="alert" className="text-body-m text-error">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" icon="check" full>
          {t("save")}
        </Button>
      </form>

      {profile && (
        <Button variant="text" icon="delete" className="mt-6 !text-error" onClick={remove}>
          {t("deleteData")}
        </Button>
      )}
      <Snackbar message={msg} onClose={() => setMsg("")} />
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <DonorPage />
    </RequireAuth>
  );
}
