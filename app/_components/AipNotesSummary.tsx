"use client";

import { useMemo, useState } from "react";

function asArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function normalizeString(v: any) {
  return String(v ?? "").trim();
}

function pickAipRows(deal: any) {
  // Try a bunch of common shapes so we don't "guess wrong"
  const candidates = [
    deal?.aipBankDetails,
    deal?.aip_bank_details,
    deal?.aip_bank_detail,
    deal?.aip_details,
    deal?.banks_source,          // sometimes stored as a json blob
    deal?.banksSource,
    deal?.banks_aip,
    deal?.aip_banks,
  ];

  for (const c of candidates) {
    const arr = asArray(c);
    if (arr.length) return arr;
  }

  // fallback: if deal.banks contains aip-like fields
  const banks = asArray(deal?.banks);
  if (banks.length) {
    const mapped = banks.map((b: any) => ({
      bank_id: b?.id ?? b?.bank_id ?? null,
      bank_name: b?.bank_name ?? b?.name ?? b?.bank ?? null,
      status: b?.status ?? b?.aip_status ?? null,
      reference: b?.reference ?? b?.aip_reference ?? null,
      amount: b?.amount ?? b?.aip_amount ?? null,
      rate: b?.rate ?? b?.aip_rate ?? null,
      term: b?.term ?? b?.aip_term ?? null,
      note: b?.note ?? b?.aip_note ?? null,
      notes: b?.notes ?? b?.aip_notes ?? null,
    }));

    // only return if at least one bank has any AIP content
    const has = mapped.some((r: any) =>
      normalizeString(r.status) ||
      normalizeString(r.reference) ||
      normalizeString(r.amount) ||
      normalizeString(r.rate) ||
      normalizeString(r.term) ||
      normalizeString(r.note) ||
      asArray(r.notes).length
    );

    if (has) return mapped;
  }

  return [];
}

function renderNoteValue(v: any) {
  // Note might be string, or array of {text, at}, or array of strings
  if (!v) return null;

  if (typeof v === "string") return v.trim() ? v : null;

  if (Array.isArray(v)) {
    const parts = v
      .map((x) => {
        if (!x) return null;
        if (typeof x === "string") return x.trim() ? x : null;
        const t = normalizeString(x.text ?? x.note ?? x.value ?? "");
        const at = normalizeString(x.at ?? x.created_at ?? x.createdAt ?? "");
        return t ? (at ? `${t} (${at})` : t) : null;
      })
      .filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }

  // object
  const t = normalizeString(v.text ?? v.note ?? v.value ?? "");
  const at = normalizeString(v.at ?? v.created_at ?? v.createdAt ?? "");
  if (!t) return null;
  return at ? `${t} (${at})` : t;
}

export default function AipNotesSummary({ deal }: { deal: any }) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const arr = pickAipRows(deal);
    return asArray(arr).map((r: any, idx: number) => {
      const bank_name = normalizeString(r.bank_name ?? r.bank ?? r.name ?? r.bankName ?? "");
      const bank_id = normalizeString(r.bank_id ?? r.id ?? "");
      const status = normalizeString(r.status ?? "");
      const reference = normalizeString(r.reference ?? r.ref ?? "");
      const amount = normalizeString(r.amount ?? r.loan_amount ?? "");
      const rate = normalizeString(r.rate ?? "");
      const term = normalizeString(r.term ?? "");
      const note = renderNoteValue(r.note ?? r.notes ?? r.bank_note ?? r.bankNote);

      const key = bank_id || bank_name || String(idx);
      return { key, bank_name, status, reference, amount, rate, term, note };
    });
  }, [deal]);

  const hasAnything = rows.some((r) =>
    r.bank_name || r.status || r.reference || r.amount || r.rate || r.term || r.note
  );

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-black">AIP Summary</div>
          <div className="text-xs font-semibold text-black/60">
            Notes and details captured per bank during the move to AIP.
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black hover:border-black/20"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <div className="mt-4">
          {!hasAnything ? (
            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm font-semibold text-black/60">
              No AIP notes/details saved yet for this deal.
            </div>
          ) : (
            <div className="grid gap-3">
              {rows.map((r) => (
                <div key={r.key} className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-black">{r.bank_name || "Bank"}</div>
                    {r.status ? (
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-black shadow-sm">
                        {r.status}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-extrabold text-black/60">Reference</div>
                      <div className="text-sm font-semibold text-black">{r.reference || "-"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-extrabold text-black/60">Amount</div>
                      <div className="text-sm font-semibold text-black">{r.amount || "-"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-extrabold text-black/60">Rate / Term</div>
                      <div className="text-sm font-semibold text-black">
                        {(r.rate || "-") + " / " + (r.term || "-")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-[11px] font-extrabold text-black/60">Bank note (timestamped)</div>
                    <pre className="mt-1 whitespace-pre-wrap rounded-2xl border border-black/10 bg-white p-3 text-sm font-semibold text-black">
                      {r.note || "-"}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}