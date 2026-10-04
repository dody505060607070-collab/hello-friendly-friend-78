import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect } from "react";

export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  alt = "صورة العقار",
}: {
  images: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  alt?: string;
}) {
  const count = images.length;
  const go = useCallback(
    (delta: number) => {
      if (!count) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(1);
      if (e.key === "ArrowRight") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  if (!count) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق"
        className="absolute end-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-card text-foreground shadow-float"
      >
        <X className="size-5" />
      </button>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="السابق"
            className="absolute end-4 z-10 grid size-11 place-items-center rounded-full bg-card/90 text-foreground shadow-float"
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="التالي"
            className="absolute start-4 z-10 grid size-11 place-items-center rounded-full bg-card/90 text-foreground shadow-float"
          >
            <ChevronLeft className="size-5" />
          </button>
        </>
      ) : null}

      <img
        src={images[index]}
        alt={alt}
        className="relative z-[5] max-h-[86vh] max-w-[92vw] rounded-xl object-contain shadow-float"
      />

      <div className="absolute bottom-5 z-10 rounded-full bg-card/90 px-3 py-1 text-[12px] font-bold text-foreground">
        {index + 1} / {count}
      </div>
    </div>
  );
}
