"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useDeals } from "./useDeals";

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

function pickInstructedDate(d: DealAny) {
  const raw =
    d?.instructed_date ??
    d?.instructedDate ??
    d?.instructed_at ??
    d?.instructedAt ??
    d?.instructed_on ??
    d?.instructedOn ??
    d?.stage_updated_at ??
    d?.updated_at ??
    d?.created_at ??
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

function pickPaymentDueDate(d: DealAny) {
  const paid = d?.registration_paid === true || d?.registrationPaid === true;
  if (paid) return "Paid";
  const raw =
    d?.payment_due_date ??
    d?.paymentDueDate ??
    d?.registration_payment_due_date ??
    d?.registrationPaymentDueDate ??
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

function getPaymentDueDateKey(d: DealAny) {
  const raw =
    d?.payment_due_date ??
    d?.paymentDueDate ??
    d?.registration_payment_due_date ??
    d?.registrationPaymentDueDate ??
    "";
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function RegistrationsTable() {
  const { deals } = useDeals();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paidFilter, setPaidFilter] = useState<"all" | "paid" | "unpaid">("all");

  const list = useMemo(() => {
    let next = (deals || []).filter((d: DealAny) => normalizeStatus(d?.stage) === "registrations");

    if (paidFilter !== "all") {
      next = next.filter((d: DealAny) => {
        const paid = d?.registration_paid === true || d?.registrationPaid === true;
        return paidFilter === "paid" ? paid : !paid;
      });
    }

    if (fromDate || toDate) {
      next = next.filter((d: DealAny) => {
        const key = getPaymentDueDateKey(d);
        if (!key) return false;
        if (fromDate && key < fromDate) return false;
        if (toDate && key > toDate) return false;
        return true;
      });
    }

    return next;
  }, [deals, paidFilter, fromDate, toDate]);

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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold text-white/70">Status</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">Registrations</div>
          <div className="mt-1 text-sm font-semibold text-white/70">
            {list.length} deal{list.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-[11px] font-extrabold text-white/60">From</div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-white/30"
            />
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-white/60">To</div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-white/30"
            />
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-white/60">Paid filter</div>
            <select
              value={paidFilter}
              onChange={(e) => setPaidFilter(e.target.value as "all" | "paid" | "unpaid")}
              className="mt-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-white/30"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Not paid</option>
            </select>
          </div>

        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="border-b border-black/10 bg-white">
              <tr className="text-xs font-extrabold text-black/70">
                <th className="px-4 py-3">Instructed Date</th>
                <th className="px-4 py-3">Ops Refference</th>
                <th className="px-4 py-3">Consultant</th>
                <th className="px-4 py-3">Lead Source</th>
                <th className="px-4 py-3">Client name</th>
                <th className="px-4 py-3">Loan amount</th>
                <th className="px-4 py-3">Payment Due Date</th>
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
                list.map((d: DealAny) => {
                  const paid = d?.registration_paid === true || d?.registrationPaid === true;
                  return (
                  <tr
                    key={d?.id || pickDealRef(d)}
                    className={[
                      "hover:bg-black/[0.02]",
                      paid ? "" : "bg-yellow-300",
                    ].join(" ")}
                  >
                    <td className="px-4 py-4 text-sm font-semibold text-black">{pickInstructedDate(d)}</td>
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
                    <td className="px-4 py-4 text-sm font-extrabold text-black">{pickLoanAmount(d)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-black">{pickPaymentDueDate(d)}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/deal/${encodeURIComponent(d.id ?? "")}`}
                        className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
