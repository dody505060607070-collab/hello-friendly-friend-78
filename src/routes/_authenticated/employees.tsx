import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { deleteStaffAccount, setStaffActive, setSuperAdmin } from "@/lib/staff.functions";

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  job_title: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون | مثراء العقارية" },
      { name: "description", content: "حسابات فريق العمل وحالتها وصلاحياتها في النظام." },
      { property: "og:title", content: "الموظفون | مثراء العقارية" },
      { property: "og:description", content: "حسابات فريق العمل وحالتها وصلاحياتها في النظام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const queryClient = useQueryClient();

  const admins = useQuery({
    queryKey: ["super-admins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      if (error) throw error;
      return (data ?? []).map((r) => r.user_id as string);
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    queryClient.invalidateQueries({ queryKey: ["super-admins"] });
  };

  const toggleAdmin = useMutation({
    mutationFn: (input: { userId: string; enabled: boolean }) => setSuperAdmin({ data: input }),
    onSuccess: (res) => {
      refresh();
      toast.success(res.isSuperAdmin ? "تم منح صلاحية المدير العام" : "تم سحب صلاحية المدير العام");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التعديل"),
  });

  const toggleActive = useMutation({
    mutationFn: (input: { userId: string; isActive: boolean }) => setStaffActive({ data: input }),
    onSuccess: () => {
      refresh();
      toast.success("تم تحديث حالة الحساب");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التعديل"),
  });

  const removeAccount = useMutation({
    mutationFn: (userId: string) => deleteStaffAccount({ data: { userId } }),
    onSuccess: () => {
      refresh();
      toast.success("تم حذف الحساب نهائيًا");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const list = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, whatsapp, job_title, hire_date, is_active, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = list.data ?? [];

  return (
    <>
      <PageHero
        title="الموظفون"
        subtitle="حسابات الفريق وبيانات الدخول والصلاحيات وملاحظات الإدارة."
        icon={UserCog}
        stats={[
          { label: "إجمالي الموظفين", value: String(rows.length) },
          { label: "نشِط", value: String(rows.filter((r) => r.is_active).length) },
          { label: "موقوف", value: String(rows.filter((r) => !r.is_active).length) },
        ]}
      />

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-foreground">قائمة الموظفين</h2>
          <Link
            to="/employee-form"
            search={{ id: "" }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" />
            إضافة موظف
          </Link>
        </div>

        <DataTable<Row>
          rows={rows}
          searchPlaceholder="بحث بالاسم أو البريد"
          dragLabel="موظف"
          emptyState={
            <EmptyState
              text="لا توجد حسابات موظفين"
              hint="اضغط «إضافة موظف» لإنشاء حساب دخول وتحديد صلاحياته."
            />
          }
          columns={[
            { header: "الموظف", cell: (r) => r.full_name, className: "font-semibold" },
            { header: "البريد", cell: (r) => <span dir="ltr">{r.email ?? "—"}</span> },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span> },
            { header: "الواتساب", cell: (r) => <span dir="ltr">{r.whatsapp ?? "—"}</span> },
            { header: "المسمى", cell: (r) => r.job_title ?? "—" },
            { header: "التعيين", cell: (r) => formatDate(r.hire_date) },
            {
              header: "الحالة",
              cell: (r) => (
                <Chip tone={r.is_active ? "success" : "neutral"}>
                  {r.is_active ? "نشط" : "موقوف"}
                </Chip>
              ),
            },
            {
              header: "مدير عام",
              cell: (r) => {
                const isAdmin = (admins.data ?? []).includes(r.id);
                return (
                  <button
                    type="button"
                    disabled={toggleAdmin.isPending}
                    onClick={() => {
                      const msg = isAdmin
                        ? "سحب صلاحية المدير العام من هذا الحساب؟"
                        : "منح هذا الحساب صلاحية المدير العام الكاملة؟";
                      if (window.confirm(msg)) {
                        toggleAdmin.mutate({ userId: r.id, enabled: !isAdmin });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
                  >
                    <ShieldCheck
                      className={`size-4 ${isAdmin ? "text-gold" : "text-muted-foreground"}`}
                    />
                    {isAdmin ? "مدير عام" : "منح الصلاحية"}
                  </button>
                );
              },
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <div className="flex items-center gap-3">
                  <Link to="/employee-form" search={{ id: r.id }} aria-label="تعديل">
                    <Pencil className="size-4 text-muted-foreground hover:text-primary" />
                  </Link>
                  <button
                    type="button"
                    disabled={toggleActive.isPending}
                    onClick={() =>
                      toggleActive.mutate({ userId: r.id, isActive: !r.is_active })
                    }
                    className="text-[12.5px] font-semibold text-primary"
                  >
                    {r.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button
                    type="button"
                    aria-label="حذف الحساب"
                    disabled={removeAccount.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `حذف حساب «${r.full_name}» نهائيًا؟ لا يمكن التراجع عن هذه الخطوة.`,
                        )
                      ) {
                        removeAccount.mutate(r.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
