import { getSql } from "@/lib/db";
import { dynamicRoute, handleRouteError, jsonError } from "@/lib/http";
import { readSessionUser } from "@/lib/session";

export async function GET() {
  try {
    await dynamicRoute();
    const user = await readSessionUser();
    if (!user) return jsonError("请先登录", 401);
    const sql = await getSql();
    const images = await sql`
      select stage from player_images
      where user_id = ${user.id}
      order by stage
    `;
    const audio = await sql`
      select user_id from player_audio where user_id = ${user.id}
    `;
    return Response.json({
      images: images.map((row) => Number((row as { stage: number }).stage)),
      audio: audio.length > 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
