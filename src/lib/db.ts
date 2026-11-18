import { ReviewLog, UserSettings, WordCard } from '../types/leitner';
import { DAY_MS, generateId, getDateKey } from './leitnerEngine';

const DB_NAME = 'vazheban_leitner_db';
const DB_VERSION = 1;
const STORE_CARDS = 'cards';
const STORE_LOGS = 'logs';
const STORE_META = 'meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CARDS)) {
        const cardStore = db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
        cardStore.createIndex('box', 'box', { unique: false });
        cardStore.createIndex('category', 'category', { unique: false });
        cardStore.createIndex('nextReviewAt', 'nextReviewAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        const logStore = db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
        logStore.createIndex('dateKey', 'dateKey', { unique: false });
        logStore.createIndex('cardId', 'cardId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createDefaultSettings(): UserSettings {
  return {
    id: 'user_settings',
    xp: 120,
    currentStreakDays: 4,
    longestStreakDays: 6,
    lastStudyDate: getDateKey(Date.now() - DAY_MS),
    unlockedBadges: ['first_step'],
    dailyGoal: 15,
    autoDifficultThreshold: 2,
    reminderEnabled: false,
    reminderTime: '20:30',
    ttsLang: 'en-US',
    ttsRate: 0.95,
    theme: 'light',
    subscriptionPlan: 'free',
    subscriptionExpiresAt: null,
    deviceId: generateId('dev'),
    deviceName: 'دستگاه فعلی',
    lastSyncAt: null,
    updatedAt: Date.now(),
  };
}

function createStarterVocabulary(now: number): { cards: WordCard[]; logs: ReviewLog[] } {
  const starterItems: Array<{
    front: string;
    back: string;
    phonetic: string;
    category: string;
    example: string;
    exampleTranslation: string;
    box: 1 | 2 | 3 | 4 | 5;
    mastered: boolean;
    dueOffsetDays: number;
    wrongCount: number;
    correctCount: number;
    isDifficultManual: boolean;
  }> = [
    {
      front: 'Resilient',
      back: 'تاب‌آور، انعطاف‌پذیر در برابر سختی‌ها',
      phonetic: '/rɪˈzɪl.jənt/',
      category: 'آیلتس و آکادمیک',
      example: 'She proved to be resilient under intense pressure.',
      exampleTranslation: 'او نشان داد که در برابر فشار شدید بسیار تاب‌آور است.',
      box: 1,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 0,
      correctCount: 1,
      isDifficultManual: false,
    },
    {
      front: 'Ubiquitous',
      back: 'همه‌جاحاضر، فراگیر',
      phonetic: '/juːˈbɪk.wɪ.təs/',
      category: 'آیلتس و آکادمیک',
      example: 'Smartphones have become ubiquitous in modern life.',
      exampleTranslation: 'تلفن‌های هوشمند در زندگی مدرن همه‌گیر شده‌اند.',
      box: 1,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 2,
      correctCount: 1,
      isDifficultManual: true,
    },
    {
      front: 'Procrastinate',
      back: 'به تعویق انداختن، امروز و فردا کردن',
      phonetic: '/prəˈkræs.tɪ.neɪt/',
      category: 'لغات ضروری روزمره',
      example: 'Do not procrastinate when you have a clear goal.',
      exampleTranslation: 'وقتی هدف روشنی دارید کارها را به تعویق نیندازید.',
      box: 1,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 3,
      correctCount: 2,
      isDifficultManual: true,
    },
    {
      front: 'Ephemeral',
      back: 'زودگذر، ناپایدار و کوتاه‌مدت',
      phonetic: '/ɪˈfem.ər.əl/',
      category: 'آیلتس و آکادمیک',
      example: 'Fame on social media is often ephemeral.',
      exampleTranslation: 'شهرت در شبکه‌های اجتماعی اغلب زودگذر است.',
      box: 1,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 2,
      correctCount: 0,
      isDifficultManual: false,
    },
    {
      front: 'Consistency',
      back: 'تداوم، ثبات و استمرار',
      phonetic: '/kənˈsɪs.tən.si/',
      category: 'لغات ضروری روزمره',
      example: 'Consistency is the key to mastering new vocabulary.',
      exampleTranslation: 'استمرار کلید تسلط بر واژگان جدید است.',
      box: 2,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 0,
      correctCount: 2,
      isDifficultManual: false,
    },
    {
      front: 'Pragmatic',
      back: 'عمل‌گرا، واقع‌بینانه',
      phonetic: '/præɡˈmæt.ɪk/',
      category: 'فناوری و کسب‌وکار',
      example: 'We need a pragmatic approach to solve this bottleneck.',
      exampleTranslation: 'برای حل این گلوگاه به رویکردی عمل‌گرایانه نیاز داریم.',
      box: 2,
      mastered: false,
      dueOffsetDays: 1,
      wrongCount: 1,
      correctCount: 2,
      isDifficultManual: false,
    },
    {
      front: 'Scalable',
      back: 'مقیاس‌پذیر، قابل گسترش',
      phonetic: '/ˈskeɪ.lə.bəl/',
      category: 'فناوری و کسب‌وکار',
      example: 'They architected a scalable offline-first mobile app.',
      exampleTranslation: 'آن‌ها یک اپلیکیشن موبایل آفلاین‌محور و مقیاس‌پذیر طراحی کردند.',
      box: 3,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 0,
      correctCount: 3,
      isDifficultManual: false,
    },
    {
      front: 'Meticulous',
      back: 'دقیق، موشکاف و باحوصله',
      phonetic: '/məˈtɪk.jə.ləs/',
      category: 'آیلتس و آکادمیک',
      example: 'He kept meticulous notes during every lecture.',
      exampleTranslation: 'او در طول هر سخنرانی یادداشت‌های بسیار دقیقی برمی‌داشت.',
      box: 3,
      mastered: false,
      dueOffsetDays: 2,
      wrongCount: 1,
      correctCount: 3,
      isDifficultManual: false,
    },
    {
      front: 'Articulate',
      back: 'فصیح، بیان روشن و رسا',
      phonetic: '/ɑːrˈtɪk.jə.lət/',
      category: 'لغات ضروری روزمره',
      example: 'She is an articulate speaker with sharp pronunciation.',
      exampleTranslation: 'او سخنوری فصیح با تلفظی بسیار دقیق است.',
      box: 4,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 0,
      correctCount: 4,
      isDifficultManual: false,
    },
    {
      front: 'Leverage',
      back: 'بهره‌برداری هوشمندانه، اهرم کردن',
      phonetic: '/ˈlev.ər.ɪdʒ/',
      category: 'فناوری و کسب‌وکار',
      example: 'You can leverage spaced repetition to retain more words.',
      exampleTranslation: 'می‌توانید از تکرار فاصله‌دار برای حفظ لغات بیشتر بهره ببرید.',
      box: 4,
      mastered: false,
      dueOffsetDays: 5,
      wrongCount: 0,
      correctCount: 4,
      isDifficultManual: false,
    },
    {
      front: 'Momentum',
      back: 'شتاب حرکت، نیروی پیشران',
      phonetic: '/məˈmen.təm/',
      category: 'لغات ضروری روزمره',
      example: 'Daily practice builds unstoppable learning momentum.',
      exampleTranslation: 'تمرین روزانه شتاب یادگیری توقف‌ناپذیری می‌سازد.',
      box: 5,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 0,
      correctCount: 5,
      isDifficultManual: false,
    },
    {
      front: 'Authentic',
      back: 'اصیل، واقعی و معتبر',
      phonetic: '/ɔːˈθen.tɪk/',
      category: 'لغات ضروری روزمره',
      example: 'Listening to authentic audio improves your accent.',
      exampleTranslation: 'گوش دادن به فایل‌های صوتی اصیل لهجه شما را بهتر می‌کند.',
      box: 5,
      mastered: true,
      dueOffsetDays: 16,
      wrongCount: 0,
      correctCount: 6,
      isDifficultManual: false,
    },
    {
      front: 'Benchmark',
      back: 'معیار سنجش، شاخص ارزیابی',
      phonetic: '/ˈbentʃ.mɑːrk/',
      category: 'فناوری و کسب‌وکار',
      example: 'Accuracy rate is our primary benchmark for retention.',
      exampleTranslation: 'نرخ دقت معیار اصلی ما برای سنجش ماندگاری حافظه است.',
      box: 5,
      mastered: true,
      dueOffsetDays: 16,
      wrongCount: 0,
      correctCount: 6,
      isDifficultManual: false,
    },
    {
      front: 'Serendipity',
      back: 'خوش‌شانسی اتفاقی، کشف دلپذیر غیرمنتظره',
      phonetic: '/ˌser.ənˈdɪp.ə.ti/',
      category: 'لغات ضروری روزمره',
      example: 'Finding that rare book was pure serendipity.',
      exampleTranslation: 'پیدا کردن آن کتاب نایاب یک اتفاق بسیار خوشایند و غیرمنتظره بود.',
      box: 1,
      mastered: false,
      dueOffsetDays: 0,
      wrongCount: 0,
      correctCount: 0,
      isDifficultManual: false,
    },
  ];

  const cards: WordCard[] = starterItems.map((item, idx) => ({
    id: `seed_card_${idx + 1}`,
    front: item.front,
    back: item.back,
    phonetic: item.phonetic,
    example: item.example,
    exampleTranslation: item.exampleTranslation,
    category: item.category,
    box: item.box,
    mastered: item.mastered,
    isDifficultManual: item.isDifficultManual,
    wrongCount: item.wrongCount,
    correctCount: item.correctCount,
    consecutiveWrong: 0,
    createdAt: now - (14 - idx) * DAY_MS,
    updatedAt: now - DAY_MS,
    lastReviewedAt: item.correctCount > 0 ? now - DAY_MS : null,
    nextReviewAt: now + item.dueOffsetDays * DAY_MS,
  }));

  // Create realistic initial review logs over the past 7 days tied to actual cards
  const logs: ReviewLog[] = [];
  const pattern = [4, 6, 5, 8, 7, 10, 6];
  for (let d = 6; d >= 1; d--) {
    const dayTs = now - d * DAY_MS;
    const count = pattern[6 - d];
    for (let j = 0; j < count; j++) {
      const card = cards[(d + j) % cards.length];
      const wasCorrect = (d + j) % 5 !== 0;
      logs.push({
        id: `seed_log_${d}_${j}`,
        cardId: card.id,
        wordFront: card.front,
        reviewedAt: dayTs + j * 45000,
        dateKey: getDateKey(dayTs),
        wasCorrect,
        fromBox: card.box,
        toBox: wasCorrect ? (Math.min(5, card.box + 1) as 1 | 2 | 3 | 4 | 5) : 1,
        becameMastered: false,
        responseTimeMs: 2100 + j * 300,
      });
    }
  }

  return { cards, logs };
}

export async function loadInitialData(): Promise<{
  cards: WordCard[];
  logs: ReviewLog[];
  settings: UserSettings;
}> {
  const db = await openDB();

  const [cards, logs, settingsList] = await Promise.all([
    getAllFromStore<WordCard>(db, STORE_CARDS),
    getAllFromStore<ReviewLog>(db, STORE_LOGS),
    getAllFromStore<UserSettings>(db, STORE_META),
  ]);

  let settings = settingsList.find((s) => s.id === 'user_settings');

  // Seed only on brand-new installation
  if (cards.length === 0 && !settings) {
    const now = Date.now();
    const seeded = createStarterVocabulary(now);
    settings = createDefaultSettings();
    await Promise.all([
      putManyInStore(db, STORE_CARDS, seeded.cards),
      putManyInStore(db, STORE_LOGS, seeded.logs),
      putInStore(db, STORE_META, settings),
    ]);
    db.close();
    return { cards: seeded.cards, logs: seeded.logs, settings };
  }

  if (!settings) {
    settings = createDefaultSettings();
    await putInStore(db, STORE_META, settings);
  }

  db.close();
  return { cards, logs, settings };
}

export async function saveCard(card: WordCard): Promise<void> {
  const db = await openDB();
  await putInStore(db, STORE_CARDS, card);
  db.close();
}

export async function saveCardsBatch(cards: WordCard[]): Promise<void> {
  const db = await openDB();
  await putManyInStore(db, STORE_CARDS, cards);
  db.close();
}

export async function deleteCardById(cardId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CARDS, 'readwrite');
    tx.objectStore(STORE_CARDS).delete(cardId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function appendReviewLog(log: ReviewLog): Promise<void> {
  const db = await openDB();
  await putInStore(db, STORE_LOGS, log);
  db.close();
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await openDB();
  await putInStore(db, STORE_META, settings);
  db.close();
}

export async function replaceAllData(
  cards: WordCard[],
  logs: ReviewLog[],
  settings: UserSettings
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_CARDS, STORE_LOGS, STORE_META], 'readwrite');
    tx.objectStore(STORE_CARDS).clear();
    tx.objectStore(STORE_LOGS).clear();
    tx.objectStore(STORE_META).clear();

    for (const c of cards) tx.objectStore(STORE_CARDS).put(c);
    for (const l of logs) tx.objectStore(STORE_LOGS).put(l);
    tx.objectStore(STORE_META).put(settings);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function putInStore<T>(db: IDBDatabase, storeName: string, item: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function putManyInStore<T>(db: IDBDatabase, storeName: string, items: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
