"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { name: "Dashboard", href: "/" },
  { name: "Pipeline", href: "/pipeline" },
  { name: "Overview", href: "/overview" },
  { name: "Submitted", href: "/submitted" },
  { name: "Granted", href: "/granted" },
  { name: "AIP", href: "/aip" },
  { name: "Instructed", href: "/instructed" },
  { name: "NTU", href: "/ntu" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-black/10 md:bg-white">
      <div className="px-5 py-5">
        <div className="text-lg font-extrabold tracking-tight">Capital Bonds</div>
        <div className="mt-1 text-xs text-black/60">Internal dashboard portal</div>
      </div>

      <nav className="flex-1 px-3 pb-6">
        <div className="space-y-1">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-black text-white shadow-sm"
                    : "text-black/80 hover:bg-black/[0.04] hover:text-black",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-2 w-2 rounded-full",
                    active ? "bg-white/70" : "bg-black/20",
                  ].join(" ")}
                />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-black/10 px-5 py-4 text-xs text-black/60">
        Version 0.1 • Web dashboard
      </div>
    </aside>
  );
}
