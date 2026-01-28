"use client";

import { useEffect, useMemo, useState } from "react";
import MoveStageCards from "./MoveStageCards";

function normalizeStage(s: any) {
  const v = String(s ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "arp") return "aip";
  if (v === "instructions" || v === "instruct") return "instructed";
  if (v === "registration" || v === "regs" || v === "reg") return "registrations";
  if (v === "grant" || v === "approved") return "granted";
  return v;
}

function stageToRoute(stage: any) {
  const s = normalizeStage(stage) || "submitted";
  return "/" + encodeURIComponent(s);
}

type BankRow = { key: string; bank_id: any; bank_name: string };

type AipBankForm = {
  status?: string;
  reference?: string;
  amount?: string;
  rate?: string;
  term?: string;
  representative_name?: string;
  representative_contact?: string;
  note?: string;
};

type InstructedForm = {
  attorney_firm?: string;
  attorney_name?: string;
  attorney_email?: string;
  attorney_tel?: string;
  attorney_ref?: string;
  notes?: string;
};

function safeJsonParse(v: any) {
  try {
    if (typeof v === "string") return JSON.parse(v);
  } catch {}
  return null;
}

function extractBanksFromDeal(d: any): any[] {
  const candidates = [
    d?.banks,
    d?.deal_banks,
    d?.dealBanks,
    d?.banks_source,
    d?.banksSource,
    d?.selected_banks,
    d?.selectedBanks,
    d?.banks_list,
    d?.banksList,
    d?.bank_notes,
    d?.bankNotes,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;

    const parsed = safeJsonParse(c);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray((parsed as any).data)) return (parsed as any).data;

    if (c && typeof c === "object" && Array.isArray((c as any).data)) return (c as any).data;
  }

  return [];
}

function looksLikeUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function looksLikeDealCode(s: string) {
  // common patterns: SB-3A310E, CB-XXXX, etc.
  return /^[A-Z]{1,6}-[A-Z0-9]{4,}$/i.test(s);
}
function extractDealKey(obj: any): string {
  if (!obj || typeof obj !== "object") return "";

  const directKeys = [
    "id",
    "deal_code",
    "dealCode",
    "deal_id",
    "dealId",
    "deal_ref",
    "dealRef",
    "deal_reference",
    "dealReference",
    "code",
    "ref",
    "reference",
  ];

  for (const k of directKeys) {
    const v = (obj as any)?.[k];
    if (v === 0) return "0";
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }

  // scan string values for something that looks like a UUID or code
  for (const v of Object.values(obj)) {
    if (typeof v === "string") {
      const s = v.trim();
      if (s && (looksLikeUuid(s) || looksLikeDealCode(s))) return s;
    }
  }

  return "";
}

export default function MoveDealModal(props: { open: boolean; onClose: () => void; deal: any }) {
  const { open, onClose, deal } = props;

  const [fullDeal, setFullDeal] = useState<any>(null);
  const d = fullDeal || deal;

  const [nextStage, setNextStage] = useState("aip");
  const [movedBy, setMovedBy] = useState("");
  const [stageNotes, setStageNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [showStagePrompt, setShowStagePrompt] = useState(false);
  const [stageConfirmed, setStageConfirmed] = useState(false);
  
  const [stageData, setStageData] = useState<any>({});
const [err, setErr] = useState<string | null>(null);

  const [aipBanks, setAipBanks] = useState<Record<string, AipBankForm>>({});
  const [instr, setInstr] = useState<InstructedForm>({
    attorney_firm: "",
    attorney_name: "",
    attorney_email: "",
    attorney_tel: "",
    attorney_ref: "",
    notes: "",
  });

  const currentStage = normalizeStage(d?.stage);
  const target = extractDealKey(d) || extractDealKey(deal);
  const nextStageOptions = useMemo(() => {
    if (currentStage === "instructed") return ["ntu", "registrations"];
    if (currentStage === "submitted") return ["aip", "ntu"];
    if (currentStage === "aip") return ["granted", "ntu"];
    if (currentStage === "granted") return ["instructed", "ntu"];
    return ["submitted", "aip", "instructed", "granted", "ntu", "registrations"];
  }, [currentStage]);
  useEffect(() => {
    if (!open) return;

    setErr(null);
    setBusy(false);

    try {
      const v =
        (typeof window !== "undefined" &&
          (localStorage.getItem("cb_user") || localStorage.getItem("user") || localStorage.getItem("name"))) ||
        "";
      setMovedBy(String(v || movedBy || ""));
    } catch {}

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const name = String(json?.user?.name || "").trim();
        if (name) {
          try {
            localStorage.setItem("cb_user", name);
          } catch {}
          setMovedBy(name);
        }
      } catch {}
    })();

    {
      const cur = normalizeStage(deal?.stage);
      setNextStage(cur === "instructed" ? "ntu" : (cur || "aip"));
    }
    setStageNotes("");
    setStageConfirmed(false);
    setAipBanks({});
    setInstr({
      attorney_firm: "",
      attorney_name: "",
      attorney_email: "",
      attorney_tel: "",
      attorney_ref: "",
      notes: "",
    });

    (async () => {
      try {
        const key = extractDealKey(deal) || extractDealKey(d);
        if (!key) {
          setFullDeal(null);
          return;
        }

        const res = await fetch(`/api/deals/${encodeURIComponent(key)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        const got =
          json?.deal ??
          json?.data ??
          (json?.ok === true ? json?.deal : null) ??
          (Array.isArray(json) ? json[0] : null) ??
          null;

        if (got && typeof got === "object") setFullDeal(got);
        else setFullDeal(null);
      } catch {
        setFullDeal(null);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deal?.id, deal?.deal_code]);

  const banks: BankRow[] = useMemo(() => {
    const arr = extractBanksFromDeal(d);

    return arr.map((b: any, idx: number) => {
      const bank_id = b?.id ?? b?.bank_id ?? b?.bankId ?? null;
      const bank_name = b?.bank_name ?? b?.bankName ?? b?.name ?? b?.bank ?? String(bank_id ?? `Bank ${idx + 1}`);
      const key = String(bank_id ?? bank_name ?? idx);
      return { key, bank_id, bank_name };
    });
  }, [d]);

  async function resolveMovedBy(defaultName: string) {
    const local = String(defaultName || "").trim();
    if (local && local !== "System") return local;
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const name = String(json?.user?.name || "").trim();
      if (name) {
        try {
          localStorage.setItem("cb_user", name);
        } catch {}
        return name;
      }
    } catch {}
    return local || "System";
  }

  function setAipField(bankKey: string, field: keyof AipBankForm, value: string) {
    setAipBanks((prev) => ({
      ...prev,
      [bankKey]: { ...(prev[bankKey] || {}), [field]: value },
    }));
  }

  function setInstrField(field: keyof InstructedForm, value: string) {
    setInstr((p) => ({ ...p, [field]: value }));
  }

  function requiresStageInputs(stage: string) {
    return ["aip", "granted", "instructed", "registrations", "ntu"].includes(String(stage));
  }

  async function confirm() {
    const key = String(target || "").trim();
    if (!key) {
      setErr("Missing deal id / deal_code on this row.");
      return;
    }

    setBusy(true);
    setErr(null);

    const stage = normalizeStage(nextStage) || currentStage || "submitted";
    if (requiresStageInputs(stage) && !stageConfirmed) {
      setShowStagePrompt(true);
      return;
    }
    const movedByLocal = movedBy?.trim()
      ? movedBy.trim()
      : (typeof window !== "undefined" ? (localStorage.getItem("cb_user") || "").trim() : "");
    const movedBySafe = await resolveMovedBy(movedByLocal);
    if (!movedBySafe || movedBySafe === "System") {
      setErr("Please log in again so we can record who moved this deal.");
      setBusy(false);
      return;
    }

    const aipBankDetails =
      normalizeStage(stage) === "aip"
        ? banks
            .map((b) => {
              const f = aipBanks[b.key] || {};
              const status = (f.status || "").trim();
              const reference = (f.reference || "").trim();
              const amount = (f.amount || "").trim();
              const rate = (f.rate || "").trim();
              const term = (f.term || "").trim();
              const representative_name = (f.representative_name || "").trim();
              const representative_contact = (f.representative_contact || "").trim();
              const note = (f.note || "").trim();

              const hasAnything = status || reference || amount || rate || term || representative_name || representative_contact || note;
              if (!hasAnything) return null;

              return {
                bank_id: b.bank_id,
                bank_name: b.bank_name,
                status: status || null,
                reference: reference || null,
                amount: amount || null,
                rate: rate || null,
                term: term || null,
                representative_name: representative_name || null,
                representative_contact: representative_contact || null,
                note: note || null,
              };
            })
            .filter(Boolean)
        : [];

    const instructedPayload =
      normalizeStage(stage) === "instructed"
        ? {
            attorney_firm: instr.attorney_firm?.trim() ? instr.attorney_firm.trim() : null,
            attorney_name: instr.attorney_name?.trim() ? instr.attorney_name.trim() : null,
            attorney_email: instr.attorney_email?.trim() ? instr.attorney_email.trim() : null,
            attorney_tel: instr.attorney_tel?.trim() ? instr.attorney_tel.trim() : null,
            attorney_ref: instr.attorney_ref?.trim() ? instr.attorney_ref.trim() : null,
            notes: instr.notes?.trim() ? instr.notes.trim() : null,
          }
        : null;

    const payload: any = {
      toStage: stage,
        stageData: stageData,
      stage,
      movedBy: movedBySafe ? movedBySafe : null,
      stageNotes: stageNotes?.trim() ? stageNotes.trim() : null,
      note: stageNotes?.trim() ? stageNotes.trim() : null,
      stageForNotes: stage,
      aipBankDetails,
      instructed: instructedPayload,
    };

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-cb-user": movedBySafe || "" },
        body: JSON.stringify({ ...payload, stageData }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Move failed (${res.status})`);
      }

      onClose();
      setTimeout(() => window.location.assign(stageToRoute(stage)), 50);
    } catch (e: any) {
      setErr(e?.message || "Move failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  // compact shared classes
  const labelSm = "text-[10px] font-extrabold text-black/60";
  const inputSm = "rounded-xl border border-black/10 bg-white px-2 py-1.5 text-[13px] font-semibold text-black outline-none";
  const selectSm = "rounded-xl border border-black/10 bg-white px-2 py-1.5 text-[13px] font-extrabold text-black outline-none";
  const bankNames = (() => {
    const srcBanks: any[] =
      (Array.isArray((fullDeal as any)?.banks) ? (fullDeal as any).banks : []) ||
      (Array.isArray((deal as any)?.banks) ? (deal as any).banks : []);

    const names = (Array.isArray(srcBanks) ? srcBanks : [])
      .map((b: any) =>
        String(b?.bank_name ?? b?.bankName ?? b?.name ?? b?.bank ?? b ?? "").trim()
      )
      .filter(Boolean);

    const norm = (s: string) => s.trim().toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];

    for (const n of names) {
      const k = norm(n);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }

    // fallback to single deal.bank ONLY if it's not "Multiple"
    const single = String((deal as any)?.bank ?? "").trim();
    if (!out.length && single && norm(single) !== "multiple") out.push(single);

    return out;
  })();

  const banksDetected = bankNames.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/10 p-3">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold text-black">Move deal</div>
            <div className="text-[11px] font-semibold text-black/60 truncate">
              {d?.deal_code ? `Deal ref: ${d.deal_code}` : `Deal id: ${String(d?.id ?? deal?.id ?? "")}`}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[11px] font-extrabold text-black hover:border-black/20"
          >
            Close
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <div className="text-[11px] font-extrabold text-black/70">Next status</div>
                <select value={nextStage} onChange={(e) => {
                  setNextStage(e.target.value);
                  setStageConfirmed(false);
                }} className={selectSm}>
                  {nextStageOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "aip" ? "AIP" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <div className="text-[11px] font-extrabold text-black/70">Moved by</div>
                <input value={movedBy} onChange={(e) => setMovedBy(e.target.value)} placeholder="Name (optional)" className={inputSm} />
              </label>
            </div>

            <label className="grid gap-1">
              <div className="text-[11px] font-extrabold text-black/70">Notes (timestamped)</div>
              <textarea
                value={stageNotes}
                onChange={(e) => setStageNotes(e.target.value)}
                rows={2}
                placeholder="General move note..."
                className={inputSm}
              />
            </label>
          </div>
        </div>

        {/* Sticky footer (always visible) */}
        <div className="border-t border-black/10 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={busy}
              onClick={confirm}
              className="rounded-xl bg-black px-4 py-2 text-[13px] font-extrabold text-white shadow-sm disabled:opacity-60"
            >
              {busy ? "Saving..." : "Confirm move"}
            </button>

            {err && <div className="text-[13px] font-semibold text-red-600">{err}</div>}
          </div>
        </div>
      </div>
    </div>
    {showStagePrompt ? (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
          <div className="text-sm font-extrabold text-black">Additional details required</div>
          <div className="mt-1 text-xs font-semibold text-black/60">
            Please complete the required inputs for this status.
          </div>

          <div className="mt-3">
            <MoveStageCards
              toStage={nextStage}
              deal={deal}
              setStageData={setStageData}
              stageData={stageData}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
              onClick={() => {
                setStageConfirmed(true);
                setShowStagePrompt(false);
                confirm();
              }}
            >
              Continue
            </button>
            <button
              type="button"
              className="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
              onClick={() => setShowStagePrompt(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    ) : null}
  );
}





