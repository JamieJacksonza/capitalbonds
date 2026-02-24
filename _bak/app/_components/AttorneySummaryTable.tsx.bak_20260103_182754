"use client";

import { useMemo } from "react";
import { useDeals } from "./useDeals";

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
  // Prefer amount_zar. Fall back to amount.
  return toNumber(d?.amount_zar ?? d?.amount ?? 0);
}

function pickAttorneyFirm(d: any): string {
  // We try a few fields because your data varies by stage.
  const regFirm = String(d?.registration_attorney ?? "").trim();
  if (regFirm) return regFirm;

  const topLevel = String(d?.attorney ?? "").trim();
  if (topLevel) return topLevel;

  // If there are bank rows, try the first attorney value we find
  const banks = Array.isArray(d?.banks) ? d.banks : [];
  for (const b of banks) {
    const firm = String(b?.attorney ?? "").trim();
    if (firm) return firm;
  }

  return "Unassigned";
}

type Row = { firm: string; count: number; total: number };

export default function AttorneySummaryTable(props: { dealsOverride?: any[] } = {}) {
  const hook = useDeals();
  const deals = Array.isArray(props.dealsOverride) ? props.dealsOverride : hook.deals;
  const loading = Array.isArray(props.dealsOverride) ? false : hook.loading;
  const err = Array.isArray(props.dealsOverride) ? null : hook.error;

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    const list = Array.isArray(deals) ? deals : [];

    for (const d of list) {
      const firm = pickAttorneyFirm(d);
      const amt = dealAmount(d);

      const cur = map.get(firm) || { firm, count: 0, total: 0 };
      cur.count += 1;
      cur.total += amt;
      map.set(firm, cur);
    }

    return Array.from(map.values()).sort((a, b) => (b.total - a.total) || (b.count - a.count) || a.firm.localeCompare(b.firm));
  }, [deals]);

  const grandCount = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);
  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);

  return (
    <div className="mt-10 rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-extrabold text-black">Attorney / Firm Summary</div>
          <div className="mt-1 text-xs font-semibold text-black/60">
            Deals received from Capital Bonds, grouped by attorney/firm.
          </div>
        </div>

        <div className="text-xs font-extrabold text-black">
          Total: <span className="text-black/70">{grandCount}</span> deal(s) {" "}
          <span className="text-black/70">{moneyZar(grandTotal)}</span>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 text-sm font-semibold text-black/70">Loading...</div>
      ) : err ? (
        <div className="mt-5 text-sm font-semibold text-red-600">{err}</div>
      ) : rows.length === 0 ? (
        <div className="mt-5 text-sm font-semibold text-black/70">No attorney data yet.</div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02]">
              <tr className="text-xs font-extrabold text-black">
                <th className="px-4 py-3">Attorney / Firm</th>
                <th className="px-4 py-3">Deals</th>
                <th className="px-4 py-3 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.firm} className="border-t border-black/10 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-semibold text-black">{r.firm}</td>
                  <td className="px-4 py-3 font-extrabold text-black">{r.count}</td>
                  <td className="px-4 py-3 text-right font-extrabold text-black">{moneyZar(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-[11px] font-semibold text-black/50">
        Note: If you see Unassigned, the deal doesnt have an attorney/firm value captured yet.
      </div>
    </div>
  );
}