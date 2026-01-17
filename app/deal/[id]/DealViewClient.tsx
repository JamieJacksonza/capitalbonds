"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// keep this if the file exists in your project
import StatusBankNotesCard from "./StatusBankNotesCard";

type Props = { dealKey: string };
type Deal = Record<string, any>;

function fmtMoneyZar(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return "-";
  try {
    return n.toLocaleString("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });
  } catch {
    return "R " + n.toFixed(0);
  }
}

function prettyKey(k: string) {
  return k
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeVal(v: any) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && v.trim() === "") return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function normalizeInsurance(v: any) {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "yes" || s === "1") return true;
    if (s === "false" || s === "no" || s === "0") return false;
  }
  if (typeof v === "number") return v === 1;
  return false;
}

function hasValue(v: any) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;
  if (s === "-") return false;
  if (s.toLowerCase() === "null") return false;
  if (s.toLowerCase() === "undefined") return false;
  return true;
}
export default function DealViewClient({ dealKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [insuranceNeeded, setInsuranceNeeded] = useState(false);
  const [insuranceSaving, setInsuranceSaving] = useState(false);
  const [insuranceErr, setInsuranceErr] = useState<string | null>(null);
  const [attorney, setAttorney] = useState("");
  const [attorneySaving, setAttorneySaving] = useState(false);
  const [attorneyErr, setAttorneyErr] = useState<string | null>(null);
  const [ntuReason, setNtuReason] = useState("");
  const [ntuSaving, setNtuSaving] = useState(false);
  const [ntuErr, setNtuErr] = useState<string | null>(null);
  const [registrationPaid, setRegistrationPaid] = useState(false);
  const [registrationPaidAt, setRegistrationPaidAt] = useState<string | null>(null);
  const [registrationPaidSaving, setRegistrationPaidSaving] = useState(false);
  const [registrationPaidErr, setRegistrationPaidErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (!res.ok || json?.ok === false) throw new Error(json?.error || `Failed to load deal (${res.status})`);

        // Normalize possible API shapes
        let d: any = json;
        if (d && d.ok === true && d.deal) d = d.deal;
        if (d && d.ok === true && d.data) d = d.data;
        if (d && d.deal) d = d.deal;

        if (alive) setDeal(d ?? null);
      } catch (e: any) {
        if (alive) {
          setDeal(null);
          setErr(e?.message || "Failed to load deal");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (dealKey) run();
    return () => {
      alive = false;
    };
  }, [dealKey]);

  useEffect(() => {
    if (!deal) return;
    setInsuranceNeeded(normalizeInsurance((deal as any)?.insurance_needed));
    setAttorney(String((deal as any)?.attorney ?? "").trim());
    setNtuReason(String((deal as any)?.ntu_reason ?? (deal as any)?.ntuReason ?? "").trim());
    const paid = (deal as any)?.registration_paid ?? (deal as any)?.registrationPaid;
    setRegistrationPaid(paid === true);
    const paidAt = (deal as any)?.registration_paid_at ?? (deal as any)?.registrationPaidAt;
    setRegistrationPaidAt(paidAt ? String(paidAt) : null);
  }, [deal]);

  const summary = useMemo(() => {
    const d = deal || {};
    return [
      { label: "Deal Deck ID", value: d.deal_deck_id ?? d.code  },
      { label: "Applicant", value: d.applicant  },
      { label: "Amount", value: d.amount_zar != null ? fmtMoneyZar(d.amount_zar) : (d.amount != null ? fmtMoneyZar(d.amount) : "-") },
      { label: "Consultant", value: d.consultant  },
      { label: "Agent", value: d.agent_name ?? d.agent  },
      { label: "Attorney", value: d.attorney  },
      { label: "NTU Reason", value: d.ntu_reason ?? d.ntuReason },
      { label: "Stage", value: d.stage  },
      { label: "Submitted Date", value: d.submitted_date  },
      { label: "Property Address", value: d.property_address  },
      ...((d.insurance_needed === true || String(d.insurance_needed ?? "").trim().toLowerCase() === "yes" || String(d.insurance_needed ?? "").trim() === "1") ? [{ label: "Insurance Needed", value: d.insurance_needed }] : []),
      { label: "Registration Ref", value: d.registration_attorney_reference ?? d.registration_reference  },
      { label: "Registration No.", value: d.registration_number  },
      { label: "Payment Due Date", value: d.payment_due_date  },
      { label: "Agent Comm Paid", value: d.agent_comm_paid  },
    ];
  }, [deal]);

  const moves = useMemo(() => {
    const d = deal || {};
    const mh = Array.isArray(d.move_history) ? d.move_history : [];
    const uniq: any[] = [];
    const seen = new Set<string>();
    const sorted = mh.slice().reverse();
    for (const m of sorted) {
      const key = [
        String(m?.from ?? "").trim().toLowerCase(),
        String(m?.to ?? "").trim().toLowerCase(),
        String(m?.by ?? "").trim().toLowerCase(),
        String(m?.note ?? "").trim().toLowerCase(),
      ].join("|");
      if (!key.replace(/\|/g, "")) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(m);
      if (uniq.length >= 12) break;
    }
    return uniq;
  }, [deal]);

  const showInsuranceToggle =
    searchParams.get("from") === "registrations" ||
    String((deal as any)?.stage || "").toLowerCase() === "registrations";

  const showAttorneyInput =
    searchParams.get("from") === "instructed" ||
    String((deal as any)?.stage || "").toLowerCase() === "instructed";

  const showNtuInput =
    searchParams.get("from") === "ntu" ||
    String((deal as any)?.stage || "").toLowerCase() === "ntu";

  const showRegistrationPaid =
    searchParams.get("from") === "registrations" ||
    String((deal as any)?.stage || "").toLowerCase() === "registrations";

  async function saveInsurance(next: boolean, prev: boolean) {
    if (!dealKey) return;
    setInsuranceSaving(true);
    setInsuranceErr(null);

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ insurance_needed: next }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed to update insurance (${res.status})`);
      }

      setDeal((prev) => (prev ? { ...prev, insurance_needed: next } : prev));
    } catch (e: any) {
      setInsuranceErr(e?.message || "Failed to update insurance");
      setInsuranceNeeded(prev);
    } finally {
      setInsuranceSaving(false);
    }
  }

  async function saveAttorney(next: string, prev: string) {
    if (!dealKey) return;
    setAttorneySaving(true);
    setAttorneyErr(null);

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attorney: next }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed to update attorney (${res.status})`);
      }

      setDeal((prevDeal) => (prevDeal ? { ...prevDeal, attorney: next } : prevDeal));
    } catch (e: any) {
      setAttorneyErr(e?.message || "Failed to update attorney");
      setAttorney(prev);
    } finally {
      setAttorneySaving(false);
    }
  }

  async function saveNtuReason(next: string, prev: string) {
    if (!dealKey) return;
    setNtuSaving(true);
    setNtuErr(null);

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ntu_reason: next }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed to update NTU reason (${res.status})`);
      }

      setDeal((prevDeal) => (prevDeal ? { ...prevDeal, ntu_reason: next } : prevDeal));
    } catch (e: any) {
      setNtuErr(e?.message || "Failed to update NTU reason");
      setNtuReason(prev);
    } finally {
      setNtuSaving(false);
    }
  }

  async function saveRegistrationPaid(next: boolean, prevPaid: boolean, prevAt: string | null) {
    if (!dealKey) return;
    setRegistrationPaidSaving(true);
    setRegistrationPaidErr(null);

    const paidAt = next ? new Date().toISOString() : null;

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registration_paid: next, registration_paid_at: paidAt }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed to update payment (${res.status})`);
      }

      setDeal((prevDeal) =>
        prevDeal
          ? {
              ...prevDeal,
              registration_paid: next,
              registration_paid_at: paidAt,
            }
          : prevDeal
      );
      setRegistrationPaidAt(paidAt);
    } catch (e: any) {
      setRegistrationPaidErr(e?.message || "Failed to update payment");
      setRegistrationPaid(prevPaid);
      setRegistrationPaidAt(prevAt);
    } finally {
      setRegistrationPaidSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold text-black">Deal View</div>
          <div className="text-sm font-semibold text-black/60">Key: {dealKey}</div>
        </div>

        <div className="flex items-center gap-2">
          {showRegistrationPaid ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-extrabold text-black shadow-sm"
            >
              Export PDF
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-extrabold text-black shadow-sm"
          >
            Back
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4 text-sm font-bold text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-black">Deal Summary</div>
          <div className="text-xs font-extrabold text-black/50">{loading ? "Loading..." : (deal ? "Loaded" : "No deal")}</div>
        </div>

        {showAttorneyInput ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold text-black/45">Attorney</div>
                <div className="text-sm font-semibold text-black/70">Captured in Instructed and carried forward.</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={attorney}
                  onChange={(e) => setAttorney(e.target.value)}
                  placeholder="Attorney name"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
                <button
                  type="button"
                  onClick={() => saveAttorney(attorney.trim(), String((deal as any)?.attorney ?? "").trim())}
                  disabled={attorneySaving}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black hover:border-black/20 disabled:opacity-60"
                >
                  {attorneySaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            {attorneyErr ? (
              <div className="mt-2 text-xs font-semibold text-red-600">{attorneyErr}</div>
            ) : null}
          </div>
        ) : null}

        {showNtuInput ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold text-black/45">NTU Reason</div>
                <div className="text-sm font-semibold text-black/70">Captured in NTU and carried forward.</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={ntuReason}
                  onChange={(e) => setNtuReason(e.target.value)}
                  placeholder="Reason for NTU"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
                <button
                  type="button"
                  onClick={() => saveNtuReason(ntuReason.trim(), String((deal as any)?.ntu_reason ?? (deal as any)?.ntuReason ?? "").trim())}
                  disabled={ntuSaving}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black hover:border-black/20 disabled:opacity-60"
                >
                  {ntuSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            {ntuErr ? (
              <div className="mt-2 text-xs font-semibold text-red-600">{ntuErr}</div>
            ) : null}
          </div>
        ) : null}

        {showRegistrationPaid ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold text-black/45">Registration Paid</div>
                <div className="text-sm font-semibold text-black/70">Toggle on when payment is received.</div>
                {registrationPaidAt ? (
                  <div className="mt-1 text-xs font-semibold text-black/50">
                    Paid on {new Date(registrationPaidAt).toLocaleString("en-ZA")}
                  </div>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm font-extrabold text-black">
                <input
                  type="checkbox"
                  checked={registrationPaid}
                  disabled={registrationPaidSaving}
                  onChange={(e) => {
                    const next = e.target.checked;
                    const prevPaid = registrationPaid;
                    const prevAt = registrationPaidAt;
                    setRegistrationPaid(next);
                    saveRegistrationPaid(next, prevPaid, prevAt);
                  }}
                />
                {registrationPaid ? "Paid" : "Not paid"}
              </label>
            </div>
            {registrationPaidErr ? (
              <div className="mt-2 text-xs font-semibold text-red-600">{registrationPaidErr}</div>
            ) : null}
          </div>
        ) : null}

        {showRegistrationPaid && registrationPaid ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="text-[11px] font-extrabold text-black/45">Payment Status</div>
            <div className="mt-1 text-sm font-extrabold text-black">Deal Paid</div>
            <div className="mt-1 text-xs font-semibold text-black/60">
              {registrationPaidAt
                ? `Paid on ${new Date(registrationPaidAt).toLocaleString("en-ZA")}`
                : "Payment date not recorded yet."}
            </div>
          </div>
        ) : null}

        {showInsuranceToggle ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold text-black/45">Insurance Needed</div>
                <div className="text-sm font-semibold text-black/70">Toggle on if the client requests insurance.</div>
              </div>
              <label className="flex items-center gap-2 text-sm font-extrabold text-black">
                <input
                  type="checkbox"
                  checked={insuranceNeeded}
                  disabled={insuranceSaving}
                  onChange={(e) => {
                    const next = e.target.checked;
                    const prev = insuranceNeeded;
                    setInsuranceNeeded(next);
                    saveInsurance(next, prev);
                  }}
                />
                {insuranceNeeded ? "On" : "Off"}
              </label>
            </div>
            {insuranceErr ? (
              <div className="mt-2 text-xs font-semibold text-red-600">{insuranceErr}</div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {summary.filter((s:any)=>hasValue((s as any).value)).map((it) => (
            <div key={it.label} className="rounded-xl border border-black/10 bg-white p-4">
              <div className="text-[11px] font-extrabold text-black/45">{it.label}</div>
              <div className="text-sm font-extrabold text-black">{safeVal(it.value)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {/* pass both props as any so StatusBankNotesCard can accept whichever it wants */}
        <StatusBankNotesCard
          dealKey={dealKey}
          amountZar={Number((deal as any)?.amount_zar ?? (deal as any)?.amount ?? 0) || undefined}
          stage={((deal as any)?.stage ?? undefined) as any}
          hideEmptyNotes={
            searchParams.get("from") === "registrations" ||
            String((deal as any)?.stage || "").toLowerCase() === "registrations"
          }
/>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="text-sm font-extrabold text-black">Recent Moves</div>

        {moves.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10">
                  <th className="py-2 pr-3 font-extrabold text-black/60">At</th>
                  <th className="py-2 pr-3 font-extrabold text-black/60">From</th>
                  <th className="py-2 pr-3 font-extrabold text-black/60">To</th>
                  <th className="py-2 pr-3 font-extrabold text-black/60">By</th>
                  <th className="py-2 pr-3 font-extrabold text-black/60">Note</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m: any, idx: number) => (
                  <tr key={idx} className="border-b border-black/5">
                    <td className="py-2 pr-3 font-semibold text-black/70">{safeVal(m.at)}</td>
                    <td className="py-2 pr-3 font-extrabold text-black">{safeVal(m.from)}</td>
                    <td className="py-2 pr-3 font-extrabold text-black">{safeVal(m.to)}</td>
                    <td className="py-2 pr-3 font-semibold text-black/70">{safeVal(m.by)}</td>
                    <td className="py-2 pr-3 font-semibold text-black/70">{safeVal(m.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-2 text-sm font-semibold text-black/60">No move history found.</div>
        )}
      </div>

      <div className="mt-4 hidden rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="text-sm font-extrabold text-black">Raw Deal (debug)</div>
        <pre className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-black/10 bg-white p-3 text-xs">
{JSON.stringify(deal, null, 2)}
        </pre>
      </div>
    </div>
  );
}









