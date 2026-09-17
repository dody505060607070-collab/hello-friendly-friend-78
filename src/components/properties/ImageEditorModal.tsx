import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/kit/Modal";

const RATIOS = [
  { key: "4:3", label: "4:3", w: 800, h: 600 },
  { key: "16:9", label: "16:9", w: 960, h: 540 },
  { key: "1:1", label: "1:1", w: 700, h: 700 },
] as const;

/**
 * محرر صور بسيط (قص/تكبير/تدوير) باستخدام Canvas فقط، بدون أي مكتبات خارجية.
 * يعيد ملف الصورة النهائي بعد المعالجة.
 */
export function ImageEditorModal({
  open,
  imageUrl,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (file: File) => void;
  saving: boolean;
}) {
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>(RATIOS[0]);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageUrl;
  }, [open, imageUrl]);

  useEffect(() => {
    draw();
  }, [ratio, scale, rotate, offset]);

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = ratio.w;
    canvas.height = ratio.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
    ctx.rotate((rotate * Math.PI) / 180);
    const coverScale = Math.max(canvas.width / img.width, canvas.height / img.height) * scale;
    ctx.drawImage(
      img,
      (-img.width * coverScale) / 2,
      (-img.height * coverScale) / 2,
      img.width * coverScale,
      img.height * coverScale,
    );
    ctx.restore();
  }

  const startDrag = (x: number, y: number) => {
    dragRef.current = { x: x - offset.x, y: y - offset.y };
  };
  const moveDrag = (x: number, y: number) => {
    if (!dragRef.current) return;
    setOffset({ x: x - dragRef.current.x, y: y - dragRef.current.y });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `edited-${Date.now()}.jpg`, { type: "image/jpeg" });
        onSave(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="تعديل الصورة" subtitle="قص وتكبير وتدوير الصورة قبل الحفظ" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {RATIOS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRatio(r)}
              className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition ${
                ratio.key === r.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-secondary/30 p-3">
          <canvas
            ref={canvasRef}
            className="max-h-[360px] w-auto max-w-full cursor-move rounded-lg border border-border bg-card"
            onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
            onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(1, Number((s - 0.1).toFixed(2))))}
              className="grid size-8 place-items-center rounded-lg border border-border"
              aria-label="تصغير"
            >
              <ZoomOut className="size-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))}
              className="grid size-8 place-items-center rounded-lg border border-border"
              aria-label="تكبير"
            >
              <ZoomIn className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRotate((r) => (r + 90) % 360)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-semibold"
          >
            <RotateCw className="size-4" />
            تدوير 90°
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-[12.5px] font-semibold"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-[12.5px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ التعديل"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
