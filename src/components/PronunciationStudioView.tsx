import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Play, Square, Volume2 } from 'lucide-react';
import { UserSettings, WordCard } from '../types/leitner';
import { formatPersianNumber, isCardDifficult } from '../lib/leitnerEngine';
import {
  computePronunciationScore,
  isSpeechRecognitionSupported,
  speakText,
} from '../lib/speechUtils';

interface PronunciationStudioViewProps {
  cards: WordCard[];
  settings: UserSettings;
  onSaveScore: (cardId: string, score: number) => void;
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
}

export const PronunciationStudioView: React.FC<PronunciationStudioViewProps> = ({
  cards,
  settings,
  onSaveScore,
  onUpdateSettings,
}) => {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id || '');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [result, setResult] = useState<{
    score: number;
    spoken: string;
    feedback: string;
    tier: 'excellent' | 'good' | 'practice';
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedId) || cards[0],
    [cards, selectedId]
  );

  useEffect(() => {
    return () => {
      stopAllAudioTools();
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAllAudioTools = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsRecording(false);
  };

  const startAnalysis = async () => {
    if (!selectedCard) return;
    setErrorMsg(null);
    setResult(null);

    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);

      // Setup Web Audio API real-time waveform visualizer
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const drawWaveform = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const c2d = canvas.getContext('2d');
        if (!c2d) return;

        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.abs(dataArray[i] - 128);
          sum += val;
        }
        setVolumeLevel(Math.min(100, Math.round((sum / dataArray.length) * 3)));

        c2d.clearRect(0, 0, canvas.width, canvas.height);
        c2d.lineWidth = 2.5;
        c2d.strokeStyle = '#2563eb';
        c2d.beginPath();

        const sliceWidth = canvas.width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) c2d.moveTo(x, y);
          else c2d.lineTo(x, y);
          x += sliceWidth;
        }
        c2d.lineTo(canvas.width, canvas.height / 2);
        c2d.stroke();

        rafRef.current = requestAnimationFrame(drawWaveform);
      };

      drawWaveform();

      // Setup MediaRecorder so user can listen to their own voice
      if (typeof MediaRecorder !== 'undefined') {
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          setRecordedAudioUrl(URL.createObjectURL(blob));
        };
        recorder.start();
      }

      // Setup SpeechRecognition if browser supports it
      if (isSpeechRecognitionSupported()) {
        const win = window as unknown as {
          SpeechRecognition?: new () => {
            lang: string;
            interimResults: boolean;
            onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
            onerror: () => void;
            onend: () => void;
            start: () => void;
            stop: () => void;
          };
          webkitSpeechRecognition?: new () => {
            lang: string;
            interimResults: boolean;
            onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
            onerror: () => void;
            onend: () => void;
            start: () => void;
            stop: () => void;
          };
        };
        const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
        if (SpeechRec) {
          const rec = new SpeechRec();
          recognitionRef.current = rec;
          rec.lang = settings.ttsLang;
          rec.interimResults = false;
          rec.onresult = (e) => {
            const transcript = e.results?.[0]?.[0]?.transcript || '';
            const evalRes = computePronunciationScore(selectedCard.front, transcript);
            setResult({
              score: evalRes.score,
              spoken: evalRes.normalizedSpoken || transcript,
              feedback: evalRes.feedback,
              tier: evalRes.tier,
            });
            onSaveScore(selectedCard.id, evalRes.score);
            stopAllAudioTools();
          };
          rec.onerror = () => {
            stopAllAudioTools();
          };
          rec.onend = () => {
            stopAllAudioTools();
          };
          rec.start();
        }
      }
    } catch {
      setErrorMsg('امکان دسترسی به میکروفون وجود ندارد. لطفاً مجوز میکروفون مرورگر را بررسی کنید.');
      stopAllAudioTools();
    }
  };

  if (!selectedCard) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        ابتدا حداقل یک لغت به بانک لغات اضافه کنید.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl dark:text-slate-50">
            استودیو تحلیل صوتی و بهبود تلفظ
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            مقایسه موج صدا، شنیدن تلفظ استاندارد با سرعت قابل تنظیم، ضبط صدا و امتیازدهی دقیق تلفظ
          </p>
        </div>

        {/* Accent & Speed Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={settings.ttsLang}
            onChange={(e) =>
              onUpdateSettings({ ttsLang: e.target.value as 'en-US' | 'en-GB' })
            }
            aria-label="انتخاب لهجه"
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="en-US">لهجه آمریکایی (US)</option>
            <option value="en-GB">لهجه بریتانیایی (UK)</option>
          </select>

          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[0.75, 0.95, 1.2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onUpdateSettings({ ttsRate: rate })}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition ${
                  settings.ttsRate === rate
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {formatPersianNumber(rate)}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Word List Selector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 text-xs font-bold text-slate-600 dark:text-slate-300">
            انتخاب لغت برای تمرین ({formatPersianNumber(cards.length)})
          </div>
          <div className="max-h-[420px] space-y-1.5 overflow-y-auto pl-1">
            {cards.map((c) => {
              const active = c.id === selectedCard.id;
              const diff = isCardDifficult(c, settings.autoDifficultThreshold);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setResult(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-right transition ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold" dir="ltr">
                      {c.front}
                    </div>
                    <div
                      className={`truncate text-xs ${
                        active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {c.back}
                    </div>
                  </div>
                  <div className="text-left text-xs shrink-0 tabular-nums">
                    {c.pronunciationBestScore !== undefined ? (
                      <span className={active ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}>
                        {formatPersianNumber(c.pronunciationBestScore)}٪
                      </span>
                    ) : diff ? (
                      <span className={active ? 'text-amber-200' : 'text-amber-600'}>دشوار</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Pronunciation Stage */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50" dir="ltr">
                  {selectedCard.front}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  {selectedCard.phonetic && (
                    <span className="font-mono-num" dir="ltr">
                      {selectedCard.phonetic}
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{selectedCard.back}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  speakText(selectedCard.front, settings.ttsLang, settings.ttsRate)
                }
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <Volume2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>پخش تلفظ معیار</span>
              </button>
            </div>

            {/* Waveform Visualizer */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>نمودار موج صوتی زنده (Web Audio)</span>
                <span className="tabular-nums">شدت صدا: {formatPersianNumber(volumeLevel)}٪</span>
              </div>
              <canvas
                ref={canvasRef}
                width={600}
                height={110}
                className="h-28 w-full rounded-xl bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startAnalysis}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  <Mic className="h-5 w-5" />
                  <span>شروع ضبط و تحلیل تلفظ</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopAllAudioTools}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>توقف ضبط</span>
                </button>
              )}

              {recordedAudioUrl && (
                <button
                  type="button"
                  onClick={() => {
                    const audio = new Audio(recordedAudioUrl);
                    audio.play();
                  }}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Play className="h-4 w-4 text-emerald-600" />
                  <span>شنیدن صدای ضبط‌شده خودتان</span>
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            {result && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    نمره تطابق تلفظ:{' '}
                    <span
                      className={`text-lg tabular-nums ${
                        result.tier === 'excellent'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : result.tier === 'good'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {formatPersianNumber(result.score)}٪
                    </span>
                  </div>
                  {result.spoken && (
                    <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                      Transcript: "{result.spoken}"
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  {result.feedback}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
            نکته: در مرورگرهای بدون پشتیبانی از SpeechRecognition، ضبط و بازپخش صدای خودتان همراه با نمودار موج صوتی همچنان به‌صورت ۱۰۰٪ آفلاین کار می‌کند.
          </div>
        </div>
      </div>
    </div>
  );
};
