import { getSql } from "@/lib/db";
import { dynamicRoute, handleRouteError, jsonError } from "@/lib/http";
import { parseSave } from "@/lib/save";
import { readSessionUser } from "@/lib/session";

export async function GET() {
  try {
    await dynamicRoute();
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const sql = await getSql();
    const rows = await sql`
      select state, best_score, updated_at
      from player_saves
      where user_id = ${user.id}
    `;
    const row = rows[0] as
      | { state: unknown; best_score: number; updated_at: string }
      | undefined;
    if (!row) return Response.json({ state: null });
    const state = parseSave(row.state);
    if (!state) return Response.json({ state: null });
    state.best = Math.max(state.best, row.best_score);
    state.updatedAt = new Date(row.updated_at).toISOString();
    return Response.json({ state });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const state = parseSave(await request.json());
    if (!state) return jsonError("存档读不懂", 400);
    state.updatedAt = new Date().toISOString();
    const sql = await getSql();
    await sql`
      insert into player_saves (user_id, best_score, state, updated_at)
      values (${user.id}, ${state.best}, ${JSON.stringify(state)}::jsonb, now())
      on conflict (user_id) do update
      set best_score = greatest(player_saves.best_score, excluded.best_score),
          state = excluded.state,
          updated_at = now()
    `;
    const rows = await sql`
      select best_score, updated_at from player_saves where user_id = ${user.id}
    `;
    const row = rows[0] as { best_score: number; updated_at: string };
    state.best = row.best_score;
    state.updatedAt = new Date(row.updated_at).toISOString();
    return Response.json({ state });
  } catch (error) {
    return handleRouteError(error);
  }
}
