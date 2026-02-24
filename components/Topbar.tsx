import Link from "next/link";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-extrabold tracking-tight">
            Capital Bonds
          </Link>
          <span className="hidden sm:inline text-xs text-black/50">
            Pipeline dashboard
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/submitted"
            className="rounded-xl bg-black px-3 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            View pipeline
          </Link>

          <button
            className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-bold text-black/80"
            disabled
            title="Coming soon"
          >
            New entry
          </button>
        </div>
      </div>
    </header>
  );
}
