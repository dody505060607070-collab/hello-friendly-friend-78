import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { inputClass } from "@/components/kit/Modal";
import { supabase } from "@/integrations/supabase/client";

export type EditableOption = { id: string; name: string };

/**
 * قائمة اختيار مرتبطة بجدول في قاعدة البيانات (نوع العقار / الحي / المدينة)
 * مع إمكانية إضافة عنصر جديد مباشرة من النموذج. يحافظ على القيم النصية
 * القديمة غير الموجودة في القائمة كخيار إضافي حتى لا تُفقد عند الحفظ.
 */
export function EditableSelect({
  table,
  options,
  value,
  onChange,
  extraInsert,
  onAdded,
  placeholder = "— اختر —",
  disabled,
}: {
  table: "property_types" | "districts" | "cities";
  options: EditableOption[];
  value: string;
  onChange: (name: string) => void;
  extraInsert?: Record<string, unknown>;
  onAdded?: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const hasCustom = Boolean(value) && !options.some((o) => o.name === value);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from(table).insert({ name, ...(extraInsert ?? {}) });
      if (error) throw error;
      toast.success("تمت الإضافة");
      onChange(name);
      setNewName("");
      setAdding(false);
      onAdded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّرت الإضافة");
    } finally {
      setSaving(false);
    }
  };

  if (adding) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className={inputClass}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submitNew();
            }
          }}
          placeholder="اكتب اسم العنصر الجديد"
        />
        <button
          type="button"
          onClick={() => void submitNew()}
          disabled={saving || !newName.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="حفظ"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setNewName("");
          }}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
          aria-label="إلغاء"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.name}>
            {o.name}
          </option>
        ))}
        {hasCustom ? <option value={value}>{value}</option> : null}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        disabled={disabled}
        className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-3 text-[12px] font-semibold text-primary disabled:opacity-50"
      >
        <Plus className="size-3.5" />
        إضافة جديد
      </button>
    </div>
  );
}
