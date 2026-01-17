"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

function pickArray(json: any) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.deals)) return json.deals;
  if (Array.isArray(json?.rows)) return json.rows;
  return [];
}

export default function DealSbPage() {
  const router = useRouter();
  const params = useParams() as any;
  const sp = useSearchParams();

  const code = useMemo(() => {
    const p = params?.code ? String(params.code) : "";
    const q = sp?.get("code") ? String(sp.get("code")) : "";
    return (p || q || "").trim();
  }, [params, sp]);

  const [state, setState] = useState<"loading" | "notfound" | "error">("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!code) {
        if (!alive) return;
        setState("notfound");
        setMsg("Missing deal code in the URL.");
        return;
      }

      try {
        const res = await fetch("/api/deals", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const arr = pickArray(json);

        const needle = code.trim().toLowerCase();

        const match =
          arr.find((d: any) => String(d?.deal_code ?? d?.dealCode ?? "").trim().toLowerCase() === needle) ||
          arr.find((d: any) => String(d?.id ?? "").trim() === code.trim());

        const id = match?.id ? String(match.id) : "";

        if (!id) {
          if (!alive) return;
          setState("notfound");
          setMsg(`Deal not found for code: ${code}`);
          return;
        }

        // Redirect to the canonical deal page (which expects UUID)
        router.replace(`/deal/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}`);
      } catch (e: any) {
        if (!alive) return;
        setState("error");
        setMsg(e?.message || "Failed to load deals.");
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [code, router]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        {state === "loading" ? (
          <>
            <div className="text-sm font-extrabold text-black">Opening deal</div>
            <div className="mt-1 text-xs font-semibold text-black/60">{code}</div>
          </>
        ) : (
          <>
            <div className="text-sm font-extrabold text-black">Deal lookup</div>
            <div className="mt-2 text-sm font-semibold text-black/70">{msg}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
              >
                Back to dashboard
              </Link>
              {code ? (
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}