"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Deal = any;

function toAmount(d: any): number {
  const raw = d?.amount_zar ?? d?.amountZar ?? d?.amount ?? 0;
  const n = typeof raw === "string" ? Number(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function agentName(d: any): string {
  return String(d?.agent_name ?? d?.agentName ?? d?.agent ?? "Unassigned").trim() || "Unassigned";
}

function moneyZar(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

// High contrast / distinctive palette
const COLORS = [
  "#DC2626", // red
  "#F59E0B", // yellow/amber
  "#111827", // black (near-black)
  "#2563EB", // blue
];

export default function AgentPie() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch("/api/deals", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || `Failed to load deals (${res.status})`);
        if (alive) setDeals(Array.isArray(data.deals) ? data.deals : []);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed to load deals");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // "Business brought in" = Granted totals (clean + real)
  const granted = useMemo(
    () => (deals || []).filter((d) => String(d?.stage || "").toLowerCase() === "granted"),
    [deals]
  );

  const rows = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of granted) {
      const a = agentName(d);
      map.set(a, (map.get(a) || 0) + toAmount(d));
    }
    const list = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    list.sort((a, b) => (b.value || 0) - (a.value || 0));
    return list;
  }, [granted]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.value) || 0), 0), [rows]);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-black">Agent leaderboard</div>
          <div className="mt-1 text-xs font-bold text-black/60">
            Granted total by agent (share of total granted business)
          </div>
        </div>
        <div className="text-xs font-extrabold text-black">
          Total: <span className="text-black/70">{moneyZar(total)}</span>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 text-sm font-semibold text-black/70">Loading...</div>
      ) : err ? (
        <div className="mt-5 text-sm font-semibold text-red-600">{err}</div>
      ) : rows.length === 0 ? (
        <div className="mt-5 text-sm font-semibold text-black/70">No granted deals yet.</div>
      ) : (
        <div className="mt-5">
          <div className="min-w-0">
            <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0}>
              <PieChart>
                <Tooltip
                  formatter={(v: any) => moneyZar(Number(v || 0))}
                  labelFormatter={(l: any) => String(l)}
                />
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {rows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend UNDER the chart */}
          <div className="mt-4 space-y-2">
            {rows.map((r, i) => {
              const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
              return (
                <div key={r.name} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <div className="text-sm font-extrabold text-black">{r.name}</div>
                    <div className="text-xs font-bold text-black/50">{pct}%</div>
                  </div>
                  <div className="text-sm font-extrabold text-black">{moneyZar(r.value)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

