export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
]);

export async function readUpload(
  request: Request,
  allowed: Set<string>,
  limit: number,
) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "没有收到文件" };
  if (!allowed.has(file.type)) return { ok: false as const, error: "这个文件格式不能用" };
  if (file.size <= 0 || file.size > limit) {
    return { ok: false as const, error: "文件太大或是空的" };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    ok: true as const,
    contentType: file.type,
    dataBase64: bytes.toString("base64"),
  };
}
