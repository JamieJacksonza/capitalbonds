"use client";

type BankRow = {
  id?: string | null;
  bank_name?: string | null;
  bank_notes?: string | null;
  attorney?: string | null;
  attorney_note?: string | null;
  updated_at?: string | null;
};

export default function BankNotesSummary({ banks }: { banks?: BankRow[] }) {
  const list = Array.isArray(banks) ? banks : [];
  if (list.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="text-sm font-extrabold text-black">Bank details + notes</div>
      <div className="mt-3 space-y-3">
        {list.map((b) => (
          <div key={String(b.id || Math.random())} className="rounded-2xl border border-black/10 p-3">
            <div className="text-xs font-extrabold text-black">{b.bank_name || "Bank"}</div>

            {b.bank_notes ? (
              <div className="mt-2 text-xs font-semibold text-black/80 whitespace-pre-wrap">{b.bank_notes}</div>
            ) : (
              <div className="mt-2 text-[11px] font-semibold text-black/40">No bank notes yet.</div>
            )}

            {(b.attorney || b.attorney_note) ? (
              <div className="mt-3 rounded-2xl bg-black/[0.03] p-3">
                <div className="text-[11px] font-extrabold text-black/70">Attorney</div>
                {b.attorney ? (
                  <div className="mt-1 text-xs font-semibold text-black">{b.attorney}</div>
                ) : (
                  <div className="mt-1 text-[11px] font-semibold text-black/40">No attorney captured.</div>
                )}

                {b.attorney_note ? (
                  <div className="mt-2 text-xs font-semibold text-black/80 whitespace-pre-wrap">{b.attorney_note}</div>
                ) : null}
              </div>
            ) : null}

            {b.updated_at ? (
              <div className="mt-2 text-[11px] font-semibold text-black/40">Updated: {String(b.updated_at).slice(0, 19)}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
