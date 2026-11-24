import { getSql } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { readSessionUser, type SessionUser } from "@/lib/session";
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

export async function requireAdmin(): Promise<
  | { ok: true; user: SessionUser; sql: Sql }
  | { ok: false; response: Response }
> {
  const user = await readSessionUser();
  if (!user) return { ok: false, response: jsonError("请先登录", 401) };
  if (!user.isAdmin) return { ok: false, response: jsonError("没有管理权限", 403) };
  return { ok: true, user, sql: await getSql() };
}
