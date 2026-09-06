import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="المساعد الذكي"
        className="fixed bottom-5 start-5 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-[13px] font-bold text-primary-foreground shadow-float transition-transform hover:scale-105"
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5 text-gold" />}
        <span className="hidden sm:inline">المساعد الذكي</span>
      </button>

      {open ? (
        <section className="fixed bottom-20 start-4 z-50 flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float">
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
