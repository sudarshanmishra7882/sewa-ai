import { useState, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { Header } from './components/Header';
import { ToastContainer } from './components/Toast';
import { ModeInfoPanel } from './components/ModeInfoPanel';
import { SplashScreen } from './components/SplashScreen';
import { LanguageToggle } from './components/LanguageToggle';
import { VoiceOverlay } from './components/VoiceOverlay';
import { useLanguage } from './context/LanguageContext';
import {
  AIMode,
  Message,
  sendMessageStream,
  sendMessage,
  generateMessageId,
  generateSessionId,
  ResponseLanguage,
  ApiError,
} from './services/aiService';
import { shouldSearchWeb, searchWeb, formatSearchResultsForPrompt } from './services/webSearch';
import { speakText, stopSpeaking, waitForVoices, warmUpVoices, createStreamingSpeaker } from './services/voiceService';
import { ChatSession } from './types';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

function generateSessionTitle(firstMessage: string, mode: AIMode): string {
  const modePrefixes: Record<AIMode, string> = {
    general: '💬',
    document: '📄',
    scam: '🛡️',
    legal: '⚖️',
  };

  const prefix = modePrefixes[mode];
  const truncated = firstMessage
    .replace(/\[Document previously uploaded:.*?\]/g, '[Document]')
    .replace(/DOCUMENT CONTENT:.*?$/gs, '[Document]')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 40);

  return `${prefix} ${truncated}${firstMessage.length > 40 ? '...' : ''}`;
}

export default function App() {
  const { uiLanguage } = useLanguage();
  const [showSplash, setShowSplash] = useState(true);
  const [currentMode, setCurrentMode] = useState<AIMode>('general');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'idle' | 'speaking'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const autoSpeakNextRef = useRef(false);
  const streamingSpeakerRef = useRef<ReturnType<typeof createStreamingSpeaker> | null>(null);

  // Toast helpers
  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast_${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Start a new session
  const createNewSession = useCallback(
    (mode?: AIMode) => {
      const sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
      setMessages([]);
      if (mode) setCurrentMode(mode);
    },
    []
  );

  // Handle mode change
  const handleModeChange = useCallback(
    (mode: AIMode) => {
      if (mode === currentMode) return;
      setCurrentMode(mode);

      // If current session has messages, keep the session but update mode display
      // If no messages, just switch mode
      if (messages.filter((m) => m.role !== 'system').length === 0) {
        setCurrentMode(mode);
      } else {
        // Create new session for the new mode
        createNewSession(mode);
        addToast(`Switched to ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`, 'info');
      }
    },
    [currentMode, messages, createNewSession, addToast]
  );

  // Select existing session
  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      setCurrentSessionId(session.id);
      setCurrentMode(session.mode);
      setMessages(session.messages);
    },
    [sessions]
  );

  // Delete session
  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (sessionId === currentSessionId) {
        setCurrentSessionId('');
        setMessages([]);
      }
      addToast('Conversation deleted', 'info');
    },
    [currentSessionId, addToast]
  );

  // Update session in list
  const updateSessionInList = useCallback(
    (sessionId: string, updatedMessages: Message[], firstUserMessage?: string) => {
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === sessionId);

        if (existing) {
          return prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages: updatedMessages, updatedAt: new Date() }
              : s
          );
        } else {
          // Create new session entry
          const title = firstUserMessage
            ? generateSessionTitle(firstUserMessage, currentMode)
            : 'New Conversation';

          const newSession: ChatSession = {
            id: sessionId,
            title,
            mode: currentMode,
            messages: updatedMessages,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          return [newSession, ...prev.slice(0, 49)]; // Keep max 50 sessions
        }
      });
    },
    [currentMode]
  );

  const speakAssistantResponse = useCallback(async (content: string) => {
    if (!autoSpeakNextRef.current || !content.trim()) return;

    autoSpeakNextRef.current = false;
    await waitForVoices();
    const started = speakText(content, {
      language: uiLanguage === 'ne' ? 'ne' : undefined,
      onStart: () => setVoiceMode('speaking'),
      onEnd: () => setVoiceMode('idle'),
      onError: () => {
        setVoiceMode('idle');
        addToast('Voice playback is not available for this response.', 'warning');
      },
    });

    if (!started) {
      setVoiceMode('idle');
      addToast('Voice playback is not supported in this browser.', 'warning');
    }
  }, [uiLanguage, addToast]);

  // Dedicated document analysis handler — completely bypasses knowledge base,
  // officials lookup, and web search. The AI sees ONLY the extracted document text.
  const handleDocumentAnalysis = useCallback(
    async (documentPrompt: string, displayMessage: string, docMeta: { document: any }) => {
      if (isLoading) return;

      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = generateSessionId();
        setCurrentSessionId(sessionId);
      }

      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content: documentPrompt,
        displayContent: displayMessage,
        timestamp: new Date(),
        mode: currentMode,
        metadata: { document: docMeta.document },
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      const isFirstMessage = messages.filter((m) => m.role !== 'system').length === 0;
      const titleSource = displayMessage?.trim() || docMeta.document?.name || 'Document';
      updateSessionInList(sessionId, updatedMessages, isFirstMessage ? titleSource : undefined);

      abortControllerRef.current = new AbortController();
      const assistantMsgId = generateMessageId();

      try {
        const preferredLang: ResponseLanguage = uiLanguage === 'ne' ? 'ne' : 'en';
        // IMPORTANT: pass EMPTY string for search results and explicitly mark
        // this as a document-content message so realtime instructions are suppressed.
        const response = await sendMessageStream(
          documentPrompt,
          currentMode,
          messages,
          (token: string) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + token } : m))
            );
          },
          preferredLang,
          abortControllerRef.current.signal,
          '' // NO knowledge base, NO officials, NO web search
        );

        let cleaned = response;
        cleaned = cleaned.replace(/\[\d+\]/g, '');
        cleaned = cleaned.replace(/\[KB\d+\]/g, '');
        cleaned = cleaned.replace(/\n+\s*\**\s*(References?|Sources?|Reference|Bibliography)\s*:?[\s\S]*$/i, '').trimEnd();

        const finalMessages = updatedMessages.concat([
          {
            id: assistantMsgId,
            role: 'assistant' as const,
            content: cleaned,
            timestamp: new Date(),
            mode: currentMode,
          },
        ]);
        setMessages(finalMessages);
        updateSessionInList(sessionId, finalMessages);
      } catch (err) {
        setMessages((prev) => {
          const placeholder = prev.find((m) => m.id === assistantMsgId);
          if (placeholder && placeholder.content === '') {
            return prev.filter((m) => m.id !== assistantMsgId);
          }
          return prev;
        });

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            addToast('Response stopped', 'info');
          } else if (err instanceof ApiError && err.code === 'CONTENT_BLOCKED') {
            const reqIdNote = err.requestId ? `\n\n**Request ID:** \`${err.requestId}\`` : '';
            const errorMessage: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: `⚠️ **Analysis Temporarily Blocked**\n\nThe request was blocked by an automated safety filter.${reqIdNote}\n\n**Try:**\n1. Ask a more general question about the document\n2. Paste only the specific section you need help with\n3. Remove names, numbers, and sensitive identifiers before uploading\n\nYour document itself is safe — only this request was blocked.`,
              timestamp: new Date(),
              mode: currentMode,
            };
            setMessages(updatedMessages.concat([errorMessage]));
            updateSessionInList(sessionId, updatedMessages.concat([errorMessage]));
            addToast('Request blocked — try a smaller or less sensitive portion', 'warning');
          } else {
            const errorMessage: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: `⚠️ **Error**\n\nCould not complete analysis. Please try again.\n\n*${err.message}*`,
              timestamp: new Date(),
              mode: currentMode,
            };
            setMessages(updatedMessages.concat([errorMessage]));
            updateSessionInList(sessionId, updatedMessages.concat([errorMessage]));
            addToast('Failed to analyze document', 'error');
          }
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [isLoading, currentSessionId, messages, currentMode, uiLanguage, updateSessionInList, addToast]
  );

  // General send message handler (non-document)
  const handleSendMessage = useCallback(
    async (userInput: string, displayMessage?: string, docMeta?: { document: any }) => {
      if (isLoading || (!userInput.trim() && !displayMessage)) return;

      // Ensure we have a session
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = generateSessionId();
        setCurrentSessionId(sessionId);
      }

      // Create user message
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content: userInput,
        displayContent: displayMessage,
        timestamp: new Date(),
        mode: currentMode,
        metadata: docMeta && docMeta.document ? { document: docMeta.document } : undefined,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      // Update session with user message
      const isFirstMessage = messages.filter((m) => m.role !== 'system').length === 0;
      updateSessionInList(sessionId, updatedMessages, isFirstMessage ? userInput : undefined);

      // Determine if we need real-time web search
      const searchDecision = shouldSearchWeb(userInput, currentMode);
      let searchResults: import('./services/webSearch').WebSearchResult[] = [];
      let searchResultsText = '';

      if (searchDecision.needsSearch && currentMode !== 'document') {
        try {
          searchResults = await searchWeb(searchDecision.query);
          if (searchResults.length > 0) {
            searchResultsText = formatSearchResultsForPrompt(searchResults);
          }
        } catch {
          // Search failed — continue without it
        }
      }

      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Create placeholder assistant message for streaming
      const assistantMsgId = generateMessageId();
      const assistantPlaceholder: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        mode: currentMode,
      };

      // Add empty assistant message so typing indicator shows
      const messagesWithPlaceholder = [...updatedMessages, assistantPlaceholder];
      setMessages(messagesWithPlaceholder);

      try {
        const preferredLang: ResponseLanguage = uiLanguage === 'ne' ? 'ne' : 'en';

        // Create streaming speaker BEFORE starting the stream (only if voice is requested)
        let streamingSpeaker: ReturnType<typeof createStreamingSpeaker> | null = null;
        if (autoSpeakNextRef.current) {
          autoSpeakNextRef.current = false;
          await waitForVoices();
          streamingSpeaker = createStreamingSpeaker({
            language: uiLanguage === 'ne' ? 'ne' : undefined,
            onStart: () => setVoiceMode('speaking'),
            onEnd: () => setVoiceMode('idle'),
            onError: () => {
              setVoiceMode('idle');
              addToast('Voice playback is not available for this response.', 'warning');
            },
          });
          streamingSpeakerRef.current = streamingSpeaker;
        }

        const response = await sendMessageStream(
          userInput,
          currentMode,
          messages, // pass history without new message
          (token: string) => {
            // ① Update the assistant message content as tokens arrive
            setMessages((prev) => {
              return prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + token }
                  : m
              );
            });
            // ② Feed token to streaming TTS simultaneously
            streamingSpeaker?.pushToken(token);
          },
          preferredLang,
          abortControllerRef.current.signal,
          searchResultsText
        );

        // Strip any inline citation markers like [1], [2], [KB1] the AI may add to the answer body.
        let cleaned = response;
        cleaned = cleaned.replace(/\[\d+\]/g, '');
        cleaned = cleaned.replace(/\[KB\d+\]/g, '');
        cleaned = cleaned.replace(/\n+\s*\**\s*(References?|Sources?|Reference|Bibliography)\s*:?[\s\S]*$/i, '').trimEnd();

        // No trailing citations/sources appended — user wants clean chat output.
        const finalContent = cleaned;

        const finalMessages = updatedMessages.map(m => m).concat([{
          id: assistantMsgId,
          role: 'assistant' as const,
          content: finalContent,
          timestamp: new Date(),
          mode: currentMode,
        }]);
        setMessages(finalMessages);
        updateSessionInList(sessionId, finalMessages);

        // ③ Flush any remaining partial sentence to TTS
        streamingSpeaker?.flush();
        streamingSpeakerRef.current = null;

        // ④ speakAssistantResponse is NOT called here — TTS is already running via streamingSpeaker.
        // For non-voice (text-only) requests, streamingSpeaker is null so nothing plays.
      } catch (err) {
        // Try non-streaming fallback if streaming failed
        if (err instanceof Error && err.name !== 'AbortError') {
          addToast('Switching to reliable mode...', 'info');
          try {
            const preferredLang: ResponseLanguage = uiLanguage === 'ne' ? 'ne' : 'en';
            const fallbackResponse = await sendMessage(
              userInput,
              currentMode,
              messages,
              preferredLang,
              abortControllerRef.current?.signal
            );

            const finalMessages = updatedMessages.concat([{
              id: assistantMsgId,
              role: 'assistant' as const,
              content: fallbackResponse,
              timestamp: new Date(),
              mode: currentMode,
            }]);
            setMessages(finalMessages);
            updateSessionInList(sessionId, finalMessages);
            speakAssistantResponse(fallbackResponse);
            setIsLoading(false);
            abortControllerRef.current = null;
            return;
          } catch (fallbackErr) {
            // Fall through to error handler
          }
        }

        // Remove the empty placeholder if stream failed before any tokens
        setMessages((prev) => {
          const placeholder = prev.find(m => m.id === assistantMsgId);
          if (placeholder && placeholder.content === '') {
            return prev.filter(m => m.id !== assistantMsgId);
          }
          return prev;
        });

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            addToast('Response stopped', 'info');
          } else if (err instanceof ApiError && err.code === 'CONTENT_BLOCKED') {
            // Content moderation blocked this content — explain gracefully and offer next steps
            const reqIdNote = err.requestId
              ? `\n\n**Request ID:** \`${err.requestId}\``
              : '';
            const errorMessage: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: `⚠️ **Analysis Temporarily Blocked**\n\nयो सामग्री स्वचालित सुरक्षा छानीबाट रोकिएको छ।\nThis request was stopped by an automated safety filter.${reqIdNote}\n\n**This usually happens when:**\n- A document contains personal identifiers (citizenship number, phone, bank details)\n- The extracted text looks suspicious to the filter\n- The request is too large\n\n**What you can try:**\n1. Ask a more general question first (e.g., "What type of document is this?")\n2. Paste only the specific section you need help with\n3. Remove names, numbers, and sensitive identifiers before uploading\n4. Retry with a shorter excerpt\n\nYour document itself is safe — only this request was blocked. Please try again with a smaller or less sensitive portion.`,
              timestamp: new Date(),
              mode: currentMode,
            };
            const errorMessages = [...updatedMessages, errorMessage];
            setMessages(errorMessages);
            updateSessionInList(sessionId, errorMessages);
            addToast('Request blocked — try a smaller or less sensitive portion', 'warning');
          } else if (err instanceof ApiError && err.code === 'UNAUTHORIZED_CLIENT') {
            const errorMessage: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: `🔒 **Client Not Authorized**\n\nThe API provider (AgentRouter) rejected this request because the client is not whitelisted.\n\nThis is a provider-side restriction — not an issue with your account or message. Please contact AgentRouter support on Discord: https://discord.gg/aYq5B4RW3`,
              timestamp: new Date(),
              mode: currentMode,
            };
            const errorMessages = [...updatedMessages, errorMessage];
            setMessages(errorMessages);
            updateSessionInList(sessionId, errorMessages);
            addToast('Client not authorized — contact support', 'error');
          } else {
            // Generic error
            const errorMessage: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: `⚠️ **Connection Error**\n\nमाफ गर्नुहोस्, यो समयमा प्रतिक्रिया दिन सकिएन।\nSorry, I couldn't process your request at this time.\n\nPlease try again in a moment. If the issue persists, the service may be temporarily unavailable.\n\n*Technical details: ${err.message}*`,
              timestamp: new Date(),
              mode: currentMode,
            };
            const errorMessages = [...updatedMessages, errorMessage];
            setMessages(errorMessages);
            updateSessionInList(sessionId, errorMessages);
            addToast('Failed to get response. Please try again.', 'error');
          }
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [isLoading, currentSessionId, messages, currentMode, uiLanguage, updateSessionInList, addToast, speakAssistantResponse]
  );

  // Abort response
  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    autoSpeakNextRef.current = false;
    streamingSpeakerRef.current?.cancel();
    streamingSpeakerRef.current = null;
    stopSpeaking();
    setVoiceMode('idle');
  }, []);

  const handleVoiceMessage = useCallback(
    (message: string) => {
      warmUpVoices();
      autoSpeakNextRef.current = true;
      handleSendMessage(message);
    },
    [handleSendMessage]
  );

  const handleStopVoice = useCallback(() => {
    autoSpeakNextRef.current = false;
    stopSpeaking();
    setVoiceMode('idle');
  }, []);

  // Quick prompt handler
  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      handleSendMessage(prompt);
    },
    [handleSendMessage]
  );

  // When user types a vague question in document mode without attaching a file,
  // we DON'T send anything to the AI. Instead we render the user's text in their own
  // bubble and a clean assistant bubble asking them to upload the document.
  const handleRequestUpload = useCallback(
    (userText: string) => {
      if (!userText.trim()) return;

      const sessionId = currentSessionId || generateSessionId();
      if (!currentSessionId) setCurrentSessionId(sessionId);

      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content: userText,
        timestamp: new Date(),
        mode: currentMode,
      };

      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content:
          '📎 **Please upload a document**\n\nTo analyze a PDF, DOCX, TXT, or image, please attach it using the **paperclip icon** on the left side of the input bar.\n\nOnce you upload, I\'ll read the document and provide a clear analysis.',
        timestamp: new Date(),
        mode: currentMode,
      };

      const next = [...messages, userMessage, assistantMessage];
      setMessages(next);
      updateSessionInList(sessionId, next);
    },
    [currentSessionId, currentMode, messages, updateSessionInList]
  );

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif", backgroundColor: '#f8fafc' }}
    >
      {/* Splash Screen */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* Sidebar */}
      <Sidebar
        currentMode={currentMode}
        onModeChange={handleModeChange}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={() => createNewSession()}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Mobile Header */}
        <Header
          currentMode={currentMode}
          onMenuToggle={() => setSidebarOpen(true)}
          onNewChat={() => createNewSession()}
        />

        {/* Desktop Language Toggle — floating */}
        <div className="hidden lg:flex absolute top-3 right-4 z-10">
          <LanguageToggle variant="pill" />
        </div>

        {/* Chat + Info Panel */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <ChatWindow
              messages={messages}
              mode={currentMode}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onVoiceMessage={handleVoiceMessage}
              onAnalyzeDocument={handleDocumentAnalysis}
              onRequestUpload={handleRequestUpload}
              onAbort={handleAbort}
              onQuickPrompt={handleQuickPrompt}
              addToast={addToast}
            />
          </div>

          {/* Right Info Panel */}
          <ModeInfoPanel
            currentMode={currentMode}
            messageCount={messages.filter((m) => m.role !== 'system').length}
            onModeChange={handleModeChange}
          />
        </div>
      </div>

      {/* Toast Notifications */}
      {voiceMode === 'speaking' && <VoiceOverlay mode="speaking" onCancel={handleStopVoice} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
