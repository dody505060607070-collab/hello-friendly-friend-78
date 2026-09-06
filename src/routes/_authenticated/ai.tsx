import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { askAdminAi } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "مساعد مثراء الذكي | مثراء العقارية" },
      {
        name: "description",
        content: "شات ذكي داخل لوحة التحكم: اسحب أي صف أو بيانات إليه ليحللها ويقترح الخطوة التالية.",
      },
      { property: "og:title", content: "مساعد مثراء الذكي | مثراء العقارية" },
      { property: "og:description", content: "مساعد ذكي يفهم صفحات لوحة التحكم ويحلل البيانات المسحوبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiPage,
});

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "لخّص لي حالة العقود القريبة من الانتهاء",
  "كيف أضيف عقارًا جديدًا ويظهر على الموقع؟",
  "اقترح خطة متابعة لطلبات توفير العقار",
  "ما الفرق بين مهام التصوير والمهام العادية؟",
];

function AiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = useMutation({
    mutationFn: async (text: string) => {
      const next: Message[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const res = await askAdminAi({
        data: {
          messages: next,
          ...(chips.length ? { context: chips.join("\n---\n") } : {}),
        },
      });
      return res.text;
    },
    onSuccess: (text) => setMessages((prev) => [...prev, { role: "assistant", content: text }]),
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الوصول للمساعد"),
  });

  const send = (text: string) => {
    const value = text.trim();
    if (!value || ask.isPending) return;
    setInput("");
    ask.mutate(value);
    textarea.current?.focus();
  };

  return (
    <>
      <PageHero
        title="مساعد مثراء الذكي"
        subtitle="اسحب أي صف من أي جدول في لوحة التحكم وأفلته هنا، ثم اسأل المساعد عنه."
        icon={Sparkles}
        stats={[
          { value: String(messages.filter((m) => m.role === "user").length), label: "سؤال" },
          { value: String(chips.length), label: "عنصر مرفق" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="surface-card flex h-[62vh] flex-col overflow-hidden">
          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center gap-3 text-center">
                <span className="grid size-14 place-items-center rounded-2xl border border-border bg-accent text-primary">
                  <Sparkles className="size-7" />
                </span>
                <p className="text-[14px] font-bold text-foreground">كيف أساعدك اليوم؟</p>
                <p className="max-w-md text-[12.5px] text-muted-foreground">
                  اسأل عن أي قسم في لوحة التحكم أو الموقع، أو اسحب صفًا من جدول العقارات أو العقود
                  أو المهام إلى صندوق «العناصر المرفقة» على اليسار.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {ask.isPending ? (
              <div className="flex justify-end">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  يفكّر…
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border px-4 py-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                placeholder="اكتب سؤالك… (Enter للإرسال)"
                className="min-h-[46px] flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary/40"
              />
              <button
                type="submit"
                disabled={ask.isPending || !input.trim()}
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                aria-label="إرسال"
              >
                <Send className="size-4" />
              </button>
            </div>
          </form>
        </section>

        <aside
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const text = e.dataTransfer.getData("text/plain").trim();
            if (!text) return;
            setChips((prev) => [...prev, text]);
            toast.success("تم إرفاق العنصر بالمحادثة");
          }}
          className={cn(
            "surface-card flex max-h-[62vh] flex-col overflow-hidden transition-colors",
            dragging && "border-primary/50 bg-accent/40",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">العناصر المرفقة</h2>
            {chips.length ? (
              <button
                type="button"
                onClick={() => setChips([])}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-destructive"
              >
                <Trash2 className="size-3.5" />
                مسح
              </button>
            ) : null}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {chips.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                اسحب أي صف من جداول العقارات، الطلبات، العقود، المهام أو التذكيرات وأفلته هنا.
              </p>
            ) : (
              chips.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px] text-foreground"
                >
                  <span className="line-clamp-3 flex-1">{c}</span>
                  <button
                    type="button"
                    onClick={() => setChips((prev) => prev.filter((_, x) => x !== i))}
                    aria-label="إزالة"
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
