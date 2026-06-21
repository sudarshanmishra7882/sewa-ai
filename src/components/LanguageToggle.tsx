import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface LanguageToggleProps {
  variant?: 'sidebar' | 'header' | 'pill';
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ variant = 'pill' }) => {
  const { uiLanguage, toggleLanguage } = useLanguage();

  if (variant === 'sidebar') {
    return (
      <button
        onClick={toggleLanguage}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white transition-all duration-200 w-full"
      >
        <span className="text-base">🌐</span>
        <span className="text-sm font-medium flex-1 text-left">
          {uiLanguage === 'en' ? 'English' : 'नेपाली'}
        </span>
        <span className="text-xs text-white/40">
          {uiLanguage === 'en' ? 'Switch to नेपाली' : 'Switch to English'}
        </span>
      </button>
    );
  }

  if (variant === 'header') {
    return (
      <button
        onClick={toggleLanguage}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
      >
        <span>🌐</span>
        <span>{uiLanguage === 'en' ? 'EN' : 'नेपा'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      className="relative inline-flex items-center gap-2 px-1 py-1 rounded-full bg-gray-100 border border-gray-200 hover:shadow-md transition-all duration-200"
    >
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
          uiLanguage === 'en'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        English
      </span>
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
          uiLanguage === 'ne'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        नेपाली
      </span>
    </button>
  );
};
