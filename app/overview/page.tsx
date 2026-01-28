"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
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

export default function OverviewPage() {
  const { deals, loading, error, refreshAll } = useDeals();
  const [consultantFilter, setConsultantFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-2 py-4">
      <div className="mb-6">
        <Image
          src="/capital-bonds-logo.svg"
          alt="Capital Bonds"
          width={1200}
          height={300}
          priority
          className="h-[180px] w-full object-contain"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-white/70">Overview</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Deal Pipeline Overview
          </div>
          <div className="mt-1 text-sm font-semibold text-white/70">
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
            className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
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
                <th className="px-4 py-3">Purchase Price</th>
                <th className="px-4 py-3">Loan Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {grouped.map((group) => {
                const rows = group.deals;
                const totalValue = rows.reduce((sum: number, d: DealAny) => sum + pickLoanAmountValue(d), 0);
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
                    </tr>
                  );
                }

                return (
                  <>
                    {rows.map((deal: DealAny, index: number) => (
                      <tr key={`${group.stage}-${deal?.id ?? index}`} className="hover:bg-black/[0.02]">
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
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickPurchasePrice(deal)}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-black">
                          {pickLoanAmount(deal)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-black/[0.02]">
                      <td className="px-4 py-3 text-xs font-bold text-black/60">Status total</td>
                      <td className="px-4 py-3 text-xs font-semibold text-black/50">-</td>
                      <td className="px-4 py-3 text-xs font-semibold text-black/50">-</td>
                      <td className="px-4 py-3 text-xs font-semibold text-black/50">-</td>
                      <td className="px-4 py-3 text-xs font-semibold text-black/50">-</td>
                      <td className="px-4 py-3 text-xs font-semibold text-black/50">-</td>
                      <td className="px-4 py-3 text-sm font-extrabold text-black">
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
