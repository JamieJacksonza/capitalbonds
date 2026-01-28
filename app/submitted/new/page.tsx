"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function toUpperSafe(v: string) {
  return String(v || "").trim().toUpperCase();
}

function todayLocalYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const CONSULTANTS = ["Elmarie", "Kristie", "Cindy", "Chelsea"] as const;

export default function NewSubmissionPage() {
  const router = useRouter();

  const [dealOpsNumber, setDealOpsNumber] = useState("");
  const [applicant, setApplicant] = useState("");
  const [consultant, setConsultant] = useState<string>(CONSULTANTS[0] ?? "");
  const [agent, setAgent] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [clientMainBank, setClientMainBank] = useState<string>("");
  const [clientMainBankOther, setClientMainBankOther] = useState<string>("");
  const [submittedDate, setSubmittedDate] = useState<string>(() => todayLocalYYYYMMDD());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const amountNum = useMemo(() => {
    const n = Number(String(amount).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }, [amount]);

  const purchasePriceNum = useMemo(() => {
    const raw = String(purchasePrice).replace(/[^\d.]/g, "");
    if (!raw) return NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }, [purchasePrice]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const dc = toUpperSafe(dealOpsNumber);
    const ap = String(applicant || "").trim();
    const con = String(consultant || "").trim();
    const ag = String(agent || "").trim();
    const dt = String(submittedDate || "").trim();
    const bank =
      clientMainBank === "Other"
        ? String(clientMainBankOther || "").trim()
        : String(clientMainBank || "").trim();
    if (!dc) return setMsg({ type: "err", text: "Deal Ops Number is required." });
    if (!ap) return setMsg({ type: "err", text: "Applicant is required." });
    if (!con) return setMsg({ type: "err", text: "Consultant is required." });
    if (!ag) return setMsg({ type: "err", text: "Lead source is required." });
    if (!dt) return setMsg({ type: "err", text: "Date is required." });
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setMsg({ type: "err", text: "Loan amount must be > 0." });
    if (purchasePrice && (!Number.isFinite(purchasePriceNum) || purchasePriceNum <= 0)) {
      return setMsg({ type: "err", text: "Purchase price must be > 0." });
    }

    setSaving(true);

    try {
      // IMPORTANT: these keys must match your /api/deals POST handler (we added it).
      const payload: any = {
        deal_deck_id: dc,
        applicant: ap,
        consultant: con,
        agent: ag,
        amount_zar: amountNum,
        purchase_price: Number.isFinite(purchasePriceNum) ? purchasePriceNum : undefined,
        client_main_bank: bank || undefined,
        stage: "submitted",
        submitted_date: dt,
      };

      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json?.ok) {
        const serverMsg =
          json?.error ||
          json?.message ||
          (text && text.length < 500 ? text : "") ||
          "Failed to create deal";
        throw new Error(`${serverMsg} (HTTP ${res.status})`);
      }

      const newId = json?.id || json?.deal?.id || json?.data?.id || json?.dealId || "";

      setMsg({ type: "ok", text: "Created." });

      if (newId) router.push(`/deal/${encodeURIComponent(String(newId))}`);
      else router.push("/submitted");
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "Failed to create deal" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-black">New submission</div>
          <div className="mt-1 text-xs font-semibold text-black/60">Create a new deal in Submitted</div>
        </div>

        <Link
          href="/submitted"
          className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-extrabold text-black hover:border-black/20"
        >
          Back to Submitted
        </Link>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-black/10 bg-white p-5">
        {msg ? (
          <div
            className={
              "mb-4 rounded-2xl border px-3 py-2 text-xs font-semibold " +
              (msg.type === "ok"
                ? "border-black/10 bg-black/[0.02] text-black"
                : "border-black/20 bg-black/[0.03] text-black")
            }
          >
            {msg.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-extrabold text-black/70">Deal Ops Number</div>
            <input
              value={dealOpsNumber}
              onChange={(e) => setDealOpsNumber(e.target.value)}
              placeholder="e.g. SB-2345"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            />
          </div>

          <div>
            <div className="text-xs font-extrabold text-black/70">Loan Amount (ZAR)</div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1200000"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            />
          </div>

          <div>
            <div className="text-xs font-extrabold text-black/70">Purchase Price</div>
            <input
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="e.g. 1500000"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            />
          </div>

          <div>
            <div className="text-xs font-extrabold text-black/70">Applicant</div>
            <input
              value={applicant}
              onChange={(e) => setApplicant(e.target.value)}
              placeholder="Full name"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            />
          </div>

          <div>
            <div className="text-xs font-extrabold text-black/70">Consultant</div>
            <select
              value={consultant}
              onChange={(e) => setConsultant(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            >
              {CONSULTANTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-extrabold text-black/70">Lead Source</div>
            <input
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              placeholder="e.g. Jason"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            />
          </div>

          <div>
            <div className="text-xs font-extrabold text-black/70">Client Main Bank</div>
            <select
              value={clientMainBank}
              onChange={(e) => setClientMainBank(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            >
              <option value="">Select bank</option>
              <option value="FNB">FNB</option>
              <option value="INVESTEC">INVESTEC</option>
              <option value="NEDBANK">NEDBANK</option>
              <option value="STANDARD BANK">STANDARD BANK</option>
              <option value="ABSA">ABSA</option>
              <option value="Other">Other</option>
            </select>
            {clientMainBank === "Other" ? (
              <input
                value={clientMainBankOther}
                onChange={(e) => setClientMainBankOther(e.target.value)}
                placeholder="Type bank name"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
            ) : null}
          </div>

          <div>
            <div className="text-xs font-extrabold text-black/70">Date</div>
            <input
              type="date"
              value={submittedDate}
              onChange={(e) => setSubmittedDate(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black/30"
            />
            <div className="mt-1 text-[11px] font-semibold text-black/50">
              Defaults to today, but you can change it.
            </div>
          </div>

        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-extrabold text-black hover:border-black/20 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create submission"}
          </button>
        </div>
      </form>
    </div>
  );
}
