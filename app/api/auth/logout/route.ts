import { getSql, NoDatabaseError } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import {
  clearSessionCookie,
  hashToken,
  SESSION_COOKIE,
} from "@/lib/session";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token && process.env.DATABASE_URL) {
      const sql = await getSql();
      await sql`delete from sessions where token_hash = ${hashToken(token)}`;
    }
    await clearSessionCookie();
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof NoDatabaseError) {
      await clearSessionCookie();
      return Response.json({ ok: true });
    }
    return handleRouteError(error);
  }
}
