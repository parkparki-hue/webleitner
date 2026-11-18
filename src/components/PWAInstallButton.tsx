import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'card' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'card' ? (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>{isInstallable ? 'نصب اپلیکیشن روی گوشی' : 'راهنمای افزودن به صفحه اصلی'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>نصب PWA</span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="راهنمای نصب اپلیکیشن"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                افزودن واژه‌بان به صفحه اصلی (PWA)
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {isIOS ? (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    در گوشی آیفون و آیپد (مرورگر Safari):
                  </p>
                  <ol className="list-decimal space-y-1.5 pr-5">
                    <li>در نوار پایین سافاری دکمه Share (مربع با فلش رو به بالا) را لمس کنید.</li>
                    <li>به پایین اسکرول کرده و گزینه «Add to Home Screen» را بزنید.</li>
                    <li>در بالا دکمه Add را انتخاب کنید تا آیکون واژه‌بان روی صفحه اصلی قرار بگیرد.</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    در اندروید (Chrome) و دسکتاپ:
                  </p>
                  <ol className="list-decimal space-y-1.5 pr-5">
                    <li>از منوی سه‌نقطه مرورگر (بالا سمت چپ یا راست) گزینه «Install App» یا «Add to Home screen» را انتخاب کنید.</li>
                    <li>پس از نصب، تمام لغات و صداها به‌صورت کاملاً آفلاین و بدون نیاز به اینترنت روی گوشی اجرا می‌شوند.</li>
                  </ol>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-lg md:bottom-5 dark:border-amber-700/60 dark:bg-amber-950/90 dark:text-amber-200"
    >
      <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <span>حالت آفلاین فعال است — تمام داده‌ها روی دستگاه شما ذخیره می‌شوند</span>
    </div>
  );
};
