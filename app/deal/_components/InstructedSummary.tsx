"use client";

function val(...xs: any[]) {
  for (const x of xs) {
    const s = String(x ?? "").trim();
    if (s) return s;
  }
  return "";
}

function Row(props: { label: string; value?: string }) {
  const v = (props.value ?? "").trim();
  if (!v) return null;

  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-2">
      <div className="text-xs font-extrabold text-black/60">{props.label}</div>
      <div className="text-sm font-semibold text-black">{v}</div>
    </div>
  );
}

export default function InstructedSummary({ deal }: { deal: any }) {
  if (!deal) return null;

  // Attorney / Firm
  const attorney = val(
    deal?.registration_attorney,
    deal?.registrationAttorney,
    deal?.attorney,
    deal?.attorney_name,
    deal?.attorneyName,
    deal?.instructed_attorney,
    deal?.instructedAttorney
  );

  // Tel / Phone
  const tel = val(
    deal?.registration_attorney_tel,
    deal?.registrationAttorneyTel,
    deal?.registration_attorney_phone,
    deal?.registrationAttorneyPhone,
    deal?.attorney_tel,
    deal?.attorneyTel,
    deal?.attorney_phone,
    deal?.attorneyPhone
  );

  // Email
  const email = val(
    deal?.registration_attorney_email,
    deal?.registrationAttorneyEmail,
    deal?.attorney_email,
    deal?.attorneyEmail
  );

  // Reference
  const reference = val(
    deal?.registration_attorney_reference,
    deal?.registrationAttorneyReference,
    deal?.attorney_reference,
    deal?.attorneyReference,
    deal?.reference,
    deal?.instructed_reference,
    deal?.instructedReference
  );

  // Notes (instructed)
  const notes = val(
    deal?.instructed_notes,
    deal?.instructedNotes,
    deal?.notes_instructed,
    deal?.notesInstructed
  );

  const hasAnything = !!(attorney || tel || email || reference || notes);
  if (!hasAnything) return null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="text-sm font-extrabold text-black">Instructed summary</div>
      <div className="mt-1 text-xs font-semibold text-black/60">
        Attorney details & instructed notes
      </div>

      <div className="mt-4 border-t border-black/10 pt-2">
        <Row label="Attorney / Firm" value={attorney} />
        <Row label="Telephone" value={tel} />
        <Row label="Email" value={email} />
        <Row label="Reference" value={reference} />

        {notes ? (
          <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.02] p-3">
            <div className="text-xs font-extrabold text-black/60">Instructed notes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-black">{notes}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}