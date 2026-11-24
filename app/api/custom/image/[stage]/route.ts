import { FRUITS } from "@/lib/fruits";
import { getSql } from "@/lib/db";
import { dynamicRoute, handleRouteError, jsonError } from "@/lib/http";
import { readSessionUser } from "@/lib/session";
import { IMAGE_TYPES, readUpload } from "@/lib/uploads";

function stageFrom(value: string) {
  const stage = Number(value);
  if (!Number.isInteger(stage) || stage < 0 || stage >= FRUITS.length) return null;
  return stage;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ stage: string }> },
) {
  try {
    await dynamicRoute();
    const stage = stageFrom((await context.params).stage);
    if (stage === null) return jsonError("没有这一级", 404);
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const sql = await getSql();
    const rows = await sql`
      select content_type, data_base64
      from player_images
      where user_id = ${user.id} and stage = ${stage}
    `;
    const row = rows[0] as { content_type: string; data_base64: string } | undefined;
    if (!row) return jsonError("这一级还是默认样子", 404);
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

export async function POST(
  request: Request,
  context: { params: Promise<{ stage: string }> },
) {
  try {
    const stage = stageFrom((await context.params).stage);
    if (stage === null) return jsonError("没有这一级", 404);
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const upload = await readUpload(request, IMAGE_TYPES, 1024 * 1024);
    if (!upload.ok) return jsonError(upload.error, 400);
    const sql = await getSql();
    await sql`
      insert into player_images (user_id, stage, content_type, data_base64)
      values (${user.id}, ${stage}, ${upload.contentType}, ${upload.dataBase64})
      on conflict (user_id, stage) do update
      set content_type = excluded.content_type,
          data_base64 = excluded.data_base64
    `;
    return Response.json({ stage });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ stage: string }> },
) {
  try {
    const stage = stageFrom((await context.params).stage);
    if (stage === null) return jsonError("没有这一级", 404);
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const sql = await getSql();
    await sql`
      delete from player_images
      where user_id = ${user.id} and stage = ${stage}
    `;
    return Response.json({ stage });
  } catch (error) {
    return handleRouteError(error);
  }
}
