import React from 'react';
import { AIMode } from '../services/aiService';
import { MODE_COLORS, MODES } from '../constants/modes';
import { useLanguage } from '../context/LanguageContext';

interface ModeInfoPanelProps {
  currentMode: AIMode;
  messageCount: number;
  onModeChange: (mode: AIMode) => void;
}

const NEPAL_TIPS: Record<AIMode, { title: { en: string; ne: string }; tips: { en: string; ne: string }[] }> = {
  general: {
    title: { en: '🇳🇵 Nepal Tips', ne: '🇳🇵 नेपाल सुझावहरू' },
    tips: [
      { en: 'Ask in Nepali for Nepali responses', ne: 'नेपाली प्रतिक्रियाका लागि नेपालीमा सोध्नुहोस्' },
      { en: 'Mix Nepali + English naturally', ne: 'नेपाली + अंग्रेजी प्राकृतिक रूपमा मिसाउनुहोस्' },
      { en: 'Try asking about government offices', ne: 'सरकारी कार्यालयहरूबारे सोध्न प्रयास गर्नुहोस्' },
      { en: 'Ask about local festivals & culture', ne: 'स्थानीय चाडपर्व र संस्कृतिबारे सोध्नुहोस्' },
    ],
  },
  document: {
    title: { en: '📋 Document Tips', ne: '📋 कागजात सुझावहरू' },
    tips: [
      { en: 'Paste the full document text', ne: 'पूर्ण कागजात पाठ टाँस्नुहोस्' },
      { en: 'Mention the document type for better analysis', ne: 'राम्रो विश्लेषणका लागि कागजातको प्रकार उल्लेख गर्नुहोस्' },
      { en: 'Upload PDF or DOCX files directly', ne: 'PDF वा DOCX फाइलहरू सीधै अपलोड गर्नुहोस्' },
      { en: 'Ask what action you need to take', ne: 'तपाईंले के कार्य गर्नुपर्छ भनेर सोध्नुहोस्' },
    ],
  },
  scam: {
    title: { en: '🛡️ Safety Tips', ne: '🛡️ सुरक्षा सुझावहरू' },
    tips: [
      { en: 'Never share OTPs or PINs', ne: 'OTP वा PIN कहिल्यै नसाझेदारी गर्नुहोस्' },
      { en: 'Verify job offers via official channels', ne: 'आधिकारिक च्यानलमार्फत जागिर प्रस्तावहरू सत्यापित गर्नुहोस्' },
      { en: 'Real banks never ask for passwords via SMS', ne: 'वास्तविक बैंकहरूले SMS मार्फत पासवर्ड सोध्दैनन्' },
      { en: 'Report to Nepal Police Cyber Bureau', ne: 'नेपाल प्रहरी साइबर ब्युरोमा रिपोर्ट गर्नुहोस्' },
    ],
  },
  legal: {
    title: { en: '⚖️ Legal Tips', ne: '⚖️ कानूनी सुझावहरू' },
    tips: [
      { en: 'Ask about specific procedures step by step', ne: 'विशिष्ट प्रक्रियाहरू चरणबद्ध सोध्नुहोस्' },
      { en: 'Mention your situation clearly', ne: 'आफ्नो स्थिति स्पष्ट रूपमा उल्लेख गर्नुहोस्' },
      { en: 'For serious matters, consult a lawyer', ne: 'गम्भीर मामिलाका लागि वकिलसँग सल्लाह गर्नुहोस्' },
      { en: 'Ask about required documents for any process', ne: 'कुनै पनि प्रक्रियाका लागि आवश्यक कागजातहरूबारे सोध्नुहोस्' },
    ],
  },
};

const HELPFUL_LINKS: Record<AIMode, { label: { en: string; ne: string }; info: string }[]> = {
  general: [
    { label: { en: 'Nepal Gov Portal', ne: 'नेपाल सरकार पोर्टल' }, info: 'nepalgovernment.gov.np' },
    { label: { en: 'e-Services', ne: 'ई-सेवाहरू' }, info: 'eservices.gov.np' },
  ],
  document: [
    { label: { en: 'Dept of Passports', ne: 'राहदानी विभाग' }, info: 'dop.gov.np' },
    { label: { en: 'Land Revenue Dept', ne: 'भूमि राजस्व विभाग' }, info: 'dolrm.gov.np' },
  ],
  scam: [
    { label: { en: 'Nepal Police Cyber', ne: 'नेपाल प्रहरी साइबर' }, info: 'cybercrime.nepalpolice.gov.np' },
    { label: { en: 'NRB Consumer Unit', ne: 'रा. बैंक उपभोक्ता एकाइ' }, info: 'nrb.org.np' },
  ],
  legal: [
    { label: { en: 'Supreme Court Nepal', ne: 'सर्वोच्च अदालत नेपाल' }, info: 'supremecourt.gov.np' },
    { label: { en: 'Nepal Law Commission', ne: 'नेपाल कानून आयोग' }, info: 'lawcommission.gov.np' },
  ],
};

export const ModeInfoPanel: React.FC<ModeInfoPanelProps> = ({
  currentMode,
  messageCount,
  onModeChange,
}) => {
  const colors = MODE_COLORS[currentMode];
  const tipData = NEPAL_TIPS[currentMode];
  const links = HELPFUL_LINKS[currentMode];
  const { uiLanguage, t } = useLanguage();

  const isNepali = uiLanguage === 'ne';

  const modeCapabilities: Record<AIMode, { icon: string; en: string; ne: string }[]> = {
    general: [
      { icon: '🗣️', en: 'Natural conversation', ne: 'प्राकृतिक कुराकानी' },
      { icon: '🌐', en: 'Nepali & English', ne: 'नेपाली र अंग्रेजी' },
      { icon: '🇳🇵', en: 'Nepal-focused', ne: 'नेपाल-केंद्रित' },
      { icon: '🧠', en: 'Context-aware', ne: 'सन्दर्भ-जागरूक' },
    ],
    document: [
      { icon: '📄', en: 'PDF & DOCX parsing', ne: 'PDF र DOCX पार्सिङ' },
      { icon: '🔍', en: 'Key info extraction', ne: 'मुख्य जानकारी निकाल्ने' },
      { icon: '✅', en: 'Action items', ne: 'कार्य वस्तुहरू' },
      { icon: '⏰', en: 'Deadline detection', ne: 'समयसीमा पहिचान' },
    ],
    scam: [
      { icon: '🎯', en: 'Risk scoring (L/M/H)', ne: 'जोखिम स्कोरिङ (कम/मध्यम/उच्च)' },
      { icon: '🔎', en: 'Pattern detection', ne: 'प्याटर्न पहिचान' },
      { icon: '📱', en: 'SMS, email, URL scan', ne: 'SMS, इमेल, URL स्क्यान' },
      { icon: '🚔', en: 'Reporting guidance', ne: 'रिपोर्टिङ मार्गदर्शन' },
    ],
    legal: [
      { icon: '⚖️', en: 'Rights education', ne: 'अधिकार शिक्षा' },
      { icon: '🏛️', en: 'Procedure guides', ne: 'प्रक्रिया मार्गदर्शन' },
      { icon: '📋', en: 'Nepal law basics', ne: 'नेपाल कानूनका आधारभूत कुराहरू' },
      { icon: '🤝', en: 'Civic information', ne: 'नागरिक जानकारी' },
    ],
  };

  const capabilities = modeCapabilities[currentMode];

  return (
    <div
      className="hidden xl:flex flex-col border-l border-gray-100 bg-white flex-shrink-0 overflow-y-auto"
      style={{ width: '256px', scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
    >
      {/* Current Mode Header */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {t('Active Mode', 'सक्रिय मोड')}
        </p>
        <div
          className="flex items-center gap-3 p-3 rounded-2xl border"
          style={{
            backgroundColor: `${colors.primary}08`,
            borderColor: `${colors.primary}20`,
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}25, ${colors.secondary}25)`,
              border: `1.5px solid ${colors.primary}30`,
            }}
          >
            {MODES.find((m) => m.id === currentMode)?.icon}
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm leading-tight">
              {isNepali
                ? MODES.find((m) => m.id === currentMode)?.labelNe
                : MODES.find((m) => m.id === currentMode)?.label}
            </div>
            <div className="text-xs mt-0.5" style={{ color: colors.primary }}>
              {isNepali
                ? MODES.find((m) => m.id === currentMode)?.label
                : MODES.find((m) => m.id === currentMode)?.labelNe}
            </div>
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
            <div
              className="text-xl font-bold"
              style={{ color: colors.primary }}
            >
              {messageCount}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{t('Messages', 'सन्देशहरू')}</div>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xs text-gray-500 mt-1.5">{t('Online', 'अनलाइन')}</div>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          {t('Capabilities', 'क्षमताहरू')}
        </p>
        <div className="space-y-2">
          {capabilities.map((cap, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <span className="text-base w-5 text-center">{cap.icon}</span>
              <span className="text-xs text-gray-600">{isNepali ? cap.ne : cap.en}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          {isNepali ? tipData.title.ne : tipData.title.en}
        </p>
        <div className="space-y-2">
          {tipData.tips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div
                className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5"
                style={{ backgroundColor: colors.primary }}
              />
              <span className="text-xs text-gray-500 leading-relaxed">{isNepali ? tip.ne : tip.en}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Helpful Resources */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          {t('Official Resources', 'आधिकारिक स्रोतहरू')}
        </p>
        <div className="space-y-1.5">
          {links.map((link, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 rounded-lg bg-gray-50"
            >
              <svg
                className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">
                  {isNepali ? link.label.ne : link.label.en}
                </div>
                <div className="text-xs text-gray-400 truncate">{link.info}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Switch Mode */}
      <div className="px-4 py-3 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          {t('Switch Mode', 'मोड स्विच गर्नुहोस्')}
        </p>
        <div className="space-y-1.5">
          {MODES.filter((m) => m.id !== currentMode).map((mode) => {
            return (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm transition-all duration-200 text-left group"
              >
                <span className="text-base">{mode.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors truncate">
                    {isNepali ? mode.labelNe : mode.label}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {isNepali ? mode.label : mode.labelNe}
                  </div>
                </div>
                <svg
                  className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sewa AI Brand Footer */}
      <div className="px-4 py-4 mt-auto border-t border-gray-100">
        <div
          className="p-3 rounded-2xl text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.05), rgba(29, 78, 216, 0.05))',
            border: '1px solid rgba(220, 38, 38, 0.1)',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #dc2626, #1d4ed8)' }}
            >
              स
            </div>
            <span className="text-xs font-bold text-gray-700">Sewa AI</span>
          </div>
          <p className="text-xs text-gray-400">{t('Nepal Citizen Assistant', 'नेपाल नागरिक सहायक')}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <span className="text-base">🇳🇵</span>
            <span className="text-xs text-gray-400">v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
