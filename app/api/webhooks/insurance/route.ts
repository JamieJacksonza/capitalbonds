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
  const urlPrimary = process.env.MAKE_INSURANCE_WEBHOOK_URL || "";
  const urlSecondary =
    process.env.MAKE_INSURANCE_WEBHOOK_URL_2 ||
    "https://hook.us2.make.com/fsqn5q7p91de37mhs3wfh8rwm1xiublu";

  const urls = Array.from(new Set([urlPrimary, urlSecondary].map((u) => String(u || "").trim()).filter(Boolean)));
  if (!urls.length) {
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
    const results = await Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        return { url, ok: res.ok, status: res.status, detail: text.slice(0, 500) };
      })
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      return json({ ok: false, error: "One or more insurance webhooks failed", failed }, 502);
    }

    return json({ ok: true, sent: results.map((r) => ({ url: r.url, status: r.status })) });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Webhook request failed" }, 502);
  }
}
