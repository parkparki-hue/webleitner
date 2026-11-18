import { ReviewLog, UserSettings, WordCard } from '../types/leitner';

export interface VazhebanBackupBundle {
  app: 'vazheban-leitner';
  schemaVersion: 1;
  exportedAt: number;
  sourceDeviceId: string;
  sourceDeviceName: string;
  cards: WordCard[];
  logs: ReviewLog[];
  settings: UserSettings;
}

export function createBackupBundle(
  cards: WordCard[],
  logs: ReviewLog[],
  settings: UserSettings
): VazhebanBackupBundle {
  return {
    app: 'vazheban-leitner',
    schemaVersion: 1,
    exportedAt: Date.now(),
    sourceDeviceId: settings.deviceId,
    sourceDeviceName: settings.deviceName,
    cards,
    logs,
    settings,
  };
}

export function validateBackupBundle(raw: unknown): VazhebanBackupBundle | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<VazhebanBackupBundle>;
  if (obj.app !== 'vazheban-leitner' || !Array.isArray(obj.cards) || !Array.isArray(obj.logs)) {
    return null;
  }
  return obj as VazhebanBackupBundle;
}

/**
 * Smart multi-device merge without requiring a cloud database:
 * - Cards are matched by ID or case-insensitive front+category, keeping the newest `updatedAt`.
 * - Review logs are deduplicated by log ID.
 * - XP, longest streak, and unlocked badges are merged cleanly across devices.
 */
export function mergeMultiDeviceBundles(
  localCards: WordCard[],
  localLogs: ReviewLog[],
  localSettings: UserSettings,
  incoming: VazhebanBackupBundle
): {
  cards: WordCard[];
  logs: ReviewLog[];
  settings: UserSettings;
  addedCardsCount: number;
  updatedCardsCount: number;
  mergedLogsCount: number;
} {
  const cardById = new Map<string, WordCard>();
  const cardByKey = new Map<string, WordCard>();

  for (const c of localCards) {
    cardById.set(c.id, c);
    cardByKey.set(`${c.front.trim().toLowerCase()}::${c.category.trim().toLowerCase()}`, c);
  }

  let addedCardsCount = 0;
  let updatedCardsCount = 0;

  for (const inc of incoming.cards) {
    const key = `${inc.front.trim().toLowerCase()}::${inc.category.trim().toLowerCase()}`;
    const existing = cardById.get(inc.id) || cardByKey.get(key);

    if (!existing) {
      cardById.set(inc.id, inc);
      cardByKey.set(key, inc);
      addedCardsCount++;
    } else if (inc.updatedAt > existing.updatedAt) {
      const merged: WordCard = {
        ...inc,
        id: existing.id,
        isDifficultManual: existing.isDifficultManual || inc.isDifficultManual,
        pronunciationBestScore: Math.max(
          existing.pronunciationBestScore || 0,
          inc.pronunciationBestScore || 0
        ) || undefined,
      };
      cardById.set(existing.id, merged);
      cardByKey.set(key, merged);
      updatedCardsCount++;
    }
  }

  const logMap = new Map<string, ReviewLog>();
  for (const l of localLogs) logMap.set(l.id, l);
  let mergedLogsCount = 0;
  for (const l of incoming.logs) {
    if (!logMap.has(l.id)) {
      logMap.set(l.id, l);
      mergedLogsCount++;
    }
  }

  const mergedBadges = Array.from(
    new Set([...localSettings.unlockedBadges, ...(incoming.settings?.unlockedBadges || [])])
  );

  const mergedSettings: UserSettings = {
    ...localSettings,
    xp: Math.max(localSettings.xp, incoming.settings?.xp || 0),
    currentStreakDays: Math.max(
      localSettings.currentStreakDays,
      incoming.settings?.currentStreakDays || 0
    ),
    longestStreakDays: Math.max(
      localSettings.longestStreakDays,
      incoming.settings?.longestStreakDays || 0
    ),
    unlockedBadges: mergedBadges,
    subscriptionPlan:
      incoming.settings?.subscriptionPlan && incoming.settings.subscriptionPlan !== 'free'
        ? incoming.settings.subscriptionPlan
        : localSettings.subscriptionPlan,
    subscriptionExpiresAt: Math.max(
      localSettings.subscriptionExpiresAt || 0,
      incoming.settings?.subscriptionExpiresAt || 0
    ) || null,
    lastSyncAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    cards: Array.from(cardById.values()),
    logs: Array.from(logMap.values()).sort((a, b) => a.reviewedAt - b.reviewedAt),
    settings: mergedSettings,
    addedCardsCount,
    updatedCardsCount,
    mergedLogsCount,
  };
}

export function encodeSyncCode(bundle: VazhebanBackupBundle): string {
  const json = JSON.stringify(bundle);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeSyncCode(code: string): VazhebanBackupBundle | null {
  try {
    const clean = code.trim();
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return validateBackupBundle(JSON.parse(json));
  } catch {
    return null;
  }
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
