"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useDeals } from "./useDeals";
import AgentSummaryTable from "./AgentSummaryTable";
import AttorneySummaryTable from "./AttorneySummaryTable";
import ConsultantPipelinePerformance from "./ConsultantPipelinePerformance";
import ConsultantPipelineSummary from "./ConsultantPipelineSummary";
const CONSULTANT_PALETTE = [
  "#d32f2f", // red
  "#1976d2", // blue
  "#388e3c", // green
  "#7b1fa2", // purple
  "#f57c00", // orange
  "#0097a7", // teal
  "#c2185b", // magenta
  "#5d4037", // brown
  "#512da8", // deep indigo
  "#00796b", // dark teal
  "#455a64", // blue-grey
  "#689f38", // lime (darker)
  "#e64a19", // deep orange
  "#303f9f", // indigo
  "#0288d1", // strong cyan-blue
  "#afb42b", // olive
  "#00897b", // teal alt
  "#8e24aa", // purple alt
  "#6d4c41", // brown alt
  "#ad1457"  // deep pink
];function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function colorForConsultant(name: any) {
  const key = String(name ?? "").trim().toLowerCase() || "unknown";
  const hue = hashStr(key) % 360;
  return `hsl(${hue}, 85%, 45%)`;
}
type Stage = "instructed" | "granted" | "aip" | "submitted" | "ntu" | "registrations";
const STAGES: Stage[] = ["instructed","granted","aip","submitted","ntu","registrations"];

function stageLabel(s: Stage) {
  if (s === "submitted") return "Submitted";
  if (s === "aip") return "AIP";
  if (s === "instructed") return "Instructed";
  if (s === "granted") return "Granted";
  if (s === "ntu") return "NTU";
  if (s === "registrations") return "Registrations";
  return String(s);
}

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

function dealDateKey(d: any): Date | null {
  const sd = String(d?.submitted_date ?? d?.submittedDate ?? d?.submitted ?? "").trim();
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

/**
 * Color-blind-friendly (your request):
 * Red, Yellow, Black, Blue (repeat)
 */
const PALETTE = ["#dc2626", "#facc15", "#111827", "#2563eb"];

function hashToIndex(input: string, mod: number) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

function colorForKey(key: string) {
  const k = String(key || "Unknown");
  return PALETTE[hashToIndex(k, PALETTE.length)];
}

type Slice = { label: string; value: number; color: string };

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

function isInsuranceOpted(v: any) {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

function computeConsultantScores(deals: any[]) {
  const stagePoints: Record<string, number> = {
    submitted: 1,
    aip: 3,
    instructed: 6,
    granted: 10,
    registrations: 14,
    ntu: -6,
  };

  const byConsultant = new Map<string, { raw: number; deals: number; totalValue: number }>();

  for (const d of deals || []) {
    const name = String(d?.consultant ?? "").trim() || "Unassigned";
    const stage = String(d?.stage ?? "submitted").toLowerCase().trim() || "submitted";
    const value = toNumber(d?.amount_zar ?? d?.amount ?? d?.deal_value ?? d?.dealValue ?? 0);

    const dateStr = String(d?.submitted_date ?? d?.submittedDate ?? d?.created_at ?? "").trim();
    const date = dateStr ? new Date(dateStr) : new Date();
    const ageDays = Number.isFinite(date.getTime())
      ? Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const stagePts = stagePoints[stage] ?? stagePoints.submitted;
    const valueFactor = Math.log(value + 1);
    const speedFactor = 1 / (1 + ageDays / 14);

    const dealScore = stagePts * valueFactor * speedFactor;

    const cur = byConsultant.get(name) || { raw: 0, deals: 0, totalValue: 0 };
    cur.raw += dealScore;
    cur.deals += 1;
    cur.totalValue += value;
    byConsultant.set(name, cur);
  }

  const list = Array.from(byConsultant.entries()).map(([name, v]) => ({
    name,
    raw: v.raw,
    deals: v.deals,
    totalValue: v.totalValue,
  }));

  const maxRaw = list.reduce((m, r) => Math.max(m, r.raw), 0);

  return list
    .map((r) => ({
      ...r,
      score: maxRaw > 0 ? (r.raw / maxRaw) * 100 : 0,
    }))
    .sort((a, b) => (b.score - a.score) || (b.raw - a.raw) || a.name.localeCompare(b.name));
}

function computeRegistrationTimingByConsultant(deals: any[]) {
  const rows = new Map<string, { total: number; count: number; min: number; max: number }>();

  for (const d of deals || []) {
    const stage = String(d?.stage ?? "submitted").toLowerCase().trim();
    if (stage !== "registrations") continue;

    const submittedRaw = d?.submitted_at ?? d?.created_at;
    const registeredRaw =
      d?.registered_at ??
      (stage === "registrations" ? d?.stage_updated_at : null) ??
      (stage === "registrations" ? d?.updated_at : null);

    const submittedAt = submittedRaw ? new Date(String(submittedRaw)) : null;
    const registeredAt = registeredRaw ? new Date(String(registeredRaw)) : null;

    if (!submittedAt || !registeredAt) continue;
    if (Number.isNaN(submittedAt.getTime()) || Number.isNaN(registeredAt.getTime())) continue;

    const diffMs = registeredAt.getTime() - submittedAt.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(days) || days < 0) continue;

    const name = String(d?.consultant ?? "").trim() || "Unassigned";
    const cur = rows.get(name) || { total: 0, count: 0, min: Number.POSITIVE_INFINITY, max: 0 };
    cur.total += days;
    cur.count += 1;
    cur.min = Math.min(cur.min, days);
    cur.max = Math.max(cur.max, days);
    rows.set(name, cur);
  }

  return Array.from(rows.entries()).map(([name, v]) => ({
    name,
    avg: v.count ? v.total / v.count : 0,
    count: v.count,
    min: Number.isFinite(v.min) ? v.min : 0,
    max: Number.isFinite(v.max) ? v.max : 0,
  }));
}

function buildPieStyle(items: Slice[]) {
  const total = items.reduce((s, x) => s + clamp(x.value), 0);
  if (total <= 0) return { background: "conic-gradient(#e5e7eb 0 360deg)" };

  let acc = 0;
  const parts: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const v = clamp(items[i].value);
    const frac = v / total;
    const start = acc * 360;
    const end = (acc + frac) * 360;
    parts.push(`${items[i].color} ${start}deg ${end}deg`);
    acc += frac;
  }

  return { background: `conic-gradient(${parts.join(", ")})` };
}

function ConsultantSection({
  title,
  stage,
  deals,
}: {
  title: string;
  stage: Stage;
  deals: any[];
}) {
  const stageDeals = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    return list.filter((d) => String(d?.stage || "").toLowerCase() === String(stage));
  }, [deals, stage]);

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const d of stageDeals) {
      const name = String(d?.consultant ?? "").trim() || "Unassigned";
      const cur = map.get(name) || { name, total: 0, count: 0 };
      cur.total += dealAmount(d);
      cur.count += 1;
      map.set(name, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => (b.total - a.total) || (b.count - a.count) || a.name.localeCompare(b.name)
    );
  }, [stageDeals]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const count = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  const slices = useMemo(() => {
    const positive = rows.filter((r) => r.total > 0);
    const top = positive.slice(0, 8).map((r) => ({
      label: r.name,
      value: r.total,
      color: colorForKey(r.name),
    }));
    if (positive.length <= 8) return top;

    const rest = positive.slice(8);
    const otherValue = rest.reduce((s, r) => s + r.total, 0);
    return [...top, { label: "Other", value: otherValue, color: "#6b7280" }];
  }, [rows]);

  const pieStyle = buildPieStyle(slices);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-extrabold text-black">{title}</div>
          <div className="mt-1 text-xs font-semibold text-black/60">
            {count} deal(s)  Total{" "}
            <span className="font-extrabold text-black">{moneyZar(total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Pie + legend */}
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <div className="text-xs font-extrabold text-black/60">Pie</div>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="relative h-56 w-56 shrink-0">
              <div className="h-56 w-56 rounded-full border border-black/10" style={pieStyle as any} />
              <div className="absolute inset-0 m-auto h-28 w-28 rounded-full border border-black/10 bg-white shadow-sm" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[10px] font-extrabold text-black/60">TOTAL</div>
                  <div className="text-base font-extrabold text-black whitespace-nowrap">
                    {moneyZar(total)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {slices.length === 0 ? (
                <div className="text-xs font-semibold text-black/70">No data yet.</div>
              ) : (
                slices.map((x, i) => {
                  const t = slices.reduce((s, z) => s + clamp(z.value), 0);
                  const pct = t > 0 ? (clamp(x.value) / t) * 100 : 0;
                  return (
                    <div key={x.label + i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-3 w-3 rounded-full border border-black/20"
                          style={{ backgroundColor: x.color }}
                        />
                        <div className="truncate text-xs font-extrabold text-black">{x.label}</div>
                      </div>
                      <div className="text-xs font-extrabold text-black whitespace-nowrap">
                        {moneyZar(x.value)}{" "}
                        <span className="text-[10px] font-bold text-black/50">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
              {rows.length > 8 ? (
                <div className="pt-2 text-[10px] font-bold text-black/50">Pie shows top 8 + Other.</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Leaderboard table */}
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <div className="text-xs font-extrabold text-black/60">Consultant leaderboard</div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
            <table className="w-full text-left">
              <thead className="bg-black/[0.02]">
                <tr className="text-[10px] font-extrabold text-black">
                  <th className="px-4 py-3">Consultant</th>
                  <th className="px-4 py-3">Deals</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="border-t border-black/10">
                    <td className="px-4 py-6 text-xs font-semibold text-black/60" colSpan={3}>
                      No deals yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.name} className="border-t border-black/10 hover:bg-black/[0.02]">
                      <td className="px-4 py-3 text-[12px] font-semibold text-black">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full border border-black/20"
                            style={{ backgroundColor: colorForKey(r.name) }}
                          />
                          <span className="truncate">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-extrabold text-black">{r.count}</td>
                      <td className="px-4 py-3 text-right text-[12px] font-extrabold text-black whitespace-nowrap">
                        {moneyZar(r.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-[10px] font-semibold text-black/50">
            Colors repeat (red/yellow/black/blue) but remain consistent per consultant.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeDashboard() {
  const { deals, loading, error, refreshAll } = useDeals();

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filteredDeals = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    if (!from && !to) return list;
    return list.filter((d: any) => inRange(dealDateKey(d), from, to));
  }, [deals, from, to]);

  const stageSummary = useMemo(() => {
    return STAGES.map((s) => {
      const list = filteredDeals.filter((d: any) => String(d?.stage || "").toLowerCase() === String(s));
      const total = list.reduce((sum: number, d: any) => sum + dealAmount(d), 0);
      return { stage: s, label: stageLabel(s), count: list.length, total };
    });
  }, [filteredDeals]);

  const consultantScores = useMemo(() => computeConsultantScores(filteredDeals), [filteredDeals]);

  const insuranceCount = useMemo(() => {
    return filteredDeals.filter((d: any) => isInsuranceOpted(d?.insurance_needed)).length;
  }, [filteredDeals]);

  const registrationTimingRows = useMemo(() => {
    const rows = computeRegistrationTimingByConsultant(filteredDeals);
    return rows.sort((a, b) => (a.avg - b.avg) || (b.count - a.count) || a.name.localeCompare(b.name));
  }, [filteredDeals]);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-7 py-10 md:px-12 lg:px-16">
        <div className="mb-10">
          <Image
            src="/capital-bonds-logo.svg"
            alt="Capital Bonds"
            width={2400}
            height={600}
            priority
            className="h-[360px] w-full object-contain"
          />
        </div>

        {/* Header + small date filter */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-3xl font-extrabold text-white">Dashboard</div>
            <div className="mt-2 text-sm text-white/80">Live view from Supabase</div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4">
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] font-extrabold text-black/60">Date filter (submitted)</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-black/60">
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="rounded-xl border border-black/10 px-2 py-1 text-[10px] font-extrabold text-black outline-none focus:border-black/30"
                  />
                </label>

                <label className="flex items-center gap-2 text-[10px] font-bold text-black/60">
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="rounded-xl border border-black/10 px-2 py-1 text-[10px] font-extrabold text-black outline-none focus:border-black/30"
                  />
                </label>

                <button
                  onClick={() => refreshAll?.()}
                  className="rounded-xl bg-black px-3 py-1.5 text-[10px] font-extrabold text-white hover:opacity-90"
                >
                  Refresh
                </button>

                <button
                  onClick={() => { setFrom(""); setTo(""); }}
                  className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[10px] font-extrabold text-black hover:bg-black/[0.03]"
                >
                  Clear
                </button>
              </div>

              <div className="mt-2 text-[10px] font-bold text-black/50">
                Showing{" "}
                <span className="font-extrabold text-black/70">{filteredDeals.length}</span>{" "}
                deal(s){from || to ? " in selected range" : ""}.
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-900">
            Deals API error: {error}
            <button
              onClick={() => refreshAll?.()}
              className="ml-3 rounded-xl bg-black px-3 py-1.5 text-[10px] font-extrabold text-white hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="mb-6 rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold text-black/60">
            Loading deals...
          </div>
        ) : null}

        {/* Stage cards (longer/wider so totals stay on one line) */}
        <div className="mb-10">
          <div className="mb-4 text-xs font-extrabold text-white">Deal Breakdown</div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
            {stageSummary.map((s) => (
              <div key={String(s.stage)} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <div className="text-xs font-extrabold text-black/60">{s.label}</div>
                    <div className="mt-2 text-3xl font-extrabold text-black">{s.count}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-black/60">Total</div>
                    <div className="mt-2 text-xl font-extrabold text-black whitespace-nowrap">
                      {moneyZar(s.total)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Avg Time to Registration (Days) per Consultant */}
        <div className="mt-8">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-sm font-extrabold text-black">Avg Time to Registration (Days) per Consultant</div>
            <div className="mt-1 text-xs font-semibold text-black/60">
              Completed deals only (stage = registrations).
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
              <table className="w-full text-left">
                <thead className="bg-black/[0.02]">
                  <tr className="text-[11px] font-extrabold text-black">
                    <th className="px-4 py-3">Consultant</th>
                    <th className="px-4 py-3">Avg Days</th>
                    <th className="px-4 py-3">Completed Deals</th>
                    <th className="px-4 py-3">Fastest</th>
                    <th className="px-4 py-3">Slowest</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationTimingRows.length === 0 ? (
                    <tr className="border-t border-black/10">
                      <td className="px-4 py-6 text-xs font-semibold text-black/60" colSpan={5}>
                        No registrations yet.
                      </td>
                    </tr>
                  ) : (
                    registrationTimingRows.map((r) => (
                      <tr key={r.name} className="border-t border-black/10 hover:bg-black/[0.02]">
                        <td className="px-4 py-3 text-[12px] font-semibold text-black">{r.name}</td>
                        <td className="px-4 py-3 text-[12px] font-extrabold text-black">{r.avg.toFixed(1)}</td>
                        <td className="px-4 py-3 text-[12px] font-extrabold text-black">{r.count}</td>
                        <td className="px-4 py-3 text-[12px] font-semibold text-black">{r.min.toFixed(1)}</td>
                        <td className="px-4 py-3 text-[12px] font-semibold text-black">{r.max.toFixed(1)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Consultants - Instructed */}
<ConsultantPipelinePerformance
  title="Instructed Value per Consultant"
  stage="instructed"
  deals={filteredDeals}
/>

{/* Consultants - Registrations */}
<div className="mt-8">
  <ConsultantPipelinePerformance
    title="Registrations Value per Consultant"
    stage="registrations"
    deals={filteredDeals}
  />
</div>

{/* Value per Consultant (All Stages) */}

{/* Consultant Performance Score (0�100) */}
<div className="mt-8">
  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-sm font-extrabold text-black">Consultant Performance Score (0�100)</div>
        <div className="mt-1 text-xs font-semibold text-black/60">
          Weighted by stage progress, value, and speed (NTU penalized).
        </div>
        <div className="mt-2 text-[11px] font-semibold text-black/60">
          DealScore = StagePoints � ln(value + 1) � (1 / (1 + ageDays/14))
        </div>
        <div className="mt-1 text-[11px] font-semibold text-black/50">
          Score = (ConsultantRawScore / MaxRawScore) � 100
        </div>
      </div>
    </div>

    <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
      <table className="w-full text-left">
        <thead className="bg-black/[0.02]">
          <tr className="text-[11px] font-extrabold text-black">
            <th className="px-4 py-3">Consultant</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Deals counted</th>
            <th className="px-4 py-3 text-right">Total deal value</th>
          </tr>
        </thead>
        <tbody>
          {consultantScores.length === 0 ? (
            <tr className="border-t border-black/10">
              <td className="px-4 py-6 text-xs font-semibold text-black/60" colSpan={4}>
                No deals yet.
              </td>
            </tr>
          ) : (
            consultantScores.map((r) => (
              <tr key={r.name} className="border-t border-black/10 hover:bg-black/[0.02]">
                <td className="px-4 py-3 text-[12px] font-semibold text-black">{r.name}</td>
                <td className="px-4 py-3 text-[12px] font-extrabold text-black">{Math.round(r.score)}</td>
                <td className="px-4 py-3 text-[12px] font-extrabold text-black">{r.deals}</td>
                <td className="px-4 py-3 text-right text-[12px] font-extrabold text-black whitespace-nowrap">
                  {moneyZar(r.totalValue)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
</div>

{/* Insurance opt-ins */}
<div className="mt-8">
  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
    <div className="text-xs font-extrabold text-black/60">Insurance Opt-ins</div>
    <div className="mt-2 text-3xl font-extrabold text-black">{insuranceCount}</div>
    <div className="mt-1 text-xs font-semibold text-black/60">Deals marked as insurance needed.</div>
  </div>
</div>

{/* Agent + Attorney tables at bottom */}
        <div className="mt-10 space-y-8">
          <AgentSummaryTable dealsOverride={filteredDeals} />
          <AttorneySummaryTable dealsOverride={filteredDeals} />
        </div>
      </div>
    </div>
  );
}
















