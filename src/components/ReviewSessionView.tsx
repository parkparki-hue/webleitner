import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Check,
  Mic,
  RotateCcw,
  RotateCw,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { BOX_INTERVALS_DAYS, LeitnerBox, UserSettings, WordCard } from '../types/leitner';
import { formatPersianNumber, isCardDifficult } from '../lib/leitnerEngine';
import {
  computePronunciationScore,
  isSpeechRecognitionSupported,
  speakText,
} from '../lib/speechUtils';

interface ReviewSessionViewProps {
  queue: WordCard[];
  settings: UserSettings;
  filterLabel: string;
  onReviewCard: (
    card: WordCard,
    wasCorrect: boolean,
    responseTimeMs: number
  ) => Promise<{
    xpEarned: number;
    promoted: boolean;
    becameMastered: boolean;
    newBox: LeitnerBox;
  }>;
  onToggleDifficult: (cardId: string) => void;
  onSavePronunciationScore: (cardId: string, score: number) => void;
  onFinishSession: () => void;
}

export const ReviewSessionView: React.FC<ReviewSessionViewProps> = ({
  queue,
  settings,
  filterLabel,
  onReviewCard,
  onToggleDifficult,
  onSavePronunciationScore,
  onFinishSession,
}) => {
  const [sessionCards, setSessionCards] = useState<WordCard[]>(queue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    correct: 0,
    wrong: 0,
    xp: 0,
    promoted: 0,
    mastered: 0,
  });
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [pronunciationResult, setPronunciationResult] = useState<{
    score: number;
    spoken: string;
    feedback: string;
  } | null>(null);

  const cardStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    setSessionCards(queue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setLastFeedback(null);
    setPronunciationResult(null);
    cardStartTimeRef.current = Date.now();
  }, [queue]);

  const currentCard = sessionCards[currentIndex];
  const isCompleted = currentIndex >= sessionCards.length;

  const progressPercent = useMemo(() => {
    if (sessionCards.length === 0) return 100;
    return Math.round((Math.min(currentIndex, sessionCards.length) / sessionCards.length) * 100);
  }, [currentIndex, sessionCards.length]);

  const handleAnswer = async (wasCorrect: boolean) => {
    if (!currentCard) return;
    const responseMs = Date.now() - cardStartTimeRef.current;
    const result = await onReviewCard(currentCard, wasCorrect, responseMs);

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (wasCorrect ? 1 : 0),
      wrong: prev.wrong + (wasCorrect ? 0 : 1),
      xp: prev.xp + result.xpEarned,
      promoted: prev.promoted + (result.promoted ? 1 : 0),
      mastered: prev.mastered + (result.becameMastered ? 1 : 0),
    }));

    if (wasCorrect) {
      if (result.becameMastered) {
        setLastFeedback(`تبریک! «${currentCard.front}» پس از عبور از خانه ۵ به تسلط کامل رسید.`);
      } else {
        setLastFeedback(
          `درست! «${currentCard.front}» به خانه ${formatPersianNumber(result.newBox)} (مرور بعدی ${formatPersianNumber(BOX_INTERVALS_DAYS[result.newBox])} روز دیگر) ارتقا یافت.`
        );
      }
    } else {
      setLastFeedback(
        `«${currentCard.front}» برای تثبیت بیشتر فوراً به خانه ۱ (بازه ۱ روزه) بازگشت.`
      );
    }

    setIsFlipped(false);
    setPronunciationResult(null);
    setCurrentIndex((prev) => prev + 1);
    cardStartTimeRef.current = Date.now();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCompleted || !currentCard) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === 's' || e.key === 'S') {
        speakText(currentCard.front, settings.ttsLang, settings.ttsRate);
      } else if (isFlipped && (e.key === '1' || e.code === 'ArrowLeft')) {
        handleAnswer(false);
      } else if (isFlipped && (e.key === '2' || e.code === 'ArrowRight')) {
        handleAnswer(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleQuickPronunciation = () => {
    if (!currentCard || isListening) return;
    if (!isSpeechRecognitionSupported()) {
      setPronunciationResult({
        score: 0,
        spoken: '',
        feedback: 'تشخیص گفتار مستقیم در این مرورگر پشتیبانی نمی‌شود. از استودیو تلفظ استفاده کنید.',
      });
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang = settings.ttsLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setPronunciationResult(null);

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const evalRes = computePronunciationScore(currentCard.front, transcript);
      setPronunciationResult({
        score: evalRes.score,
        spoken: evalRes.normalizedSpoken || transcript,
        feedback: evalRes.feedback,
      });
      onSavePronunciationScore(currentCard.id, evalRes.score);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setPronunciationResult({
        score: 0,
        spoken: '',
        feedback: 'دسترسی میکروفون یا تشخیص صدا با خطا مواجه شد.',
      });
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  if (sessionCards.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          کارتی برای مرور در این فیلد وجود ندارد
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          همه کارت‌های این بخش مرور شده‌اند یا هنوز لغتی به آن اضافه نکرده‌اید.
        </p>
        <button
          type="button"
          onClick={onFinishSession}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <ArrowRight className="h-4 w-4" />
          <span>بازگشت به داشبورد</span>
        </button>
      </div>
    );
  }

  if (isCompleted) {
    const sessionAcc =
      sessionStats.reviewed > 0
        ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
        : 0;

    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <Award className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-50">
          جلسه مرور با موفقیت تکمیل شد
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          تداوم تمرین روزانه مسیر انتقال واژگان به حافظه بلندمدت را هموار می‌کند.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-5 sm:grid-cols-4 dark:border-slate-800">
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatPersianNumber(sessionStats.reviewed)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">مرور شده</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatPersianNumber(sessionAcc)}٪
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">نرخ دقت</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
              +{formatPersianNumber(sessionStats.xp)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">امتیاز XP</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatPersianNumber(sessionStats.promoted + sessionStats.mastered)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ارتقا یافته</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onFinishSession}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ArrowRight className="h-4 w-4" />
            <span>بازگشت به داشبورد</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setSessionStats({
                reviewed: 0,
                correct: 0,
                wrong: 0,
                xp: 0,
                promoted: 0,
                mastered: 0,
              });
              cardStartTimeRef.current = Date.now();
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RotateCcw className="h-4 w-4" />
            <span>تمرین مجدد این بسته</span>
          </button>
        </div>
      </div>
    );
  }

  const isDiff = isCardDifficult(currentCard, settings.autoDifficultThreshold);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Top Progress Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onFinishSession}
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowRight className="h-4 w-4" />
          <span>خروج از مرور</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{filterLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            کارت {formatPersianNumber(currentIndex + 1)} از {formatPersianNumber(sessionCards.length)}
          </span>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {lastFeedback && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {lastFeedback}
        </div>
      )}

      {/* 3D Flipping Card */}
      <div className="perspective-1200">
        <div
          className={`relative min-h-[340px] w-full transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front Face */}
          <div className="backface-hidden absolute inset-0 flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{currentCard.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  خانه {formatPersianNumber(currentCard.box)} ({formatPersianNumber(BOX_INTERVALS_DAYS[currentCard.box])} روزه)
                </span>
                {isDiff && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">دشوار</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onToggleDifficult(currentCard.id)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  isDiff
                    ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/60'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                aria-label="نشان‌گذاری دستی لغت دشوار"
                title="نشان‌گذاری لغت دشوار"
              >
                <Star className={`h-5 w-5 ${isDiff ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div
              onClick={() => setIsFlipped(true)}
              className="my-auto flex cursor-pointer flex-col items-center justify-center py-6 text-center"
            >
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl dark:text-slate-50" dir="ltr">
                {currentCard.front}
              </div>
              {currentCard.phonetic && (
                <div className="mt-2 font-mono-num text-sm text-slate-500 dark:text-slate-400" dir="ltr">
                  {currentCard.phonetic}
                </div>
              )}
              <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                برای مشاهده معنی و مثال روی کارت کلیک کنید یا Space بزنید
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => speakText(currentCard.front, settings.ttsLang, settings.ttsRate)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Volume2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>شنیدن تلفظ</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickPronunciation}
                  disabled={isListening}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    isListening
                      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  <span>{isListening ? 'در حال گوش دادن...' : 'تست تلفظ'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <RotateCw className="h-4 w-4" />
                <span>نمایش پاسخ</span>
              </button>
            </div>
          </div>

          {/* Back Face */}
          <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between rounded-3xl border border-blue-200 bg-white p-6 md:p-8 shadow-sm dark:border-blue-900/50 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{currentCard.front}</span>
              <button
                type="button"
                onClick={() => setIsFlipped(false)}
                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>برگشت به روی کارت</span>
              </button>
            </div>

            <div className="my-auto space-y-4 py-4 text-center">
              <div className="text-2xl font-extrabold leading-relaxed text-slate-900 md:text-3xl dark:text-slate-50">
                {currentCard.back}
              </div>

              {currentCard.example && (
                <div className="mx-auto max-w-lg space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/70">
                  <div className="flex items-center justify-center gap-2 font-medium text-slate-800 dark:text-slate-200" dir="ltr">
                    <span>{currentCard.example}</span>
                    <button
                      type="button"
                      onClick={() => speakText(currentCard.example!, settings.ttsLang, settings.ttsRate)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      aria-label="پخش جمله مثال"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                  {currentCard.exampleTranslation && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {currentCard.exampleTranslation}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleAnswer(false)}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.98] dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
              >
                <X className="h-5 w-5" />
                <span>بلد نبودم (بازگشت به خانه ۱)</span>
              </button>

              <button
                type="button"
                onClick={() => handleAnswer(true)}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                <Check className="h-5 w-5" />
                <span>
                  {currentCard.box === 5
                    ? 'بلدم (تسلط کامل)'
                    : `بلدم (ارتقا به خانه ${formatPersianNumber(currentCard.box + 1)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {pronunciationResult && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              نتیجه تحلیل صوتی: <span className="tabular-nums">{formatPersianNumber(pronunciationResult.score)}٪</span>
            </span>
            {pronunciationResult.spoken && (
              <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                شنیده شد: "{pronunciationResult.spoken}"
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {pronunciationResult.feedback}
          </p>
        </div>
      )}
    </div>
  );
};

interface SpeechRecognitionEventLike {
  results?: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}
