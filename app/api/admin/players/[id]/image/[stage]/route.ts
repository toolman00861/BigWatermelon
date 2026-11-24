import { FRUITS } from "@/lib/fruits";
import { requireAdmin } from "@/lib/admin";
import { handleRouteError, jsonError } from "@/lib/http";
import { deleteObjects } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; stage: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const { id, stage: stageValue } = await context.params;
    const stage = Number(stageValue);
    if (!Number.isInteger(stage) || stage < 0 || stage >= FRUITS.length) {
      return jsonError("没有这一级", 404);
    }
    const rows = await admin.sql`
      select object_key from player_images
      where user_id = ${id} and stage = ${stage}
    `;
    const row = rows[0] as { object_key: string } | undefined;
    if (row) await deleteObjects([row.object_key]);
    await admin.sql`
      delete from player_images
      where user_id = ${id} and stage = ${stage}
    `;
    return Response.json({ stage });
  } catch (error) {
    return handleRouteError(error);
  }
}
