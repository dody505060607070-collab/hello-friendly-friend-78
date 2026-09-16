import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect } from "react";

/** معرض صور بملء الشاشة مع التنقل بالكيبورد */
export function Lightbox({
  images,
  index,
  onClose,
  onIndexChange,
  alt = "صورة العقار",
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  alt?: string;
}) {
  const next = useCallback(
    () => onIndexChange((index + 1) % images.length),
    [index, images.length, onIndexChange],
  );
  const prev = useCallback(
    () => onIndexChange((index - 1 + images.length) % images.length),
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") prev();
      if (e.key === "ArrowLeft") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [next, prev, onClose]);

  if (!images.length) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-foreground/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div className="flex items-center justify-between px-4 py-3 text-background">
        <span className="text-[13px] font-semibold">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full bg-background/15 transition-colors hover:bg-background/25"
          aria-label="إغلاق المعرض"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        <button
          type="button"
          onClick={prev}
          className="absolute end-4 grid size-11 place-items-center rounded-full bg-background/15 text-background transition-colors hover:bg-background/30"
          aria-label="السابق"
        >
          <ChevronRight className="size-6" />
        </button>
        <img
          src={images[index]}
          alt={alt}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
        <button
          type="button"
          onClick={next}
          className="absolute start-4 grid size-11 place-items-center rounded-full bg-background/15 text-background transition-colors hover:bg-background/30"
          aria-label="التالي"
        >
          <ChevronLeft className="size-6" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-5">
        {images.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => onIndexChange(i)}
            className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${
              i === index ? "border-primary opacity-100" : "border-transparent opacity-60"
            }`}
            aria-label={`صورة ${i + 1}`}
          >
            <img src={src} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
