"use client";

import React from "react";

function money(n: any) {
  const num = Number(n || 0);
  return `R ${Number.isFinite(num) ? num.toLocaleString("en-ZA") : "0"}`;
}

function val(...xs: any[]) {
  for (const x of xs) {
    const v = typeof x === "string" ? x.trim() : x;
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

function safeJson(x: any) {
  if (!x) return null;
  if (typeof x === "object") return x;
  if (typeof x === "string") {
    try { return JSON.parse(x); } catch { return null; }
  }
  return null;
}

function Row({ label, value }: { label: string; value: any }) {
  const v = val(value);
  if (!v) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 py-2 last:border-b-0">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-black/50">{label}</div>
      <div className="text-sm font-semibold text-black text-right">{String(v)}</div>
    </div>
  );
}

export default function AipNotesSummary({ deal }: { deal: any }) {
  // We support multiple shapes, but the main source is banks_source.aip.banks (set by API route above)
  const bs = safeJson(deal?.banks_source) || deal?.banks_source || {};
  const aip = bs?.aip || {};
  const banksArr =
    Array.isArray(aip?.banks) ? aip.banks :
    Array.isArray(deal?.aip_bank_details) ? deal.aip_bank_details :
    Array.isArray(deal?.aipBankDetails) ? deal.aipBankDetails :
    [];

  if (!banksArr || banksArr.length === 0) return null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-black">AIP summary</div>
          <div className="text-xs font-semibold text-black/60">
            Per-bank notes and details captured during AIP status.
          </div>
        </div>

        {aip?.updatedAt && (
          <div className="text-xs font-semibold text-black/50">
            Updated: <span className="font-extrabold text-black/70">{String(aip.updatedAt)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3">
        {banksArr.map((b: any, idx: number) => {
          const bankName = val(b?.bank_name, b?.bankName, b?.name, `Bank ${idx + 1}`);
          const status = val(b?.status);
          const reference = val(b?.reference);
          const amount = val(b?.amount);
          const rate = val(b?.rate);
          const term = val(b?.term);

          // Representative fields (you asked for these)
          const repName = val(b?.representative_name, b?.representativeName, b?.rep_name, b?.repName);
          const repContact = val(b?.representative_contact, b?.representativeContact, b?.rep_contact, b?.repContact);

          const note = val(b?.note);
          const notesHistory = Array.isArray(b?.notes) ? b.notes : [];

          return (
            <div key={String(b?.bank_id ?? b?.bankId ?? bankName ?? idx)} className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-black/80">{bankName}</div>
                {status && (
                  <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-extrabold text-black/70">
                    {status}
                  </div>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <Row label="Reference" value={reference} />
                  <Row label="Amount" value={amount ? money(amount) : ""} />
                  <Row label="Rate" value={rate} />
                  <Row label="Term" value={term} />
                  <Row label="Rep name" value={repName} />
                  <Row label="Rep contact" value={repContact} />
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-black/50">Notes</div>

                  {note ? (
                    <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-sm font-semibold text-black">
                      {note}
                    </div>
                  ) : null}

                  {notesHistory.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {notesHistory.slice(0, 5).map((n: any, i: number) => (
                        <div key={i} className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
                          <div className="text-[11px] font-extrabold text-black/50">
                            {val(n?.at, n?.date, n?.timestamp)}
                            {val(n?.by) ? `  ${val(n?.by)}` : ""}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-black">{val(n?.note, n?.text)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!note && notesHistory.length === 0 ? (
                    <div className="mt-2 text-sm font-semibold text-black/50">No notes captured for this bank yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
