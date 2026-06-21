import React from 'react';

interface ScamRiskBadgeProps {
  level: 'Low' | 'Medium' | 'High';
  compact?: boolean;
}

export const ScamRiskBadge: React.FC<ScamRiskBadgeProps> = ({ level, compact = false }) => {
  const configs = {
    Low: {
      icon: '✅',
      label: 'LOW RISK',
      labelNe: 'कम जोखिम',
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
      text: 'text-emerald-800',
      dot: 'bg-emerald-500',
      barColor: '#10b981',
      barWidth: '25%',
      description: 'This appears to be safe, but stay cautious',
    },
    Medium: {
      icon: '⚠️',
      label: 'MEDIUM RISK',
      labelNe: 'मध्यम जोखिम',
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-800',
      dot: 'bg-amber-500',
      barColor: '#f59e0b',
      barWidth: '60%',
      description: 'Proceed with caution — verify before acting',
    },
    High: {
      icon: '🚨',
      label: 'HIGH RISK',
      labelNe: 'उच्च जोखिम',
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      dot: 'bg-red-500',
      barColor: '#ef4444',
      barWidth: '95%',
      description: 'This is likely a SCAM — do not proceed!',
    },
  };

  const config = configs[level];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${config.bg} ${config.border} ${config.text}`}
      >
        {config.icon} {config.label}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border-2 p-3 mb-3 ${config.bg} ${config.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <div>
            <div className={`text-sm font-bold ${config.text}`}>{config.label}</div>
            <div className={`text-xs opacity-75 ${config.text}`}>{config.labelNe}</div>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full animate-pulse ${config.dot}`} />
      </div>
      
      {/* Risk bar */}
      <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: config.barWidth, backgroundColor: config.barColor }}
        />
      </div>
      
      <p className={`text-xs font-medium ${config.text}`}>{config.description}</p>
    </div>
  );
};
