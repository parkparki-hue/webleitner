import { BadgeDefinition, LeitnerBox, ReviewLog, UserSettings, WordCard } from '../types/leitner';
import { DAY_MS, getDateKey } from './leitnerEngine';

export const LEVELS: Array<{ level: number; title: string; minXp: number }> = [
  { level: 1, title: 'نوآموز واژگان', minXp: 0 },
  { level: 2, title: 'جوینده پایدار', minXp: 150 },
  { level: 3, title: 'مرورگر منظم', minXp: 400 },
  { level: 4, title: 'حافظه‌ساز ماهر', minXp: 800 },
  { level: 5, title: 'تک‌تیرانداز لایتنر', minXp: 1400 },
  { level: 6, title: 'استاد حافظه بلندمدت', minXp: 2300 },
  { level: 7, title: 'نابغه واژگان', minXp: 3500 },
];

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_step',
    title: 'گام نخست',
    description: 'انجام اولین مرور در جعبه لایتنر',
    xpReward: 30,
    target: 1,
    metric: 'reviews',
  },
  {
    id: 'streak_7',
    title: 'هفته طلایی',
    description: 'حفظ استریک مطالعه به مدت ۷ روز متوالی',
    xpReward: 100,
    target: 7,
    metric: 'streak',
  },
  {
    id: 'reviewer_100',
    title: 'صد مرور موفق',
    description: 'ثبت ۱۰۰ مرور لغت در تاریخچه یادگیری',
    xpReward: 120,
    target: 100,
    metric: 'reviews',
  },
  {
    id: 'master_10',
    title: 'کلکسیونر تسلط',
    description: 'رساندن ۱۰ لغت به تسلط کامل (عبور از خانه ۵)',
    xpReward: 150,
    target: 10,
    metric: 'mastered',
  },
  {
    id: 'voice_pro',
    title: 'صدای استاندارد',
    description: 'کسب امتیاز ۹۰٪ یا بالاتر در تحلیل تلفظ',
    xpReward: 80,
    target: 1,
    metric: 'pronunciation',
  },
  {
    id: 'streak_30',
    title: 'قهرمان استمرار',
    description: '۳۰ روز تمرین مداوم و بدون وقفه',
    xpReward: 300,
    target: 30,
    metric: 'streak',
  },
];

export function getLevelInfo(xp: number): {
  level: number;
  title: string;
  currentXp: number;
  nextLevelXp: number | null;
  progressPercent: number;
} {
  let current = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = LEVELS[1];

  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }

  if (!next) {
    return {
      level: current.level,
      title: current.title,
      currentXp: xp,
      nextLevelXp: null,
      progressPercent: 100,
    };
  }

  const span = next.minXp - current.minXp;
  const gained = xp - current.minXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((gained / span) * 100)));

  return {
    level: current.level,
    title: current.title,
    currentXp: xp,
    nextLevelXp: next.minXp,
    progressPercent,
  };
}

export function evaluateUnlockedBadges(
  cards: WordCard[],
  logs: ReviewLog[],
  settings: UserSettings
): { newlyUnlocked: BadgeDefinition[]; allUnlockedIds: string[]; bonusXp: number } {
  const totalReviews = logs.length;
  const masteredCount = cards.filter((c) => c.mastered).length;
  const hasHighPronunciation = cards.some((c) => (c.pronunciationBestScore || 0) >= 90);
  const maxStreak = Math.max(settings.currentStreakDays, settings.longestStreakDays);

  const unlockedSet = new Set(settings.unlockedBadges);
  const newlyUnlocked: BadgeDefinition[] = [];
  let bonusXp = 0;

  for (const badge of BADGE_DEFINITIONS) {
    if (unlockedSet.has(badge.id)) continue;

    let achieved = false;
    if (badge.metric === 'reviews' && totalReviews >= badge.target) achieved = true;
    if (badge.metric === 'streak' && maxStreak >= badge.target) achieved = true;
    if (badge.metric === 'mastered' && masteredCount >= badge.target) achieved = true;
    if (badge.metric === 'pronunciation' && hasHighPronunciation) achieved = true;

    if (achieved) {
      unlockedSet.add(badge.id);
      newlyUnlocked.push(badge);
      bonusXp += badge.xpReward;
    }
  }

  return {
    newlyUnlocked,
    allUnlockedIds: Array.from(unlockedSet),
    bonusXp,
  };
}

export function getBadgeProgress(
  badge: BadgeDefinition,
  cards: WordCard[],
  logs: ReviewLog[],
  settings: UserSettings
): number {
  if (badge.metric === 'reviews') return Math.min(badge.target, logs.length);
  if (badge.metric === 'streak')
    return Math.min(badge.target, Math.max(settings.currentStreakDays, settings.longestStreakDays));
  if (badge.metric === 'mastered')
    return Math.min(badge.target, cards.filter((c) => c.mastered).length);
  if (badge.metric === 'pronunciation')
    return cards.some((c) => (c.pronunciationBestScore || 0) >= 90) ? 1 : 0;
  return 0;
}

export interface DailyChartPoint {
  dateKey: string;
  label: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export function buildDailyTrend(logs: ReviewLog[], days: number = 14): DailyChartPoint[] {
  const now = Date.now();
  const byDay = new Map<string, { correct: number; wrong: number }>();

  for (const l of logs) {
    const entry = byDay.get(l.dateKey) || { correct: 0, wrong: 0 };
    if (l.wasCorrect) entry.correct += 1;
    else entry.wrong += 1;
    byDay.set(l.dateKey, entry);
  }

  const points: DailyChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * DAY_MS;
    const key = getDateKey(ts);
    const stat = byDay.get(key) || { correct: 0, wrong: 0 };
    const total = stat.correct + stat.wrong;
    const label = new Intl.DateTimeFormat('fa-IR', {
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(ts));

    points.push({
      dateKey: key,
      label,
      total,
      correct: stat.correct,
      wrong: stat.wrong,
      accuracy: total > 0 ? Math.round((stat.correct / total) * 100) : 0,
    });
  }
  return points;
}

export function buildBoxDistribution(cards: WordCard[]): Array<{
  box: LeitnerBox | 'mastered';
  label: string;
  count: number;
  percent: number;
}> {
  const total = Math.max(cards.length, 1);
  const boxes: LeitnerBox[] = [1, 2, 3, 4, 5];
  const dist = boxes.map((b) => {
    const count = cards.filter((c) => !c.mastered && c.box === b).length;
    return {
      box: b as LeitnerBox | 'mastered',
      label: `خانه ${new Intl.NumberFormat('fa-IR').format(b)}`,
      count,
      percent: Math.round((count / total) * 100),
    };
  });

  const masteredCount = cards.filter((c) => c.mastered).length;
  dist.push({
    box: 'mastered',
    label: 'تسلط‌یافته',
    count: masteredCount,
    percent: Math.round((masteredCount / total) * 100),
  });

  return dist;
}

export interface MonthlyReportSummary {
  monthTitle: string;
  totalReviews: number;
  correctReviews: number;
  wrongReviews: number;
  accuracyRate: number;
  activeDays: number;
  promotionsCount: number;
  masteredThisMonth: number;
  avgResponseSeconds: number;
  hardestWords: Array<{ wordFront: string; wrongCount: number; box: LeitnerBox }>;
}

export function buildMonthlyReport(
  cards: WordCard[],
  logs: ReviewLog[],
  monthOffset: number = 0
): MonthlyReportSummary {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const startTs = target.getTime();
  const nextMonth = new Date(target.getFullYear(), target.getMonth() + 1, 1);
  const endTs = nextMonth.getTime();

  const monthTitle = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
  }).format(target);

  const monthLogs = logs.filter((l) => l.reviewedAt >= startTs && l.reviewedAt < endTs);
  const totalReviews = monthLogs.length;
  const correctReviews = monthLogs.filter((l) => l.wasCorrect).length;
  const wrongReviews = totalReviews - correctReviews;
  const accuracyRate = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;
  const activeDays = new Set(monthLogs.map((l) => l.dateKey)).size;
  const promotionsCount = monthLogs.filter((l) => l.wasCorrect && l.toBox > l.fromBox).length;
  const masteredThisMonth = monthLogs.filter((l) => l.becameMastered).length;
  const avgMs =
    totalReviews > 0
      ? monthLogs.reduce((acc, l) => acc + (l.responseTimeMs || 2500), 0) / totalReviews
      : 0;

  const hardestWords = [...cards]
    .filter((c) => c.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 5)
    .map((c) => ({
      wordFront: c.front,
      wrongCount: c.wrongCount,
      box: c.box,
    }));

  return {
    monthTitle,
    totalReviews,
    correctReviews,
    wrongReviews,
    accuracyRate,
    activeDays,
    promotionsCount,
    masteredThisMonth,
    avgResponseSeconds: Number((avgMs / 1000).toFixed(1)),
    hardestWords,
  };
}
