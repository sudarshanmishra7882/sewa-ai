import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'visible' | 'fading'>('visible');

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('fading'), 1200);
    const timer2 = setTimeout(() => onComplete(), 1500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        opacity: phase === 'visible' ? 1 : 0,
        pointerEvents: phase === 'fading' ? 'none' : 'auto',
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Geometric circles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border opacity-10"
            style={{
              width: `${(i + 1) * 120}px`,
              height: `${(i + 1) * 120}px`,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderColor: i % 2 === 0 ? '#dc2626' : '#3b82f6',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}

        {/* Floating dots */}
        {[...Array(12)].map((_, i) => (
          <div
            key={`dot-${i}`}
            className="absolute w-1 h-1 rounded-full opacity-30"
            style={{
              top: `${10 + Math.random() * 80}%`,
              left: `${5 + Math.random() * 90}%`,
              backgroundColor: i % 3 === 0 ? '#dc2626' : i % 3 === 1 ? '#3b82f6' : '#ffffff',
              animation: `pulse 2s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative text-center px-8 animate-fadeIn">
        {/* Nepal flag colors stripe */}
        <div className="flex justify-center mb-8">
          <div className="h-1 w-32 rounded-full" style={{ background: 'linear-gradient(90deg, #dc2626, #1d4ed8)' }} />
        </div>

        {/* Logo */}
        <div className="relative inline-block mb-6">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl mx-auto"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #1d4ed8)',
              boxShadow: '0 0 60px rgba(220, 38, 38, 0.4), 0 0 60px rgba(29, 78, 216, 0.4)',
            }}
          >
            <span className="text-5xl font-bold text-white" style={{ fontFamily: 'Noto Sans Devanagari, serif' }}>
              स
            </span>
          </div>
          {/* Glow effect */}
          <div
            className="absolute inset-0 rounded-3xl blur-2xl opacity-40"
            style={{ background: 'linear-gradient(135deg, #dc2626, #1d4ed8)' }}
          />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          Sewa AI
        </h1>
        <p className="text-xl text-white/60 mb-1" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
          सेवा एआई
        </p>
        <p className="text-sm text-white/40 font-medium tracking-widest uppercase">
          Nepal Citizen Assistant
        </p>

        {/* Loading bar */}
        <div className="mt-10 w-48 mx-auto">
          <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #dc2626, #3b82f6)',
                animation: 'loadingBar 1.8s ease-in-out forwards',
              }}
            />
          </div>
        </div>

        {/* Tagline */}
        <p className="mt-6 text-xs text-white/30">
          Intelligent · Multilingual · Nepal-Focused
        </p>

        {/* Bottom flag */}
        <div className="flex justify-center mt-8">
          <div className="h-1 w-32 rounded-full" style={{ background: 'linear-gradient(90deg, #1d4ed8, #dc2626)' }} />
        </div>
      </div>

      <style>{`
        @keyframes loadingBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
