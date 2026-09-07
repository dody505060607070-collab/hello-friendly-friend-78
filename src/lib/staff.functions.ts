import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

type AuthedSupabase = Parameters<
  Parameters<typeof requireSupabaseAuth.server>[0]
>[0]["context"]["supabase"];

async function assertSuperAdmin(supabase: AuthedSupabase, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("هذه العملية متاحة لمدير النظام فقط.");
}

/** إنشاء حساب موظف جديد (بريد + كلمة مرور) وربط ملفه الشخصي. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      whatsapp?: string;
      jobTitle?: string;
      hireDate?: string;
      adminNotes?: string;
      isSuperAdmin?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (!data.email.trim() || data.password.length < 8) {
      throw new Error("البريد مطلوب وكلمة المرور 8 أحرف على الأقل.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone ?? "" },
    });
    if (created.error) throw new Error(created.error.message);
    const newId = created.data.user?.id;
    if (!newId) throw new Error("تعذّر إنشاء الحساب.");

    const profile = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newId,
        full_name: data.fullName.trim() || data.email.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        whatsapp: data.whatsapp?.trim() || null,
        job_title: data.jobTitle?.trim() || null,
        hire_date: data.hireDate?.trim() || null,
        admin_notes: data.adminNotes?.trim() || null,
        is_active: true,
      })
      .select("id")
      .single();
    if (profile.error) throw new Error(profile.error.message);

    if (data.isSuperAdmin) {
      const role = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newId, role: "super_admin" }, { onConflict: "user_id,role" });
      if (role.error) throw new Error(role.error.message);
    } else {
      const role = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newId, role: "employee" }, { onConflict: "user_id,role" });
      if (role.error) throw new Error(role.error.message);
    }

    return { id: newId };
  });

/** تعيين كلمة مرور جديدة لموظف قائم. */
export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.password.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
