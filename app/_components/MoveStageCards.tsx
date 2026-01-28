"use client";

import React, { useEffect, useMemo, useState } from "react";

type NoteItem = { ts: string; text: string };

function normStage(s: any) {
  let v = String(s ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "arp") v = "aip";
  if (v === "iap") v = "aip";
  if (v === "grant" || v === "approved") v = "granted";
  if (v === "instructions" || v === "instruct") v = "instructed";
  if (v === "registration" || v === "regs" || v === "reg") v = "registrations";
  return v;
}

function nowIso() {
  return new Date().toISOString();
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.01] p-4">
      <div className="text-xs font-extrabold text-black/70">{title}</div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold text-black">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function NotesBox({
  title,
  notes,
  onAdd,
}: {
  title: string;
  notes: NoteItem[];
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3">
      <div className="text-[11px] font-extrabold text-black">{title}</div>

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note..."
          className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
        />
        <button
          type="button"
          onClick={() => {
            const t = text.trim();
            if (!t) return;
            onAdd(t);
            setText("");
          }}
          className="shrink-0 rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
        >
          Add
        </button>
      </div>

      {notes.length ? (
        <div className="mt-3 space-y-2">
          {notes
            .slice()
            .reverse()
            .map((n, idx) => (
              <div key={idx} className="rounded-2xl border border-black/10 bg-white px-3 py-2">
                <div className="text-[10px] font-extrabold text-black/50">{n.ts}</div>
                <div className="mt-1 text-xs font-semibold text-black">{n.text}</div>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function BankDetailsBox({
  banks,
  valueByBank,
  refByBank,
  onChange,
  onRefChange,
  label,
}: {
  banks: { bank_name?: string }[];
  valueByBank: Record<string, string>;
  refByBank: Record<string, string>;
  onChange: (bankName: string, text: string) => void;
  onRefChange: (bankName: string, ref: string) => void;
  label: string;
}) {
  if (!banks.length) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-3">
        <div className="text-xs font-semibold text-black/60">No banks found on this deal (deal.banks is empty).</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {banks.map((b, i) => {
        const name = String((b as any)?.bank_name || (b as any)?.bankName || `Bank ${i + 1}`).trim();
        const v = valueByBank[name] ?? "";
        const r = refByBank[name] ?? "";
        return (
          <div key={name + "_" + i} className="rounded-2xl border border-black/10 bg-white p-3">
            <div className="text-[11px] font-extrabold text-black">{name}</div>
            <div className="mt-2">
              <input
                value={r}
                onChange={(e) => onRefChange(name, e.target.value)}
                placeholder="Reference number"
                className="mb-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
              />
              <textarea
                value={v}
                onChange={(e) => onChange(name, e.target.value)}
                placeholder={label}
                rows={3}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function notesToText(notes: NoteItem[]) {
  return (Array.isArray(notes) ? notes : [])
    .map((n) => `${n.ts} - ${n.text}`)
    .filter(Boolean)
    .join("\n");
}

function bankMapToText(bank: Record<string, string>) {
  const keys = Object.keys(bank || {});
  return keys
    .map((k) => {
      const v = String(bank?.[k] ?? "").trim();
      if (!v) return "";
      return `${k}: ${v}`;
    })
    .filter(Boolean)
    .join("\n");
}

function bankRefsToText(bankRefs: Record<string, string>) {
  const keys = Object.keys(bankRefs || {});
  return keys
    .map((k) => {
      const v = String(bankRefs?.[k] ?? "").trim();
      if (!v) return "";
      return `${k}: ${v}`;
    })
    .filter(Boolean)
    .join("\n");
}

function parseBankTextMap(text: any) {
  const s = String(text ?? "").trim();
  if (!s) return {};
  const out: Record<string, string> = {};
  for (const line of s.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (name) out[name] = val;
  }
  return out;
}

function pickLatestStageData(deal: any, stageKey: string) {
  const hist = Array.isArray(deal?.move_history) ? deal.move_history : [];
  const last = [...hist].reverse().find((h: any) => String(h?.to || h?.to_stage || "").toLowerCase() === stageKey);
  return (last?.data && typeof last.data === "object") ? last.data : (last?.stageData && typeof last.stageData === "object" ? last.stageData : null);
}

function toStr(v: any) {
  return String(v ?? "").trim();
}

function composeAipDetail(d: any) {
  const parts: string[] = [];
  if (d?.status) parts.push(`Status: ${toStr(d.status)}`);
  if (d?.reference) parts.push(`Reference: ${toStr(d.reference)}`);
  if (d?.amount) parts.push(`Amount: ${toStr(d.amount)}`);
  if (d?.rate) parts.push(`Rate: ${toStr(d.rate)}`);
  if (d?.term) parts.push(`Term: ${toStr(d.term)}`);
  if (d?.rep_name) parts.push(`Rep: ${toStr(d.rep_name)}`);
  if (d?.rep_contact) parts.push(`Rep contact: ${toStr(d.rep_contact)}`);
  if (d?.note) parts.push(`Note: ${toStr(d.note)}`);
  return parts.filter(Boolean).join("\n");
}

function stageMatch(noteStage: any, target: string) {
  const s = String(noteStage ?? "").trim().toLowerCase();
  if (!s || s === "global") return true;
  return s === String(target || "").trim().toLowerCase();
}

function composeDealBankDetails(d: any) {
  const parts: string[] = [];
  if (d?.reference_number) parts.push(`Reference: ${toStr(d.reference_number)}`);
  if (d?.contact_name) parts.push(`Contact: ${toStr(d.contact_name)}`);
  if (d?.contact_email) parts.push(`Email: ${toStr(d.contact_email)}`);
  if (d?.contact_phone) parts.push(`Phone: ${toStr(d.contact_phone)}`);
  if (d?.attorney) parts.push(`Attorney: ${toStr(d.attorney)}`);
  if (d?.attorney_note) parts.push(`Attorney note: ${toStr(d.attorney_note)}`);
  if (d?.bank_notes) parts.push(`Note: ${toStr(d.bank_notes)}`);
  return parts.filter(Boolean).join("\n");
}

export default function MoveStageCards({
  toStage,
  deal,
  onStageData,
  onChange,
  setStageData,
  setComputedStageData,
  stageData: _stageData,
}: {
  toStage: any;
  deal?: any;
  onStageData?: (payload: any) => void;
  onChange?: (payload: any) => void;
  setStageData?: (payload: any) => void;
  setComputedStageData?: (payload: any) => void;
  stageData?: any;
}) {
  const stage = normStage(toStage);

  const [fullDeal, setFullDeal] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const id = String((deal as any)?.id || "").trim();
      if (!id) return;
      try {
        const res = await fetch(`/api/deals/${encodeURIComponent(id)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const got = json?.deal ?? json?.data ?? (json?.ok ? json?.deal : null) ?? null;
        if (alive && got && typeof got === "object") setFullDeal(got);
      } catch {}
    }
    load();
    return () => {
      alive = false;
    };
  }, [deal?.id]);

  const banks = useMemo(() => {
    const src = fullDeal || deal;
    const out: Array<{ bank_name: string }> = [];

    const pushName = (v: any) => {
      const name = String(v ?? "").trim();
      if (!name) return;
      out.push({ bank_name: name });
    };

    const raw =
      (src as any)?.deal_banks ??
      (src as any)?.banks ??
      (src as any)?.deal_banks_source ??
      [];

    const arr = Array.isArray(raw) ? raw : [];
    for (const x of arr) {
      if (typeof x === "string") pushName(x);
      else if (x && typeof x === "object") {
        pushName(x.bank_name ?? x.bankName ?? x.name ?? x.bank ?? x);
      } else {
        pushName(x);
      }
    }

    const dealBanks = Array.isArray((src as any)?.deal_banks) ? (src as any).deal_banks : [];
    const bankNotesRows = Array.isArray((src as any)?.bank_notes_rows) ? (src as any).bank_notes_rows : [];

    const infoNames = new Set<string>();
    const markInfo = (name: any) => {
      const n = String(name ?? "").trim();
      if (n) infoNames.add(n.toLowerCase());
    };

    for (const b of dealBanks) {
      const name = b?.bank_name;
      const hasInfo =
        String(b?.bank_notes ?? "").trim() ||
        String(b?.reference_number ?? "").trim() ||
        String(b?.contact_name ?? "").trim() ||
        String(b?.contact_email ?? "").trim() ||
        String(b?.contact_phone ?? "").trim() ||
        String(b?.attorney ?? "").trim() ||
        String(b?.attorney_note ?? "").trim() ||
        (Number.isFinite(Number(b?.amount_zar)) && Number(b?.amount_zar) > 0);
      if (hasInfo) markInfo(name);
    }

    for (const r of bankNotesRows) {
      const name = r?.bank_name;
      const hasInfo =
        String(r?.bank_notes ?? "").trim() ||
        String(r?.bank_reference ?? "").trim();
      if (hasInfo) markInfo(name);
    }

    for (const b of dealBanks) pushName(b?.bank_name);
    for (const r of bankNotesRows) pushName(r?.bank_name);

    const seen = new Set<string>();
    const deduped: any[] = [];
    const shouldFilterByInfo = stage !== "aip";
    for (const b of out) {
      const name = String(b?.bank_name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!shouldFilterByInfo || infoNames.size === 0 || infoNames.has(key)) {
        deduped.push({ bank_name: name });
      }
    }

    return deduped;
  }, [deal, fullDeal, stage]);

  const [aip, setAip] = useState<{
    bank: Record<string, string>;
    bankRefs: Record<string, string>;
    notes: NoteItem[];
  }>({ bank: {}, bankRefs: {}, notes: [] });
  const [granted, setGranted] = useState<{
    bank: Record<string, string>;
    bankRefs: Record<string, string>;
    conditions: string;
    notes: NoteItem[];
  }>({
    bank: {},
    bankRefs: {},
    conditions: "",
    notes: [],
  });
  const [instructed, setInstructed] = useState<{
    bank: Record<string, string>;
    bankRefs: Record<string, string>;
    attorney: { name: string; firm: string; tel: string; email: string };
    estimatedRegDate: string;
    notes: NoteItem[];
  }>({
    bank: {},
    bankRefs: {},
    attorney: { name: "", firm: "", tel: "", email: "" },
    estimatedRegDate: "",
    notes: [],
  });
  const [ntu, setNtu] = useState<{ reason: string; otherNote: string }>({ reason: "", otherNote: "" });
  const [regs, setRegs] = useState<{
    bank: Record<string, string>;
    bankRefs: Record<string, string>;
    regNumber: string;
    reference: string;
    attorney: { name: string; firm: string; tel: string; email: string };
    paymentDue: string;
    commissionPaid: boolean;
    notes: NoteItem[];
  }>({
    bank: {},
    bankRefs: {},
    regNumber: "",
    reference: "",
    attorney: { name: "", firm: "", tel: "", email: "" },
    paymentDue: "",
    commissionPaid: false,
    notes: [],
  });

  useEffect(() => {
    const src = fullDeal || deal;
    if (!src || !stage) return;

    const stageData = pickLatestStageData(src, String(stage));
    const bankByName = (stageData?.bank_by_name && typeof stageData.bank_by_name === "object") ? stageData.bank_by_name : {};
    const bankRefByName = (stageData?.bank_ref_by_name && typeof stageData.bank_ref_by_name === "object") ? stageData.bank_ref_by_name : {};

    const notesText =
      stage === "aip"
        ? (stageData?.aip_bank_notes ?? stageData?.bank_notes ?? null)
        : stage === "granted"
        ? (stageData?.granted_bank_notes ?? stageData?.bank_notes ?? null)
        : stage === "instructed"
        ? (stageData?.instructed_bank_notes ?? stageData?.bank_notes ?? null)
        : stage === "registrations"
        ? (stageData?.registration_bank_notes ?? stageData?.bank_notes ?? null)
        : null;

    const refsText =
      stage === "aip"
        ? (stageData?.aip_bank_refs ?? stageData?.bank_refs ?? null)
        : stage === "granted"
        ? (stageData?.granted_bank_refs ?? stageData?.bank_refs ?? null)
        : stage === "instructed"
        ? (stageData?.instructed_bank_refs ?? stageData?.bank_refs ?? null)
        : stage === "registrations"
        ? (stageData?.registration_bank_refs ?? stageData?.bank_refs ?? null)
        : null;

    const parsedNotes = parseBankTextMap(notesText);
    const parsedRefs = parseBankTextMap(refsText);

    const dealBanks = Array.isArray(src?.deal_banks) ? src.deal_banks : [];
    const bankNotesRows = Array.isArray(src?.bank_notes_rows) ? src.bank_notes_rows : [];

    const dealBanksNotes: Record<string, string> = {};
    const dealBanksRefs: Record<string, string> = {};
    for (const b of dealBanks) {
      const name = toStr(b?.bank_name);
      if (!name) continue;
      if (!dealBanksNotes[name]) dealBanksNotes[name] = composeDealBankDetails(b);
      if (!dealBanksRefs[name] && b?.reference_number) dealBanksRefs[name] = toStr(b.reference_number);
    }

    const bankNotesMap: Record<string, string> = {};
    const bankRefsMap: Record<string, string> = {};
    for (const r of bankNotesRows) {
      const name = toStr(r?.bank_name);
      if (!name) continue;
      if (!stageMatch(r?.stage, String(stage))) continue;
      if (r?.bank_notes && !bankNotesMap[name]) bankNotesMap[name] = toStr(r.bank_notes);
      if (r?.bank_reference && !bankRefsMap[name]) bankRefsMap[name] = toStr(r.bank_reference);
    }

    if (stage === "aip") {
      let combinedBank: Record<string, string> = {
        ...parsedNotes,
        ...bankNotesMap,
        ...dealBanksNotes,
        ...bankByName,
      };
      let combinedRefs: Record<string, string> = {
        ...parsedRefs,
        ...bankRefsMap,
        ...dealBanksRefs,
        ...bankRefByName,
      };

      const details = Array.isArray(src?.aip_bank_details) ? src.aip_bank_details : [];
      if (details.length) {
        for (const d of details) {
          const name = toStr(d?.bank_name ?? d?.bankName ?? d?.bank);
          if (!name) continue;
          if (!combinedBank[name]) combinedBank[name] = composeAipDetail(d);
          if (!combinedRefs[name] && d?.reference) combinedRefs[name] = toStr(d.reference);
        }
      }

      setAip((s) => ({ ...s, bank: combinedBank, bankRefs: combinedRefs }));
      return;
    }

    if (stage === "granted") {
      setGranted((s) => ({
        ...s,
        bank: { ...parsedNotes, ...bankNotesMap, ...dealBanksNotes, ...bankByName },
        bankRefs: { ...parsedRefs, ...bankRefsMap, ...dealBanksRefs, ...bankRefByName },
      }));
      return;
    }

    if (stage === "instructed") {
      setInstructed((s) => ({
        ...s,
        bank: { ...parsedNotes, ...bankNotesMap, ...dealBanksNotes, ...bankByName },
        bankRefs: { ...parsedRefs, ...bankRefsMap, ...dealBanksRefs, ...bankRefByName },
        estimatedRegDate: String(
          stageData?.estimated_reg_date ??
            stageData?.instructed_estimated_reg_date ??
            (fullDeal || deal)?.estimated_reg_date ??
            ""
        ).slice(0, 10),
      }));
      return;
    }

    if (stage === "registrations") {
      setRegs((s) => ({
        ...s,
        bank: { ...parsedNotes, ...bankNotesMap, ...dealBanksNotes, ...bankByName },
        bankRefs: { ...parsedRefs, ...bankRefsMap, ...dealBanksRefs, ...bankRefByName },
      }));
    }
  }, [stage, fullDeal, deal]);

  const computedStagePayload = useMemo(() => {
    if (!stage) return {};

    if (stage === "aip") {
      const bank_notes = bankMapToText(aip.bank);
      const bank_refs = bankRefsToText(aip.bankRefs);
      const notes = notesToText(aip.notes);
      return {
        stage: "aip",
        bank_notes,
        notes,
        aip_bank_notes: bank_notes,
        aip_bank_refs: bank_refs,
        aip_notes: notes,
        bank_by_name: aip.bank,
        bank_ref_by_name: aip.bankRefs,
        notes_items: aip.notes,
      };
    }

    if (stage === "granted") {
      const bank_notes = bankMapToText(granted.bank);
      const bank_refs = bankRefsToText(granted.bankRefs);
      const notes = notesToText(granted.notes);
      return {
        stage: "granted",
        conditions: String(granted.conditions || "").trim() || null,
        bank_notes,
        notes,
        granted_bank_notes: bank_notes,
        granted_bank_refs: bank_refs,
        granted_notes: notes,
        bank_by_name: granted.bank,
        bank_ref_by_name: granted.bankRefs,
        notes_items: granted.notes,
      };
    }

    if (stage === "instructed") {
      const bank_notes = bankMapToText(instructed.bank);
      const bank_refs = bankRefsToText(instructed.bankRefs);
      const notes = notesToText(instructed.notes);
      const a = instructed.attorney || { name: "", firm: "", tel: "", email: "" };
      const attorneyStr = [
        String(a.name || "").trim(),
        String(a.firm || "").trim() ? `(${String(a.firm).trim()})` : "",
        String(a.tel || "").trim() ? `Tel: ${String(a.tel).trim()}` : "",
        String(a.email || "").trim() ? `Email: ${String(a.email).trim()}` : "",
      ].filter(Boolean).join(" ");

      return {
        stage: "instructed",
        attorney: attorneyStr || null,
        attorney_details: a,
        estimated_reg_date: instructed.estimatedRegDate ? String(instructed.estimatedRegDate).slice(0, 10) : null,
        instructed_estimated_reg_date: instructed.estimatedRegDate ? String(instructed.estimatedRegDate).slice(0, 10) : null,
        bank_notes,
        notes,
        instructed_bank_notes: bank_notes,
        instructed_bank_refs: bank_refs,
        instructed_notes: notes,
        bank_by_name: instructed.bank,
        bank_ref_by_name: instructed.bankRefs,
        notes_items: instructed.notes,
      };
    }

    if (stage === "registrations") {
      const bank_notes = bankMapToText(regs.bank);
      const bank_refs = bankRefsToText(regs.bankRefs);
      const notes = notesToText(regs.notes);
      const a = regs.attorney || { name: "", firm: "", tel: "", email: "" };

      return {
        stage: "registrations",
        registration_number: String(regs.regNumber || "").trim() || null,
        registration_attorney_reference: String(regs.reference || "").trim() || null,
        attorney_details: a,
        payment_due_date: regs.paymentDue ? String(regs.paymentDue).slice(0, 10) : null,
        agent_comm_paid: !!regs.commissionPaid,
        bank_notes,
        notes,
        registration_bank_notes: bank_notes,
        registration_bank_refs: bank_refs,
        registration_notes: notes,
        bank_by_name: regs.bank,
        bank_ref_by_name: regs.bankRefs,
        notes_items: regs.notes,
      };
    }

    if (stage === "ntu") {
      const reason = String(ntu.reason || "").trim();
      const otherNote = String(ntu.otherNote || "").trim();
      const notes_items =
        reason === "Other" && otherNote ? [{ ts: nowIso(), text: otherNote }] : [];
      return {
        stage: "ntu",
        ntu_reason: reason || null,
        ntu_note: reason === "Other" ? otherNote || null : null,
        notes_items,
      };
    }

    return {};
  }, [stage, aip, granted, instructed, regs, ntu]);

  useEffect(() => {
    const cb = onStageData || onChange || setStageData || setComputedStageData;
    if (!cb) return;
    cb(computedStagePayload);
  }, [onStageData, onChange, setStageData, setComputedStageData, computedStagePayload]);

  if (!stage) return null;

  if (stage === "aip") {
    return (
      <Card title="AIP SECTION">
        <Field label="AIP bank details (per bank chosen in Submitted)">
          <BankDetailsBox
            banks={banks}
            valueByBank={aip.bank}
            refByBank={aip.bankRefs}
            onChange={(bankName, text) => setAip((s) => ({ ...s, bank: { ...s.bank, [bankName]: text } }))}
            onRefChange={(bankName, ref) => setAip((s) => ({ ...s, bankRefs: { ...s.bankRefs, [bankName]: ref } }))}
            label="AIP bank details..."
          />
        </Field>

        <NotesBox
          title="AIP NOTES (timestamped)"
          notes={aip.notes}
          onAdd={(text) => setAip((s) => ({ ...s, notes: [...s.notes, { ts: nowIso(), text }] }))}
        />
      </Card>
    );
  }

  if (stage === "granted") {
    return (
      <Card title="GRANTED SECTION">
        <Field label="Conditions">
          <textarea
            value={granted.conditions}
            onChange={(e) => setGranted((s) => ({ ...s, conditions: e.target.value }))}
            rows={3}
            placeholder="Any conditions..."
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
          />
        </Field>

        <Field label="Granted bank details (per bank chosen)">
          <BankDetailsBox
            banks={banks}
            valueByBank={granted.bank}
            refByBank={granted.bankRefs}
            onChange={(bankName, text) => setGranted((s) => ({ ...s, bank: { ...s.bank, [bankName]: text } }))}
            onRefChange={(bankName, ref) => setGranted((s) => ({ ...s, bankRefs: { ...s.bankRefs, [bankName]: ref } }))}
            label="Granted bank details..."
          />
        </Field>

        <NotesBox
          title="GRANTED NOTES (timestamped)"
          notes={granted.notes}
          onAdd={(text) => setGranted((s) => ({ ...s, notes: [...s.notes, { ts: nowIso(), text }] }))}
        />
      </Card>
    );
  }

  if (stage === "instructed") {
    return (
      <Card title="INSTRUCTED SECTION">
        <div className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="text-[11px] font-extrabold text-black">Attorney details</div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="Estimated registration date">
              <input
                type="date"
                value={instructed.estimatedRegDate}
                onChange={(e) =>
                  setInstructed((s) => ({ ...s, estimatedRegDate: e.target.value }))
                }
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
              />
            </Field>

            <Field label="Attorney name">
              <input
                value={instructed.attorney.name}
                onChange={(e) => setInstructed((s) => ({ ...s, attorney: { ...s.attorney, name: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Full name"
              />
            </Field>

            <Field label="Firm">
              <input
                value={instructed.attorney.firm}
                onChange={(e) => setInstructed((s) => ({ ...s, attorney: { ...s.attorney, firm: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Firm name"
              />
            </Field>

            <Field label="Telephone">
              <input
                value={instructed.attorney.tel}
                onChange={(e) => setInstructed((s) => ({ ...s, attorney: { ...s.attorney, tel: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Tel"
              />
            </Field>

            <Field label="Email">
              <input
                value={instructed.attorney.email}
                onChange={(e) => setInstructed((s) => ({ ...s, attorney: { ...s.attorney, email: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Email"
              />
            </Field>
          </div>
        </div>

        <NotesBox
          title="INSTRUCTED EXTRA NOTES (timestamped)"
          notes={instructed.notes}
          onAdd={(text) => setInstructed((s) => ({ ...s, notes: [...s.notes, { ts: nowIso(), text }] }))}
        />
      </Card>
    );
  }

  if (stage === "registrations") {
    return (
      <Card title="REGISTRATION SECTION">
        <Field label="Registration number">
          <input
            value={regs.regNumber}
            onChange={(e) => setRegs((s) => ({ ...s, regNumber: e.target.value }))}
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
            placeholder="e.g. REG-12345"
          />
        </Field>

        <Field label="Reference">
          <input
            value={regs.reference}
            onChange={(e) => setRegs((s) => ({ ...s, reference: e.target.value }))}
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
            placeholder="e.g. REF-7788"
          />
        </Field>

        <div className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="text-[11px] font-extrabold text-black">Attorney details</div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="Attorney name">
              <input
                value={regs.attorney.name}
                onChange={(e) => setRegs((s) => ({ ...s, attorney: { ...s.attorney, name: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Full name"
              />
            </Field>

            <Field label="Firm">
              <input
                value={regs.attorney.firm}
                onChange={(e) => setRegs((s) => ({ ...s, attorney: { ...s.attorney, firm: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Firm name"
              />
            </Field>

            <Field label="Telephone">
              <input
                value={regs.attorney.tel}
                onChange={(e) => setRegs((s) => ({ ...s, attorney: { ...s.attorney, tel: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Tel"
              />
            </Field>

            <Field label="Email">
              <input
                value={regs.attorney.email}
                onChange={(e) => setRegs((s) => ({ ...s, attorney: { ...s.attorney, email: e.target.value } }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
                placeholder="Email"
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="Payment due date">
              <input
                type="date"
                value={regs.paymentDue}
                onChange={(e) => setRegs((s) => ({ ...s, paymentDue: e.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
              />
            </Field>

            <div className="flex items-center gap-2">
              <input
                id="commPaid"
                type="checkbox"
                checked={regs.commissionPaid}
                onChange={(e) => setRegs((s) => ({ ...s, commissionPaid: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="commPaid" className="text-xs font-extrabold text-black">
                Commission paid
              </label>
            </div>
          </div>
        </div>

        <NotesBox
          title="REGISTRATION NOTES (timestamped)"
          notes={regs.notes}
          onAdd={(text) => setRegs((s) => ({ ...s, notes: [...s.notes, { ts: nowIso(), text }] }))}
        />
      </Card>
    );
  }

  if (stage === "ntu") {
    return (
      <Card title="NTU SECTION">
        <Field label="NTU reason">
          <select
            value={ntu.reason}
            onChange={(e) => setNtu((s) => ({ ...s, reason: e.target.value }))}
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
          >
            <option value="">Select reason</option>
            <option value="Deal fallen through">Deal fallen through</option>
            <option value="Affordability">Affordability</option>
            <option value="Other">Other</option>
          </select>
        </Field>

        {ntu.reason === "Other" ? (
          <Field label="Other note">
            <textarea
              value={ntu.otherNote}
              onChange={(e) => setNtu((s) => ({ ...s, otherNote: e.target.value }))}
              rows={3}
              placeholder="Add a note..."
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
            />
          </Field>
        ) : null}
      </Card>
    );
  }

  return null;
}
