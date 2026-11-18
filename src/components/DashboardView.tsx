import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CheckCircle2,
  Flame,
  Layers,
  Mic,
  Play,
  RotateCw,
  Star,
  Upload,
  Volume2,
} from 'lucide-react';
import { BOX_INTERVALS_DAYS, LeitnerBox, ReviewLog, UserSettings, WordCard } from '../types/leitner';
import { formatPersianNumber, getDateKey, isCardDifficult, isCardDue } from '../lib/leitnerEngine';
import { getLevelInfo } from '../lib/analyticsUtils';
import { speakText } from '../lib/speechUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface DashboardViewProps {
  cards: WordCard[];
  logs: ReviewLog[];
  settings: UserSettings;
  onStartReview: (options?: { box?: LeitnerBox; difficultOnly?: boolean }) => void;
  onNavigateTab: (tab: 'vocabulary' | 'analytics' | 'pronunciation' | 'sync_plans') => void;
  onOpenCSVImporter: () => void;
  onToggleDifficult: (cardId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cards,
  logs,
  settings,
  onStartReview,
  onNavigateTab,
  onOpenCSVImporter,
  onToggleDifficult,
}) => {
  const [flippedWidgetIds, setFlippedWidgetIds] = useState<Record<string, boolean>>({});

  const todayKey = getDateKey();
  const todayLogs = useMemo(() => logs.filter((l) => l.dateKey === todayKey), [logs, todayKey]);
  const dueCards = useMemo(() => cards.filter((c) => isCardDue(c)), [cards]);
  const difficultCards = useMemo(
    () => cards.filter((c) => isCardDifficult(c, settings.autoDifficultThreshold)),
    [cards, settings.autoDifficultThreshold]
  );
  const masteredCards = useMemo(() => cards.filter((c) => c.mastered), [cards]);

  const overallAccuracy = useMemo(() => {
    if (logs.length === 0) return 0;
    const correct = logs.filter((l) => l.wasCorrect).length;
    return Math.round((correct / logs.length) * 100);
  }, [logs]);

  const levelInfo = useMemo(() => getLevelInfo(settings.xp), [settings.xp]);
  const dailyGoalProgress = Math.min(
    100,
    Math.round((todayLogs.length / Math.max(settings.dailyGoal, 1)) * 100)
  );

  const dailyWidgetWords = useMemo(() => {
    const prioritized = [
      ...dueCards.filter((c) => isCardDifficult(c, settings.autoDifficultThreshold)),
      ...dueCards.filter((c) => !isCardDifficult(c, settings.autoDifficultThreshold)),
      ...difficultCards,
      ...cards,
    ];
    const unique: WordCard[] = [];
    const seen = new Set<string>();
    for (const c of prioritized) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        unique.push(c);
      }
      if (unique.length >= 4) break;
    }
    return unique;
  }, [cards, dueCards, difficultCards, settings.autoDifficultThreshold]);

  const boxes: LeitnerBox[] = [1, 2, 3, 4, 5];

  const toggleWidgetCard = (id: string) => {
    setFlippedWidgetIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8">
      {/* Hero Workspace Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 md:p-8 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>حالت ذخیره‌سازی آفلاین روی دستگاه</span>
              <span aria-hidden="true">·</span>
              <span>سطح {formatPersianNumber(levelInfo.level)}: {levelInfo.title}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatPersianNumber(settings.xp)} امتیاز XP</span>
            </div>

            <h1 className="text-2xl font-extrabold leading-tight text-slate-900 md:text-3xl dark:text-slate-50 [text-wrap:balance]">
              {dueCards.length > 0
                ? `${formatPersianNumber(dueCards.length)} لغت آماده مرور در جعبه لایتنر شماست`
                : 'تمام مرورهای امروز شما با موفقیت انجام شده است'}
            </h1>

            <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              بر اساس الگوریتم ۵ خانه لایتنر با بازه‌های ۱، ۲، ۴، ۸ و ۱۶ روزه، پاسخ‌های درست کارت را به خانه بعدی ارتقا می‌دهند و پاسخ اشتباه کارت را فوراً به خانه ۱ بازمی‌گرداند.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onStartReview()}
              disabled={dueCards.length === 0 && cards.length === 0}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>
                {dueCards.length > 0
                  ? `شروع مرور امروز (${formatPersianNumber(dueCards.length)})`
                  : 'مرور تمرینی همه لغات'}
              </span>
            </button>

            {difficultCards.length > 0 && (
              <button
                type="button"
                onClick={() => onStartReview({ difficultOnly: true })}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                <Star className="h-4 w-4 text-amber-500" />
                <span>مرور لغات دشوار ({formatPersianNumber(difficultCards.length)})</span>
              </button>
            )}

            <PWAInstallButton variant="card" />
          </div>
        </div>

        {/* Daily Goal & Streak Panel */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                هدف و استریک امروز
              </h2>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                <Flame className="h-4 w-4" />
                {formatPersianNumber(settings.currentStreakDays)} روز متوالی
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>مرور امروز</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatPersianNumber(todayLogs.length)} از {formatPersianNumber(settings.dailyGoal)} کارت
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${dailyGoalProgress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>پیشرفت سطح بعدی</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatPersianNumber(levelInfo.progressPercent)}٪
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatPersianNumber(cards.length)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">کل لغات</div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatPersianNumber(masteredCards.length)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">تسلط‌یافته</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {formatPersianNumber(overallAccuracy)}٪
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">دقت کل</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Leitner Boxes Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              وضعیت ۵ خانه لایتنر
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              روی هر خانه کلیک کنید تا مرور همان خانه را آغاز کنید
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('analytics')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            <span>مشاهده نمودارهای پیشرفت</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {boxes.map((box) => {
            const boxCards = cards.filter((c) => !c.mastered && c.box === box);
            const boxDue = boxCards.filter((c) => isCardDue(c)).length;
            const intervalDays = BOX_INTERVALS_DAYS[box];

            return (
              <button
                key={box}
                type="button"
                onClick={() => onStartReview({ box })}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-400 hover:shadow-sm active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    خانه {formatPersianNumber(box)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    هر {formatPersianNumber(intervalDays)} روز
                  </span>
                </div>

                <div className="mt-4 flex items-baseline justify-between w-full">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tabular-nums">
                    {formatPersianNumber(boxCards.length)}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      boxDue > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {boxDue > 0 ? `${formatPersianNumber(boxDue)} آماده مرور` : 'به‌روز'}
                  </span>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${cards.length > 0 ? Math.min(100, Math.round((boxCards.length / cards.length) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Daily Keywords Quick Widget */}
      <section id="daily-widget" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              ویجت کلمات کلیدی روزانه
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              دسترسی سریع به واژگان اولویت‌دار امروز — برای مشاهده معنی روی کارت بزنید
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('vocabulary')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            <span>مدیریت همه لغات</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </div>

        {dailyWidgetWords.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            هنوز لغتی اضافه نشده است. از بخش بانک لغات یا ورود CSV اولین واژه‌ها را اضافه کنید.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dailyWidgetWords.map((card) => {
              const isFlipped = Boolean(flippedWidgetIds[card.id]);
              const isDiff = isCardDifficult(card, settings.autoDifficultThreshold);

              return (
                <div
                  key={card.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate">{card.category}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => speakText(card.front, settings.ttsLang, settings.ttsRate)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                        aria-label={`پخش تلفظ ${card.front}`}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleDifficult(card.id)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                          isDiff
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50'
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        aria-label="نشان‌گذاری دشوار"
                      >
                        <Star className={`h-4 w-4 ${isDiff ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleWidgetCard(card.id)}
                    className="my-4 flex min-h-[84px] w-full flex-col items-center justify-center rounded-xl bg-slate-50 px-3 py-4 text-center transition hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800"
                  >
                    {!isFlipped ? (
                      <>
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                          {card.front}
                        </span>
                        {card.phonetic && (
                          <span className="mt-1 font-mono-num text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                            {card.phonetic}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm font-semibold leading-6 text-blue-700 dark:text-blue-300">
                        {card.back}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>خانه {formatPersianNumber(card.box)}</span>
                    <button
                      type="button"
                      onClick={() => toggleWidgetCard(card.id)}
                      className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>{isFlipped ? 'نمایش لغت' : 'نمایش معنی'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Tools Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={onOpenCSVImporter}
          className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ورود لغات با فایل و متن CSV
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              پیش‌نمایش و دسته‌بندی خودکار فارسی
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('pronunciation')}
          className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              استودیو تحلیل صوتی تلفظ
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              ضبط صدا، مقایسه موج و نمره تلفظ
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('sync_plans')}
          className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              یادآور هوشمند و بکاپ آفلاین
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {settings.reminderEnabled
                ? `فعال برای ساعت ${settings.reminderTime}`
                : 'تنظیم اعلان روزانه و همگام‌سازی'}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('analytics')}
          className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              گزارش ماهانه و نشان‌های پاداش
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              تحلیل روند یادگیری و دقت حافظه
            </div>
          </div>
        </button>
      </section>

      {dueCards.length === 0 && cards.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            عالی! تمام کارت‌های موعد رسیده امروز را مرور کرده‌اید. می‌توانید از طریق{' '}
            <button
              type="button"
              onClick={() => onNavigateTab('vocabulary')}
              className="font-bold underline"
            >
              بانک لغات
            </button>{' '}
            واژه‌های جدید اضافه کنید یا تلفظ آن‌ها را تمرین کنید.
          </span>
        </div>
      )}
    </div>
  );
};
