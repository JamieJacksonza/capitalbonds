"use client";

type AnyObj = Record<string, any>;

function has(v: any) {
  return !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
}

function Row({ label, value }: { label: string; value: any }) {
  if (!has(value)) return null;
  const v = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-[11px] font-extrabold text-black/55">{label}</div>
      <div className="text-[12px] font-extrabold text-black text-right whitespace-pre-wrap">{v}</div>
    </div>
  );
}

function pick(deal: AnyObj, keys: string[]) {
  for (const k of keys) {
    const v = deal?.[k];
    if (has(v)) return v;
  }
  return null;
}

function StageCard({ title, captured, children }: { title: string; captured: boolean; children: any }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-black">{title}</div>
        <div className={"text-[11px] font-extrabold " + (captured ? "text-black/60" : "text-black/30")}>
          {captured ? "Captured" : ""}
        </div>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

export default function StageInputsCompact({
  deal,
  banks,
}: {
  deal?: AnyObj | null;
  banks?: AnyObj[] | null;
}) {
  if (!deal) return null;

  const bankList =
    Array.isArray(banks) ? banks :
    Array.isArray((deal as any)?.deal_banks) ? (deal as any).deal_banks :
    Array.isArray((deal as any)?.banks) ? (deal as any).banks :
    [];

  const submittedDate =
    pick(deal, ["submitted_at", "submitted_date", "submittedDate"]) ??
    (typeof deal?.created_at === "string" ? deal.created_at.slice(0, 10) : null);

  const instructedAttorney = pick(deal, ["instructed_attorney", "instructedAttorney", "instruction_attorney"]);
  const valuationDate = pick(deal, ["valuation_date", "valuationDate"]);

  const grantedDate = pick(deal, ["granted_date", "grant_date", "grantedDate"]);
  const grantedConditions = pick(deal, ["granted_conditions", "grant_conditions", "conditions"]);

  const regNo = pick(deal, ["registration_number", "registrationNumber"]);
  const regAttorney = pick(deal, ["registration_attorney", "attorney", "attorney_name"]);
  const regTel = pick(deal, ["registration_attorney_tel", "attorney_tel", "attorneyTel", "attorney_phone"]);
  const regEmail = pick(deal, ["registration_attorney_email", "attorney_email", "attorneyEmail"]);
  const regRef = pick(deal, ["registration_attorney_reference", "attorney_reference", "reference"]);
  const payDue = pick(deal, ["payment_due_date", "paymentDate", "payment_due", "payment_due_at"]);
  const commPaid = typeof deal?.agent_comm_paid === "boolean" ? deal.agent_comm_paid : null;

  const ntuReason = pick(deal, ["ntu_reason", "decline_reason", "declined_reason", "ntuReason", "reason"]);

  const submittedCaptured = has(submittedDate);

  const aipCaptured =
    bankList.length > 0 &&
    bankList.some((b: AnyObj) => has(b?.bank_name) || has(b?.bank_notes) || has(b?.attorney) || has(b?.attorney_note));

  const instructedCaptured = has(instructedAttorney) || has(valuationDate);
  const grantedCaptured = has(grantedDate) || has(grantedConditions);

  const regCaptured =
    has(regNo) || has(regAttorney) || has(regTel) || has(regEmail) || has(regRef) || has(payDue) || has(commPaid);

  const ntuCaptured = has(ntuReason);

  return (
    <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-black">Status inputs</div>
        <div className="text-[11px] font-extrabold text-black/50">Current: {String(deal?.stage || "")}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <StageCard title="Submitted" captured={submittedCaptured}>
          <Row label="Date" value={submittedDate} />
          {!submittedCaptured ? <div className="text-[11px] font-semibold text-black/35">No captured inputs.</div> : null}
        </StageCard>

        <StageCard title="AIP" captured={aipCaptured}>
          {bankList.length ? (
            <div className="space-y-3">
              {bankList.slice(0, 4).map((b: AnyObj, idx: number) => (
                <div key={String(b?.id || idx)} className="rounded-2xl border border-black/10 p-3">
                  <div className="text-[11px] font-extrabold text-black">{String(b?.bank_name || "Bank")}</div>
                  <Row label="Bank notes" value={b?.bank_notes} />
                  <Row label="Attorney" value={b?.attorney} />
                  <Row label="Attorney note" value={b?.attorney_note} />
                </div>
              ))}
              {bankList.length > 4 ? <div className="text-[11px] font-semibold text-black/40">+{bankList.length - 4} more</div> : null}
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-black/35">No captured inputs.</div>
          )}
        </StageCard>

        <StageCard title="Instructed" captured={instructedCaptured}>
          <Row label="Attorney" value={instructedAttorney} />
          <Row label="Valuation date" value={valuationDate} />
          {!instructedCaptured ? <div className="text-[11px] font-semibold text-black/35">No captured inputs.</div> : null}
        </StageCard>

        <StageCard title="Granted" captured={grantedCaptured}>
          <Row label="Granted date" value={grantedDate} />
          <Row label="Conditions" value={grantedConditions} />
          {!grantedCaptured ? <div className="text-[11px] font-semibold text-black/35">No captured inputs.</div> : null}
        </StageCard>

        <StageCard title="Registrations" captured={regCaptured}>
          <Row label="Registration #" value={regNo} />
          <Row label="Attorney" value={regAttorney} />
          <Row label="Attorney tel" value={regTel} />
          <Row label="Attorney email" value={regEmail} />
          <Row label="Reference" value={regRef} />
          <Row label="Payment due date" value={payDue} />
          <Row label="Commission paid" value={has(commPaid) ? (commPaid ? "Yes" : "No") : null} />
          {!regCaptured ? <div className="text-[11px] font-semibold text-black/35">No captured inputs.</div> : null}
        </StageCard>

        <StageCard title="NTU" captured={ntuCaptured}>
          <Row label="Reason" value={ntuReason} />
          {!ntuCaptured ? <div className="text-[11px] font-semibold text-black/35">No captured inputs.</div> : null}
        </StageCard>
      </div>
    </div>
  );
}
