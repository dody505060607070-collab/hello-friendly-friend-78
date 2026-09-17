import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, ImagePlus, Loader2, Pencil, Star, Trash2, UploadCloud, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { inputClass } from "@/components/kit/Modal";
import { ImageEditorModal } from "@/components/properties/ImageEditorModal";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";

type ImageRow = { id: string; url: string; sort_order: number; is_cover: boolean };

/**
 * مدير صور العقار: رفع، سحب وإفلات لإعادة الترتيب، تعيين صورة الغلاف،
 * حذف، معاينة بحجم كامل، وتعديل (قص/تكبير/تدوير) بإعادة رفع الصورة المعدّلة.
 */
export function ImageManager({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImageRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const images = useQuery({
    queryKey: ["property-images", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_images")
        .select("id, url, sort_order, is_cover")
        .eq("property_id", propertyId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ImageRow[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["property-images", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["public-properties"] });
    queryClient.invalidateQueries({ queryKey: ["public-property"] });
  };

  const list = images.data ?? [];

  const addImageUrl = async (url: string) => {
    if (!url.trim()) return;
    const { error } = await supabase.from("property_images").insert({
      property_id: propertyId,
      url: url.trim(),
      sort_order: list.length,
      is_cover: !list.length,
    });
    if (error) {
      toast.error("تعذّرت إضافة الصورة");
      return;
    }
    setImageUrl("");
    invalidate();
    toast.success("تمت إضافة الصورة");
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const [i, file] of Array.from(files).entries()) {
        const path = `${propertyId}/${Date.now()}-${i}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { url } = await uploadMedia("property-media", path, file);
        const { error } = await supabase.from("property_images").insert({
          property_id: propertyId,
          url,
          sort_order: list.length + i,
          is_cover: !list.length && i === 0,
        });
        if (error) throw error;
      }
      invalidate();
      toast.success("تم رفع الصور");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر رفع الملفات");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (rowId: string) => {
    const { error } = await supabase.from("property_images").delete().eq("id", rowId);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    invalidate();
    toast.success("تم حذف الصورة");
  };

  const setCover = async (rowId: string) => {
    const clear = await supabase.from("property_images").update({ is_cover: false }).eq("property_id", propertyId);
    if (clear.error) {
      toast.error("تعذّر التحديث");
      return;
    }
    const { error } = await supabase.from("property_images").update({ is_cover: true }).eq("id", rowId);
    if (error) {
      toast.error("تعذّر التحديث");
      return;
    }
    invalidate();
    toast.success("تم تعيين الصورة الرئيسية");
  };

  const persistOrder = async (rows: ImageRow[]) => {
    const updates = rows.map((row, index) =>
      supabase.from("property_images").update({ sort_order: index }).eq("id", row.id),
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) {
      toast.error("تعذّر حفظ الترتيب");
      return;
    }
    invalidate();
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...list];
    const [moved] = next.splice(dragIndex, 1);
    if (moved) next.splice(index, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  };

  const saveEdited = async (file: File) => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const path = `${propertyId}/${Date.now()}-edited-${file.name}`;
      const { url } = await uploadMedia("property-media", path, file);
      const { error } = await supabase.from("property_images").update({ url }).eq("id", editing.id);
      if (error) throw error;
      invalidate();
      toast.success("تم حفظ الصورة المعدّلة");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر حفظ الصورة");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-primary" />
        ) : (
          <UploadCloud className="size-6 text-muted-foreground" />
        )}
        <span className="text-[13px] text-muted-foreground">اسحب الصور هنا أو اضغط للاختيار</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void uploadFiles(e.target.files)} />
      </label>

      <div className="flex flex-wrap gap-2">
        <input
          className={inputClass + " max-w-md flex-1"}
          dir="ltr"
          placeholder="أو ألصق رابط صورة https://"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <button
          type="button"
          disabled={!imageUrl.trim()}
          onClick={() => void addImageUrl(imageUrl)}
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-4 text-[12.5px] font-semibold text-primary disabled:opacity-50"
        >
          <ImagePlus className="size-4" />
          إضافة
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((img, index) => (
          <figure
            key={img.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className={`overflow-hidden rounded-xl border bg-card ${
              img.is_cover ? "border-primary" : "border-border"
            }`}
          >
            <div className="relative">
              <img
                src={img.url}
                alt="صورة العقار"
                className="h-32 w-full cursor-zoom-in object-cover"
                onClick={() => setPreview(img.url)}
              />
              <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md bg-foreground/50 text-white">
                <GripVertical className="size-3.5" />
              </span>
              {img.is_cover ? (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Star className="size-3" />
                  الغلاف
                </span>
              ) : null}
            </div>
            <figcaption className="flex items-center justify-between gap-1 px-2 py-2 text-[11.5px]">
              <button
                type="button"
                onClick={() => void setCover(img.id)}
                className={img.is_cover ? "font-bold text-primary" : "font-semibold text-muted-foreground"}
              >
                {img.is_cover ? "الصورة الرئيسية" : "تعيين كصورة غلاف"}
              </button>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="تعديل الصورة"
                  onClick={() => setEditing(img)}
                  className="grid size-7 place-items-center rounded-md text-primary transition hover:bg-primary/10"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="حذف الصورة"
                  onClick={() => void removeImage(img.id)}
                  className="grid size-7 place-items-center rounded-md text-destructive transition hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </figcaption>
          </figure>
        ))}
        {!list.length ? (
          <p className="col-span-full rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            لا توجد صور مضافة
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 p-6" onClick={() => setPreview(null)}>
          <button
            type="button"
            aria-label="إغلاق"
            className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-card text-foreground"
            onClick={() => setPreview(null)}
          >
            <X className="size-5" />
          </button>
          <img src={preview} alt="معاينة الصورة" className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}

      {editing ? (
        <ImageEditorModal
          open={Boolean(editing)}
          imageUrl={editing.url}
          onClose={() => setEditing(null)}
          onSave={(file) => void saveEdited(file)}
          saving={savingEdit}
        />
      ) : null}
    </div>
  );
}
