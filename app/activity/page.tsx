"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AnyRec = Record<string, any>;

type ActivityRow = {
  id: string;
  deal_id: string;
  deal_code: string;
  moved_by: string;
  from_stage: string | null;
  to_stage: string | null;
  moved_at: string | null;
  note?: string | null;
};

function asArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function prettyStage(s?: string | null) {
  if (!s) return "";
  const map: Record<string, string> = {
    submitted: "Submitted",
    aip: "AIP",
    instructed: "Instructed",
    granted: "Granted",
    ntu: "NTU",
    registrations: "Registrations",
  };
  return map[s] || s;
}

function pickMovedBy(v: any) {
  const s = String(v ?? "").trim();
  return s || "System";
}

function pickTimestamp(v: any) {
  if (!v) return null;
  const s = String(v);
  return s ? s : null;
}

export default function ActivityPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/deals", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load deals");

      const deals = Array.isArray(json?.deals) ? json.deals : [];
      const out: ActivityRow[] = [];
      const seen = new Set<string>();
      const recentByKey = new Map<string, number>();

      for (const d of deals) {
        const dealId = String(d?.id || "").trim();
        const dealCode = String(d?.deal_code || d?.dealCode || d?.reference || dealId || "").trim();
        const history = asArray(d?.move_history ?? d?.moveHistory);

        for (let i = 0; i < history.length; i++) {
          const m = history[i] || {};
          const at = pickTimestamp(m.at ?? m.date ?? m.created_at ?? m.ts ?? m.moved_at);
          const by = pickMovedBy(m.by ?? m.movedBy ?? m.user ?? m.name ?? d?.last_moved_by ?? d?.lastMovedBy);
          const from = String(m.from ?? m.fromStage ?? m.prev ?? m.previous ?? "").trim() || null;
          const to = String(m.to ?? m.toStage ?? m.next ?? m.stage ?? "").trim() || null;
          const note = m.note ?? m.notes ?? null;

          if (!dealId) continue;
          const bucketKey = [
            dealId,
            String(by || "").toLowerCase(),
            String(from || "").toLowerCase(),
            String(to || "").toLowerCase(),
          ].join("|");
          const timeMs = at ? new Date(at).getTime() : 0;
          const lastMs = recentByKey.get(bucketKey);
          if (lastMs && timeMs && Math.abs(timeMs - lastMs) <= 5000) {
            continue;
          }
          recentByKey.set(bucketKey, timeMs);
          const key = `${bucketKey}|${at || "na"}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            id: key,
            deal_id: dealId,
            deal_code: dealCode || dealId,
            moved_by: by,
            from_stage: from,
            to_stage: to,
            moved_at: at,
            note,
          });
        }
      }

      const query = q.trim().toLowerCase();
      const filtered = query
        ? out.filter((r) => {
            const hay = [r.deal_code, r.moved_by, r.from_stage, r.to_stage]
              .map((x) => String(x || "").toLowerCase())
              .join(" ");
            return hay.includes(query);
          })
        : out;

      filtered.sort((a, b) => {
        const atA = a.moved_at ? new Date(a.moved_at).getTime() : 0;
        const atB = b.moved_at ? new Date(b.moved_at).getTime() : 0;
        return atB - atA;
      });

      setRows(filtered);
    } catch (e: any) {
      setErr(e?.message || "Failed to load activity");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-black">Activity</h1>
          <p className="mt-1 text-sm text-black/60">Recent moves pulled directly from each deal.</p>
        </div>

        <div className="flex w-full max-w-xl items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: deal code or consultant name"
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black shadow-sm outline-none focus:ring-2 focus:ring-black/10"
          />
          <button
            onClick={load}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-extrabold text-white shadow-sm"
          >
            Search
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-black/10 px-4 py-3 text-xs font-extrabold text-black/60">
          <div className="col-span-2">Time</div>
          <div className="col-span-2">Deal</div>
          <div className="col-span-3">Moved By</div>
          <div className="col-span-5">Status</div>
        </div>

        {loading && <div className="px-4 py-6 text-sm font-semibold text-black/60">Loading...</div>}
        {err && <div className="px-4 py-6 text-sm font-semibold text-red-600">{err}</div>}
        {empty && <div className="px-4 py-6 text-sm font-semibold text-black/60">No activity found.</div>}

        {!loading && !err && rows.map((r) => (
          <a
            key={r.id}
            href={`/deal/${encodeURIComponent(r.deal_id)}`}
            className="grid grid-cols-12 gap-2 px-4 py-3 text-sm text-black hover:bg-black/[0.03]"
          >
            <div className="col-span-2 font-semibold text-black/70">
              {r.moved_at ? new Date(r.moved_at).toLocaleString("en-ZA") : "-"}
            </div>
            <div className="col-span-2 font-extrabold">{r.deal_code}</div>
            <div className="col-span-3 font-bold">{r.moved_by}</div>
            <div className="col-span-5 font-extrabold">
              {prettyStage(r.from_stage) && prettyStage(r.to_stage)
                ? `${prettyStage(r.from_stage)} → ${prettyStage(r.to_stage)}`
                : prettyStage(r.to_stage || r.from_stage)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
