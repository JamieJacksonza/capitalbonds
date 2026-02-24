"use client";

type AnyObj = Record<string, any>;

function val(...xs: any[]) {
  for (const x of xs) {
    if (x === undefined || x === null) continue;
    const s = String(x).trim();
    if (s !== "") return s;
  }
  return "";
}

function norm(s: string) {
  return String(s || "").trim().toLowerCase();
}

export default function AipSummary({ deal }: { deal: AnyObj }) {
  const banksRaw = Array.isArray(deal?.banks) ? deal.banks : [];

  const banks = (() => {
    const names = banksRaw
      .map((b: any) => val(b?.bank_name, b?.bankName, b?.name, b?.bank, b))
      .filter(Boolean);

    const out: string[] = [];
    const seen = new Set<string>();
    for (const n of names) {
      const k = norm(n);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    return out;
  })();

  const details = Array.isArray(deal?.aip_bank_details) ? deal.aip_bank_details : [];
  const hist = Array.isArray(deal?.aip_bank_notes_history) ? deal.aip_bank_notes_history : [];
  const aipNotes = Array.isArray(deal?.aip_notes_history) ? deal.aip_notes_history : [];

  const detailsByBank = new Map<string, AnyObj>();
  for (const d of details) {
    const bn = val(d?.bank_name, d?.bankName, d?.bank);
    if (!bn) continue;
    detailsByBank.set(norm(bn), d);
  }

  const banksToShow = banks.length
    ? banks
    : Array.from(detailsByBank.keys()).map((k) => detailsByBank.get(k)?.bank_name || k);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-extrabold text-black">AIP summary</div>
        <div className="text-xs font-semibold text-black/60">
          Bank-by-bank AIP details + notes (captured during move).
        </div>
      </div>

      {banksToShow.length === 0 && (
        <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm font-semibold text-black/70">
          No AIP bank details found on this deal yet.
        </div>
      )}

      {banksToShow.map((bankName: string) => {
        const d = detailsByBank.get(norm(bankName)) || {};
        const note = val(d?.note);
        const repName = val(d?.rep_name, d?.repName);
        const repContact = val(d?.rep_contact, d?.repContact);
        const status = val(d?.status);
        const reference = val(d?.reference);
        const amount = val(d?.amount);
        const rate = val(d?.rate);
        const term = val(d?.term);
        const updatedAt = val(d?.updated_at, d?.updatedAt);
        const updatedBy = val(d?.updated_by, d?.updatedBy);

        const bankHist = hist
          .filter((h: any) => norm(val(h?.bank_name, h?.bankName, h?.bank)) === norm(bankName))
          .slice()
          .reverse();

        return (
          <div key={bankName} className="mb-3 rounded-2xl border border-black/10 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-black">{bankName}</div>
              <div className="text-xs font-semibold text-black/50">
                {updatedAt ? `Updated: ${updatedAt}` : ""}
                {updatedBy ? `  By: ${updatedBy}` : ""}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-[11px] font-extrabold text-black/60">Status</div>
                <div className="text-sm font-semibold text-black">{status || "-"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-[11px] font-extrabold text-black/60">Reference</div>
                <div className="text-sm font-semibold text-black">{reference || "-"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-[11px] font-extrabold text-black/60">Amount</div>
                <div className="text-sm font-semibold text-black">{amount || "-"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-[11px] font-extrabold text-black/60">Rate</div>
                <div className="text-sm font-semibold text-black">{rate || "-"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-[11px] font-extrabold text-black/60">Term</div>
                <div className="text-sm font-semibold text-black">{term || "-"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-[11px] font-extrabold text-black/60">Bank rep</div>
                <div className="text-sm font-semibold text-black">{repName || "-"}</div>
                <div className="text-xs font-semibold text-black/60">{repContact || ""}</div>
              </div>
            </div>

            <div className="mt-2 rounded-2xl border border-black/10 p-2">
              <div className="text-[11px] font-extrabold text-black/60">Latest bank note</div>
              <div className="text-sm font-semibold text-black">{note || "-"}</div>
            </div>

            {bankHist.length > 0 && (
              <div className="mt-2 rounded-2xl border border-black/10 p-2">
                <div className="mb-1 text-[11px] font-extrabold text-black/60">Bank note history</div>
                <div className="grid gap-2">
                  {bankHist.slice(0, 5).map((h: any, i: number) => (
                    <div key={i} className="rounded-2xl border border-black/10 p-2">
                      <div className="text-xs font-semibold text-black/60">
                        {val(h?.at)} {val(h?.by) ? `  ${val(h?.by)}` : ""}
                      </div>
                      <div className="text-sm font-semibold text-black">{val(h?.note) || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {aipNotes.length > 0 && (
        <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
          <div className="mb-1 text-sm font-extrabold text-black">General AIP notes</div>
          <div className="grid gap-2">
            {aipNotes
              .slice()
              .reverse()
              .slice(0, 5)
              .map((n: any, i: number) => (
                <div key={i} className="rounded-2xl border border-black/10 p-2">
                  <div className="text-xs font-semibold text-black/60">
                    {val(n?.at)} {val(n?.by) ? `  ${val(n?.by)}` : ""}
                  </div>
                  <div className="text-sm font-semibold text-black">{val(n?.note) || "-"}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}