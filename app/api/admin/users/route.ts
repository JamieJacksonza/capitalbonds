import { requireAdmin } from "@/app/lib/auth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "admin" | "consultant";

type UserRow = {
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

function normalizeRole(v: unknown): Role {
  return String(v || "").trim().toLowerCase() === "admin" ? "admin" : "consultant";
}

function errorStatus(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error || "");
  if (msg === "UNAUTHENTICATED") return 401;
  if (msg === "FORBIDDEN") return 403;
  return 500;
}

function isMissingColumnError(message: string, column: string) {
  const m = String(message || "").toLowerCase();
  return m.includes("column") && m.includes(column.toLowerCase()) && m.includes("does not exist");
}

async function sendUserCreatedWebhook(payload: {
  name: string;
  email: string | null;
  role: Role;
  temporary_password: string;
  created_by: string;
  created_at: string;
}) {
  const url = process.env.MAKE_USER_CREATED_WEBHOOK_URL || "";
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("ADMIN_CREATE_USER_WEBHOOK_ERROR:", e);
  }
}

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const sb = getSupabaseAdmin();
    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();

    const query = fromTable(sb as unknown as SupabaseLike, table) as {
      select: (columns: string) => {
        order: (column: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };

    const res = await query.select("*").order("name", { ascending: true });
    if (res.error) {
      return Response.json({ ok: false, error: res.error.message || "Failed to fetch users" }, { status: 500 });
    }

    const users = (Array.isArray(res.data) ? res.data : []).map((row: any) => {
      const u = row as UserRow;
      return {
        id: u.id || null,
        name: String(u.name || "").trim() || "Unknown",
        email: String(u.email || "").trim() || null,
        role: normalizeRole(u.role),
      };
    });

    return Response.json({ ok: true, users });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: errorStatus(error) }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    const role = normalizeRole(body.role);

    if (!id && !email && !name) {
      return Response.json({ ok: false, error: "User identifier is required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();

    const updateQuery = fromTable(sb as unknown as SupabaseLike, table) as {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: unknown) => {
          select: (columns: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
          };
        };
      };
    };

    let res: { data: unknown; error: { message?: string } | null };
    if (id) {
      res = await updateQuery.update({ role }).eq("id", id).select("id, name, email, role").maybeSingle();
    } else if (email) {
      res = await updateQuery.update({ role }).eq("email", email).select("id, name, email, role").maybeSingle();
    } else {
      res = await updateQuery.update({ role }).eq("name", name).select("id, name, email, role").maybeSingle();
    }

    if (res.error) {
      return Response.json({ ok: false, error: res.error.message || "Failed to update role" }, { status: 500 });
    }

    const updated = (res.data || {}) as UserRow;
    return Response.json({
      ok: true,
      user: {
        id: updated.id || null,
        name: String(updated.name || "").trim() || "Unknown",
        email: String(updated.email || "").trim() || null,
        role: normalizeRole(updated.role),
      },
    });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update user" },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = normalizeRole(body.role);

    if (!name) {
      return Response.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    if (!password) {
      return Response.json({ ok: false, error: "Password is required" }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ ok: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();
    const base = fromTable(sb as unknown as SupabaseLike, table) as {
      insert: (values: Record<string, unknown>) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
        };
      };
      select: (columns: string) => {
        ilike: (column: string, value: string) => {
          limit: (count: number) => {
            maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
          };
        };
      };
    };

    // Duplicate checks
    const byName = await base.select("*").ilike("name", name).limit(1).maybeSingle();
    if (byName.data) {
      return Response.json({ ok: false, error: "A user with this name already exists" }, { status: 409 });
    }

    let emailColumnExists = true;
    if (email) {
      const byEmail = await base.select("*").ilike("email", email).limit(1).maybeSingle();
      if (byEmail.error && isMissingColumnError(String(byEmail.error.message || ""), "email")) {
        emailColumnExists = false;
      } else if (byEmail.error) {
        return Response.json({ ok: false, error: byEmail.error.message || "Failed to validate email" }, { status: 500 });
      } else if (byEmail.data) {
        return Response.json({ ok: false, error: "A user with this email already exists" }, { status: 409 });
      }
    }

    let created: { data: unknown; error: { message?: string; code?: string } | null };
    if (email && emailColumnExists) {
      const withEmail = { name, email: email || null, password, role };
      created = await base.insert(withEmail).select("id, name, email, role").maybeSingle();
    } else {
      // Fallback if this project has not added consultants.email yet.
      created = await base
        .insert({ name, password, role })
        .select("id, name, role")
        .maybeSingle();
    }

    if (created.error && isMissingColumnError(String(created.error.message || ""), "email")) {
      created = await base
        .insert({ name, password, role })
        .select("id, name, role")
        .maybeSingle();
    }

    if (created.error) {
      const msg = String(created.error.message || "");
      if (String(created.error.code || "") === "23505" || msg.toLowerCase().includes("duplicate")) {
        return Response.json({ ok: false, error: "User already exists" }, { status: 409 });
      }
      return Response.json({ ok: false, error: msg || "Failed to create user" }, { status: 500 });
    }

    const u = (created.data || {}) as UserRow;
    const createdUser = {
      id: u.id || null,
      name: String(u.name || "").trim() || name,
      email: u.email ? String(u.email).trim().toLowerCase() : (email || null),
      role: normalizeRole(u.role || role),
    };

    await sendUserCreatedWebhook({
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      temporary_password: password,
      created_by: String(adminUser.name || "admin"),
      created_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      user: createdUser,
    });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create user" },
      { status: errorStatus(error) }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();

    if (!id && !email && !name) {
      return Response.json({ ok: false, error: "User identifier is required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const table = (process.env.AUTH_USERS_TABLE || "consultants").trim();
    const base = fromTable(sb as unknown as SupabaseLike, table) as {
      delete: () => {
        eq: (column: string, value: unknown) => Promise<{ error: { message?: string } | null }>;
      };
    };

    let res: { error: { message?: string } | null };
    if (id) {
      res = await base.delete().eq("id", id);
    } else if (email) {
      res = await base.delete().eq("email", email);
      if (res.error && isMissingColumnError(String(res.error.message || ""), "email")) {
        if (!name) {
          return Response.json(
            { ok: false, error: "Email column does not exist on this schema. Pass name or id." },
            { status: 400 }
          );
        }
        res = await base.delete().eq("name", name);
      }
    } else {
      res = await base.delete().eq("name", name);
    }

    if (res.error) {
      return Response.json({ ok: false, error: res.error.message || "Failed to remove user" }, { status: 500 });
    }

    return Response.json({ ok: true, removed: true });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to remove user" },
      { status: errorStatus(error) }
    );
  }
}
