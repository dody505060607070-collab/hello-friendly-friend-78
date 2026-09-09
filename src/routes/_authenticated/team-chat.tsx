import { uploadMedia, mediaUrl } from "@/lib/media";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessagesSquare, Paperclip, Pencil, Pin, Reply, Search, Send, Smile, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DirectChats } from "@/components/chat/DirectChats";
import { PageHero } from "@/components/kit/PageHero";
import { PrimaryButton, inputClass } from "@/components/kit/Modal";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { sendPushToUsers } from "@/lib/push.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team-chat")({
  head: () => ({
    meta: [
      { title: "شات الموظفين | مثراء العقارية" },
      { name: "description", content: "محادثة جماعية داخلية لجميع موظفي الشركة." },
      { property: "og:title", content: "شات الموظفين | مثراء العقارية" },
      { property: "og:description", content: "محادثة جماعية داخلية لجميع موظفي الشركة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamChatPage,
});

type Msg = {
  id: string;
  sender_id: string;
  body: string | null;
  reply_to: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  edited_at: string | null;
  is_pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  sender: { full_name: string; job_title: string | null; avatar_url: string | null } | null;
};

const EMOJIS = ["👍", "🙏", "🔥", "✅", "❤️", "😀", "😅", "🎉", "📌", "📞", "🏠", "💰", "⏰", "📄"];

function TeamChatPage() {
  const qc = useQueryClient();
  const { userId, isSuperAdmin } = useCurrentUser();
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["group-messages"],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_messages")
        .select("id, sender_id, body, reply_to, is_pinned, deleted_at, created_at, attachment_path, attachment_name, edited_at, sender:sender_id(full_name, job_title, avatar_url)")
        .order("created_at")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Msg[];
    },
  });

  const staff = useQuery({
    queryKey: ["profiles", "team-chat"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title, avatar_url")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // بث لحظي لرسائل المجموعة
  useEffect(() => {
    const channel = supabase
      .channel("group-messages-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["group-messages"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const all = messages.data ?? [];
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  const pinned = all.filter((m) => m.is_pinned && !m.deleted_at);
  const rows = useMemo(() => {
    const q = search.trim();
    return q ? all.filter((m) => (m.body ?? "").includes(q)) : all;
  }, [all, search]);

  useEffect(() => {
    if (!search) bottom.current?.scrollIntoView({ block: "end" });
  }, [all.length, search]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) return;
      if (editing) {
        const { error } = await supabase
          .from("group_messages")
          .update({ body: text, edited_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("group_messages").insert({
        sender_id: userId!,
        body: text,
        reply_to: replyTo?.id ?? null,
      });
      if (error) throw error;
      const mentions = text.match(/@([\p{L}\d_]+)/gu) ?? [];
      const { data: staff } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true);
      if (mentions.length) {
        const targets = (staff ?? []).filter(
          (s) => s.id !== userId && mentions.some((m) => s.full_name.includes(m.slice(1))),
        );
        if (targets.length) {
          await supabase.from("notifications").insert(
            targets.map((t) => ({
              user_id: t.id,
              title: "تمت الإشارة إليك في شات الموظفين",
              body: text.slice(0, 100),
              link: "/team-chat",
            })),
          );
        }
      }
      const others = (staff ?? []).map((s) => s.id).filter((id) => id !== userId);
      if (others.length) {
        void sendPushToUsers({
          data: {
            userIds: others,
            title: "رسالة جديدة في شات الموظفين",
            body: text.slice(0, 120),
            url: "/team-chat",
            tag: "mithra-team-chat",
          },
        }).catch(() => undefined);
      }
    },
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["group-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: { is_pinned?: boolean; deleted_at?: string | null } }) => {
      const { error } = await supabase.from("group_messages").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group-messages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `team-chat/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      await uploadMedia("internal-files", path, file);
      const { error } = await supabase.from("group_messages").insert({
        sender_id: userId!,
        body: body.trim() || null,
        attachment_path: path,
        attachment_name: file.name,
        reply_to: replyTo?.id ?? null,
      });
      if (error) throw error;
      setBody("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["group-messages"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openAttachment = async (path: string) => {
    try {
      window.open(await mediaUrl("internal-files", path), "_blank", "noopener");
    } catch {
      toast.error("تعذّر فتح المرفق");
    }
  };

  return (
    <>
      <PageHero
        title="شات الموظفين"
        subtitle="محادثة جماعية داخلية لكل الموظفين — غير متاحة للعملاء."
        icon={MessagesSquare}
        stats={[{ value: String(all.length), label: "رسالة" }]}
      />

      <div className="surface-card overflow-hidden">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-accent/40 px-4 py-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={inputClass}
              placeholder="بحث داخل المحادثة…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="shrink-0 text-[12px] text-muted-foreground">{pinned.length} مثبتة</span>
        </header>

        <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
          <Users className="size-4 shrink-0 text-primary" />
          {(staff.data ?? []).map((p) => (
            <span
              key={p.id}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted/50 px-2 py-1 text-[11.5px] text-muted-foreground"
              title={p.job_title ?? ""}
            >
              <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {p.full_name.slice(0, 1)}
              </span>
              {p.full_name}
            </span>
          ))}
        </div>

        {pinned.length ? (
          <div className="border-b border-border bg-warning/10 px-4 py-2 text-[12.5px]">
            {pinned.map((p) => (
              <p key={p.id} className="truncate">
                <Pin className="ms-1 inline size-3" /> {p.sender?.full_name}: {p.body}
              </p>
            ))}
          </div>
        ) : null}

        <div className="space-y-3 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
          {rows.map((m) => {
            const mine = m.sender_id === userId;
            const parent = m.reply_to ? byId.get(m.reply_to) : null;
            return (
              <div key={m.id} className={cn("flex gap-2", mine ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px]",
                    mine ? "bg-primary text-primary-foreground" : "bg-accent text-foreground",
                  )}
                >
                  <p className="mb-1 text-[11px] opacity-75">
                    {m.sender?.full_name ?? "—"}
                    {m.sender?.job_title ? ` • ${m.sender.job_title}` : ""}
                  </p>
                  {parent ? (
                    <p className="mb-1 rounded-lg bg-background/25 px-2 py-1 text-[11.5px] opacity-80">
                      ردًا على {parent.sender?.full_name}: {(parent.body ?? "").slice(0, 60)}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{m.deleted_at ? "تم حذف الرسالة" : m.body}</p>
                  {!m.deleted_at && m.attachment_path ? (
                    <button
                      type="button"
                      onClick={() => openAttachment(m.attachment_path!)}
                      className="mt-1 flex items-center gap-1.5 rounded-lg bg-background/25 px-2 py-1 text-[12px] underline"
                    >
                      <Paperclip className="size-3.5" />
                      {m.attachment_name ?? "مرفق"}
                    </button>
                  ) : null}
                  {m.edited_at ? <span className="text-[10.5px] opacity-70">(معدّلة)</span> : null}
                  <div className="mt-1 flex items-center gap-2 text-[10.5px] opacity-70">
                    <span>{new Date(m.created_at).toLocaleString("ar-SA")}</span>
                    {!m.deleted_at ? (
                      <>
                        <button type="button" onClick={() => setReplyTo(m)} title="رد">
                          <Reply className="size-3.5" />
                        </button>
                        {isSuperAdmin ? (
                          <button
                            type="button"
                            title="تثبيت"
                            onClick={() => patch.mutate({ id: m.id, values: { is_pinned: !m.is_pinned } })}
                          >
                            <Pin className="size-3.5" />
                          </button>
                        ) : null}
                        {mine ? (
                          <button
                            type="button"
                            title="تعديل"
                            onClick={() => {
                              setEditing(m);
                              setBody(m.body ?? "");
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                        {mine || isSuperAdmin ? (
                          <button
                            type="button"
                            title="حذف"
                            onClick={() =>
                              patch.mutate({ id: m.id, values: { deleted_at: new Date().toISOString() } })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <footer className="space-y-2 border-t border-border p-3">
          {replyTo ? (
            <p className="flex items-center justify-between rounded-lg bg-accent px-3 py-1.5 text-[12px]">
              <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground">
                إلغاء
              </button>
              <span>رد على {replyTo.sender?.full_name}</span>
            </p>
          ) : null}
          {editing ? (
            <p className="flex items-center justify-between rounded-lg bg-warning/15 px-3 py-1.5 text-[12px]">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setBody("");
                }}
                className="text-muted-foreground"
              >
                إلغاء
              </button>
              <span>تعديل رسالتك</span>
            </p>
          ) : null}
          {emojiOpen ? (
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-2 text-lg">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setBody((b) => b + e)}>
                  {e}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void sendFile(f);
              }}
            />
            <button
              type="button"
              title="إرفاق ملف"
              onClick={() => fileRef.current?.click()}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            </button>
            <button
              type="button"
              title="رموز"
              onClick={() => setEmojiOpen((v) => !v)}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            >
              <Smile className="size-4" />
            </button>
            <input
              className={inputClass}
              placeholder="اكتب رسالة… استخدم @اسم الموظف للإشارة"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send.mutate();
                }
              }}
            />
            <PrimaryButton onClick={() => send.mutate()} disabled={send.isPending}>
              <Send className="size-4" />
            </PrimaryButton>
          </div>
        </footer>
      </div>
    </>
  );
}
