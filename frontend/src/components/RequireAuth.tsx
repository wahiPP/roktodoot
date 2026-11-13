"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./Providers";

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, router, path]);

  if (loading || !user) return <p className="p-6 text-body-l text-on-surface-variant">Loading…</p>;
  if (admin && user.role !== "admin") return <p className="p-6 text-body-l text-on-surface-variant">This page is for admins.</p>;
  return <>{children}</>;
}
