import { requireAdmin } from "@/lib/admin";
import { isUniqueViolation } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { emptySave, parseSave, type SaveState } from "@/lib/save";
import { validUsername } from "@/lib/session";
import { deleteObjects } from "@/lib/storage";

type PlayerRow = {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function readPlayer(sql: Awaited<ReturnType<typeof import("@/lib/db").getSql>>, id: string) {
  const users = await sql`
    select id, username, is_admin, created_at
    from users
    where id = ${id}
  `;
  const user = users[0] as PlayerRow | undefined;
  if (!user) return null;
  const saves = await sql`
    select state, best_score, updated_at
    from player_saves
    where user_id = ${id}
  `;
  const save = saves[0] as
    | { state: unknown; best_score: number; updated_at: string }
    | undefined;
  const state = save ? parseSave(save.state) : null;
  const images = await sql`
    select stage from player_images
    where user_id = ${id}
    order by stage
  `;
  const audio = await sql`
    select user_id from player_audio where user_id = ${id}
  `;
  return {
    player: {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      createdAt: new Date(user.created_at).toISOString(),
      bestScore: save?.best_score ?? state?.best ?? 0,
      updatedAt: save ? new Date(save.updated_at).toISOString() : null,
      score: state?.score ?? 0,
      next: state?.next ?? 0,
      over: state?.over ?? false,
      fruitCount: state?.fruits.length ?? 0,
      images: images.map((row) => Number((row as { stage: number }).stage)),
      hasAudio: audio.length > 0,
    },
    state,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const id = (await context.params).id;
    if (!isUuid(id)) return jsonError("没有这个玩家", 404);
    const found = await readPlayer(admin.sql, id);
    if (!found) return jsonError("没有这个玩家", 404);
    return Response.json({ player: found.player });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const id = (await context.params).id;
    if (!isUuid(id)) return jsonError("没有这个玩家", 404);
    const found = await readPlayer(admin.sql, id);
    if (!found) return jsonError("没有这个玩家", 404);
    const current = found.player;
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      bestScore?: number;
      score?: number;
      next?: number;
      over?: boolean;
      clearFruits?: boolean;
    };
    const username = body.username?.trim() ?? current.username;
    if (current.isAdmin && username !== "admin") {
      return jsonError("管理员账号要保留这个名字", 400);
    }
    if (!current.isAdmin && username === "admin") {
      return jsonError("这个用户名留给管理员了", 400);
    }
    if (!validUsername(username)) {
      return jsonError("用户名用 2 到 20 位的汉字、字母或数字", 400);
    }
    const password = body.password ?? "";
    if (current.isAdmin && password) return jsonError("管理员密码固定是 admin", 400);
    if (password && (password.length < 6 || password.length > 72)) {
      return jsonError("密码至少 6 位", 400);
    }
    const score = Number(body.score ?? current.score);
    const bestScore = Number(body.bestScore ?? current.bestScore);
    const next = Number(body.next ?? current.next);
    if (!Number.isFinite(score) || !Number.isFinite(bestScore) || !Number.isInteger(next)) {
      return jsonError("分数读不懂", 400);
    }
    const base = found.state ?? emptySave();
    const nextState: SaveState = {
      ...base,
      score,
      best: bestScore,
      next,
      over: Boolean(body.over),
      fruits: body.clearFruits ? [] : base.fruits,
      updatedAt: new Date().toISOString(),
    };
    const parsed = parseSave(nextState);
    if (!parsed) return jsonError("这份存档读不懂", 400);
    const passwordHash = password ? await hashPassword(password) : null;
    try {
      if (passwordHash) {
        await admin.sql`
          update users
          set username = ${username}, password_hash = ${passwordHash}
          where id = ${id}
        `;
      } else {
        await admin.sql`
          update users
          set username = ${username}
          where id = ${id}
        `;
      }
    } catch (error) {
      if (isUniqueViolation(error)) return jsonError("这个用户名已经有人用了", 409);
      throw error;
    }
    await admin.sql`
      insert into player_saves (user_id, best_score, state, updated_at)
      values (${id}, ${parsed.best}, ${JSON.stringify(parsed)}::jsonb, now())
      on conflict (user_id) do update
      set best_score = excluded.best_score,
          state = excluded.state,
          updated_at = now()
    `;
    const updated = await readPlayer(admin.sql, id);
    if (!updated) return jsonError("没有这个玩家", 404);
    return Response.json({ player: updated.player });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const id = (await context.params).id;
    if (!isUuid(id)) return jsonError("没有这个玩家", 404);
    const found = await readPlayer(admin.sql, id);
    if (!found) return jsonError("没有这个玩家", 404);
    if (found.player.isAdmin) return jsonError("不能删除管理员", 400);
    const images = await admin.sql`
      select object_key from player_images where user_id = ${id}
    `;
    const audio = await admin.sql`
      select object_key from player_audio where user_id = ${id}
    `;
    const keys = [
      ...images.map((row) => String((row as { object_key: string }).object_key)),
      ...audio.map((row) => String((row as { object_key: string }).object_key)),
    ];
    await deleteObjects(keys);
    await admin.sql`delete from users where id = ${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
