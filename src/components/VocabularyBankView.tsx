import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  BOX_INTERVALS_DAYS,
  CardFilterMode,
  LeitnerBox,
  UserSettings,
  WordCard,
} from '../types/leitner';
import {
  createNewCard,
  formatDueRelative,
  formatPersianNumber,
  isCardDifficult,
  isCardDue,
} from '../lib/leitnerEngine';
import {
  buildCSVPreview,
  CSVColumnMapping,
  convertPreviewToCards,
  guessColumnMapping,
  parseCSVText,
  SAMPLE_CSV_TEXT,
} from '../lib/csvUtils';
import { speakText } from '../lib/speechUtils';

interface VocabularyBankViewProps {
  cards: WordCard[];
  settings: UserSettings;
  showCSVModal: boolean;
  onSetShowCSVModal: (open: boolean) => void;
  onAddCards: (newCards: WordCard[]) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onToggleDifficult: (cardId: string) => Promise<void>;
  onStartFilteredReview: (filteredCards: WordCard[], label: string) => void;
}

export const VocabularyBankView: React.FC<VocabularyBankViewProps> = ({
  cards,
  settings,
  showCSVModal,
  onSetShowCSVModal,
  onAddCards,
  onDeleteCard,
  onToggleDifficult,
  onStartFilteredReview,
}) => {
  const [filterMode, setFilterMode] = useState<CardFilterMode>('all');
  const [selectedBox, setSelectedBox] = useState<LeitnerBox | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Single card add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newCategory, setNewCategory] = useState('لغات ضروری روزمره');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newExample, setNewExample] = useState('');
  const [newExampleFa, setNewExampleFa] = useState('');

  // CSV importer state
  const [csvRawText, setCsvRawText] = useState('');
  const [csvDefaultCategory, setCsvDefaultCategory] = useState('وارد شده از CSV');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [customMapping, setCustomMapping] = useState<CSVColumnMapping | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(cards.map((c) => c.category));
    return ['all', ...Array.from(set)];
  }, [cards]);

  const counts = useMemo(() => {
    return {
      all: cards.length,
      due: cards.filter((c) => isCardDue(c)).length,
      difficult: cards.filter((c) => isCardDifficult(c, settings.autoDifficultThreshold)).length,
      mastered: cards.filter((c) => c.mastered).length,
    };
  }, [cards, settings.autoDifficultThreshold]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards.filter((card) => {
      if (filterMode === 'due' && !isCardDue(card)) return false;
      if (filterMode === 'difficult' && !isCardDifficult(card, settings.autoDifficultThreshold))
        return false;
      if (filterMode === 'mastered' && !card.mastered) return false;
      if (selectedBox !== 'all' && (card.mastered || card.box !== selectedBox)) return false;
      if (selectedCategory !== 'all' && card.category !== selectedCategory) return false;

      if (q) {
        const hay = `${card.front} ${card.back} ${card.category} ${card.example || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cards, filterMode, selectedBox, selectedCategory, searchQuery, settings.autoDifficultThreshold]);

  const parsedCSV = useMemo(() => parseCSVText(csvRawText), [csvRawText]);
  const effectiveMapping = useMemo(() => {
    if (customMapping && parsedCSV.headers.length > 0) return customMapping;
    return guessColumnMapping(parsedCSV.headers);
  }, [customMapping, parsedCSV.headers]);

  const csvPreview = useMemo(() => {
    if (parsedCSV.rows.length === 0) return [];
    return buildCSVPreview(parsedCSV.rows, effectiveMapping, csvDefaultCategory, cards);
  }, [parsedCSV.rows, effectiveMapping, csvDefaultCategory, cards]);

  const handleAddSingleCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    const card = createNewCard({
      front: newFront,
      back: newBack,
      category: newCategory,
      phonetic: newPhonetic,
      example: newExample,
      exampleTranslation: newExampleFa,
    });
    await onAddCards([card]);
    setNewFront('');
    setNewBack('');
    setNewPhonetic('');
    setNewExample('');
    setNewExampleFa('');
    setShowAddModal(false);
  };

  const handleCSVFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvRawText(text);
      setCustomMapping(null);
      setImportNotice(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmCSVImport = async () => {
    const toCreate = convertPreviewToCards(csvPreview, skipDuplicates);
    if (toCreate.length === 0) return;
    await onAddCards(toCreate);
    setImportNotice(`${formatPersianNumber(toCreate.length)} لغت جدید با موفقیت به خانه ۱ اضافه شد.`);
    setCsvRawText('');
    setCustomMapping(null);
    setTimeout(() => {
      onSetShowCSVModal(false);
      setImportNotice(null);
    }, 900);
  };

  const filterTabs: Array<{ id: CardFilterMode; label: string; count: number }> = [
    { id: 'all', label: 'همه لغات', count: counts.all },
    { id: 'due', label: 'موعد مرور', count: counts.due },
    { id: 'difficult', label: 'لغات دشوار', count: counts.difficult },
    { id: 'mastered', label: 'تسلط‌یافته', count: counts.mastered },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl dark:text-slate-50">
            بانک لغات و دسته‌بندی‌ها
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            فیلتر سریع واژگان دشوار، موعد مرور، تسلط‌یافته و ورود گروهی CSV فارسی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onSetShowCSVModal(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>ورود CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>افزودن لغت</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Filter Segmented Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {filterTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterMode(t.id)}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  filterMode === t.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {t.label} ({formatPersianNumber(t.count)})
              </button>
            ))}
          </div>

          {filteredCards.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onStartFilteredReview(
                  filteredCards,
                  `مرور فیلترشده (${formatPersianNumber(filteredCards.length)} لغت)`
                )
              }
              className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
            >
              شروع مرور این فهرست ({formatPersianNumber(filteredCards.length)})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی لغت، معنی فارسی یا مثال..."
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="فیلتر دسته‌بندی"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'همه دسته‌بندی‌ها' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedBox}
              onChange={(e) =>
                setSelectedBox(e.target.value === 'all' ? 'all' : (Number(e.target.value) as LeitnerBox))
              }
              aria-label="فیلتر خانه لایتنر"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">همه خانه‌ها</option>
              {[1, 2, 3, 4, 5].map((b) => (
                <option key={b} value={b}>
                  خانه {formatPersianNumber(b)} ({formatPersianNumber(BOX_INTERVALS_DAYS[b as LeitnerBox])} روزه)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vocabulary List */}
      {filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          لغتی با این فیلتر یافت نشد. فیلترها را تغییر دهید یا واژه جدیدی اضافه کنید.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {filteredCards.map((card) => {
            const isDiff = isCardDifficult(card, settings.autoDifficultThreshold);
            const isAutoDiff = !card.isDifficultManual && card.wrongCount >= settings.autoDifficultThreshold;

            return (
              <div
                key={card.id}
                className="flex flex-col justify-between gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center dark:hover:bg-slate-800/40"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                      {card.front}
                    </span>
                    {card.phonetic && (
                      <span className="font-mono-num text-xs text-slate-400" dir="ltr">
                        {card.phonetic}
                      </span>
                    )}
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                      {card.back}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{card.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {card.mastered ? 'تسلط کامل' : `خانه ${formatPersianNumber(card.box)}`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDueRelative(card.nextReviewAt, card.mastered)}</span>
                    {isDiff && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {isAutoDiff ? 'دشوار (خودکار)' : 'دشوار'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => speakText(card.front, settings.ttsLang, settings.ttsRate)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-label={`پخش تلفظ ${card.front}`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleDifficult(card.id)}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                      isDiff
                        ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/60'
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    aria-label="تغییر وضعیت دشوار"
                  >
                    <Star className={`h-4 w-4 ${isDiff ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteCard(card.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    aria-label={`حذف ${card.front}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single Word Add Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleAddSingleCard}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                افزودن لغت جدید به خانه ۱
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  لغت یا عبارت (روی کارت) *
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="مثلاً: Eloquent"
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  معنی فارسی (پشت کارت) *
                </label>
                <input
                  type="text"
                  required
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="مثلاً: شیوا و سخنور"
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  دسته‌بندی
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  آوانگاری / فونتیک (اختیاری)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={newPhonetic}
                  onChange={(e) => setNewPhonetic(e.target.value)}
                  placeholder="/ˈel.ə.kwənt/"
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                جمله مثال (اختیاری)
              </label>
              <input
                type="text"
                dir="ltr"
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                placeholder="Her eloquent speech inspired the audience."
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                ترجمه جمله مثال (اختیاری)
              </label>
              <input
                type="text"
                value={newExampleFa}
                onChange={(e) => setNewExampleFa(e.target.value)}
                placeholder="سخنرانی شیوای او الهام‌بخش مخاطبان شد."
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="min-h-[42px] rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                ذخیره در خانه ۱
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Importer Modal with Live Preview */}
      {showCSVModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ورود لغات از فایل و متن CSV (پشتیبانی کامل فارسی UTF-8)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSetShowCSVModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>انتخاب فایل .csv از گوشی یا کامپیوتر</span>
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleCSVFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setCsvRawText(SAMPLE_CSV_TEXT);
                    setCustomMapping(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  بارگذاری نمونه آماده CSV
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  یا متن CSV را مستقیماً اینجا بچسبانید (جداکننده کاما، نقطه‌ویرگول یا Tab):
                </label>
                <textarea
                  rows={5}
                  dir="auto"
                  value={csvRawText}
                  onChange={(e) => {
                    setCsvRawText(e.target.value);
                    setCustomMapping(null);
                  }}
                  placeholder="word,meaning,category&#10;Resilient,تاب‌آور,آیلتس"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono-num text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {parsedCSV.headers.length > 0 && (
                <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        ستون لغت (رو)
                      </label>
                      <select
                        value={effectiveMapping.frontIndex}
                        onChange={(e) =>
                          setCustomMapping({
                            ...effectiveMapping,
                            frontIndex: Number(e.target.value),
                          })
                        }
                        className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {parsedCSV.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        ستون معنی فارسی (پشت)
                      </label>
                      <select
                        value={effectiveMapping.backIndex}
                        onChange={(e) =>
                          setCustomMapping({
                            ...effectiveMapping,
                            backIndex: Number(e.target.value),
                          })
                        }
                        className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {parsedCSV.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        دسته‌بندی پیش‌فرض
                      </label>
                      <input
                        type="text"
                        value={csvDefaultCategory}
                        onChange={(e) => setCsvDefaultCategory(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      پیش‌نمایش قبل از ورود ({formatPersianNumber(csvPreview.length)} ردیف معتبر)
                    </span>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span>نادیده گرفتن لغات تکراری</span>
                    </label>
                  </div>

                  <div className="max-h-52 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-right text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 font-semibold">لغت</th>
                          <th className="px-3 py-2 font-semibold">معنی</th>
                          <th className="px-3 py-2 font-semibold">دسته‌بندی</th>
                          <th className="px-3 py-2 font-semibold">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {csvPreview.slice(0, 50).map((item, idx) => (
                          <tr key={idx} className="bg-white dark:bg-slate-900">
                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100" dir="ltr">
                              {item.front}
                            </td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{item.back}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{item.category}</td>
                            <td className="px-3 py-2">
                              {item.isDuplicate ? (
                                <span className="text-amber-600 dark:text-amber-400">تکراری</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400">جدید</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importNotice && (
                <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {importNotice}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSetShowCSVModal(false)}
                className="min-h-[42px] rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                بستن
              </button>
              <button
                type="button"
                disabled={csvPreview.filter((p) => !skipDuplicates || !p.isDuplicate).length === 0}
                onClick={handleConfirmCSVImport}
                className="min-h-[42px] rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                تأیید و ورود به جعبه لایتنر (
                {formatPersianNumber(
                  csvPreview.filter((p) => !skipDuplicates || !p.isDuplicate).length
                )}
                )
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
