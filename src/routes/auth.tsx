import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import authSideImg from "@/assets/auth-side.jpg";
import logoAsset from "@/assets/mithra-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
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
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        if (!loginEmail) throw new Error("لا يوجد حساب عميل بهذا اسم المستخدم. تواصل مع الإدارة.");
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        navigate({ to: "/portal" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error)
          throw new Error(
            "لا يوجد حساب موظف بهذا البريد أو كلمة المرور غير صحيحة. الحسابات يُنشئها المدير العام فقط.",
          );
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إكمال العملية");
    } finally {
      setBusy(false);
    }
  };


  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* نموذج الدخول — يمين في RTL */}
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/" aria-label="العودة للرئيسية">
            <img src={logoAsset.url} alt="مثراء العقارية" className="mx-auto h-24 w-auto transition hover:scale-105 sm:h-28" />
          </Link>

          <div className="mt-8 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1.5 text-sm font-semibold">
            {(["staff", "client"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`rounded-xl py-2.5 transition-all duration-300 ${
                  audience === a
                    ? "bg-card text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {a === "staff" ? "موظف" : "عميل"}
              </button>
            ))}
          </div>

          <h1 className="mt-8 text-center text-2xl font-bold text-foreground">
            {audience === "client" ? "دخول بوابة العميل" : "تسجيل الدخول للوحة التحكم"}
          </h1>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
            {audience === "client"
              ? "اسم المستخدم هو رقم الهوية، ومعه كلمة المرور الخاصة بك."
              : "الوصول للبيانات الداخلية متاح للموظفين المصرّح لهم فقط."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {audience === "client" ? (
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  dir="ltr"
                  inputMode="numeric"
                  required
                  className="h-12 rounded-xl"
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
                  className="h-12 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mithra.work"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                required
                minLength={audience === "client" ? 6 : 8}
                className="h-12 rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={busy}>
              {busy ? "جارٍ الدخول…" : audience === "client" ? "دخول بوابتي" : "دخول"}
            </Button>
          </form>

          {audience === "staff" ? (
            <p className="mt-8 text-center text-[12.5px] leading-relaxed text-muted-foreground">
              حسابات الموظفين يُنشئها المدير العام فقط. لا يوجد تسجيل ذاتي.
            </p>
          ) : null}
        </div>
      </section>

      {/* صورة العلامة — شمال في RTL */}
      <aside className="relative hidden overflow-hidden lg:block">
        <img
          src={authSideImg}
          alt="مثراء العقارية"
          className="absolute inset-0 h-full w-full object-cover"
          width={1024}
          height={1536}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.18_0.06_255/0.85)] via-transparent to-[oklch(0.18_0.06_255/0.35)]" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-center">
          <p className="text-4xl font-bold tracking-wide text-white drop-shadow-lg">مثراء العقارية</p>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            منصة إدارة عقارية متكاملة — عقارات، عقود، حجوزات، ومتابعات في مكان واحد.
          </p>
        </div>
      </aside>
    </main>
  );
}
