import React, { createContext, useContext, useState, useCallback } from 'react';

type UILanguage = 'en' | 'ne';

interface LanguageContextType {
  uiLanguage: UILanguage;
  setUILanguage: (lang: UILanguage) => void;
  toggleLanguage: () => void;
  t: (en: string, ne: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uiLanguage, setUILanguage] = useState<UILanguage>('en');

  const toggleLanguage = useCallback(() => {
    setUILanguage((prev) => (prev === 'en' ? 'ne' : 'en'));
  }, []);

  const t = useCallback(
    (en: string, ne: string) => {
      return uiLanguage === 'ne' ? ne : en;
    },
    [uiLanguage]
  );

  return (
    <LanguageContext.Provider value={{ uiLanguage, setUILanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
