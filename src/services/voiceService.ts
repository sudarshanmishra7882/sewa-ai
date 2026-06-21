import { detectLanguage } from './aiService';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const NEPALI_RECOGNITION_LANGS = ['ne-NP', 'ne', 'hi-IN'];
const ENGLISH_RECOGNITION_LANGS = ['en-IN', 'en-US', 'en-GB'];
const NON_FATAL_RECOGNITION_ERRORS = new Set(['no-speech', 'aborted']);
// Broad emoji + pictographic + symbol coverage so nothing gets spelled out.
const EMOJI_AND_SYMBOL_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}\u{2122}\u{2139}\u{2049}\u{203C}]/gu;
const TTS_SECTION_LABELS = /\b(Document Type|Extracted Content|Explanation|Purpose|Notes|Risk Level|Verdict|Evidence Analysis|Red Flags Found|Recommendation|Sources?)\s*:?/gi;
const DEVANAGARI_CHAR_MAP: Record<string, string> = {
  '0': '०',
  '1': '१',
  '2': '२',
  '3': '३',
  '4': '४',
  '5': '५',
  '6': '६',
  '7': '७',
  '8': '८',
  '9': '९',
};

const ROMANIZED_NEPALI_PHRASES: Array<[RegExp, string]> = [
  [/\bnamaste\b/gi, 'नमस्ते'],
  [/\bmero\b/gi, 'मेरो'],
  [/\btimro\b/gi, 'तिम्रो'],
  [/\bnepal\b/gi, 'नेपाल'],
  [/\bnepali\b/gi, 'नेपाली'],
  [/\bsewa\b/gi, 'सेवा'],
  [/\bseva\b/gi, 'सेवा'],
  [/\bnagarikta\b/gi, 'नागरिकता'],
  [/\brahadani\b/gi, 'राहदानी'],
  [/\bpassport\b/gi, 'पासपोर्ट'],
  [/\blicense\b/gi, 'लाइसेन्स'],
  [/\blalpurja\b/gi, 'लालपुर्जा'],
  [/\bnamsari\b/gi, 'नामसारी'],
  [/\blok\s*sewa\b/gi, 'लोक सेवा'],
  [/\bkati\b/gi, 'कति'],
  [/\bkasari\b/gi, 'कसरी'],
  [/\bkaha\b/gi, 'कहाँ'],
  [/\bkahile\b/gi, 'कहिले'],
  [/\bke\b/gi, 'के'],
  [/\bho\b/gi, 'हो'],
  [/\bcha\b/gi, 'छ'],
  [/\bchha\b/gi, 'छ'],
  [/\bgarne\b/gi, 'गर्ने'],
  [/\bgarnu\b/gi, 'गर्नु'],
  [/\bparcha\b/gi, 'पर्छ'],
  [/\bparchha\b/gi, 'पर्छ'],
  [/\bmalai\b/gi, 'मलाई'],
  [/\btapaiko\b/gi, 'तपाईंको'],
  [/\btapai\b/gi, 'तपाईं'],
  [/\bhajur\b/gi, 'हजुर'],
  [/\bdai\b/gi, 'दाइ'],
  [/\bdidi\b/gi, 'दिदी'],
  [/\bbuwa\b/gi, 'बुबा'],
  [/\baama\b/gi, 'आमा'],
  [/\bghar\b/gi, 'घर'],
  [/\bpaisa\b/gi, 'पैसा'],
  [/\bsulka\b/gi, 'शुल्क'],
  [/\bshulka\b/gi, 'शुल्क'],
  [/\bform\b/gi, 'फारम'],
  [/\babedan\b/gi, 'आवेदन'],
  [/\bawedan\b/gi, 'आवेदन'],
  [/\bkagaj\b/gi, 'कागज'],
  [/\bkagajat\b/gi, 'कागजात'],
  [/\bpramanpatra\b/gi, 'प्रमाणपत्र'],
  [/\bsifaris\b/gi, 'सिफारिस'],
  [/\bward\b/gi, 'वडा'],
  [/\bwada\b/gi, 'वडा'],
  [/\bpalika\b/gi, 'पालिका'],
  [/\bbhanchha\b/gi, 'भन्छ'],
  [/\bbhancha\b/gi, 'भन्छ'],
  [/\bchaheko\b/gi, 'चाहेको'],
  [/\bchahiyo\b/gi, 'चाहियो'],
  [/\bchaincha\b/gi, 'चाहिन्छ'],
  [/\bchainchha\b/gi, 'चाहिन्छ'],
  [/\baba\b/gi, 'अब'],
  [/\baile\b/gi, 'अहिले'],
];

interface SpeakOptions {
  language?: 'en' | 'ne';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export interface VoiceRecognitionSession {
  stop: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function normalizeNepaliTranscript(text: string): string {
  let normalized = text.replace(/[0-9]/g, (digit) => DEVANAGARI_CHAR_MAP[digit] || digit);
  for (const [pattern, replacement] of ROMANIZED_NEPALI_PHRASES) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

export function startVoiceRecognition(options: {
  language: 'en' | 'ne';
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}): VoiceRecognitionSession | null {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) {
    options.onError?.('Voice input is not supported in this browser. Try Chrome or Edge.');
    return null;
  }

  const recognition: SpeechRecognitionLike = new Recognition();
  recognition.lang = options.language === 'ne' ? NEPALI_RECOGNITION_LANGS[0] : ENGLISH_RECOGNITION_LANGS[0];
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  let finalText = '';
  let active = true;

  recognition.onresult = (event: any) => {
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) {
        finalText += text;
      } else {
        interimText += text;
      }
    }
    const transcript = (finalText || interimText).trim();
    options.onTranscript(options.language === 'ne' ? normalizeNepaliTranscript(transcript) : transcript);
  };

  recognition.onerror = (event: any) => {
    if (NON_FATAL_RECOGNITION_ERRORS.has(event?.error)) return;

    active = false;

    const reason = event?.error === 'not-allowed'
      ? 'Microphone permission was blocked.'
      : options.language === 'ne'
      ? 'Nepali voice could not be understood. Please speak clearly in Nepali, or try Chrome/Edge with Nepali speech support.'
      : 'Could not understand voice input. Please try again.';
    options.onError?.(reason);
  };

  recognition.onend = () => {
    if (active) {
      window.setTimeout(() => {
        try {
          if (active) recognition.start();
        } catch {
          active = false;
          options.onEnd?.();
        }
      }, 150);
      return;
    }

    options.onEnd?.();
  };

  recognition.start();
  return {
    stop: () => {
      active = false;
      recognition.stop();
    },
  };
}

export function getBestNepaliVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const scored = voices
    .map((voice) => ({ voice, score: scoreNepaliVoice(voice) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.voice || null;
}

// Names of well-known natural South-Asian neural voices (Microsoft/Google).
const PREFERRED_NEPALI_VOICE_NAMES = ['hemkala', 'sagar']; // Microsoft Nepali (ne-NP)
const PREFERRED_HINDI_VOICE_NAMES = ['swara', 'madhur', 'kalpana', 'hemant', 'lekha']; // Microsoft/Google Hindi

function scoreNepaliVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  let score = 0;

  // Priority: true Nepali → Hindi (closest accent) → Indian English.
  if (lang === 'ne-np') score += 120;
  else if (lang.startsWith('ne')) score += 110;
  else if (name.includes('nepali') || name.includes('nepal')) score += 100;
  else if (lang === 'hi-in') score += 70;
  else if (lang.startsWith('hi')) score += 60;
  else if (name.includes('hindi') || name.includes('india') || name.includes('indian')) score += 50;
  else if (lang === 'en-in') score += 35;
  else return 0;

  // Reward known natural/neural voices for a smoother human-like sound.
  if (PREFERRED_NEPALI_VOICE_NAMES.some((n) => name.includes(n))) score += 25;
  if (PREFERRED_HINDI_VOICE_NAMES.some((n) => name.includes(n))) score += 15;
  if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 12;

  if (voice.localService) score += 6;
  if (name.includes('google')) score += 8;
  if (name.includes('microsoft')) score += 6;
  // Penalize obviously American/Western voices that ruin the accent.
  if (name.includes('zira') || name.includes('david') || name.includes('mark')) score -= 30;

  return score;
}

export function warmUpVoices(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.getVoices();
}

export function waitForVoices(timeout = 800): Promise<void> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeout);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timer);
      resolve();
    };
  });
}

export function hasNativeNepaliVoice(): boolean {
  const voice = getBestNepaliVoice();
  if (!voice) return false;
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  return lang.startsWith('ne') || name.includes('nepali') || name.includes('nepal');
}

function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const scored = voices
    .map((voice) => ({ voice, score: scoreEnglishVoice(voice) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.voice || null;
}

// Preferred Indian-English neural voices for a South-Asian accent.
const PREFERRED_INDIAN_ENGLISH_VOICE_NAMES = ['neerja', 'prabhat', 'ravi', 'aarav', 'ananya'];

function scoreEnglishVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  let score = 0;

  // Priority for a Nepali-sounding English accent:
  // Indian English → Nepali/Hindi voice reading English → British → other English.
  if (lang === 'en-in') score += 120;
  else if (name.includes('india') || name.includes('indian')) score += 110;
  else if (lang === 'ne-np' || lang.startsWith('ne')) score += 80; // Nepali voice can read English with native accent
  else if (lang === 'hi-in' || lang.startsWith('hi')) score += 70; // Hindi accent is close to Nepali
  else if (lang === 'en-gb') score += 45;
  else if (lang.startsWith('en')) score += 30;
  else return 0;

  if (PREFERRED_INDIAN_ENGLISH_VOICE_NAMES.some((n) => name.includes(n))) score += 20;
  if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 12;

  if (voice.localService) score += 6;
  if (name.includes('google')) score += 8;
  if (name.includes('microsoft')) score += 6;
  // Push American voices to the bottom so English doesn't sound US-accented.
  if (lang === 'en-us') score -= 25;
  if (name.includes('zira') || name.includes('david') || name.includes('mark')) score -= 30;

  return score;
}

function cleanSpeechText(text: string): string {
  return (
    text
      // Code blocks and inline code
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      // Markdown image: drop entirely
      .replace(/!\[[^\]]*\]\([^\)]+\)/g, ' ')
      // Markdown link [label](url): keep only the label
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // URLs
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/www\.\S+/g, ' ')
      // Remove emojis/pictographs/symbols BEFORE other cleanup so they are
      // never read aloud or spelled out.
      .replace(EMOJI_AND_SYMBOL_PATTERN, ' ')
      // Drop content inside brackets/parentheses/braces so asides aren't spoken.
      // Run twice to handle simple nesting like ([...]).
      .replace(/[\[\(\{][^\[\]\(\)\{\}]*[\]\)\}]/g, ' ')
      .replace(/[\[\(\{][^\[\]\(\)\{\}]*[\]\)\}]/g, ' ')
      // Any stray unmatched bracket chars left over
      .replace(/[\[\]\(\)\{\}]/g, ' ')
      // Friendly section labels: keep word, add a pause
      .replace(TTS_SECTION_LABELS, '$1. ')
      // List markers at line start
      .replace(/^\s*[-*+>]\s+/gm, ' ')
      .replace(/^\s*\d+[.)]\s+/gm, ' ')
      // Remaining markdown / structural symbols that would be spelled out
      .replace(/[#*_~^|<>=\\/`@&$%+]+/g, ' ')
      // Quotes and dashes
      .replace(/["“”‘’]+/g, ' ')
      .replace(/[—–]+/g, ' ')
      // Collapse leftover punctuation runs (e.g. ":::", "...") to a single pause
      .replace(/[;:]+/g, ', ')
      // Tidy spaces before sentence enders
      .replace(/\s+([।.!?,])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function hasSubstantialDevanagari(text: string): boolean {
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  return devanagariCount > 0 && devanagariCount >= latinCount * 0.25;
}

function splitForNaturalSpeech(text: string, preferredLanguage: 'en' | 'ne'): Array<{ text: string; language: 'en' | 'ne' }> {
  const sentences = cleanSpeechText(text).match(/[^।.!?]+[।.!?]?/g) || [cleanSpeechText(text)];

  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => ({
      text: sentence,
      language: preferredLanguage === 'ne' || hasSubstantialDevanagari(sentence) ? 'ne' : 'en',
    }));
}

function speakChunks(chunks: Array<{ text: string; language: 'en' | 'ne' }>, options?: SpeakOptions): boolean {
  if (chunks.length === 0) return false;

  let index = 0;
  let started = false;

  const speakNext = () => {
    const chunk = chunks[index];
    if (!chunk) {
      options?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const voice = chunk.language === 'ne' ? getBestNepaliVoice() : getBestEnglishVoice();

    if (voice) {
      utterance.voice = voice;
      // Use the chosen voice's own language so a Hindi/Nepali voice keeps its
      // native accent even when reading English text. Falling back to a sensible
      // South-Asian locale when the voice has no lang.
      utterance.lang = voice.lang || (chunk.language === 'ne' ? 'ne-NP' : 'en-IN');
    } else {
      utterance.lang = chunk.language === 'ne' ? 'ne-NP' : 'en-IN';
    }
    // Comfortable, clearly understandable speed — slightly above the default
    // (1.0) for a natural pace without being too slow or too fast.
    utterance.rate = chunk.language === 'ne' ? 1.0 : 1.05;
    utterance.pitch = chunk.language === 'ne' ? 1.0 : 1.02;
    utterance.volume = 1;
    utterance.onstart = () => {
      if (!started) {
        started = true;
        options?.onStart?.();
      }
    };
    utterance.onend = () => {
      index += 1;
      speakNext();
    };
    utterance.onerror = () => {
      options?.onError?.();
      options?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();
  return true;
}

export function speakText(text: string, preferredLanguageOrOptions?: 'en' | 'ne' | SpeakOptions): boolean {
  if (!isSpeechSynthesisSupported()) return false;

  window.speechSynthesis.cancel();

  const options = typeof preferredLanguageOrOptions === 'object' ? preferredLanguageOrOptions : undefined;
  const preferredLanguage = typeof preferredLanguageOrOptions === 'string' ? preferredLanguageOrOptions : options?.language;
  const language = preferredLanguage || (detectLanguage(text) === 'ne' ? 'ne' : 'en');
  const chunks = splitForNaturalSpeech(text, language);
  return speakChunks(chunks, options);
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Creates a streaming TTS session that speaks sentences as they arrive.
 * Call `pushToken(token)` for each streaming token.
 * Call `flush()` when the stream ends to speak any remaining partial sentence.
 * Call `cancel()` to stop immediately.
 *
 * Returns an object with { pushToken, flush, cancel }.
 */
export function createStreamingSpeaker(options?: SpeakOptions): {
  pushToken: (token: string) => void;
  flush: () => void;
  cancel: () => void;
} {
  if (!isSpeechSynthesisSupported()) {
    return { pushToken: () => {}, flush: () => {}, cancel: () => {} };
  }

  const language = options?.language ?? 'en';
  let buffer = '';
  let started = false;
  let cancelled = false;

  // Sentence-ending characters (same as splitForNaturalSpeech)
  const SENTENCE_END = /[।.!?]/;

  function speakSentence(text: string) {
    const cleaned = cleanSpeechText(text).trim();
    if (!cleaned) return;

    const lang: 'en' | 'ne' =
      language === 'ne' || hasSubstantialDevanagari(cleaned) ? 'ne' : 'en';

    const utterance = new SpeechSynthesisUtterance(cleaned);
    const voice = lang === 'ne' ? getBestNepaliVoice() : getBestEnglishVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || (lang === 'ne' ? 'ne-NP' : 'en-IN');
    } else {
      utterance.lang = lang === 'ne' ? 'ne-NP' : 'en-IN';
    }

    utterance.rate = lang === 'ne' ? 1.0 : 1.05;
    utterance.pitch = lang === 'ne' ? 1.0 : 1.02;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (!started) {
        started = true;
        options?.onStart?.();
      }
    };

    // onEnd is only fired on the very last utterance — handled in flush()
    window.speechSynthesis.speak(utterance);
  }

  function pushToken(token: string) {
    if (cancelled) return;
    buffer += token;

    // Extract and speak all complete sentences from the buffer
    let lastEnd = -1;
    for (let i = 0; i < buffer.length; i++) {
      if (SENTENCE_END.test(buffer[i])) {
        lastEnd = i;
      }
    }

    if (lastEnd >= 0) {
      const toSpeak = buffer.slice(0, lastEnd + 1);
      buffer = buffer.slice(lastEnd + 1);
      speakSentence(toSpeak);
    }
  }

  function flush() {
    if (cancelled) return;
    // Speak any remaining text that didn't end with punctuation
    if (buffer.trim()) {
      const cleaned = cleanSpeechText(buffer).trim();
      if (cleaned) {
        const lang: 'en' | 'ne' =
          language === 'ne' || hasSubstantialDevanagari(cleaned) ? 'ne' : 'en';

        const utterance = new SpeechSynthesisUtterance(cleaned);
        const voice = lang === 'ne' ? getBestNepaliVoice() : getBestEnglishVoice();
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || (lang === 'ne' ? 'ne-NP' : 'en-IN');
        } else {
          utterance.lang = lang === 'ne' ? 'ne-NP' : 'en-IN';
        }
        utterance.rate = lang === 'ne' ? 1.0 : 1.05;
        utterance.pitch = lang === 'ne' ? 1.0 : 1.02;
        utterance.volume = 1;
        utterance.onstart = () => {
          if (!started) {
            started = true;
            options?.onStart?.();
          }
        };
        utterance.onend = () => {
          options?.onEnd?.();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        // Nothing left to speak — fire onEnd now
        if (started) options?.onEnd?.();
      }
      buffer = '';
    } else {
      // Buffer was empty — queue a silent utterance so onEnd fires after all
      // previously queued utterances have finished playing.
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      silent.onend = () => options?.onEnd?.();
      window.speechSynthesis.speak(silent);
    }
  }

  function cancel() {
    cancelled = true;
    window.speechSynthesis.cancel();
    options?.onEnd?.();
  }

  return { pushToken, flush, cancel };
}
