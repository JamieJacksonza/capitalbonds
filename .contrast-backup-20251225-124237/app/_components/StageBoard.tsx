"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Stage, Deal } from "../lib/deals";
import { stageMeta, STAGES } from "../lib/deals";
import { useDeals } from "./useDeals";
import DealsTable from "./DealsTable";

type SortKey =
  | "submitted_desc"
  | "submitted_asc"
  | "amount_desc"
  | "amount_asc"
  | "applicant_asc"
  | "bank_asc"
  | "id_asc";

function sortDeals(items: Deal[], sort: SortKey) {
  const copy = [...items];

  const byDate = (a: Deal, b: Deal) => a.submitted.localeCompare(b.submitted);
  const byAmount = (a: Deal, b: Deal) => a.amount - b.amount;
  const byApplicant = (a: Deal, b: Deal) => a.applicant.localeCompare(b.applicant);
  const byBank = (a: Deal, b: Deal) => a.bank.localeCompare(b.bank);
  const byId = (a: Deal, b: Deal) => a.id.localeCompare(b.id);

  switch (sort) {
    case "submitted_desc":
      return copy.sort((a, b) => byDate(b, a));
    case "submitted_asc":
      return copy.sort(byDate);
    case "amount_desc":
      return copy.sort((a, b) => byAmount(b, a));
    case "amount_asc":
      return copy.sort(byAmount);
    case "applicant_asc":
      return copy.sort(byApplicant);
    case "bank_asc":
      return copy.sort(byBank);
    case "id_asc":
      return copy.sort(byId);
    default:
      return copy;
  }
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

export default function StageBoard({ stage }: { stage: Stage }) {
  const { byStage, moveDeal, reset, counts, deals } = useDeals();

  const [q, setQ] = useState("");
  const [bank, setBank] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("submitted_desc");
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);

  const list = byStage(stage);
  const meta = stageMeta[stage];

  const bankOptions = useMemo(() => {
    // options from THIS stage’s list so the dropdown stays relevant
    return uniq(list.map((d) => d.bank));
  }, [list]);

  const statusOptions = useMemo(() => {
    return uniq(list.map((d) => d.status));
  }, [list]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter((d) => {
      const matchesText =
        !t ||
        d.id.toLowerCase().includes(t) ||
        d.applicant.toLowerCase().includes(t) ||
        d.bank.toLowerCase().includes(t);

      const matchesBank = bank === "all" ? true : d.bank === bank;
      const matchesStatus = status === "all" ? true : d.status === status;

      return matchesText && matchesBank && matchesStatus;
    });
  }, [q, list, bank, status]);

  const sorted = useMemo(() => sortDeals(filtered, sort), [filtered, sort]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [q, bank, status, sort, pageSize, stage]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = sorted.slice(startIdx, endIdx);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  const hasActiveFilters = q.trim() || bank !== "all" || status !== "all" || sort !== "submitted_desc" || pageSize !== 15;

  function clearFilters() {
    setQ("");
    setBank("all");
    setStatus("all");
    setSort("submitted_desc");
    setPageSize(15);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-black">{meta.title}</h1>
          <p className="mt-2 text-sm text-black/80">{meta.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {stage === "submitted" ? (
              <Link
                href="/submitted/new"
                className="rounded-xl bg-black px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
              >
                New submission
              </Link>
            ) : null}

            <button
              onClick={reset}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/80 hover:bg-black/[0.03]"
              title="Resets local demo data"
            >
              Reset demo data
            </button>

            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-extrabold text-black/80 hover:bg-black/[0.06]"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Quick nav pills */}
        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          {STAGES.map((s) => {
            const active = s === stage;
            return (
              <Link
                key={s}
                href={stageMeta[s].path}
                className={[
                  "rounded-full border px-3 py-2 text-xs font-extrabold",
                  active
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/70 hover:bg-black/[0.03]",
                ].join(" ")}
              >
                {stageMeta[s].title}{" "}
                <span className={active ? "text-white/80" : "text-black/70"}>
                  {counts[s] || 0}
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-black/80">Total deals</div>
          <div className="mt-2 text-3xl font-extrabold text-black">{deals.length}</div>
        </div>

        {STAGES.map((s) => (
          <div key={s} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold text-black/80">{stageMeta[s].title}</div>
            <div className="mt-2 text-3xl font-extrabold text-black">{counts[s] || 0}</div>
          </div>
        ))}
      </section>

      {/* Controls + table */}
      <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Queue</h2>
            <p className="mt-1 text-sm text-black/80">
              Local demo data (browser storage). Next we’ll wire it to Google Sheets.
            </p>
          </div>

          <div className="text-xs font-bold text-black/80">
            Showing <span className="text-black">{total === 0 ? 0 : startIdx + 1}-{endIdx}</span> of{" "}
            <span className="text-black">{total}</span>
          </div>
        </div>

        {/* Filters row */}
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="mb-2 text-xs font-extrabold text-black/80">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by ID, applicant, bank..."
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black/30"
            />
          </div>

          <div>
            <div className="mb-2 text-xs font-extrabold text-black/80">Bank</div>
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black/30"
            >
              <option value="all">All banks</option>
              {bankOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-xs font-extrabold text-black/80">Status</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black/30"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-xs font-extrabold text-black/80">Sort</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black/30"
            >
              <option value="submitted_desc">Submitted: newest</option>
              <option value="submitted_asc">Submitted: oldest</option>
              <option value="amount_desc">Amount: high → low</option>
              <option value="amount_asc">Amount: low → high</option>
              <option value="applicant_asc">Applicant: A → Z</option>
              <option value="bank_asc">Bank: A → Z</option>
              <option value="id_asc">Deal ID: A → Z</option>
            </select>
          </div>
        </div>

        {/* Page size + pagination */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-black/80">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/80 outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>

            {hasActiveFilters ? (
              <span className="text-xs font-bold text-black/80">
                Filters active
              </span>
            ) : (
              <span className="text-xs font-bold text-black/80">
                Default view
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={[
                "rounded-xl border px-3 py-2 text-xs font-extrabold",
                canPrev
                  ? "border-black/10 bg-white text-black/80 hover:bg-black/[0.03]"
                  : "border-black/10 bg-white text-black/60",
              ].join(" ")}
            >
              Prev
            </button>

            <div className="text-xs font-extrabold text-black/80">
              Page <span className="text-black">{safePage}</span> / {totalPages}
            </div>

            <button
              disabled={!canNext}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={[
                "rounded-xl border px-3 py-2 text-xs font-extrabold",
                canNext
                  ? "border-black/10 bg-white text-black/80 hover:bg-black/[0.03]"
                  : "border-black/10 bg-white text-black/60",
              ].join(" ")}
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-4">
          <DealsTable stage={stage} deals={pageItems} onMove={moveDeal} />
        </div>
      </section>
    </div>
  );
}




