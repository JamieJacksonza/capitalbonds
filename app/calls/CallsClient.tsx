"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { exportRowsToExcel, exportRowsToPdf } from "@/app/lib/exportDeals";

type CallRow = {
  id?: string;
  consultant: string;
  name_and_surname: string;
  cell?: string;
  email?: string;
  agency?: string;
  area?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

type CallField = "consultant" | "name_and_surname" | "cell" | "email" | "agency" | "area" | "notes";
type SaveState = { status: "pending" | "saving" | "saved" | "error"; message?: string };

const DEFAULT_CONSULTANTS = ["Elmarie", "Kristie", "Cindy", "Chelsea"];
const CALL_FIELDS: CallField[] = ["consultant", "name_and_surname", "cell", "email", "agency", "area", "notes"];
const CALL_EXPORT_HEADERS = ["Consultant", "Name and Surname", "Cell", "Email", "Agency", "Area", "Notes"];

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function cleanText(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s || s === "-" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s.replace(/\r\n/g, "\n").trim();
}

function filterLabel(label: string) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-[8px] leading-none text-black/55">v</span>
    </span>
  );
}

function callCellBase(extra = "") {
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

function callCellKey(id: string, field: CallField) {
  return `${id}:calls:${field}`;
}

function callFieldValue(row: CallRow, field: CallField) {
  return cleanText(row?.[field]);
}

function callSearchText(row: CallRow) {
  return CALL_FIELDS.map((field) => callFieldValue(row, field)).join(" ").toLowerCase();
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
}: {
  value: string;
  state?: SaveState;
  onChange: (value: string) => void;
  onCommit: () => void;
  type?: string;
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
          "block min-h-[20px] w-full border-0 bg-transparent px-0 py-0 pr-9 text-[11px] font-semibold leading-[1.2] text-black outline-none focus:bg-[#fffbd1]"
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
}: {
  value: string;
  state?: SaveState;
  onChange: (value: string) => void;
  onCommit: () => void;
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
          "block min-h-[36px] w-full resize-y border-0 bg-transparent px-0 py-0 pr-10 text-[11px] font-semibold leading-[1.2] text-black outline-none focus:bg-[#fffbd1]"
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
}: {
  value: string;
  state?: SaveState;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative min-h-[20px]">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={statusClass(
          state,
          "block min-h-[20px] w-full border-0 bg-transparent px-0 py-0 pr-9 text-[11px] font-semibold leading-[1.2] text-black outline-none focus:bg-[#fffbd1]"
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

function emptyCallForm() {
  return {
    consultant: "",
    name_and_surname: "",
    cell: "",
    email: "",
    agency: "",
    area: "",
    notes: "",
  };
}

export default function CallsClient() {
  const search = useSearchParams();
  const showForm = search.get("add") === "1";

  const [rows, setRows] = useState<CallRow[]>([]);
  const [consultantOptions, setConsultantOptions] = useState<string[]>([...DEFAULT_CONSULTANTS]);
  const [form, setForm] = useState(emptyCallForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [consultantFilter, setConsultantFilter] = useState("");
  const [callsOpen, setCallsOpen] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const callsScrollerRef = useRef<HTMLDivElement | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const clearStatusTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/calls", { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (res.ok && json?.ok) {
          setRows(Array.isArray(json?.rows) ? json.rows : []);
          return;
        }
        setMsg(json?.error || "Failed to load calls.");
      } catch (e: any) {
        setMsg(e?.message || "Failed to load calls.");
      }
    }
    load();
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadConsultants() {
      try {
        const res = await fetch("/api/consultants", { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (!alive || !res.ok || !json?.ok) return;
        const list = Array.isArray(json?.consultants)
          ? json.consultants.map((v: any) => cleanText(v)).filter(Boolean)
          : [];
        if (!list.length) return;
        setConsultantOptions(list);
        setForm((prev) =>
          prev.consultant && list.includes(prev.consultant) ? prev : { ...prev, consultant: prev.consultant || list[0] || "" }
        );
      } catch {}
    }
    loadConsultants();
    const timer = window.setInterval(loadConsultants, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
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

  function patchCallRow(id: string, patch: Partial<CallRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function callEditableValue(row: CallRow, field: CallField) {
    const id = cleanText(row?.id);
    const key = callCellKey(id, field);
    return Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : callFieldValue(row, field);
  }

  async function persistCallField(row: CallRow, field: CallField, value: string) {
    const id = cleanText(row?.id);
    if (!id) return;
    const key = callCellKey(id, field);
    setCellState(key, { status: "saving" });

    try {
      const res = await fetch("/api/calls", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, [field]: value.trim() || null }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Save failed (${res.status})`);
      const updatedRow = json?.row && typeof json.row === "object" ? json.row : { [field]: value };
      patchCallRow(id, updatedRow);
      setCellState(key, { status: "saved" });
      scheduleClearState(key);
    } catch (e: any) {
      setCellState(key, { status: "error", message: e?.message || "Save failed" });
    }
  }

  function queueCallSave(row: CallRow, field: CallField, value: string, delay = 700) {
    const id = cleanText(row?.id);
    if (!id) return;
    const key = callCellKey(id, field);
    clearTimeout(saveTimersRef.current[key]);
    setCellState(key, { status: delay > 0 ? "pending" : "saving" });
    saveTimersRef.current[key] = setTimeout(() => persistCallField(row, field, value), delay);
  }

  function updateCallCell(row: CallRow, field: CallField, value: string, immediate = false) {
    const id = cleanText(row?.id);
    if (!id) return;
    const key = callCellKey(id, field);
    setDrafts((prev) => ({ ...prev, [key]: value }));
    patchCallRow(id, { [field]: value } as Partial<CallRow>);
    queueCallSave(row, field, value, immediate ? 0 : 700);
  }

  function scrollCallsSheet(axis: "horizontal" | "vertical", direction: -1 | 1, largeStep = false) {
    const scroller = callsScrollerRef.current;
    if (!scroller) return;
    const size = axis === "horizontal" ? scroller.clientWidth : scroller.clientHeight;
    const distance = largeStep ? Math.max(320, size * 0.75) : 180;
    scroller.scrollBy({
      left: axis === "horizontal" ? direction * distance : 0,
      top: axis === "vertical" ? direction * distance : 0,
      behavior: "auto",
    });
  }

  function handleCallsGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      scrollCallsSheet("horizontal", event.key === "ArrowRight" ? 1 : -1, event.shiftKey);
    } else {
      scrollCallsSheet("vertical", event.key === "ArrowDown" ? 1 : -1, event.shiftKey);
    }
    event.stopPropagation();

    if (!isEditableKeyboardTarget(event.target)) {
      event.preventDefault();
    }
  }

  async function saveCall() {
    setSaving(true);
    setMsg(null);
    try {
      const name = cleanText(form.name_and_surname);
      if (!name) throw new Error("Name and Surname is required.");

      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Save failed.");
      const saved = json?.row as CallRow | undefined;
      setRows((prev) => [saved || { ...form }, ...prev]);
      setForm(emptyCallForm());
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const allConsultantOptions = useMemo(() => {
    const names = [
      ...consultantOptions,
      ...(rows || []).map((row) => cleanText(row.consultant)).filter(Boolean),
    ];
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [consultantOptions, rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || [])
      .filter((row) => {
        const consultantOk = consultantFilter
          ? cleanText(row.consultant).toLowerCase() === consultantFilter.toLowerCase()
          : true;
        const textOk = q ? callSearchText(row).includes(q) : true;
        return consultantOk && textOk;
      })
      .sort((a, b) => {
        const consultant = cleanText(a.consultant).localeCompare(cleanText(b.consultant));
        if (consultant !== 0) return consultant;
        const name = cleanText(a.name_and_surname).localeCompare(cleanText(b.name_and_surname));
        if (name !== 0) return name;
        return cleanText(b.created_at).localeCompare(cleanText(a.created_at));
      });
  }, [rows, consultantFilter, query]);

  const callsExportRows = filteredRows.map((row) => [
    callEditableValue(row, "consultant"),
    callEditableValue(row, "name_and_surname"),
    callEditableValue(row, "cell"),
    callEditableValue(row, "email"),
    callEditableValue(row, "agency"),
    callEditableValue(row, "area"),
    callEditableValue(row, "notes"),
  ]);

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-2 py-4 md:px-3 md:py-6 xl:px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#142037]/55">Calls</div>
          <div className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#142037]">Calls</div>
          <div className="mt-2 text-sm font-medium text-slate-500">Consultant call list</div>
        </div>
        <a
          href="/calls?add=1"
          className="rounded-2xl bg-[#142037] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#1a2a49]"
        >
          + Add Call
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
              placeholder="Name, agency, area, notes"
              className="h-8 w-[220px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold text-black outline-none placeholder:text-black/35 focus:border-[#142037]/40 focus:ring-2 focus:ring-[#142037]/10"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/55">Consultant</span>
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="h-8 w-[150px] rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold text-black outline-none focus:border-[#142037]/40 focus:ring-2 focus:ring-[#142037]/10"
            >
              <option value="">All</option>
              {allConsultantOptions.map((name) => (
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
              setConsultantFilter("");
            }}
            className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black hover:border-black/25 hover:bg-black/[0.02]"
          >
            Clear
          </button>
          <div className="flex h-8 items-center rounded-lg bg-[#142037]/5 px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#142037]/70">
            Showing {filteredRows.length} call(s)
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold text-black">Add Call</div>
          <div className="mt-1 text-xs font-semibold text-black/60">Inputs match the table below.</div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-extrabold text-black/70">Consultant</div>
              <select
                value={form.consultant}
                onChange={(e) => updateForm("consultant", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              >
                <option value="">Select</option>
                {allConsultantOptions.map((consultant) => (
                  <option key={consultant} value={consultant}>
                    {consultant}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Name and Surname</div>
              <input
                value={form.name_and_surname}
                onChange={(e) => updateForm("name_and_surname", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Cell</div>
              <input
                type="tel"
                value={form.cell}
                onChange={(e) => updateForm("cell", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Email</div>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Agency</div>
              <input
                value={form.agency}
                onChange={(e) => updateForm("agency", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Area</div>
              <input
                value={form.area}
                onChange={(e) => updateForm("area", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-extrabold text-black/70">Notes</div>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                className="mt-2 h-24 w-full resize-none rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={saveCall}
              disabled={saving}
              className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Call"}
            </button>
            <a className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20" href="/calls">
              Cancel
            </a>
          </div>
          {msg ? <div className="mt-3 text-xs font-semibold text-black/60">{msg}</div> : null}
        </div>
      ) : msg ? (
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold text-black/60 shadow-sm">{msg}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#142037] px-5 py-4 text-white">
          <button
            type="button"
            aria-expanded={callsOpen}
            onClick={() => setCallsOpen((prev) => !prev)}
            className="min-w-[220px] flex-1 text-left"
          >
            <div className="text-sm font-bold uppercase tracking-[0.14em]">Calls</div>
            <div className="mt-1 text-xs font-semibold text-white/70">
              {filteredRows.length} call{filteredRows.length === 1 ? "" : "s"} shown - Autosave enabled
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportRowsToExcel("calls", "Calls", CALL_EXPORT_HEADERS, callsExportRows)}
              className="h-8 border border-white/25 bg-white/10 px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white hover:bg-white/15"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => exportRowsToPdf("Calls", CALL_EXPORT_HEADERS, callsExportRows)}
              className="h-8 border border-white/25 bg-white/10 px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white hover:bg-white/15"
            >
              Export PDF
            </button>
            <button
              type="button"
              aria-label={callsOpen ? "Collapse calls" : "Expand calls"}
              onClick={() => setCallsOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 text-xs font-extrabold text-white hover:bg-white/10"
            >
              {callsOpen ? "^" : "v"}
            </button>
          </div>
        </div>
        {callsOpen ? (
          <div className="overflow-hidden border-t border-black/80 bg-white">
            <div
              ref={callsScrollerRef}
              tabIndex={0}
              aria-label="Calls spreadsheet"
              onKeyDown={handleCallsGridKeyDown}
              className="max-h-[calc(100vh-285px)] overflow-auto outline-none focus:ring-2 focus:ring-[#142037]/30"
            >
              <table className="w-full min-w-[1700px] border-collapse text-left">
                <colgroup>
                  <col className="w-[140px]" />
                  <col className="w-[260px]" />
                  <col className="w-[150px]" />
                  <col className="w-[300px]" />
                  <col className="w-[300px]" />
                  <col className="w-[260px]" />
                  <col className="w-[520px]" />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#f3f3f3] text-[11px] font-bold text-black">
                    <th className={callCellBase("bg-[#f3f3f3]")}>{filterLabel("Consultant")}</th>
                    <th className={callCellBase("bg-[#f3f3f3]")}>{filterLabel("Name and Surname")}</th>
                    <th className={callCellBase("bg-[#f3f3f3]")}>{filterLabel("Cell")}</th>
                    <th className={callCellBase("bg-[#f3f3f3]")}>{filterLabel("Email")}</th>
                    <th className={callCellBase("bg-[#f3f3f3]")}>{filterLabel("Agency")}</th>
                    <th className={callCellBase("bg-[#f3f3f3]")}>{filterLabel("Area")}</th>
                    <th className={callCellBase("bg-[#f3f3f3]")}>{filterLabel("Notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td className={callCellBase("text-center font-semibold text-black/50")} colSpan={7}>
                        No calls found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, index) => {
                      const rowId = cleanText(row.id);
                      const rowKey = rowId || `${row.name_and_surname}-${index}`;
                      const consultantSelectOptions = optionsWithCurrent(
                        ["", ...allConsultantOptions],
                        callEditableValue(row, "consultant")
                      ).map((value) => ({ value, label: value || "Select" }));
                      const startsGroup =
                        index > 0 &&
                        cleanText(row.consultant).toLowerCase() !== cleanText(filteredRows[index - 1]?.consultant).toLowerCase();

                      return (
                        <tr key={rowKey} className={cls("bg-white hover:bg-[#fffce8]", startsGroup && "border-t-2 border-black/50")}>
                          <td className={callCellBase("text-black")}>
                            <EditableSelect
                              value={callEditableValue(row, "consultant")}
                              state={saveStates[callCellKey(rowId, "consultant")]}
                              onChange={(value) => updateCallCell(row, "consultant", value, true)}
                              options={consultantSelectOptions}
                            />
                          </td>
                          <td className={callCellBase("text-black")}>
                            <EditableInput
                              value={callEditableValue(row, "name_and_surname")}
                              state={saveStates[callCellKey(rowId, "name_and_surname")]}
                              onChange={(value) => updateCallCell(row, "name_and_surname", value)}
                              onCommit={() => updateCallCell(row, "name_and_surname", callEditableValue(row, "name_and_surname"), true)}
                            />
                          </td>
                          <td className={callCellBase("whitespace-nowrap text-black")}>
                            <EditableInput
                              type="tel"
                              value={callEditableValue(row, "cell")}
                              state={saveStates[callCellKey(rowId, "cell")]}
                              onChange={(value) => updateCallCell(row, "cell", value)}
                              onCommit={() => updateCallCell(row, "cell", callEditableValue(row, "cell"), true)}
                            />
                          </td>
                          <td className={callCellBase("text-black")}>
                            <EditableInput
                              type="email"
                              value={callEditableValue(row, "email")}
                              state={saveStates[callCellKey(rowId, "email")]}
                              onChange={(value) => updateCallCell(row, "email", value)}
                              onCommit={() => updateCallCell(row, "email", callEditableValue(row, "email"), true)}
                            />
                          </td>
                          <td className={callCellBase("text-black")}>
                            <EditableInput
                              value={callEditableValue(row, "agency")}
                              state={saveStates[callCellKey(rowId, "agency")]}
                              onChange={(value) => updateCallCell(row, "agency", value)}
                              onCommit={() => updateCallCell(row, "agency", callEditableValue(row, "agency"), true)}
                            />
                          </td>
                          <td className={callCellBase("text-black")}>
                            <EditableInput
                              value={callEditableValue(row, "area")}
                              state={saveStates[callCellKey(rowId, "area")]}
                              onChange={(value) => updateCallCell(row, "area", value)}
                              onCommit={() => updateCallCell(row, "area", callEditableValue(row, "area"), true)}
                            />
                          </td>
                          <td className={callCellBase("whitespace-pre-wrap text-black")}>
                            <EditableTextarea
                              value={callEditableValue(row, "notes")}
                              state={saveStates[callCellKey(rowId, "notes")]}
                              onChange={(value) => updateCallCell(row, "notes", value)}
                              onCommit={() => updateCallCell(row, "notes", callEditableValue(row, "notes"), true)}
                            />
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
    </div>
  );
}
