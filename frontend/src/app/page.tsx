"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Chip, TextArea } from "@/components/md";
import { useAuth, useLang } from "@/components/Providers";
import { RingsDiagram } from "@/components/RingsDiagram";
import { api, ApiError } from "@/lib/api";
import type { BloodRequest } from "@/lib/types";

const EXAMPLES = [
  "Dhaka Medical e O+ lagbe, 2 bag, aj raate",
  "স্কয়ার হাসপাতালে বি নেগেটিভ ১ ব্যাগ, জরুরি",
  "AB+ 1 bag needed at United Hospital tomorrow morning",
];

export default function Home() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user) {
      try {
        sessionStorage.setItem("rd_draft", text);
      } catch {
        /* ignore */
      }
      router.push("/login?next=/request/new");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<BloodRequest>("/requests", { method: "POST", body: { text } });
      router.push(`/request/new?id=${r.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:pt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card variant="filled" className="bg-primary-container p-6 text-on-primary-container sm:p-8">
          <form onSubmit={submit}>
            <p lang="bn" className="text-title-m opacity-80">
              রক্ত লাগবে?
            </p>
            <h1 className="mt-1 text-display-s sm:text-display-m">{lang === "bn" ? "রক্ত খুঁজুন, দ্রুত" : "Need blood?"}</h1>
            <p className="mt-3 max-w-md text-body-l opacity-90">
              {lang === "bn" ? t("tagline") : "Write who needs blood, where, and how many bags. We find donors nearby and contact them for you."}
            </p>
            <TextArea
              id="need"
              className="mt-6"
              label={t("needBlood")}
              labelBg="bg-primary-container"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("placeholder")}
              error={error || undefined}
            />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
              {EXAMPLES.map((ex) => (
                <Chip key={ex} icon="edit" onClick={() => setText(ex)} className="max-w-full bg-surface-container-lowest/60">
                  {ex}
                </Chip>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button type="submit" size="lg" icon="search" disabled={busy || !text.trim()}>
                {busy ? "…" : t("findDonors")}
              </Button>
              <Button variant="text" href={user ? "/request/new?form=1" : "/login?next=/request/new%3Fform%3D1"}>
                {t("useForm")}
              </Button>
            </div>
          </form>
        </Card>

        <Card variant="outlined" className="p-6">
          <h2 className="text-title-l text-on-surface">{t("howTitle")}</h2>
          <p className="mb-2 mt-1 text-body-m text-on-surface-variant">{t("how1")}</p>
          <RingsDiagram lang={lang} />
        </Card>
      </div>

      <Card variant="elevated" className="mt-6 flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-success-container text-on-success-container">
          <Icon name="favorite" />
        </span>
        <p className="min-w-[200px] flex-1 text-body-l text-on-surface">{t("donorPitch")}</p>
        <Button variant="tonal" icon="person" href={user ? "/donor" : "/login?next=/donor"}>
          {t("beDonor")}
        </Button>
      </Card>

      <p className="mt-6 flex items-center gap-2 text-body-s text-on-surface-variant">
        <Icon name="info" size={16} />
        {t("notMedical")}
      </p>
    </div>
  );
}
