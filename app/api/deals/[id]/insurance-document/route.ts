export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/app/lib/auth";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getKeyFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const key = parts[parts.length - 2];
    return key ? decodeURIComponent(String(key)).trim() : null;
  } catch {
    return null;
  }
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

function fromTable(sb: any, table: string) {
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return typeof sb.schema === "function" ? sb.schema(schema).from(table) : sb.from(table);
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function canAccessDeal(session: any, deal: any) {
  if (!session) return false;
  if (String(session?.role || "").toLowerCase() === "admin") return true;
  const owner = String(deal?.consultant || "").trim().toLowerCase();
  const who = String(session?.name || "").trim().toLowerCase();
  return !!owner && !!who && owner === who;
}

async function fetchDealByKey(sb: any, key: string) {
  if (isUuid(key)) {
    const r = await fromTable(sb, "deals").select("*").eq("id", key).maybeSingle();
    if (r.data) return r;
  }
  const r2 = await fromTable(sb, "deals").select("*").eq("deal_code", key).maybeSingle();
  if (r2.data) return r2;

  return await fromTable(sb, "deals").select("*").eq("id", key).maybeSingle();
}

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "insurance-document";
}

export async function POST(req: Request) {
  const key = getKeyFromUrl(req);
  if (!key) return json({ ok: false, error: "Missing id" }, 400);

  const session = getSessionFromRequest(req);
  if (!session) return json({ ok: false, error: "Unauthenticated" }, 401);

  try {
    const supabase = getSupabaseServer();
    const dealRes = await fetchDealByKey(supabase, key);
    if (dealRes.error) {
      return json({ ok: false, where: "deals.lookup", error: dealRes.error.message }, 500);
    }
    if (!dealRes.data) return json({ ok: false, error: "Deal not found" }, 404);
    if (!canAccessDeal(session, dealRes.data)) return json({ ok: false, error: "Forbidden" }, 403);

    const form = await req.formData();
    const fileEntry = form.get("file");
    if (!(fileEntry instanceof File)) {
      return json({ ok: false, error: "Missing insurance document file" }, 400);
    }
    if (fileEntry.size <= 0) {
      return json({ ok: false, error: "Insurance document is empty" }, 400);
    }
    if (fileEntry.size > 10 * 1024 * 1024) {
      return json({ ok: false, error: "Insurance document must be 10MB or smaller" }, 400);
    }

    const dealId = String(dealRes.data.id);
    const bucket = String(process.env.SUPABASE_INSURANCE_DOCUMENTS_BUCKET || "insurance-documents").trim();
    const originalName = String(fileEntry.name || "insurance-document").trim() || "insurance-document";
    const safeName = sanitizeName(originalName);
    const path = `${dealId}/${Date.now()}-${safeName}`;
    const contentType = String(fileEntry.type || "application/octet-stream").trim();
    const bytes = Buffer.from(await fileEntry.arrayBuffer());

    const uploadRes = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType,
      upsert: false,
    });

    if (uploadRes.error) {
      return json(
        {
          ok: false,
          where: "storage.upload",
          error: uploadRes.error.message,
        },
        500
      );
    }

    const uploadedAt = new Date().toISOString();
    const updateRes = await fromTable(supabase, "deals")
      .update({
        insurance_document_bucket: bucket,
        insurance_document_path: path,
        insurance_document_name: originalName,
        insurance_document_mime_type: contentType,
        insurance_document_size: fileEntry.size,
        insurance_document_uploaded_at: uploadedAt,
      })
      .eq("id", dealId)
      .select("*")
      .single();

    if (updateRes.error) {
      return json(
        {
          ok: false,
          where: "deals.update",
          error: updateRes.error.message,
        },
        500
      );
    }

    return json({
      ok: true,
      deal: updateRes.data,
      document: {
        bucket,
        path,
        name: originalName,
        mimeType: contentType,
        size: fileEntry.size,
        uploadedAt,
      },
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Failed to upload insurance document" }, 500);
  }
}
