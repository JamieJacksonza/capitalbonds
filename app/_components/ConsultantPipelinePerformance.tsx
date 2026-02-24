"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type AnyDeal = Record<string, any>;
type StageKey = "submitted" | "aip" | "instructed" | "granted" | "registrations" | "ntu";

const CONSULTANT_PALETTE = [
  "#e41a1c", // red
  "#377eb8", // blue
  "#4daf4a", // green
  "#984ea3", // purple
  "#ff7f00", // orange
  "#ffff33", // yellow
  "#a65628", // brown
  "#f781bf", // pink
  "#999999", // grey
  "#00bcd4", // cyan
  "#000000", // black
  "#1b9e77", // teal
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

function moneyZar(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(v);
}

function normStage(s: any): StageKey | "" {
  const v = String(s ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "arp" || v === "iap") return "aip";
  if (v === "grant" || v === "approved") return "granted";
  if (v === "instructions" || v === "instruct") return "instructed";
  if (v === "registration" || v === "regs" || v === "reg") return "registrations";
  if (v === "submitted" || v === "aip" || v === "instructed" || v === "granted" || v === "registrations" || v === "ntu") return v as StageKey;
  return "" as any;
}

function dealConsultant(d: AnyDeal) {
  return (
    d?.consultant ??
    d?.consultant_name ??
    d?.consultantName ??
    d?.agent ??
    d?.agent_name ??
    d?.agentName ??
    d?.assigned_to ??
    d?.owner ??
    d?.created_by ??
    "Unknown"
  );
}

function dealAmount(d: AnyDeal) {
  const raw =
    d?.amount_zar ??
    d?.amountZar ??
    d?.value ??
    d?.amount ??
    d?.deal_value ??
    d?.deal_amount ??
    d?.loan_amount ??
    d?.bond_amount ??
    d?.purchase_price ??
    0;

  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function dealDateKey(d: AnyDeal): Date | null {
  const sd = String(d?.submitted_date ?? d?.submittedDate ?? d?.submitted ?? "").trim();
  if (sd) return new Date(`${sd}T12:00:00`);
  const ca = String(d?.created_at ?? d?.createdAt ?? "").trim();
  if (ca) return new Date(ca);
  return null;
}

function inRange(dt: Date | null, from?: string, to?: string) {
  if (!dt) return true;
  const fromDt = from ? new Date(`${from}T00:00:00`) : null;
  const toDt = to ? new Date(`${to}T23:59:59`) : null;
  if (fromDt && dt < fromDt) return false;
  if (toDt && dt > toDt) return false;
  return true;
}

export default function ConsultantPipelinePerformance({
  deals,
  stage,
  title,
  from,
  to,
}: {
  deals: AnyDeal[];
  stage?: StageKey;
  title?: string;
  from?: string;
  to?: string;
}) {
  const model = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];

    const allNames = Array.from(
      new Set(list.map((d) => String(dealConsultant(d) ?? "Unknown").trim() || "Unknown"))
    ).sort((a, b) => a.localeCompare(b));

    const colorMap = new Map<string, string>();
    allNames.forEach((n, i) => colorMap.set(n, CONSULTANT_PALETTE[i % CONSULTANT_PALETTE.length]));

    const dateFiltered =
      from || to ? list.filter((d) => inRange(dealDateKey(d), from, to)) : list;

    const filtered = stage
      ? dateFiltered.filter((d) => normStage(d?.stage) === stage)
      : dateFiltered;

    const map = new Map<string, { name: string; deals: number; total: number }>();

    for (const d of filtered) {
      const name = String(dealConsultant(d) ?? "Unknown").trim() || "Unknown";
      const amt = dealAmount(d);
      const cur = map.get(name) || { name, deals: 0, total: 0 };
      cur.deals += 1;
      cur.total += amt;
      map.set(name, cur);
    }

    const rows = Array.from(map.values()).sort((a, b) => (b.total - a.total) || (b.deals - a.deals) || a.name.localeCompare(b.name));
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    const top = rows.slice(0, 8);
    const rest = rows.slice(8);
    const otherValue = rest.reduce((s, r) => s + r.total, 0);

    const pieBase = top.map((r) => ({
      name: r.name,
      value: r.total,
      deals: r.deals,
      fill: colorForConsultant(r.name),
      pct: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
    }));

    const pie =
      rest.length > 0
        ? [
            ...pieBase,
            {
              name: "Other",
              value: otherValue,
              deals: rest.reduce((s, r) => s + r.deals, 0),
              fill: "#9ca3af",
              pct: grandTotal > 0 ? (otherValue / grandTotal) * 100 : 0,
            },
          ]
        : pieBase;

    return {
      filteredCount: filtered.length,
      grandTotal,
      rows,
      pie,
    };
  }, [deals, stage, from, to]);

  const headerTitle =
    title ||
    (stage === "granted"
      ? "Granted Value per Consultant"
      : stage === "registrations"
      ? "Registrations Value per Consultant"
      : stage
      ? "Value per Consultant"
      : "Value per Consultant (All Statuses)");

  return (
    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="text-base font-extrabold text-black">{headerTitle}</div>
        <div className="text-[11px] font-extrabold text-black/55">
          {model.filteredCount} deal(s) Total{" "}
          <span className="text-black">R {moneyZar(model.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-xs font-extrabold text-black/60">Pie</div>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-[200px] min-w-0">
              <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={model.pie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={1}
                    isAnimationActive={false}
                  >
                    {model.pie.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-extrabold text-black/45">Legend</div>

              {model.pie.length === 0 ? (
                <div className="text-xs font-semibold text-black/40">No deals in this status.</div>
              ) : (
                model.pie.map((r) => (
                  <div key={r.name} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: r.fill }} />
                      <div className="min-w-0 truncate text-xs font-extrabold text-black">{r.name}</div>
                    </div>

                    <div className="shrink-0 text-[10px] font-extrabold text-black/70">
                      R {moneyZar(r.value)} <span className="text-black/45">({Math.round(r.pct)}%)</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-xs font-extrabold text-black/60">Consultant leaderboard</div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-black/10">
            <div className="grid grid-cols-12 bg-black/[0.02] px-3 py-2 text-[10px] font-extrabold text-black/60">
              <div className="col-span-7">Consultant</div>
              <div className="col-span-2 text-right">Deals</div>
              <div className="col-span-3 text-right">Total</div>
            </div>

            {model.rows.length === 0 ? (
              <div className="px-3 py-3 text-xs font-semibold text-black/40">No deals in this status.</div>
            ) : (
              model.rows.map((r) => (
                <div
                  key={r.name}
                  className="grid grid-cols-12 items-center px-3 py-1.5 text-[11px] font-semibold text-black border-t border-black/10"
                >
                  <div className="col-span-7 flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: colorForConsultant(r.name) }} />
                    <div className="min-w-0 truncate font-extrabold">{r.name}</div>
                  </div>
                  <div className="col-span-2 text-right font-extrabold">{r.deals}</div>
                  <div className="col-span-3 text-right font-extrabold">R {moneyZar(r.total)}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 text-[10px] font-semibold text-black/35">
            Colours are consistent per consultant across sections.
          </div>
        </div>
      </div>
    </div>
  );
}








