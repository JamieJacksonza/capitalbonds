"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useDeals } from "../../_components/useDeals";
import { useParams, useSearchParams, useRouter } from "next/navigation";

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyZar(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n || 0)));
}

function dealAmount(d: any) {
  return toNumber(d?.amount_zar ?? d?.amount ?? 0);
}

function pickAttorneyOrFirm(d: any): string {
  const reg = String(d?.registration_attorney ?? "").trim();
  if (reg) return reg;

  const top = String(d?.attorney ?? "").trim();
  if (top) return top;

  const banks = Array.isArray(d?.banks) ? d.banks : [];
  for (const b of banks) {
    const a = String(b?.attorney ?? "").trim();
    if (a) return a;
  }

  return "Unassigned";
}

function dealDate(d: any): Date | null {
  const sd = String(d?.submitted_date ?? d?.submittedDate ?? "").trim();
  if (sd) return new Date(`${sd}T12:00:00`);
  const ca = String(d?.created_at ?? d?.createdAt ?? "").trim();
  if (ca) return new Date(ca);
  return null;
}

function inRange(dt: Date | null, from: string, to: string) {
  if (!dt) return true;
  const fromDt = from ? new Date(`${from}T00:00:00`) : null;
  const toDt = to ? new Date(`${to}T23:59:59`) : null;
  if (fromDt && dt < fromDt) return false;
  if (toDt && dt > toDt) return false;
  return true;
}

export default function AttorneyPage() {
  const { deals, loading, error } = useDeals();
  const params = useParams<{ name: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const attorneyName = decodeURIComponent(String(params?.name ?? ""));

  const [from, setFrom] = useState<string>(search.get("from") ?? "");
  const [to, setTo] = useState<string>(search.get("to") ?? "");

  useEffect(() => {
    setFrom(search.get("from") ?? "");
    setTo(search.get("to") ?? "");
  }, [search]);

  const filtered = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    return list
      .filter((d: any) => pickAttorneyOrFirm(d) === attorneyName)
      .filter((d: any) => inRange(dealDate(d), from, to));
  }, [deals, attorneyName, from, to]);

  const total = useMemo(() => filtered.reduce((s, d: any) => s + dealAmount(d), 0), [filtered]);

  function applyFilter() {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    router.push(q ? `/attorney/${encodeURIComponent(attorneyName)}?${q}` : `/attorney/${encodeURIComponent(attorneyName)}`);
  }

  function clearFilter() {
    setFrom("");
    setTo("");
    router.push(`/attorney/${encodeURIComponent(attorneyName)}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-7 py-10 md:px-12 lg:px-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-extrabold text-black">Attorney / Firm: {attorneyName}</div>
          <div className="mt-1 text-sm font-semibold text-black/60">
            {filtered.length} deal(s)  Total {moneyZar(total)}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-black/60">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-2 rounded-xl border border-black/10 px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
            />
          </label>
          <label className="text-xs font-bold text-black/60">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-2 rounded-xl border border-black/10 px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
            />
          </label>

          <button
            onClick={applyFilter}
            className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
          >
            Apply
          </button>
          <button
            onClick={clearFilter}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:bg-black/[0.03]"
          >
            Clear
          </button>

          <Link
            href="/"
            className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:bg-black/[0.03]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
        {loading ? (
          <div className="p-6 text-sm font-semibold text-black/60">Loading...</div>
        ) : error ? (
          <div className="p-6 text-sm font-semibold text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm font-semibold text-black/60">No deals for this attorney/firm in this range.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02]">
              <tr className="text-xs font-extrabold text-black">
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => (
                <tr key={d.id} className="border-t border-black/10 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-extrabold">{d.deal_code ?? d.id}</td>
                  <td className="px-4 py-3">{d.applicant ?? ""}</td>
                  <td className="px-4 py-3 font-semibold">{String(d.stage ?? "").toUpperCase()}</td>
                  <td className="px-4 py-3">{d.bank ?? ""}</td>
                  <td className="px-4 py-3">{d.submitted_date ?? ""}</td>
                  <td className="px-4 py-3 text-right font-extrabold">{moneyZar(dealAmount(d))}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/deal/${encodeURIComponent(String(d.id))}`}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black hover:bg-black/[0.03]"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}