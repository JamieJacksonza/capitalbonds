"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { stageMeta, stageMoves } from "../../lib/deals";
import type { Stage } from "../../lib/deals";
import { useDeals } from "../../_components/useDeals";

const money = (n: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(n);

export default function DealPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params?.id || ""));
  const { getDeal, moveDeal } = useDeals();

  const deal = getDeal(id);

  if (!deal) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Deal not found</h1>
        <p className="text-sm text-black/80">
          This deal doesnt exist in local demo storage. Hit Reset demo data on any stage page.
        </p>
        <Link
          href="/submitted"
          className="inline-flex rounded-xl bg-black px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
        >
          Back to Submitted
        </Link>
      </div>
    );
  }

  const stage = deal.stage as Stage;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={stageMeta[stage].path}
            className="text-sm font-extrabold text-black/80 hover:text-black"
          >
             Back to {stageMeta[stage].title}
          </Link>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{deal.id}</h1>

          <p className="mt-2 text-sm text-black/80">
            {deal.applicant}  {deal.bank}  {money(deal.amount)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {stageMoves[stage].map((m) => (
            <button
              key={m.next}
              onClick={() => moveDeal(deal.id, m.next)}
              className="rounded-xl bg-black px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs font-bold text-black/80">Stage</div>
          <div className="mt-2 text-2xl font-extrabold">{stageMeta[stage].title}</div>
          <div className="mt-2 text-sm text-black/80">{stageMeta[stage].description}</div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-xs font-bold text-black/80">Submitted</div>
          <div className="mt-2 text-2xl font-extrabold">{deal.submitted}</div>

          <div className="mt-3 text-xs font-bold text-black/80">Status</div>
          <div className="mt-2 text-sm font-extrabold">{deal.status}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold">Notes</h2>
        <p className="mt-2 text-sm text-black/80">
          {deal.notes ? deal.notes : "No notes yet."}
        </p>
      </section>
    </div>
  );
}

