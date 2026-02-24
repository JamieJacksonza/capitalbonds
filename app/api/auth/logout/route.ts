import { makeClearCookie } from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export const runtime = "nodejs";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": makeClearCookie() } });
}
