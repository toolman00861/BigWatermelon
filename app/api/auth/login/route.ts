import { getSql } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { verifyPassword } from "@/lib/passwords";
import { issueSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    const sql = await getSql();
    const rows = await sql`
      select id, username, password_hash, is_admin
      from users
      where username = ${username}
    `;
    const user = rows[0] as
      | { id: string; username: string; password_hash: string; is_admin: boolean }
      | undefined;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return jsonError("用户名或密码不对", 401);
    }
    await issueSession(user.id);
    return Response.json({
      user: { id: user.id, username: user.username, isAdmin: user.is_admin },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
