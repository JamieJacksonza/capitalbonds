"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function cls(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMsg(data?.error || "Login failed");
        setLoading(false);
        return;
      }

      try {
        const name = String(data?.user?.name || "").trim();
        if (name) localStorage.setItem("cb_user", name);
      } catch {}

      window.location.assign("/dashboard");
    } catch (err: any) {
      setMsg(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[78vh] max-w-5xl items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl gap-6 rounded-[32px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:grid-cols-[1.05fr_0.95fr] md:p-5">
        <div className="rounded-[28px] bg-[#142037] px-8 py-10 text-white">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Capital Bonds</div>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-white">Welcome back</h1>
          <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-white/72">
            Access the pipeline, track status changes, and manage submissions from one executive dashboard.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#142037]/55">Secure access</div>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#142037]">Sign in</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Use your account email (or name) and password.
        </p>

        {msg && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-extrabold text-red-700">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <div className="mb-2 text-xs font-extrabold text-black">Email or name</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="text"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              placeholder="name@company.com or Kristie"
            />
          </div>

          <div>
            <div className="mb-2 text-xs font-extrabold text-black">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              placeholder=""
            />
          </div>

          <button
            disabled={loading}
            className={cls(
              "w-full rounded-2xl bg-[#142037] px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white hover:bg-[#1a2a49]",
              loading && "opacity-60"
            )}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
