import crypto from "crypto";

export type Role = "admin" | "consultant";
export type User = { name: string; email?: string; role: Role };

const COOKIE_NAME = "cb_session";

const DEFAULT_USERS: Array<{ name: string; email: string; password: string; role: Role }> = [
  { name: "Kristie", email: "kristie@capitalbonds.local", password: "Kristie123!", role: "consultant" },
  { name: "Elmarie", email: "elmarie@capitalbonds.local", password: "Elmarie123!", role: "consultant" },
  { name: "Cindy", email: "cindy@capitalbonds.local", password: "Cindy123!", role: "consultant" },
  { name: "Chelsea", email: "chelsea@capitalbonds.local", password: "Chelsea123!", role: "consultant" },
  { name: "Admin", email: "admin@capitalbonds.local", password: "Admin123!", role: "admin" },
];

function env(name: string) {
  return process.env[name];
}

function authSecret() {
  const secret = (env("AUTH_SECRET") || "").trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  // dev fallback so local setup does not break
  return "dev-secret-change-me";
}

export function getUsers(): Array<{ name: string; email: string; password: string; role: Role }> {
  const raw = env("AUTH_USERS_JSON");
  if (!raw) return DEFAULT_USERS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_USERS;

    const cleaned = parsed
      .filter((u: any) => (u?.name || u?.email) && u?.password && u?.role)
      .map((u: any) => ({
        name: String(u.name || u.email || "").trim(),
        email: String(u.email || "").trim().toLowerCase(),
        password: String(u.password),
        role: u.role === "admin" ? "admin" : "consultant",
      }))
      .filter((u: any) => u.name) as Array<{ name: string; email: string; password: string; role: Role }>;

    return cleaned.length
      ? cleaned.map((u) => ({
          ...u,
          email: u.email || `${u.name.toLowerCase().replace(/\s+/g, ".")}@capitalbonds.local`,
        }))
      : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

function sign(payload: string) {
  return crypto.createHmac("sha256", authSecret()).update(payload).digest("hex");
}

export function makeToken(user: User) {
  const payload = JSON.stringify({ ...user, iat: Date.now() });
  const sig = sign(payload);
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

export function readToken(token: string): User | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;

  const payload = Buffer.from(b64, "base64url").toString("utf8");
  if (sign(payload) !== sig) return null;

  const obj = JSON.parse(payload);
  if (!obj?.name || !obj?.role) return null;

  return {
    name: String(obj.name),
    email: obj?.email ? String(obj.email).toLowerCase() : undefined,
    role: obj.role === "admin" ? "admin" : "consultant",
  };
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  cookieHeader.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = rest.join("=") || "";
  });
  return out;
}

export function getSessionFromRequest(req: Request): User | null {
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return readToken(token);
}

export function requireSession(req: Request): User {
  const u = getSessionFromRequest(req);
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export function requireAdmin(req: Request): User {
  const u = requireSession(req);
  if (u.role !== "admin") throw new Error("FORBIDDEN");
  return u;
}

export function makeSetCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function makeClearCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
