"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { useDeals } from "./useDeals";
import MoveDealInline from "./MoveDealInline";

type DealAny = any;

function normalizeStage(v: any): string {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw === "registration" || raw === "regs" || raw === "reg") return "registrations";
  if (raw === "iap") return "aip";
  if (raw === "instructions" || raw === "instruct") return "instructed";
  if (raw === "grant" || raw === "approved") return "granted";
  return raw || "submitted";
}

function pickDealDeckId(d: DealAny) {
  return (
    d?.deal_deck_id ??
    d?.dealDeckId ??
    d?.deck_id ??
    d?.deal_deck ??
    d?.dealDeckID ??
    ""
  );
}

function pickDealRef(d: DealAny) {
  return (
    pickDealDeckId(d) ||
    (d?.deal_ref ??
      d?.dealRef ??
      d?.deal_reference ??
      d?.dealReference ??
      d?.deal_code ??
      d?.reference ??
      "-")
  );
}

function pickConsultant(d: DealAny) {
  return d?.consultant ?? d?.consultant_name ?? d?.consultantName ?? "-";
}

function pickLeadSource(d: DealAny) {
  return d?.lead_source ?? d?.leadSource ?? d?.agent ?? d?.agent_name ?? d?.agentName ?? "-";
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

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyZar(n: number) {
  return `R ${Number(n || 0).toLocaleString("en-ZA")}`;
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

function pickMainBank(d: DealAny) {
  const direct =
    d?.client_main_bank ??
    d?.clientMainBank ??
    d?.main_bank ??
    d?.mainBank ??
    d?.primary_bank ??
    d?.primaryBank ??
    d?.bank ??
    d?.bank_name ??
    d?.bankName ??
    "";
  if (direct) return String(direct);

  const banks = Array.isArray(d?.banks) ? d.banks : [];
  const first =
    banks[0]?.bank_name ??
    banks[0]?.bankName ??
    banks[0]?.name ??
    banks[0]?.bank ??
    "";
  return first ? String(first) : "-";
}

export default function AipTable() {
  const { deals } = useDeals();

  const list = useMemo(() => {
    return (deals || []).filter((d: DealAny) => normalizeStage(d?.stage) === "aip");
  }, [deals]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-6">
      <div className="mb-10">
        <Image
          src="/capital-bonds-logo.svg"
          alt="Capital Bonds"
          width={1200}
          height={300}
          priority
          className="h-[180px] w-full object-contain"
        />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-extrabold text-white/70">Status</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">AIP</div>
          <div className="mt-1 text-sm font-semibold text-white/70">
            {list.length} deal{list.length === 1 ? "" : "s"}
          </div>
        </div>

        <Link
          href="/submitted/new"
          className="rounded-2xl bg-black px-5 py-3 text-sm font-extrabold text-white hover:opacity-90"
        >
          + New Submission
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left">
            <thead className="border-b border-black/10 bg-white">
              <tr className="text-xs font-extrabold text-black/70">
                <th className="px-4 py-3">Ops number</th>
                <th className="px-4 py-3">Consultant</th>
                <th className="px-4 py-3">Lead Source</th>
                <th className="px-4 py-3">Client name</th>
                <th className="px-4 py-3">Purchase price</th>
                <th className="px-4 py-3">Loan amount</th>
                <th className="px-4 py-3">Client main bank</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/10">
              {list.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm font-semibold text-black/60" colSpan={8}>
                    No deals in this status yet.
                  </td>
                </tr>
              ) : (
                list.map((d: DealAny) => (
                  <tr key={d?.id || pickDealRef(d)} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-4">
                      <Link
                        href={`/deal/${encodeURIComponent(d.id ?? "")}`}
                        className="text-sm font-extrabold text-black hover:underline"
                      >
                        {pickDealRef(d)}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-black">{pickConsultant(d)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-black">{pickLeadSource(d)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-black">{pickClientName(d)}</td>
                    <td className="px-4 py-4 text-sm font-extrabold text-black">{pickPurchasePrice(d)}</td>
                    <td className="px-4 py-4 text-sm font-extrabold text-black">{pickLoanAmount(d)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-black">{pickMainBank(d)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/deal/${encodeURIComponent(d.id ?? "")}`}
                          className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
                        >
                          View
                        </Link>
                        <MoveDealInline deal={d} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
