"use client";

type DealLike = {
  stage?: string | null;

  registration_number?: string | null;
  registration_attorney?: string | null;
  registration_attorney_tel?: string | null;
  payment_due_date?: string | null;
  agent_comm_paid?: boolean | null;
};

function Row({ label, value }: { label: string; value: any }) {
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-[11px] font-extrabold text-black/60">{label}</div>
      <div className="text-xs font-extrabold text-black text-right">{v}</div>
    </div>
  );
}

export default function RegistrationSummary({ deal }: { deal?: DealLike | null }) {
  if (!deal) return null;

  const hasAny =
    !!deal.registration_number ||
    !!deal.registration_attorney ||
    !!deal.registration_attorney_tel ||
    !!deal.payment_due_date ||
    deal.agent_comm_paid === true ||
    deal.agent_comm_paid === false;

  if (!hasAny) return null;

  return (
    <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="text-sm font-extrabold text-black">Registration details</div>
      <div className="mt-3 space-y-2">
        <Row label="Registration number" value={deal.registration_number} />
        <Row label="Registration attorney" value={deal.registration_attorney} />
        <Row label="Attorney contact" value={deal.registration_attorney_tel} />
        <Row label="Payment date" value={deal.payment_due_date} />
        <Row label="Commission paid" value={deal.agent_comm_paid ? "Yes" : (deal.agent_comm_paid === false ? "No" : "")} />
      </div>
    </div>
  );
}
