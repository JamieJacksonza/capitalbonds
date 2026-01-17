"use client";

import Link from "next/link";
import ConsultantPie from "../_components/ConsultantPie";
import { useDeals } from "../_components/useDeals";

function toAmount(d: any): number {
  const raw = d?.amount_zar ?? d?.amountZar ?? d?.amount ?? 0;
  const n = typeof raw === "string" ? Number(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatZar(n: number) {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `R ${Math.round(n).toLocaleString("en-ZA")}`;
  }
}

export default function GrantedByConsultantClient() {
  const ds: any = useDeals();
  const deals: any[] = ds?.deals ?? ds?.data ?? [];
  const loading: boolean = ds?.loading ?? ds?.isLoading ?? ds?.pending ?? false;
  const errorMsg: string | null = ds?.error?.message ?? (typeof ds?.error === "string" ? ds.error : null);

  const granted = deals.filter((d) => String(d?.stage || "").toLowerCase() === "granted");

  const map = new Map<string, { consultant: string; count: number; total: number }>();
  for (const d of granted) {
    const consultant = String(d?.consultant || "Unassigned").trim() || "Unassigned";
    const row = map.get(consultant) || { consultant, count: 0, total: 0 };
    row.count += 1;
    row.total += toAmount(d);
    map.set(consultant, row);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
  const totalGranted = rows.reduce((s, r) => s + r.total, 0);
  const totalDeals = rows.reduce((s, r) => s + r.count, 0);

  const Pie: any = ConsultantPie as any;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-neutral-500">Dashboard</div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-black">Granted Value by Consultant</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Total granted across consultants, with a clean breakdown and chart.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-neutral-50"
        >
           Back to Dashboard
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-neutral-500">TOTAL GRANTED</div>
          <div className="mt-2 text-2xl font-extrabold text-black">{formatZar(totalGranted)}</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-neutral-500">GRANTED DEALS</div>
          <div className="mt-2 text-2xl font-extrabold text-black">{totalDeals.toLocaleString("en-ZA")}</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-neutral-500">CONSULTANTS</div>
          <div className="mt-2 text-2xl font-extrabold text-black">{rows.length.toLocaleString("en-ZA")}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="text-sm text-neutral-600">Loading</div>
        ) : errorMsg ? (
          <div className="text-sm font-semibold text-red-600">{errorMsg}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-neutral-600">No granted deals yet.</div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-extrabold text-black">Pie Chart</div>
              <div className="rounded-2xl border border-black/10 p-4">
                <Pie deals={granted} data={granted} items={granted} />
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-extrabold text-black">Breakdown</div>
              <div className="overflow-hidden rounded-2xl border border-black/10">
                <div className="grid grid-cols-12 bg-neutral-50 px-4 py-3 text-xs font-bold text-neutral-500">
                  <div className="col-span-6">Consultant</div>
                  <div className="col-span-2 text-right">Deals</div>
                  <div className="col-span-4 text-right">Total Granted</div>
                </div>

                <div className="divide-y divide-black/5">
                  {rows.map((r) => (
                    <div key={r.consultant} className="grid grid-cols-12 px-4 py-3">
                      <div className="col-span-6 text-sm font-semibold text-black">{r.consultant}</div>
                      <div className="col-span-2 text-right text-sm text-neutral-700">{r.count}</div>
                      <div className="col-span-4 text-right text-sm font-extrabold text-black">{formatZar(r.total)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-xs text-neutral-500">
                Tip: if a consultant is blank on a deal, it will show under <b>Unassigned</b>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}