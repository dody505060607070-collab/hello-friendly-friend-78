import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * رفع ملف إلى تخزين الخادم (Hostinger VPS) عند تفعيل STORAGE_DRIVER=local.
 * يُستدعى من الواجهة عبر uploadMedia() في src/lib/media.ts.
 */
export const uploadToServerStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; dataBase64: string }) => {
    if (!input.key || !input.dataBase64) throw new Error("بيانات الملف ناقصة");
    return input;
  })
  .handler(async ({ data }) => {
    const { writeLocalFile } = await import("./storage.server");
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
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data }) => {
    const { deleteLocalFile } = await import("./storage.server");
    await deleteLocalFile(data.key);
    return { ok: true };
  });
