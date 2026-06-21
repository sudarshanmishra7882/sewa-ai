import React from 'react';
import { createPortal } from 'react-dom';

interface VoiceOverlayProps {
  mode: 'listening' | 'speaking';
  transcript?: string;
  onCancel?: () => void;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({ mode, transcript, onCancel }) => {
  const isSpeaking = mode === 'speaking';
  const title = isSpeaking ? 'सेवा बोल्दैछ' : 'नेपालीमा बोल्नुहोस्';
  const subtitle = isSpeaking ? 'प्राकृतिक नेपाली उच्चारणमा जवाफ पढ्दै' : '१ सेकेन्ड चुप भएपछि आफै पठाइन्छ';

  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,#dc262633,#0f172acc_48%,#020617f2)] px-4 backdrop-blur-md">
      <div className="w-full max-w-md mx-auto overflow-hidden rounded-[2rem] border border-white/20 bg-white/95 text-center shadow-2xl">
        <div className="h-2 bg-gradient-to-r from-red-600 via-blue-700 to-red-600" />
        <div className="px-6 pb-6 pt-5">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          सेवा AI · नेपाली आवाज
        </div>

        <div className="relative mx-auto mb-5 flex h-48 w-48 items-center justify-center">
          <div className="absolute inset-1 rounded-full border border-white/60 bg-gradient-to-br from-red-50 via-white to-blue-50 shadow-inner" />
          <div
            className={`absolute inset-0 rounded-full ${isSpeaking ? 'bg-blue-600/15' : 'bg-red-600/15'}`}
            style={{ animation: 'voicePulse 1.05s ease-in-out infinite' }}
          />
          <div
            className={`absolute inset-5 rounded-full ${isSpeaking ? 'bg-blue-600/20' : 'bg-red-600/20'}`}
            style={{ animation: 'voicePulse 1.05s ease-in-out 160ms infinite' }}
          />
          <div
            className={`absolute inset-10 rounded-full ${isSpeaking ? 'bg-blue-600/20' : 'bg-red-600/20'}`}
            style={{ animation: 'voicePulse 1.05s ease-in-out 320ms infinite' }}
          />
          <div
            className={`relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-xl ${
              isSpeaking ? 'bg-gradient-to-br from-blue-700 to-indigo-800' : 'bg-gradient-to-br from-red-700 to-blue-800'
            }`}
          >
            {isSpeaking ? (
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5L6 9H3v6h3l5 4V5zm5.5 3.5a5 5 0 010 7M19 6a8 8 0 010 12" />
              </svg>
            ) : (
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 006.5-6.5M5.5 12a6.5 6.5 0 006.5 6.5m0 0V22m-3 0h6m-3-7a3 3 0 003-3V5a3 3 0 10-6 0v7a3 3 0 003 3z" />
              </svg>
            )}
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

        <div className="mt-4 min-h-16 rounded-2xl border border-red-100 bg-gradient-to-br from-slate-50 to-red-50/60 px-4 py-3 text-sm font-medium leading-relaxed text-slate-700">
          {transcript ? transcript : isSpeaking ? 'आवाज बज्दैछ...' : 'सुन्दैछ... अब नेपालीमा भन्नुहोस्'}
        </div>

        {onCancel && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {isSpeaking ? 'आवाज रोक्नुहोस्' : 'रद्द गर्नुहोस्'}
            </button>
          </div>
        )}
        </div>
      </div>

      <style>{`
        @keyframes voicePulse {
          0%, 100% { transform: scale(0.82); opacity: 0.55; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
};
