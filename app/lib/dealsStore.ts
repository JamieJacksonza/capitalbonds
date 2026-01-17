const __USE_QUERY_STAGE = false;
function stageToRoute(stage: any) {
  let s = String(stage ?? "").trim().toLowerCase();
  if (!s) s = "submitted";
  if (s === "arp") s = "aip";
  if (s === "registration" || s === "regs" || s === "reg") s = "registrations";
  if (s === "instructions" || s === "instruct") s = "instructed";
  if (s === "grant" || s === "approved") s = "granted";
  return __USE_QUERY_STAGE ? ("/?stage=" + encodeURIComponent(s)) : ("/" + s);
}
// move_nav_helper_v1
// move_nav_helper_v1
"use client";




// after_move_refresh_v1
function __afterMoveRefresh() {
  try {
    if (typeof window !== "undefined") {
      setTimeout(() => window.location.reload(), 50);
    }
  } catch {}
}
export type Deal = {
  id: string;
  applicant?: string;
  amount?: number;
  bank?: string;
  consultant?: string;
  stage?: string; // submitted | aip | instructed | granted | ntu
  submitted?: string; // YYYY-MM-DD
  status?: string;
  notes?: string;
  grantedAt?: string; // YYYY-MM-DD
};

export type Move = {
  id?: string;
  dealId?: string;
  fromStage?: string;
  toStage?: string;
  movedAt?: string;
  movedBy?: string;
  note?: string;
};

type Meta = { loading: boolean; error: string | null };

type State = {
  deals: Deal[];
  moves: Move[];
  loading: boolean;
  error: string | null;
};

const EMPTY_DEALS: Deal[] = [];
const EMPTY_MOVES: Move[] = [];

//  MUST be stable/cached references for SSR snapshots
const META_SERVER: Meta = { loading: true, error: null };

let state: State = {
  deals: EMPTY_DEALS,
  moves: EMPTY_MOVES,
  loading: true,
  error: null,
};

//  Keep a single object reference for meta that only changes when we reassign it
let metaSnapshot: Meta = { loading: state.loading, error: state.error };

const listeners = new Set<() => void>();

function notify() {
  // Update meta snapshot reference BEFORE notifying
  metaSnapshot = { loading: state.loading, error: state.error };
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDealsSnapshot() {
  return state.deals;
}
export function getMovesSnapshot() {
  return state.moves;
}
export function getMetaSnapshot() {
  return metaSnapshot;
}

//  cached server snapshots
export function getDealsServerSnapshot() {
  return EMPTY_DEALS;
}
export function getMovesServerSnapshot() {
  return EMPTY_MOVES;
}
export function getMetaServerSnapshot() {
  return META_SERVER;
}

export async function refreshAll() {
  try {
    state = { ...state, loading: true, error: null };
    notify();

    const [dRes, mRes] = await Promise.all([fetch("/api/deals", { cache: "no-store" }), fetch("/api/moves", { cache: "no-store" })]);
    const d = await dRes.json().catch(() => ({}));
    const m = await mRes.json().catch(() => ({}));

    if (!dRes.ok || !d.ok) throw new Error(d?.error || "Failed to load deals");
    if (!mRes.ok || !m.ok) throw new Error(m?.error || "Failed to load moves");

    state = {
      deals: Array.isArray(d.deals) ? d.deals : EMPTY_DEALS,
      moves: Array.isArray(m.moves) ? m.moves : EMPTY_MOVES,
      loading: false,
      error: null,
    };

    notify();
  } catch (e: any) {
    state = { ...state, loading: false, error: e?.message || "Load failed" };
    notify();
  }
}

export async function createDeal(payload: any) {
  const res = await fetch("/api/deals", { cache: "no-store", 
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
      // move_redirect_force_v3
      if (typeof window !== "undefined" && res.ok) {
        const __dest =
          (typeof payload !== "undefined" ? (payload?.to_stage ?? payload?.toStage ?? payload?.stage ?? null) : null) ??
          (typeof body !== "undefined" ? (body?.to_stage ?? body?.toStage ?? body?.stage ?? null) : null) ??
          (typeof toStage !== "undefined" ? toStage : null) ??
          (typeof nextStage !== "undefined" ? nextStage : null) ??
          (typeof targetStage !== "undefined" ? targetStage : null) ??
          (typeof moveToStage !== "undefined" ? moveToStage : null) ??
          null;

        if (__dest) {
          setTimeout(() => window.location.assign(stageToRoute(__dest)), 10);
        }
      }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data?.error || "Create failed");
  await refreshAll();
}

export async function moveDealToStage(dealId: string, nextStage: string, meta?: { note?: string }) {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, { cache: "no-store", 
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nextStage, note: meta?.note || "" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data?.error || "Move failed");
  await refreshAll();
}
