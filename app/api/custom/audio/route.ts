import { getSql } from "@/lib/db";
import { dynamicRoute, handleRouteError, jsonError } from "@/lib/http";
import { readSessionUser } from "@/lib/session";
import { AUDIO_TYPES, readUpload } from "@/lib/uploads";

export async function GET() {
  try {
    await dynamicRoute();
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const sql = await getSql();
    const rows = await sql`
      select content_type, data_base64
      from player_audio
      where user_id = ${user.id}
    `;
    const row = rows[0] as { content_type: string; data_base64: string } | undefined;
    if (!row) return jsonError("还没有自定义音效", 404);
    return new Response(Buffer.from(row.data_base64, "base64"), {
      headers: {
        "Content-Type": row.content_type,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const upload = await readUpload(request, AUDIO_TYPES, 2 * 1024 * 1024);
    if (!upload.ok) return jsonError(upload.error, 400);
    const sql = await getSql();
    await sql`
      insert into player_audio (user_id, content_type, data_base64, updated_at)
      values (${user.id}, ${upload.contentType}, ${upload.dataBase64}, now())
      on conflict (user_id) do update
      set content_type = excluded.content_type,
          data_base64 = excluded.data_base64,
          updated_at = now()
    `;
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const sql = await getSql();
    await sql`delete from player_audio where user_id = ${user.id}`;
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
