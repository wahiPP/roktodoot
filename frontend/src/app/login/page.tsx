"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, TextField } from "@/components/md";
import { Logo } from "@/components/Nav";
import { useAuth, useLang } from "@/components/Providers";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function LoginInner() {
  const { user, signInWithToken } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [devEnabled, setDevEnabled] = useState(false);
  const [email, setEmail] = useState("requester@demo.roktodoot.org");
  const [asAdmin, setAsAdmin] = useState(false);
  const [error, setError] = useState("");
  const google = supabase();

  useEffect(() => {
    api<{ dev_login_enabled: boolean }>("/auth/config")
      .then((c) => setDevEnabled(c.dev_login_enabled))
      .catch(() => setError("Cannot reach the server. Is the backend running?"));
  }, []);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ access_token: string }>("/auth/dev-login", {
        method: "POST",
        body: { email, role: asAdmin ? "admin" : "user" },
      });
      await signInWithToken(r.access_token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6 md:pt-12">
      <Card variant="elevated" className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-headline-s text-on-surface">{t("signIn")}</h1>
          <p className="mt-1 text-body-m text-on-surface-variant">Sign in so donors can trust your request and you can follow it.</p>
        </div>

        {google ? (
          <button
            onClick={() =>
              google.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
              })
            }
            className="state-layer mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-outline text-label-l text-on-surface"
          >
            <GoogleMark />
            {t("signInGoogle")}
          </button>
        ) : (
          <p className="mt-6 flex gap-3 rounded-md bg-tertiary-container p-4 text-body-m text-on-tertiary-container">
            <Icon name="info" size={20} />
            Google login is not set up yet. Add the Supabase keys to enable it (see the setup guide).
          </p>
        )}

        {devEnabled && (
          <form onSubmit={devLogin} className="mt-6 border-t border-outline-variant pt-6">
            <h2 className="text-title-m text-on-surface">Demo login</h2>
            <p className="mb-4 text-body-s text-on-surface-variant">
              Development only. Seeded accounts: requester@, admin@, donor001@ … donor200@demo.roktodoot.org
            </p>
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} labelBg="bg-surface-container-low" />
            <label className="mt-3 flex cursor-pointer items-center gap-3 text-body-m text-on-surface">
              <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} className="h-[18px] w-[18px] accent-primary" />
              Sign in as admin
            </label>
            <Button type="submit" variant="tonal" full className="mt-4">
              Continue
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-4 text-body-m text-error">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
