import React from 'react';
import { AIMode } from '../services/aiService';
import { MODES, MODE_COLORS, QUICK_PROMPTS } from '../constants/modes';
import { useLanguage } from '../context/LanguageContext';

interface WelcomeScreenProps {
  mode: AIMode;
  onQuickPrompt: (prompt: string) => void;
}

const MODE_DETAILS: Record<AIMode, {
  title: { en: string; ne: string };
  subtitle: { en: string; ne: string };
  features: { icon: string; en: string; ne: string }[];
}> = {
  general: {
    title: { en: "Namaste! I'm Sewa AI", ne: 'नमस्ते! म सेवा एआई हुँ' },
    subtitle: {
      en: 'Your intelligent civic companion for Nepal — ready to assist in Nepali or English',
      ne: 'नेपालको लागि तपाईंको बुद्धिमान नागरिक सहायक — नेपाली वा अंग्रेजीमा सहयोग गर्न तयार',
    },
    features: [
      { icon: '🗣️', en: 'Natural conversation in Nepali & English', ne: 'नेपाली र अंग्रेजीमा प्राकृतिक कुराकानी' },
      { icon: '🧠', en: 'Context-aware, adaptive responses', ne: 'सन्दर्भ-जागरूक, अनुकूली प्रतिक्रियाहरू' },
      { icon: '🇳🇵', en: 'Nepal-focused knowledge & culture', ne: 'नेपाल-केंद्रित ज्ञान र संस्कृति' },
      { icon: '⚡', en: 'Fast, accurate, and always helpful', ne: 'छिटो, सही र सँधै उपयोगी' },
    ],
  },
  document: {
    title: { en: 'Document Intelligence', ne: 'कागजात बुद्धिमत्ता' },
    subtitle: {
      en: 'Transform complex official documents into simple, actionable citizen guidance',
      ne: 'जटिल आधिकारिक कागजातहरूलाई सरल, कार्यान्वयनयोग्य नागरिक मार्गदर्शनमा रूपान्तरण गर्नुहोस्',
    },
    features: [
      { icon: '📄', en: 'Analyze government forms & official notices', ne: 'सरकारी फारम र आधिकारिक सूचनाहरू विश्लेषण गर्नुहोस्' },
      { icon: '🔍', en: 'Extract key points, deadlines & actions', ne: 'मुख्य बुँदाहरू, समयसीमा र कार्यहरू निकाल्नुहोस्' },
      { icon: '📝', en: 'Supports PDF, DOCX, images & pasted text', ne: 'PDF, DOCX, छविहरू र टाँसिएको पाठ समर्थन गर्छ' },
      { icon: '✅', en: 'Clear next steps in plain language', ne: 'सरल भाषामा स्पष्ट अर्को चरणहरू' },
    ],
  },
  scam: {
    title: { en: 'Fraud Shield Active 🛡️', ne: 'ठगी ढाल सक्रिय 🛡️' },
    subtitle: {
      en: 'AI-powered protection against scams targeting Nepali citizens',
      ne: 'नेपाली नागरिकहरूलाई लक्ष्य गरेका ठगीहरू विरुद्ध एआई-संचालित सुरक्षा',
    },
    features: [
      { icon: '🎯', en: 'Specific risk score — Low, Medium, or High', ne: 'विशिष्ट जोखिम स्कोर — कम, मध्यम, वा उच्च' },
      { icon: '🔎', en: 'Detect phishing, job scams & fake banks', ne: 'फिशिङ, जागिरे ठगी र नक्कली बैंक पत्ता लगाउनुहोस्' },
      { icon: '📱', en: 'Analyze SMS, emails, social media & URLs', ne: 'SMS, इमेल, सामाजिक सञ्जाल र URL विश्लेषण गर्नुहोस्' },
      { icon: '🚔', en: 'Nepal Police Cyber Bureau reporting guidance', ne: 'नेपाल प्रहरी साइबर ब्युरो रिपोर्टिङ मार्गदर्शन' },
    ],
  },
  legal: {
    title: { en: 'Legal & Civic Guide', ne: 'कानूनी र नागरिक मार्गदर्शक' },
    subtitle: {
      en: "Navigate Nepal's laws, rights & government procedures with confidence",
      ne: 'नेपालको कानून, अधिकार र सरकारी प्रक्रियाहरूमा आत्मविश्वासका साथ अघि बढ्नुहोस्',
    },
    features: [
      { icon: '⚖️', en: 'Nepal Constitution & civil rights explained', ne: 'नेपालको संविधान र नागरिक अधिकारहरू व्याख्या गरियो' },
      { icon: '🏛️', en: 'Government procedure step-by-step guides', ne: 'सरकारी प्रक्रिया चरणबद्ध मार्गदर्शनहरू' },
      { icon: '📋', en: 'Citizenship, property & labor law basics', ne: 'नागरिकता, सम्पत्ति र श्रम कानूनका आधारभूत कुराहरू' },
      { icon: '🤝', en: 'Consumer rights & civic process guidance', ne: 'उपभोक्ता अधिकार र नागरिक प्रक्रिया मार्गदर्शन' },
    ],
  },
};

const NOTICES: Record<AIMode, {
  icon: string;
  title: { en: string; ne: string };
  text: { en: string; ne: string };
} | null> = {
  legal: {
    icon: '⚠️',
    title: { en: 'Important Disclaimer', ne: 'महत्त्वपूर्ण अस्वीकरण' },
    text: {
      en: 'Sewa AI provides general legal information only — not legal advice. For specific legal matters, please consult a qualified lawyer in Nepal.',
      ne: 'सेवा एआईले सामान्य कानूनी जानकारी मात्र प्रदान गर्छ — कानूनी सल्लाह होइन। विशेष कानूनी मामिलाका लागि कृपया नेपालमा योग्य वकिलसँग सल्लाह गर्नुहोस्।',
    },
  },
  scam: {
    icon: '🔒',
    title: { en: 'Privacy & Safety Note', ne: 'गोपनीयता र सुरक्षा नोट' },
    text: {
      en: 'Your messages are analyzed privately. Never share OTPs, passwords, or PINs — not even with Sewa AI. We will never ask for them.',
      ne: 'तपाईंका सन्देशहरू गोप्य रूपमा विश्लेषण गरिन्छन्। OTP, पासवर्ड वा PIN कहिल्यै नसाझेदारी गर्नुहोस् — सेवा एआईसँग पनि होइन। हामी ती कहिल्यै सोध्दैनौं।',
    },
  },
  document: {
    icon: '💡',
    title: { en: 'How to Use', ne: 'कसरी प्रयोग गर्ने' },
    text: {
      en: 'Use the attachment button to upload files, or paste document text directly in the chat. Works best with typed text from government forms and official notices.',
      ne: 'फाइल अपलोड गर्न संलग्न बटन प्रयोग गर्नुहोस्, वा कुराकानीमा सीधै कागजात पाठ टाँस्नुहोस्। सरकारी फारम र आधिकारिक सूचनाहरूबाट टाइप गरिएको पाठसँग सबैभन्दा राम्रो काम गर्छ।',
    },
  },
  general: null,
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ mode, onQuickPrompt }) => {
  const colors = MODE_COLORS[mode];
  const details = MODE_DETAILS[mode];
  const modeInfo = MODES.find((m) => m.id === mode)!;
  const quickPrompts = QUICK_PROMPTS[mode] || [];
  const notice = NOTICES[mode];
  const { uiLanguage, t } = useLanguage();

  const isNepali = uiLanguage === 'ne';

  return (
    <div className="flex flex-col items-center justify-start min-h-full px-4 py-8 max-w-2xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-8 w-full">
        <div className="relative inline-flex items-center justify-center mb-6">
          <div
            className="absolute inset-0 rounded-3xl opacity-20 blur-xl"
            style={{
              background: `radial-gradient(circle, ${colors.primary}, ${colors.secondary})`,
              transform: 'scale(1.4)',
            }}
          />
          <div
            className="relative w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              boxShadow: `0 25px 60px ${colors.primary}35`,
            }}
          >
            {modeInfo.icon}
          </div>
          <div
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-base shadow-lg border-2 border-white"
            style={{ background: 'linear-gradient(135deg, #dc2626, #1d4ed8)' }}
          >
            🇳🇵
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1.5">
          {isNepali ? details.title.ne : details.title.en}
        </h1>
        <p
          className="text-sm font-semibold mb-3"
          style={{ color: colors.primary }}
        >
          {isNepali ? modeInfo.label : modeInfo.labelNe}
        </p>
        <p className="text-gray-500 text-sm leading-relaxed max-w-md mx-auto">
          {isNepali ? details.subtitle.ne : details.subtitle.en}
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mb-7">
        {details.features.map((feature, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            style={{
              backgroundColor: `${colors.primary}06`,
              borderColor: `${colors.primary}18`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm"
              style={{ backgroundColor: `${colors.primary}15` }}
            >
              {feature.icon}
            </div>
            <span className="text-sm text-gray-700 leading-tight">
              {isNepali ? feature.ne : feature.en}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Prompts */}
      <div className="w-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-gray-200" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
            {t('Try an example', 'एउटा उदाहरण हेर्नुहोस्')}
          </p>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onQuickPrompt(prompt)}
              className="text-left p-3.5 rounded-2xl border bg-white hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group active:scale-98"
              style={{ borderColor: `${colors.primary}20` }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: colors.primary }}
                >
                  {idx + 1}
                </div>
                <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
                  {prompt}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode-specific notices */}
      {notice && (
        <div className="mt-5 w-full max-w-md mx-auto">
          <div
            className="p-3.5 rounded-2xl border"
            style={{
              backgroundColor: mode === 'legal' ? '#fffbeb' : mode === 'scam' ? '#eff6ff' : '#f0fdf4',
              borderColor: mode === 'legal' ? '#fde68a' : mode === 'scam' ? '#bfdbfe' : '#a7f3d0',
            }}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0">{notice.icon}</span>
              <div>
                <p
                  className="text-xs font-semibold mb-0.5"
                  style={{
                    color: mode === 'legal' ? '#92400e' : mode === 'scam' ? '#1e40af' : '#065f46',
                  }}
                >
                  {isNepali ? notice.title.ne : notice.title.en}
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{
                    color: mode === 'legal' ? '#a16207' : mode === 'scam' ? '#3b82f6' : '#047857',
                  }}
                >
                  {isNepali ? notice.text.ne : notice.text.en}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sewa AI branding */}
      <div className="mt-8 flex items-center gap-2 text-gray-400">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-white font-bold shadow-md"
          style={{ background: 'linear-gradient(135deg, #dc2626, #1d4ed8)' }}
        >
          स
        </div>
        <span className="text-xs">{t('Sewa AI v1.0 • Sewa AI for Nepal', 'सेवा एआई v1.0 • नेपालको लागि सेवा एआई')} 🇳🇵</span>
      </div>
    </div>
  );
};
