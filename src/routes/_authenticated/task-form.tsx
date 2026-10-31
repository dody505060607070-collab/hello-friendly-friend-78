import { uploadMedia, mediaUrl } from "@/lib/media";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  CalendarClock,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
  Users,
  MapPin,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { priorityLabels, taskStatusLabels } from "@/lib/labels";
import { parseCoordsFromMapLink, resolveMapLink } from "@/lib/maps.functions";
import { finishTask, notifyTaskNow, sendMeetingReminderNow } from "@/lib/tasks.functions";
import { cn } from "@/lib/utils";

/** الوقت المتبقي حتى الرسالة القادمة بصيغة عربية مختصرة. */
function remainingLabel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "أقل من دقيقة";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)} يوم و${hours % 24} ساعة`;
  if (hours > 0) return `${hours} ساعة و${minutes} دقيقة`;
  return `${minutes} دقيقة`;
}

/** فترة تكرار رسالة المهمة حسب الأولوية. */
function intervalLabel(priority: string) {
  if (priority === "urgent") return "12 ساعة";
  if (priority === "high") return "24 ساعة";
  return "3 أيام";
}

export const Route = createFileRoute("/_authenticated/task-form")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "إضافة / تعديل مهمة | مثراء العقارية" },
      {
        name: "description",
        content: "نموذج كامل لإنشاء مهمة: النوع، التفاصيل، الأولوية، الموعد، الموظفون المكلّفون والمرفقات.",
      },
      { property: "og:title", content: "إضافة / تعديل مهمة | مثراء العقارية" },
      { property: "og:description", content: "تكليف الفريق بمهام عادية أو مهام تصوير ومتابعة تنفيذها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaskFormPage,
});

const emptyForm = {
  title: "",
  details: "",
  task_type: "normal",
  priority: "normal",
  status: "new",
  due_date: "",
  due_time: "",
  property_id: "",
  contact_id: "",
  location_text: "",
  location_lat: "",
  location_lng: "",
  meeting_enabled: false,
  meeting_place: "",
  meeting_notes: "",
  meeting_owner_name: "",
  meeting_owner_phone: "",
  meeting_visitor_name: "",
  meeting_visitor_phone: "",
  meeting_agent_name: "",
  meeting_agent_phone: "",
  meeting_interval_hours: "auto",
};

type FormState = typeof emptyForm;

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof ClipboardList;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-accent/40 px-5 py-3.5">
        <div className="grid size-9 place-items-center rounded-lg border border-border bg-card text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
          <p className="text-[12px] text-muted-foreground">{subtitle}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TaskFormPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mapLink, setMapLink] = useState("");
  const [resolvingMap, setResolvingMap] = useState(false);
  const [sendingMeeting, setSendingMeeting] = useState(false);
  const sendMeetingNow = async () => {
    if (!id) return;
    setSendingMeeting(true);
    try {
      const r = await sendMeetingReminderNow({ data: { taskId: id } });
      if (r.sent) toast.success(`تم إرسال التذكير لـ ${r.sent} شخص`);
      if (r.failed) toast.error(`تعذّر الإرسال لـ ${r.failed} — تأكد من ربط واتساب`);
      if (!r.sent && !r.failed) toast.error("احفظ المهمة أولًا مع تفعيل الموعد وإضافة الأرقام");
    } catch {
      toast.error("تعذّر إرسال التذكير");
    } finally {
      setSendingMeeting(false);
    }
  };

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  /** يقرأ الإحداثيات من رابط خرائط Google (بما فيها الروابط المختصرة). */
  const applyMapLink = async (raw: string) => {
    const value = raw.trim();
    setMapLink(value);
    if (!value) return;
    const direct = parseCoordsFromMapLink(value);
    if (direct) {
      set({ location_lat: direct.lat, location_lng: direct.lng });
      toast.success("تم تحديد الموقع من الرابط");
      return;
    }
    setResolvingMap(true);
    try {
      const coords = await resolveMapLink({ data: { url: value } });
      if (coords) {
        set({ location_lat: coords.lat, location_lng: coords.lng });
        toast.success("تم تحديد الموقع من الرابط");
      } else {
        toast.error("تعذّر قراءة الموقع من هذا الرابط — أدخل الإحداثيات يدويًا");
      }
    } catch {
      toast.error("تعذّر قراءة الموقع من هذا الرابط");
    } finally {
      setResolvingMap(false);
    }
  };

  const task = useQuery({
    queryKey: ["task", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const taskAssignees = useQuery({
    queryKey: ["task-assignees", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_assignees")
        .select("id, user_id")
        .eq("task_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attachments = useQuery({
    queryKey: ["task-attachments", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("id, file_path, file_name, kind")
        .eq("task_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const employees = useQuery({
    queryKey: ["profiles", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });


  const contacts = useQuery({
    queryKey: ["contacts", "select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .order("full_name")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const row = task.data;
    if (!row) return;
    setForm({
      title: row.title ?? "",
      details: row.details ?? "",
      task_type: row.task_type ?? "normal",
      priority: row.priority ?? "normal",
      status: row.status ?? "new",
      due_date: row.due_date ?? "",
      due_time: row.due_time ?? "",
      property_id: row.property_id ?? "",
      contact_id: row.contact_id ?? "",
      location_text: (row as Record<string, unknown>)["location_text"]?.toString() ?? "",
      location_lat: (row as Record<string, unknown>)["location_lat"]?.toString() ?? "",
      location_lng: (row as Record<string, unknown>)["location_lng"]?.toString() ?? "",
      meeting_enabled: row.meeting_enabled ?? false,
      meeting_place: row.meeting_place ?? "",
      meeting_notes: row.meeting_notes ?? "",
      meeting_owner_name: row.meeting_owner_name ?? "",
      meeting_owner_phone: row.meeting_owner_phone ?? "",
      meeting_visitor_name: row.meeting_visitor_name ?? "",
      meeting_visitor_phone: row.meeting_visitor_phone ?? "",
      meeting_agent_name: row.meeting_agent_name ?? "",
      meeting_agent_phone: row.meeting_agent_phone ?? "",
      meeting_interval_hours: String(row.meeting_interval_hours ?? 12),
    });
    const lat = (row as Record<string, unknown>)["location_lat"];
    const lng = (row as Record<string, unknown>)["location_lng"];
    if (lat && lng) setMapLink(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  }, [task.data]);

  useEffect(() => {
    if (taskAssignees.data) setAssignees(taskAssignees.data.map((a) => a.user_id));
  }, [taskAssignees.data]);

  const persistTask = async () => {
      if (!form.title.trim()) throw new Error("عنوان المهمة مطلوب");
      const payload = {
        title: form.title.trim(),
        details: form.details.trim() || null,
        task_type: form.task_type,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        property_id: form.property_id || null,
        contact_id: form.contact_id || null,
        location_text: form.location_text.trim() || null,
        location_lat: form.location_lat ? Number(form.location_lat) : null,
        location_lng: form.location_lng ? Number(form.location_lng) : null,
        meeting_enabled: form.meeting_enabled,
        meeting_place: form.meeting_place.trim() || null,
        meeting_notes: form.meeting_notes.trim() || null,
        meeting_owner_name: form.meeting_owner_name.trim() || null,
        meeting_owner_phone: form.meeting_owner_phone.trim() || null,
        meeting_visitor_name: form.meeting_visitor_name.trim() || null,
        meeting_visitor_phone: form.meeting_visitor_phone.trim() || null,
        meeting_agent_name: form.meeting_agent_name.trim() || null,
        meeting_agent_phone: form.meeting_agent_phone.trim() || null,
        meeting_interval_hours:
          form.meeting_interval_hours === "auto"
            ? form.priority === "urgent" ? 12 : form.priority === "high" ? 24 : 72
            : Number(form.meeting_interval_hours),
      };
      if (form.meeting_enabled && !form.meeting_owner_phone.trim() && !form.meeting_visitor_phone.trim() && !form.meeting_agent_phone.trim())
        throw new Error("أدخل رقم جوال واحد على الأقل لموعد المعاينة");
      let taskId = id;
      if (taskId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
        if (error) throw error;
        taskId = data.id as string;
      }
      const current = (taskAssignees.data ?? []).map((a) => a.user_id);
      const toAdd = assignees.filter((u) => !current.includes(u));
      const toRemove = current.filter((u) => !assignees.includes(u));
      if (toAdd.length) {
        const { error } = await supabase
          .from("task_assignees")
          .insert(toAdd.map((user_id) => ({ task_id: taskId, user_id })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from("task_assignees")
          .delete()
          .eq("task_id", taskId)
          .in("user_id", toRemove);
        if (error) throw error;
      }
      return { taskId: taskId as string, added: toAdd };
  };

  const save = useMutation({
    mutationFn: persistTask,
    onSuccess: async ({ taskId: newId, added }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["task-assignees", newId] });
      toast.success(id ? "تم تحديث المهمة" : "تم إنشاء المهمة وتكليف الفريق");
      if (added.length && newId) {
        try {
          const result = await notifyTaskNow({
            data: { taskId: newId, userIds: added, schedule: true },
          });
          if (result.sent > 0) toast.success(`تم إرسال المهمة على واتساب لـ ${result.sent} موظف`);
          if (result.failed > 0) toast.error(`تعذّر إرسال واتساب لـ ${result.failed} موظف`);
          queryClient.invalidateQueries({ queryKey: ["task-reminder-state", newId] });
        } catch {
          toast.error("تعذّر إرسال المهمة على واتساب");
        }
      }
      if (!id && newId) navigate({ to: "/task-form", search: { id: newId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const reminderState = useQuery({
    queryKey: ["task-reminder-state", id],
    enabled: Boolean(id),
    refetchInterval: 180_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_reminder_state")
        .select("id, user_id, next_send_at, sent_count")
        .eq("task_id", id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nextSend = (reminderState.data ?? [])
    .map((r) => r.next_send_at)
    .filter(Boolean)
    .sort()[0] as string | undefined;

  const sendTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("احفظ المهمة أولًا قبل إرسالها");
      if (!assignees.length) throw new Error("اختر موظفًا واحدًا على الأقل");
      return notifyTaskNow({ data: { taskId: id, userIds: assignees, schedule: true } });
    },
    onSuccess: (result) => {
      if (result.sent > 0) toast.success(`تم إرسال المهمة على واتساب لـ ${result.sent} موظف`);
      if (result.failed > 0) toast.error(`تعذّر إرسال واتساب لـ ${result.failed} موظف`);
      if (result.skipped > 0) toast.warning(`${result.skipped} موظف بدون رقم واتساب مفعّل`);
      queryClient.invalidateQueries({ queryKey: ["task-reminder-state", id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر إرسال المهمة"),
  });

  const completeTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("احفظ المهمة أولًا");
      return finishTask({ data: { taskId: id } });
    },
    onSuccess: () => {
      toast.success("تم إنهاء المهمة وإيقاف رسائل واتساب المتكررة");
      setForm((f) => ({ ...f, status: "done" }));
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["task-reminder-state", id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر إنهاء المهمة"),
  });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      // المرفقات متاحة فورًا: لو المهمة جديدة تُحفظ تلقائيًا قبل الرفع.
      let taskId = id;
      if (!taskId) {
        const saved = await persistTask();
        taskId = saved.taskId;
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        navigate({ to: "/task-form", search: { id: taskId } });
      }
      for (const file of Array.from(files)) {
        const path = `tasks/${taskId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        await uploadMedia("internal-files", path, file);
        const { error } = await supabase.from("task_attachments").insert({
          task_id: taskId,
          file_path: path,
          file_name: file.name,
          kind: "reference",
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("تم إرفاق الملفات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الإرفاق");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("task_attachments").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", id] });
      toast.success("تم حذف المرفق");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("internal-files")
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast.error("تعذّر فتح الملف");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <>
      <PageHero
        title={id ? "تعديل مهمة" : "إضافة مهمة جديدة"}
        subtitle="حدّد نوع المهمة والموظفين المكلّفين والموعد، وأرفق الصور المرجعية عند الحاجة."
        icon={form.task_type === "photo" ? Camera : ClipboardList}
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          to="/tasks"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-muted"
        >
          <ArrowRight className="size-4" />
          رجوع لقائمة المهام
        </Link>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {id ? "حفظ التعديلات" : "حفظ المهمة"}
        </button>
      </div>

      <SectionCard
        title="نوع المهمة"
        subtitle="المهمة العادية للأعمال الإدارية، ومهمة التصوير لتغطية عقار بالصور والفيديو."
        icon={ClipboardList}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: "normal", label: "مهمة عادية", hint: "متابعة، اتصال، زيارة، تجهيز مستندات", icon: ClipboardList },
            { key: "photo", label: "مهمة تصوير", hint: "تصوير عقار ورفع الصور والفيديو", icon: Camera },
          ].map((item) => {
            const Icon = item.icon;
            const active = form.task_type === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => set({ task_type: item.key })}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-start transition-colors",
                  active ? "border-primary bg-accent/50" : "border-border hover:bg-muted",
                )}
              >
                <Icon className="mt-0.5 size-5 text-primary" />
                <span>
                  <span className="block text-[13.5px] font-bold">{item.label}</span>
                  <span className="block text-[12px] text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="بيانات المهمة"
        subtitle="العنوان والتفاصيل والأولوية والحالة والموعد."
        icon={Check}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان المهمة" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="مثال: تصوير شقة حي الرحاب"
            />
          </Field>
          <Field label="تفاصيل المهمة" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.details}
              onChange={(e) => set({ details: e.target.value })}
              placeholder="اكتب الخطوات المطلوبة بالتفصيل"
            />
          </Field>
          <Field label="الأولوية">
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => set({ priority: e.target.value })}
            >
              {Object.entries(priorityLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الحالة">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              {Object.entries(taskStatusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="تاريخ التسليم">
            <input
              type="date"
              className={inputClass}
              dir="ltr"
              value={form.due_date}
              onChange={(e) => set({ due_date: e.target.value })}
            />
          </Field>
          <Field label="وقت التسليم">
            <input
              type="time"
              className={inputClass}
              dir="ltr"
              value={form.due_time}
              onChange={(e) => set({ due_time: e.target.value })}
            />
          </Field>
          <Field label="العميل المرتبط (اختياري)">
            <select
              className={inputClass}
              value={form.contact_id}
              onChange={(e) => set({ contact_id: e.target.value })}
            >
              <option value="">— بدون —</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="موقع المهمة"
        subtitle="الصق رابط خرائط Google أو أدخل الإحداثيات — يصل الرابط مع رسالة واتساب للموظف."
        icon={MapPin}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="رابط خرائط Google (الصق الرابط هنا)" className="sm:col-span-3">
            <div className="flex gap-2">
              <input
                className={inputClass}
                dir="ltr"
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text) applyMapLink(text);
                }}
                placeholder="https://maps.app.goo.gl/..."
              />
              <button
                type="button"
                onClick={() => applyMapLink(mapLink)}
                disabled={resolvingMap || !mapLink.trim()}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-primary disabled:opacity-60"
              >
                {resolvingMap ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                تحديد الموقع
              </button>
            </div>
          </Field>
          <Field label="وصف الموقع" className="sm:col-span-3">
            <input
              className={inputClass}
              value={form.location_text}
              onChange={(e) => set({ location_text: e.target.value })}
              placeholder="مثال: حي الملقا - شارع أنس بن مالك"
            />
          </Field>
          <Field label="خط العرض (Lat)">
            <input
              className={inputClass}
              dir="ltr"
              value={form.location_lat}
              onChange={(e) => set({ location_lat: e.target.value })}
              placeholder="24.7136"
            />
          </Field>
          <Field label="خط الطول (Lng)">
            <input
              className={inputClass}
              dir="ltr"
              value={form.location_lng}
              onChange={(e) => set({ location_lng: e.target.value })}
              placeholder="46.6753"
            />
          </Field>
          <Field label="اتجاهات">
            {form.location_lat && form.location_lng ? (
              <a
                className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold text-primary"
                href={`https://www.google.com/maps/dir/?api=1&destination=${form.location_lat},${form.location_lng}`}
                target="_blank"
                rel="noreferrer"
              >
                فتح في خرائط Google
              </a>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">أدخل الإحداثيات لعرض الخريطة.</p>
            )}
          </Field>
        </div>
        {form.location_lat && form.location_lng ? (
          <iframe
            title="خريطة موقع المهمة"
            className="mt-4 h-56 w-full rounded-xl border border-border"
            loading="lazy"
            src={`https://www.google.com/maps?q=${form.location_lat},${form.location_lng}&z=15&output=embed`}
          />
        ) : null}
      </SectionCard>

      <SectionCard
        title="موعد معاينة / اجتماع"
        subtitle="موعد بين المالك والزائر والوسيط — كل واحد تصله رسالة تذكير خاصة به على واتساب."
        icon={CalendarClock}
      >
        <label className="mb-4 flex items-center gap-2 text-[13.5px] font-semibold">
          <input
            type="checkbox"
            checked={form.meeting_enabled}
            onChange={(e) => set({ meeting_enabled: e.target.checked })}
          />
          هذه المهمة موعد معاينة وأريد إرسال تذكيرات
        </label>
        {form.meeting_enabled ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <p className="sm:col-span-3 rounded-lg border border-border bg-accent/40 px-3 py-2 text-[12.5px] text-muted-foreground">
              تاريخ ووقت الموعد = تاريخ ووقت المهمة أعلاه. تتوقف التذكيرات تلقائيًا بعد الموعد أو عند إنهاء المهمة.
            </p>
            <Field label="مكان الموعد" className="sm:col-span-3">
              <input className={inputClass} value={form.meeting_place} onChange={(e) => set({ meeting_place: e.target.value })} placeholder="مثال: عمارة الملقا - شقة 4، أو رابط خرائط Google" />
            </Field>
            <Field label="ملاحظات الموعد (تظهر في الرسالة)" className="sm:col-span-3">
              <textarea className={textareaClass} value={form.meeting_notes} onChange={(e) => set({ meeting_notes: e.target.value })} placeholder="مثال: إحضار الهوية، الموقف أمام البوابة الشمالية" />
            </Field>
            <Field label="اسم المالك">
              <input className={inputClass} value={form.meeting_owner_name} onChange={(e) => set({ meeting_owner_name: e.target.value })} />
            </Field>
            <Field label="اسم الزائر (المعاين)">
              <input className={inputClass} value={form.meeting_visitor_name} onChange={(e) => set({ meeting_visitor_name: e.target.value })} />
            </Field>
            <Field label="اسم الوسيط / الموظف">
              <input className={inputClass} value={form.meeting_agent_name} onChange={(e) => set({ meeting_agent_name: e.target.value })} />
            </Field>
            <Field label="جوال المالك">
              <input className={inputClass} dir="ltr" value={form.meeting_owner_phone} onChange={(e) => set({ meeting_owner_phone: e.target.value })} placeholder="05xxxxxxxx" />
            </Field>
            <Field label="جوال الزائر">
              <input className={inputClass} dir="ltr" value={form.meeting_visitor_phone} onChange={(e) => set({ meeting_visitor_phone: e.target.value })} placeholder="05xxxxxxxx" />
            </Field>
            <Field label="جوال الوسيط">
              <input className={inputClass} dir="ltr" value={form.meeting_agent_phone} onChange={(e) => set({ meeting_agent_phone: e.target.value })} placeholder="05xxxxxxxx" />
            </Field>
            <Field label="تكرار الرسالة" className="sm:col-span-3">
              <select className={inputClass} value={form.meeting_interval_hours} onChange={(e) => set({ meeting_interval_hours: e.target.value })}>
                <option value="auto">تلقائي حسب الأولوية ({intervalLabel(form.priority)})</option>
                <option value="6">كل 6 ساعات</option>
                <option value="12">كل 12 ساعة</option>
                <option value="24">كل 24 ساعة</option>
                <option value="48">كل يومين</option>
                <option value="72">كل 3 أيام</option>
              </select>
            </Field>
            {id ? (
              <div className="sm:col-span-3">
                <button
                  type="button"
                  disabled={sendingMeeting}
                  onClick={sendMeetingNow}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {sendingMeeting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  إرسال التذكير الآن للثلاثة
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </SectionCard>


      <SectionCard
        title="الموظفون المكلّفون"
        subtitle="اختيار الموظف يحفظ التكليف فقط؛ لن تُرسل أي رسالة إلا عند الضغط على زر واتساب."
        icon={Users}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(employees.data ?? []).map((emp) => {
            const active = assignees.includes(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() =>
                  setAssignees((prev) =>
                    prev.includes(emp.id) ? prev.filter((x) => x !== emp.id) : [...prev, emp.id],
                  )
                }
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-start text-[13px] transition-colors",
                  active ? "border-primary bg-accent/50 font-bold" : "border-border hover:bg-muted",
                )}
              >
                <span>
                  {emp.full_name || "بدون اسم"}
                  {emp.job_title ? (
                    <span className="block text-[11.5px] font-normal text-muted-foreground">
                      {emp.job_title}
                    </span>
                  ) : null}
                </span>
                {active ? <Check className="size-4 text-primary" /> : null}
              </button>
            );
          })}
          {!employees.data?.length ? (
            <p className="text-[12.5px] text-muted-foreground">لا يوجد موظفون نشطون بعد.</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="صور ومرفقات المهمة"
        subtitle="أضف الصور مباشرة — تُحفظ المهمة تلقائيًا، وتُرسل الصور مع رسالة واتساب للموظف."
        icon={Paperclip}
      >
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center hover:bg-muted">
                {uploading ? (
                  <Loader2 className="size-6 animate-spin text-primary" />
                ) : (
                  <UploadCloud className="size-6 text-muted-foreground" />
                )}
                <span className="text-[13px] text-muted-foreground">اختر صورًا أو ملفات من الجهاز</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => upload(e.target.files)}
                />
              </label>
              <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center hover:bg-muted">
                <Camera className="size-6 text-muted-foreground" />
                <span className="text-[13px] text-muted-foreground">التقاط صورة بالكاميرا</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => upload(e.target.files)}
                />
              </label>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {(attachments.data ?? []).map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => openAttachment(file.file_path)}
                    className="truncate text-[12.5px] font-semibold text-primary"
                  >
                    {file.file_name || file.file_path}
                  </button>
                  <button
                    type="button"
                    aria-label="حذف المرفق"
                    onClick={() => removeAttachment.mutate(file.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
              {!attachments.data?.length ? (
                <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  لا توجد مرفقات
                </li>
              ) : null}
            </ul>
        </div>
      </SectionCard>

      {id && nextSend ? (
        <p className="mx-auto w-fit rounded-lg bg-secondary/70 px-4 py-2 text-center text-[12.5px] text-muted-foreground">
          {`رسالة التذكير القادمة على واتساب بعد ${remainingLabel(nextSend)} (${new Date(nextSend).toLocaleString("ar-SA")}) — التكرار كل ${intervalLabel(form.priority)} حتى إنهاء المهمة`}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3 pb-4">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[13.5px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {id ? "حفظ التعديلات" : "حفظ المهمة"}
        </button>
        {id ? (
          <button
            type="button"
            onClick={() => sendTask.mutate()}
            disabled={sendTask.isPending || assignees.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-[13.5px] font-bold text-primary disabled:opacity-60"
          >
            {sendTask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            إرسال المهمة على واتساب
          </button>
        ) : null}
        {id ? (
          <button
            type="button"
            onClick={() => completeTask.mutate()}
            disabled={completeTask.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-[13.5px] font-bold text-success disabled:opacity-60"
          >
            {completeTask.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            المهمة خلصت
          </button>
        ) : null}
        <Link
          to="/tasks"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-[13.5px] font-semibold"
        >
          <ArrowRight className="size-4" />
          رجوع
        </Link>
      </div>
    </>
  );
}
