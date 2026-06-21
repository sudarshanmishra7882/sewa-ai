import React, { useState } from 'react';
import { AIMode } from '../services/aiService';
import { MODES, MODE_COLORS } from '../constants/modes';
import { ChatSession } from '../types';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
  currentMode: AIMode;
  onModeChange: (mode: AIMode) => void;
  sessions: ChatSession[];
  currentSessionId: string;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentMode,
  onModeChange,
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  isOpen,
  onClose,
}) => {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const { uiLanguage, t } = useLanguage();

  const currentModeColor = MODE_COLORS[currentMode];

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('Just now', 'अहिले भर्खर');
    if (minutes < 60) return t(`${minutes}m ago`, `${minutes} मिनेट अघि`);
    if (hours < 24) return t(`${hours}h ago`, `${hours} घण्टा अघि`);
    return t(`${days}d ago`, `${days} दिन अघि`);
  };

  const getModeIcon = (mode: AIMode) => {
    return MODES.find((m) => m.id === mode)?.icon || '💬';
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-30 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#0f172a' }}
      >
        {/* Logo Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #dc2626, #1d4ed8)' }}>
              स
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Sewa AI</div>
              <div className="text-white/40 text-xs">सेवा एआई • Nepal</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-3 border-b border-white/10">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 px-1">
            {t('AI Modes', 'एआई मोडहरू')}
          </p>
          <div className="space-y-1">
            {MODES.map((mode) => {
              const isActive = currentMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    onModeChange(mode.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-white/15 text-white shadow-lg'
                      : 'text-white/60 hover:bg-white/8 hover:text-white/90'
                  }`}
                >
                  <span className="text-base flex-shrink-0">{mode.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : ''}`}>
                      {uiLanguage === 'ne' ? mode.labelNe : mode.label}
                    </div>
                    <div className="text-xs text-white/35 truncate">
                      {uiLanguage === 'ne' ? mode.label : mode.labelNe}
                    </div>
                  </div>
                  {isActive && (
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: currentModeColor.primary }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={onNewSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-white/80 hover:text-white bg-white/8 hover:bg-white/15 transition-all duration-200 text-sm font-medium border border-white/10 hover:border-white/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('New Conversation', 'नयाँ कुराकानी')}
          </button>
        </div>

        {/* Language Toggle */}
        <div className="px-3 pb-3">
          <LanguageToggle variant="sidebar" />
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-thin">
          {sessions.length > 0 && (
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 px-1">
              {t('Recent Chats', 'हालका कुराकानी')}
            </p>
          )}
          {sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                className={`relative group rounded-xl transition-all duration-200 ${
                  isActive ? 'bg-white/15' : 'hover:bg-white/8'
                }`}
                onMouseEnter={() => setHoveredSession(session.id)}
                onMouseLeave={() => setHoveredSession(null)}
              >
                <button
                  onClick={() => {
                    onSessionSelect(session.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left"
                >
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {getModeIcon(session.mode)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium truncate ${
                        isActive ? 'text-white' : 'text-white/70'
                      }`}
                    >
                      {session.title}
                    </div>
                    <div className="text-xs text-white/35 mt-0.5 flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-white/40"
                        style={{ fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.08)' }}
                      >
                        {MODES.find((m) => m.id === session.mode)?.label}
                      </span>
                      <span>{formatTime(session.updatedAt)}</span>
                    </div>
                  </div>
                </button>
                {(hoveredSession === session.id || isActive) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🇳🇵</div>
              <p className="text-white/30 text-xs">{t('No conversations yet', 'अहिलेसम्म कुराकानी छैन')}</p>
              <p className="text-white/20 text-xs mt-1">{t('Start a new chat above', 'माथिबाट नयाँ कुराकानी सुरु गर्नुहोस्')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-blue-600 flex items-center justify-center text-xs text-white font-bold">
              स
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white/50 text-xs truncate">Sewa AI v1.0</div>
              <div className="text-white/25 text-xs">{t('Nepal Citizen Assistant', 'नेपाल नागरिक सहायक')}</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </aside>
    </>
  );
};
