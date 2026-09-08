import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import markAsset from "@/assets/mithra-mark.png.asset.json";
import { askPublicAi } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const starters = [
  "كيف أعرض عقاري للإيجار عندكم؟",
  "ما الفرق بين قسم الإيجار وقسم البيع؟",
  "أبحث عن شقة في بريدة، من أين أبدأ؟",
];

export function AiWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "مرحبًا بك في مثراء العقارية 👋 أنا المساعد الذكي، كيف أخدمك اليوم؟",
    },
  ]);
  const scroller = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const ask = useMutation({
    mutationFn: async (text: string) => {
      const next: Message[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const res = await askPublicAi({ data: { messages: next } });
      return res.text;
    },
    onSuccess: (text) => setMessages((prev) => [...prev, { role: "assistant", content: text }]),
    onError: (err) =>
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? `تعذّر الوصول للمساعد الآن: ${err.message}`
              : "تعذّر الوصول للمساعد الآن، حاول لاحقًا أو تواصل معنا مباشرة.",
        },
      ]),
  });

  const send = (text: string) => {
    const value = text.trim();
    if (!value || ask.isPending) return;
    setInput("");
    ask.mutate(value);
  };

  return (
    <>
      <div
        style={{ transform: `translateY(${offsetY}px)` }}
        className="fixed bottom-20 start-4 z-50 touch-none select-none sm:bottom-28 sm:start-5"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragging.current = { startY: e.clientY, startOffset: offsetY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = dragging.current;
          if (!d) return;
          const delta = e.clientY - d.startY;
          if (Math.abs(delta) > 4) d.moved = true;
          const next = Math.min(40, Math.max(-(window.innerHeight - 190), d.startOffset + delta));
          setOffsetY(next);
        }}
        onPointerUp={() => {
          const moved = dragging.current?.moved;
          dragging.current = null;
          if (!moved) setOpen((v) => !v);
        }}
        title="اسحب لتحريك المساعد • اضغط للفتح"
      >
        <button
          type="button"
          aria-label="مثراء AI — المساعد الذكي"
          className="glass shine group flex flex-col items-center gap-0.5 rounded-2xl px-2 pb-1.5 pt-2 shadow-float sm:gap-1 sm:rounded-3xl sm:px-3 sm:pb-2 sm:pt-3"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-white/70 ring-1 ring-primary/15 sm:size-14 sm:rounded-2xl">
            {open ? (
              <X className="size-4 text-primary sm:size-6" />
            ) : (
              <img
                src={markAsset.url}
                alt=""
                width={680}
                height={360}
                loading="lazy"
                className="h-6 w-auto animate-float-slow sm:h-9"
              />
            )}
          </span>
          <span className="text-[9px] font-extrabold tracking-wide text-primary sm:text-[11px]">
            مثراء AI
          </span>
        </button>
      </div>

      {open ? (
        <section className="glass-panel fixed bottom-44 start-4 z-50 flex h-[min(30rem,70vh)] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden">
          <header className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
            <Sparkles className="size-4 text-gold" />
            <h2 className="text-[13.5px] font-bold">مساعد مثراء الذكي</h2>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message, index) => (
              <p
                key={index}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-6",
                  message.role === "user"
                    ? "ms-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {message.content}
              </p>
            ))}
            {ask.isPending ? (
              <p className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[12.5px]">
                <Loader2 className="size-4 animate-spin text-primary" />
                يكتب…
              </p>
            ) : null}
            {messages.length === 1 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {starters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => send(item)}
                    className="rounded-full border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border px-3 py-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك…"
              className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-[12.5px] outline-none focus:border-primary/40"
            />
            <button
              type="submit"
              disabled={ask.isPending || !input.trim()}
              aria-label="إرسال"
              className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
