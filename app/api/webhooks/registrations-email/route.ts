import fs from "node:fs";
import path from "node:path";

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

function readEnvFileValue(name: string) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const text = fs.readFileSync(envPath, "utf8");
    const match = text.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?$`, "m"));
    return match?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const url =
    process.env.MAKE_REGISTRATIONS_EMAIL_WEBHOOK_URL ||
    readEnvFileValue("MAKE_REGISTRATIONS_EMAIL_WEBHOOK_URL") ||
    "https://hook.us2.make.com/4xoil8l0oduxjrpb5vtlqiws6v8lr5c9";
  if (!url) {
    return json({ ok: false, error: "Missing MAKE_REGISTRATIONS_EMAIL_WEBHOOK_URL" }, 500);
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
    event: "registrations_email",
    deal,
    meta: {
      source: body?.source || "registrations_summary_toggle",
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
