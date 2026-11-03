"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./md";
import { useAuth, useLang } from "./Providers";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="grid place-items-center rounded-sm bg-primary text-on-primary" style={{ width: size, height: size }}>
      <Icon name="bloodtype" size={size * 0.7} />
    </span>
  );
}

interface Destination {
  href: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  match: (p: string) => boolean;
}

function useDestinations(): Destination[] {
  const { user } = useAuth();
  const { t } = useLang();
  const d: Destination[] = [{ href: "/", label: t("navHome"), icon: "home", activeIcon: "home_fill", match: (p) => p === "/" || p.startsWith("/request/") }];
  if (user) {
    d.push({ href: "/requests", label: t("myRequests"), icon: "list", activeIcon: "list_fill", match: (p) => p.startsWith("/requests") });
    d.push({
      href: user.is_donor ? "/donor/inbox" : "/donor",
      label: t("navDonate"),
      icon: "inbox",
      activeIcon: "inbox_fill",
      match: (p) => p.startsWith("/donor"),
    });
    d.push({ href: "/notifications", label: t("alerts"), icon: "bell", activeIcon: "bell_fill", match: (p) => p.startsWith("/notifications") });
    if (user.role === "admin") d.push({ href: "/admin", label: t("admin"), icon: "admin", activeIcon: "admin_fill", match: (p) => p.startsWith("/admin") });
  } else {
    d.push({ href: "/login?next=/donor", label: t("navDonate"), icon: "inbox", activeIcon: "inbox_fill", match: (p) => p.startsWith("/donor") });
    d.push({ href: "/login", label: t("signIn"), icon: "login", activeIcon: "login", match: (p) => p.startsWith("/login") });
  }
  return d;
}

/** M3 small top app bar. */
export function TopAppBar() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLang();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 bg-surface md:pl-20">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-3 md:hidden">
          <Logo />
        </Link>
        <span className="text-title-l text-on-surface">{t("appName")}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="state-layer inline-flex h-10 items-center gap-2 rounded-full px-3 text-label-l text-on-surface-variant"
          >
            <Icon name="translate" size={20} />
            {lang === "en" ? "বাংলা" : "English"}
          </button>
          {user && (
            <IconButton
              icon="logout"
              label={t("signOut")}
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}

/** M3 navigation bar (phones) and navigation rail (tablets and desktop). */
export function Navigation() {
  const items = useDestinations();
  const path = usePathname();
  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex h-20 bg-surface-container md:hidden">
        {items.map((d) => {
          const on = d.match(path);
          return (
            <Link key={d.href} href={d.href} aria-current={on ? "page" : undefined} className="group flex flex-1 flex-col items-center justify-center gap-1">
              <span
                className={`state-layer grid h-8 w-16 place-items-center rounded-full transition-colors ${
                  on ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"
                }`}
              >
                <Icon name={on ? d.activeIcon : d.icon} />
              </span>
              <span className={`text-label-m ${on ? "text-on-surface" : "text-on-surface-variant"}`}>{d.label}</span>
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Main" className="fixed inset-y-0 left-0 z-50 hidden w-20 flex-col items-center gap-3 bg-surface pt-3 md:flex">
        <Link href="/" className="mb-6 mt-1">
          <Logo size={40} />
        </Link>
        {items.map((d) => {
          const on = d.match(path);
          return (
            <Link key={d.href} href={d.href} aria-current={on ? "page" : undefined} className="flex w-full flex-col items-center gap-1">
              <span
                className={`state-layer grid h-8 w-14 place-items-center rounded-full ${
                  on ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"
                }`}
              >
                <Icon name={on ? d.activeIcon : d.icon} />
              </span>
              <span className={`text-center text-label-m ${on ? "text-on-surface" : "text-on-surface-variant"}`}>{d.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Kept for older imports. */
export function Nav() {
  return (
    <>
      <TopAppBar />
      <Navigation />
    </>
  );
}
