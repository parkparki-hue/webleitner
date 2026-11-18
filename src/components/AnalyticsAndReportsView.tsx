import React, { useMemo, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, Flame, Printer, TrendingUp } from 'lucide-react';
import { ReviewLog, UserSettings, WordCard } from '../types/leitner';
import {
  BADGE_DEFINITIONS,
  buildBoxDistribution,
  buildDailyTrend,
  buildMonthlyReport,
  getBadgeProgress,
  getLevelInfo,
} from '../lib/analyticsUtils';
import { formatPersianNumber } from '../lib/leitnerEngine';

interface AnalyticsAndReportsViewProps {
  cards: WordCard[];
  logs: ReviewLog[];
  settings: UserSettings;
}

export const AnalyticsAndReportsView: React.FC<AnalyticsAndReportsViewProps> = ({
  cards,
  logs,
  settings,
}) => {
  const [trendDays, setTrendDays] = useState<14 | 30>(14);
  const [monthOffset, setMonthOffset] = useState(0);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  const dailyTrend = useMemo(() => buildDailyTrend(logs, trendDays), [logs, trendDays]);
  const boxDist = useMemo(() => buildBoxDistribution(cards), [cards]);
  const monthlyReport = useMemo(
    () => buildMonthlyReport(cards, logs, monthOffset),
    [cards, logs, monthOffset]
  );
  const levelInfo = useMemo(() => getLevelInfo(settings.xp), [settings.xp]);

  const maxDailyTotal = useMemo(
    () => Math.max(5, ...dailyTrend.map((d) => d.total)),
    [dailyTrend]
  );

  const overallAccuracy = useMemo(() => {
    if (logs.length === 0) return 0;
    const correct = logs.filter((l) => l.wasCorrect).length;
    return Math.round((correct / logs.length) * 100);
  }, [logs]);

  const activePoint =
    hoveredDayIdx !== null && dailyTrend[hoveredDayIdx]
      ? dailyTrend[hoveredDayIdx]
      : dailyTrend[dailyTrend.length - 1];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl dark:text-slate-50">
            نمودارهای پیشرفت و گزارش ماهانه
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            پایش روند مرور روزانه، توزیع خانه‌های لایتنر، نرخ دقت و سیستم پاداش‌دهی
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Printer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>چاپ یا خروجی PDF گزارش</span>
        </button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Daily Review Trend SVG Chart */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                روند مرور روزانه
              </h2>
              {activePoint && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{activePoint.label}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">کل: {formatPersianNumber(activePoint.total)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                    درست: {formatPersianNumber(activePoint.correct)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-red-600 dark:text-red-400 tabular-nums">
                    غلط: {formatPersianNumber(activePoint.wrong)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 no-print">
              <button
                type="button"
                onClick={() => setTrendDays(14)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  trendDays === 14
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                ۱۴ روز
              </button>
              <button
                type="button"
                onClick={() => setTrendDays(30)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  trendDays === 30
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                ۳۰ روز
              </button>
            </div>
          </div>

          <div className="mt-5 w-full overflow-x-auto">
            <svg
              viewBox="0 0 640 220"
              className="h-56 w-full min-w-[460px]"
              role="img"
              aria-label="نمودار میله‌ای روند مرور روزانه"
            >
              {/* Horizontal grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 180 - ratio * 150;
                const val = Math.round(maxDailyTotal * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1="36"
                      y1={y}
                      x2="628"
                      y2={y}
                      className="stroke-slate-100 dark:stroke-slate-800"
                      strokeWidth="1"
                    />
                    <text
                      x="28"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] tabular-nums"
                    >
                      {formatPersianNumber(val)}
                    </text>
                  </g>
                );
              })}

              {/* Stacked Bars */}
              {dailyTrend.map((d, idx) => {
                const slotW = (628 - 44) / dailyTrend.length;
                const barW = Math.max(8, Math.min(24, slotW * 0.62));
                const x = 44 + idx * slotW + (slotW - barW) / 2;

                const correctH = (d.correct / maxDailyTotal) * 150;
                const wrongH = (d.wrong / maxDailyTotal) * 150;
                const correctY = 180 - correctH;
                const wrongY = correctY - wrongH;

                return (
                  <g
                    key={d.dateKey}
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onClick={() => setHoveredDayIdx(idx)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x - 3}
                      y={24}
                      width={barW + 6}
                      height={160}
                      fill="transparent"
                    />
                    {d.total === 0 ? (
                      <rect
                        x={x}
                        y={177}
                        width={barW}
                        height={3}
                        rx="1.5"
                        className="fill-slate-200 dark:fill-slate-800"
                      />
                    ) : (
                      <>
                        {d.correct > 0 && (
                          <rect
                            x={x}
                            y={correctY}
                            width={barW}
                            height={correctH}
                            rx="3"
                            className="fill-blue-600 dark:fill-blue-500"
                          />
                        )}
                        {d.wrong > 0 && (
                          <rect
                            x={x}
                            y={wrongY}
                            width={barW}
                            height={wrongH}
                            rx="3"
                            className="fill-amber-500 dark:fill-amber-400"
                          />
                        )}
                      </>
                    )}

                    {(trendDays === 14 || idx % 3 === 0 || idx === dailyTrend.length - 1) && (
                      <text
                        x={x + barW / 2}
                        y={202}
                        textAnchor="middle"
                        className="fill-slate-500 dark:fill-slate-400 text-[9px]"
                      >
                        {d.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-2 flex items-center justify-end gap-5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-600 dark:bg-blue-500" />
              پاسخ درست
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 dark:bg-amber-400" />
              بازگشت به خانه ۱
            </span>
          </div>
        </section>

        {/* Accuracy Rate Gauge & Box Distribution */}
        <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              نرخ دقت و توزیع خانه‌ها
            </h2>

            {/* SVG Circular Accuracy Gauge */}
            <div className="my-5 flex items-center gap-5">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    strokeWidth="10"
                    className="stroke-slate-100 dark:stroke-slate-800"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallAccuracy / 100)}`}
                    className="stroke-emerald-600 dark:stroke-emerald-500 transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatPersianNumber(overallAccuracy)}٪
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  دقت پاسخ‌گویی کل
                </div>
                <div className="tabular-nums">
                  {formatPersianNumber(logs.length)} مرور ثبت‌شده در مجموع
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatPersianNumber(cards.filter((c) => c.mastered).length)} لغت کاملاً مسلط
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            {boxDist.map((item) => (
              <div key={String(item.box)} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {item.label}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatPersianNumber(item.count)} ({formatPersianNumber(item.percent)}٪)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.box === 'mastered'
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : 'bg-blue-600 dark:bg-blue-500'
                    }`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Monthly Progress Report */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                گزارش پیشرفت ماهانه — {monthlyReport.monthTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                خلاصه عملکرد حافظه، روزهای فعال و واژگان نیازمند تمرین بیشتر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m - 1)}
              className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
              <span>ماه قبل</span>
            </button>
            <button
              type="button"
              disabled={monthOffset >= 0}
              onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
              className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span>ماه بعد</span>
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">کل مرورهای ماه</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatPersianNumber(monthlyReport.totalReviews)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">نرخ دقت ماهانه</div>
            <div className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatPersianNumber(monthlyReport.accuracyRate)}٪
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">روزهای فعال</div>
            <div className="mt-1 text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatPersianNumber(monthlyReport.activeDays)} روز
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">ارتقا بین خانه‌ها</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatPersianNumber(monthlyReport.promotionsCount)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">تسلط کامل در ماه</div>
            <div className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatPersianNumber(monthlyReport.masteredThisMonth)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">میانگین زمان پاسخ</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatPersianNumber(monthlyReport.avgResponseSeconds)} ثانیه
            </div>
          </div>
        </div>

        {monthlyReport.hardestWords.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              پرتکرارترین لغات چالش‌برانگیز (بیشترین نیاز به تمرین)
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {monthlyReport.hardestWords.map((hw, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                >
                  <span className="font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                    {hw.wordFront}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                    {formatPersianNumber(hw.wrongCount)} خطا · خانه {formatPersianNumber(hw.box)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Gamification & Rewards System */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                سیستم پاداش‌دهی، سطوح و نشان‌های افتخار
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                سطح فعلی: {formatPersianNumber(levelInfo.level)} ({levelInfo.title}) · مجموع امتیاز:{' '}
                <span className="tabular-nums">{formatPersianNumber(settings.xp)} XP</span>
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            <Flame className="h-4 w-4" />
            <span>رکورد استریک: {formatPersianNumber(settings.longestStreakDays)} روز</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BADGE_DEFINITIONS.map((badge) => {
            const isUnlocked = settings.unlockedBadges.includes(badge.id);
            const currentVal = getBadgeProgress(badge, cards, logs, settings);
            const pct = Math.min(100, Math.round((currentVal / badge.target) * 100));

            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-4 transition ${
                  isUnlocked
                    ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                    : 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-800/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {badge.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {badge.description}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold tabular-nums shrink-0 ${
                      isUnlocked
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    +{formatPersianNumber(badge.xpReward)} XP
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{isUnlocked ? 'دریافت شده' : 'در حال پیشرفت'}</span>
                    <span>
                      {formatPersianNumber(currentVal)} / {formatPersianNumber(badge.target)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        isUnlocked ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
