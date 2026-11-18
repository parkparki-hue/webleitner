import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CloudCog,
  Home,
  Mic,
  Moon,
  Play,
  Sun,
} from 'lucide-react';
import {
  AppTab,
  LeitnerBox,
  ReviewLog,
  UserSettings,
  WordCard,
} from './types/leitner';
import {
  appendReviewLog,
  createDefaultSettings,
  deleteCardById,
  loadInitialData,
  replaceAllData,
  saveCard,
  saveCardsBatch,
  saveSettings,
} from './lib/db';
import {
  DAY_MS,
  formatPersianNumber,
  getDateKey,
  isCardDifficult,
  isCardDue,
  processCardReview,
} from './lib/leitnerEngine';
import { evaluateUnlockedBadges } from './lib/analyticsUtils';
import { sendPracticeNotification } from './lib/notificationUtils';
import { DashboardView } from './components/DashboardView';
import { ReviewSessionView } from './components/ReviewSessionView';
import { VocabularyBankView } from './components/VocabularyBankView';
import { AnalyticsAndReportsView } from './components/AnalyticsAndReportsView';
import { PronunciationStudioView } from './components/PronunciationStudioView';
import { SyncBackupAndPlansView } from './components/SyncBackupAndPlansView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<WordCard[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>(createDefaultSettings);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [showCSVModal, setShowCSVModal] = useState(false);

  // Review session state
  const [reviewQueue, setReviewQueue] = useState<WordCard[]>([]);
  const [reviewLabel, setReviewLabel] = useState<string>('مرور امروز');
  const [badgeToast, setBadgeToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadInitialData()
      .then((data) => {
        if (!mounted) return;
        setCards(data.cards);
        setLogs(data.logs);
        setSettings(data.settings);
        setIsLoading(false);

        // Handle PWA shortcut URL query params
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'review') {
          const due = data.cards.filter((c) => isCardDue(c));
          setReviewQueue(due.length > 0 ? due : data.cards.slice(0, 10));
          setReviewLabel(due.length > 0 ? 'مرور موعد رسیده امروز' : 'مرور تمرینی');
          setActiveTab('review');
        }
      })
      .catch(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Smart reminder timer check while app is open
  useEffect(() => {
    if (!settings.reminderEnabled) return;
    const checkReminder = () => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const todayKey = getDateKey(now.getTime());
      const notifiedKey = `vazheban_notified_${todayKey}`;

      if (
        currentHHMM >= settings.reminderTime &&
        !localStorage.getItem(notifiedKey)
      ) {
        const dueCount = cards.filter((c) => isCardDue(c)).length;
        if (dueCount > 0) {
          localStorage.setItem(notifiedKey, '1');
          sendPracticeNotification(
            'زمان مرور لایتنر رسیده است',
            `${formatPersianNumber(dueCount)} لغت در انتظار مرور امروز شماست.`
          );
        }
      }
    };

    checkReminder();
    const timer = setInterval(checkReminder, 60000);
    return () => clearInterval(timer);
  }, [settings.reminderEnabled, settings.reminderTime, cards]);

  const dueCount = useMemo(() => cards.filter((c) => isCardDue(c)).length, [cards]);

  const updateSettings = async (partial: Partial<UserSettings>) => {
    const next: UserSettings = {
      ...settings,
      ...partial,
      updatedAt: Date.now(),
    };
    setSettings(next);
    await saveSettings(next);
  };

  const handleStartReview = (options?: { box?: LeitnerBox; difficultOnly?: boolean }) => {
    let queue: WordCard[] = [];
    let label = 'مرور موعد رسیده امروز';

    if (options?.box) {
      const boxDue = cards.filter((c) => !c.mastered && c.box === options.box && isCardDue(c));
      const boxAll = cards.filter((c) => !c.mastered && c.box === options.box);
      queue = boxDue.length > 0 ? boxDue : boxAll;
      label = `مرور خانه ${formatPersianNumber(options.box)}`;
    } else if (options?.difficultOnly) {
      queue = cards.filter((c) => isCardDifficult(c, settings.autoDifficultThreshold));
      label = 'مرور لغات دشوار';
    } else {
      const due = cards.filter((c) => isCardDue(c));
      queue = due.length > 0 ? due : cards.filter((c) => !c.mastered).slice(0, 12);
      label = due.length > 0 ? 'مرور موعد رسیده امروز' : 'مرور تمرینی واژگان';
    }

    setReviewQueue(queue);
    setReviewLabel(label);
    setActiveTab('review');
  };

  const handleStartFilteredReview = (filtered: WordCard[], label: string) => {
    setReviewQueue(filtered);
    setReviewLabel(label);
    setActiveTab('review');
  };

  const handleReviewCard = async (
    card: WordCard,
    wasCorrect: boolean,
    responseTimeMs: number
  ) => {
    const now = Date.now();
    const result = processCardReview(
      card,
      wasCorrect,
      responseTimeMs,
      settings.autoDifficultThreshold,
      now
    );

    const nextCards = cards.map((c) => (c.id === card.id ? result.updatedCard : c));
    const nextLogs = [...logs, result.log];

    setCards(nextCards);
    setLogs(nextLogs);

    await Promise.all([saveCard(result.updatedCard), appendReviewLog(result.log)]);

    // Update streak & XP & badges
    const todayKey = getDateKey(now);
    const yesterdayKey = getDateKey(now - DAY_MS);
    let currentStreak = settings.currentStreakDays;

    if (settings.lastStudyDate !== todayKey) {
      if (settings.lastStudyDate === yesterdayKey) {
        currentStreak = settings.currentStreakDays + 1;
      } else {
        currentStreak = 1;
      }
    }

    const longestStreak = Math.max(settings.longestStreakDays, currentStreak);
    const provisionalSettings: UserSettings = {
      ...settings,
      xp: settings.xp + result.xpEarned,
      currentStreakDays: currentStreak,
      longestStreakDays: longestStreak,
      lastStudyDate: todayKey,
      updatedAt: now,
    };

    const badgeEval = evaluateUnlockedBadges(nextCards, nextLogs, provisionalSettings);
    const finalSettings: UserSettings = {
      ...provisionalSettings,
      xp: provisionalSettings.xp + badgeEval.bonusXp,
      unlockedBadges: badgeEval.allUnlockedIds,
    };

    setSettings(finalSettings);
    await saveSettings(finalSettings);

    if (badgeEval.newlyUnlocked.length > 0) {
      setBadgeToast(`نشان جدید دریافت شد: ${badgeEval.newlyUnlocked[0].title}`);
      setTimeout(() => setBadgeToast(null), 4000);
    }

    return {
      xpEarned: result.xpEarned + badgeEval.bonusXp,
      promoted: result.promoted,
      becameMastered: result.becameMastered,
      newBox: result.updatedCard.box,
    };
  };

  const handleToggleDifficult = async (cardId: string) => {
    const target = cards.find((c) => c.id === cardId);
    if (!target) return;

    const currentlyDifficult = isCardDifficult(target, settings.autoDifficultThreshold);
    const updated: WordCard = {
      ...target,
      isDifficultManual: !currentlyDifficult,
      // If user explicitly unmarks an auto-flagged word, reset wrongCount to below threshold
      wrongCount: currentlyDifficult ? 0 : target.wrongCount,
      updatedAt: Date.now(),
    };

    setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
    await saveCard(updated);
  };

  const handleAddCards = async (newCards: WordCard[]) => {
    if (newCards.length === 0) return;
    setCards((prev) => [...newCards, ...prev]);
    await saveCardsBatch(newCards);
  };

  const handleDeleteCard = async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    await deleteCardById(cardId);
  };

  const handleSavePronunciationScore = async (cardId: string, score: number) => {
    const target = cards.find((c) => c.id === cardId);
    if (!target) return;
    const best = Math.max(target.pronunciationBestScore || 0, score);
    const updated: WordCard = {
      ...target,
      pronunciationBestScore: best,
      updatedAt: Date.now(),
    };
    const nextCards = cards.map((c) => (c.id === cardId ? updated : c));
    setCards(nextCards);
    await saveCard(updated);

    const badgeEval = evaluateUnlockedBadges(nextCards, logs, settings);
    if (badgeEval.newlyUnlocked.length > 0) {
      await updateSettings({
        xp: settings.xp + badgeEval.bonusXp,
        unlockedBadges: badgeEval.allUnlockedIds,
      });
      setBadgeToast(`نشان جدید دریافت شد: ${badgeEval.newlyUnlocked[0].title}`);
      setTimeout(() => setBadgeToast(null), 4000);
    }
  };

  const handleRestoreOrMerge = async (
    nextCards: WordCard[],
    nextLogs: ReviewLog[],
    nextSettings: UserSettings
  ) => {
    setCards(nextCards);
    setLogs(nextLogs);
    setSettings(nextSettings);
    await replaceAllData(nextCards, nextLogs, nextSettings);
  };

  const navLinks: Array<{ id: AppTab; label: string }> = [
    { id: 'dashboard', label: 'داشبورد' },
    { id: 'vocabulary', label: 'بانک لغات' },
    { id: 'analytics', label: 'گزارش و نمودار' },
    { id: 'pronunciation', label: 'تحلیل تلفظ' },
    { id: 'sync_plans', label: 'بکاپ و اشتراک' },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <div className="text-sm font-semibold">در حال آماده‌سازی جعبه لایتنر آفلاین...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/95 backdrop-blur-md md:block dark:border-slate-800 dark:bg-slate-900/95 no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            واژه‌بان
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="flex items-center gap-6 text-sm font-medium">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setActiveTab(link.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === link.id
                    ? 'border-b-2 border-blue-600 font-bold text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleStartReview()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>
                شروع مرور{dueCount > 0 ? ` (${formatPersianNumber(dueCount)})` : ''}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Top App Bar (<= 52px) */}
      <header className="sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/95 no-print">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="text-base font-extrabold text-slate-900 dark:text-white whitespace-nowrap"
        >
          واژه‌بان
        </button>

        <div className="flex items-center gap-2">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={() =>
              updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            aria-label="تغییر تم روشن و تاریک"
          >
            {settings.theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Desktop Workspace Utility Bar (Dark mode toggle & PWA install outside Top Bar) */}
        <div className="mb-6 hidden items-center justify-between gap-4 border-b border-slate-200/80 pb-4 md:flex dark:border-slate-800/80 no-print">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>جعبه لایتنر ۵ خانه‌ای</span>
            <span aria-hidden="true">·</span>
            <span>ذخیره‌سازی محلی آفلاین (IndexedDB)</span>
            {settings.subscriptionPlan !== 'free' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  نسخه حرفه‌ای فعال
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() =>
                updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span>حالت روز</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-blue-600" />
                  <span>تم تاریک مطالعه</span>
                </>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <DashboardView
            cards={cards}
            logs={logs}
            settings={settings}
            onStartReview={handleStartReview}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenCSVImporter={() => {
              setActiveTab('vocabulary');
              setShowCSVModal(true);
            }}
            onToggleDifficult={handleToggleDifficult}
          />
        )}

        {activeTab === 'review' && (
          <ReviewSessionView
            queue={reviewQueue}
            settings={settings}
            filterLabel={reviewLabel}
            onReviewCard={handleReviewCard}
            onToggleDifficult={handleToggleDifficult}
            onSavePronunciationScore={handleSavePronunciationScore}
            onFinishSession={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'vocabulary' && (
          <VocabularyBankView
            cards={cards}
            settings={settings}
            showCSVModal={showCSVModal}
            onSetShowCSVModal={setShowCSVModal}
            onAddCards={handleAddCards}
            onDeleteCard={handleDeleteCard}
            onToggleDifficult={handleToggleDifficult}
            onStartFilteredReview={handleStartFilteredReview}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsAndReportsView cards={cards} logs={logs} settings={settings} />
        )}

        {activeTab === 'pronunciation' && (
          <PronunciationStudioView
            cards={cards}
            settings={settings}
            onSaveScore={handleSavePronunciationScore}
            onUpdateSettings={updateSettings}
          />
        )}

        {activeTab === 'sync_plans' && (
          <SyncBackupAndPlansView
            cards={cards}
            logs={logs}
            settings={settings}
            onUpdateSettings={updateSettings}
            onRestoreOrMerge={handleRestoreOrMerge}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (Thumb Zone, <= 64px height) */}
      <nav
        aria-label="منوی پایین موبایل"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 items-center border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe md:hidden dark:border-slate-800 dark:bg-slate-900/95 no-print"
      >
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'dashboard'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Home className="h-5 w-5" />
          <span>خانه</span>
        </button>

        <button
          type="button"
          onClick={() => handleStartReview()}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'review'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Play className="h-5 w-5" />
          <span>مرور ({formatPersianNumber(dueCount)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vocabulary')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'vocabulary'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BookOpen className="h-5 w-5" />
          <span>لغات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pronunciation')}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'pronunciation'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Mic className="h-5 w-5" />
          <span>تلفظ</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab(activeTab === 'analytics' ? 'sync_plans' : 'analytics')
          }
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'analytics' || activeTab === 'sync_plans'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {activeTab === 'analytics' ? (
            <CloudCog className="h-5 w-5" />
          ) : (
            <BarChart3 className="h-5 w-5" />
          )}
          <span>{activeTab === 'analytics' ? 'بکاپ' : 'گزارش'}</span>
        </button>
      </nav>

      {/* Badge Unlocked Toast */}
      {badgeToast && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg">
          {badgeToast}
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
