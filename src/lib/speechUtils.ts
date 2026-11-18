export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function speakText(
  text: string,
  lang: 'en-US' | 'en-GB' | 'fa-IR' = 'en-US',
  rate: number = 0.95
): void {
  if (!isSpeechSynthesisSupported() || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const exactVoice = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
    const prefixVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase())
    );
    if (exactVoice) utterance.voice = exactVoice;
    else if (prefixVoice) utterance.voice = prefixVoice;

    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore playback errors in restricted browsers
  }
}

export function computePronunciationScore(
  targetWord: string,
  spokenTranscript: string
): {
  score: number;
  normalizedTarget: string;
  normalizedSpoken: string;
  feedback: string;
  tier: 'excellent' | 'good' | 'practice';
} {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\u0600-\u06FF0-9\s]/g, '')
      .trim();

  const target = clean(targetWord);
  const spoken = clean(spokenTranscript);

  if (!spoken) {
    return {
      score: 0,
      normalizedTarget: target,
      normalizedSpoken: '',
      feedback: 'صدایی تشخیص داده نشد. نزدیک‌تر به میکروفون صحبت کنید.',
      tier: 'practice',
    };
  }

  if (target === spoken) {
    return {
      score: 100,
      normalizedTarget: target,
      normalizedSpoken: spoken,
      feedback: 'عالی! تلفظ شما کاملاً دقیق و نزدیک به لهجه معیار بود.',
      tier: 'excellent',
    };
  }

  // Check if spoken phrase contains target word directly
  const spokenWords = spoken.split(/\s+/);
  let bestScore = 0;

  for (const w of [spoken, ...spokenWords]) {
    const dist = levenshtein(target, w);
    const maxLen = Math.max(target.length, w.length, 1);
    const sim = Math.round(((maxLen - dist) / maxLen) * 100);
    if (sim > bestScore) bestScore = sim;
  }

  const clamped = Math.max(0, Math.min(100, bestScore));

  if (clamped >= 85) {
    return {
      score: clamped,
      normalizedTarget: target,
      normalizedSpoken: spoken,
      feedback: 'بسیار خوب! تلفظ شفاف و قابل فهم است؛ تنها جزئیات آوایی کوچکی باقی مانده.',
      tier: 'excellent',
    };
  }
  if (clamped >= 60) {
    return {
      score: clamped,
      normalizedTarget: target,
      normalizedSpoken: spoken,
      feedback: 'قابل قبول است؛ یک‌بار به تلفظ استاندارد گوش دهید و روی تکیه صدا (Stress) تمرکز کنید.',
      tier: 'good',
    };
  }
  return {
    score: clamped,
    normalizedTarget: target,
    normalizedSpoken: spoken,
    feedback: 'نیاز به تمرین بیشتر؛ سرعت پخش را روی ۰.۷۵ بگذارید و بخش‌به‌بخش تکرار کنید.',
    tier: 'practice',
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
