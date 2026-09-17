import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

type AuthedSupabase = SupabaseClient<Database>;

/** إصدار مخطط النسخة الاحتياطية — زد الرقم عند تغيير بنية الجداول بشكل جوهري. */
export const BACKUP_SCHEMA_VERSION = 1;

/** كل الجداول التجارية التي تُصدَّر في النسخة الاحتياطية الشاملة. */
export const BACKUP_TABLES = [
  "properties",
  "property_images",
  "contacts",
  "contracts",
  "contract_payments",
  "invoices",
  "invoice_items",
  "invoice_payments",
  "units",
  "buildings",
  "tasks",
  "reservations",
  "supply_requests",
  "listing_requests",
  "cities",
  "districts",
  "services",
  "partners",
  "app_settings",
  "user_roles",
  "profiles",
  "owner_requests",
  "unit_expenses",
  "owner_documents",
  "owner_delegates",
  "message_log",
] as const;

/** أعمدة تُستبعد دائمًا من النسخة الاحتياطية لأنها قد تحمل أسرارًا أو بيانات اعتماد حساسة. */
const SENSITIVE_COLUMNS = new Set([
  "password",
  "password_hash",
  "api_key",
  "secret",
  "token",
  "access_token",
  "refresh_token",
]);

function sanitizeRow(row: Record<string, unknown>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if ([...SENSITIVE_COLUMNS].some((s) => lower.includes(s))) continue;
    out[key] = (value ?? null) as Json;
  }
  return out;
}

async function assertSuperAdmin(supabase: AuthedSupabase, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("هذه العملية متاحة لمدير النظام فقط.");
}

const PAGE_SIZE = 1000;

/** يجلب كل صفوف جدول معيّن صفحة صفحة، ويتجاهل الجدول لو لم يكن موجودًا. */
async function fetchAllRows(
  supabase: AuthedSupabase,
  table: string,
): Promise<{ rows: Record<string, Json>[]; skipped: boolean }> {
  const rows: Record<string, Json>[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      // 42P01: undefined_table — الجدول غير موجود في هذه النسخة من القاعدة، تخطَّه بأمان.
      if (error.code === "42P01" || /does not exist/i.test(error.message)) {
        return { rows: [], skipped: true };
      }
      throw new Error(`فشل تصدير جدول ${table}: ${error.message}`);
    }

    const page = (data ?? []) as Record<string, unknown>[];
    for (const row of page) rows.push(sanitizeRow(row));
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { rows, skipped: false };
}

export type BackupManifest = {
  schemaVersion: number;
  generatedAt: string;
  generatedBy: string;
  tables: { table: string; rows: number; skipped: boolean }[];
  totalRows: number;
};

export type FullBackupResult = {
  manifest: BackupManifest;
  data: Record<string, Record<string, Json>[]>;
};

/** تصدير نسخة احتياطية شاملة من كل الجداول التجارية (لمدير النظام فقط). */
export const createFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FullBackupResult> => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const data: Record<string, Record<string, Json>[]> = {};
    const manifestTables: BackupManifest["tables"] = [];
    let totalRows = 0;

    for (const table of BACKUP_TABLES) {
      const { rows, skipped } = await fetchAllRows(supabaseAdmin as AuthedSupabase, table);
      if (!skipped) {
        data[table] = rows;
        totalRows += rows.length;
      }
      manifestTables.push({ table, rows: rows.length, skipped });
    }

    const manifest: BackupManifest = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      generatedBy: context.userId,
      tables: manifestTables,
      totalRows,
    };

    await supabaseAdmin.from("backup_runs").insert({
      status: "success",
      tables_count: manifestTables.filter((t) => !t.skipped).length,
      rows_count: totalRows,
      details: { schemaVersion: BACKUP_SCHEMA_VERSION, tables: manifestTables } as never,
    });

    return { manifest, data };
  });
