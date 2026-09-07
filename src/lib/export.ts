import type { WorkBook } from "xlsx";

export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportCell>;

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 90) || "تصدير";
}

export async function exportWorkbook(
  fileName: string,
  sheets: { name: string; rows: ExportRow[] }[],
) {
  const XLSX = await import("xlsx");
  const workbook: WorkBook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const rows = sheet.rows.length ? sheet.rows : [{ البيان: "لا توجد بيانات" }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!dir"] = "rtl";
    const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
    worksheet["!cols"] = Array.from({ length: range.e.c + 1 }, (_, column) => {
      let width = 12;
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
        width = Math.max(width, Math.min(45, String(cell?.v ?? "").length + 3));
      }
      return { wch: width };
    });
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName(sheet.name).slice(0, 31));
  }
  XLSX.writeFile(workbook, `${safeName(fileName)}.xlsx`, { compression: true });
}