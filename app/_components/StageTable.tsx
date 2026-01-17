"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import MoveDealInline from "./MoveDealInline";
import { useDeals, type Deal, type Stage } from "./useDeals";

const __USE_QUERY_STAGE = false;

function pickDealDeckId(d: any) {
  return (
    d?.deal_deck_id ??
    d?.dealDeckId ??
    d?.deck_id ??
    d?.deal_deck ??
    d?.dealDeckID ??
    ""
  );
}

function stageToRoute(stage: any) {
  let s = String(stage ?? "").trim().toLowerCase();
  if (!s) s = "submitted";
  if (s === "arp") s = "aip";
  if (s === "registration" || s === "regs" || s === "reg") s = "registrations";
  if (s === "instructions" || s === "instruct") s = "instructed";
  if (s === "grant" || s === "approved") s = "granted";
  return __USE_QUERY_STAGE ? "/?stage=" + encodeURIComponent(s) : "/" + s;
}

function normalizeStage(v: any): string {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw === "registration" || raw === "regs" || raw === "reg") return "registrations";
  if (raw === "iap") return "aip";
  if (raw === "instructions" || raw === "instruct") return "instructed";
  if (raw === "grant" || raw === "approved") return "granted";
  return raw || "submitted";
}

function money(n: number) {
  return `R ${Number(n || 0).toLocaleString("en-ZA")}`;
}

function stageLabel(s0: any) {
  const s = String(s0 || "").toLowerCase();
  if (s === "submitted") return "Submitted";
  if (s === "aip") return "AIP";
  if (s === "instructed") return "Instructed";
  if (s === "granted") return "Granted";
  if (s === "registrations") return "Registrations";
  return "NTU";
}

function toAmount(d: any): number {
  const raw = d?.amount_zar ?? d?.amountZar ?? d?.amount ?? 0;
  const n = typeof raw === "string" ? Number(raw) : Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
}

function toDateSafe(v: any) {
  if (!v) return "-";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function pickApplicant(d: any) {
  return (
    d?.client_name ??
    d?.clientName ??
    d?.applicant ??
    d?.applicant_name ??
    d?.applicantName ??
    "-"
  );
}

function pickDealRef(d: any) {
  return (
    d?.deal_ref ??
    d?.dealRef ??
    d?.deal_reference ??
    d?.dealReference ??
    d?.reference ??
    "-"
  );
}

function pickBank(d: any) {
  return d?.bank ?? d?.bank_name ?? d?.bankName ?? "-";
}

function pickBankNames(d: any) {
  const banks = Array.isArray(d?.banks) ? d.banks : [];
  const names = banks
    .map((b: any) => b?.bank_name ?? b?.bankName ?? b?.name ?? b?.bank ?? "")
    .map((s: any) => String(s || "").trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(n);
  }

  if (uniq.length) return { names: uniq.join(", "), count: uniq.length };

  const single = String(pickBank(d) || "").trim();
  return { names: single || "-", count: single ? 1 : 0 };
}

export default function StageTable({ stage }: { stage: Stage }) {
  const { deals } = useDeals();

  const normalized = useMemo(() => normalizeStage(stage), [stage]);
  const stageKey = normalized as Stage;
  const isRegistrations = normalized === "registrations";

  const list = useMemo(() => {
    return (deals || [])
      .filter((d: any) => normalizeStage(d?.stage) === normalized)
      .map((d: any) => ({ ...d, amount: toAmount(d) })) as Deal[];
  }, [deals, normalized]);

  const colSpan = isRegistrations ? 5 : 6;

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
          <div className="text-xs font-extrabold text-white/70">Stage</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            {stageLabel(stageKey)}
          </div>
          <div className="mt-1 text-sm font-semibold text-white/70">
            {list.length} deal{list.length === 1 ? "" : "s"}
          </div>
        </div>

        {stageKey === "submitted" ? (
          <Link
            href="/submitted/new"
            className="rounded-2xl bg-black px-5 py-3 text-sm font-extrabold text-white hover:opacity-90"
          >
            + New Submission
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="border-b border-black/10 bg-white">
              {isRegistrations ? (
                <tr className="text-xs font-extrabold text-black/70">
                  <th className="px-4 py-3">Deal Ops number</th>
                  <th className="px-4 py-3">Client Name</th>
                  <th className="px-4 py-3">Loan Amount</th>
                  <th className="px-4 py-3">Consultant Name</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              ) : (
                <tr className="text-xs font-extrabold text-black/70">
                  <th className="px-4 py-3">Deal Ops number</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Consultant</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-black/10">
              {list.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm font-semibold text-black/60" colSpan={colSpan}>
                    No deals in this stage yet.
                  </td>
                </tr>
              ) : isRegistrations ? (
                list.map((d: any) => {
                  const dealRef = pickDealDeckId(d) || pickDealRef(d);
                  const dealHref = `/deal/${encodeURIComponent(d.id)}?from=registrations`;
                  const paid =
                    d?.registration_paid === true ||
                    d?.registrationPaid === true;

                  return (
                    <tr
                      key={d.id}
                      className={[
                        "hover:bg-black/[0.02]",
                        paid ? "bg-lime-200" : "bg-red-200",
                      ].join(" ")}
                    >
                      <td className="px-4 py-4">
                        <Link href={dealHref} className="text-sm font-extrabold text-black hover:underline">
                          {dealRef || d.deal_code || d.id || "-"}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-black">{pickApplicant(d)}</td>
                      <td className="px-4 py-4 text-sm font-extrabold text-black">{money(toAmount(d))}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-black">{d.consultant || "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={dealHref}
                            className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
                          >
                            View
                          </Link>
                          <MoveDealInline deal={d} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                list.map((d: any) => {
                  const dealRef = pickDealDeckId(d) || pickDealRef(d);
                  const fromParam =
                    stageKey === "instructed"
                      ? "?from=instructed"
                      : stageKey === "ntu"
                      ? "?from=ntu"
                      : "";
                  const dealHref = `/deal/${encodeURIComponent(d.id)}${fromParam}`;

                  return (
                    <tr key={d.id} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-4">
                        <Link href={dealHref} className="text-sm font-extrabold text-black hover:underline">
                          {dealRef || d.deal_code || d.id || "-"}
                        </Link>
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-black">{pickApplicant(d)}</td>

                      <td className="px-4 py-4 text-sm font-extrabold text-black">{money(toAmount(d))}</td>

                      <td className="px-4 py-4 text-sm font-semibold text-black">{d.consultant || "-"}</td>

                      <td className="px-4 py-4 text-sm font-semibold text-black">{d.agent_name || "-"}</td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={dealHref}
                            className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
                          >
                            View
                          </Link>
                          <MoveDealInline deal={d} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs font-semibold text-white/60">
        Route: <span className="font-extrabold text-white/80">{stageToRoute(stageKey)}</span>
      </div>
    </div>
  );
}





