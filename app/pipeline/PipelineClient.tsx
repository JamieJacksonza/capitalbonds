"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { exportRowsToExcel, exportRowsToPdf } from "@/app/lib/exportDeals";

type PipelineRow = {
  id?: string;
  lead_date: string;
  lead_type: string;
  consultant: string;
  agent: string;
  lead_source?: string;
  client_name: string;
  client_email?: string;
  client_cellphone?: string;
  loan_amount: string;
  bond_amount?: string;
  purchase_price?: string;
  notes: string;
  follow_up_date: string;
};

type PipelineField =
  | "lead_date"
  | "lead_type"
  | "consultant"
  | "agent"
  | "lead_source"
  | "client_name"
  | "client_email"
  | "client_cellphone"
  | "loan_amount"
  | "bond_amount"
  | "purchase_price"
  | "follow_up_date"
  | "notes";

type SaveState = { status: "pending" | "saving" | "saved" | "error"; message?: string };

const DUMMY_ROWS: PipelineRow[] = [];
const PIPELINE_FIELD_OPTIONS: Partial<Record<PipelineField, string[]>> = {
  lead_type: ["", "New App", "Pre-approval"],
  lead_source: ["", "Website", "Inbound call", "Outbound call", "Agent"],
};

const PIPELINE_EXPORT_HEADERS = [
  "Lead Date",
  "Lead Type",
  "Consultant",
  "Agent",
  "Lead Source",
  "Client Name",
  "Client Email",
  "Client Cellphone",
  "Loan Amount",
  "Bond Amount",
  "Purchase Price",
  "Follow Up Date",
  "Notes",
];

const PIPELINE_FIELDS: PipelineField[] = [
  "lead_date",
  "lead_type",
  "consultant",
  "agent",
  "lead_source",
  "client_name",
  "client_email",
  "client_cellphone",
  "loan_amount",
  "bond_amount",
  "purchase_price",
  "follow_up_date",
  "notes",
];


function dateLabel(v: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const day = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${day} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(mm) - 1]} ${yy}`;
}

function cleanText(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s || s === "-" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s.replace(/\r\n/g, "\n").trim();
}

function toMoneyNumber(v: unknown) {
  const raw = String(v ?? "").replace(/[^\d.-]/g, "");
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function moneyZar(v: unknown) {
  const n = toMoneyNumber(v);
  if (!n) return "";
  return `R${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;
}

function normalizeDateInput(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function filterLabel(label: string) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-[8px] leading-none text-black/55">v</span>
    </span>
  );
}

function pipelineCellBase(extra = "") {
  return `border border-black/70 px-1.5 py-[3px] align-top text-[11px] leading-[1.2] ${extra}`;
}

function statusClass(state?: SaveState, extra = "") {
  if (state?.status === "error") return `${extra} bg-red-50 outline outline-1 outline-red-500`;
  if (state?.status === "saved") return `${extra} bg-emerald-50`;
  if (state?.status === "saving") return `${extra} bg-sky-50`;
  if (state?.status === "pending") return `${extra} bg-yellow-50`;
  return extra;
}

function SaveMarker({ state }: { state?: SaveState }) {
  if (!state) return null;
  const label =
    state.status === "pending"
      ? "pending"
      : state.status === "saving"
      ? "saving"
      : state.status === "saved"
      ? "saved"
      : "error";
  const color =
    state.status === "error"
      ? "text-red-700"
      : state.status === "saved"
      ? "text-emerald-700"
      : state.status === "saving"
      ? "text-sky-700"
      : "text-yellow-700";

  return (
    <span title={state.message || label} className={`absolute bottom-0.5 right-1 text-[8px] font-bold uppercase ${color}`}>
      {label}
    </span>
  );
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function pipelineCellKey(id: string, field: PipelineField) {
  return `${id}:pipeline:${field}`;
}

function pipelineFieldValue(row: PipelineRow, field: PipelineField) {
  if (field === "lead_date" || field === "follow_up_date") return normalizeDateInput(row?.[field]);
  if (field === "loan_amount" || field === "bond_amount" || field === "purchase_price") return moneyZar(row?.[field]);
  return cleanText(row?.[field]);
}

function pipelinePatchForField(field: PipelineField, value: string) {
  const text = value.trim();
  if (field === "loan_amount" || field === "bond_amount" || field === "purchase_price") {
    return { [field]: text ? toMoneyNumber(text) : null };
  }
  if (field === "lead_date" || field === "follow_up_date") return { [field]: text || null };
  return { [field]: text || null };
}

function localPipelinePatchForField(field: PipelineField, value: string) {
  if (field === "loan_amount" || field === "bond_amount" || field === "purchase_price") {
    return { [field]: value.trim() };
  }
  return { [field]: value };
}

function pipelineSearchText(row: PipelineRow) {
  return PIPELINE_FIELDS.map((field) => pipelineFieldValue(row, field)).join(" ").toLowerCase();
}

function optionsWithCurrent(options: string[], current: string) {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

function EditableInput({
  value,
  state,
  onChange,
  onCommit,
  type = "text",
  className = "",
}: {
  value: string;
  state?: SaveState;
  onChange: (value: string) => void;
  onCommit: () => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className="relative min-h-[20px]">
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={statusClass(
          state,
          `block min-h-[20px] w-full border-0 bg-transparent px-0 py-0 pr-9 text-[11px] font-semibold leading-[1.2] text-black outline-none focus:bg-[#fffbd1] ${className}`
        )}
      />
      <SaveMarker state={state} />
    </div>
  );
}

function EditableTextarea({
  value,
  state,
  onChange,
  onCommit,
  className = "",
}: {
  value: string;
  state?: SaveState;
  onChange: (value: string) => void;
  onCommit: () => void;
  className?: string;
}) {
  return (
    <div className="relative min-h-[36px]">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        rows={2}
        className={statusClass(
          state,
          `block min-h-[36px] w-full resize-y border-0 bg-transparent px-0 py-0 pr-10 text-[11px] font-semibold leading-[1.2] text-black outline-none focus:bg-[#fffbd1] ${className}`
        )}
      />
      <SaveMarker state={state} />
    </div>
  );
}

function EditableSelect({
  value,
  state,
  onChange,
  options,
  className = "",
}: {
  value: string;
  state?: SaveState;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className="relative min-h-[20px]">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={statusClass(
          state,
          `block min-h-[20px] w-full border-0 bg-transparent px-0 py-0 pr-9 text-[11px] font-semibold leading-[1.2] text-black outline-none focus:bg-[#fffbd1] ${className}`
        )}
      >
        {options.map((option) => (
          <option key={option.value || "blank"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <SaveMarker state={state} />
    </div>
  );
}

function parseMoneyInput(v: any) {
  const raw = String(v ?? "").replace(/[^\d.]/g, "");
  if (!raw) return NaN;
  return Number(raw);
}

const MAX_INT_32 = 2147483647;
const DEFAULT_CONSULTANTS = ["Elmarie", "Kristie", "Cindy", "Chelsea"];

export default function PipelinePage() {
  const search = useSearchParams();
  const showForm = search.get("add") === "1";

  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [consultantOptions, setConsultantOptions] = useState<string[]>([...DEFAULT_CONSULTANTS]);
  const [form, setForm] = useState({
    lead_date: "",
    lead_type: "",
    consultant: "",
    agent: "",
    lead_source: "",
    client_name: "",
    client_email: "",
    client_cellphone: "",
    loan_amount: "",
    bond_amount: "",
    purchase_price: "",
    notes: "",
    follow_up_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [viewLead, setViewLead] = useState<PipelineRow | null>(null);
  const [moveLead, setMoveLead] = useState<PipelineRow | null>(null);
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveErr, setMoveErr] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<PipelineRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    lead_date: "",
    lead_type: "",
    consultant: "",
    agent: "",
    lead_source: "",
    client_name: "",
    client_email: "",
    client_cellphone: "",
    loan_amount: "",
    bond_amount: "",
    purchase_price: "",
    follow_up_date: "",
    notes: "",
  });
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [consultantFilter, setConsultantFilter] = useState("");
  const [query, setQuery] = useState("");
  const [followUpsOpen, setFollowUpsOpen] = useState(false);
  const [pipelineDealsOpen, setPipelineDealsOpen] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const pipelineScrollerRef = useRef<HTMLDivElement | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const clearStatusTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [moveForm, setMoveForm] = useState({
    deal_deck_id: "",
    applicant: "",
    consultant: "",
    agent: "",
    amount_zar: "",
    purchase_price: "",
    submitted_date: "",
    bond_due_date: "",
    client_main_bank: "",
    client_main_bank_other: "",
    client_email: "",
    client_cellphone: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/pipeline", { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (res.ok && json?.ok) {
          const list = Array.isArray(json?.rows) ? json.rows : [];
          setRows([...list, ...DUMMY_ROWS]);
          return;
        }
      } catch {}
      setRows([...DUMMY_ROWS]);
    }
    load();
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadConsultants() {
      try {
        const res = await fetch("/api/consultants", { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (!alive) return;
        if (!res.ok || !json?.ok) return;
        const list = Array.isArray(json?.consultants)
          ? json.consultants.map((v: any) => String(v || "").trim()).filter(Boolean)
          : [];
        if (!list.length) return;
        setConsultantOptions(list);
        setForm((prev) =>
          prev.consultant && list.includes(prev.consultant)
            ? prev
            : { ...prev, consultant: prev.consultant || list[0] || "" }
        );
      } catch {}
    }
    loadConsultants();
    const t = window.setInterval(loadConsultants, 30000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
      Object.values(clearStatusTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function updateForm<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateMoveForm<K extends keyof typeof moveForm>(key: K, value: string) {
    setMoveForm((prev) => ({ ...prev, [key]: value }));
  }

  function setCellState(key: string, state?: SaveState) {
    setSaveStates((prev) => {
      const next = { ...prev };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
  }

  function scheduleClearState(key: string) {
    clearTimeout(clearStatusTimersRef.current[key]);
    clearStatusTimersRef.current[key] = setTimeout(() => setCellState(key), 1800);
  }

  function patchPipelineRow(id: string, patch: Partial<PipelineRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function pipelineEditableValue(row: PipelineRow, field: PipelineField) {
    const id = cleanText(row?.id);
    const key = pipelineCellKey(id, field);
    return Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : pipelineFieldValue(row, field);
  }

  async function persistPipelineField(row: PipelineRow, field: PipelineField, value: string) {
    const id = cleanText(row?.id);
    if (!id) return;
    const key = pipelineCellKey(id, field);
    setCellState(key, { status: "saving" });

    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...pipelinePatchForField(field, value) }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Save failed (${res.status})`);
      const updatedRow = json?.row && typeof json.row === "object" ? json.row : localPipelinePatchForField(field, value);
      patchPipelineRow(id, updatedRow);
      setCellState(key, { status: "saved" });
      scheduleClearState(key);
    } catch (e: any) {
      setCellState(key, { status: "error", message: e?.message || "Save failed" });
    }
  }

  function queuePipelineSave(row: PipelineRow, field: PipelineField, value: string, delay = 700) {
    const id = cleanText(row?.id);
    if (!id) return;
    const key = pipelineCellKey(id, field);
    clearTimeout(saveTimersRef.current[key]);
    setCellState(key, { status: delay > 0 ? "pending" : "saving" });
    saveTimersRef.current[key] = setTimeout(() => persistPipelineField(row, field, value), delay);
  }

  function updatePipelineCell(row: PipelineRow, field: PipelineField, value: string, immediate = false) {
    const id = cleanText(row?.id);
    if (!id) return;
    const key = pipelineCellKey(id, field);
    setDrafts((prev) => ({ ...prev, [key]: value }));
    patchPipelineRow(id, localPipelinePatchForField(field, value));
    queuePipelineSave(row, field, value, immediate ? 0 : 700);
  }

  function scrollPipelineSheet(axis: "horizontal" | "vertical", direction: -1 | 1, largeStep = false) {
    const scroller = pipelineScrollerRef.current;
    if (!scroller) return;
    const size = axis === "horizontal" ? scroller.clientWidth : scroller.clientHeight;
    const distance = largeStep ? Math.max(320, size * 0.75) : 180;
    scroller.scrollBy({
      left: axis === "horizontal" ? direction * distance : 0,
      top: axis === "vertical" ? direction * distance : 0,
      behavior: "auto",
    });
  }

  function handlePipelineGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      scrollPipelineSheet("horizontal", event.key === "ArrowRight" ? 1 : -1, event.shiftKey);
    } else {
      scrollPipelineSheet("vertical", event.key === "ArrowDown" ? 1 : -1, event.shiftKey);
    }
    event.stopPropagation();

    if (!isEditableKeyboardTarget(event.target)) {
      event.preventDefault();
    }
  }

  function openMove(lead: PipelineRow) {
    setMoveErr(null);
    setMoveLead(lead);
    setMoveForm({
      deal_deck_id: "",
      applicant: lead.client_name || "",
      consultant: lead.consultant || "",
      agent: lead.agent || lead.lead_source || "",
      amount_zar: lead.loan_amount || "",
      purchase_price: lead.purchase_price || "",
      submitted_date: lead.lead_date || "",
      bond_due_date: "",
      client_main_bank: "",
      client_main_bank_other: "",
      client_email: lead.client_email || "",
      client_cellphone: lead.client_cellphone || "",
    });
  }

  function openEditFollowUp(lead: PipelineRow) {
    setEditErr(null);
    setEditLead(lead);
    setEditForm({
      lead_date: String(lead.lead_date || "").slice(0, 10),
      lead_type: String(lead.lead_type || ""),
      consultant: String(lead.consultant || ""),
      agent: String(lead.agent || ""),
      lead_source: String(lead.lead_source || ""),
      client_name: String(lead.client_name || ""),
      client_email: String(lead.client_email || ""),
      client_cellphone: String(lead.client_cellphone || ""),
      loan_amount: String(lead.loan_amount || ""),
      bond_amount: String(lead.bond_amount || ""),
      purchase_price: String(lead.purchase_price || ""),
      follow_up_date: String(lead.follow_up_date || "").slice(0, 10),
      notes: String(lead.notes || ""),
    });
  }

  async function submitMoveToSubmitted() {
    if (!moveLead) return;
    setMoveSaving(true);
    setMoveErr(null);

    const amountParsed = parseMoneyInput(moveForm.amount_zar);
    const purchaseParsed = moveForm.purchase_price
      ? parseMoneyInput(moveForm.purchase_price)
      : undefined;

    const payload = {
      deal_deck_id: moveForm.deal_deck_id.trim(),
      applicant: moveForm.applicant.trim(),
      consultant: moveForm.consultant.trim(),
      agent: moveForm.agent.trim(),
      amount_zar: amountParsed,
      purchase_price: purchaseParsed,
      stage: "submitted",
      submitted_date: moveForm.submitted_date.trim(),
      bond_due_date: moveForm.bond_due_date.trim() || undefined,
      client_email: moveForm.client_email.trim() || undefined,
      client_cellphone: moveForm.client_cellphone.trim() || undefined,
      client_main_bank:
        moveForm.client_main_bank === "Other"
          ? moveForm.client_main_bank_other.trim()
          : moveForm.client_main_bank.trim(),
    };

    if (!payload.deal_deck_id) return setMoveErr("Ops number is required.");
    if (!payload.applicant) return setMoveErr("Applicant is required.");
    if (!payload.consultant) return setMoveErr("Consultant is required.");
    if (!payload.agent) return setMoveErr("Lead source is required.");
    if (!payload.submitted_date) return setMoveErr("Date is required.");
    if (!Number.isFinite(payload.amount_zar) || payload.amount_zar <= 0) return setMoveErr("Loan amount must be > 0.");
    if (payload.amount_zar > MAX_INT_32) return setMoveErr("Loan amount is too large.");
    if (payload.purchase_price !== undefined && payload.purchase_price > MAX_INT_32) {
      return setMoveErr("Purchase price is too large.");
    }

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to create deal.");
      if (moveLead?.id) {
        await fetch("/api/pipeline", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: moveLead.id }),
        });
        setRows((prev) => prev.filter((r) => r.id !== moveLead.id));
      }
      setMoveLead(null);
    } catch (e: any) {
      setMoveErr(e?.message || "Failed to create deal.");
    } finally {
      setMoveSaving(false);
    }
  }

  async function updateLeadStatus(id: string, leadType: string) {
    setStatusSavingId(id);
    setStatusErr(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, lead_type: leadType }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to update status.");
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, lead_type: leadType } : r))
      );
    } catch (e: any) {
      setStatusErr(e?.message || "Failed to update status.");
    } finally {
      setStatusSavingId(null);
    }
  }

  async function saveFollowUpEdits() {
    if (!editLead?.id) return;
    setEditSaving(true);
    setEditErr(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editLead.id,
          lead_date: String(editForm.lead_date || "").trim() || null,
          lead_type: String(editForm.lead_type || "").trim() || null,
          consultant: String(editForm.consultant || "").trim() || null,
          agent: String(editForm.agent || "").trim() || null,
          lead_source: String(editForm.lead_source || "").trim() || null,
          client_name: String(editForm.client_name || "").trim() || null,
          client_email: String(editForm.client_email || "").trim() || null,
          client_cellphone: String(editForm.client_cellphone || "").trim() || null,
          loan_amount: String(editForm.loan_amount || "").trim() || null,
          bond_amount: String(editForm.bond_amount || "").trim() || null,
          purchase_price: String(editForm.purchase_price || "").trim() || null,
          follow_up_date: String(editForm.follow_up_date || "").trim() || null,
          notes: String(editForm.notes || "").trim(),
        }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to update follow-up.");
      const updatedRow = json?.row as PipelineRow | undefined;
      setRows((prev) => prev.map((r) => (r.id === editLead.id ? { ...r, ...(updatedRow || {}) } : r)));
      setEditLead(null);
    } catch (e: any) {
      setEditErr(e?.message || "Failed to update follow-up.");
    } finally {
      setEditSaving(false);
    }
  }

  async function saveLead() {
    setSaving(true);
    setMsg(null);
    const row: PipelineRow = {
      lead_date: form.lead_date,
      lead_type: form.lead_type,
      consultant: form.consultant,
      agent: form.agent,
      client_name: form.client_name,
      loan_amount: form.loan_amount,
      notes: form.notes,
      follow_up_date: form.follow_up_date,
    };
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Save failed");
      const saved = json?.row as PipelineRow | undefined;
      setRows((prev) => [saved || row, ...prev]);
      setForm({
        lead_date: "",
        lead_type: "",
        consultant: "",
        agent: "",
        lead_source: "",
        client_name: "",
        client_email: "",
        client_cellphone: "",
        loan_amount: "",
        bond_amount: "",
        purchase_price: "",
        notes: "",
        follow_up_date: "",
      });
      setMsg("Saved.");
    } catch {
      setMsg("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const pipelineConsultantOptions = useMemo(() => {
    const names = (rows || []).map((row) => cleanText(row.consultant)).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const list = rows || [];
    const q = query.trim().toLowerCase();
    return list.filter((r) => {
      const typeOk = typeFilter ? String(r.lead_type || "") === typeFilter : true;
      const consultantOk = consultantFilter ? cleanText(r.consultant).toLowerCase() === consultantFilter.toLowerCase() : true;
      const rawDate = String(r.lead_date || "").trim();
      const textOk = q ? pipelineSearchText(r).includes(q) : true;
      if (!typeOk || !consultantOk || !textOk) return false;
      if (!fromDate && !toDate) return true;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) return false;
      const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [rows, fromDate, toDate, typeFilter, consultantFilter, query]);

  const followUpRows = useMemo(() => {
    return (rows || []).filter((r) => {
      const raw = String(r.follow_up_date || "").trim();
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      return true;
    }).sort((a, b) => {
      const da = new Date(String(a.follow_up_date || ""));
      const db = new Date(String(b.follow_up_date || ""));
      return da.getTime() - db.getTime();
    });
  }, [rows]);

  const pipelineExportRows = filteredRows.map((row) => [
    pipelineEditableValue(row, "lead_date"),
    pipelineEditableValue(row, "lead_type"),
    pipelineEditableValue(row, "consultant"),
    pipelineEditableValue(row, "agent"),
    pipelineEditableValue(row, "lead_source"),
    pipelineEditableValue(row, "client_name"),
    pipelineEditableValue(row, "client_email"),
    pipelineEditableValue(row, "client_cellphone"),
    pipelineEditableValue(row, "loan_amount"),
    pipelineEditableValue(row, "bond_amount"),
    pipelineEditableValue(row, "purchase_price"),
    pipelineEditableValue(row, "follow_up_date"),
    pipelineEditableValue(row, "notes"),
  ]);

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-2 py-4 md:px-3 md:py-6 xl:px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#142037]/55">Pipeline</div>
          <div className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#142037]">Pipeline Leads</div>
          <div className="mt-2 text-sm font-medium text-slate-500">Live pipeline leads</div>
        </div>
        <a
          href="/pipeline?add=1"
          className="rounded-2xl bg-[#142037] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#1a2a49]"
        >
          + Add to Pipeline
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 bg-[#f8fafc] px-4 py-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#142037]/65">Filters</div>
        </div>
        <div className="flex flex-wrap items-end gap-2 px-4 py-3">
          <label className="grid gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/55">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Client, agent, notes"
              className="h-8 w-[190px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold text-black outline-none placeholder:text-black/35 focus:border-[#142037]/40 focus:ring-2 focus:ring-[#142037]/10"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/55">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-[138px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold text-black outline-none focus:border-[#142037]/40 focus:ring-2 focus:ring-[#142037]/10"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/55">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-[138px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold text-black outline-none focus:border-[#142037]/40 focus:ring-2 focus:ring-[#142037]/10"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/55">Lead Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 w-[150px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold text-black outline-none focus:border-[#142037]/40 focus:ring-2 focus:ring-[#142037]/10"
            >
              <option value="">All</option>
              <option value="New App">New App</option>
              <option value="Pre-approval">Pre-approval</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/55">Consultant</span>
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="h-8 w-[150px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold text-black outline-none focus:border-[#142037]/40 focus:ring-2 focus:ring-[#142037]/10"
            >
              <option value="">All</option>
              {pipelineConsultantOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFromDate("");
              setToDate("");
              setTypeFilter("");
              setConsultantFilter("");
            }}
            className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black hover:border-black/25 hover:bg-black/[0.02]"
          >
            Clear
          </button>
          <div className="flex h-8 items-center rounded-lg bg-[#142037]/5 px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#142037]/70">
            Showing {filteredRows.length} lead(s)
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={followUpsOpen}
          onClick={() => setFollowUpsOpen((prev) => !prev)}
          className="flex w-full flex-wrap items-center justify-between gap-3 bg-[#142037] px-5 py-4 text-left text-white hover:bg-[#1b2b4b]"
        >
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.14em]">Follow-ups due (all pending)</div>
            <div className="mt-1 text-xs font-semibold text-white/70">
              {followUpRows.length ? `${followUpRows.length} lead(s) need follow-up.` : "No pending follow-ups."}
            </div>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 text-xs font-extrabold text-white">
            {followUpsOpen ? "^" : "v"}
          </span>
        </button>

        {followUpsOpen ? (
          <div className="overflow-hidden border-t border-black/80 bg-white">
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <colgroup>
                  <col className="w-[240px]" />
                  <col className="w-[150px]" />
                  <col className="w-[130px]" />
                  <col className="w-[330px]" />
                  <col className="w-[130px]" />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#f3f3f3] text-[11px] font-bold text-black">
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Client")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Consultant")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Due Date")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Notes")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3] text-center")}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpRows.length === 0 ? (
                    <tr>
                      <td className={pipelineCellBase("text-center font-semibold text-black/50")} colSpan={5}>
                        No pending follow-ups.
                      </td>
                    </tr>
                  ) : (
                    followUpRows.map((r, idx) => (
                      <tr key={r.id ?? `${r.client_name}-${idx}`} className="bg-white hover:bg-[#fffce8]">
                        <td className={pipelineCellBase("font-semibold text-black")}>{r.client_name || "-"}</td>
                        <td className={pipelineCellBase("font-semibold text-black")}>{r.consultant || "-"}</td>
                        <td className={pipelineCellBase("whitespace-nowrap font-bold text-black")}>{dateLabel(r.follow_up_date)}</td>
                        <td className={pipelineCellBase("whitespace-pre-wrap text-black")}>{r.notes || ""}</td>
                        <td className={pipelineCellBase("text-center")}>
                          <div className="flex flex-wrap justify-center gap-1">
                            <button
                              type="button"
                              className="min-h-[22px] border border-black/40 bg-white px-2 text-[10px] font-bold uppercase text-black hover:bg-black/[0.06]"
                              onClick={() => setViewLead(r)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="min-h-[22px] border border-black/40 bg-white px-2 text-[10px] font-bold uppercase text-black hover:bg-black/[0.06]"
                              onClick={() => openEditFollowUp(r)}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold text-black">Add to Pipeline</div>
          <div className="mt-1 text-xs font-semibold text-black/60">Inputs match the table below.</div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-extrabold text-black/70">Lead Date</div>
              <input type="date" value={form.lead_date} onChange={(e) => updateForm("lead_date", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Lead Type</div>
              <select value={form.lead_type} onChange={(e) => updateForm("lead_type", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30">
                <option value="">Select</option>
                <option value="New App">New App</option>
                <option value="Pre-approval">Pre-approval</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Consultant</div>
              <select value={form.consultant} onChange={(e) => updateForm("consultant", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30">
                <option value="">Select</option>
                {consultantOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Agent</div>
              <input value={form.agent} onChange={(e) => updateForm("agent", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Lead Source</div>
              <select value={form.lead_source} onChange={(e) => updateForm("lead_source", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30">
                <option value="">Select</option>
                <option value="Website">Website</option>
                <option value="Inbound call">Inbound call</option>
                <option value="Outbound call">Outbound call</option>
                <option value="Agent">Agent</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Client Name</div>
              <input value={form.client_name} onChange={(e) => updateForm("client_name", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Client Email</div>
              <input type="email" value={form.client_email} onChange={(e) => updateForm("client_email", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Client Cellphone</div>
              <input type="tel" value={form.client_cellphone} onChange={(e) => updateForm("client_cellphone", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Loan Amount</div>
              <input value={form.loan_amount} onChange={(e) => updateForm("loan_amount", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Purchase Price</div>
              <input value={form.purchase_price} onChange={(e) => updateForm("purchase_price", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-extrabold text-black/70">Notes</div>
              <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} className="mt-2 h-24 w-full resize-none rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Follow up date</div>
              <input type="date" value={form.follow_up_date} onChange={(e) => updateForm("follow_up_date", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={saveLead}
              disabled={saving}
              className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <a className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20" href="/pipeline">
              Cancel
            </a>
          </div>
          {msg ? (
            <div className="mt-3 text-xs font-semibold text-black/60">{msg}</div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#142037] px-5 py-4 text-white">
          <button
            type="button"
            aria-expanded={pipelineDealsOpen}
            onClick={() => setPipelineDealsOpen((prev) => !prev)}
            className="min-w-[220px] flex-1 text-left"
          >
            <div className="text-sm font-bold uppercase tracking-[0.14em]">Pipeline Deals</div>
            <div className="mt-1 text-xs font-semibold text-white/70">
              {filteredRows.length} lead{filteredRows.length === 1 ? "" : "s"} shown · Autosave enabled
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportRowsToExcel("pipeline-deals", "Pipeline Deals", PIPELINE_EXPORT_HEADERS, pipelineExportRows)}
              className="h-8 border border-white/25 bg-white/10 px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white hover:bg-white/15"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => exportRowsToPdf("Pipeline Deals", PIPELINE_EXPORT_HEADERS, pipelineExportRows)}
              className="h-8 border border-white/25 bg-white/10 px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white hover:bg-white/15"
            >
              Export PDF
            </button>
            <button
              type="button"
              aria-label={pipelineDealsOpen ? "Collapse pipeline deals" : "Expand pipeline deals"}
              onClick={() => setPipelineDealsOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 text-xs font-extrabold text-white hover:bg-white/10"
            >
              {pipelineDealsOpen ? "^" : "v"}
            </button>
          </div>
        </div>
        {pipelineDealsOpen ? (
          <div className="overflow-hidden border-t border-black/80 bg-white">
            <div
              ref={pipelineScrollerRef}
              tabIndex={0}
              aria-label="Pipeline deals spreadsheet"
              onKeyDown={handlePipelineGridKeyDown}
              className="max-h-[calc(100vh-285px)] overflow-auto outline-none focus:ring-2 focus:ring-[#142037]/30"
            >
              <table className="w-full min-w-[2200px] border-collapse text-left">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[170px]" />
                  <col className="w-[150px]" />
                  <col className="w-[230px]" />
                  <col className="w-[230px]" />
                  <col className="w-[150px]" />
                  <col className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[350px]" />
                  <col className="w-[250px]" />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#f3f3f3] text-[11px] font-bold text-black">
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Lead Date")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Lead Type")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Consultant")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Agent")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Lead Source")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Client Name")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Client Email")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Cellphone")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3] text-right")}>{filterLabel("Loan Amount")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3] text-right")}>{filterLabel("Bond Amount")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3] text-right")}>{filterLabel("Purchase Price")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Follow Up")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3]")}>{filterLabel("Notes")}</th>
                    <th className={pipelineCellBase("bg-[#f3f3f3] text-center")}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td className={pipelineCellBase("text-center font-semibold text-black/50")} colSpan={14}>
                        No pipeline deals found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, i) => {
                      const rowId = cleanText(r.id);
                      const rowKey = rowId || `${r.client_name}-${i}`;
                      const leadTypeOptions = optionsWithCurrent(
                        PIPELINE_FIELD_OPTIONS.lead_type || [],
                        pipelineEditableValue(r, "lead_type")
                      ).map((value) => ({ value, label: value || "Select" }));
                      const leadSourceOptions = optionsWithCurrent(
                        PIPELINE_FIELD_OPTIONS.lead_source || [],
                        pipelineEditableValue(r, "lead_source")
                      ).map((value) => ({ value, label: value || "Select" }));
                      const consultantSelectOptions = optionsWithCurrent(
                        ["", ...consultantOptions],
                        pipelineEditableValue(r, "consultant")
                      ).map((value) => ({ value, label: value || "Select" }));

                      return (
                        <tr key={rowKey} className="bg-white hover:bg-[#fffce8]">
                          <td className={pipelineCellBase("whitespace-nowrap text-black")}>
                            <EditableInput
                              type="date"
                              value={pipelineEditableValue(r, "lead_date")}
                              state={saveStates[pipelineCellKey(rowId, "lead_date")]}
                              onChange={(value) => updatePipelineCell(r, "lead_date", value)}
                              onCommit={() => updatePipelineCell(r, "lead_date", pipelineEditableValue(r, "lead_date"), true)}
                            />
                          </td>
                          <td className={pipelineCellBase("text-black")}>
                            <EditableSelect
                              value={pipelineEditableValue(r, "lead_type")}
                              state={saveStates[pipelineCellKey(rowId, "lead_type")]}
                              onChange={(value) => updatePipelineCell(r, "lead_type", value, true)}
                              options={leadTypeOptions}
                            />
                          </td>
                          <td className={pipelineCellBase("text-black")}>
                            <EditableSelect
                              value={pipelineEditableValue(r, "consultant")}
                              state={saveStates[pipelineCellKey(rowId, "consultant")]}
                              onChange={(value) => updatePipelineCell(r, "consultant", value, true)}
                              options={consultantSelectOptions}
                            />
                          </td>
                          <td className={pipelineCellBase("text-black")}>
                            <EditableInput
                              value={pipelineEditableValue(r, "agent")}
                              state={saveStates[pipelineCellKey(rowId, "agent")]}
                              onChange={(value) => updatePipelineCell(r, "agent", value)}
                              onCommit={() => updatePipelineCell(r, "agent", pipelineEditableValue(r, "agent"), true)}
                            />
                          </td>
                          <td className={pipelineCellBase("text-black")}>
                            <EditableSelect
                              value={pipelineEditableValue(r, "lead_source")}
                              state={saveStates[pipelineCellKey(rowId, "lead_source")]}
                              onChange={(value) => updatePipelineCell(r, "lead_source", value, true)}
                              options={leadSourceOptions}
                            />
                          </td>
                          <td className={pipelineCellBase("text-black")}>
                            <EditableInput
                              value={pipelineEditableValue(r, "client_name")}
                              state={saveStates[pipelineCellKey(rowId, "client_name")]}
                              onChange={(value) => updatePipelineCell(r, "client_name", value)}
                              onCommit={() => updatePipelineCell(r, "client_name", pipelineEditableValue(r, "client_name"), true)}
                            />
                          </td>
                          <td className={pipelineCellBase("text-black")}>
                            <EditableInput
                              value={pipelineEditableValue(r, "client_email")}
                              state={saveStates[pipelineCellKey(rowId, "client_email")]}
                              onChange={(value) => updatePipelineCell(r, "client_email", value)}
                              onCommit={() => updatePipelineCell(r, "client_email", pipelineEditableValue(r, "client_email"), true)}
                            />
                          </td>
                          <td className={pipelineCellBase("text-black")}>
                            <EditableInput
                              value={pipelineEditableValue(r, "client_cellphone")}
                              state={saveStates[pipelineCellKey(rowId, "client_cellphone")]}
                              onChange={(value) => updatePipelineCell(r, "client_cellphone", value)}
                              onCommit={() => updatePipelineCell(r, "client_cellphone", pipelineEditableValue(r, "client_cellphone"), true)}
                            />
                          </td>
                          <td className={pipelineCellBase("whitespace-nowrap text-right text-black")}>
                            <EditableInput
                              value={pipelineEditableValue(r, "loan_amount")}
                              state={saveStates[pipelineCellKey(rowId, "loan_amount")]}
                              onChange={(value) => updatePipelineCell(r, "loan_amount", value)}
                              onCommit={() => updatePipelineCell(r, "loan_amount", pipelineEditableValue(r, "loan_amount"), true)}
                              className="text-right"
                            />
                          </td>
                          <td className={pipelineCellBase("whitespace-nowrap text-right text-black")}>
                            <EditableInput
                              value={pipelineEditableValue(r, "bond_amount")}
                              state={saveStates[pipelineCellKey(rowId, "bond_amount")]}
                              onChange={(value) => updatePipelineCell(r, "bond_amount", value)}
                              onCommit={() => updatePipelineCell(r, "bond_amount", pipelineEditableValue(r, "bond_amount"), true)}
                              className="text-right"
                            />
                          </td>
                          <td className={pipelineCellBase("whitespace-nowrap text-right text-black")}>
                            <EditableInput
                              value={pipelineEditableValue(r, "purchase_price")}
                              state={saveStates[pipelineCellKey(rowId, "purchase_price")]}
                              onChange={(value) => updatePipelineCell(r, "purchase_price", value)}
                              onCommit={() => updatePipelineCell(r, "purchase_price", pipelineEditableValue(r, "purchase_price"), true)}
                              className="text-right"
                            />
                          </td>
                          <td className={pipelineCellBase("whitespace-nowrap text-black")}>
                            <EditableInput
                              type="date"
                              value={pipelineEditableValue(r, "follow_up_date")}
                              state={saveStates[pipelineCellKey(rowId, "follow_up_date")]}
                              onChange={(value) => updatePipelineCell(r, "follow_up_date", value)}
                              onCommit={() => updatePipelineCell(r, "follow_up_date", pipelineEditableValue(r, "follow_up_date"), true)}
                            />
                          </td>
                          <td className={pipelineCellBase("whitespace-pre-wrap text-black")}>
                            <EditableTextarea
                              value={pipelineEditableValue(r, "notes")}
                              state={saveStates[pipelineCellKey(rowId, "notes")]}
                              onChange={(value) => updatePipelineCell(r, "notes", value)}
                              onCommit={() => updatePipelineCell(r, "notes", pipelineEditableValue(r, "notes"), true)}
                            />
                          </td>
                          <td className={pipelineCellBase("text-center")}>
                            <div className="flex flex-wrap justify-center gap-1">
                              <button
                                type="button"
                                className="min-h-[22px] border border-black/40 bg-white px-2 text-[10px] font-bold uppercase text-black hover:bg-black/[0.06]"
                                onClick={() => setViewLead(r)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="min-h-[22px] bg-black px-2 text-[10px] font-bold uppercase text-white hover:opacity-90"
                                onClick={() => openMove(r)}
                              >
                                Move
                              </button>
                              <button
                                type="button"
                                className="min-h-[22px] border border-black/40 bg-white px-2 text-[10px] font-bold uppercase text-black hover:bg-black/[0.06]"
                                onClick={() => openEditFollowUp(r)}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {viewLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="text-sm font-extrabold text-black">Pipeline Lead</div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(viewLead).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">{k.replace(/_/g, " ")}</div>
                  <div className="text-sm font-semibold text-black">{String(v ?? "")}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
                onClick={() => setViewLead(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="text-sm font-extrabold text-black">Move Lead to Submitted</div>
            <div className="mt-1 text-xs font-semibold text-black/60">
              Only missing fields require input. Existing lead data will be carried over.
            </div>

            {moveErr ? <div className="mt-2 text-xs font-semibold text-red-600">{moveErr}</div> : null}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-extrabold text-black/70">Ops number</div>
                <input
                  value={moveForm.deal_deck_id}
                  onChange={(e) => updateMoveForm("deal_deck_id", e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </div>
              {!moveForm.amount_zar ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Loan Amount (ZAR)</div>
                <input value={moveForm.amount_zar} onChange={(e) => updateMoveForm("amount_zar", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Loan Amount (ZAR)</div>
                  <div className="text-sm font-semibold text-black">{moveForm.amount_zar}</div>
                </div>
              )}
              {!moveForm.purchase_price ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Purchase Price</div>
                <input value={moveForm.purchase_price} onChange={(e) => updateMoveForm("purchase_price", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Purchase Price</div>
                  <div className="text-sm font-semibold text-black">{moveForm.purchase_price}</div>
                </div>
              )}
              {!moveForm.applicant ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Applicant</div>
                <input value={moveForm.applicant} onChange={(e) => updateMoveForm("applicant", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Applicant</div>
                  <div className="text-sm font-semibold text-black">{moveForm.applicant}</div>
                </div>
              )}
              {!moveForm.consultant ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Consultant</div>
                <select value={moveForm.consultant} onChange={(e) => updateMoveForm("consultant", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30">
                  <option value="">Select</option>
                  {consultantOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Consultant</div>
                  <div className="text-sm font-semibold text-black">{moveForm.consultant}</div>
                </div>
              )}
              {!moveForm.agent ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Lead Source</div>
                <input value={moveForm.agent} onChange={(e) => updateMoveForm("agent", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Lead Source</div>
                  <div className="text-sm font-semibold text-black">{moveForm.agent}</div>
                </div>
              )}
              {!moveForm.submitted_date ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Date</div>
                <input type="date" value={moveForm.submitted_date} onChange={(e) => updateMoveForm("submitted_date", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Date</div>
                  <div className="text-sm font-semibold text-black">{moveForm.submitted_date}</div>
                </div>
              )}
              {!moveForm.bond_due_date ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Bond Due Date</div>
                <input type="date" value={moveForm.bond_due_date} onChange={(e) => updateMoveForm("bond_due_date", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Bond Due Date</div>
                  <div className="text-sm font-semibold text-black">{moveForm.bond_due_date}</div>
                </div>
              )}
              {!moveForm.client_email ? (
                <div>
                  <div className="text-xs font-extrabold text-black/70">Client Email</div>
                  <input value={moveForm.client_email} onChange={(e) => updateMoveForm("client_email", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
                </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Client Email</div>
                  <div className="text-sm font-semibold text-black">{moveForm.client_email}</div>
                </div>
              )}
              {!moveForm.client_cellphone ? (
                <div>
                  <div className="text-xs font-extrabold text-black/70">Client Cellphone</div>
                  <input value={moveForm.client_cellphone} onChange={(e) => updateMoveForm("client_cellphone", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
                </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Client Cellphone</div>
                  <div className="text-sm font-semibold text-black">{moveForm.client_cellphone}</div>
                </div>
              )}
              {!moveForm.client_main_bank ? (
                <div>
                <div className="text-xs font-extrabold text-black/70">Client Main Bank</div>
                <select value={moveForm.client_main_bank} onChange={(e) => updateMoveForm("client_main_bank", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30">
                  <option value="">Select</option>
                  <option value="FNB">FNB</option>
                  <option value="INVESTEC">INVESTEC</option>
                  <option value="NEDBANK">NEDBANK</option>
                  <option value="STANDARD BANK">STANDARD BANK</option>
                  <option value="ABSA">ABSA</option>
                  <option value="Other">Other</option>
                </select>
                {moveForm.client_main_bank === "Other" ? (
                  <input value={moveForm.client_main_bank_other} onChange={(e) => updateMoveForm("client_main_bank_other", e.target.value)} placeholder="Type bank name" className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30" />
                ) : null}
              </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-black/45">Client Main Bank</div>
                  <div className="text-sm font-semibold text-black">{moveForm.client_main_bank}</div>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={submitMoveToSubmitted}
                disabled={moveSaving}
                className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-60"
              >
                {moveSaving ? "Moving..." : "Move"}
              </button>
              <button
                onClick={() => setMoveLead(null)}
                className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="text-sm font-extrabold text-black">Edit Follow-up</div>
            <div className="mt-1 text-xs font-semibold text-black/60">
              Update all lead and client details for this pipeline lead.
            </div>

            {editErr ? <div className="mt-2 text-xs font-semibold text-red-600">{editErr}</div> : null}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-xs font-extrabold text-black/60">
                Lead date
                <input
                  type="date"
                  value={editForm.lead_date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lead_date: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Lead type
                <select
                  value={editForm.lead_type}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lead_type: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                >
                  <option value="">Select</option>
                  <option value="New App">New App</option>
                  <option value="Pre-approval">Pre-approval</option>
                </select>
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Consultant
                <select
                  value={editForm.consultant}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, consultant: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                >
                  <option value="">Select</option>
                  {consultantOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Agent
                <input
                  value={editForm.agent}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, agent: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Lead source
                <select
                  value={editForm.lead_source}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lead_source: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                >
                  <option value="">Select</option>
                  <option value="Website">Website</option>
                  <option value="Inbound call">Inbound call</option>
                  <option value="Outbound call">Outbound call</option>
                  <option value="Agent">Agent</option>
                </select>
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Client name
                <input
                  value={editForm.client_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, client_name: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Client email
                <input
                  type="email"
                  value={editForm.client_email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, client_email: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Client cellphone
                <input
                  type="tel"
                  value={editForm.client_cellphone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, client_cellphone: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Loan amount
                <input
                  value={editForm.loan_amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, loan_amount: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Bond amount
                <input
                  value={editForm.bond_amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, bond_amount: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Purchase price
                <input
                  value={editForm.purchase_price}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, purchase_price: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60">
                Follow-up date
                <input
                  type="date"
                  value={editForm.follow_up_date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, follow_up_date: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
              <label className="text-xs font-extrabold text-black/60 md:col-span-2">
                Notes
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={5}
                  className="mt-2 w-full resize-none rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black outline-none focus:border-black/30"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveFollowUpEdits}
                disabled={editSaving}
                className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-60"
              >
                {editSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditLead(null)}
                className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
