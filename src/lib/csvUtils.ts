import { WordCard } from '../types/leitner';
import { createNewCard } from './leitnerEngine';

export interface ParsedCSVResult {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export interface CSVColumnMapping {
  frontIndex: number;
  backIndex: number;
  categoryIndex: number | null;
  phoneticIndex: number | null;
  exampleIndex: number | null;
  exampleTranslationIndex: number | null;
}

export interface CSVPreviewCard {
  front: string;
  back: string;
  category: string;
  phonetic?: string;
  example?: string;
  exampleTranslation?: string;
  isDuplicate: boolean;
}

export const SAMPLE_CSV_TEXT = `word,meaning,category,phonetic,example,example_fa
Eloquent,سخنور و شیوا,آیلتس و آکادمیک,/ˈel.ə.kwənt/,Her eloquent speech moved everyone.,سخنرانی شیوای او همه را تحت تأثیر قرار داد.
Tenacious,مصمم و سرسخت,لغات ضروری روزمره,/təˈneɪ.ʃəs/,A tenacious learner never gives up.,یک یادگیرنده مصمم هرگز تسلیم نمی‌شود.
Paradigm,الگو و چارچوب فکری,فناوری و کسب‌وکار,/ˈpær.ə.daɪm/,Offline-first apps created a new paradigm.,اپلیکیشن‌های آفلاین‌محور الگوی جدیدی ساختند.
Serene,آرام و بی‌دغدغه,لغات ضروری روزمره,/səˈriːn/,Studying in the serene morning helps focus.,مطالعه در صبح آرام به تمرکز کمک می‌کند.`;

function detectDelimiter(sampleLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let maxCount = 0;
  for (const d of candidates) {
    const count = sampleLine.split(d).length - 1;
    if (count > maxCount) {
      maxCount = count;
      best = d;
    }
  }
  return best;
}

export function parseCSVText(rawText: string): ParsedCSVResult {
  // Strip UTF-8 BOM if present (critical for Persian Excel CSV exports)
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  const firstLineEnd = cleanText.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? cleanText : cleanText.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          parsedRows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          parsedRows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    parsedRows.push(currentRow);
  }

  if (parsedRows.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const firstRow = parsedRows[0];
  const looksLikeHeader = firstRow.some((cell) =>
    /^(word|front|term|لغت|واژه|کلمه|meaning|back|translation|معنی|ترجمه|category|deck|دسته|دسته‌بندی|phonetic|تلفظ|example|مثال)$/i.test(
      cell.trim()
    )
  );

  if (looksLikeHeader && parsedRows.length > 1) {
    return {
      headers: firstRow,
      rows: parsedRows.slice(1),
      delimiter,
    };
  }

  return {
    headers: firstRow.map((_, idx) => `ستون ${idx + 1}`),
    rows: parsedRows,
    delimiter,
  };
}

export function guessColumnMapping(headers: string[]): CSVColumnMapping {
  const findCol = (patterns: RegExp[], fallback: number | null): number | null => {
    const idx = headers.findIndex((h) => patterns.some((p) => p.test(h.trim())));
    return idx >= 0 ? idx : fallback;
  };

  const frontIndex = findCol([/^(word|front|term|english|لغت|واژه|کلمه)$/i], 0) ?? 0;
  const backIndex =
    findCol([/^(meaning|back|translation|persian|معنی|ترجمه)$/i], headers.length > 1 ? 1 : 0) ?? 1;
  const categoryIndex = findCol([/^(category|deck|group|دسته|دسته‌بندی|موضوع)$/i], headers.length > 2 ? 2 : null);
  const phoneticIndex = findCol([/^(phonetic|ipa|pronunciation|تلفظ|فونتیک)$/i], headers.length > 3 ? 3 : null);
  const exampleIndex = findCol([/^(example|sentence|مثال)$/i], headers.length > 4 ? 4 : null);
  const exampleTranslationIndex = findCol(
    [/^(example_fa|example_translation|معنی مثال|ترجمه مثال)$/i],
    headers.length > 5 ? 5 : null
  );

  return {
    frontIndex,
    backIndex,
    categoryIndex,
    phoneticIndex,
    exampleIndex,
    exampleTranslationIndex,
  };
}

export function buildCSVPreview(
  rows: string[][],
  mapping: CSVColumnMapping,
  defaultCategory: string,
  existingCards: WordCard[]
): CSVPreviewCard[] {
  const existingSet = new Set(existingCards.map((c) => c.front.trim().toLowerCase()));
  const seenInBatch = new Set<string>();

  const result: CSVPreviewCard[] = [];
  for (const row of rows) {
    const front = (row[mapping.frontIndex] || '').trim();
    const back = (row[mapping.backIndex] || '').trim();
    if (!front || !back) continue;

    const category =
      mapping.categoryIndex !== null && row[mapping.categoryIndex]?.trim()
        ? row[mapping.categoryIndex].trim()
        : defaultCategory.trim() || 'عمومی';

    const phonetic = mapping.phoneticIndex !== null ? row[mapping.phoneticIndex]?.trim() : undefined;
    const example = mapping.exampleIndex !== null ? row[mapping.exampleIndex]?.trim() : undefined;
    const exampleTranslation =
      mapping.exampleTranslationIndex !== null
        ? row[mapping.exampleTranslationIndex]?.trim()
        : undefined;

    const key = front.toLowerCase();
    const isDuplicate = existingSet.has(key) || seenInBatch.has(key);
    seenInBatch.add(key);

    result.push({
      front,
      back,
      category,
      phonetic: phonetic || undefined,
      example: example || undefined,
      exampleTranslation: exampleTranslation || undefined,
      isDuplicate,
    });
  }

  return result;
}

export function convertPreviewToCards(preview: CSVPreviewCard[], skipDuplicates: boolean): WordCard[] {
  const filtered = skipDuplicates ? preview.filter((p) => !p.isDuplicate) : preview;
  const now = Date.now();
  return filtered.map((item, idx) =>
    createNewCard(
      {
        front: item.front,
        back: item.back,
        category: item.category,
        phonetic: item.phonetic,
        example: item.example,
        exampleTranslation: item.exampleTranslation,
      },
      now + idx
    )
  );
}

export function exportCardsToCSV(cards: WordCard[]): string {
  const headers = [
    'word',
    'meaning',
    'category',
    'phonetic',
    'example',
    'example_fa',
    'box',
    'mastered',
    'difficult',
    'wrongCount',
    'correctCount',
  ];

  const escapeCell = (val: string | number | boolean | undefined): string => {
    const s = val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(',')];
  for (const c of cards) {
    lines.push(
      [
        c.front,
        c.back,
        c.category,
        c.phonetic || '',
        c.example || '',
        c.exampleTranslation || '',
        c.box,
        c.mastered ? '1' : '0',
        c.isDifficultManual ? '1' : '0',
        c.wrongCount,
        c.correctCount,
      ]
        .map(escapeCell)
        .join(',')
    );
  }

  // Add UTF-8 BOM so Persian characters open cleanly in Excel & mobile spreadsheets
  return '\uFEFF' + lines.join('\r\n');
}
