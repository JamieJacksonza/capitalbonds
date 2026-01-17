"use client";

type AnyObj = Record<string, any>;

const STAGE_ORDER = [
  { key: "submitted", title: "Submitted", prefixes: ["submitted_"] },
  { key: "aip", title: "AIP", prefixes: ["aip_"] },
  { key: "instructed", title: "Instructed", prefixes: ["instructed_"] },
  { key: "granted", title: "Granted", prefixes: ["granted_"] },
  { key: "registrations", title: "Registrations", prefixes: ["registration_", "registrations_"] },
  { key: "ntu", title: "NTU", prefixes: ["ntu_"] },
];

function prettyKey(k: string) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bDob\b/g, "DOB");
}

function isEmpty(v: any) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function fmt(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function movedAtForStage(activity: any[] | undefined, stageKey: string) {
  const list = Array.isArray(activity) ? activity : [];
  const hit = [...list].reverse().find((a) => String(a?.to_stage || "") === stageKey);
  const d = hit?.moved_at || hit?.created_at;
  return d ? String(d).slice(0, 19).replace("T", " ") : "";
}

export default function StageInputsByStage({
  deal,
  activity,
}: {
  deal?: AnyObj | null;
  activity?: any[] | null;
}) {
  if (!deal) return null;

  const entries = Object.entries(deal || {});
  const ignore = new Set([
    "id","deal_code","stage","created_at","updated_at",
    "deal_activity","deal_banks","banks",
  ]);

  const stageBlocks = STAGE_ORDER.map((s) => {
    // explicit registration fields even if no prefix match
    const extraKeys =
      s.key === "registrations"
        ? ["registration_number","registration_attorney","registration_attorney_tel","registration_attorney_email","registration_attorney_reference","payment_due_date","agent_comm_paid"]
        : [];

    const rows = entries
      .filter(([k, v]) => {
        if (ignore.has(k)) return false;
        if (isEmpty(v)) return false;

        const pref = s.prefixes.some((p) => k.startsWith(p));
        const explicit = extraKeys.includes(k);
        return pref || explicit;
      })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ k, v }));

    return { ...s, rows };
  });

  const hasAny = stageBlocks.some((b) => b.rows.length > 0);
  if (!hasAny) return null;

  return (
    <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">Stage inputs</div>
        <div className="text-[11px] font-medium text-zinc-500">Grouped automatically</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {stageBlocks.map((b) => {
          const moved = movedAtForStage(activity ?? undefined, b.key);
          return (
            <div key={b.key} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-900">{b.title}</div>
                <div className="text-[11px] font-medium text-zinc-500">{moved ? `Captured: ${moved}` : ""}</div>
              </div>

              {b.rows.length === 0 ? (
                <div className="mt-2 text-[11px] text-zinc-500">No captured inputs for this stage yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {b.rows.map((r) => (
                    <div key={r.k} className="flex items-start justify-between gap-4">
                      <div className="text-[11px] font-medium text-zinc-500">{prettyKey(r.k)}</div>
                      <div className="text-xs font-semibold text-zinc-900 text-right whitespace-pre-wrap">{fmt(r.v)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
