/**
 * ينزّل كل الملفات من التخزين السحابي الحالي إلى قرص الـVPS بنفس المسارات.
 * التشغيل:  cd deploy && bun scripts/03-copy-storage.ts
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const url = process.env["SOURCE_SUPABASE_URL"];
const key = process.env["SOURCE_SERVICE_ROLE_KEY"];
const dest = process.env["STORAGE_LOCAL_DIR"] || "/var/www/mithraa/storage";
if (!url || !key) {
  console.error("ضع SOURCE_SUPABASE_URL و SOURCE_SERVICE_ROLE_KEY في البيئة");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const buckets = ["property-media", "internal-files", "contract-files"];

async function walk(bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  let page = 0;
  for (;;) {
    const { data, error } = await sb.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset: page * 100 });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await walk(bucket, path)));
      else out.push(path);
    }
    if (data.length < 100) break;
    page++;
  }
  return out;
}

let total = 0;
for (const bucket of buckets) {
  const paths = await walk(bucket).catch(() => []);
  for (const p of paths) {
    const { data, error } = await sb.storage.from(bucket).download(p);
    if (error || !data) {
      console.warn("تعذّر:", bucket, p, error?.message);
      continue;
    }
    const target = join(dest, bucket, p);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    total++;
  }
  console.log(`${bucket}: ${paths.length} ملف`);
}
console.log(`تم نسخ ${total} ملف إلى ${dest}`);
