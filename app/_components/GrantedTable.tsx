"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { useDeals } from "./useDeals";
import MoveDealInline from "./MoveDealInline";
import { exportRowsToCsv, exportRowsToPdf } from "../lib/exportDeals";

type DealAny = any;

function normalizeStatus(v: any): string {
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

export default function GrantedTable() {
  const { deals } = useDeals();

  const list = useMemo(() => {
    return (deals || []).filter((d: DealAny) => normalizeStatus(d?.stage) === "granted");
  }, [deals]);
  const exportHeaders = [
    "Ops number",
    "Consultant",
    "Lead Source",
    "Purchase Price",
    "Loan Amount",
    "Client Main Bank",
  ];
  const exportRows = useMemo(
    () =>
      list.map((d) => [
        pickDealRef(d),
        pickConsultant(d),
        pickLeadSource(d),
        pickPurchasePrice(d),
        pickLoanAmount(d),
        pickMainBank(d),
      ]),
    [list]
  );

  return (
    <div className="mx-auto w-full max-w-none space-y-4 px-2 py-4 md:px-3 md:py-6 xl:px-4">
      <div className="mb-10 flex justify-center">
        <img
          src="/ccb-crm-banner-logo-333.png"
          alt="Capital Bonds"
          className="block h-[360px] w-full object-contain"
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#142037]/55">Status</div>
          <div className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#142037]">Granted</div>
          <div className="mt-2 text-sm font-medium text-slate-500">
            {list.length} deal{list.length === 1 ? "" : "s"}
          </div>
        </div>

        <Link
          href="/submitted/new"
          className="rounded-2xl bg-[#142037] px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white hover:bg-[#1a2a49]"
        >
          + New Submission
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportRowsToCsv("granted-deals", exportHeaders, exportRows)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#142037] hover:border-slate-300"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportRowsToPdf("Granted Deals", exportHeaders, exportRows)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#142037] hover:border-slate-300"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
        <div className="bg-[#142037] px-5 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white">
          Granted Deals
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left">
            <thead className="border-b border-black/10 bg-white">
              <tr className="text-xs font-extrabold text-black/70">
                <th className="px-4 py-4">Ops number</th>
                <th className="px-4 py-4">Consultant</th>
                <th className="px-4 py-4">Lead Source</th>
                <th className="px-4 py-4">Purchase Price</th>
                <th className="px-4 py-4">Loan Amount</th>
                <th className="px-4 py-4">Client Main Bank</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/10">
              {list.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm font-semibold text-black/60" colSpan={7}>
                    No deals in this status yet.
                  </td>
                </tr>
              ) : (
                list.map((d: DealAny) => (
                  <tr key={d?.id || pickDealRef(d)} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-5">
                      <Link
                        href={`/deal/${encodeURIComponent(d.id ?? "")}`}
                        className="text-sm font-extrabold text-black hover:underline"
                      >
                        {pickDealRef(d)}
                      </Link>
                    </td>
                    <td className="px-4 py-5 text-sm font-semibold text-black whitespace-nowrap">{pickConsultant(d)}</td>
                    <td className="px-4 py-5 text-sm font-semibold text-black whitespace-nowrap">{pickLeadSource(d)}</td>
                    <td className="px-4 py-5 text-sm font-extrabold text-black whitespace-nowrap">{pickPurchasePrice(d)}</td>
                    <td className="px-4 py-5 text-sm font-extrabold text-black whitespace-nowrap">{pickLoanAmount(d)}</td>
                    <td className="px-4 py-5 text-sm font-semibold text-black whitespace-nowrap">{pickMainBank(d)}</td>
                    <td className="px-4 py-5">
                      <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                        <Link
                          href={`/deal/${encodeURIComponent(d.id ?? "")}`}
                          className="rounded-2xl border border-black/10 bg-white px-3.5 py-2 text-[11px] font-extrabold text-black hover:border-black/20"
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
