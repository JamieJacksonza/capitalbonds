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

const COLORS = [
  "#142037",
  "#2D4A7C",
  "#5B7BB2",
  "#9FB4D4",
  "#C9D7EA",
];

function ExecutiveTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#142037]/55">{row?.name}</div>
      <div className="mt-1 text-sm font-bold text-[#142037]">{moneyZar(Number(row?.value || 0))}</div>
    </div>
  );
}

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
          <div className="min-w-0 rounded-[28px] border border-slate-200/80 bg-slate-50/70 p-4">
            <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0}>
              <PieChart>
                <Tooltip content={<ExecutiveTooltip />} />
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={96}
                  paddingAngle={3}
                  stroke="#ffffff"
                  strokeWidth={4}
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
                <div key={r.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full ring-4 ring-white" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <div className="text-sm font-bold text-[#142037]">{r.name}</div>
                    <div className="text-xs font-semibold text-slate-500">{pct}%</div>
                  </div>
                  <div className="text-sm font-bold text-[#142037]">{moneyZar(r.value)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
