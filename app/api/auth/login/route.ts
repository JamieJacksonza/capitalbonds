import { getUsers, makeSetCookie, makeToken, type Role } from "@/app/lib/auth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const runtime = "nodejs";

type AuthRow = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  password?: string | null;
  role?: string | null;
};

type SupabaseLike = {
  schema?: (schema: string) => { from: (table: string) => unknown };
  from: (table: string) => unknown;
};

function fromTable(sb: SupabaseLike, table: string) {
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return typeof sb.schema === "function" ? sb.schema(schema).from(table) : sb.from(table);
}

function tryGetSupabaseAdmin() {
  try {
    return getSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase config error";
    console.warn("AUTH_LOGIN_SUPABASE_DISABLED:", message);
    return null;
  }
}

function pickPassword(row: AuthRow) {
  const raw = row?.password;
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function pickRole(row: AuthRow): Role {
  return String(row?.role || "").trim().toLowerCase() === "admin" ? "admin" : "consultant";
}

async function findSupabaseUserByEmail(sb: SupabaseLike, table: string, email: string) {
  const query = fromTable(sb, table) as {
    select: (columns: string) => {
      ilike: (column: string, value: string) => {
        limit: (count: number) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    };
  };

  const res = await query
    .select("*")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (res.error) {
    const msg = String(res.error.message || "").toLowerCase();
    if (msg.includes("column") && msg.includes("email") && msg.includes("does not exist")) {
      return { data: null as AuthRow | null, missingEmailColumn: true };
    }
    if (msg.includes("does not exist")) {
      return { data: null as AuthRow | null, missingEmailColumn: true };
    }
    throw new Error(res.error.message || "Lookup failed");
  }

  return { data: (res.data as AuthRow) || null, missingEmailColumn: false };
}

async function findSupabaseUserByName(sb: SupabaseLike, table: string, name: string) {
  const query = fromTable(sb, table) as {
    select: (columns: string) => {
      ilike: (column: string, value: string) => {
        limit: (count: number) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    };
  };

  const res = await query
    .select("*")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (res.error) {
    const msg = String(res.error.message || "").toLowerCase();
    if (msg.includes("does not exist")) {
      return null;
    }
    throw new Error(res.error.message || "Lookup failed");
  }

  return (res.data as AuthRow) || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const identifier = email;
    const legacyName = String(body.name || "").trim();
    const password = String(body.password || "");

    if (!email && !legacyName) {
      return Response.json({ ok: false, error: "Email required" }, { status: 400 });
    }

    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();
    let match: AuthRow | null = null;
    const sb = tryGetSupabaseAdmin();

    if (table && sb) {
      try {
        if (email) {
          const found = await findSupabaseUserByEmail(sb as SupabaseLike, table, email);
          match = found.data;
          if (!match && found.missingEmailColumn && (legacyName || identifier)) {
            match = await findSupabaseUserByName(sb as SupabaseLike, table, legacyName || identifier);
          }
          if (!match) {
            match = await findSupabaseUserByName(sb as SupabaseLike, table, identifier);
          }
        } else if (legacyName) {
          match = await findSupabaseUserByName(sb as SupabaseLike, table, legacyName);
        }
      } catch (error) {
        console.error("AUTH_LOGIN_SUPABASE_ERROR:", error);
        return Response.json({ ok: false, error: "Login failed" }, { status: 500 });
      }
    }

    if (!match) {
      const users = getUsers();
      match =
        users.find((u) => email && u.email.toLowerCase() === email) ||
        users.find((u) => email && u.name.toLowerCase() === email.toLowerCase()) ||
        users.find((u) => legacyName && u.name.toLowerCase() === legacyName.toLowerCase()) ||
        null;
    }

    if (!match) return Response.json({ ok: false, error: "Invalid login" }, { status: 401 });

    const storedPassword = pickPassword(match);
    if (storedPassword && storedPassword !== password) {
      return Response.json({ ok: false, error: "Invalid login" }, { status: 401 });
    }
    if (!storedPassword && password) {
      return Response.json({ ok: false, error: "Invalid login" }, { status: 401 });
    }

    const resolvedName = String(match.name || legacyName || email || "User").trim();
    const resolvedEmail = String(match.email || email || "").trim().toLowerCase();
    const role = pickRole(match);

    const token = makeToken({
      name: resolvedName,
      email: resolvedEmail || undefined,
      role,
    });

    return Response.json(
      { ok: true, user: { name: resolvedName, email: resolvedEmail || null, role } },
      { headers: { "Set-Cookie": makeSetCookie(token) } }
    );
  } catch (error: unknown) {
    console.error("LOGIN_ROUTE_ERROR:", error);
    const message = error instanceof Error ? error.message : "Login crashed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
