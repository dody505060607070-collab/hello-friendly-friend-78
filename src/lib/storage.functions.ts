import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * رفع ملف إلى تخزين الخادم (Hostinger VPS) عند تفعيل STORAGE_DRIVER=local.
 * يُستدعى من الواجهة عبر uploadMedia() في src/lib/media.ts.
 */
export const uploadToServerStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    key: z.string().min(3).max(500),
    dataBase64: z.string().min(1).max(280_000_000),
  }).parse(input))
  .handler(async ({ data }) => {
    const { assertAllowedStorageKey, writeLocalFile } = await import("./storage.server");
    assertAllowedStorageKey(data.key);
    const base64 = data.dataBase64.includes(",")
      ? data.dataBase64.slice(data.dataBase64.indexOf(",") + 1)
      : data.dataBase64;
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    const maxMb = Number(process.env["STORAGE_MAX_UPLOAD_MB"] ?? 200);
    if (bytes.byteLength > maxMb * 1024 * 1024)
      throw new Error(`حجم الملف يتجاوز الحد المسموح (${maxMb} ميجابايت)`);
    return await writeLocalFile(data.key, bytes);
  });

export const deleteFromServerStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().min(3).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { assertAllowedStorageKey, deleteLocalFile } = await import("./storage.server");
    assertAllowedStorageKey(data.key);
    await deleteLocalFile(data.key);
    return { ok: true };
  });
