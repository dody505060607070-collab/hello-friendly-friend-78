import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import desktopVideo from "@/assets/hero-desktop.mp4.asset.json";
import mobileVideo from "@/assets/hero-mobile.mp4.asset.json";
import logoAsset from "@/assets/mithra-logo.png.asset.json";

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
          if (el.duration && el.currentTime >= el.duration - 0.25) setEnded(true);
        }}
        onEnded={() => {
          setEnded(true);
          const el = videoRef.current;
          // Freeze on the final frame instead of resetting.
          if (el) el.pause();
        }}
        className="h-[62vh] min-h-[380px] w-full object-cover md:h-[72vh]"
      />

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-4 pb-12 text-center transition-opacity duration-1000 md:pb-16 ${
          ended ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <img
          src={logoAsset.url}
          alt="مثراء العقارية"
          width={860}
          height={1280}
          className="h-24 w-auto md:h-32"
        />
        <p className="max-w-xl px-6 text-[15px] font-semibold leading-8 text-foreground md:text-[18px]">
          مثراء العقارية — نبني قرارك العقاري على معرفة حقيقية بالسوق.
        </p>
        <div className="pointer-events-auto mt-1 flex flex-wrap justify-center gap-3">
          <Link
            to="/rent"
            className="rounded-lg bg-primary px-6 py-3 text-[14px] font-bold text-primary-foreground"
          >
            تصفّح عقارات الإيجار
          </Link>
          <Link
            to="/sale"
            className="rounded-lg border border-border bg-card px-6 py-3 text-[14px] font-bold text-foreground"
          >
            تصفّح عقارات البيع
          </Link>
        </div>
      </div>
    </section>
  );
}
