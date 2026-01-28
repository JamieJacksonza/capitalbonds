"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function moneyZar(n: any) {
  const v = Number(n ?? 0);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(safe));
}

function pickAmount(d: any) {
  return d?.amount_zar ?? d?.amount ?? d?.amountZar ?? 0;
}

function toStr(v: any) {
  const s = String(v ?? "").trim();
  return s || "-";
}

function kv(d: any) {
  return [
    ["Deal Code", d?.deal_code ?? d?.dealCode],
    ["Applicant", d?.applicant],
    ["Bank", d?.bank],
    ["Status", d?.stage],
    ["Consultant", d?.consultant],
    ["Agent", d?.agent_name ?? d?.agentName],
    ["Attorney/Firm", d?.registration_attorney ?? d?.attorney],
    ["Registration Number", d?.registration_number],
    ["Payment Due Date", d?.payment_due_date],
    ["Submitted Date", d?.submitted_date],
    ["Amount", moneyZar(pickAmount(d))],
    ["Last Moved By", d?.last_moved_by],
    ["Last Moved At", d?.last_moved_at],
    ["Notes", d?.notes],
  ];
}

export default function DealByCodePage({ params }: { params: { code: string } }) {
  const rawParam = String(params?.code ?? "").trim();
  let code = rawParam;
  try { code = decodeURIComponent(rawParam); } catch {}

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        const c = String(code ?? "").trim();
        if (!c) throw new Error("Missing deal code.");
        if (!c.toUpperCase().startsWith("SB")) {
          throw new Error(`This page expects an SB deal code (got: ${c}).`);
        }

        const res = await fetch(`/api/deals/${encodeURIComponent(c)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || `Failed to load deal (HTTP ${res.status})`);
        }

        const d = data?.deal ?? data;
        if (!cancelled) {
          setDeal(d);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message || e || "Unknown error"));
          setLoading(false);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [code]);

  const rows = useMemo(() => (deal ? kv(deal) : []), [deal]);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-5xl px-7 py-10 md:px-12 lg:px-16">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-black">Deal Details</div>
            <div className="mt-1 text-sm font-semibold text-black/60">Code: {toStr(code)}</div>
          </div>

          <Link
            href="/submitted"
            className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-extrabold text-black hover:bg-black/[0.03]"
          >
            Back
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/70">
            Loading deal...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : !deal ? (
          <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm font-semibold text-black/70">
            Deal not found.
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
            <div className="mb-4 text-sm font-extrabold text-black">Summary</div>

            <div className="overflow-hidden rounded-2xl border border-black/10">
              <table className="w-full text-left">
                <tbody>
                  {rows.map(([k, v]) => (
                    <tr key={String(k)} className="border-t border-black/10 first:border-t-0">
                      <td className="w-[220px] px-5 py-3 text-xs font-extrabold text-black/60">
                        {String(k)}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-black whitespace-pre-wrap">
                        {String(v ?? "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-[11px] font-semibold text-black/50">
              Tip: You can paste a URL like /deal-by-code/SB-CF00D3 directly.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
