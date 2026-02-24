import { requireSession } from "@/app/lib/auth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthRow = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  password?: string | null;
};

type SupabaseLike = {
  schema?: (schema: string) => { from: (table: string) => unknown };
  from: (table: string) => unknown;
};

function fromTable(sb: SupabaseLike, table: string) {
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return typeof sb.schema === "function" ? sb.schema(schema).from(table) : sb.from(table);
}

function errStatus(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error || "");
  if (msg === "UNAUTHENTICATED") return 401;
  if (msg === "FORBIDDEN") return 403;
  return 500;
}

async function findUserRow(sb: SupabaseLike, table: string, email?: string, name?: string) {
  const query = fromTable(sb, table) as {
    select: (columns: string) => {
      ilike: (column: string, value: string) => {
        limit: (count: number) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    };
  };

  if (email) {
    const byEmail = await query.select("*").ilike("email", email).limit(1).maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail.data as AuthRow;
  }

  if (name) {
    const byName = await query.select("*").ilike("name", name).limit(1).maybeSingle();
    if (!byName.error && byName.data) return byName.data as AuthRow;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const session = requireSession(req);
    const body = await req.json().catch(() => ({}));

    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return Response.json({ ok: false, error: "Current and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return Response.json({ ok: false, error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();
    const sb = getSupabaseAdmin();
    const row = await findUserRow(sb as unknown as SupabaseLike, table, session.email, session.name);

    if (!row) {
      return Response.json({ ok: false, error: "User record not found" }, { status: 404 });
    }

    const stored = String(row.password || "");
    if (stored !== currentPassword) {
      return Response.json({ ok: false, error: "Current password is incorrect" }, { status: 401 });
    }

    const updateTable = fromTable(sb as unknown as SupabaseLike, table) as {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: unknown) => { select: (columns: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }> } };
      };
    };

    let updateRes: { data: unknown; error: { message?: string } | null };
    if (row.id) {
      updateRes = await updateTable.update({ password: newPassword }).eq("id", row.id).select("id").maybeSingle();
    } else if (row.email) {
      updateRes = await updateTable.update({ password: newPassword }).eq("email", row.email).select("id").maybeSingle();
    } else {
      updateRes = await updateTable.update({ password: newPassword }).eq("name", row.name || session.name).select("id").maybeSingle();
    }

    if (updateRes.error) {
      return Response.json({ ok: false, error: updateRes.error.message || "Failed to update password" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Password change failed" },
      { status: errStatus(error) }
    );
  }
}
