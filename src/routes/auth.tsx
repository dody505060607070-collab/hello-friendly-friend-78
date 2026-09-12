import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import logoAsset from "@/assets/mithra-logo-transparent.png.asset.json";
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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


  const isStaff = audience === "staff";
  const portalDetails = isStaff
    ? {
        eyebrow: "بوابة الموظفين",
        title: "بوابة فريق مثراء",
        description: "مساحتك الموحدة لإدارة العقارات والعملاء والعقود والمهام اليومية بكفاءة وأمان.",
        points: ["إدارة العقارات والطلبات من مكان واحد", "صلاحيات واضحة لكل موظف", "متابعة الفريق والمهام لحظة بلحظة"],
      }
    : {
        eyebrow: "بوابة العملاء",
        title: "كل تفاصيلك في مكان واحد",
        description: "بوابة خاصة بعملاء مثراء لمتابعة العقود والفواتير والدفعات بسهولة وخصوصية.",
        points: ["متابعة العقود وبيانات الوحدات", "عرض الفواتير وحالة الدفعات", "وصول آمن إلى مستنداتك"],
      };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/60 p-4 sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary" />
      <section
        dir="ltr"
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl lg:min-h-[590px] lg:grid-cols-[1.08fr_1fr]"
      >
        <aside dir="rtl" className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col">
          <div className="absolute -left-24 top-16 h-80 w-56 rounded-[50%] border-[28px] border-primary-foreground/5" />
          <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full border-[48px] border-primary-foreground/5" />
          <div className="absolute inset-y-0 right-0 w-2 bg-gold" />

          <div className="relative z-10 flex h-full flex-col px-12 py-10">
            <Link to="/" className="w-fit" aria-label="العودة للرئيسية">
              <img
                src={logoAsset.url}
                alt="مثراء العقارية"
                className="h-20 w-40 object-contain brightness-0 invert"
              />
            </Link>

            <div className="my-auto py-10">
              <div className="mb-7 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10">
                {isStaff ? <BriefcaseBusiness className="h-7 w-7" /> : <Building2 className="h-7 w-7" />}
              </div>
              <p className="text-sm font-bold text-gold">{portalDetails.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-snug">{portalDetails.title}</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-primary-foreground/75">
                {portalDetails.description}
              </p>
              <ul className="mt-8 space-y-4 text-sm font-semibold">
                {portalDetails.points.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 px-4 py-3 text-xs text-primary-foreground/70">
              <ShieldCheck className="h-5 w-5 shrink-0 text-gold" />
              بياناتك محمية. لا تشارك معلومات الدخول مع أي شخص.
            </div>
          </div>
        </aside>

        <div dir="rtl" className="flex items-center justify-center px-6 py-8 sm:px-12 lg:px-14">
          <div className="w-full max-w-sm">
            <div className="mb-7 flex items-center justify-between gap-4 lg:hidden">
              <Link to="/" aria-label="العودة للرئيسية">
                <img src={logoAsset.url} alt="مثراء العقارية" className="h-14 w-28 object-contain" />
              </Link>
              <span className="inline-flex items-center gap-2 text-xs font-bold text-primary">
                <ShieldCheck className="h-4 w-4" /> دخول آمن
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="اختيار نوع البوابة">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAudience("staff")}
                className={`h-10 rounded-lg ${isStaff ? "bg-card text-primary shadow-sm hover:bg-card" : "text-muted-foreground"}`}
                aria-pressed={isStaff}
              >
                <BriefcaseBusiness className="h-4 w-4" /> موظف
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAudience("client")}
                className={`h-10 rounded-lg ${!isStaff ? "bg-card text-primary shadow-sm hover:bg-card" : "text-muted-foreground"}`}
                aria-pressed={!isStaff}
              >
                <UserRound className="h-4 w-4" /> عميل
              </Button>
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="h-px w-8 bg-gold" />
                {portalDetails.eyebrow}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold text-foreground">تسجيل الدخول</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isStaff
                  ? "استخدم حسابك المعتمد للوصول إلى لوحة إدارة مثراء."
                  : "استخدم رقم الهوية وكلمة المرور للدخول إلى حسابك."}
              </p>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor={isStaff ? "email" : "username"}>
                  {isStaff ? "البريد الإلكتروني" : "اسم المستخدم"}
                </Label>
                <div className="relative">
                  {isStaff ? (
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      required
                      autoComplete="email"
                      className="h-12 rounded-xl border-input bg-muted/35 px-11 text-left focus-visible:bg-card"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@mithra.work"
                    />
                  ) : (
                    <Input
                      id="username"
                      dir="ltr"
                      inputMode="numeric"
                      required
                      autoComplete="username"
                      className="h-12 rounded-xl border-input bg-muted/35 px-11 text-left focus-visible:bg-card"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="1xxxxxxxxx"
                    />
                  )}
                  {isStaff ? (
                    <Mail className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  ) : (
                    <UserRound className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    required
                    autoComplete="current-password"
                    minLength={isStaff ? 8 : 6}
                    className="h-12 rounded-xl border-input bg-muted/35 px-11 text-left focus-visible:bg-card"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <LockKeyhole className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg text-muted-foreground"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                البقاء متصلاً
              </label>

              <Button type="submit" size="lg" className="h-12 w-full rounded-xl font-bold" disabled={busy}>
                {busy ? "جارٍ الدخول…" : isStaff ? "دخول لوحة الإدارة" : "دخول بوابتي"}
              </Button>
            </form>

            {isStaff ? (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> أو <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 w-full rounded-xl font-bold"
                  disabled={busy}
                  onClick={() => void googleSignIn()}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
                    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
                    <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
                    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
                  </svg>
                  الدخول باستخدام Google
                </Button>
              </>
            ) : null}

            <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">
              {isStaff
                ? "الدخول متاح للموظفين المسجّلين فقط. للمساعدة تواصل مع المدير العام."
                : "بيانات الدخول تحصل عليها من إدارة مثراء العقارية."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
