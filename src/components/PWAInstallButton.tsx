import React, { useState } from "react";
import { Download, Smartphone, X, Share, MoreVertical } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  variant?: "compact" | "full";
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = "compact" }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      {variant === "full" ? (
        <button
          type="button"
          onClick={handleClick}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap shrink-0"
        >
          {isInstallable ? <Download className="h-4 w-4 shrink-0" /> : <Smartphone className="h-4 w-4 shrink-0" />}
          <span>{isInstallable ? "نصب برنامه روی گوشی" : "نصب روی موبایل (PWA)"}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          title="نصب روی صفحه اصلی موبایل"
        >
          {isInstallable ? <Download className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" /> : <Smartphone className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />}
          <span className="hidden sm:inline">{isInstallable ? "نصب اپ" : "نصب موبایل"}</span>
          <span className="sm:hidden">نصب</span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-5 pb-safe sm:p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-guide-title"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

            <div className="flex items-center justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                نصب یارا روی صفحه اصلی موبایل
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              این برنامه بدون نیاز به گوگل‌پلی یا اپ‌استور، مستقیماً مثل یک اپلیکیشن واقعی روی گوشی شما نصب می‌شود.
            </p>

            <div className="mt-5 space-y-4">
              <div className={`rounded-xl border p-4 ${isIOS ? "border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/20" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Share className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>آیفون و آیپد (مرورگر Safari)</span>
                </div>
                <ol className="mt-2 space-y-1.5 text-xs leading-6 text-slate-600 dark:text-slate-300 list-decimal list-inside">
                  <li>لینک برنامه را در مرورگر <strong>Safari</strong> باز کنید.</li>
                  <li>دکمه <strong>Share</strong> (مربع با فلش رو به بالا) را بزنید.</li>
                  <li>گزینه <strong>Add to Home Screen</strong> را انتخاب و تایید کنید.</li>
                </ol>
              </div>

              <div className={`rounded-xl border p-4 ${!isIOS ? "border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/20" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <MoreVertical className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>اندروید (مرورگر Chrome)</span>
                </div>
                <ol className="mt-2 space-y-1.5 text-xs leading-6 text-slate-600 dark:text-slate-300 list-decimal list-inside">
                  <li>برنامه را مستقیماً در مرورگر <strong>Chrome</strong> باز کنید.</li>
                  <li>از منوی سه‌نقطه بالا گزینه <strong>Install app</strong> یا <strong>Add to Home screen</strong> را بزنید.</li>
                  <li>گزینه <strong>Install</strong> را تایید کنید تا آیکون کنار برنامه‌ها بیاید.</li>
                </ol>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 min-h-[44px] w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
