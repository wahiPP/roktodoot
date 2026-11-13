"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { LinearProgress, PageTitle } from "@/components/md";
import { ParsedDetailsForm, toPayload, type ParsedValues } from "@/components/ParsedDetailsForm";
import { useLang } from "@/components/Providers";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import type { BloodRequest, Hospital } from "@/lib/types";

function NewRequest() {
  const { t } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [req, setReq] = useState<BloodRequest | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Hospital[]>("/hospitals").then(setHospitals).catch(() => {});
    (async () => {
      const id = params.get("id");
      let draft = "";
      try {
        draft = sessionStorage.getItem("rd_draft") || "";
        sessionStorage.removeItem("rd_draft");
      } catch {
        /* ignore */
      }
      try {
        if (id) setReq(await api<BloodRequest>(`/requests/${id}`));
        else if (draft) {
          const r = await api<BloodRequest>("/requests", { method: "POST", body: { text: draft } });
          router.replace(`/request/new?id=${r.id}`);
          setReq(r);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load the request");
      }
      setReady(true);
    })();
  }, [params, router]);

  async function submit(v: ParsedValues) {
    setBusy(true);
    setError("");
    try {
      const payload = toPayload(v);
      let r = req;
      if (r) {
        r = await api<BloodRequest>(`/requests/${r.id}`, { method: "PATCH", body: payload });
      } else {
        r = await api<BloodRequest>("/requests", {
          method: "POST",
          body: { ...payload, blood_group: payload.blood_group || undefined },
        });
      }
      setReq(r);
      await api(`/requests/${r.id}/confirm`, { method: "POST" });
      router.push(`/requests/${r.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && typeof e.detail === "object") {
        const d = e.detail as { missing?: string[]; follow_up?: BloodRequest["follow_up"] };
        if (req) setReq({ ...req, missing: d.missing, follow_up: d.follow_up });
        setError(d.follow_up?.en || e.message);
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      }
      setBusy(false);
    }
  }

  if (!ready)
    return (
      <div className="mx-auto max-w-xl px-4 pt-8">
        <p className="mb-3 text-body-l text-on-surface-variant">Reading your message…</p>
        <LinearProgress value={60} />
      </div>
    );

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 md:pt-8">
      <PageTitle supporting={t("checkHint")}>{t("checkDetails")}</PageTitle>
      {req?.raw_text && (
        <div className="mb-6 flex gap-3 rounded-md bg-surface-container p-4">
          <Icon name="forum" className="text-on-surface-variant" />
          <p className="text-body-l text-on-surface">{req.raw_text}</p>
        </div>
      )}
      <ParsedDetailsForm key={req?.id ?? "form"} request={req} hospitals={hospitals} busy={busy} submitLabel={t("confirmSend")} onSubmit={submit} />
      {error && (
        <p role="alert" className="mt-3 text-body-m text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Suspense>
        <NewRequest />
      </Suspense>
    </RequireAuth>
  );
}
