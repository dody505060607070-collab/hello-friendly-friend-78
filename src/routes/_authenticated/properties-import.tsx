import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exportWorkbook } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/properties-import")({
  head: () => ({
    meta: [
      { title: "استيراد العقارات من Excel | مثراء العقارية" },
      {
        name: "description",
        content: "ارفع ملف Excel لإضافة عشرات العقارات دفعة واحدة بدل الإدخال اليدوي.",
      },
      { property: "og:title", content: "استيراد العقارات من Excel" },
      { property: "og:description", content: "إضافة العقارات دفعة واحدة من ملف Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});

type Draft = {
  code: string;
  name: string;
  purpose: string;
  property_type: string | null;
  city: string | null;
  district: string | null;
  price_value: number | null;
  status: string;
  description: string | null;
  error?: string;
};

const pick = (row: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const found = Object.keys(row).find((c) => c.trim() === k);
    if (found) {
      const v = row[found];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
};

const purposeOf = (v: string) => {
  const s = v.toLowerCase();
  if (s.includes("بيع") || s.includes("sale")) return "sale";
  if (s.includes("إيجار") || s.includes("ايجار") || s.includes("rent")) return "rent";
  return "rent";
};

function ImportPage() {
  const [rows, setRows] = useState<Draft[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const template = () =>
    exportWorkbook("نموذج-استيراد-العقارات", [
      {
        name: "العقارات",
        rows: [
          {
            الكود: "A-101",
            "اسم العقار": "شقة فاخرة بحي النرجس",
            الغرض: "إيجار",
            "نوع العقار": "شقة",
            المدينة: "الرياض",
            الحي: "النرجس",
            السعر: 45000,
            الحالة: "available",
            الوصف: "غرفتان وصالة ومطبخ راكب",
          },
        ],
      },
    ]);

  const onFile = async (file: File) => {
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const first = wb.SheetNames[0];
      if (!first) throw new Error("الملف لا يحتوي على أوراق عمل");
      const sheet = wb.Sheets[first];
      if (!sheet) throw new Error("تعذّر قراءة ورقة العمل");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const drafts: Draft[] = raw.map((r, i) => {
        const code = pick(r, ["الكود", "كود", "code", "Code"]) || `IMP-${Date.now()}-${i + 1}`;
        const name = pick(r, ["اسم العقار", "الاسم", "name", "Name"]);
        const priceRaw = pick(r, ["السعر", "price", "Price", "السعر السنوي"]).replace(/[^\d.]/g, "");
        const draft: Draft = {
          code,
          name,
          purpose: purposeOf(pick(r, ["الغرض", "purpose", "Purpose"])),
          property_type: pick(r, ["نوع العقار", "النوع", "type", "property_type"]) || null,
          city: pick(r, ["المدينة", "city", "City"]) || null,
          district: pick(r, ["الحي", "district", "District"]) || null,
          price_value: priceRaw ? Number(priceRaw) : null,
          status: pick(r, ["الحالة", "status"]) || "available",
          description: pick(r, ["الوصف", "description"]) || null,
        };
        if (!name) draft.error = "اسم العقار مطلوب";
        return draft;
      });

      setRows(drafts);
      toast.success(`تمت قراءة ${drafts.length} صفًا من الملف`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر قراءة الملف");
    } finally {
      setParsing(false);
    }
  };

  const valid = rows.filter((r) => !r.error);

  const save = async () => {
    if (!valid.length) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("properties").insert(
        valid.map(({ error: _e, ...r }) => ({ ...r, is_visible: false, needs_review: true })),
      );
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success(`تمت إضافة ${valid.length} عقارًا — كلها مخفية بانتظار المراجعة`);
      setRows([]);
      void navigate({ to: "/properties" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر حفظ العقارات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHero
        title="استيراد العقارات من Excel"
        subtitle="ارفع ملفًا واحدًا لإضافة عشرات العقارات دفعة واحدة — تُحفظ مخفية حتى تراجعها وتنشرها."
        icon={FileSpreadsheet}
      />

      <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            {parsing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            اختر ملف Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={template}>
            <Download className="size-4" />
            تحميل نموذج جاهز
          </Button>
        </div>
        {rows.length ? (
          <Button type="button" size="sm" onClick={save} disabled={saving || !valid.length}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            حفظ {valid.length} عقارًا
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            text="لم يتم رفع ملف بعد"
            hint="الأعمدة المدعومة: الكود، اسم العقار، الغرض، نوع العقار، المدينة، الحي، السعر، الحالة، الوصف. حمّل النموذج الجاهز لتعبئته."
            icon={FileSpreadsheet}
          />
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full text-right text-[13px]">
            <thead className="bg-muted/60 text-[12px] text-muted-foreground">
              <tr>
                {["الكود", "الاسم", "الغرض", "النوع", "المدينة", "الحي", "السعر", "الحالة"].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} className={r.error ? "bg-destructive/10" : ""}>
                  <td className="px-4 py-2 font-semibold">{r.code}</td>
                  <td className="px-4 py-2">{r.name || <span className="text-destructive">{r.error}</span>}</td>
                  <td className="px-4 py-2">{r.purpose === "sale" ? "بيع" : "إيجار"}</td>
                  <td className="px-4 py-2">{r.property_type ?? "—"}</td>
                  <td className="px-4 py-2">{r.city ?? "—"}</td>
                  <td className="px-4 py-2">{r.district ?? "—"}</td>
                  <td className="px-4 py-2">{r.price_value ?? "—"}</td>
                  <td className="px-4 py-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
