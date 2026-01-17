"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/instructed", label: "Instructed" },
{ href: "/granted", label: "Granted" },
{ href: "/aip", label: "AIP" },
{ href: "/submitted", label: "Submitted" },
{ href: "/ntu", label: "NTU" },
{ href: "/registrations", label: "Registrations" },
{ href: "/activity", label: "Activity" },

  
  
  

  
  
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
    syncUser();
    return () => {
      alive = false;
    };
  }, []);

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

  return (
    <div className="sticky top-0 z-40 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center">
            <Image
              src="/capital-bonds-logo.svg"
              alt="Capital Bonds"
              width={180}
              height={60}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <div className="hidden h-5 w-px bg-black/10 sm:block" />
          <nav className="hidden items-center gap-2 sm:flex">
            
<Link href="/" className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-black/5">
  Dashboard
</Link>
{NAV.map((n) => {
              const active = pathname === n.href || pathname?.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cls(
                    "rounded-2xl px-3 py-2 text-xs font-extrabold transition",
                    active ? "bg-black text-white" : "text-black/70 hover:bg-black/[0.04] hover:text-black"
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
            className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
          >
            + New submission
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20 disabled:opacity-60"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </div>

      {/* mobile nav */}
      <div className="mx-auto max-w-6xl px-6 pb-4 sm:hidden">
        <div className="flex flex-wrap gap-2">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname?.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cls(
                  "rounded-2xl px-3 py-2 text-xs font-extrabold transition",
                  active ? "bg-black text-white" : "text-black/70 hover:bg-black/[0.04] hover:text-black"
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


