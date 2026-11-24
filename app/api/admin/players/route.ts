import { requireAdmin } from "@/lib/admin";
import { dynamicRoute, handleRouteError } from "@/lib/http";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    await dynamicRoute();
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
    const beforeRaw = url.searchParams.get("before");
    const beforeIdRaw = url.searchParams.get("beforeId");
    const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw).toISOString() : null;
    const beforeId = beforeIdRaw && /^[0-9a-f-]{36}$/i.test(beforeIdRaw) ? beforeIdRaw : null;
    const hasCursor = Boolean(before && beforeId);
    const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
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
      where u.username ilike ${pattern} escape '\\'
        and (
          ${hasCursor} = false
          or u.created_at < ${before}::timestamptz
          or (u.created_at = ${before}::timestamptz and u.id::text < ${beforeId})
        )
      order by u.created_at desc, u.id desc
      limit ${PAGE_SIZE + 1}
    `;
    const page = rows.slice(0, PAGE_SIZE);
    const extra = rows[PAGE_SIZE] as { created_at: string; id: string } | undefined;
    const last = page[page.length - 1] as { created_at: string; id: string } | undefined;
    return Response.json({
      next: extra && last
        ? { before: new Date(last.created_at).toISOString(), beforeId: last.id }
        : null,
      players: page.map((row) => {
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
