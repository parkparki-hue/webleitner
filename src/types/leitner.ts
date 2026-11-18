export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export const BOX_INTERVALS_DAYS: Record<LeitnerBox, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
};

export const BOX_LABELS: Record<LeitnerBox, string> = {
  1: 'خانه ۱ (روزانه)',
  2: 'خانه ۲ (هر ۲ روز)',
  3: 'خانه ۳ (هر ۴ روز)',
  4: 'خانه ۴ (هر ۸ روز)',
  5: 'خانه ۵ (هر ۱۶ روز)',
};

export interface WordCard {
  id: string;
  front: string;
  back: string;
  phonetic?: string;
  example?: string;
  exampleTranslation?: string;
  category: string;
  box: LeitnerBox;
  mastered: boolean;
  isDifficultManual: boolean;
  wrongCount: number;
  correctCount: number;
  consecutiveWrong: number;
  createdAt: number;
  updatedAt: number;
  lastReviewedAt: number | null;
  nextReviewAt: number;
  pronunciationBestScore?: number;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  wordFront: string;
  reviewedAt: number;
  dateKey: string; // YYYY-MM-DD local
  wasCorrect: boolean;
  fromBox: LeitnerBox;
  toBox: LeitnerBox;
  becameMastered: boolean;
  responseTimeMs: number;
}

export type SubscriptionPlan = 'free' | 'pro_monthly' | 'pro_yearly';

export interface UserSettings {
  id: 'user_settings';
  xp: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastStudyDate: string | null;
  unlockedBadges: string[];
  dailyGoal: number;
  autoDifficultThreshold: number;
  reminderEnabled: boolean;
  reminderTime: string; // HH:mm
  ttsLang: 'en-US' | 'en-GB';
  ttsRate: number;
  theme: 'light' | 'dark';
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt: number | null;
  deviceId: string;
  deviceName: string;
  lastSyncAt: number | null;
  updatedAt: number;
}

export type CardFilterMode = 'all' | 'due' | 'difficult' | 'mastered';

export type AppTab =
  | 'dashboard'
  | 'review'
  | 'vocabulary'
  | 'analytics'
  | 'pronunciation'
  | 'sync_plans';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  target: number;
  metric: 'reviews' | 'streak' | 'mastered' | 'difficult_cleared' | 'pronunciation' | 'csv_import';
}
