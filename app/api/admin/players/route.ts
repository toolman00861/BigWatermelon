import { requireAdmin } from "@/lib/admin";
import { dynamicRoute, handleRouteError } from "@/lib/http";

export async function GET() {
  try {
    await dynamicRoute();
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const rows = await admin.sql`
      select
        u.id,
        u.username,
        u.is_admin,
        u.created_at,
        s.best_score,
        s.updated_at,
        (
          select count(*)::int from player_images i where i.user_id = u.id
        ) as image_count,
        exists(select 1 from player_audio a where a.user_id = u.id) as has_audio
      from users u
      left join player_saves s on s.user_id = u.id
      order by u.created_at desc
      limit 200
    `;
    return Response.json({
      players: rows.map((row) => {
        const item = row as {
          id: string;
          username: string;
          is_admin: boolean;
          created_at: string;
          best_score: number | null;
          updated_at: string | null;
          image_count: number;
          has_audio: boolean;
        };
        return {
          id: item.id,
          username: item.username,
          isAdmin: item.is_admin,
          createdAt: new Date(item.created_at).toISOString(),
          bestScore: item.best_score ?? 0,
          updatedAt: item.updated_at ? new Date(item.updated_at).toISOString() : null,
          imageCount: Number(item.image_count),
          hasAudio: item.has_audio,
        };
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
