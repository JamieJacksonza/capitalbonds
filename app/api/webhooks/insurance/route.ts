import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  const key = service || anon;
  if (!key) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");

  return createClient(url, key, { auth: { persistSession: false } });
}

async function buildInsuranceDocumentPayload(deal: any) {
  const bucket = String(
    deal?.insurance_document_bucket ??
      deal?.insuranceDocumentBucket ??
      ""
  ).trim();
  const path = String(
    deal?.insurance_document_path ??
      deal?.insuranceDocumentPath ??
      ""
  ).trim();
  const name = String(
    deal?.insurance_document_name ??
      deal?.insuranceDocumentName ??
      ""
  ).trim();

  if (!bucket || !path) return null;

  const mimeType = String(
    deal?.insurance_document_mime_type ??
      deal?.insuranceDocumentMimeType ??
      ""
  ).trim();
  const sizeRaw =
    deal?.insurance_document_size ??
    deal?.insuranceDocumentSize;
  const uploadedAt = String(
    deal?.insurance_document_uploaded_at ??
      deal?.insuranceDocumentUploadedAt ??
      ""
  ).trim();

  let signedUrl: string | null = null;
  let base64: string | null = null;
  let dataUrl: string | null = null;
  try {
    const supabase = getSupabaseServer();
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (!signed.error && signed.data?.signedUrl) {
      signedUrl = signed.data.signedUrl;
    }

    const downloaded = await supabase.storage.from(bucket).download(path);
    if (!downloaded.error && downloaded.data) {
      const buffer = Buffer.from(await downloaded.data.arrayBuffer());
      base64 = buffer.toString("base64");
      const safeMimeType = mimeType || "application/octet-stream";
      dataUrl = `data:${safeMimeType};base64,${base64}`;
    }
  } catch {}

  return {
    bucket,
    path,
    name: name || null,
    mimeType: mimeType || null,
    size: Number.isFinite(Number(sizeRaw)) ? Number(sizeRaw) : null,
    uploadedAt: uploadedAt || null,
    signedUrl,
    base64,
    dataUrl,
    googleVisionInput:
      base64
        ? {
            fileName: name || null,
            mimeType: mimeType || "application/octet-stream",
            contentBase64: base64,
            sourceType: "inline_base64",
          }
        : null,
  };
}

function buildCurrentInfo(deal: any) {
  return {
    id: deal?.id ?? null,
    dealCode: deal?.deal_code ?? deal?.dealCode ?? null,
    dealOpsNumber: deal?.deal_deck_id ?? deal?.dealDeckId ?? null,
    applicant: deal?.applicant ?? deal?.client_name ?? deal?.clientName ?? null,
    consultant: deal?.consultant ?? null,
    agent: deal?.agent ?? deal?.agent_name ?? deal?.agentName ?? null,
    stage: deal?.stage ?? null,
    amountZar: deal?.amount_zar ?? deal?.amountZar ?? null,
    purchasePrice: deal?.purchase_price ?? deal?.purchasePrice ?? null,
    propertyAddress: deal?.property_address ?? deal?.propertyAddress ?? null,
    clientEmail: deal?.client_email ?? deal?.clientEmail ?? deal?.applicant_email ?? null,
    clientCellphone:
      deal?.client_cellphone ?? deal?.clientCellphone ?? deal?.applicant_cell ?? null,
    insuranceNeeded: deal?.insurance_needed ?? deal?.insuranceNeeded ?? null,
    insuranceDocumentName:
      deal?.insurance_document_name ?? deal?.insuranceDocumentName ?? null,
    insuranceDocumentUploadedAt:
      deal?.insurance_document_uploaded_at ?? deal?.insuranceDocumentUploadedAt ?? null,
    notes: deal?.notes ?? null,
    updatedAt: deal?.updated_at ?? deal?.updatedAt ?? null,
  };
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

  const insuranceDocument = await buildInsuranceDocumentPayload(deal);

  const payload = {
    event: "insurance_email",
    deal,
    currentInfo: buildCurrentInfo(deal),
    insuranceDocument,
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
