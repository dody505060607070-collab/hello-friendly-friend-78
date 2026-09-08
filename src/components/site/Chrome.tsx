import { ArrowUp, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { whatsappLink } from "@/lib/site-data";

/** شريط تقدّم التمرير أعلى الصفحة. */
export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
      <div className="h-full bg-gold transition-[width] duration-150" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** زر الرجوع لأعلى + واتساب سريع. */
export function FloatingActions() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-20 end-4 z-40 flex flex-col items-center gap-2 sm:bottom-28 sm:end-5 sm:gap-3">
      {show ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="الرجوع لأعلى"
          className="glass grid size-8 place-items-center rounded-full text-foreground shadow-float transition-transform hover:-translate-y-1 sm:size-11"
        >
          <ArrowUp className="size-4 sm:size-5" />
        </button>
      ) : null}
      <a
        href={whatsappLink(null, "السلام عليكم، أرغب في الاستفسار عن عقار")}
        target="_blank"
        rel="noreferrer"
        aria-label="تواصل واتساب"
        className="grid size-10 place-items-center rounded-full bg-[#25D366] text-white shadow-float transition-transform hover:scale-105 sm:size-13"
      >
        <MessageCircle className="size-5 sm:size-6" />
      </a>
    </div>
  );
}
