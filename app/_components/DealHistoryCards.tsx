import React from "react";

type AnyRec = Record<string, any>;

function asArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function stageLabel(s: any) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  return v
    .split(/[\s_-]+/)
    .map((w) => w ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : "")
    .join(" ");
}

function fmtDate(v: any) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function DealHistoryCards({ deal }: { deal: AnyRec }) {
  const moveHistory = asArray(deal?.move_history ?? deal?.moveHistory);
  const notesHistory = asArray(deal?.notes_history ?? deal?.notesHistory);

  const lastMovedAt = deal?.last_moved_at ?? deal?.lastMovedAt;
  const lastMovedBy = deal?.last_moved_by ?? deal?.lastMovedBy ?? deal?.last_moved_user;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-extrabold text-black">Move history</div>
          {lastMovedAt ? (
            <div className="text-xs font-semibold text-black/50">
              Last moved:{" "}
              <span className="font-extrabold text-black">{fmtDate(lastMovedAt)}</span>
              {lastMovedBy ? (
                <>
                  {" "}
                  <span className="text-black/40"></span>{" "}
                  <span className="font-semibold text-black/50">
                    by <span className="font-extrabold text-black">{String(lastMovedBy)}</span>
                  </span>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-xs font-semibold text-black/40">No moves recorded yet</div>
          )}
        </div>

        {moveHistory.length === 0 ? (
          <div className="mt-3 text-sm font-semibold text-black/60">
            No move history yet. Move a deal to start tracking.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {moveHistory
              .slice()
              .reverse()
              .map((m, idx) => {
                const at = m.at ?? m.date ?? m.created_at ?? m.ts;
                const by = m.by ?? m.movedBy ?? m.user ?? m.name;
                const from = m.from ?? m.fromStage ?? m.prev ?? m.previous;
                const to = m.to ?? m.toStage ?? m.next ?? m.stage;
                const note = m.note ?? m.notes;

                return (
                  <div key={idx} className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-black">{fmtDate(at)}</div>
                      {by ? (
                        <div className="text-xs font-semibold text-black/60">
                          by <span className="font-extrabold text-black">{String(by)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-1 text-sm font-extrabold text-black">
                      {stageLabel(from) || "?"} <span className="text-black/40"></span>{" "}
                      {stageLabel(to) || "?"}
                    </div>

                    {note ? (
                      <div className="mt-1 text-sm font-semibold text-black/70">{String(note)}</div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-extrabold text-black">Notes history</div>
          {deal?.updated_at ? (
            <div className="text-xs font-semibold text-black/50">
              Last updated:{" "}
              <span className="font-extrabold text-black">{fmtDate(deal.updated_at)}</span>
            </div>
          ) : null}
        </div>

        {notesHistory.length === 0 ? (
          <div className="mt-3 text-sm font-semibold text-black/60">
            No dated notes yet. When you move a deal and add a note, itll show here.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {notesHistory
              .slice()
              .reverse()
              .map((n, idx) => {
                const at = n.at ?? n.date ?? n.created_at ?? n.ts;
                const by = n.by ?? n.movedBy ?? n.user ?? n.name;
                const stage = n.stage ?? n.to ?? n.toStage ?? deal?.stage;
                const note = n.note ?? n.notes ?? n.text;

                return (
                  <div key={idx} className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-black">{fmtDate(at)}</div>
                      {stage ? (
                        <div className="text-xs font-semibold text-black/60">
                          stage{" "}
                          <span className="font-extrabold text-black">{stageLabel(stage)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-1 text-sm font-semibold text-black">{String(note || "")}</div>

                    {by ? (
                      <div className="mt-1 text-xs font-semibold text-black/50">
                        by <span className="font-extrabold text-black">{String(by)}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}