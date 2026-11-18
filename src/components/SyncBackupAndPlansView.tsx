import React, { useState } from 'react';
import {
  Bell,
  CalendarPlus,
  Check,
  Copy,
  CreditCard,
  Download,
  Moon,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { ReviewLog, SubscriptionPlan, UserSettings, WordCard } from '../types/leitner';
import { formatPersianDate, formatPersianNumber } from '../lib/leitnerEngine';
import { exportCardsToCSV } from '../lib/csvUtils';
import {
  createBackupBundle,
  decodeSyncCode,
  downloadTextFile,
  encodeSyncCode,
  mergeMultiDeviceBundles,
  validateBackupBundle,
  VazhebanBackupBundle,
} from '../lib/syncUtils';
import {
  downloadCalendarReminderICS,
  isNotificationSupported,
  requestReminderPermission,
  sendPracticeNotification,
} from '../lib/notificationUtils';

interface SyncBackupAndPlansViewProps {
  cards: WordCard[];
  logs: ReviewLog[];
  settings: UserSettings;
  onUpdateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  onRestoreOrMerge: (
    nextCards: WordCard[],
    nextLogs: ReviewLog[],
    nextSettings: UserSettings
  ) => Promise<void>;
}

export const SyncBackupAndPlansView: React.FC<SyncBackupAndPlansViewProps> = ({
  cards,
  logs,
  settings,
  onUpdateSettings,
  onRestoreOrMerge,
}) => {
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Payment Gateway Simulation Modal (for future Pro subscription phase)
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [cardNumber, setCardNumber] = useState('6037-9974-0000-1234');
  const [cvv2, setCvv2] = useState('482');
  const [expDate, setExpDate] = useState('1407/08');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handleExportJSON = () => {
    const bundle = createBackupBundle(cards, logs, settings);
    const filename = `vazheban-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadTextFile(filename, JSON.stringify(bundle, null, 2), 'application/json;charset=utf-8');
    setStatusMessage('فایل بکاپ کامل JSON با موفقیت دانلود شد.');
  };

  const handleExportCSV = () => {
    const csv = exportCardsToCSV(cards);
    const filename = `vazheban-words-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    setStatusMessage('خروجی CSV با پشتیبانی کامل کاراکترهای فارسی دانلود شد.');
  };

  const applyIncomingBundle = async (bundle: VazhebanBackupBundle) => {
    if (mergeMode === 'merge') {
      const merged = mergeMultiDeviceBundles(cards, logs, settings, bundle);
      await onRestoreOrMerge(merged.cards, merged.logs, merged.settings);
      setStatusMessage(
        `همگام‌سازی هوشمند انجام شد: ${formatPersianNumber(merged.addedCardsCount)} لغت جدید، ${formatPersianNumber(merged.updatedCardsCount)} لغت به‌روزرسانی و ${formatPersianNumber(merged.mergedLogsCount)} سابقه مرور ادغام شدند.`
      );
    } else {
      await onRestoreOrMerge(bundle.cards, bundle.logs, {
        ...bundle.settings,
        deviceId: settings.deviceId,
        lastSyncAt: Date.now(),
        updatedAt: Date.now(),
      });
      setStatusMessage('بازیابی کامل اطلاعات با موفقیت انجام شد.');
    }
  };

  const handleImportJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const bundle = validateBackupBundle(parsed);
        if (!bundle) {
          setStatusMessage('فایل انتخاب‌شده ساختار معتبر بکاپ واژه‌بان را ندارد.');
          return;
        }
        await applyIncomingBundle(bundle);
      } catch {
        setStatusMessage('خطا در خواندن فایل JSON بکاپ.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCopySyncCode = async () => {
    const bundle = createBackupBundle(cards, logs, settings);
    const code = encodeSyncCode(bundle);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setStatusMessage('کد همگام‌سازی دستگاه کپی شد. می‌توانید آن را در دستگاه دیگر جای‌گذاری کنید.');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setSyncCodeInput(code);
      setStatusMessage('کد همگام‌سازی در کادر زیر قرار گرفت؛ آن را کپی کنید.');
    }
  };

  const handleShareBackup = async () => {
    const bundle = createBackupBundle(cards, logs, settings);
    const jsonStr = JSON.stringify(bundle);
    const file = new File([jsonStr], 'vazheban-sync.json', { type: 'application/json' });

    if (navigator.share) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'بکاپ و همگام‌سازی واژه‌بان',
            text: 'فایل همگام‌سازی جعبه لایتنر بین دستگاه‌ها',
            files: [file],
          });
          setStatusMessage('بسته همگام‌سازی به اشتراک گذاشته شد.');
          return;
        }
      } catch {
        // fallback to download
      }
    }
    handleExportJSON();
  };

  const handleApplySyncCode = async () => {
    const decoded = decodeSyncCode(syncCodeInput);
    if (!decoded) {
      setStatusMessage('کد همگام‌سازی واردشده نامعتبر است.');
      return;
    }
    await applyIncomingBundle(decoded);
    setSyncCodeInput('');
  };

  const handleEnableNotifications = async () => {
    if (!isNotificationSupported()) {
      setStatusMessage('این مرورگر از اعلان‌های وب پشتیبانی نمی‌کند. می‌توانید از فایل یادآور تقویم (.ics) استفاده کنید.');
      return;
    }
    const perm = await requestReminderPermission();
    if (perm === 'granted') {
      await onUpdateSettings({ reminderEnabled: true });
      await sendPracticeNotification(
        'یادآور واژه‌بان فعال شد',
        `هر روز ساعت ${settings.reminderTime} یادآوری مرور لغات لایتنر برای شما ارسال می‌شود.`
      );
      setStatusMessage('اعلان هوشمند با موفقیت فعال شد و یک پیام آزمایشی ارسال گردید.');
    } else {
      setStatusMessage('مجوز اعلان در مرورگر مسدود است. از تنظیمات مرورگر آن را مجاز کنید یا فایل تقویم را دانلود نمایید.');
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;
    setIsProcessingPayment(true);
    setTimeout(async () => {
      const days = checkoutPlan === 'pro_yearly' ? 365 : 30;
      await onUpdateSettings({
        subscriptionPlan: checkoutPlan,
        subscriptionExpiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
      });
      setIsProcessingPayment(false);
      setCheckoutPlan(null);
      setStatusMessage('پرداخت آزمایشی با موفقیت تأیید شد و اشتراک حرفه‌ای روی دستگاه شما فعال گردید.');
    }, 900);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl dark:text-slate-50">
          پشتیبان‌گیری آفلاین، همگام‌سازی دستگاه‌ها و اشتراک
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          تمام داده‌ها به‌صورت امن و آفلاین روی حافظه گوشی ذخیره می‌شوند و بدون نیاز به سرور می‌توانید بین دستگاه‌ها منتقل کنید
        </p>
      </div>

      {statusMessage && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-200">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-blue-600 dark:text-blue-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Offline Backup & Multi-Device Merge */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                بکاپ آفلاین و انتقال بین گوشی، تبلت و کامپیوتر
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حالت «ادغام هوشمند» پیشرفت‌های جدید هر دو دستگاه را بدون حذف لغات ترکیب می‌کند
              </p>
            </div>
            {settings.lastSyncAt && (
              <span className="text-xs text-slate-400">
                آخرین همگام‌سازی: {formatPersianDate(settings.lastSyncAt)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportJSON}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              <span>خروجی بکاپ کامل (JSON)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
              <span>خروجی جدول لغات (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleShareBackup}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Share2 className="h-4 w-4" />
              <span>ارسال به دستگاه دیگر</span>
            </button>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                بازیابی یا همگام‌سازی از فایل دستگاه دیگر:
              </span>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setMergeMode('merge')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    mergeMode === 'merge'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  ادغام هوشمند (پیشنهادی)
                </button>
                <button
                  type="button"
                  onClick={() => setMergeMode('replace')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    mergeMode === 'replace'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  جایگزینی کامل
                </button>
              </div>
            </div>

            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
              <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>انتخاب فایل بکاپ JSON برای ورود / ادغام</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportJSONFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Instant Sync Code Transfer */}
          <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                همگام‌سازی فوری با کد متنی (بدون فایل)
              </span>
              <button
                type="button"
                onClick={handleCopySyncCode}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCode ? 'کپی شد' : 'کپی کد این دستگاه'}</span>
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                dir="ltr"
                value={syncCodeInput}
                onChange={(e) => setSyncCodeInput(e.target.value)}
                placeholder="کد همگام‌سازی دستگاه دیگر را اینجا بچسبانید..."
                className="min-h-[42px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono-num text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={!syncCodeInput.trim()}
                onClick={handleApplySyncCode}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>اعمال همگام‌سازی</span>
              </button>
            </div>
          </div>
        </div>

        {/* Smart Reminders & Study Preferences */}
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-100 pb-4 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
            اعلان‌های هوشمند و تنظیمات مطالعه
          </h2>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                حالت نمایش (مطالعه در شب)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                کاهش خستگی چشم در نور کم
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span>روشن</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-blue-600" />
                  <span>تم تاریک</span>
                </>
              )}
            </button>
          </div>

          {/* Daily Goal & Difficult Threshold */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                هدف مرور روزانه
              </label>
              <input
                type="number"
                min={5}
                max={200}
                value={settings.dailyGoal}
                onChange={(e) =>
                  onUpdateSettings({ dailyGoal: Math.max(5, Number(e.target.value) || 15) })
                }
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                حد خطای لغت دشوار
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.autoDifficultThreshold}
                onChange={(e) =>
                  onUpdateSettings({
                    autoDifficultThreshold: Math.max(1, Number(e.target.value) || 2),
                  })
                }
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Smart Reminder Time & Notification */}
          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                ساعت یادآور هوشمند روزانه
              </label>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => onUpdateSettings({ reminderTime: e.target.value })}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 whitespace-nowrap"
              >
                <Bell className="h-4 w-4" />
                <span>{settings.reminderEnabled ? 'تست اعلان مرور' : 'فعال‌سازی اعلان'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadCalendarReminderICS(settings.reminderTime)}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
              >
                <CalendarPlus className="h-4 w-4" />
                <span>افزودن به تقویم گوشی</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Plans & Secure Payment Gateway Preview (Next Phase) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                طرح‌های اشتراک و درگاه پرداخت امن (فاز تجاری)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                نسخه پایه آفلاین همیشه رایگان است؛ اشتراک حرفه‌ای برای امکانات تکمیلی و همگام‌سازی ابری آینده طراحی شده است
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            طرح فعلی:{' '}
            {settings.subscriptionPlan === 'pro_yearly'
              ? 'حرفه‌ای سالانه'
              : settings.subscriptionPlan === 'pro_monthly'
              ? 'حرفه‌ای ماهانه'
              : 'رایگان آفلاین'}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Free Tier */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                پایه آفلاین (همیشگی)
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                رایگان
              </div>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li>• سیستم کامل ۵ خانه لایتنر روی گوشی</li>
                <li>• ورود و خروجی CSV و JSON آفلاین</li>
                <li>• تحلیل تلفظ و نمودارهای پیشرفت</li>
              </ul>
            </div>
            <div className="mt-5 rounded-xl bg-slate-100 py-2.5 text-center text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              فعال روی دستگاه شما
            </div>
          </div>

          {/* Monthly Pro */}
          <div className="flex flex-col justify-between rounded-2xl border border-blue-500 p-5 dark:border-blue-600">
            <div>
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                اشتراک حرفه‌ای ماهانه
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-50 tabular-nums">
                ۴۹,۰۰۰ تومان <span className="text-xs font-normal text-slate-500">/ ماه</span>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li>• همگام‌سازی ابری خودکار (در فاز ابری)</li>
                <li>• بسته‌های لغات تخصصی آیلتس و تافل</li>
                <li>• گزارش‌های تحلیلی پیشرفته ماهانه</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutPlan('pro_monthly')}
              className="mt-5 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <CreditCard className="h-4 w-4" />
              <span>{settings.subscriptionPlan === 'pro_monthly' ? 'تمدید اشتراک' : 'خرید و آزمایش درگاه'}</span>
            </button>
          </div>

          {/* Yearly Pro */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                اشتراک سالانه (۳۳٪ تخفیف)
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-50 tabular-nums">
                ۳۹۰,۰۰۰ تومان <span className="text-xs font-normal text-slate-500">/ سال</span>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li>• تمام امکانات اشتراک حرفه‌ای ماهانه</li>
                <li>• پشتیبانی اولویت‌دار و پشتیبان‌گیری ابری</li>
                <li>• صرفه‌جویی ۱۹۸,۰۰۰ تومانی در سال</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutPlan('pro_yearly')}
              className="mt-5 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:border-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              <CreditCard className="h-4 w-4" />
              <span>{settings.subscriptionPlan === 'pro_yearly' ? 'تمدید سالانه' : 'پرداخت سالانه'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Simulated Secure Payment Gateway Modal */}
      {checkoutPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCheckoutSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  درگاه پرداخت آزمایشی (پیش‌نمایش فاز پرداخت)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutPlan(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              مبلغ قابل پرداخت:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {checkoutPlan === 'pro_yearly' ? '۳۹۰,۰۰۰ تومان' : '۴۹,۰۰۰ تومان'}
              </strong>
              <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                توجه: این یک شبیه‌ساز امن سمت کلاینت برای تست رابط کاربری درگاه است و هیچ تراکنش واقعی بانکی انجام نمی‌شود.
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">
                  شماره کارت بانکی (آزمایشی)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono-num text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">
                    CVV2
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={cvv2}
                    onChange={(e) => setCvv2(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono-num text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">
                    تاریخ انقضا
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono-num text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessingPayment}
              className="min-h-[46px] w-full rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isProcessingPayment ? 'در حال تأیید تراکنش...' : 'پرداخت و فعال‌سازی اشتراک'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
