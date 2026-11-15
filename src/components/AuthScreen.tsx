import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Sun,
  Moon,
  Globe,
  ShieldCheck,
  Database,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import type { UserProfile } from "../types";
import { apiFetch, setStoredToken } from "../lib/api";
import {
  isNonJsonStaticResponse,
  isStaticHostMode,
  markStaticHostMode,
  staticLoginUser,
  staticRegisterUser,
} from "../lib/staticEngine";
import { PWAInstallButton } from "./PWAInstallButton";

interface AuthScreenProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isDark,
  onToggleTheme,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("لطفاً یک ایمیل معتبر وارد کنید.");
      return;
    }

    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    if (mode === "register") {
      if (fullName.trim().length < 2) {
        setError("نام و نام خانوادگی باید حداقل ۲ حرف باشد.");
        return;
      }
      if (password !== confirmPassword) {
        setError("رمز عبور و تکرار آن یکسان نیستند.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const authenticateLocally = async () => {
        const result =
          mode === "register"
            ? await staticRegisterUser(fullName.trim(), cleanEmail, password)
            : await staticLoginUser(cleanEmail, password);
        setStoredToken(result.token);
        onAuthenticated(result.user);
      };

      if (isStaticHostMode()) {
        await authenticateLocally();
        return;
      }

      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? { fullName: fullName.trim(), email: cleanEmail, password }
          : { email: cleanEmail, password };

      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (isNonJsonStaticResponse(response)) {
        markStaticHostMode(true);
        await authenticateLocally();
        return;
      }

      const data = (await response.json()) as {
        user?: UserProfile;
        token?: string;
        error?: string;
      };

      if (!response.ok || !data.user) {
        throw new Error(data.error || "احراز هویت ناموفق بود.");
      }

      if (data.token) {
        setStoredToken(data.token);
      }
      onAuthenticated(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در برقراری ارتباط با سرور.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Compact Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 sm:px-8 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          یارا
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={isDark ? "حالت روشن" : "حالت تاریک"}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:px-8">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
          {/* Form Column */}
          <section className="lg:col-span-6 flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                {mode === "login" ? "ورود به حساب کاربری" : "ساخت حساب جدید"}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {mode === "login"
                  ? "وارد شو تا همه گفتگوها و یادداشت‌هات همگام بشن."
                  : "در چند ثانیه ثبت‌نام کن تا تمام چت‌ها و یادداشت‌هات ذخیره بشن."}
              </p>
            </div>

            {/* Segmented Mode Tabs */}
            <div
              role="tablist"
              aria-label="نوع احراز هویت"
              className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => switchMode("login")}
                className={`min-h-[42px] rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mode === "login"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                ورود
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => switchMode("register")}
                className={`min-h-[42px] rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mode === "register"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                ثبت‌نام
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label
                    htmlFor="auth-fullname"
                    className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    نام و نام خانوادگی
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثلاً علی رضایی"
                    className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-teal-500 dark:focus:bg-slate-900"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  ایمیل
                </label>
                <input
                  id="auth-email"
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-left text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-teal-500 dark:focus:bg-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  رمز عبور
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر"
                    className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3.5 text-left text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-teal-500 dark:focus:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 left-0 flex min-w-[44px] items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    aria-label={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label
                    htmlFor="auth-confirm"
                    className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    تکرار رمز عبور
                  </label>
                  <input
                    id="auth-confirm"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="رمز عبور را دوباره بنویسید"
                    className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-left text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-teal-500 dark:focus:bg-slate-900"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    <span>{mode === "login" ? "در حال ورود..." : "در حال ساخت حساب..."}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === "login" ? "ورود به یارا" : "ثبت‌نام و شروع"}</span>
                    <ArrowLeft className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Editorial Feature Showcase Column */}
          <aside className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-900 p-6 sm:p-8 text-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs font-medium text-teal-400">دستیار هوشمند شخصی</div>
              <h2 className="mt-2 text-2xl font-bold leading-snug text-white [text-wrap:balance]">
                همه گفتگوها، یادداشت‌ها و تحلیل‌هایت در یک حساب امن
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                با ثبت‌نام در یارا، تمام تاریخچه چت‌ها، منابع وب و یادداشت‌های مهمت روی دیتابیس سرور ذخیره می‌شن تا از موبایل یا کامپیوتر همیشه بهشون دسترسی داشته باشی.
              </p>

              <div className="mt-8 space-y-5 border-t border-slate-800 pt-6">
                <div className="flex items-start gap-3.5">
                  <Globe className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">جواب‌های واقعی با جستجوی زنده</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                      بررسی هم‌زمان وب و لینک‌ها همراه با ثبت منابع معتبر زیر هر پاسخ.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <Database className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">ذخیره‌سازی دائمی در دیتابیس</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                      نگهداری ایمن گفتگوها، فایل‌های پیوست و یادداشت‌های شخصی برای هر کاربر.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">نصب روی گوشی بدون محدودیت</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                      قابل نصب به‌صورت PWA روی اندروید و آیفون با پشتیبانی از حالت آفلاین.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-5">
              <PWAInstallButton variant="full" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
