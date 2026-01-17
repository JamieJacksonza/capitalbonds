import { getSessionFromRequest } from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = getSessionFromRequest(req);
  return Response.json({ ok: true, user });
}
