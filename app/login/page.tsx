"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function cls(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMsg(data?.error || "Login failed");
        setLoading(false);
        return;
      }

      try {
        localStorage.setItem("cb_user", name);
      } catch {}

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <div className="w-full rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="text-xs font-extrabold text-black/70">Capital Bonds</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-black">Sign in</h1>
        <p className="mt-2 text-sm font-semibold text-black/80">
          Use your consultant credentials from Supabase.
        </p>

        {msg && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-extrabold text-red-700">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <div className="mb-2 text-xs font-extrabold text-black">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              placeholder="Consultant name"
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
              "w-full rounded-2xl bg-black px-4 py-3 text-sm font-extrabold text-white hover:opacity-90",
              loading && "opacity-60"
            )}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-xs font-bold text-black/60">
            Ask an admin to update your login details in Supabase if needed.
          </div>
        </form>
      </div>
    </div>
  );
}
