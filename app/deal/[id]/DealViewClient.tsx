"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// keep this if the file exists in your project
import StatusBankNotesCard from "./StatusBankNotesCard";
import { getCurrentUserClient } from "@/app/lib/user";

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

function dateOnly(v: any) {
  if (!v) return "-";
  const s = String(v).trim();
  if (!s) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function firstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
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
  const [insuranceSendSaving, setInsuranceSendSaving] = useState(false);
  const [insuranceSendMsg, setInsuranceSendMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
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
  const [leadSourcePaid, setLeadSourcePaid] = useState(false);
  const [leadSourcePaidAt, setLeadSourcePaidAt] = useState<string | null>(null);
  const [leadSourcePaidSaving, setLeadSourcePaidSaving] = useState(false);
  const [leadSourcePaidErr, setLeadSourcePaidErr] = useState<string | null>(null);
  const [registrationStatuses, setRegistrationStatuses] = useState<string[]>([]);
  const [registrationStatusSaving, setRegistrationStatusSaving] = useState(false);
  const [registrationStatusErr, setRegistrationStatusErr] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [registrationErr, setRegistrationErr] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState({
    registration_number: "",
    payment_due_date: "",
  });

  async function resolveMovedBy() {
    const local = getCurrentUserClient();
    if (local && local !== "System") return local;
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const name = String(json?.user?.name || "").trim();
      if (name) {
        try {
          localStorage.setItem("cb_user", name);
        } catch {}
        return name;
      }
    } catch {}
    return local || "System";
  }

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
    const lsPaid = (deal as any)?.lead_source_paid ?? (deal as any)?.leadSourcePaid;
    setLeadSourcePaid(lsPaid === true);
    const lsPaidAt = (deal as any)?.lead_source_paid_at ?? (deal as any)?.leadSourcePaidAt;
    setLeadSourcePaidAt(lsPaidAt ? String(lsPaidAt) : null);
    const rs =
      (deal as any)?.registration_statuses ??
      (deal as any)?.registrationStatuses ??
      (deal as any)?.registration_status ??
      (deal as any)?.registrationStatus ??
      "";
    if (Array.isArray(rs)) setRegistrationStatuses(rs.map(String));
    else if (typeof rs === "string") setRegistrationStatuses(rs.split(",").map((s) => s.trim()).filter(Boolean));
  }, [deal]);

  function seedRegistrationForm(d: any) {
    setRegistrationForm({
      registration_number: String(d?.registration_number ?? "").trim(),
      payment_due_date: String(d?.payment_due_date ?? "").trim(),
    });
  }

  const summary = useMemo(() => {
    const d = deal || {};
    const dealBanks = Array.isArray(d.deal_banks) ? d.deal_banks : [];
    const bankWithContact = dealBanks.find((b: any) =>
      firstNonEmpty(b?.contact_name, b?.contact_email, b?.contact_phone, b?.attorney, b?.attorney_note)
    );
    const contactPerson = firstNonEmpty(d.contact_person, d.contact_name, d.contactName, bankWithContact?.contact_name);
    const attorneyRaw = firstNonEmpty(d.attorney, bankWithContact?.attorney);
    const attorneyName = attorneyRaw;
    const attorneyFirm = firstNonEmpty(d.attorney_firm, d.attorneyFirm, (d.attorney_details || {}).firm);
    const attorneyTel = firstNonEmpty(
      d.registration_attorney_tel,
      d.attorney_tel,
      (d.attorney_details || {}).tel,
      bankWithContact?.contact_phone
    );
    const attorneyEmail = firstNonEmpty(
      d.registration_attorney_email,
      d.attorney_email,
      (d.attorney_details || {}).email,
      bankWithContact?.contact_email
    );
    let parsedName = attorneyName;
    let parsedFirm = attorneyFirm;
    let parsedTel = attorneyTel;
    let parsedEmail = attorneyEmail;

    if (parsedName) {
      const firmMatch = parsedName.match(/\(([^)]+)\)/);
      if (!parsedFirm && firmMatch?.[1]) parsedFirm = firmMatch[1].trim();
      if (firmMatch?.[0]) parsedName = parsedName.replace(firmMatch[0], "").trim();

      const telMatch = parsedName.match(/tel:\s*([^e]+?)(?=email:|$)/i);
      if (!parsedTel && telMatch?.[1]) parsedTel = telMatch[1].trim();
      const emailMatch = parsedName.match(/email:\s*([^\s]+.*)$/i);
      if (!parsedEmail && emailMatch?.[1]) parsedEmail = emailMatch[1].trim();
      parsedName = parsedName.replace(/tel:.*$/i, "").replace(/email:.*$/i, "").trim();
    }
    const hasAttorneyDetails = Boolean(parsedName || parsedFirm || parsedTel || parsedEmail || contactPerson);
    const attorneyDetails = (
      <div className="space-y-1 text-sm font-semibold text-black">
        {parsedName ? <div>{parsedName}</div> : null}
        {parsedFirm ? <div className="text-xs font-extrabold text-black/60">{parsedFirm}</div> : null}
        {parsedTel ? <div className="text-xs font-semibold text-black/70">Tel: {parsedTel}</div> : null}
        {parsedEmail ? <div className="text-xs font-semibold text-black/70">Email: {parsedEmail}</div> : null}
        {contactPerson ? <div className="text-xs font-semibold text-black/60">Contact: {contactPerson}</div> : null}
      </div>
    );
    return [
      { label: "Applicant", value: d.applicant  },
      { label: "Ops number", value: d.deal_deck_id ?? d.code  },
      { label: "Bond amount", value: d.amount_zar != null ? fmtMoneyZar(d.amount_zar) : (d.amount != null ? fmtMoneyZar(d.amount) : "-") },
      { label: "Purchase amount", value: d.purchase_price ?? d.purchasePrice ? fmtMoneyZar(d.purchase_price ?? d.purchasePrice) : "-" },
      { label: "Consultant", value: d.consultant  },
      { label: "Lead Source", value: d.agent_name ?? d.agent  },
      { label: "Attorney Details", value: hasAttorneyDetails ? attorneyDetails : "-" },
      { label: "Instructed Date", value: dateOnly(d.instructed_date ?? d.instructed_at ?? d.stage_updated_at ?? d.updated_at) },
      {
        label: "Estimated Reg Date",
        value: dateOnly(
          d.estimated_reg_date ??
            d.estimatedRegDate ??
            d.instructed_estimated_reg_date ??
            d.instructedEstimatedRegDate
        ),
      },
      {
        label: "Bond Due Date",
        value: dateOnly(d.bond_due_date ?? d.bondDueDate),
      },
      { label: "NTU Reason", value: d.ntu_reason ?? d.ntuReason },
      { label: "Status", value: d.stage  },
      { label: "Submitted Date", value: dateOnly(d.submitted_date)  },
      { label: "Property Address", value: d.property_address  },
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

  const showAttorneyInput = false;

  const showNtuInput =
    searchParams.get("from") === "ntu" ||
    String((deal as any)?.stage || "").toLowerCase() === "ntu";

  const showRegistrationPaid =
    searchParams.get("from") === "registrations" ||
    String((deal as any)?.stage || "").toLowerCase() === "registrations";

  const showInstructedStatus =
    searchParams.get("from") === "instructed" ||
    String((deal as any)?.stage || "").toLowerCase() === "instructed";

  const REG_STATUS_OPTIONS = [
    "Attorney contacted",
    "Client signed documents",
    "Lodged",
    "Registered",
  ];

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

  async function sendInsuranceEmail() {
    if (!deal) return;
    setInsuranceSendSaving(true);
    setInsuranceSendMsg(null);

    try {
      const res = await fetch("/api/webhooks/insurance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deal,
          source: "deal_view_registrations",
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Webhook failed (${res.status})`);
      }

      setInsuranceSendMsg({ type: "ok", text: "Insurance email sent." });
    } catch (e: any) {
      setInsuranceSendMsg({ type: "err", text: e?.message || "Failed to send insurance email." });
    } finally {
      setInsuranceSendSaving(false);
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

  async function saveLeadSourcePaid(next: boolean, prevPaid: boolean, prevAt: string | null) {
    if (!dealKey) return;
    setLeadSourcePaidSaving(true);
    setLeadSourcePaidErr(null);

    const paidAt = next ? new Date().toISOString() : null;

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_source_paid: next, lead_source_paid_at: paidAt }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed to update lead source paid (${res.status})`);
      }

      setDeal((prevDeal) =>
        prevDeal
          ? {
              ...prevDeal,
              lead_source_paid: next,
              lead_source_paid_at: paidAt,
            }
          : prevDeal
      );
      setLeadSourcePaidAt(paidAt);
    } catch (e: any) {
      setLeadSourcePaidErr(e?.message || "Failed to update lead source paid");
      setLeadSourcePaid(prevPaid);
      setLeadSourcePaidAt(prevAt);
    } finally {
      setLeadSourcePaidSaving(false);
    }
  }

  async function saveRegistrationStatuses(next: string[]) {
    if (!dealKey) return;
    setRegistrationStatusSaving(true);
    setRegistrationStatusErr(null);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registration_statuses: next }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed to update registration status (${res.status})`);
      }
      setDeal((prevDeal) => (prevDeal ? { ...prevDeal, registration_statuses: next } : prevDeal));
    } catch (e: any) {
      setRegistrationStatusErr(e?.message || "Failed to update registration status");
    } finally {
      setRegistrationStatusSaving(false);
    }
  }

  async function saveRegistrationAndMove() {
    if (!dealKey) return;
    setRegistrationSaving(true);
    setRegistrationErr(null);

    try {
      const nextStatuses = Array.from(new Set([...registrationStatuses, "Registered"]));
      const regPayload = {
        registration_statuses: nextStatuses,
        registration_number: registrationForm.registration_number || null,
        payment_due_date: registrationForm.payment_due_date || null,
      };

      const patchRes = await fetch(`/api/deals/${encodeURIComponent(dealKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(regPayload),
      });
      const patchJson = await patchRes.json().catch(() => ({} as any));
      if (!patchRes.ok || patchJson?.ok === false) {
        throw new Error(patchJson?.error || `Failed to save registration info (${patchRes.status})`);
      }

      const movedBy = await resolveMovedBy();
      if (!movedBy || movedBy === "System") {
        throw new Error("Please log in again so we can record who moved this deal.");
      }

      const moveRes = await fetch("/api/deals/move", {
        method: "POST",
        headers: { "content-type": "application/json", "x-cb-user": movedBy || "" },
        cache: "no-store",
        body: JSON.stringify({
          dealId: dealKey,
          toStage: "registrations",
          stageData: regPayload,
          movedBy,
        }),
      });

      const moveJson = await moveRes.json().catch(() => ({} as any));
      if (!moveRes.ok || moveJson?.ok === false) {
        throw new Error(moveJson?.error || `Failed to move to registrations (${moveRes.status})`);
      }

      setShowRegistrationModal(false);
      router.push("/registrations");
    } catch (e: any) {
      setRegistrationErr(e?.message || "Failed to save registration info");
    } finally {
      setRegistrationSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div />

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

        {showRegistrationPaid && !registrationPaid ? (
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

        {showRegistrationPaid && !leadSourcePaid ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold text-black/45">Lead Source Paid</div>
                <div className="text-sm font-semibold text-black/70">Toggle on when lead source is paid.</div>
                {leadSourcePaidAt ? (
                  <div className="mt-1 text-xs font-semibold text-black/50">
                    Paid on {new Date(leadSourcePaidAt).toLocaleString("en-ZA")}
                  </div>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm font-extrabold text-black">
                <input
                  type="checkbox"
                  checked={leadSourcePaid}
                  disabled={leadSourcePaidSaving}
                  onChange={(e) => {
                    const next = e.target.checked;
                    const prevPaid = leadSourcePaid;
                    const prevAt = leadSourcePaidAt;
                    setLeadSourcePaid(next);
                    saveLeadSourcePaid(next, prevPaid, prevAt);
                  }}
                />
                {leadSourcePaid ? "Paid" : "Not paid"}
              </label>
            </div>
            {leadSourcePaidErr ? (
              <div className="mt-2 text-xs font-semibold text-red-600">{leadSourcePaidErr}</div>
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

        {showRegistrationPaid && leadSourcePaid ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="text-[11px] font-extrabold text-black/45">Lead Source Paid</div>
            <div className="mt-1 text-sm font-extrabold text-black">Paid</div>
            <div className="mt-1 text-xs font-semibold text-black/60">
              {leadSourcePaidAt
                ? `Paid on ${new Date(leadSourcePaidAt).toLocaleString("en-ZA")}`
                : "Payment date not recorded yet."}
            </div>
          </div>
        ) : null}

        {showRegistrationPaid ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="text-[11px] font-extrabold text-black/45">Insurance request sent</div>
            <div className="mt-1 text-sm font-extrabold text-black">
              {dateOnly((deal as any)?.instructed_date ?? (deal as any)?.instructed_at ?? (deal as any)?.stage_updated_at ?? (deal as any)?.updated_at)}
            </div>
          </div>
        ) : null}

        {showInstructedStatus ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="text-[11px] font-extrabold text-black/45">Status</div>
            <div className="text-sm font-semibold text-black/70">Select all that apply.</div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REG_STATUS_OPTIONS.filter((opt) => !registrationStatuses.includes(opt)).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm font-semibold text-black">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={(e) => {
                      if (!e.target.checked) return;
                      const next = Array.from(new Set([...registrationStatuses, opt]));
                      setRegistrationStatuses(next);
                      if (opt === "Registered") {
                        seedRegistrationForm(deal);
                        setRegistrationErr(null);
                        setShowRegistrationModal(true);
                        return;
                      }
                      saveRegistrationStatuses(next);
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>

            {registrationStatusErr ? (
              <div className="mt-2 text-xs font-semibold text-red-600">{registrationStatusErr}</div>
            ) : null}
          </div>
        ) : null}

        {showInstructedStatus ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="text-[11px] font-extrabold text-black/45">Status</div>
            <div className="mt-1 text-sm font-extrabold text-black">
              {registrationStatuses.length ? registrationStatuses.join(", ") : "-"}
            </div>
          </div>
        ) : null}

        {showRegistrationModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="text-sm font-extrabold text-black">Registration info</div>
              <div className="mt-1 text-xs font-semibold text-black/60">
                Save registration details before moving this deal to Registrations.
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-extrabold text-black/60">
                  Registration number
                  <input
                    value={registrationForm.registration_number}
                    onChange={(e) =>
                      setRegistrationForm((prev) => ({ ...prev, registration_number: e.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                  />
                </label>
                <label className="text-xs font-extrabold text-black/60">
                  Payment due date
                  <input
                    type="date"
                    value={registrationForm.payment_due_date}
                    onChange={(e) =>
                      setRegistrationForm((prev) => ({ ...prev, payment_due_date: e.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                  />
                </label>
              </div>

              {registrationErr ? (
                <div className="mt-3 text-xs font-semibold text-red-600">{registrationErr}</div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveRegistrationAndMove}
                  disabled={registrationSaving}
                  className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {registrationSaving ? "Saving..." : "Save & move to Registrations"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegistrationModal(false);
                    setRegistrationErr(null);
                    const next = registrationStatuses.filter((v) => v !== "Registered");
                    setRegistrationStatuses(next);
                    saveRegistrationStatuses(next);
                  }}
                  disabled={registrationSaving}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showRegistrationPaid ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="text-[11px] font-extrabold text-black/45">Status</div>
            <div className="mt-1 text-sm font-extrabold text-black">
              {registrationStatuses.length ? registrationStatuses.join(", ") : "-"}
            </div>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {summary
            .filter((s: any) => {
              if (s.label === "Estimated Reg Date") return true;
              return hasValue((s as any).value);
            })
            .map((it: any) => {
            const isNode = React.isValidElement(it.value);
            return (
              <div key={it.label} className="rounded-xl border border-black/10 bg-white p-4">
                <div className="text-[11px] font-extrabold text-black/45">{it.label}</div>
                {isNode ? (
                  <div className="mt-1">{it.value}</div>
                ) : (
                  <div className="text-sm font-extrabold text-black">{safeVal(it.value)}</div>
                )}
              </div>
            );
          })}
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
            String((deal as any)?.stage || "").toLowerCase() === "registrations" ||
            searchParams.get("from") === "instructed" ||
            String((deal as any)?.stage || "").toLowerCase() === "instructed"
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









