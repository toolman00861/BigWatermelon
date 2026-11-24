import { connection } from "next/server";
import { NoDatabaseError } from "@/lib/db";
import { NoStorageError } from "@/lib/storage";

export async function dynamicRoute() {
  await connection();
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof NoDatabaseError) {
    return Response.json({ error: error.message, database: false }, { status: 503 });
  }
  if (error instanceof NoStorageError) {
    return Response.json({ error: error.message, storage: false }, { status: 503 });
  }
  console.error(error);
  return jsonError("服务器暂时没有完成这个请求", 500);
}
