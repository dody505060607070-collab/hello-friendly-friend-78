import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import logoAsset from "@/assets/mithra-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { resolveClientLogin } from "@/lib/portal.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | مثراء العقارية" },
      { name: "description", content: "دخول فريق مثراء العقارية إلى لوحة التحكم الداخلية." },
      { property: "og:title", content: "تسجيل الدخول | مثراء العقارية" },
      { property: "og:description", content: "دخول فريق مثراء العقارية إلى لوحة التحكم الداخلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState<"staff" | "client">("staff");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const account = await supabase
        .from("client_accounts")
        .select("id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      navigate({ to: account.data ? "/portal" : "/dashboard" });
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (audience === "client") {
        const { email: loginEmail } = await resolveClientLogin({ data: { username } });
        if (!loginEmail) throw new Error("لا يوجد حساب عميل بهذا الرقم. تواصل مع الإدارة.");
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw new Error("رقم الهوية أو رقم الجوال غير صحيح.");
        navigate({ to: "/portal" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب. إن طُلب تأكيد البريد فافتح الرسالة المرسلة إليك.");
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إكمال العملية");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("تعذّر الدخول عبر Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <img src={logoAsset.url} alt="مثراء العقارية" className="mx-auto h-14 w-auto" />
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
          {(["staff", "client"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAudience(a)}
              className={`rounded-lg py-2 transition ${audience === a ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {a === "staff" ? "موظف" : "عميل"}
            </button>
          ))}
        </div>

        <h1 className="mt-5 text-center text-xl font-bold text-foreground">
          {audience === "client" ? "دخول بوابة العميل" : mode === "signin" ? "تسجيل الدخول للوحة التحكم" : "إنشاء حساب موظف"}
        </h1>
        <p className="mt-2 text-center text-[13px] text-muted-foreground">
          {audience === "client"
            ? "اسم المستخدم هو رقم الهوية، وكلمة المرور رقم جوالك الذي يبدأ بـ 05."
            : "الوصول للبيانات الداخلية متاح للموظفين المصرّح لهم فقط."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {audience === "staff" && mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input
                id="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: محمد مثراء"
              />
            </div>
          ) : null}

          {audience === "client" ? (
            <div className="space-y-2">
              <Label htmlFor="username">رقم الهوية</Label>
              <Input
                id="username"
                dir="ltr"
                inputMode="numeric"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="1xxxxxxxxx"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">{audience === "client" ? "رقم الجوال (05…)" : "كلمة المرور"}</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              required
              minLength={audience === "client" ? 6 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={audience === "client" ? "05xxxxxxxx" : undefined}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {audience === "client" ? "دخول بوابتي" : mode === "signin" ? "دخول" : "إنشاء الحساب"}
          </Button>
        </form>

        {audience === "staff" ? (
          <>
            <div className="my-5 flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              أو
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
              الدخول باستخدام Google
            </Button>
          </>
        ) : null}


        <button
          type="button"
          className="mt-6 w-full text-[13px] text-primary underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "ليس لديك حساب؟ إنشاء حساب" : "لدي حساب بالفعل — تسجيل الدخول"}
        </button>
      </div>
    </main>
  );
}
