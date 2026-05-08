"use client";

import { Fragment, type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useDeals } from "@/app/_components/useDeals";
import { exportRowsToExcel, exportRowsToPdf } from "@/app/lib/exportDeals";

type DealAny = any;
type BankKey = "ABSA" | "FNB" | "NEDBANK" | "STANDARD BANK" | "OTHER";
type DealField =
  | "submitted_date"
  | "consultant"
  | "agent"
  | "deal_ref"
  | "client_name"
  | "insurance"
  | "purchase_price"
  | "amount_zar";

type SaveState = { status: "pending" | "saving" | "saved" | "error"; message?: string };

const BANKS: Array<{ key: BankKey; label: string; className: string }> = [
  { key: "ABSA", label: "ABSA", className: "bg-[#ff1010] text-black" },
  { key: "FNB", label: "FNB", className: "bg-[#16dfe4] text-black" },
  { key: "NEDBANK", label: "NEDBANK", className: "bg-[#80d044] text-black" },
  { key: "STANDARD BANK", label: "STANDARD BANK", className: "bg-[#16a5d8] text-black" },
  { key: "OTHER", label: "OTHER", className: "bg-[#d9d9d9] text-black" },
];

const STAGE_GROUPS = [
  { key: "instructed", label: "INSTRUCTED", tone: "blue" },
  { key: "granted", label: "GRANTED", tone: "blue" },
  { key: "aip", label: "AIP", tone: "blue" },
  { key: "submitted", label: "SUBMITTED", tone: "blue" },
  { key: "ntu", label: "NTU / CANCELLED", tone: "red" },
  { key: "registrations", label: "REGISTRATIONS", tone: "blue" },
  { key: "pipeline", label: "PIPELINE DEALS", tone: "blue" },
] as const;

const MOVE_STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "aip", label: "AIP" },
  { key: "instructed", label: "Instructed" },
  { key: "granted", label: "Granted" },
  { key: "registrations", label: "Registrations" },
  { key: "ntu", label: "NTU / Cancelled" },
] as const;

const OVERVIEW_EXPORT_HEADERS = [
  "Stage",
  "App Date",
  "Consultant",
  "Agent",
  "Deal Reference",
  "Client Name",
  "Insurance",
  "Purchase Price",
  "Loan Amount",
  "ABSA",
  "FNB",
  "NEDBANK",
  "STANDARD BANK",
  "OTHER",
];

function normalizeStage(v: unknown) {
  const raw = String(v ?? "").trim().toLowerCase();
  if (!raw) return "submitted";
  if (raw === "iap") return "aip";
  if (raw === "instruction" || raw === "instructions" || raw === "instruct") return "instructed";
  if (raw === "grant" || raw === "approved") return "granted";
  if (raw === "registration" || raw === "register" || raw === "regs" || raw === "reg") return "registrations";
  if (raw === "cancelled" || raw === "canceled" || raw === "declined") return "ntu";
  if (raw.includes("pipeline")) return "pipeline";
  return raw;
}

function groupKeyForStage(stage: unknown) {
  const normalized = normalizeStage(stage);
  return STAGE_GROUPS.some((group) => group.key === normalized) ? normalized : "pipeline";
}

function stageExportLabel(stage: unknown) {
  const key = groupKeyForStage(stage);
  return STAGE_GROUPS.find((group) => group.key === key)?.label || key.toUpperCase();
}

function cleanText(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s || s === "-" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s
    .replace(/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\s*-\s*/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/i, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function toNumber(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v ?? "").replace(/[^\d.-]/g, "");
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function moneyZar(v: unknown) {
  const n = toNumber(v);
  if (!n) return "";
  return `R${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;
}

function parseDateValue(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return null;

  if (/^\d{1,2}-[a-zA-Z]{3}-\d{2,4}$/.test(raw)) {
    const [dayPart, monthPart, yearPart] = raw.split("-");
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
      monthPart.toLowerCase()
    );
    const yearNumber = Number(yearPart);
    const fullYear = yearPart.length === 2 ? 2000 + yearNumber : yearNumber;
    const date = new Date(fullYear, month, Number(dayPart), 12);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateForSave(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = parseDateValue(raw);
  if (!date) return raw;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function pickDateRaw(d: DealAny) {
  return d?.submitted_date ?? d?.submittedDate ?? d?.submitted_at ?? d?.created_at ?? d?.createdAt ?? "";
}

function formatAppDate(d: DealAny) {
  const date = parseDateValue(pickDateRaw(d));
  if (!date) return "";
  const day = String(date.getDate());
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function dateSortValue(d: DealAny) {
  return parseDateValue(pickDateRaw(d))?.getTime() ?? 0;
}

function inDateRange(d: DealAny, from: string, to: string) {
  if (!from && !to) return true;
  const date = parseDateValue(pickDateRaw(d));
  if (!date) return false;
  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  const toDate = to ? new Date(`${to}T23:59:59`) : null;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function pickConsultant(d: DealAny) {
  return cleanText(d?.consultant ?? d?.consultant_name ?? d?.consultantName);
}

function pickAgent(d: DealAny) {
  return cleanText(d?.agent_name ?? d?.agentName ?? d?.agent);
}

function pickDealRef(d: DealAny) {
  return cleanText(
    d?.deal_ref ??
      d?.dealRef ??
      d?.deal_reference ??
      d?.dealReference ??
      d?.deal_code ??
      d?.deal_deck_id ??
      d?.dealDeckId ??
      d?.reference
  );
}

function pickClientName(d: DealAny) {
  return cleanText(d?.client_name ?? d?.clientName ?? d?.applicant ?? d?.applicant_name ?? d?.applicantName);
}

function pickPurchasePrice(d: DealAny) {
  return moneyZar(d?.purchase_price ?? d?.purchasePrice ?? d?.purchase_amount ?? d?.purchaseAmount ?? d?.price);
}

function pickLoanAmountValue(d: DealAny) {
  return toNumber(d?.amount_zar ?? d?.amountZar ?? d?.amount ?? d?.loan_amount ?? d?.loanAmount);
}

function pickLoanAmount(d: DealAny) {
  return moneyZar(pickLoanAmountValue(d));
}

function pickInsurance(d: DealAny) {
  const fileName = cleanText(d?.insurance_document_name ?? d?.insuranceDocumentName);
  if (fileName) return fileName;
  const needed = d?.insurance_needed ?? d?.insuranceNeeded;
  if (needed === true || String(needed).toLowerCase() === "true") return "YES";
  if (needed === false || String(needed).toLowerCase() === "false") return "NO";
  return "";
}

function insurancePickerValue(d: DealAny) {
  const needed = d?.insurance_needed ?? d?.insuranceNeeded;
  const fileName = cleanText(d?.insurance_document_name ?? d?.insuranceDocumentName);
  if (needed === true || String(needed).toLowerCase() === "true" || fileName) return "YES";
  return "NO";
}

function parseBoolText(value: string) {
  const text = value.trim().toLowerCase();
  if (["yes", "y", "true", "on", "1"].includes(text)) return true;
  if (["no", "n", "false", "off", "0", ""].includes(text)) return false;
  return null;
}

function bankAliases(bank: BankKey) {
  if (bank === "ABSA") return ["absa"];
  if (bank === "FNB") return ["fnb", "first national"];
  if (bank === "NEDBANK") return ["nedbank"];
  if (bank === "STANDARD BANK") return ["standard bank", "standard"];
  return ["other", "investec", "capitec"];
}

function normalizeBankName(value: unknown): BankKey | null {
  const text = cleanText(value).toLowerCase();
  if (!text) return null;
  if (text.includes("absa")) return "ABSA";
  if (text.includes("fnb") || text.includes("first national")) return "FNB";
  if (text.includes("nedbank")) return "NEDBANK";
  if (text.includes("standard")) return "STANDARD BANK";
  if (text.includes("other") || text.includes("investec") || text.includes("capitec")) return "OTHER";
  return "OTHER";
}

function matchesBank(value: unknown, bank: BankKey) {
  return normalizeBankName(value) === bank;
}

function addUnique(parts: string[], value: unknown, prefix?: string) {
  const text = cleanText(value);
  if (!text) return;
  const next = prefix ? `${prefix}: ${text}` : text;
  const key = next.toLowerCase();
  if (parts.some((part) => part.toLowerCase() === key)) return;
  parts.push(next);
}

function extractBankSpecificLines(value: unknown, bank: BankKey) {
  const raw = cleanText(value);
  if (!raw) return [];
  const aliases = bankAliases(bank);
  return raw
    .split("\n")
    .map((line) => cleanText(line))
    .filter((line) => {
      const lower = line.toLowerCase();
      return aliases.some((alias) => lower.includes(alias));
    })
    .map((line) => line.replace(/^(absa|fnb|nedbank|standard bank|standard)\s*[:=-]\s*/i, "").trim())
    .filter(Boolean);
}

function addBankMapNotes(parts: string[], value: unknown, bank: BankKey) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const [name, note] of Object.entries(value as Record<string, unknown>)) {
    if (matchesBank(name, bank)) addUnique(parts, note);
  }
}

function collectBankNotes(d: DealAny, bank: BankKey) {
  const globalParts: string[] = [];
  const bankNotes = Array.isArray(d?.bank_notes_rows) ? d.bank_notes_rows : [];

  for (const row of bankNotes) {
    if (normalizeStage(row?.stage) !== "global") continue;
    if (!matchesBank(row?.bank_name ?? row?.bankName ?? row?.name ?? row?.bank, bank)) continue;
    addUnique(globalParts, row?.bank_notes ?? row?.bankNotes);
    addUnique(globalParts, row?.bank_reference ?? row?.bankReference, "Ref");
  }

  if (globalParts.length) return globalParts.slice(0, 6).join("\n");

  const parts: string[] = [];
  const dealBanks = Array.isArray(d?.deal_banks) ? d.deal_banks : [];

  for (const row of dealBanks) {
    if (!matchesBank(row?.bank_name ?? row?.bankName ?? row?.name ?? row?.bank, bank)) continue;
    addUnique(parts, row?.bank_notes ?? row?.bankNotes);
    addUnique(parts, row?.attorney, "Attorney Instructed");
    addUnique(parts, row?.attorney_note ?? row?.attorneyNote);
    addUnique(parts, row?.reference_number ?? row?.referenceNumber, "Ref");
  }

  for (const row of bankNotes) {
    if (!matchesBank(row?.bank_name ?? row?.bankName ?? row?.name ?? row?.bank, bank)) continue;
    const stage = normalizeStage(row?.stage);
    const prefix = stage && stage !== "global" ? stage.toUpperCase() : undefined;
    addUnique(parts, row?.bank_notes ?? row?.bankNotes, prefix);
    addUnique(parts, row?.bank_reference ?? row?.bankReference, "Ref");
  }

  for (const line of extractBankSpecificLines(d?.bank_notes ?? d?.bankNotes, bank)) addUnique(parts, line);
  for (const line of extractBankSpecificLines(d?.aip_bank_notes ?? d?.aipBankNotes, bank)) addUnique(parts, line, "AIP");
  for (const line of extractBankSpecificLines(d?.granted_bank_notes ?? d?.grantedBankNotes, bank)) addUnique(parts, line, "Final");
  for (const line of extractBankSpecificLines(d?.instructed_bank_notes ?? d?.instructedBankNotes, bank)) addUnique(parts, line, "Instructed");
  for (const line of extractBankSpecificLines(d?.registration_bank_notes ?? d?.registrationBankNotes, bank)) addUnique(parts, line, "Registration");

  const moveHistory = Array.isArray(d?.move_history) ? d.move_history : [];
  for (let i = moveHistory.length - 1; i >= 0 && parts.length < 6; i--) {
    const data = moveHistory[i]?.data && typeof moveHistory[i].data === "object" ? moveHistory[i].data : null;
    if (!data) continue;
    addBankMapNotes(parts, data?.bank_by_name, bank);
    addBankMapNotes(parts, data?.bankByName, bank);
    for (const line of extractBankSpecificLines(data?.bank_notes, bank)) addUnique(parts, line);
    for (const line of extractBankSpecificLines(data?.aip_bank_notes, bank)) addUnique(parts, line, "AIP");
    for (const line of extractBankSpecificLines(data?.granted_bank_notes, bank)) addUnique(parts, line, "Final");
    for (const line of extractBankSpecificLines(data?.instructed_bank_notes, bank)) addUnique(parts, line, "Instructed");
    for (const line of extractBankSpecificLines(data?.registration_bank_notes, bank)) addUnique(parts, line, "Registration");
  }

  if (!parts.length && matchesBank(d?.bank ?? d?.bank_name ?? d?.bankName ?? d?.client_main_bank, bank)) {
    addUnique(parts, cleanText(d?.status));
  }

  return parts.slice(0, 6).join("\n");
}

function bankCellClass(text: string) {
  const lower = text.toLowerCase();
  if (!text) return "";
  if (
    lower.includes("declin") ||
    lower.includes("withdraw") ||
    lower.includes("ntu") ||
    lower.includes("restricted") ||
    lower.includes("shortfall") ||
    lower.includes("affordability") ||
    lower.includes("outstanding")
  ) {
    return "font-semibold text-red-600";
  }
  if (lower.includes("waiting") || lower.includes("awaiting") || lower.includes("more docs")) {
    return "bg-yellow-100 font-semibold text-red-600";
  }
  if (lower.includes("final") || lower.includes("approved") || lower.includes("matched") || lower.includes("granted")) {
    return "font-semibold text-black";
  }
  return "text-black";
}

function filterLabel(label: string) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-[8px] leading-none text-black/55">v</span>
    </span>
  );
}

function searchableText(d: DealAny) {
  return [
    formatAppDate(d),
    pickConsultant(d),
    pickAgent(d),
    pickDealRef(d),
    pickClientName(d),
    pickInsurance(d),
    pickPurchasePrice(d),
    pickLoanAmount(d),
    d?.notes,
    d?.status,
    d?.bank_notes,
  ]
    .map((v) => String(v ?? ""))
    .join(" ")
    .toLowerCase();
}

function cellBase(extra = "") {
  return `border border-black/70 px-1.5 py-[3px] align-top text-[11px] leading-[1.2] ${extra}`;
}

function dealCellKey(id: string, field: DealField) {
  return `${id}:deal:${field}`;
}

function bankCellKey(id: string, bank: BankKey) {
  return `${id}:bank:${bank}`;
}

function dealPatchForField(field: DealField, value: string) {
  const text = value.trim();
  if (field === "submitted_date") return { submitted_date: normalizeDateForSave(text) };
  if (field === "consultant") return { consultant: text || null };
  if (field === "agent") return { agent: text || null, agent_name: text || null };
  if (field === "deal_ref") return { deal_code: text || null, deal_deck_id: text || null };
  if (field === "client_name") return { applicant: text || null, client_name: text || null };
  if (field === "purchase_price") return { purchase_price: text ? toNumber(text) : null };
  if (field === "amount_zar") return { amount_zar: text ? toNumber(text) : null };
  if (field === "insurance") {
    const bool = parseBoolText(text);
    return { insurance_needed: bool === true };
  }
  return {};
}

function localDealPatchForField(field: DealField, value: string) {
  const text = value.trim();
  if (field === "submitted_date") return { submitted_date: normalizeDateForSave(text) ?? text };
  if (field === "consultant") return { consultant: text };
  if (field === "agent") return { agent: text, agent_name: text, agentName: text };
  if (field === "deal_ref") return { deal_code: text, deal_deck_id: text };
  if (field === "client_name") return { applicant: text, client_name: text, clientName: text };
  if (field === "purchase_price") return { purchase_price: text };
  if (field === "amount_zar") return { amount_zar: toNumber(text), amountZar: toNumber(text) };
  if (field === "insurance") {
    const bool = parseBoolText(text);
    return { insurance_needed: bool === true, insuranceNeeded: bool === true };
  }
  return {};
}

function valueForField(deal: DealAny, field: DealField) {
  if (field === "submitted_date") return formatAppDate(deal);
  if (field === "consultant") return pickConsultant(deal);
  if (field === "agent") return pickAgent(deal);
  if (field === "deal_ref") return pickDealRef(deal);
  if (field === "client_name") return pickClientName(deal);
  if (field === "insurance") return insurancePickerValue(deal);
  if (field === "purchase_price") return pickPurchasePrice(deal);
  if (field === "amount_zar") return pickLoanAmount(deal);
  return "";
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

function EditableInput({
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
    <div className="relative min-h-[20px]">
      <input
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
          `block min-h-[36px] w-full resize-y border-0 bg-transparent px-0 py-0 pr-10 text-[11px] font-semibold leading-[1.2] outline-none focus:bg-[#fffbd1] ${className}`
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <SaveMarker state={state} />
    </div>
  );
}

export default function OverviewPage() {
  const { deals, loading, error, refreshAll } = useDeals();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dealEdits, setDealEdits] = useState<Record<string, DealAny>>({});
  const [bankEdits, setBankEdits] = useState<Record<string, Partial<Record<BankKey, string>>>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [moveDeal, setMoveDeal] = useState<DealAny | null>(null);
  const [moveSavingId, setMoveSavingId] = useState("");
  const [moveError, setMoveError] = useState("");
  const overviewScrollerRef = useRef<HTMLDivElement | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const clearStatusTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
      Object.values(clearStatusTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function setCellState(key: string, state?: SaveState) {
    setSaveStates((prev) => {
      const next = { ...prev };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
  }

  function scrollOverviewSheet(axis: "horizontal" | "vertical", direction: -1 | 1, largeStep = false) {
    const scroller = overviewScrollerRef.current;
    if (!scroller) return;
    const size = axis === "horizontal" ? scroller.clientWidth : scroller.clientHeight;
    const distance = largeStep ? Math.max(320, size * 0.75) : 180;
    scroller.scrollBy({
      left: axis === "horizontal" ? direction * distance : 0,
      top: axis === "vertical" ? direction * distance : 0,
      behavior: "auto",
    });
  }

  function handleOverviewKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      scrollOverviewSheet("horizontal", event.key === "ArrowRight" ? 1 : -1, event.shiftKey);
    } else {
      scrollOverviewSheet("vertical", event.key === "ArrowDown" ? 1 : -1, event.shiftKey);
    }
    event.stopPropagation();

    if (!isEditableKeyboardTarget(event.target)) {
      event.preventDefault();
    }
  }

  function scheduleClearState(key: string) {
    clearTimeout(clearStatusTimersRef.current[key]);
    clearStatusTimersRef.current[key] = setTimeout(() => setCellState(key), 1800);
  }

  function patchLocalDeal(id: string, patch: DealAny) {
    setDealEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }));
  }

  function displayDeal(deal: DealAny) {
    const id = cleanText(deal?.id);
    return id ? { ...deal, ...(dealEdits[id] || {}) } : deal;
  }

  async function persistDealField(id: string, field: DealField, value: string) {
    const key = dealCellKey(id, field);
    setCellState(key, { status: "saving" });

    try {
      const shouldSendInsuranceWebhook = field === "insurance" && parseBoolText(value) === true;
      const res = await fetch(`/api/deals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dealPatchForField(field, value)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Save failed (${res.status})`);

      const updatedDeal = {
        ...(json?.deal && typeof json.deal === "object" ? json.deal : {}),
        ...localDealPatchForField(field, value),
      };

      patchLocalDeal(id, {
        ...updatedDeal,
      });

      if (shouldSendInsuranceWebhook) {
        const webhookRes = await fetch("/api/webhooks/insurance", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deal: updatedDeal,
            source: "overview_insurance_picker",
          }),
        });
        const webhookJson = await webhookRes.json().catch(() => ({}));
        if (!webhookRes.ok || webhookJson?.ok === false) {
          throw new Error(webhookJson?.error || `Insurance webhook failed (${webhookRes.status})`);
        }
      }

      setCellState(key, { status: "saved" });
      scheduleClearState(key);
    } catch (e: any) {
      setCellState(key, { status: "error", message: e?.message || "Save failed" });
    }
  }

  function queueDealSave(deal: DealAny, field: DealField, value: string, delay = 700) {
    const id = cleanText(deal?.id);
    if (!id) return;
    const key = dealCellKey(id, field);
    clearTimeout(saveTimersRef.current[key]);
    setCellState(key, { status: delay > 0 ? "pending" : "saving" });
    saveTimersRef.current[key] = setTimeout(() => persistDealField(id, field, value), delay);
  }

  function currentBankValue(deal: DealAny, bank: BankKey) {
    const id = cleanText(deal?.id);
    const key = bankCellKey(id, bank);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) return drafts[key];
    if (id && bankEdits[id]?.[bank] !== undefined) return bankEdits[id]?.[bank] || "";
    return collectBankNotes(deal, bank);
  }

  function buildBankRows(deal: DealAny, changedBank: BankKey, changedValue: string) {
    return BANKS.map((bank) => ({
      bank_name: bank.label,
      bank_notes: bank.key === changedBank ? changedValue.trim() : currentBankValue(deal, bank.key).trim(),
      bank_reference: "",
    })).filter((row) => row.bank_notes.length > 0 || row.bank_reference.length > 0);
  }

  async function persistBankNote(deal: DealAny, bank: BankKey, value: string) {
    const id = cleanText(deal?.id);
    if (!id) return;
    const key = bankCellKey(id, bank);
    setCellState(key, { status: "saving" });

    try {
      const rows = buildBankRows(deal, bank, value);
      const res = await fetch(`/api/deals/${encodeURIComponent(id)}/bank-notes`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Save failed (${res.status})`);

      const existingRows = Array.isArray(deal?.bank_notes_rows) ? deal.bank_notes_rows : [];
      const nonGlobalRows = existingRows.filter((row: any) => normalizeStage(row?.stage) !== "global");
      const globalRows = rows.map((row) => ({
        deal_id: id,
        stage: "global",
        bank_name: row.bank_name,
        bank_notes: row.bank_notes,
        bank_reference: row.bank_reference,
      }));

      patchLocalDeal(id, { bank_notes_rows: [...nonGlobalRows, ...globalRows] });
      setCellState(key, { status: "saved" });
      scheduleClearState(key);
    } catch (e: any) {
      setCellState(key, { status: "error", message: e?.message || "Save failed" });
    }
  }

  function queueBankSave(deal: DealAny, bank: BankKey, value: string, delay = 800) {
    const id = cleanText(deal?.id);
    if (!id) return;
    const key = bankCellKey(id, bank);
    clearTimeout(saveTimersRef.current[key]);
    setCellState(key, { status: delay > 0 ? "pending" : "saving" });
    saveTimersRef.current[key] = setTimeout(() => persistBankNote(displayDeal(deal), bank, value), delay);
  }

  const visibleDeals = useMemo(() => {
    return (Array.isArray(deals) ? deals : []).map((deal) => displayDeal(deal));
  }, [deals, dealEdits]);

  const consultantOptions = useMemo(() => {
    const names = visibleDeals.map((deal) => pickConsultant(deal)).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [visibleDeals]);

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleDeals
      .filter((deal) => {
        const groupKey = groupKeyForStage(deal?.stage);
        const consultant = pickConsultant(deal);
        if (stageFilter !== "all" && groupKey !== stageFilter) return false;
        if (consultantFilter !== "all" && consultant.toLowerCase() !== consultantFilter.toLowerCase()) return false;
        if (!inDateRange(deal, from, to)) return false;
        if (q && !searchableText(deal).includes(q)) return false;
        return true;
      })
      .sort((a, b) => dateSortValue(b) - dateSortValue(a) || pickClientName(a).localeCompare(pickClientName(b)));
  }, [visibleDeals, query, stageFilter, consultantFilter, from, to]);

  const groupedDeals = useMemo(() => {
    return STAGE_GROUPS.map((group) => ({
      ...group,
      rows: filteredDeals.filter((deal) => groupKeyForStage(deal?.stage) === group.key),
    })).filter((group) => group.rows.length > 0);
  }, [filteredDeals]);

  const totalShown = filteredDeals.reduce((sum, deal) => sum + pickLoanAmountValue(deal), 0);
  const colCount = 14;

  const overviewExportRows = filteredDeals.map((deal) => [
    stageExportLabel(deal?.stage),
    editableValue(deal, "submitted_date"),
    editableValue(deal, "consultant"),
    editableValue(deal, "agent"),
    editableValue(deal, "deal_ref"),
    editableValue(deal, "client_name"),
    editableValue(deal, "insurance"),
    editableValue(deal, "purchase_price"),
    editableValue(deal, "amount_zar"),
    ...BANKS.map((bank) => currentBankValue(deal, bank.key)),
  ]);

  function editableValue(deal: DealAny, field: DealField) {
    const id = cleanText(deal?.id);
    const key = dealCellKey(id, field);
    return Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : valueForField(deal, field);
  }

  function updateDealCell(deal: DealAny, field: DealField, value: string, immediate = false) {
    const id = cleanText(deal?.id);
    if (!id) return;
    const key = dealCellKey(id, field);
    setDrafts((prev) => ({ ...prev, [key]: value }));
    patchLocalDeal(id, localDealPatchForField(field, value));
    queueDealSave(displayDeal(deal), field, value, immediate ? 0 : 700);
  }

  function updateInsuranceCell(deal: DealAny, value: string) {
    const id = cleanText(deal?.id);
    if (!id) return;
    const key = dealCellKey(id, "insurance");
    clearTimeout(saveTimersRef.current[key]);
    setDrafts((prev) => ({ ...prev, [key]: value }));
    patchLocalDeal(id, localDealPatchForField("insurance", value));
    setCellState(key, { status: "saving" });
    persistDealField(id, "insurance", value);
  }

  function updateBankCell(deal: DealAny, bank: BankKey, value: string, immediate = false) {
    const id = cleanText(deal?.id);
    if (!id) return;
    const key = bankCellKey(id, bank);
    setDrafts((prev) => ({ ...prev, [key]: value }));
    setBankEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [bank]: value,
      },
    }));
    queueBankSave(displayDeal(deal), bank, value, immediate ? 0 : 800);
  }

  async function moveSelectedDeal(nextStage: string) {
    if (!moveDeal) return;
    const id = cleanText(moveDeal?.id);
    if (!id) return;

    setMoveSavingId(id);
    setMoveError("");

    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: nextStage, toStage: nextStage }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Move failed (${res.status})`);

      const updatedDeal = {
        ...(json?.deal && typeof json.deal === "object" ? json.deal : {}),
        stage: nextStage,
      };

      if (nextStage === "registrations") {
        const webhookRes = await fetch("/api/webhooks/registrations-email", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deal: updatedDeal,
            source: "overview_move_to_registrations",
          }),
        });
        const webhookJson = await webhookRes.json().catch(() => ({}));
        if (!webhookRes.ok || webhookJson?.ok === false) {
          throw new Error(webhookJson?.error || `Registration webhook failed (${webhookRes.status})`);
        }
      }

      patchLocalDeal(id, {
        ...updatedDeal,
      });
      setMoveDeal(null);
    } catch (e: any) {
      setMoveError(e?.message || "Failed to move deal");
    } finally {
      setMoveSavingId("");
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#142037]/55">Overview</div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-[#142037]">Deal Overview</h1>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase text-black/55">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Client, ref, bank note"
              className="mt-1 h-8 w-56 border border-black/30 bg-white px-2 text-xs font-semibold text-black"
            />
          </label>

          <label className="block">
            <span className="block text-[10px] font-bold uppercase text-black/55">Status</span>
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className="mt-1 h-8 border border-black/30 bg-white px-2 text-xs font-semibold text-black"
            >
              <option value="all">All</option>
              {STAGE_GROUPS.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[10px] font-bold uppercase text-black/55">Consultant</span>
            <select
              value={consultantFilter}
              onChange={(event) => setConsultantFilter(event.target.value)}
              className="mt-1 h-8 border border-black/30 bg-white px-2 text-xs font-semibold text-black"
            >
              <option value="all">All</option>
              {consultantOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[10px] font-bold uppercase text-black/55">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 h-8 border border-black/30 bg-white px-2 text-xs font-semibold text-black"
            />
          </label>

          <label className="block">
            <span className="block text-[10px] font-bold uppercase text-black/55">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 h-8 border border-black/30 bg-white px-2 text-xs font-semibold text-black"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStageFilter("all");
              setConsultantFilter("all");
              setFrom("");
              setTo("");
            }}
            className="h-8 border border-black/40 bg-white px-3 text-[11px] font-bold uppercase text-black hover:bg-black/[0.04]"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => refreshAll?.()}
            className="h-8 bg-[#142037] px-3 text-[11px] font-bold uppercase text-white hover:bg-[#1b2b4b]"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={() =>
              exportRowsToExcel("deal-overview", "Deal Overview", OVERVIEW_EXPORT_HEADERS, overviewExportRows)
            }
            className="h-8 border border-black/40 bg-white px-3 text-[11px] font-bold uppercase text-black hover:bg-black/[0.04]"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => exportRowsToPdf("Deal Overview", OVERVIEW_EXPORT_HEADERS, overviewExportRows)}
            className="h-8 border border-black/40 bg-white px-3 text-[11px] font-bold uppercase text-black hover:bg-black/[0.04]"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border border-black/30 bg-white px-2 py-1 text-[11px] font-semibold text-black">
        <span>Deals: {filteredDeals.length.toLocaleString("en-ZA")}</span>
        <span>Total: {moneyZar(totalShown) || "R0.00"}</span>
        <span>Autosave: edit any cell, then pause or leave the cell</span>
        {loading ? <span>Loading...</span> : null}
        {error ? <span className="font-bold text-red-700">Deals API error: {error}</span> : null}
      </div>

      <div className="overflow-hidden border border-black/80 bg-white">
        <div
          ref={overviewScrollerRef}
          tabIndex={0}
          aria-label="Deal overview spreadsheet"
          onKeyDown={handleOverviewKeyDown}
          className="max-h-[calc(100vh-255px)] overflow-auto outline-none focus:ring-2 focus:ring-[#142037]/30"
        >
          <table className="w-full min-w-[2600px] border-collapse text-left">
            <colgroup>
              <col className="w-[82px]" />
              <col className="w-[95px]" />
              <col className="w-[190px]" />
              <col className="w-[95px]" />
              <col className="w-[330px]" />
              <col className="w-[75px]" />
              <col className="w-[105px]" />
              <col className="w-[115px]" />
              <col className="w-[90px]" />
              <col className="w-[310px]" />
              <col className="w-[310px]" />
              <col className="w-[310px]" />
              <col className="w-[310px]" />
              <col className="w-[310px]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#f3f3f3] text-[11px] font-bold text-black">
                <th className={cellBase("bg-[#f3f3f3]")}>{filterLabel("App Date")}</th>
                <th className={cellBase("bg-[#f3f3f3]")}>{filterLabel("Consultant")}</th>
                <th className={cellBase("bg-[#f3f3f3]")}>{filterLabel("Agent")}</th>
                <th className={cellBase("bg-[#f3f3f3]")}>{filterLabel("Deal Referen")}</th>
                <th className={cellBase("bg-[#f3f3f3]")}>{filterLabel("Client Name")}</th>
                <th className={cellBase("bg-[#f3f3f3]")}>{filterLabel("Insurance")}</th>
                <th className={cellBase("bg-[#f3f3f3] text-right")}>{filterLabel("Purchase Pric")}</th>
                <th className={cellBase("bg-[#f3f3f3] text-right")}>{filterLabel("Loan Amount")}</th>
                <th className={cellBase("bg-[#f3f3f3] text-center")}>Move</th>
                {BANKS.map((bank) => (
                  <th key={bank.key} className={cellBase(`${bank.className} text-center`)}>
                    {filterLabel(bank.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!groupedDeals.length ? (
                <tr>
                  <td className={cellBase("text-center font-semibold text-black/50")} colSpan={colCount}>
                    No deals found
                  </td>
                </tr>
              ) : null}

              {groupedDeals.map((group) => {
                const sectionClass =
                  group.tone === "red"
                    ? "border border-black/70 bg-[#ff6b6b] text-center text-[11px] font-bold uppercase text-black"
                    : "border border-black/70 bg-[#1f5f97] text-center text-[11px] font-bold uppercase text-white";
                const groupTotal = group.rows.reduce((sum, deal) => sum + pickLoanAmountValue(deal), 0);

                return (
                  <Fragment key={group.key}>
                    <tr>
                      <td className={sectionClass} colSpan={7}>
                        &nbsp;
                      </td>
                      <td className={sectionClass}>{group.label}</td>
                      <td className={sectionClass} colSpan={6}>
                        &nbsp;
                      </td>
                    </tr>

                    {group.rows.map((deal, index) => {
                      const dealId = cleanText(deal?.id);
                      const rowKey = `${group.key}-${dealId || pickDealRef(deal) || index}`;

                      return (
                        <tr key={rowKey} className="bg-white hover:bg-[#fffce8]">
                          <td className={cellBase("whitespace-nowrap text-black")}>
                            <EditableInput
                              value={editableValue(deal, "submitted_date")}
                              state={saveStates[dealCellKey(dealId, "submitted_date")]}
                              onChange={(value) => updateDealCell(deal, "submitted_date", value)}
                              onCommit={() => updateDealCell(deal, "submitted_date", editableValue(deal, "submitted_date"), true)}
                            />
                          </td>
                          <td className={cellBase("whitespace-nowrap text-black")}>
                            <EditableInput
                              value={editableValue(deal, "consultant")}
                              state={saveStates[dealCellKey(dealId, "consultant")]}
                              onChange={(value) => updateDealCell(deal, "consultant", value)}
                              onCommit={() => updateDealCell(deal, "consultant", editableValue(deal, "consultant"), true)}
                            />
                          </td>
                          <td className={cellBase("text-black")}>
                            <EditableInput
                              value={editableValue(deal, "agent")}
                              state={saveStates[dealCellKey(dealId, "agent")]}
                              onChange={(value) => updateDealCell(deal, "agent", value)}
                              onCommit={() => updateDealCell(deal, "agent", editableValue(deal, "agent"), true)}
                            />
                          </td>
                          <td className={cellBase("whitespace-nowrap text-black")}>
                            <EditableInput
                              value={editableValue(deal, "deal_ref")}
                              state={saveStates[dealCellKey(dealId, "deal_ref")]}
                              onChange={(value) => updateDealCell(deal, "deal_ref", value)}
                              onCommit={() => updateDealCell(deal, "deal_ref", editableValue(deal, "deal_ref"), true)}
                            />
                          </td>
                          <td className={cellBase("text-black")}>
                            <EditableInput
                              value={editableValue(deal, "client_name")}
                              state={saveStates[dealCellKey(dealId, "client_name")]}
                              onChange={(value) => updateDealCell(deal, "client_name", value)}
                              onCommit={() => updateDealCell(deal, "client_name", editableValue(deal, "client_name"), true)}
                            />
                          </td>
                          <td className={cellBase("text-center font-semibold text-black")}>
                            <EditableSelect
                              value={editableValue(deal, "insurance")}
                              state={saveStates[dealCellKey(dealId, "insurance")]}
                              onChange={(value) => updateInsuranceCell(deal, value)}
                              options={[
                                { value: "NO", label: "NO" },
                                { value: "YES", label: "YES" },
                              ]}
                              className="text-center"
                            />
                          </td>
                          <td className={cellBase("whitespace-nowrap text-right text-black")}>
                            <EditableInput
                              value={editableValue(deal, "purchase_price")}
                              state={saveStates[dealCellKey(dealId, "purchase_price")]}
                              onChange={(value) => updateDealCell(deal, "purchase_price", value)}
                              onCommit={() => updateDealCell(deal, "purchase_price", editableValue(deal, "purchase_price"), true)}
                              className="text-right"
                            />
                          </td>
                          <td className={cellBase("whitespace-nowrap text-right text-black")}>
                            <EditableInput
                              value={editableValue(deal, "amount_zar")}
                              state={saveStates[dealCellKey(dealId, "amount_zar")]}
                              onChange={(value) => updateDealCell(deal, "amount_zar", value)}
                              onCommit={() => updateDealCell(deal, "amount_zar", editableValue(deal, "amount_zar"), true)}
                              className="text-right"
                            />
                          </td>
                          <td className={cellBase("text-center")}>
                            <button
                              type="button"
                              disabled={!dealId || moveSavingId === dealId}
                              onClick={() => {
                                setMoveDeal(displayDeal(deal));
                                setMoveError("");
                              }}
                              className="min-h-[22px] w-full border border-black/40 bg-white px-2 text-[10px] font-bold uppercase text-black hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {moveSavingId === dealId ? "Moving" : "Move"}
                            </button>
                          </td>
                          {BANKS.map((bank) => {
                            const text = currentBankValue(deal, bank.key);
                            const key = bankCellKey(dealId, bank.key);
                            return (
                              <td key={bank.key} className={cellBase(`whitespace-pre-wrap ${bankCellClass(text)}`)}>
                                <EditableTextarea
                                  value={text}
                                  state={saveStates[key]}
                                  onChange={(value) => updateBankCell(deal, bank.key, value)}
                                  onCommit={() => updateBankCell(deal, bank.key, currentBankValue(deal, bank.key), true)}
                                  className={bankCellClass(text)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    <tr className="bg-white">
                      <td className={cellBase("")} colSpan={7}>
                        &nbsp;
                      </td>
                      <td className={cellBase("whitespace-nowrap text-right font-bold text-black")}>
                        {moneyZar(groupTotal) || "R0.00"}
                      </td>
                      <td className={cellBase("")} colSpan={6}>
                        &nbsp;
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {moveDeal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-lg border border-black/20 bg-white p-5 shadow-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/50">Move Deal</div>
            <div className="mt-2 text-lg font-bold text-black">{pickDealRef(moveDeal) || "Deal"}</div>
            <div className="mt-1 text-sm font-semibold text-black/65">{pickClientName(moveDeal)}</div>

            {moveError ? (
              <div className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                {moveError}
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              {MOVE_STAGES.map((stage) => {
                const current = groupKeyForStage(moveDeal?.stage) === stage.key;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    disabled={current || !!moveSavingId}
                    onClick={() => moveSelectedDeal(stage.key)}
                    className={[
                      "border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em]",
                      current
                        ? "border-black/20 bg-black/[0.04] text-black/40"
                        : "border-black/40 bg-white text-black hover:bg-[#142037] hover:text-white",
                      moveSavingId ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                  >
                    {current ? `${stage.label} current` : stage.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={!!moveSavingId}
                onClick={() => {
                  setMoveDeal(null);
                  setMoveError("");
                }}
                className="border border-black/30 bg-white px-4 py-2 text-xs font-bold uppercase text-black hover:bg-black/[0.04] disabled:opacity-60"
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
