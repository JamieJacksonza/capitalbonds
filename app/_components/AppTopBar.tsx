"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/overview", label: "Overview" },
  { href: "/instructed", label: "Instructed" },
  { href: "/granted", label: "Granted" },
  { href: "/aip", label: "AIP" },
  { href: "/submitted", label: "Submitted" },
  { href: "/ntu", label: "NTU" },
  { href: "/registrations", label: "Registrations" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    async function syncUser() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const name = json?.user?.name;
        if (alive && typeof name === "string" && name.trim()) {
          localStorage.setItem("cb_user", name.trim());
        }
      } catch {}
    }
    if (pathname !== "/login") {
      syncUser();
    }
    return () => {
      alive = false;
    };
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      try {
        localStorage.removeItem("cb_user");
      } catch {}
      router.push("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  if (pathname === "/login") {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 border-b border-[#1b2944] bg-[#142037] shadow-[0_14px_40px_rgba(20,32,55,0.18)]">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 md:px-6 xl:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <img
              src="/capital-bonds-logo-white.png"
              alt="Capital Bonds"
              className="block h-24 w-auto max-w-none object-contain"
            />
          </Link>
          <div className="hidden h-7 w-px bg-white/12 sm:block" />
          <nav className="hidden items-center gap-2 sm:flex">
            <Link href="/" className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/8 hover:text-white">
              Dashboard
            </Link>
            {NAV.map((n) => {
              const active = pathname === n.href || pathname?.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cls(
                    "rounded-2xl px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition",
                    active
                      ? "bg-white text-[#142037] shadow-[0_10px_24px_rgba(255,255,255,0.16)]"
                      : "text-white/78 hover:bg-white/8 hover:text-white"
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/submitted/new"
            className="rounded-2xl bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#142037] shadow-[0_8px_20px_rgba(255,255,255,0.12)] hover:bg-white/95"
          >
            + New submission
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-2xl border border-white/14 bg-white/5 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/8 disabled:opacity-60"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 pb-4 md:px-6 xl:px-8 sm:hidden">
        <div className="flex flex-wrap gap-2">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname?.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cls(
                  "rounded-2xl px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition",
                  active ? "bg-white text-[#142037]" : "text-white/78 hover:bg-white/8 hover:text-white"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
