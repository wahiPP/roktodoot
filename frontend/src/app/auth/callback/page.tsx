"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { supabase } from "@/lib/supabase";

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const { signInWithToken } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    (async () => {
      const code = params.get("code");
      if (code) await sb.auth.exchangeCodeForSession(code);
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        setError("Google sign-in did not complete. Try again.");
        return;
      }
      await signInWithToken(data.session.access_token);
      router.replace(params.get("next") || "/");
    })();
  }, [params, router, signInWithToken]);

  return <p className="p-6 text-body-l text-on-surface-variant">{error || "Signing you in…"}</p>;
}

export default function CallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
