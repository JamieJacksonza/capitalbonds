"use client";

type ActivityItem = {
  id?: string | null;
  action?: string | null;
  from_stage?: string | null;
  to_stage?: string | null;
  note?: string | null;
  moved_by?: string | null;
  actor?: string | null;
  moved_at?: string | null;
  created_at?: string | null;
};

type BankRow = {
  id?: string | null;
  bank_name?: string | null;
  bank_notes?: string | null;
  attorney?: string | null;
  attorney_note?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type DealLike = {
  stage?: string | null;

  registration_number?: string | null;
  registration_attorney?: string | null;
  registration_attorney_tel?: string | null;
  payment_due_date?: string | null;
  agent_comm_paid?: boolean | null;

  deal_banks?: BankRow[] | null;
};

const ORDER = ["submitted", "aip", "instructed", "granted", "registrations", "ntu"] as const;

function titleCase(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stageTitle(s: string) {
  if (s === "aip") return "AIP";
  if (s === "ntu") return "NTU";
  if (s === "registrations") return "Registrations";
  return titleCase(s);
}

function fmt(iso?: string | null) {
  const v = String(iso || "").trim();
  if (!v) return "";
  return v.replace("T", " ").slice(0, 19);
}

function normStage(v: any) {
  return String(v || "").trim().toLowerCase();
}

function Row({ label, value }: { label: string; value: any }) {
  const v = value === null || value === undefined || value === "" ? "" : String(value);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-[11px] font-extrabold text-black/60">{label}</div>
      <div className="text-xs font-extrabold text-black text-right whitespace-pre-wrap">{v}</div>
    </div>
  );
}

export default function StageNotesCards({
  deal,
  activity,
  loading,
}: {
  deal?: DealLike | null;
  activity?: ActivityItem[];
  loading?: boolean;
}) {
  if (!deal) return null;

  const items = Array.isArray(activity) ? activity : [];
  const banks = Array.isArray(deal.deal_banks) ? deal.deal_banks : [];

  const byStage: Record<string, ActivityItem[]> = {};
  for (const s of ORDER) byStage[s] = [];

  for (const a of items) {
    const toS = normStage(a?.to_stage);
    const fromS = normStage(a?.from_stage);

    // Primary grouping: to_stage
    if (toS && byStage[toS]) byStage[toS].push(a);
    else if (fromS && byStage[fromS]) byStage[fromS].push(a);
    // else: drop it (unknown stage)
  }

  // Sort newest-first inside each stage card
  for (const s of ORDER) {
    byStage[s] = byStage[s].slice().sort((x, y) => {
      const ax = String(x?.moved_at || x?.created_at || "");
      const ay = String(y?.moved_at || y?.created_at || "");
      return ay.localeCompare(ax);
    });
  }

  const hasRegistrationFields =
    !!deal.registration_number ||
    !!deal.registration_attorney ||
    !!deal.registration_attorney_tel ||
    !!deal.payment_due_date ||
    deal.agent_comm_paid === true ||
    deal.agent_comm_paid === false;

  const hasAnyBankNotes = banks.some((b) => {
    const n = String(b?.bank_notes || "").trim();
    const at = String(b?.attorney || "").trim();
    const an = String(b?.attorney_note || "").trim();
    return !!n || !!at || !!an;
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-black">Status notes</div>
          <div className="text-xs font-semibold text-black/50">
            {loading ? "Loading" : `${items.length} activity items`}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {ORDER.map((s) => {
            const list = byStage[s] || [];
            const isRegs = s === "registrations";

            const showRegsExtras = isRegs && (hasRegistrationFields || hasAnyBankNotes);

            return (
              <div key={s} className="rounded-2xl border border-black/10 bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
                  <div className="text-sm font-extrabold text-black">{stageTitle(s)}</div>
                  <div className="text-xs font-semibold text-black/50">{list.length} item(s)</div>
                </div>

                <div className="p-4 space-y-3">
                  {showRegsExtras ? (
                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                      <div className="text-xs font-extrabold text-black">Captured fields</div>
                      <div className="mt-3 space-y-2">
                        <Row label="Registration number" value={deal.registration_number} />
                        <Row label="Registration attorney" value={deal.registration_attorney} />
                        <Row label="Attorney contact" value={deal.registration_attorney_tel} />
                        <Row label="Payment date" value={deal.payment_due_date} />
                        <Row
                          label="Commission paid"
                          value={deal.agent_comm_paid === true ? "Yes" : deal.agent_comm_paid === false ? "No" : ""}
                        />
                      </div>

                      {hasAnyBankNotes ? (
                        <div className="mt-4">
                          <div className="text-xs font-extrabold text-black">Bank notes</div>
                          <div className="mt-3 space-y-3">
                            {banks.map((b) => {
                              const any = String(b?.bank_notes || "").trim() || String(b?.attorney || "").trim() || String(b?.attorney_note || "").trim();
                              if (!any) return null;

                              return (
                                <div key={String(b?.id || Math.random())} className="rounded-2xl border border-black/10 bg-white p-3">
                                  <div className="text-xs font-extrabold text-black">{b.bank_name || "Bank"}</div>

                                  {b.bank_notes ? (
                                    <div className="mt-2 text-xs font-semibold text-black/80 whitespace-pre-wrap">{b.bank_notes}</div>
                                  ) : (
                                    <div className="mt-2 text-[11px] font-semibold text-black/40">No bank notes.</div>
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

                                  {(b.updated_at || b.created_at) ? (
                                    <div className="mt-2 text-[11px] font-semibold text-black/40">
                                      Updated: {fmt(b.updated_at || b.created_at)}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="h-16 rounded-xl bg-zinc-100" />
                  ) : list.length === 0 ? (
                    <div className="text-sm font-semibold text-black/40">No activity recorded for this status yet.</div>
                  ) : (
                    list.map((a, idx) => {
                      const who = String(a?.actor || a?.moved_by || "system");
                      const fromS = String(a?.from_stage || "").trim();
                      const toS = String(a?.to_stage || "").trim();
                      const when = fmt(a?.moved_at || a?.created_at);
                      const note = String(a?.note || "").trim();

                      return (
                        <div key={String(a?.id || idx)} className="rounded-2xl border border-black/10 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-extrabold text-black">
                              {who}
                              {(fromS || toS) ? (
                                <span className="text-black/50 font-semibold">
                                  {" "}
                                  {fromS && toS ? `${fromS}  ${toS}` : (toS || fromS)}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs font-semibold text-black/50">{when}</div>
                          </div>

                          {note ? (
                            <div className="mt-2 text-sm font-semibold text-black/80 whitespace-pre-wrap">{note}</div>
                          ) : (
                            <div className="mt-2 text-[11px] font-semibold text-black/35">No note captured on this move.</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
