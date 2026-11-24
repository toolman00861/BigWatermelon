import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";

export const SESSION_COOKIE = "suika_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  username: string;
};

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql`
    select u.id, u.username
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)}
      and s.expires_at > now()
  `;
  const row = rows[0] as { id: string; username: string } | undefined;
  return row ? { id: row.id, username: row.username } : null;
}

export function validUsername(username: string) {
  return /^[\w\u4e00-\u9fff]{2,20}$/.test(username);
}

export async function issueSession(userId: string) {
  const token = newToken();
  const sql = await getSql();
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hashToken(token)}, ${userId}, now() + interval '30 days')
  `;
  await setSessionCookie(token);
}
