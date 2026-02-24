"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import MoveDealModal from "./MoveDealModal";

async function fetchDealSmart(target: string) {
  // 1) try direct
  let res = await fetch(`/api/deals/${encodeURIComponent(target)}`, { cache: "no-store" });

  let deal: any = null;

  if (res.ok) {
    const json = await res.json().catch(() => ({}));
    deal = json?.data ?? json;
  }

  // 2) list fallback (ALSO used to "merge banks" if deal object is missing them)
  const listRes = await fetch("/api/deals", { cache: "no-store" });
  const listJson = await listRes.json().catch(() => ({}));
  const arr = Array.isArray(listJson) ? listJson : Array.isArray(listJson?.data) ? listJson.data : [];

  const match =
    arr.find((d: any) => String(d?.deal_code ?? d?.dealCode ?? "").trim() === target) ||
    arr.find((d: any) => String(d?.id ?? "").trim() === target);

  if (!deal && match) {
    // if we didn't get a deal above, try fetching by the match id
    const idOrCode = String(match?.id ?? match?.deal_code ?? match?.dealCode ?? target).trim();
    const res2 = await fetch(`/api/deals/${encodeURIComponent(idOrCode)}`, { cache: "no-store" });
    if (!res2.ok) throw new Error(`Could not load deal by id (${res2.status}).`);
    const json2 = await res2.json().catch(() => ({}));
    deal = json2?.data ?? json2;
  }

  if (!deal && match) deal = match;

  if (!deal) throw new Error("Could not load deal data.");

  // If deal has no banks but list match has something bank-ish, merge it in.
  const dealBanks = Array.isArray(deal?.banks) ? deal.banks : null;
  const matchBanks = Array.isArray(match?.banks) ? match.banks : null;

  if ((!dealBanks || dealBanks.length === 0) && matchBanks && matchBanks.length > 0) {
    deal = { ...deal, banks: matchBanks };
  }

  // Also merge banks_source if present on match
  if (!deal?.banks_source && match?.banks_source) {
    deal = { ...deal, banks_source: match.banks_source };
  }
  if (!deal?.selected_banks && match?.selected_banks) {
    deal = { ...deal, selected_banks: match.selected_banks };
  }
  if (!deal?.bank_ids && match?.bank_ids) {
    deal = { ...deal, bank_ids: match.bank_ids };
  }

  return deal;
}

export default function DealMovePanel(props: { deal?: any }) {
  const params = useParams() as any;
  const sp = useSearchParams();

  const [open, setOpen] = useState(false);
  const [dealData, setDealData] = useState<any>(props.deal ?? null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const target = useMemo(() => {
    const fromProps = String(props?.deal?.id ?? props?.deal?.deal_code ?? props?.deal?.dealCode ?? "").trim();
    const fromParams = String(params?.code ?? params?.id ?? params?.deal ?? "").trim();
    const fromQuery = String(sp?.get("code") ?? sp?.get("id") ?? "").trim();
    return fromProps || fromParams || fromQuery;
  }, [params, sp, props?.deal]);

  useEffect(() => {
    if (!open) return;
    if (!target) {
      setLoadErr("Could not detect deal id/code from the URL or props.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadErr(null);
        const d = await fetchDealSmart(target);
        if (!cancelled) setDealData(d);
      } catch (e: any) {
        if (!cancelled) setLoadErr(e?.message || "Failed to load deal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, target]);

  const dealForModal = useMemo(() => {
    const d = dealData ?? props.deal ?? null;
    if (d) return d;
    return { id: target || null, deal_code: target || null, stage: "submitted", banks: [] };
  }, [dealData, props.deal, target]);

  return (
    <div className="mb-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-black">Move this deal (V2 modal)</div>
          <div className="text-xs font-semibold text-black/60">
            Deal ref: <span className="font-extrabold text-black">{target || "(unknown)"}</span>
          </div>
          {loading && <div className="mt-1 text-xs font-semibold text-black/50">Loading deal...</div>}
          {loadErr && <div className="mt-1 text-xs font-semibold text-red-600">{loadErr}</div>}
        </div>

        <button
          onClick={() => setOpen(true)}
          className="rounded-2xl bg-black px-4 py-2 text-sm font-extrabold text-white shadow-sm"
        >
          Move
        </button>
      </div>

      <MoveDealModal open={open} onClose={() => setOpen(false)} deal={dealForModal} />
    </div>
  );
}