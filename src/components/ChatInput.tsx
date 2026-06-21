import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AIMode } from '../services/aiService';
import { MODE_COLORS, MODES, QUICK_PROMPTS } from '../constants/modes';
import { FileUpload } from './FileUpload';
import { VoiceOverlay } from './VoiceOverlay';
import { ProcessedDocument } from '../services/documentProcessor';
import { useLanguage } from '../context/LanguageContext';
import {
  hasNativeNepaliVoice,
  isSpeechRecognitionSupported,
  startVoiceRecognition,
  VoiceRecognitionSession,
} from '../services/voiceService';

type ToastType = 'success' | 'error' | 'info' | 'warning';
const VOICE_SILENCE_TIMEOUT_MS = 1000;

interface ChatInputProps {
  mode: AIMode;
  onSendMessage: (message: string, displayMessage?: string, docMeta?: any) => void;
  onAnalyzeDocument?: (documentPrompt: string, displayMessage: string, docMeta: any) => void;
  onRequestUpload?: (userText: string) => void;
  isLoading: boolean;
  onAbort: () => void;
  onVoiceMessage?: (message: string) => void;
  addToast?: (message: string, type?: ToastType) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  mode,
  onSendMessage,
  onAnalyzeDocument,
  onRequestUpload,
  isLoading,
  onAbort,
  onVoiceMessage,
  addToast,
}) => {
  const [input, setInput] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [attachedDoc, setAttachedDoc] = useState<ProcessedDocument | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<VoiceRecognitionSession | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const voiceTranscriptRef = useRef('');
  const colors = MODE_COLORS[mode];
  const modeInfo = MODES.find((m) => m.id === mode);
  const { uiLanguage, t } = useLanguage();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const buildDocumentAnalysisPrompt = (doc: ProcessedDocument, userNote: string): string => {
    const extractionNote =
      doc.extractionStatus === 'partial'
        ? '\nNOTE: This document was partially extracted. Some text may be missing. Analyze only what is available and clearly state what is unreadable.'
        : '';

    const hasRealContent = doc.extractedText && doc.extractedText.length > 30;

    // Build a strictly self-contained message: the user message IS the document.
    const prompt = `${hasRealContent ? '[DOCUMENT CONTENT BEGINS BELOW]' : ''}

DOCUMENT FILE NAME: ${doc.name}
DOCUMENT TYPE: ${doc.type.toUpperCase()}${doc.pageCount ? `\nPAGE COUNT: ${doc.pageCount}` : ''}
WORD COUNT: ${doc.wordCount}
EXTRACTION METHOD: ${doc.extractionMethod}${doc.isScanned ? ' (scanned/image document)' : ''}${extractionNote}

===== EXTRACTED DOCUMENT TEXT =====
${hasRealContent ? doc.extractedText : '[The document was uploaded but no readable text could be extracted. It may be a heavily scanned image, encrypted, or in an unsupported format. Please upload a clearer version or paste the document text directly.]'}
===== END OF EXTRACTED DOCUMENT TEXT =====

${userNote ? `USER'S QUESTION ABOUT THIS DOCUMENT: ${userNote}\n\n` : ''}INSTRUCTIONS FOR ANALYZING THIS DOCUMENT:
You are a precise document reader. Read the EXTRACTED DOCUMENT TEXT above as if you were holding the actual document.

- Base your entire analysis ONLY on the extracted text above.
- DO NOT use any prior knowledge about Nepal, government procedures, PAN, VAT, land registration, citizenship, or anything else UNLESS those exact words appear in the extracted text.
- DO NOT hallucinate fields, names, numbers, dates, signatures, government agencies, or procedures.
- DO NOT describe the document as a "knowledge base", "reference guide", or "system prompt".
- If the document is a citizenship certificate, identity card, license, bank letter, or any real document, ONLY describe fields you can clearly see in the extracted text.
- If the extracted text is empty or garbled, say: "The document could not be properly extracted. Please upload a clearer version."

RESPOND IN THIS EXACT FORMAT:
**📄 Document Type**: What this document appears to be (only if clearly identifiable; otherwise say "Unclear from document").

**🔍 Extracted Content**: List ONLY the actual fields, names, numbers, dates, places, amounts, and reference IDs visible in the document. If none are readable, say "No readable fields found."

**🧾 Explanation**: Simple explanation based ONLY on the extracted content above.

**🎯 Purpose**: Likely purpose of this document based only on what is visible.

**⚠️ Notes**: Any unreadable, blurry, missing, or unclear portions.

Provide a thorough, well-structured response. Be specific. Be honest about what you can and cannot see.`;

    return prompt;
  };

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();

    // Document mode: enforce that a document must be attached for vague/analyze queries.
    // Show the user's typed text in their own bubble, but inject a clean assistant
    // response asking them to upload a document — do NOT send the system note to the AI.
    if (mode === 'document' && !attachedDoc) {
      const vaguePattern =
        /^(what\s*(is|'?s)?\s*(this|it|that|the\s+doc|this\s+doc)|explain|describe|analyze|analyse|summarize|what\s+does|what\s+do|identify|read\s+this|help\s+with\s+this|info\s+about\s+this|tell\s+me\s+about)\s*[?.!]?$/i;
      if (vaguePattern.test(trimmed)) {
        // Add a user bubble showing their text + an assistant bubble asking for upload
        if (onRequestUpload) {
          onRequestUpload(trimmed);
        }
        setInput('');
        setShowQuickPrompts(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      }
    }

    if (attachedDoc) {
      // Show a user-friendly toast for failed extractions (do not silently swallow)
      if (attachedDoc.extractionStatus === 'failed') {
        addToast?.(
          attachedDoc.errorMessage ||
            'Could not extract text from this file. Please try a clearer scan.',
          'warning'
        );
        // Don't send failed documents to AI
        setAttachedDoc(null);
        setShowUpload(false);
        return;
      }

      // The attachment card in the message bubble now shows the file details,
      // so displayContent only needs the user's optional question (if any).
      const displayMessage = trimmed;
      const fullPrompt = buildDocumentAnalysisPrompt(attachedDoc, trimmed);
      const docMeta = {
        document: {
          name: attachedDoc.name,
          type: attachedDoc.type,
          pageCount: attachedDoc.pageCount,
          wordCount: attachedDoc.wordCount,
          extractionMethod: attachedDoc.extractionMethod,
          extractionStatus: attachedDoc.extractionStatus,
        },
      };

      // Prefer the dedicated document analysis path which bypasses
      // knowledge base / officials / web search entirely.
      if (onAnalyzeDocument) {
        onAnalyzeDocument(fullPrompt, displayMessage, docMeta);
      } else {
        onSendMessage(fullPrompt, displayMessage, docMeta);
      }

      setInput('');
      setAttachedDoc(null);
      setShowUpload(false);
      setShowQuickPrompts(false);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput('');
    setShowQuickPrompts(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, attachedDoc, onSendMessage, t, uiLanguage, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) handleSubmit();
    }
  };

  const handleDocumentProcessed = (doc: ProcessedDocument) => {
    setAttachedDoc(doc);
    setShowUpload(false);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    setShowQuickPrompts(false);
    textareaRef.current?.focus();
  };

  const handleVoiceInput = () => {
    if (isListening) {
      clearSilenceTimer();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceStatus('');
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      addToast?.('Voice input needs Chrome or Edge browser support.', 'warning');
      return;
    }

    setIsListening(true);
    voiceTranscriptRef.current = '';
    setVoiceStatus(uiLanguage === 'ne' ? 'नेपाली आवाज सुन्दैछ...' : 'Listening for voice...');
    recognitionRef.current = startVoiceRecognition({
      language: uiLanguage === 'ne' ? 'ne' : 'en',
      onTranscript: (text) => {
        if (text) {
          setInput(text);
          setVoiceStatus(text);
          voiceTranscriptRef.current = text;

          clearSilenceTimer();
          silenceTimerRef.current = window.setTimeout(() => {
            const transcript = voiceTranscriptRef.current.trim();
            if (!transcript || isLoading) return;

            recognitionRef.current?.stop();
            recognitionRef.current = null;
            setIsListening(false);
            setVoiceStatus('');
            voiceTranscriptRef.current = '';
            setInput('');
            if (onVoiceMessage) {
              onVoiceMessage(transcript);
            } else {
              onSendMessage(transcript);
            }
          }, VOICE_SILENCE_TIMEOUT_MS);
        }
      },
      onError: (message) => addToast?.(message, 'warning'),
      onEnd: () => {
        recognitionRef.current = null;
        setIsListening(false);
        if (!voiceTranscriptRef.current.trim()) setVoiceStatus('');
        textareaRef.current?.focus();
      },
    });
  };

  const quickPrompts = QUICK_PROMPTS[mode] || [];
  const canSend = (input.trim() || attachedDoc?.extractionStatus === 'success') && !isLoading;
  const showDocUpload = mode === 'document' || mode === 'scam' || mode === 'legal';

  const placeholder =
    uiLanguage === 'ne'
      ? modeInfo?.placeholderNe || modeInfo?.placeholder
      : modeInfo?.placeholder;

  return (
    <div className="border-t border-gray-100 bg-white/95 backdrop-blur-md px-4 pt-3 pb-4">
      {isListening && (
        <VoiceOverlay
          mode="listening"
          transcript={voiceStatus}
          onCancel={handleVoiceInput}
        />
      )}

      {/* Quick Prompts Panel */}
      {showQuickPrompts && (
        <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">
            {t('Quick suggestions', 'छिटो सुझावहरू')}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(prompt)}
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left truncate max-w-[200px]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File Upload Panel */}
      {showUpload && showDocUpload && (
        <div className="mb-3">
          <FileUpload onDocumentProcessed={handleDocumentProcessed} mode={mode} />
        </div>
      )}

      {/* Attached Document Badge */}
      {attachedDoc && attachedDoc.extractionStatus !== 'failed' && (
        <div
          className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border"
          style={{ backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}20` }}
        >
          <span className="text-sm">📎</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: colors.primary }}>
              {attachedDoc.name}
            </p>
            <p className="text-xs text-gray-500">
              {attachedDoc.wordCount.toLocaleString()} {t('words', 'शब्दहरू')} •{' '}
              {attachedDoc.extractionMethod === 'ocr' ? 'OCR' : t('text extracted', 'पाठ निकालियो')}
            </p>
          </div>
          <button
            onClick={() => setAttachedDoc(null)}
            className="text-gray-400 hover:text-red-400 text-xs font-medium"
          >
            {t('Remove', 'हटाउनुहोस्')}
          </button>
        </div>
      )}

      {/* Main Input Row */}
      <div
        className="flex items-end gap-2 p-2 rounded-2xl border-2 transition-all duration-200 bg-white shadow-sm"
        style={{ borderColor: `${colors.primary}30` }}
      >
        {/* Left Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 pb-1">
          {/* Quick Prompts */}
          <button
            onClick={() => {
              setShowQuickPrompts(!showQuickPrompts);
              setShowUpload(false);
            }}
            className={`p-2 rounded-xl transition-all duration-200 ${
              showQuickPrompts
                ? 'bg-current/10 text-current'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            style={showQuickPrompts ? { color: colors.primary } : {}}
            title={t('Quick prompts', 'छिटो सुझावहरू')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>

          {/* File Upload */}
          {showDocUpload && (
            <button
              onClick={() => {
                setShowUpload(!showUpload);
                setShowQuickPrompts(false);
              }}
              className={`p-2 rounded-xl transition-all duration-200 ${
                showUpload || attachedDoc
                  ? 'bg-current/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              style={showUpload || attachedDoc ? { color: colors.primary } : {}}
              title={t('Attach file', 'फाइल संलग्न गर्नुहोस्')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          )}

          <button
            onClick={handleVoiceInput}
            disabled={isLoading}
            className={`p-2 rounded-xl transition-all duration-200 ${
              isListening
                ? 'bg-red-50 text-red-500 animate-pulse'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isListening ? t('Stop listening', 'सुन्न बन्द गर्नुहोस्') : t('Voice input', 'आवाजबाट लेख्नुहोस्')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 006.5-6.5M5.5 12a6.5 6.5 0 006.5 6.5m0 0V22m-3 0h6m-3-7a3 3 0 003-3V5a3 3 0 10-6 0v7a3 3 0 003 3z" />
            </svg>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none border-0 outline-none text-gray-800 placeholder-gray-400 text-sm leading-relaxed bg-transparent py-1.5 px-1"
          style={{ maxHeight: '160px', minHeight: '24px' }}
          disabled={isLoading}
        />

        {/* Right Send/Abort Button */}
        <div className="flex-shrink-0 pb-1">
          {isLoading ? (
            <button
              onClick={onAbort}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-95 active:scale-90 shadow-md"
              style={{ backgroundColor: '#ef4444' }}
              title={t('Stop generating', 'उत्पादन रोक्नुहोस्')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h12v12H6z" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
              style={{
                background: canSend
                  ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                  : '#e5e7eb',
                boxShadow: canSend ? `0 4px 14px ${colors.primary}40` : 'none',
              }}
              title={t('Send message', 'सन्देश पठाउनुहोस्')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="flex items-center justify-between mt-2 px-1">
        <p className="text-xs text-gray-400">
          {t('Press', 'थिच्नुहोस्')}{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">Enter</kbd>{' '}
          {t('to send', 'पठाउन')} •{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">Shift+Enter</kbd>{' '}
          {t('for new line', 'नयाँ लाइनको लागि')}
        </p>
        <p className="text-xs text-gray-400 truncate max-w-[45%] text-right">
          {isListening
            ? voiceStatus || t('Listening...', 'सुन्दैछ...')
            : uiLanguage === 'ne' && !hasNativeNepaliVoice()
            ? t('Nepali mic ready; install Nepali system voice for natural playback', 'नेपाली माइक तयार; प्राकृतिक आवाजका लागि नेपाली सिस्टम भ्वाइस थप्नुहोस्')
            : `🇳🇵 ${t('Nepali & English voice', 'नेपाली र अंग्रेजी आवाज')}`}
        </p>
      </div>
    </div>
  );
};
