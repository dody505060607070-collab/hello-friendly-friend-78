import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import authSideImg from "@/assets/auth-side.jpg";
import logoAsset from "@/assets/mithra-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
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
      if (account.data) {
        navigate({ to: "/portal" });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .limit(1);
      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        toast.error("هذا البريد غير مسجّل ضمن موظفي مثراء. تواصل مع المدير العام.");
        return;
      }
      navigate({ to: "/dashboard" });
    })();
  }, [navigate]);

  const googleSignIn = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw new Error("تعذّر تسجيل الدخول عبر Google");
      if (result.redirected) return;

      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) throw new Error("تعذّر تسجيل الدخول عبر Google");

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1);
      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        throw new Error("هذا البريد غير مسجّل ضمن موظفي مثراء. تواصل مع المدير العام.");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تسجيل الدخول عبر Google");
    } finally {
      setBusy(false);
    }
  };

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
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-6">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-card shadow-2xl lg:grid-cols-2">
        {/* صورة العلامة — box صغير على الشمال في RTL */}
        <aside className="relative hidden items-center justify-center p-6 lg:flex">
          <div className="relative h-full max-h-[520px] w-full overflow-hidden rounded-2xl shadow-lg">
            <img
              src={authSideImg}
              alt="مثراء العقارية"
              className="h-full w-full object-cover"
              width={1024}
              height={1536}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.18_0.06_255/0.85)] via-transparent to-[oklch(0.18_0.06_255/0.35)]" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-center">
              <p className="text-2xl font-bold tracking-wide text-white drop-shadow-lg">مثراء العقارية</p>
              <p className="mt-2 text-xs leading-relaxed text-white/80">
                منصة إدارة عقارية متكاملة.
              </p>
            </div>
          </div>
        </aside>

        {/* نموذج الدخول — يمين في RTL، أصغر وأنظف */}
        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-sm">
            <Link to="/" aria-label="العودة للرئيسية">
              <img src={logoAsset.url} alt="مثراء العقارية" className="mx-auto h-20 w-auto transition hover:scale-105 sm:h-24" />
            </Link>

            <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1.5 text-sm font-semibold">
              {(["staff", "client"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`rounded-xl py-2 transition-all duration-300 ${
                    audience === a
                      ? "bg-card text-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a === "staff" ? "موظف" : "عميل"}
                </button>
              ))}
            </div>

            <h1 className="mt-6 text-center text-xl font-bold text-foreground">
              {audience === "client" ? "دخول بوابة العميل" : "تسجيل الدخول"}
            </h1>
            <p className="mt-1.5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
              {audience === "client"
                ? "اسم المستخدم هو رقم الهوية، ومعه كلمة المرور الخاصة بك."
                : "الوصول للبيانات الداخلية متاح للموظفين المصرّح لهم فقط."}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {audience === "client" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    dir="ltr"
                    inputMode="numeric"
                    required
                    className="h-11 rounded-xl"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="1xxxxxxxxx"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    required
                    className="h-11 rounded-xl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@mithra.work"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  required
                  minLength={audience === "client" ? 6 : 8}
                  className="h-11 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" size="lg" className="h-11 w-full rounded-xl text-sm" disabled={busy}>
                {busy ? "جارٍ الدخول…" : audience === "client" ? "دخول بوابتي" : "دخول"}
              </Button>
            </form>

            {audience === "staff" ? (
              <>
                <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  أو
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-11 w-full gap-2 rounded-xl text-sm"
                  disabled={busy}
                  onClick={() => void googleSignIn()}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
                    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
                    <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
                    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
                  </svg>
                  الدخول عبر Google
                </Button>

                <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-foreground">
                  حسابات الموظفين يُنشئها المدير العام فقط. لا يوجد تسجيل ذاتي، والدخول عبر Google متاح
                  لبريد الموظفين المسجّل فقط.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
