import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

/**
 * تخزين الملفات: يعمل بسائقين.
 * - "local": القرص المحلي للخادم (Hostinger VPS) — المسار من STORAGE_LOCAL_DIR.
 * - "supabase": التخزين السحابي الحالي (الوضع الافتراضي قبل الترحيل).
 */
export type StorageDriver = "local" | "supabase";

export function storageDriver(): StorageDriver {
  return process.env["STORAGE_DRIVER"] === "local" ? "local" : "supabase";
}

function rootDir() {
  return resolve(process.env["STORAGE_LOCAL_DIR"] ?? "/var/www/mithraa/storage");
}

/** يمنع الخروج من مجلد التخزين عبر ../ */
export function safeStoragePath(key: string) {
  const clean = normalize(key).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const full = join(rootDir(), clean);
  if (!full.startsWith(rootDir())) throw new Error("مسار ملف غير صالح");
  return { clean, full };
}

export async function writeLocalFile(key: string, bytes: Uint8Array) {
  const { clean, full } = safeStoragePath(key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return { key: clean, url: `/api/public/files/${clean}` };
}

export async function readLocalFile(key: string) {
  const { full } = safeStoragePath(key);
  const info = await stat(full);
  if (!info.isFile()) throw new Error("غير موجود");
  return await readFile(full);
}

export async function deleteLocalFile(key: string) {
  const { full } = safeStoragePath(key);
  await unlink(full);
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function mimeFor(key: string) {
  return MIME[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}
