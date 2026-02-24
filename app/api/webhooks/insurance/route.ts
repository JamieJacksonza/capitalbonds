import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export async function POST(req: Request) {
  const url = process.env.MAKE_INSURANCE_WEBHOOK_URL || "";
  if (!url) {
    return json({ ok: false, error: "Missing MAKE_INSURANCE_WEBHOOK_URL" }, 500);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const deal = body?.deal && typeof body.deal === "object" ? body.deal : null;
  if (!deal) {
    return json({ ok: false, error: "Missing deal payload" }, 400);
  }

  const payload = {
    event: "insurance_email",
    deal,
    meta: {
      source: body?.source || "deal_view_registrations",
      sentAt: new Date().toISOString(),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      return json(
        { ok: false, error: `Webhook failed (${res.status})`, detail: text.slice(0, 500) },
        502
      );
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Webhook request failed" }, 502);
  }
}
