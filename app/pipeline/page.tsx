"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

const DUMMY_ROWS: PipelineRow[] = [];


function dateLabel(v: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const day = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${day} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(mm) - 1]} ${yy}`;
}

function parseMoneyInput(v: any) {
  const raw = String(v ?? "").replace(/[^\d.]/g, "");
  if (!raw) return NaN;
  return Number(raw);
}

const MAX_INT_32 = 2147483647;

export default function PipelinePage() {
  const search = useSearchParams();
  const showForm = search.get("add") === "1";

  const [rows, setRows] = useState<PipelineRow[]>([]);
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
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
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

  function updateForm<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateMoveForm<K extends keyof typeof moveForm>(key: K, value: string) {
    setMoveForm((prev) => ({ ...prev, [key]: value }));
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

  const filteredRows = useMemo(() => {
    const list = rows || [];
    return list.filter((r) => {
      const typeOk = typeFilter ? String(r.lead_type || "") === typeFilter : true;
      const rawDate = String(r.lead_date || "").trim();
      if (!fromDate && !toDate) return typeOk;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) return false;
      const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return typeOk;
    });
  }, [rows, fromDate, toDate, typeFilter]);

  const dueSoonRows = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 3);

    return (rows || []).filter((r) => {
      const raw = String(r.follow_up_date || "").trim();
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return key >= start && key <= end;
    }).sort((a, b) => {
      const da = new Date(String(a.follow_up_date || ""));
      const db = new Date(String(b.follow_up_date || ""));
      return da.getTime() - db.getTime();
    });
  }, [rows]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-white/70">Pipeline</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">Pipeline Leads</div>
          <div className="mt-1 text-sm font-semibold text-white/70">Live pipeline leads</div>
        </div>
        <a
          href="/pipeline?add=1"
          className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
        >
          + Add to Pipeline
        </a>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-extrabold text-black/60">Filters</div>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-extrabold text-black/60">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-black/10 px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-extrabold text-black/60">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-black/10 px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-extrabold text-black/60">Lead Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-black/10 px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
            >
              <option value="">All</option>
              <option value="New App">New App</option>
              <option value="Pre-approval">Pre-approval</option>
              <option value="Pre-App">Pre-App</option>
            </select>
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => { setFromDate(""); setToDate(""); setTypeFilter(""); }}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[10px] font-extrabold text-black hover:border-black/20"
          >
            Clear
          </button>
          <div className="text-[10px] font-semibold text-black/50">
            Showing {filteredRows.length} lead(s)
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-extrabold text-black/60">Follow-ups due (today + next 3 days)</div>
            <div className="mt-1 text-xs font-semibold text-black/60">
              {dueSoonRows.length ? `${dueSoonRows.length} lead(s) need follow-up.` : "No follow-ups due soon."}
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left">
            <thead className="bg-black/[0.02]">
              <tr className="text-[10px] font-extrabold text-black">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Consultant</th>
                <th className="px-4 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {dueSoonRows.length === 0 ? (
                <tr className="border-t border-black/10">
                  <td className="px-4 py-4 text-xs font-semibold text-black/60" colSpan={3}>
                    Nothing due in the next 3 days.
                  </td>
                </tr>
              ) : (
                dueSoonRows.map((r, idx) => (
                  <tr key={r.id ?? `${r.client_name}-${idx}`} className="border-t border-black/10 hover:bg-black/[0.02]">
                    <td className="px-4 py-3 text-xs font-semibold text-black">{r.client_name || "-"}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-black">{r.consultant || "-"}</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-black">{dateLabel(r.follow_up_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                <option value="Pre-App">Pre-App</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-extrabold text-black/70">Consultant</div>
              <select value={form.consultant} onChange={(e) => updateForm("consultant", e.target.value)} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30">
                <option value="">Select</option>
                <option value="Elmarie">Elmarie</option>
                <option value="Kristie">Kristie</option>
                <option value="Cindy">Cindy</option>
                <option value="Chelsea">Chelsea</option>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left">
            <thead className="border-b border-black/10 bg-white">
              <tr className="text-xs font-extrabold text-black/70">
                <th className="px-4 py-3">Lead Date</th>
                <th className="px-4 py-3">Lead Type</th>
                <th className="px-4 py-3">Consultant</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Client Name</th>
                <th className="px-4 py-3">Loan Amount</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Follow up date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {filteredRows.map((r, i) => (
                <tr key={i} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3 text-sm font-semibold text-black">{dateLabel(r.lead_date)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-black">{r.lead_type}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-black">{r.consultant}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-black">{r.agent}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-black">{r.client_name}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-black">{r.loan_amount}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-black whitespace-pre-wrap">{r.notes}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-black">{dateLabel(r.follow_up_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        disabled={!r.id || statusSavingId === r.id}
                        value={r.lead_type || ""}
                        onChange={(e) => {
                          if (!r.id) return;
                          updateLeadStatus(r.id, e.target.value);
                        }}
                        className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black hover:border-black/20 disabled:opacity-60"
                      >
                        <option value="">Set status</option>
                        <option value="New App">New App</option>
                        <option value="Pre-approval">Pre-approval</option>
                      </select>
                      <button
                        className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
                        onClick={() => setViewLead(r)}
                      >
                        View
                      </button>
                      <button
                        className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
                        onClick={() => openMove(r)}
                      >
                        Move to Submitted
                      </button>
                    </div>
                    {statusErr && statusSavingId === null ? (
                      <div className="mt-2 text-[10px] font-semibold text-red-600">{statusErr}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <option value="Elmarie">Elmarie</option>
                  <option value="Kristie">Kristie</option>
                  <option value="Cindy">Cindy</option>
                  <option value="Chelsea">Chelsea</option>
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
    </div>
  );
}
