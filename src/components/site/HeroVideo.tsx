import { Link } from "@tanstack/react-router";
import { KeyRound, Home, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import desktopVideo from "@/assets/hero-desktop.mp4.asset.json";
import mobileVideo from "@/assets/hero-mobile.mp4.asset.json";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ended, setEnded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const src = isMobile ? mobileVideo.url : desktopVideo.url;

  return (
    <section className="relative isolate overflow-hidden bg-foreground">
      <video
        key={src}
        ref={videoRef}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration && el.currentTime >= el.duration - 0.35) setEnded(true);
        }}
        onEnded={() => {
          setEnded(true);
          videoRef.current?.pause();
        }}
        className="h-[68vh] min-h-[420px] w-full object-cover md:h-[80vh]"
      />

      {/* Cinematic scrim so the wordmark stays legible on any frame */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 transition-opacity duration-1000 ${
          ended ? "opacity-100" : "opacity-60"
        }`}
      />

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center transition-opacity duration-1000 ${
          ended ? "opacity-100" : "opacity-0"
        }`}
      >
        {ended ? (
          <>
            <h1 className="animate-pop-in font-display text-[13vw] font-extrabold leading-[0.95] tracking-tight text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.55)] sm:text-[9vw] md:text-[7.5vw] lg:text-[104px]">
              مثراء العقارية
            </h1>
            <p
              className="animate-pop-in max-w-2xl text-[15px] font-semibold leading-8 text-white/85 md:text-[20px]"
              style={{ animationDelay: "220ms" }}
            >
              نبني قرارك العقاري على معرفة حقيقية بسوق القصيم — عقار مدروس، عقد واضح، ومتابعة لا
              تتوقف.
            </p>
            <div
              className="animate-pop-in pointer-events-auto mt-2 flex flex-wrap items-center justify-center gap-3"
              style={{ animationDelay: "420ms" }}
            >
              <Link
                to="/rent"
                className="shine halo group inline-flex items-center gap-2 rounded-2xl bg-white/95 px-8 py-4 text-[14.5px] font-bold text-foreground shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]"
              >
                <KeyRound className="size-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                عقارات الإيجار
              </Link>
              <Link
                to="/sale"
                className="shine glass-dark group inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-[14.5px] font-bold text-white"
              >
                <Home className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
                عقارات البيع
              </Link>
            </div>
          </>
        ) : null}
      </div>

      {/* Scroll cue */}
      <button
        type="button"
        aria-label="انزل للأسفل"
        onClick={() =>
          window.scrollTo({ top: window.innerHeight * 0.72, behavior: "smooth" })
        }
        className="group absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/80 transition-colors duration-300 hover:text-white"
      >
        <span className="text-[11px] font-semibold tracking-[0.25em] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          اكتشف
        </span>
        <span
          aria-hidden
          className="relative h-11 w-7 rounded-full border border-white/50 backdrop-blur-sm transition-all duration-300 group-hover:border-white group-hover:shadow-[0_0_18px_rgba(255,255,255,0.35)]"
        >
          <span className="absolute left-1/2 top-2.5 size-1.5 animate-scroll-wheel rounded-full bg-white" />
        </span>
        <span aria-hidden className="flex flex-col items-center -space-y-1.5">
          <ChevronDown className="size-4 animate-chevron" />
          <ChevronDown className="size-4 animate-chevron [animation-delay:220ms]" />
        </span>
      </button>

    </section>
  );
}
