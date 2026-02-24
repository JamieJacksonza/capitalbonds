import { getSessionFromRequest } from "@/app/lib/auth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export const runtime = "nodejs";

type SupabaseLike = {
  schema?: (schema: string) => { from: (table: string) => unknown };
  from: (table: string) => unknown;
};

function fromTable(sb: SupabaseLike, table: string) {
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return typeof sb.schema === "function" ? sb.schema(schema).from(table) : sb.from(table);
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ ok: true, user: null });

  // Always try to refresh role from DB so Settings/Admin options stay in sync.
  try {
    const sb = getSupabaseAdmin();
    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();

    const query = fromTable(sb as unknown as SupabaseLike, table) as {
      select: (columns: string) => {
        ilike: (column: string, value: string) => {
          limit: (count: number) => {
            maybeSingle: () => Promise<{ data: any; error: { message?: string } | null }>;
          };
        };
      };
    };

    let data: any = null;
    if (session.email) {
      const byEmail = await query.select("*").ilike("email", session.email).limit(1).maybeSingle();
      if (!byEmail.error && byEmail.data) data = byEmail.data;
    }

    if (!data && session.name) {
      const byName = await query.select("*").ilike("name", session.name).limit(1).maybeSingle();
      if (!byName.error && byName.data) data = byName.data;
    }

    if (data) {
      return Response.json({
        ok: true,
        user: {
          name: String(data?.name || session.name || "").trim() || "User",
          email: data?.email ? String(data.email).trim().toLowerCase() : session.email || null,
          role: String(data?.role || session.role || "").toLowerCase() === "admin" ? "admin" : "consultant",
          insurance_notification_email: data?.insurance_notification_email
            ? String(data.insurance_notification_email).trim().toLowerCase()
            : null,
        },
      });
    }
  } catch {}

  return Response.json({ ok: true, user: session });
}

export async function PATCH(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const raw = body?.insurance_notification_email;
    const nextEmail = raw === null || raw === undefined ? "" : String(raw).trim().toLowerCase();

    if (nextEmail && !isValidEmail(nextEmail)) {
      return Response.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();
    const q = fromTable(sb as unknown as SupabaseLike, table) as {
      update: (values: Record<string, unknown>) => {
        ilike: (column: string, value: string) => {
          select: (columns: string) => {
            maybeSingle: () => Promise<{ data: any; error: { message?: string } | null }>;
          };
        };
      };
    };

    let res: { data: any; error: { message?: string } | null };
    if (session.email) {
      res = await q
        .update({ insurance_notification_email: nextEmail || null })
        .ilike("email", String(session.email).trim())
        .select("*")
        .maybeSingle();
      if (!res.error && res.data) {
        return Response.json({
          ok: true,
          user: {
            name: String(res.data?.name || session.name || "").trim() || "User",
            email: res.data?.email ? String(res.data.email).trim().toLowerCase() : session.email || null,
            role: String(res.data?.role || session.role || "").toLowerCase() === "admin" ? "admin" : "consultant",
            insurance_notification_email: res.data?.insurance_notification_email
              ? String(res.data.insurance_notification_email).trim().toLowerCase()
              : null,
          },
        });
      }
    }

    res = await q
      .update({ insurance_notification_email: nextEmail || null })
      .ilike("name", String(session.name || "").trim())
      .select("*")
      .maybeSingle();

    if (res.error) {
      const msg = String(res.error.message || "");
      if (msg.toLowerCase().includes("insurance_notification_email") && msg.toLowerCase().includes("does not exist")) {
        return Response.json(
          {
            ok: false,
            error:
              "Column 'insurance_notification_email' does not exist yet. Run the migration to add it to consultants table.",
          },
          { status: 400 }
        );
      }
      return Response.json({ ok: false, error: msg || "Failed to update settings" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      user: {
        name: String(res.data?.name || session.name || "").trim() || "User",
        email: res.data?.email ? String(res.data.email).trim().toLowerCase() : session.email || null,
        role: String(res.data?.role || session.role || "").toLowerCase() === "admin" ? "admin" : "consultant",
        insurance_notification_email: res.data?.insurance_notification_email
          ? String(res.data.insurance_notification_email).trim().toLowerCase()
          : null,
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed to update settings" }, { status: 500 });
  }
}
