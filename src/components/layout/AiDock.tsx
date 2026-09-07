import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { askAdminAi } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const WELCOME: Message = {
  role: "assistant",
  content:
    "اسحب أي صف من أي جدول (عقار، مالك، عقد، مهمة، فاتورة…) وأفلته هنا، ثم اسألني عنه بحرية.",
};

export function AiDock() {
  const [open, setOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, items, open]);

  // فتح المساعد تلقائيًا بمجرد بدء السحب داخل اللوحة
  useEffect(() => {
    const onDragStart = () => setDropping(true);
    const onDragEnd = () => setDropping(false);
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, []);

  const ask = useMutation({
    mutationFn: async (text: string) => {
      const next: Message[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const res = await askAdminAi({
        data: {
          messages: next.filter((m) => m !== WELCOME),
          context: items.join("\n\n"),
        },
      });
      return res.text;
    },
    onSuccess: (text) => setMessages((prev) => [...prev, { role: "assistant", content: text }]),
    onError: (err) =>
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error ? `تعذّر الوصول للمساعد: ${err.message}` : "تعذّر الوصول للمساعد.",
        },
      ]),
  });

  const send = (text: string) => {
    const value = text.trim();
    if (!value || ask.isPending) return;
    setInput("");
    ask.mutate(value);
  };

  const receive = (data: string) => {
    const value = data.trim();
    if (!value) return;
    setItems((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setOpen(true);
  };

  return (
    <>
      {/* الزر العائم: مجرّد المرور عليه أثناء السحب يفتح المساعد */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onDragEnter={() => setOpen(true)}
        onDragOver={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          receive(e.dataTransfer.getData("text/plain"));
        }}
        aria-label="المساعد الذكي"
        className={cn(
          "fixed bottom-6 end-5 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-[13px] font-bold text-primary-foreground shadow-float transition-transform hover:scale-105",
          dropping && "scale-110 ring-4 ring-primary/25",
        )}
      >
        {open ? <X className="size-5" /> : <Bot className="size-5" />}
        <span className="hidden sm:inline">المساعد الذكي</span>
      </button>

      {open ? (
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            receive(e.dataTransfer.getData("text/plain"));
          }}
          className="fixed bottom-24 end-4 z-50 flex h-[30rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float"
        >
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <h2 className="flex items-center gap-2 text-[13.5px] font-bold">
              <Bot className="size-4" />
              مساعد مثراء
            </h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </header>

          {items.length ? (
            <div className="flex flex-wrap gap-1.5 border-b border-border bg-muted/50 px-3 py-2">
              {items.map((item, i) => (
                <span
                  key={i}
                  title={item}
                  className="inline-flex max-w-[13rem] items-center gap-1 rounded-full bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  <span className="truncate">{item}</span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, x) => x !== i))}
                    aria-label="إزالة"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setItems([])}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-destructive"
              >
                <Trash2 className="size-3" />
                تفريغ
              </button>
            </div>
          ) : null}

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message, index) => (
              <p
                key={index}
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-6",
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
                يحلّل…
              </p>
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
              placeholder={items.length ? "اسأل عن البيانات المسحوبة…" : "اكتب سؤالك…"}
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
