import { databaseConfigured } from "@/lib/db";
import { dynamicRoute, handleRouteError } from "@/lib/http";
import { readSessionUser } from "@/lib/session";

export async function GET() {
  try {
    await dynamicRoute();
    if (!databaseConfigured()) {
      return Response.json({ user: null, database: false });
    }
    const user = await readSessionUser();
    return Response.json({ user, database: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
