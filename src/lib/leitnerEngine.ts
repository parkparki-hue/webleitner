import { BOX_INTERVALS_DAYS, LeitnerBox, ReviewLog, WordCard } from '../types/leitner';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function getDateKey(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getEndOfTodayTimestamp(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function isCardDue(card: WordCard, now: number = Date.now()): boolean {
  if (card.mastered) return false;
  return card.nextReviewAt <= getEndOfTodayTimestamp(now);
}

export function isCardDifficult(card: WordCard, threshold: number = 2): boolean {
  return card.isDifficultManual || card.wrongCount >= threshold;
}

export function createNewCard(
  input: {
    front: string;
    back: string;
    category?: string;
    phonetic?: string;
    example?: string;
    exampleTranslation?: string;
  },
  now: number = Date.now()
): WordCard {
  return {
    id: generateId('card'),
    front: input.front.trim(),
    back: input.back.trim(),
    phonetic: input.phonetic?.trim() || undefined,
    example: input.example?.trim() || undefined,
    exampleTranslation: input.exampleTranslation?.trim() || undefined,
    category: (input.category || 'عمومی').trim() || 'عمومی',
    box: 1,
    mastered: false,
    isDifficultManual: false,
    wrongCount: 0,
    correctCount: 0,
    consecutiveWrong: 0,
    createdAt: now,
    updatedAt: now,
    lastReviewedAt: null,
    nextReviewAt: now, // Due immediately for Box 1 initial study
  };
}

export function processCardReview(
  card: WordCard,
  wasCorrect: boolean,
  responseTimeMs: number = 2500,
  autoDifficultThreshold: number = 2,
  now: number = Date.now()
): { updatedCard: WordCard; log: ReviewLog; xpEarned: number; promoted: boolean; becameMastered: boolean } {
  const fromBox = card.box;
  let toBox: LeitnerBox = card.box;
  let becameMastered = false;
  let promoted = false;
  let xpEarned = 0;

  let nextReviewAt: number;
  let wrongCount = card.wrongCount;
  let correctCount = card.correctCount;
  let consecutiveWrong = card.consecutiveWrong;
  let isDifficultManual = card.isDifficultManual;

  if (wasCorrect) {
    correctCount += 1;
    consecutiveWrong = 0;

    if (card.box === 5) {
      toBox = 5;
      becameMastered = true;
      xpEarned = 25;
      nextReviewAt = now + BOX_INTERVALS_DAYS[5] * DAY_MS;
    } else {
      toBox = (card.box + 1) as LeitnerBox;
      promoted = true;
      xpEarned = 15;
      nextReviewAt = now + BOX_INTERVALS_DAYS[toBox] * DAY_MS;
    }
  } else {
    // Immediate return to Box 1 on wrong answer
    toBox = 1;
    wrongCount += 1;
    consecutiveWrong += 1;
    becameMastered = false;
    xpEarned = 3;
    nextReviewAt = now + BOX_INTERVALS_DAYS[1] * DAY_MS;

    // Auto-flag difficult if threshold reached
    if (wrongCount >= autoDifficultThreshold || consecutiveWrong >= 2) {
      isDifficultManual = card.isDifficultManual; // Automatic flag is computed via wrongCount, keep manual state intact
    }
  }

  const updatedCard: WordCard = {
    ...card,
    box: toBox,
    mastered: becameMastered,
    wrongCount,
    correctCount,
    consecutiveWrong,
    isDifficultManual,
    lastReviewedAt: now,
    nextReviewAt,
    updatedAt: now,
  };

  const log: ReviewLog = {
    id: generateId('log'),
    cardId: card.id,
    wordFront: card.front,
    reviewedAt: now,
    dateKey: getDateKey(now),
    wasCorrect,
    fromBox,
    toBox,
    becameMastered,
    responseTimeMs: Math.max(200, Math.min(responseTimeMs, 120000)),
  };

  return { updatedCard, log, xpEarned, promoted, becameMastered };
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatPersianNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value);
}

export function formatPersianDate(timestamp: number): string {
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export function formatDueRelative(nextReviewAt: number, mastered: boolean, now: number = Date.now()): string {
  if (mastered) return 'تسلط‌یافته';
  const endToday = getEndOfTodayTimestamp(now);
  if (nextReviewAt <= endToday) return 'امروز (موعد مرور)';
  const diffDays = Math.ceil((nextReviewAt - endToday) / DAY_MS);
  if (diffDays === 1) return 'فردا';
  return `${formatPersianNumber(diffDays)} روز دیگر`;
}
