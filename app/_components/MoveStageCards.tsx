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
  onChange,
  label,
}: {
  banks: { bank_name?: string }[];
  valueByBank: Record<string, string>;
  onChange: (bankName: string, text: string) => void;
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
        return (
          <div key={name + "_" + i} className="rounded-2xl border border-black/10 bg-white p-3">
            <div className="text-[11px] font-extrabold text-black">{name}</div>
            <div className="mt-2">
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

  const banks = useMemo(() => {
    const raw =
      (deal as any)?.deal_banks ??
      (deal as any)?.banks ??
      (deal as any)?.deal_banks_source ??
      [];

    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((x: any) => {
      if (typeof x === "string") return { bank_name: x };
      if (x && typeof x === "object") {
        return { bank_name: String(x.bank_name ?? x.bankName ?? x.name ?? x.bank ?? "").trim() || x.bank_name };
      }
      return { bank_name: String(x ?? "").trim() };
    }).filter((b: any) => String(b?.bank_name ?? "").trim());
  }, [deal]);

  const [aip, setAip] = useState<{ bank: Record<string, string>; notes: NoteItem[] }>({ bank: {}, notes: [] });
  const [granted, setGranted] = useState<{ bank: Record<string, string>; conditions: string; notes: NoteItem[] }>({
    bank: {},
    conditions: "",
    notes: [],
  });
  const [instructed, setInstructed] = useState<{
    bank: Record<string, string>;
    attorney: { name: string; firm: string; tel: string; email: string };
    notes: NoteItem[];
  }>({
    bank: {},
    attorney: { name: "", firm: "", tel: "", email: "" },
    notes: [],
  });
  const [ntu, setNtu] = useState<{ details: string; notes: NoteItem[] }>({ details: "", notes: [] });
  const [regs, setRegs] = useState<{
    bank: Record<string, string>;
    regNumber: string;
    reference: string;
    attorney: { name: string; firm: string; tel: string; email: string };
    paymentDue: string;
    commissionPaid: boolean;
    notes: NoteItem[];
  }>({
    bank: {},
    regNumber: "",
    reference: "",
    attorney: { name: "", firm: "", tel: "", email: "" },
    paymentDue: "",
    commissionPaid: false,
    notes: [],
  });

  const computedStagePayload = useMemo(() => {
    if (!stage) return {};

    if (stage === "aip") {
      const bank_notes = bankMapToText(aip.bank);
      const notes = notesToText(aip.notes);
      return {
        stage: "aip",
        bank_notes,
        notes,
        aip_bank_notes: bank_notes,
        aip_notes: notes,
        bank_by_name: aip.bank,
        notes_items: aip.notes,
      };
    }

    if (stage === "granted") {
      const bank_notes = bankMapToText(granted.bank);
      const notes = notesToText(granted.notes);
      return {
        stage: "granted",
        conditions: String(granted.conditions || "").trim() || null,
        bank_notes,
        notes,
        granted_bank_notes: bank_notes,
        granted_notes: notes,
        bank_by_name: granted.bank,
        notes_items: granted.notes,
      };
    }

    if (stage === "instructed") {
      const bank_notes = bankMapToText(instructed.bank);
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
        bank_notes,
        notes,
        instructed_bank_notes: bank_notes,
        instructed_notes: notes,
        bank_by_name: instructed.bank,
        notes_items: instructed.notes,
      };
    }

    if (stage === "registrations") {
      const bank_notes = bankMapToText(regs.bank);
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
        registration_notes: notes,
        bank_by_name: regs.bank,
        notes_items: regs.notes,
      };
    }

    if (stage === "ntu") {
      const notes = notesToText(ntu.notes);
      return {
        stage: "ntu",
        ntu_reason: String(ntu.details || "").trim() || null,
        ntu_note: notes || null,
        notes_items: ntu.notes,
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
            onChange={(bankName, text) => setAip((s) => ({ ...s, bank: { ...s.bank, [bankName]: text } }))}
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
            onChange={(bankName, text) => setGranted((s) => ({ ...s, bank: { ...s.bank, [bankName]: text } }))}
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
        <Field label="Instructed bank details (per bank chosen)">
          <BankDetailsBox
            banks={banks}
            valueByBank={instructed.bank}
            onChange={(bankName, text) => setInstructed((s) => ({ ...s, bank: { ...s.bank, [bankName]: text } }))}
            label="Instructed bank details..."
          />
        </Field>

        <div className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="text-[11px] font-extrabold text-black">Attorney details</div>

          <div className="mt-3 grid grid-cols-1 gap-3">
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

        <Field label="Registration bank details (per bank chosen)">
          <BankDetailsBox
            banks={banks}
            valueByBank={regs.bank}
            onChange={(bankName, text) => setRegs((s) => ({ ...s, bank: { ...s.bank, [bankName]: text } }))}
            label="Registration bank details..."
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
        <Field label="NTU details">
          <textarea
            value={ntu.details}
            onChange={(e) => setNtu((s) => ({ ...s, details: e.target.value }))}
            rows={3}
            placeholder="Reason / details..."
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black outline-none focus:border-black/30"
          />
        </Field>

        <NotesBox
          title="NTU NOTES (timestamped)"
          notes={ntu.notes}
          onAdd={(text) => setNtu((s) => ({ ...s, notes: [...s.notes, { ts: nowIso(), text }] }))}
        />
      </Card>
    );
  }

  return null;
}
