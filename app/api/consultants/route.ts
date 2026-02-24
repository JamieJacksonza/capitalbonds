import { getSessionFromRequest } from "@/app/lib/auth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseLike = {
  schema?: (schema: string) => { from: (table: string) => unknown };
  from: (table: string) => unknown;
};

function fromTable(sb: SupabaseLike, table: string) {
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return typeof sb.schema === "function" ? sb.schema(schema).from(table) : sb.from(table);
}

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  try {
    const sb = getSupabaseAdmin();
    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();

    const q = fromTable(sb as unknown as SupabaseLike, table) as {
      select: (columns: string) => {
        order: (column: string, opts?: { ascending?: boolean }) => Promise<{ data: any[] | null; error: { message?: string } | null }>;
      };
    };

    const res = await q.select("name, role").order("name", { ascending: true });
    if (res.error) {
      return Response.json({ ok: false, error: res.error.message || "Failed to load consultants" }, { status: 500 });
    }

    const names = Array.from(
      new Set(
        (res.data || [])
          .map((r: any) => String(r?.name || "").trim())
          .filter(Boolean)
      )
    );

    return Response.json({ ok: true, consultants: names });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed to load consultants" }, { status: 500 });
  }
}
