import React from 'react';
import { AIMode } from '../services/aiService';
import { MODES, MODE_COLORS } from '../constants/modes';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  currentMode: AIMode;
  onMenuToggle: () => void;
  onNewChat: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentMode, onMenuToggle, onNewChat }) => {
  const colors = MODE_COLORS[currentMode];
  const modeInfo = MODES.find((m) => m.id === currentMode);
  const { uiLanguage } = useLanguage();

  return (
    <header className="lg:hidden flex items-center justify-between px-3 py-2.5 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm flex-shrink-0 z-10">
      {/* Menu Button */}
      <button
        onClick={onMenuToggle}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Center — Logo + Mode */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-white font-bold shadow-md"
          style={{ background: 'linear-gradient(135deg, #dc2626, #1d4ed8)' }}
        >
          स
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900 leading-none">Sewa AI</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs">{modeInfo?.icon}</span>
            <span className="text-xs font-medium" style={{ color: colors.primary }}>
              {uiLanguage === 'ne' ? modeInfo?.labelNe : modeInfo?.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Language Toggle */}
        <LanguageToggle variant="header" />

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="New chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </header>
  );
};
