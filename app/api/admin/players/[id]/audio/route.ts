import { requireAdmin } from "@/lib/admin";
import { handleRouteError } from "@/lib/http";
import { deleteObjects } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const id = (await context.params).id;
    const rows = await admin.sql`
      select object_key from player_audio where user_id = ${id}
    `;
    const row = rows[0] as { object_key: string } | undefined;
    if (row) await deleteObjects([row.object_key]);
    await admin.sql`delete from player_audio where user_id = ${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
