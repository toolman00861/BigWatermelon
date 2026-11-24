import { getSql } from "@/lib/db";
import { dynamicRoute, handleRouteError, jsonError } from "@/lib/http";
import { readSessionUser } from "@/lib/session";
import { audioKey, publishUpload, uploadsBucket } from "@/lib/storage";
import { AUDIO_TYPES, readUpload } from "@/lib/uploads";

export async function GET() {
  try {
    await dynamicRoute();
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const sql = await getSql();
    const rows = await sql`
      select content_type, object_key
      from player_audio
      where user_id = ${user.id}
    `;
    const row = rows[0] as { content_type: string; object_key: string } | undefined;
    if (!row) return jsonError("还没有自定义音效", 404);
    const file = await uploadsBucket().download(row.object_key);
    return new Response(Buffer.from(await file.arrayBuffer()), {
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
    const key = audioKey(user.id);
    const sql = await getSql();
    await publishUpload(key, upload.bytes, upload.contentType, async () => {
      const rows = await sql`
        with previous as (
          select object_key from player_audio where user_id = ${user.id}
        )
        insert into player_audio (user_id, content_type, object_key, updated_at)
        values (${user.id}, ${upload.contentType}, ${key}, now())
        on conflict (user_id) do update
        set content_type = excluded.content_type,
            object_key = excluded.object_key,
            updated_at = now()
        returning (select object_key from previous) as previous_key
      `;
      const previous = rows[0] as { previous_key: string | null } | undefined;
      return previous?.previous_key ?? null;
    });
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
    const rows = await sql`
      select object_key from player_audio where user_id = ${user.id}
    `;
    const row = rows[0] as { object_key: string } | undefined;
    if (row) await uploadsBucket().delete(row.object_key);
    await sql`delete from player_audio where user_id = ${user.id}`;
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
