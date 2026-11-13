"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "@/lib/api";
import { translate, type Lang, type MsgKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: MsgKey) => string;
}

const AuthCtx = createContext<AuthState | null>(null);
const LangCtx = createContext<LangState | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>("en");

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<User>("/me"));
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithToken = useCallback(
    async (token: string) => {
      setToken(token);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await supabase()?.auth.signOut();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("rd_lang");
      if (saved === "bn" || saved === "en") setLangState(saved);
    } catch {
      /* ignore */
    }
    // Keep the backend token in step with the Supabase session (Google login).
    const sb = supabase();
    const sub = sb?.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setToken(session.access_token);
        refresh();
      }
    });
    refresh();
    return () => sub?.data.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("rd_lang", l);
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, signInWithToken, signOut }}>
      <LangCtx.Provider value={{ lang, setLang, t: (k) => translate(k, lang) }}>{children}</LangCtx.Provider>
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside Providers");
  return c;
}

export function useLang(): LangState {
  const c = useContext(LangCtx);
  // Fallback lets components render in isolation (unit tests).
  return c ?? { lang: "en", setLang: () => {}, t: (k) => translate(k, "en") };
}
