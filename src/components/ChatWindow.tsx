import React, { useEffect, useRef } from 'react';
import { Message, AIMode } from '../services/aiService';
import { MessageBubble, TypingIndicator } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';
import { ChatInput } from './ChatInput';
import { MODES, MODE_COLORS } from '../constants/modes';
import { useLanguage } from '../context/LanguageContext';

interface ChatWindowProps {
  messages: Message[];
  mode: AIMode;
  isLoading: boolean;
  onSendMessage: (message: string, displayMessage?: string, docMeta?: any) => void;
  onVoiceMessage?: (message: string) => void;
  onAnalyzeDocument?: (documentPrompt: string, displayMessage: string, docMeta: any) => void;
  onRequestUpload?: (userText: string) => void;
  onAbort: () => void;
  onQuickPrompt: (prompt: string) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  mode,
  isLoading,
  onSendMessage,
  onVoiceMessage,
  onAnalyzeDocument,
  onRequestUpload,
  onAbort,
  onQuickPrompt,
  addToast,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const colors = MODE_COLORS[mode];
  const modeInfo = MODES.find((m) => m.id === mode);
  const { uiLanguage, t } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const hasMessages = messages.filter((m) => m.role !== 'system').length > 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Mode Header Bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white/95 backdrop-blur-md flex-shrink-0 shadow-sm"
        style={{ borderBottom: `1px solid ${colors.primary}15` }}
      >
        {/* Mode indicator */}
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
          style={{
            backgroundColor: `${colors.primary}08`,
            borderColor: `${colors.primary}20`,
          }}
        >
          <span className="text-base">{modeInfo?.icon}</span>
          <div>
            <div className="text-xs font-bold leading-none" style={{ color: colors.primary }}>
              {uiLanguage === 'ne' ? modeInfo?.labelNe : modeInfo?.label}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 leading-none">
              {uiLanguage === 'ne' ? modeInfo?.label : modeInfo?.labelNe}
            </div>
          </div>
        </div>

        {/* Sewa AI brand */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-xs text-white font-bold"
            style={{ background: 'linear-gradient(135deg, #dc2626, #1d4ed8)' }}
          >
            स
          </div>
          <span className="text-xs font-semibold text-gray-600">Sewa AI</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Message count */}
        {hasMessages && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {messages.filter((m) => m.role !== 'system').length}
          </div>
        )}

        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          {isLoading ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-600 font-medium hidden sm:block">{t('Processing...', 'प्रशोधन हुँदैछ...')}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-600 font-medium hidden sm:block">{t('Ready', 'तयार')}</span>
            </>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
      >
        {!hasMessages ? (
          <WelcomeScreen mode={mode} onQuickPrompt={onQuickPrompt} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-4">
            {messages
              .filter((m) => m.role !== 'system')
              .map((message, index) => {
                const visibleMessages = messages.filter((m) => m.role !== 'system');
                const isLatestAssistant = message.role === 'assistant' && index === visibleMessages.length - 1;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isLatest={isLatestAssistant}
                    isStreaming={isLatestAssistant && isLoading && message.content.length > 0}
                  />
                );
              })}

            {/* Typing indicator — only show while waiting for first token */}
            {isLoading && !messages.some(m => m.role === 'assistant' && m.content.length > 0) && <TypingIndicator mode={mode} />}

            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0">
        <ChatInput
          mode={mode}
          onSendMessage={onSendMessage}
          onVoiceMessage={onVoiceMessage}
          onAnalyzeDocument={onAnalyzeDocument}
          onRequestUpload={onRequestUpload}
          isLoading={isLoading}
          onAbort={onAbort}
          addToast={addToast}
        />
      </div>
    </div>
  );
};
