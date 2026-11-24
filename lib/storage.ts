import { randomUUID } from "node:crypto";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

export const UPLOADS_BUCKET = "uploads";

export class NoStorageError extends Error {
  constructor() {
    super("对象存储还没配置");
    this.name = "NoStorageError";
  }
}

export function storageConfigured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_ENDPOINT_URL_S3 &&
      process.env.AWS_REGION,
  );
}

export function uploadsBucket() {
  if (!storageConfigured()) throw new NoStorageError();
  return new Files({ adapter: neon({ bucket: UPLOADS_BUCKET }) });
}

export function imageKey(userId: string, stage: number) {
  return `players/${userId}/images/${stage}/${randomUUID()}`;
}

export function audioKey(userId: string) {
  return `players/${userId}/audio/${randomUUID()}`;
}

export async function publishUpload(
  key: string,
  bytes: Buffer,
  contentType: string,
  commit: () => Promise<string | null>,
) {
  const bucket = uploadsBucket();
  await bucket.upload(key, bytes, { contentType });
  let previous: string | null;
  try {
    previous = await commit();
  } catch (error) {
    await bucket.delete(key).catch(() => undefined);
    throw error;
  }
  if (previous && previous !== key) {
    await bucket.delete(previous).catch(() => undefined);
  }
}
