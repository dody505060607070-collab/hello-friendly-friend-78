import { supabase } from "@/integrations/supabase/client";
import { uploadToServerStorage } from "@/lib/storage.functions";

/**
 * سائق التخزين على الواجهة. عند النشر على Hostinger VPS اضبط
 * VITE_STORAGE_DRIVER=local (مع STORAGE_DRIVER=local على الخادم) لتصبح كل
 * الملفات على قرص الخادم بدل التخزين السحابي.
 */
export function clientStorageDriver(): "local" | "supabase" {
  return import.meta.env["VITE_STORAGE_DRIVER"] === "local" ? "local" : "supabase";
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export type UploadedMedia = { key: string; url: string };

/**
 * يرفع ملفًا ويعيد رابطًا قابلًا للعرض.
 * bucket يُستخدم كمجلد أعلى في الوضع المحلي وكـ bucket في الوضع السحابي.
 */
export async function uploadMedia(bucket: string, path: string, file: File): Promise<UploadedMedia> {
  if (clientStorageDriver() === "local") {
    const dataBase64 = await fileToBase64(file);
    const res = await uploadToServerStorage({ data: { key: `${bucket}/${path}`, dataBase64 } });
    return res;
  }

  const up = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return { key: `${bucket}/${path}`, url: signed.data?.signedUrl ?? "" };
}
