import { useMutation } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import logoAsset from "@/assets/mithra-logo-transparent.png.asset.json";
import { askAdminAi } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message as AiMessage, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

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
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(
    null,
  );

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
    <div
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      className="fixed bottom-6 end-5 z-50"
    >
      {/* الزر العائم: مجرّد المرور عليه أثناء السحب يفتح المساعد */}
      <button
        type="button"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
          setPos({ x: d.ox + dx, y: d.oy + dy });
        }}
        onPointerUp={() => {
          const moved = drag.current?.moved;
          drag.current = null;
          if (!moved) setOpen((v) => !v);
        }}
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
        title="اسحب لتحريك المساعد • اضغط للفتح"
        className={cn(
          "grid h-16 w-24 touch-none select-none place-items-center transition-transform hover:scale-105 md:h-20 md:w-28",
          dropping && "scale-110",
        )}
      >
        <img src={logoAsset.url} alt="مثراء العقارية" className="size-full object-contain drop-shadow-lg" draggable={false} />
      </button>

      {open ? (
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            receive(e.dataTransfer.getData("text/plain"));
          }}
          className="absolute bottom-16 end-0 flex h-[30rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float"
        >
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <h2 className="flex items-center gap-2 text-[13.5px] font-bold">
              <img src={logoAsset.url} alt="" className="size-7 rounded-full object-cover" />
              مساعد مثراء العقارية
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

          <Conversation className="min-h-0">
            <ConversationContent className="gap-3 px-3 py-3">
              {messages.map((message, index) => (
                <AiMessage key={index} from={message.role}>
                  <MessageContent className={message.role === "user" ? "bg-primary text-primary-foreground" : undefined}>
                    <MessageResponse>{message.content}</MessageResponse>
                  </MessageContent>
                </AiMessage>
              ))}
              {ask.isPending ? <Shimmer className="text-[12.5px]">جاري التحليل…</Shimmer> : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-border p-3">
            <PromptInput onSubmit={({ text }) => send(text)}>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={items.length ? "اسأل عن البيانات المسحوبة…" : "اكتب سؤالك…"}
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={ask.isPending ? "submitted" : "ready"} disabled={!input.trim()} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>
      ) : null}
    </div>
  );
}
