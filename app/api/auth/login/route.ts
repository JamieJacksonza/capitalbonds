import { getUsers, makeToken, makeSetCookie } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export const runtime = "nodejs";

type AuthRow = { name?: string | null; password?: string | null; role?: string | null };

function fromTable(sb: any, table: string) {
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return typeof sb.schema === "function" ? sb.schema(schema).from(table) : sb.from(table);
}

function pickPassword(row: AuthRow) {
  const raw = row?.password;
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const password = String(body.password || "");

    if (!name) {
      return Response.json({ ok: false, error: "Name required" }, { status: 400 });
    }

    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();
    let match: AuthRow | null = null;

    if (table) {
      const res = await fromTable(supabaseAdmin, table)
        .select("*")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();

      if (res.error && String(res.error.message || "").toLowerCase().includes("does not exist")) {
        match = null;
      } else if (res.error) {
        console.error("AUTH_LOGIN_SUPABASE_ERROR:", res.error);
        return Response.json({ ok: false, error: "Login failed" }, { status: 500 });
      } else {
        match = (res.data as AuthRow) || null;
      }
    }

    if (!match) {
      const users = getUsers();
      match = users.find((u) => u.name.toLowerCase() === name.toLowerCase()) || null;
    }

    if (!match) return Response.json({ ok: false, error: "Invalid login" }, { status: 401 });

    const storedPassword = pickPassword(match);
    if (storedPassword && storedPassword !== password) {
      return Response.json({ ok: false, error: "Invalid login" }, { status: 401 });
    }
    if (!storedPassword && password) {
      return Response.json({ ok: false, error: "Invalid login" }, { status: 401 });
    }

    const token = makeToken({ name: String(match.name || name), role: "consultant" });

    return Response.json(
      { ok: true, user: { name: String(match.name || name) } },
      { headers: { "Set-Cookie": makeSetCookie(token) } }
    );
  } catch (e: any) {
    console.error("LOGIN_ROUTE_ERROR:", e);
    return Response.json({ ok: false, error: e?.message || "Login crashed" }, { status: 500 });
  }
}
