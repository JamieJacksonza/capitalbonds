"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useDeals } from "@/app/_components/useDeals";

type DealAny = any;

const STAGES = ["submitted", "aip", "granted", "instructed", "ntu"] as const;

function normalizeStage(v: any) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw === "registration" || raw === "regs" || raw === "reg") return "registrations";
  if (raw === "iap") return "aip";
  if (raw === "instructions" || raw === "instruct") return "instructed";
  if (raw === "grant" || raw === "approved") return "granted";
  return raw || "submitted";
}

function stageLabel(stage: string) {
  if (stage === "submitted") return "Submitted";
  if (stage === "aip") return "AIP";
  if (stage === "granted") return "Granted";
  if (stage === "instructed") return "Instructed";
  if (stage === "ntu") return "NTU";
  return stage;
}

function stageTotalTone(stage: string) {
  if (stage === "submitted") {
    return {
      row: "bg-sky-50",
      label: "text-sky-800",
      muted: "text-sky-700/60",
      total: "text-sky-900",
    };
  }
  if (stage === "aip") {
    return {
      row: "bg-indigo-50",
      label: "text-indigo-800",
      muted: "text-indigo-700/60",
      total: "text-indigo-900",
    };
  }
  if (stage === "granted") {
    return {
      row: "bg-emerald-50",
      label: "text-emerald-800",
      muted: "text-emerald-700/60",
      total: "text-emerald-900",
    };
  }
  if (stage === "instructed") {
    return {
      row: "bg-amber-50",
      label: "text-amber-800",
      muted: "text-amber-700/60",
      total: "text-amber-900",
    };
  }
  if (stage === "ntu") {
    return {
      row: "bg-rose-50",
      label: "text-rose-800",
      muted: "text-rose-700/60",
      total: "text-rose-900",
    };
  }
  return {
    row: "bg-black/[0.02]",
    label: "text-black/60",
    muted: "text-black/50",
    total: "text-black",
  };
}

function moneyZar(n: number) {
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickAppDate(d: DealAny) {
  const raw =
    d?.submitted_date ??
    d?.submittedDate ??
    d?.submitted_at ??
    d?.created_at ??
    d?.createdAt ??
    "";
  if (!raw) return "-";
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return s;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function pickAppDateRaw(d: DealAny) {
  return (
    d?.submitted_date ??
    d?.submittedDate ??
    d?.submitted_at ??
    d?.created_at ??
    d?.createdAt ??
    ""
  );
}

function inDateRange(raw: any, from: string, to: string) {
  if (!from && !to) return true;
  const s = String(raw || "").trim();
  if (!s) return false;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s);
  if (Number.isNaN(date.getTime())) return false;
  const fromDt = from ? new Date(`${from}T00:00:00`) : null;
  const toDt = to ? new Date(`${to}T23:59:59`) : null;
  if (fromDt && date < fromDt) return false;
  if (toDt && date > toDt) return false;
  return true;
}

function pickConsultant(d: DealAny) {
  return d?.consultant ?? d?.consultant_name ?? d?.consultantName ?? "-";
}

function pickAgent(d: DealAny) {
  return d?.agent ?? d?.agent_name ?? d?.agentName ?? "-";
}

function pickDealRef(d: DealAny) {
  return (
    d?.deal_ref ??
    d?.dealRef ??
    d?.deal_reference ??
    d?.dealReference ??
    d?.deal_code ??
    d?.deal_deck_id ??
    d?.dealDeckId ??
    d?.reference ??
    "-"
  );
}

function pickClientName(d: DealAny) {
  return (
    d?.client_name ??
    d?.clientName ??
    d?.applicant ??
    d?.applicant_name ??
    d?.applicantName ??
    "-"
  );
}

function pickPurchasePrice(d: DealAny) {
  const raw =
    d?.purchase_price ??
    d?.purchasePrice ??
    d?.price ??
    d?.purchase_amount ??
    d?.purchaseAmount ??
    null;
  if (raw === null || raw === undefined || raw === "") return "-";
  const n = toNumber(raw);
  return n > 0 ? moneyZar(n) : "-";
}

function pickLoanAmount(d: DealAny) {
  const raw =
    d?.amount_zar ??
    d?.amountZar ??
    d?.amount ??
    d?.loan_amount ??
    d?.loanAmount ??
    null;
  if (raw === null || raw === undefined || raw === "") return "-";
  const n = toNumber(raw);
  return n > 0 ? moneyZar(n) : "-";
}

function pickLoanAmountValue(d: DealAny) {
  const raw =
    d?.amount_zar ??
    d?.amountZar ??
    d?.amount ??
    d?.loan_amount ??
    d?.loanAmount ??
    0;
  return toNumber(raw);
}

function cleanNoteText(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s === "-" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s
    .replace(/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\s*-\s*/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushStageNote(parts: string[], label: string, value: unknown) {
  const text = cleanNoteText(value);
  if (!text) return;
  parts.push(`${label}: ${text}`);
}

function pushBankTextLines(parts: string[], label: string, text: unknown) {
  const raw = cleanNoteText(text);
  if (!raw) return;
  const lines = raw
    .split("\n")
    .map((line) => cleanNoteText(line))
    .filter(Boolean);
  for (const line of lines) {
    parts.push(`${label}: ${line}`);
  }
}

function compactChipText(v: string) {
  const text = cleanNoteText(v);
  if (!text) return "";
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function summarizeDealNotes(d: DealAny) {
  const parts: string[] = [];

  pushStageNote(parts, "General", d?.notes);
  pushStageNote(parts, "AIP", d?.aip_notes ?? d?.aipNotes);
  pushStageNote(parts, "Granted", d?.granted_notes ?? d?.grantedNotes);
  pushStageNote(parts, "Instructed", d?.instructed_notes ?? d?.instructedNotes);
  pushStageNote(parts, "Registration", d?.registration_notes ?? d?.registrationNotes);
  pushStageNote(parts, "NTU", d?.ntu_reason ?? d?.ntuReason);
  pushBankTextLines(parts, "Bank", d?.bank_notes);

  const dealBanks = Array.isArray(d?.deal_banks) ? d.deal_banks : [];
  for (const b of dealBanks) {
    const bankName = cleanNoteText((b as { bank_name?: unknown }).bank_name) || "Bank";
    pushStageNote(parts, bankName, (b as { bank_notes?: unknown }).bank_notes);
  }

  const bankRows = Array.isArray(d?.bank_notes_rows) ? d.bank_notes_rows : [];
  for (const r of bankRows) {
    const bankName = cleanNoteText((r as { bank_name?: unknown }).bank_name) || "Bank";
    pushStageNote(parts, bankName, (r as { bank_notes?: unknown }).bank_notes);
  }

  const moveHistory = Array.isArray(d?.move_history) ? d.move_history : [];
  for (let i = moveHistory.length - 1; i >= 0; i--) {
    const m = moveHistory[i];
    pushStageNote(parts, "Move", m?.note);

    const data = m?.data && typeof m.data === "object" ? m.data : null;
    if (!data) continue;

    pushStageNote(parts, "AIP", data?.aip_notes);
    pushStageNote(parts, "Granted", data?.granted_notes);
    pushStageNote(parts, "Instructed", data?.instructed_notes);
    pushStageNote(parts, "Registration", data?.registration_notes);
    pushStageNote(parts, "NTU", data?.ntu_reason);
    pushBankTextLines(parts, "Bank", data?.bank_notes);
    pushBankTextLines(parts, "AIP Bank", data?.aip_bank_notes);
    pushBankTextLines(parts, "Granted Bank", data?.granted_bank_notes);
    pushBankTextLines(parts, "Instructed Bank", data?.instructed_bank_notes);
    pushBankTextLines(parts, "Registration Bank", data?.registration_bank_notes);

    const bankByName = data?.bank_by_name && typeof data.bank_by_name === "object" ? data.bank_by_name : null;
    if (bankByName) {
      for (const [bankName, bankNote] of Object.entries(bankByName)) {
        pushStageNote(parts, String(bankName || "Bank"), bankNote);
      }
    }

    const notesItems = Array.isArray(data?.notes_items) ? data.notes_items : [];
    for (const item of notesItems) {
      if (item && typeof item === "object") {
        pushStageNote(parts, "Note", (item as { text?: unknown }).text);
      } else {
        pushStageNote(parts, "Note", item);
      }
    }

    if (parts.length >= 12) break;
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
    if (deduped.length >= 5) break;
  }

  return deduped;
}

export default function OverviewPage() {
  const { deals, loading, error, refreshAll } = useDeals();
  const [consultantFilter, setConsultantFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [detailById, setDetailById] = useState<Record<string, DealAny | null>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const consultantOptions = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    const names = list
      .map((d) => String(pickConsultant(d) || "").trim())
      .filter((n) => n && n !== "-");
    const uniq = Array.from(new Set(names.map((n) => n.toLowerCase()))).map((k) =>
      names.find((n) => n.toLowerCase() === k) || k
    );
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [deals]);

  const grouped = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    const filtered = list.filter((d) => {
      const consultant = String(pickConsultant(d) || "").trim();
      const consultantOk =
        consultantFilter === "all" ||
        consultant.toLowerCase() === consultantFilter.toLowerCase();
      const dateOk = inDateRange(pickAppDateRaw(d), from, to);
      return consultantOk && dateOk;
    });
    return STAGES.map((stage) => ({
      stage,
      deals: filtered.filter((d) => normalizeStage(d?.stage) === stage),
    }));
  }, [deals, consultantFilter, from, to]);

  const visibleDealIds = useMemo(() => {
    const ids: string[] = [];
    for (const g of grouped) {
      for (const d of g.deals || []) {
        const id = String(d?.id || "").trim();
        if (id) ids.push(id);
      }
    }
    return Array.from(new Set(ids));
  }, [grouped]);

  useEffect(() => {
    const missing = visibleDealIds.filter((id) => !(id in detailById));
    if (!missing.length) return;

    let alive = true;

    async function loadDealDetails() {
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await fetch(`/api/deals/${encodeURIComponent(id)}`, { cache: "no-store" });
            const json = await res.json().catch(() => ({}));
            const deal =
              json?.deal ??
              json?.data ??
              (json?.ok === true ? json?.deal : null) ??
              null;
            return [id, deal && typeof deal === "object" ? deal : null] as const;
          } catch {
            return [id, null] as const;
          }
        })
      );

      if (!alive) return;

      setDetailById((prev) => {
        const next = { ...prev };
        for (const [id, detail] of results) next[id] = detail;
        return next;
      });
    }

    loadDealDetails();
    return () => {
      alive = false;
    };
  }, [visibleDealIds, detailById]);

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-2 py-4 md:px-3 lg:px-4">
      <div className="mb-10 flex justify-center">
        <img
          src="/ccb-crm-banner-logo-333.png"
          alt="Capital Bonds"
          className="block h-[360px] w-full object-contain"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#142037]/55">Overview</div>
          <div className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#142037]">
            Deal Pipeline Overview
          </div>
          <div className="mt-2 text-sm font-medium text-slate-500">
            {grouped.reduce((sum, g) => sum + g.deals.length, 0)} deal(s) shown
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-sm">
            <div className="text-[10px] font-extrabold text-black/60">Consultant</div>
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="mt-1 rounded-xl border border-black/10 bg-white px-2 py-1 text-xs font-extrabold text-black outline-none focus:border-black/30"
            >
              <option value="all">All</option>
              {consultantOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-sm">
            <div className="text-[10px] font-extrabold text-black/60">Date filter (app date)</div>
            <div className="mt-1 flex items-center gap-2">
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
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[10px] font-extrabold text-black hover:bg-black/[0.03]"
              >
                Clear
              </button>
            </div>
          </div>

          <button
            onClick={() => refreshAll?.()}
            className="rounded-2xl bg-[#142037] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#1a2a49]"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-900">
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
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold text-black/60">
          Loading deals...
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="border-b border-black/10 bg-white">
              <tr className="text-xs font-extrabold text-black/70">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">App Date</th>
                <th className="px-4 py-3">Consultant</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Deal Ref</th>
                <th className="px-4 py-3">Client Name</th>
                <th className="px-4 py-3">Notes Summary</th>
                <th className="px-4 py-3">Purchase Price</th>
                <th className="px-4 py-3">Loan Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {grouped.map((group) => {
                const rows = group.deals;
                const totalValue = rows.reduce((sum: number, d: DealAny) => sum + pickLoanAmountValue(d), 0);
                const tone = stageTotalTone(group.stage);
                if (!rows.length) {
                  return (
                    <tr key={group.stage} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-4 text-sm font-extrabold text-black">
                        {stageLabel(group.stage)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black/40">-</td>
                    </tr>
                  );
                }

                return (
                  <>
                    {rows.map((deal: DealAny, index: number) => {
                      const rowKey = `${group.stage}-${deal?.id ?? index}`;
                      const id = String(deal?.id || "").trim();
                      const source = (id && detailById[id]) || deal;
                      const summaryChips = summarizeDealNotes(source);
                      const expanded = !!expandedNotes[rowKey];
                      const visibleChips = expanded ? summaryChips : summaryChips.slice(0, 3);
                      const hiddenCount = Math.max(0, summaryChips.length - visibleChips.length);

                      return (
                      <tr key={rowKey} className="hover:bg-black/[0.02]">
                        {index === 0 ? (
                          <td
                            className="px-4 py-4 align-top text-sm font-extrabold text-black"
                            rowSpan={rows.length + 1}
                          >
                            {stageLabel(group.stage)}
                          </td>
                        ) : null}
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickAppDate(deal)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickConsultant(deal)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickAgent(deal)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickDealRef(deal)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickClientName(deal)}
                        </td>
                        <td className="px-4 py-4">
                          {summaryChips.length ? (
                            <div className="max-w-[360px] space-y-1">
                              {visibleChips.map((chip, chipIndex) => (
                                <span
                                  key={`${rowKey}-note-${chipIndex}`}
                                  className="flex items-center gap-1 text-[10px] font-extrabold text-black/80"
                                >
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/50" />
                                  <span className="truncate">{compactChipText(chip)}</span>
                                </span>
                              ))}
                              {hiddenCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedNotes((prev) => ({ ...prev, [rowKey]: true }))
                                  }
                                  className="text-[10px] font-semibold text-black/60 hover:text-black"
                                >
                                  +{hiddenCount} more
                                </button>
                              ) : null}
                              {expanded && summaryChips.length > 3 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedNotes((prev) => ({ ...prev, [rowKey]: false }))
                                  }
                                  className="text-[10px] font-semibold text-black/60 hover:text-black"
                                >
                                  Show less
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-black/40">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickPurchasePrice(deal)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickLoanAmount(deal)}
                        </td>
                      </tr>
                    );
                    })}
                    <tr className={tone.row}>
                      <td className={`px-4 py-3 text-xs font-bold ${tone.label}`}>Status total</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${tone.muted}`}>-</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${tone.muted}`}>-</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${tone.muted}`}>-</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${tone.muted}`}>-</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${tone.muted}`}>-</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${tone.muted}`}>-</td>
                      <td className={`px-4 py-3 text-sm font-extrabold ${tone.total}`}>
                        {moneyZar(totalValue)}
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
