"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AnyDeal = any;

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normStage(v: any) {
  return String(v || "").toLowerCase().trim();
}

function normalizeDeal(d: AnyDeal) {
  const amount = toNumber(d?.amount_zar ?? d?.amountZar ?? d?.amount ?? 0);
  const stage = normStage(d?.stage);

  const agentName = d?.agent_name ?? d?.agentName ?? null;

  const banks = Array.isArray(d?.banks)
    ? d.banks.map((b: any) => ({
        ...b,
        bank_name: b?.bank_name ?? b?.bankName ?? null,
        bankName: b?.bankName ?? b?.bank_name ?? null,
        amount_zar: toNumber(b?.amount_zar ?? b?.amountZar ?? 0),
        amountZar: toNumber(b?.amountZar ?? b?.amount_zar ?? 0),
      }))
    : [];

  return {
    ...d,
    stage,
    amount_zar: amount,
    amountZar: amount,

    agent_name: agentName,
    agentName: agentName,

    banks,
  };
}

export function useDeals() {
  const [deals, setDeals] = useState<AnyDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  const refreshAll = useCallback(async () => {
    controllerRef.current?.abort();
    const ac = new AbortController();
    controllerRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/deals", { cache: "no-store", signal: ac.signal });
      const json = await res.json();

      const arr = Array.isArray(json)
        ? json
        : Array.isArray(json?.deals)
        ? json.deals
        : [];

      const normalized = arr.map(normalizeDeal);
      setDeals(normalized);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
    return () => controllerRef.current?.abort();
  }, [refreshAll]);

  return {
    deals,
    loading,
    isLoading: loading,  // keep compatibility
    error,
    refreshAll,
  };
}