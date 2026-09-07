import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Info,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Clock,
  X,
} from 'lucide-react';
import {
  getFirestoreQuotaStats,
  getFirestoreQuotaRemaining,
  subscribeQuotaUpdates,
  FirestoreQuotaStats,
  FirestoreQuotaRemaining,
  resetFirestoreQuotaStats,
} from '../../utils/firestoreQuotaTracker';

interface HeaderQuotaIndicatorProps {
  onNavigateToDashboard?: () => void;
}

export const HeaderQuotaIndicator: React.FC<HeaderQuotaIndicatorProps> = ({
  onNavigateToDashboard,
}) => {
  const [stats, setStats] = useState<FirestoreQuotaStats>(() => getFirestoreQuotaStats());
  const [remaining, setRemaining] = useState<FirestoreQuotaRemaining>(() =>
    getFirestoreQuotaRemaining()
  );
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeQuotaUpdates((newStats, newRemaining) => {
      setStats(newStats);
      setRemaining(newRemaining);
    });
    return unsub;
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const percent = remaining.overallPercentageRemaining;

  // Determine color scheme based on remaining percentage
  const getTheme = () => {
    if (percent > 35) {
      return {
        pillBg: 'bg-emerald-950/80 hover:bg-emerald-900/90 border-emerald-500/60',
        text: 'text-emerald-300',
        barBg: 'bg-emerald-950',
        barFill: 'bg-emerald-400',
        badge: 'text-emerald-400',
      };
    }
    if (percent > 15) {
      return {
        pillBg: 'bg-amber-950/80 hover:bg-amber-900/90 border-amber-500/60',
        text: 'text-amber-300',
        barBg: 'bg-amber-950',
        barFill: 'bg-amber-400',
        badge: 'text-amber-400',
      };
    }
    return {
      pillBg: 'bg-rose-950/80 hover:bg-rose-900/90 border-rose-500/60 animate-pulse',
      text: 'text-rose-300',
      barBg: 'bg-rose-950',
      barFill: 'bg-rose-400',
      badge: 'text-rose-400',
    };
  };

  const theme = getTheme();

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Interactive Trigger Button */}
      <button
        id="header-quota-indicator-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${theme.pillBg} ${theme.text}`}
        title={`Sisa Kuota API Firestore: ${percent}% (Baca: ${remaining.readsRemaining.toLocaleString('id-ID')}, Tulis: ${remaining.writesRemaining.toLocaleString('id-ID')}). Klik untuk rincian.`}
      >
        <Activity className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${theme.badge} shrink-0`} />
        
        {/* Label and Mini Progress Bar */}
        <div className="hidden xs:flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-tight text-[#EFEBE9]">
            Kuota
          </span>
          <div className="w-10 sm:w-12 h-1.5 rounded-full bg-[#3E2723] overflow-hidden border border-white/10 shrink-0">
            <div
              className={`h-full ${theme.barFill} transition-all duration-300 rounded-full`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold">{percent}%</span>
      </button>

      {/* Detailed Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#1F1412] text-[#FAF3DD] border border-amber-500/40 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95">
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-amber-900/60">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-100">Pemantau Kuota API</h4>
                <p className="text-[10px] text-amber-400/80">Firestore Spark Plan (Gratis Harian)</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-amber-400 hover:text-white rounded-lg hover:bg-[#3E2723] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body: Progress Bars */}
          <div className="py-3 space-y-3">
            {/* Read Operations */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#D7CCC8]">Operasi Baca (Read)</span>
                <span className="font-mono text-[10px] font-bold text-emerald-400">
                  {remaining.readPercentageRemaining}% Sisa
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#3E2723] overflow-hidden border border-white/5">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${remaining.readPercentageRemaining}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-400">
                <span>{stats.readsUsed.toLocaleString('id-ID')} terpakai</span>
                <span className="font-medium text-stone-300">
                  Sisa: {remaining.readsRemaining.toLocaleString('id-ID')} / {stats.readLimit.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Write Operations */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#D7CCC8]">Operasi Tulis (Write)</span>
                <span className="font-mono text-[10px] font-bold text-amber-400">
                  {remaining.writePercentageRemaining}% Sisa
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#3E2723] overflow-hidden border border-white/5">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                  style={{ width: `${remaining.writePercentageRemaining}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-400">
                <span>{(stats.writesUsed + stats.deletesUsed).toLocaleString('id-ID')} terpakai</span>
                <span className="font-medium text-stone-300">
                  Sisa: {remaining.writesRemaining.toLocaleString('id-ID')} / {stats.writeLimit.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Status & Auto Safeguards */}
            <div className="p-2 rounded-xl bg-[#2B1713] border border-amber-900/40 text-[10px] text-stone-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Penghemat Kuota Otomatis Aktif</span>
              </div>
              <p className="text-[9px] text-stone-400 leading-tight">
                Deduplikasi penulisan data (25 detik) & query cerdas (limit 100) menjaga kuota tetap hemat sepanjang hari.
              </p>
            </div>

            {/* Reset Countdown */}
            <div className="flex items-center justify-between text-[10px] text-stone-400 px-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400/80" />
                Reset Harian:
              </span>
              <span className="font-bold text-amber-200">{remaining.timeUntilReset} (00:00)</span>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-2 border-t border-amber-900/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset counter pemantau kuota hari ini?')) {
                  resetFirestoreQuotaStats();
                }
              }}
              className="text-[10px] text-stone-400 hover:text-stone-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset Hitungan</span>
            </button>

            {onNavigateToDashboard && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToDashboard();
                }}
                className="text-[10px] font-bold text-amber-300 hover:text-amber-100 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Lihat di Dashboard</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
