import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../services/aiService';
import { MODE_COLORS, MODES } from '../constants/modes';
import { useLanguage } from '../context/LanguageContext';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../services/voiceService';

interface MessageBubbleProps {
  message: Message;
  isLatest?: boolean;
  isStreaming?: boolean;
}

function detectScamRisk(content: string): 'Low' | 'Medium' | 'High' | null {
  // Strip markdown bold, italic, list markers for cleaner matching
  const stripped = content
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^\s*\d+[.)]\s*/gm, '');

  // Build a robust extractor for the explicit "Risk Level: X" line.
  // We don't rely on strict separators — emojis or other chars may appear between
  // "Risk Level:" and the level word. Capture the FIRST level word found.
  const explicitMatch = stripped.match(
    /risk\s*level[^a-zA-Z0-9]{0,20}(low|medium|high)\b/i
  );
  if (explicitMatch) {
    const level = explicitMatch[1].toLowerCase();
    if (level === 'high') return 'High';
    if (level === 'medium') return 'Medium';
    if (level === 'low') return 'Low';
  }

  // Standalone verdict line: "**HIGH RISK**", "🚨 HIGH RISK", "LOW RISK", etc.
  // Must be at line start (after list-number stripping), short declaration.
  const verdictMatch = stripped.match(
    /(?:^|\n)\s*(?:🚨|⚠️|✅)?\s*(high|medium|low)\s*risk\b/i
  );
  if (verdictMatch) {
    const level = verdictMatch[1].toLowerCase();
    if (level === 'high') return 'High';
    if (level === 'medium') return 'Medium';
    if (level === 'low') return 'Low';
  }

  // No reliable risk signal — don't guess
  return null;
}

const ScamRiskBar: React.FC<{ level: 'Low' | 'Medium' | 'High' }> = ({ level }) => {
  const configs = {
    Low: {
      label: '✅ LOW RISK',
      labelNe: 'कम जोखिम',
      width: '20%',
      color: '#10b981',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#065f46',
      desc: 'Appears relatively safe',
    },
    Medium: {
      label: '⚠️ MEDIUM RISK',
      labelNe: 'मध्यम जोखिम',
      width: '58%',
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#78350f',
      desc: 'Proceed with caution',
    },
    High: {
      label: '🚨 HIGH RISK',
      labelNe: 'उच्च जोखिम — ठगी हुन सक्छ!',
      width: '94%',
      color: '#ef4444',
      bg: '#fff1f2',
      border: '#fecdd3',
      text: '#881337',
      desc: 'Likely a SCAM — Do NOT proceed!',
    },
  };

  const c = configs[level];

  return (
    <div
      className="rounded-xl border-2 p-3.5 mb-3"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-bold" style={{ color: c.text }}>
            {c.label}
          </span>
          <span className="text-xs ml-2 opacity-70" style={{ color: c.text }}>
            {c.labelNe}
          </span>
        </div>
        <div
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: c.color }}
        />
      </div>
      <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: c.width, backgroundColor: c.color }}
        />
      </div>
      <p className="text-xs font-semibold" style={{ color: c.text }}>
        {c.desc}
      </p>
    </div>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLatest, isStreaming }) => {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { t } = useLanguage();
  const isUser = message.role === 'user';
  const colors = MODE_COLORS[message.mode];
  const modeInfo = MODES.find((m) => m.id === message.mode);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }

    const started = speakText(message.content);
    if (!started) return;
    setSpeaking(true);
    window.setTimeout(() => setSpeaking(false), Math.min(30000, Math.max(3000, message.content.length * 65)));
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const scamRisk =
    message.mode === 'scam' && !isUser ? detectScamRisk(message.content) : null;

  // Don't render empty assistant messages (streaming placeholder)
  if (!isUser && message.content === '' && !isStreaming) {
    return null;
  }

  if (isUser) {
    const doc = message.metadata?.document;
    const isDocument = !!doc;
    // For document messages, the optional user note lives in displayContent.
    // Don't dump the giant extracted-text prompt (message.content) into the bubble.
    const shownContent = isDocument
      ? message.displayContent || ''
      : message.displayContent || message.content;

    const docIcon = (type?: string) => {
      switch (type) {
        case 'pdf':
          return '📄';
        case 'docx':
          return '📝';
        case 'image':
          return '🖼️';
        case 'txt':
          return '📃';
        default:
          return '📎';
      }
    };

    return (
      <div className="flex justify-end mb-5 group animate-fadeIn">
        <div className="max-w-[80%] lg:max-w-[65%]">
          {/* Attachment card — shows the uploaded file just like ChatGPT */}
          {isDocument && (
            <div className="mb-2 flex items-center gap-3 px-3 py-2.5 rounded-2xl rounded-tr-sm bg-white border border-gray-200 shadow-sm">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #4b556315, #6b728015)' }}
              >
                {docIcon(doc?.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{doc?.name}</p>
                <p className="text-xs text-gray-500">
                  {(doc?.type || 'file').toUpperCase()}
                  {doc?.pageCount ? ` · ${doc.pageCount} page${doc.pageCount !== 1 ? 's' : ''}` : ''}
                  {typeof doc?.wordCount === 'number'
                    ? ` · ${doc.wordCount.toLocaleString()} ${t('words', 'शब्दहरू')}`
                    : ''}
                  {doc?.extractionMethod === 'ocr' ? ' · OCR' : ''}
                </p>
              </div>
            </div>
          )}

          {shownContent && (
            <div
              className="px-4 py-3 rounded-2xl rounded-tr-sm text-white text-sm leading-relaxed shadow-lg"
              style={{
                background: isDocument
                  ? `linear-gradient(135deg, #4b5563, #6b7280)`
                  : `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              }}
            >
              <p
                className="whitespace-pre-wrap break-words"
                style={{ fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif" }}
              >
                {shownContent}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 mt-1 px-1">
            <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
            <svg
              className="w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 mb-5 group ${isLatest ? 'animate-fadeIn' : ''}`}>
      {/* AI Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md border"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}15, ${colors.secondary}15)`,
            borderColor: `${colors.primary}30`,
          }}
        >
          {modeInfo?.icon || '🤖'}
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 max-w-[88%] lg:max-w-[78%]">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full border"
            style={{
              color: colors.primary,
              backgroundColor: `${colors.primary}10`,
              borderColor: `${colors.primary}25`,
            }}
          >
            Sewa AI · {modeInfo?.label}
          </span>
          <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
        </div>

        {/* Scam Risk Visual (before the text) */}
        {scamRisk && <ScamRiskBar level={scamRisk} />}

        {/* Message Bubble */}
        <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-4">
            <div
              className="prose prose-sm max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h1:text-base prose-h1:mb-2
                prose-h2:text-sm prose-h2:mb-1.5 prose-h2:mt-3
                prose-h3:text-sm prose-h3:mb-1 prose-h3:mt-2.5
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-2
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:text-gray-700
                prose-code:text-xs prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-gray-800 prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-gray-900 prose-pre:rounded-xl prose-pre:text-xs prose-pre:overflow-x-auto
                prose-blockquote:border-l-4 prose-blockquote:border-gray-200 prose-blockquote:text-gray-600 prose-blockquote:italic prose-blockquote:my-3
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-hr:border-gray-100 prose-hr:my-3
                prose-table:text-xs prose-th:text-gray-800 prose-th:font-semibold prose-td:text-gray-700 prose-th:py-2 prose-td:py-1.5"
              style={{ fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif" }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {/* Streaming cursor */}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-gray-800 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50/60 border-t border-gray-100">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-white transition-all duration-200 border border-transparent hover:border-gray-200"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-600 font-medium">{t('Copied!', 'प्रतिलिपि गरियो!')}</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('Copy response', 'प्रतिक्रिया प्रतिलिपि गर्नुहोस्')}
                </>
              )}
            </button>

            {isSpeechSynthesisSupported() && (
              <button
                onClick={handleSpeak}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-white transition-all duration-200 border border-transparent hover:border-gray-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5L6 9H3v6h3l5 4V5zm5.5 3.5a5 5 0 010 7M19 6a8 8 0 010 12" />
                </svg>
                {speaking ? t('Stop voice', 'आवाज रोक्नुहोस्') : t('Listen', 'सुन्नुहोस्')}
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>AI • Sewa AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Typing indicator component
export const TypingIndicator: React.FC<{ mode: string }> = ({ mode }) => {
  const modeInfo = MODES.find((m) => m.id === mode);
  const colors = MODE_COLORS[mode as keyof typeof MODE_COLORS] || MODE_COLORS.general;

  return (
    <div className="flex gap-3 mb-5 animate-fadeIn">
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md border"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}15, ${colors.secondary}15)`,
            borderColor: `${colors.primary}30`,
          }}
        >
          {modeInfo?.icon || '🤖'}
        </div>
      </div>
      <div>
        <div className="mb-1.5">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full border"
            style={{
              color: colors.primary,
              backgroundColor: `${colors.primary}10`,
              borderColor: `${colors.primary}25`,
            }}
          >
            Sewa AI · {modeInfo?.label}
          </span>
        </div>
        <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 150, 300].map((delay, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: colors.primary,
                    animationDelay: `${delay}ms`,
                    animationDuration: '0.9s',
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">Analyzing & crafting response...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
