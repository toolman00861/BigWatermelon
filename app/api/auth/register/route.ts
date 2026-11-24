import { randomUUID } from "crypto";
import { getSql, isUniqueViolation } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { issueSession, validUsername } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    if (!validUsername(username)) {
      return jsonError("用户名用 2 到 20 位的汉字、字母或数字", 400);
    }
    if (password.length < 6 || password.length > 72) {
      return jsonError("密码至少 6 位", 400);
    }
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const sql = await getSql();
    try {
      await sql`
        insert into users (id, username, password_hash)
        values (${id}, ${username}, ${passwordHash})
      `;
    } catch (error) {
      if (isUniqueViolation(error)) return jsonError("这个用户名已经有人用了", 409);
      throw error;
    }
    await issueSession(id);
    return Response.json({ user: { id, username } });
  } catch (error) {
    return handleRouteError(error);
  }
}
