"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDeals } from "../../_components/useDeals";

function moneyZar(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n || 0)));
}

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dealAmount(d: any) {
  return toNumber(d?.amount_zar ?? d?.amount ?? 0);
}

function dealDate(d: any): Date | null {
  const sd = String(d?.submitted_date ?? d?.submittedDate ?? "").trim();
  if (sd) return new Date(`${sd}T12:00:00`);
  const ca = String(d?.created_at ?? d?.createdAt ?? "").trim();
  if (ca) return new Date(ca);
  return null;
}

function inRange(dt: Date | null, from: string, to: string) {
  if (!dt) return true;
  const fromDt = from ? new Date(`${from}T00:00:00`) : null;
  const toDt = to ? new Date(`${to}T23:59:59`) : null;
  if (fromDt && dt < fromDt) return false;
  if (toDt && dt > toDt) return false;
  return true;
}

function pickAgent(d: any): string {
  const a = String(d?.agent_name ?? d?.agentName ?? "").trim();
  return a || "Unassigned";
}

function norm(s: string) {
  return String(s || "").trim().toLowerCase();
}

export default function AgentDealsPage() {
  const params = useParams();
  const sp = useSearchParams();

  const raw = (params as any)?.name ?? "";
  const selected = String(raw || "").trim();

  const [from, setFrom] = useState<string>(sp.get("from") || "");
  const [to, setTo] = useState<string>(sp.get("to") || "");

  const { deals, loading, error } = useDeals();

  const filtered = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    const who = norm(selected);

    return list
      .filter((d: any) => norm(pickAgent(d)) === who)
      .filter((d: any) => inRange(dealDate(d), from, to))
      .sort((a: any, b: any) => {
        const ad = dealDate(a)?.getTime() ?? 0;
        const bd = dealDate(b)?.getTime() ?? 0;
        return bd - ad;
      });
  }, [deals, selected, from, to]);

  const total = useMemo(() => filtered.reduce((s: number, d: any) => s + dealAmount(d), 0), [filtered]);

  return (
    <div className="mx-auto w-full max-w-7xl px-7 py-10 md:px-12 lg:px-16">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-extrabold text-black/60">
            <Link href="/" className="hover:underline">Dashboard</Link> / Agent
          </div>
          <div className="mt-2 text-2xl font-extrabold text-black">{selected}</div>
          <div className="mt-1 text-sm font-semibold text-black/60">
            {filtered.length} deal(s)  {moneyZar(total)}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm">
          <div className="text-[11px] font-extrabold text-black/60">Filter by date</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-black/60">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-black/10 px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-black/60">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-black/10 px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
              />
            </label>

            <button
              onClick={() => { setFrom(""); setTo(""); }}
              className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:bg-black/[0.03]"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black/60">
          Loading deals...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
          Deals API error: {String(error)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-sm font-semibold text-black/60">
          No deals match this agent + date range.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02]">
              <tr className="text-xs font-extrabold text-black">
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => (
                <tr key={d.id} className="border-t border-black/10 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-extrabold">{String(d?.deal_code ?? d?.id ?? "")}</td>
                  <td className="px-4 py-3">{String(d?.applicant ?? "")}</td>
                  <td className="px-4 py-3 font-extrabold">{String(d?.stage ?? "").toUpperCase()}</td>
                  <td className="px-4 py-3">{String(d?.bank ?? "")}</td>
                  <td className="px-4 py-3">{String(d?.submitted_date ?? "").trim() || ""}</td>
                  <td className="px-4 py-3 text-right font-extrabold">{moneyZar(dealAmount(d))}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/deal/${encodeURIComponent(String(d?.id))}`}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black hover:bg-black/[0.03]"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}