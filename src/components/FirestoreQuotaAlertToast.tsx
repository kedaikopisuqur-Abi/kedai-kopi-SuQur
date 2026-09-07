import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ShieldCheck,
  Zap,
  Clock,
  ChevronRight,
  X,
  Database,
  WifiOff,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  getFirestoreQuotaStats,
  getFirestoreQuotaRemaining,
  subscribeQuotaUpdates,
  FirestoreQuotaStats,
  FirestoreQuotaRemaining,
} from '../utils/firestoreQuotaTracker';
import { StorageService } from '../services/storage';

interface FirestoreQuotaAlertToastProps {
  onNavigateToDashboard?: () => void;
  onEnableOfflineMode?: () => void;
}

const SNOOZE_STORAGE_KEY = 'sq_quota_critical_alert_snoozed_until';
const SNOOZE_PERCENTAGE_KEY = 'sq_quota_critical_alert_last_percentage';

export const FirestoreQuotaAlertToast: React.FC<FirestoreQuotaAlertToastProps> = ({
  onNavigateToDashboard,
  onEnableOfflineMode,
}) => {
  const [stats, setStats] = useState<FirestoreQuotaStats>(() => getFirestoreQuotaStats());
  const [remaining, setRemaining] = useState<FirestoreQuotaRemaining>(() =>
    getFirestoreQuotaRemaining()
  );
  const [isDismissed, setIsDismissed] = useState(false);
  const [offlineFeedback, setOfflineFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeQuotaUpdates((newStats, newRemaining) => {
      setStats(newStats);
      setRemaining(newRemaining);

      // Check if previously snoozed
      const snoozedUntilStr = sessionStorage.getItem(SNOOZE_STORAGE_KEY);
      const lastSnoozedPctStr = sessionStorage.getItem(SNOOZE_PERCENTAGE_KEY);

      if (snoozedUntilStr && lastSnoozedPctStr) {
        const snoozedUntil = parseInt(snoozedUntilStr, 10);
        const lastPct = parseFloat(lastSnoozedPctStr);
        // Re-alert if snooze expired OR if quota dropped by 3% or more since snooze
        if (Date.now() > snoozedUntil || lastPct - newRemaining.overallPercentageRemaining >= 3) {
          setIsDismissed(false);
        }
      }
    });

    return unsub;
  }, []);

  const percent = remaining.overallPercentageRemaining;
  // Strictly appears ONLY if remaining quota is less than 10% or exceeded
  const isCriticalThreshold = percent < 10 || remaining.isCritical || remaining.isExceeded;

  // If quota is 10% or higher, or user snoozed it, do not render
  if (!isCriticalThreshold || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    // Snooze for 15 minutes, but will re-trigger if quota drops significantly
    const snoozeDurationMs = 15 * 60 * 1000;
    sessionStorage.setItem(SNOOZE_STORAGE_KEY, (Date.now() + snoozeDurationMs).toString());
    sessionStorage.setItem(SNOOZE_PERCENTAGE_KEY, percent.toString());
  };

  const handleActivateOffline = () => {
    try {
      StorageService.setOfflineMode(true);
      setOfflineFeedback('✅ Mode Offline telah diaktifkan. Data tersimpan lokal di IndexedDB.');
      if (onEnableOfflineMode) {
        onEnableOfflineMode();
      }
      setTimeout(() => {
        handleDismiss();
      }, 2500);
    } catch (e) {
      console.warn('[QuotaAlertToast] Failed to set offline:', e);
    }
  };

  const isExceeded = remaining.isExceeded || percent <= 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed bottom-16 sm:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-24px)] sm:w-[410px] pointer-events-auto"
        id="firestore-quota-critical-toast"
        role="alert"
        aria-live="assertive"
      >
        <div className="relative overflow-hidden rounded-2xl bg-stone-900/98 text-stone-100 border-2 border-rose-500/80 shadow-2xl backdrop-blur-md p-4 space-y-3.5 ring-4 ring-rose-500/20">
          {/* Subtle glowing animated accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 animate-pulse" />

          {/* Header Row */}
          <div className="flex items-start justify-between gap-2.5 pt-0.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-500/30 border border-rose-500/50 text-[10px] font-bold text-rose-300 uppercase tracking-wide">
                    {isExceeded ? 'Kuota Habis' : 'Peringatan < 10%'}
                  </span>
                  <h4 className="text-xs font-bold text-rose-100">
                    Sisa Kuota API: <span className="text-rose-400 font-mono text-sm">{percent}%</span>
                  </h4>
                </div>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  Operasional Kasir & Database Firestore Spark Plan
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Tutup / Paham (Tunda peringatan selama 15 menit)"
              aria-label="Tutup peringatan kuota"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Feedback Message if offline activated */}
          {offlineFeedback ? (
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-200 font-medium animate-in fade-in">
              {offlineFeedback}
            </div>
          ) : (
            <>
              {/* Visual Progress Bar (< 10%) */}
              <div className="space-y-1.5 bg-stone-950/70 p-2.5 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-300 font-medium">Batas Harian Spark Plan</span>
                  <span className="font-mono font-bold text-rose-400">{percent}% Sisa</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, percent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
                  <span>
                    Sisa Baca: <b className="text-stone-200">{remaining.readsRemaining.toLocaleString('id-ID')}</b>
                  </span>
                  <span>
                    Sisa Tulis: <b className="text-stone-200">{remaining.writesRemaining.toLocaleString('id-ID')}</b>
                  </span>
                </div>
              </div>

              {/* Crucial Peace of Mind Assurance for Cashier */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200/90 text-[11px] leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[10.5px]">
                  <strong className="text-emerald-300">Operasional Kasir Tetap Aman!</strong> Transaksi kasir tidak akan berhenti. Sistem otomatis mengalihkan ke mode simpan lokal (IndexedDB) dan akan disinkronkan kembali saat kuota pulih.
                </p>
              </div>

              {/* Reset Time Info */}
              <div className="flex items-center justify-between text-[10.5px] text-stone-400 px-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Reset kuota otomatis:
                </span>
                <span className="font-semibold text-amber-300">{remaining.timeUntilReset} (00:00)</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    if (onNavigateToDashboard) {
                      onNavigateToDashboard();
                    }
                  }}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
                >
                  <span>Lihat Dashboard</span>
                  <ChevronRight className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer text-center"
                >
                  Paham & Lanjut Kasir
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
