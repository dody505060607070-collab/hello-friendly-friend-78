import { supabase } from "@/integrations/supabase/client";

/** فصل المالك عن العقارات والوحدات والمباني قبل حذفه */
async function detachOwner(ids: string[]) {
  const tables = ["properties", "units", "buildings"] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).update({ owner_id: null }).in("owner_id", ids);
    if (error) throw error;
  }
}

/** حذف العقود المرتبطة بالملاك المحددين */
export async function deleteContractsOfOwners(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("contracts").delete().in("owner_id", ids);
  if (error) throw error;
}

/** حذف مالك أو أكثر، مع خيار حذف عقودهم */
export async function deleteOwners(ids: string[], alsoContracts: boolean) {
  if (!ids.length) return;
  if (alsoContracts) await deleteContractsOfOwners(ids);
  else {
    const { error } = await supabase.from("contracts").update({ owner_id: null }).in("owner_id", ids);
    if (error) throw error;
  }
  await detachOwner(ids);
  const { error } = await supabase.from("contacts").delete().in("id", ids);
  if (error) throw error;
}

/** حذف سجلات استيراد العقد وملفاتها المخزّنة إن لم تُستخدم في عقد آخر */
async function cleanupContractImports(contractId: string) {
  const { data: rows, error } = await supabase
    .from("contract_imports")
    .select("id, file_path")
    .eq("contract_id", contractId);
  if (error) throw error;
  if (!rows?.length) return;

  for (const row of rows) {
    if (row.file_path) {
      const { count, error: usageError } = await supabase
        .from("contract_imports")
        .select("id", { count: "exact", head: true })
        .eq("file_path", row.file_path)
        .neq("id", row.id);
      if (usageError) throw usageError;
      if (!count) {
        await supabase.storage.from("contract-files").remove([row.file_path]);
      }
    }
  }

  const { error: delError } = await supabase
    .from("contract_imports")
    .delete()
    .in("id", rows.map((r) => r.id));
  if (delError) throw delError;
}

/** حذف عقد، مع خيار حذف المالك المرتبط به */
export async function deleteContractWithOwner(contractId: string, ownerId: string | null, alsoOwner: boolean) {
  await cleanupContractImports(contractId);
  const { error } = await supabase.from("contracts").delete().eq("id", contractId);
  if (error) throw error;
  if (alsoOwner && ownerId) await deleteOwners([ownerId], true);
}

/** حذف فاتورة بالكامل: المدفوعات ثم البنود ثم الفاتورة نفسها */
export async function deleteInvoice(invoiceId: string) {
  const payments = await supabase.from("invoice_payments").delete().eq("invoice_id", invoiceId);
  if (payments.error) throw payments.error;
  const items = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (items.error) throw items.error;
  const invoice = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (invoice.error) throw invoice.error;
}
