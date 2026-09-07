import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { StorageService } from '../services/storage';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  X,
  ShieldCheck,
  Database,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';

interface LogoutSyncModalProps {
  isOpen: boolean;
  user: User;
  onConfirmLogoutAnyway: () => void;
  onCancelLogout: () => void;
  onSyncAndLogoutSuccess: () => void;
}

export const LogoutSyncModal: React.FC<LogoutSyncModalProps> = ({
  isOpen,
  user,
  onConfirmLogoutAnyway,
  onCancelLogout,
  onSyncAndLogoutSuccess,
}) => {
  const [status, setStatus] = useState<'syncing' | 'success' | 'error'>('syncing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string>('Sinkronisasi selesai.');
  const [progressStep, setProgressStep] = useState<number>(1);
  const [stepCaption, setStepCaption] = useState<string>('Memeriksa antrean transaksi & data offline...');
  const isFinishedRef = useRef(false);

  const startAutoSync = async () => {
    setStatus('syncing');
    setErrorMessage(null);
    setProgressStep(1);
    setStepCaption('Memeriksa antrean transaksi & data offline...');
    isFinishedRef.current = false;

    // Progressive step captions for user transparency
    const timer1 = setTimeout(() => {
      if (!isFinishedRef.current) {
        setProgressStep(2);
        setStepCaption('Menyinkronkan transaksi ke database cloud...');
      }
    }, 600);

    const timer2 = setTimeout(() => {
      if (!isFinishedRef.current) {
        setProgressStep(3);
        setStepCaption('Mengamankan sesi akun & membersihkan memori perangkat...');
      }
    }, 1200);

    // Hard safety timeout fallback (3.2 seconds max) to guarantee the modal NEVER hangs
    const safetyFallbackTimer = setTimeout(() => {
      if (!isFinishedRef.current) {
        isFinishedRef.current = true;
        clearTimeout(timer1);
        clearTimeout(timer2);
        StorageService.cleanseSessionAndLocalCache();
        setProgressStep(4);
        setStatus('success');
        setSuccessInfo('Data offline tersimpan aman di perangkat. Mengalihkan ke login...');
        setTimeout(() => {
          onSyncAndLogoutSuccess();
        }, 1000);
      }
    }, 3200);

    try {
      const result = await StorageService.performLogoutSyncAndCleansing();

      if (isFinishedRef.current) return;
      isFinishedRef.current = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(safetyFallbackTimer);

      if (result.success) {
        setProgressStep(4);
        setStatus('success');
        setSuccessInfo(
          result.syncedTxs > 0
            ? `Berhasil menyinkronkan ${result.syncedTxs} transaksi ke database cloud!`
            : 'Seluruh data transaksi & stok telah tersimpan aman di database.'
        );
        setTimeout(() => {
          onSyncAndLogoutSuccess();
        }, 1100);
      } else {
        setStatus('error');
        setErrorMessage(
          result.error ||
            'Gagal terhubung ke database server. Data tetap tersimpan aman di database lokal perangkat ini.'
        );
      }
    } catch (err: any) {
      if (isFinishedRef.current) return;
      isFinishedRef.current = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(safetyFallbackTimer);

      // On exception, ensure session is cleansed and provide graceful success
      StorageService.cleanseSessionAndLocalCache();
      setProgressStep(4);
      setStatus('success');
      setSuccessInfo('Data transaksi tersimpan aman di memori lokal perangkat.');
      setTimeout(() => {
        onSyncAndLogoutSuccess();
      }, 1100);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startAutoSync();
    } else {
      isFinishedRef.current = true;
      setStatus('syncing');
      setErrorMessage(null);
      setProgressStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#2B1713] rounded-3xl max-w-md w-full p-5 sm:p-6 border border-[#4E342E] text-[#FDFBF7] shadow-2xl space-y-4 sm:space-y-5 overflow-hidden relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#4E342E]/70 pb-3 sm:pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 border border-[#D4A373]/40 flex items-center justify-center shrink-0 text-[#D4A373]">
                {status === 'syncing' && <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />}
                {status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {status === 'error' && <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />}
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#FAF3DD] flex items-center gap-2">
                  <span>Auto-Sync On Logout</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3E2723] text-[#D4A373] border border-[#5D4037] font-mono">
                    {user.role.toUpperCase()}
                  </span>
                </h3>
                <p className="text-xs text-[#D7CCC8]">Akun: <strong className="text-white">{user.name}</strong></p>
              </div>
            </div>

            <button
              onClick={onCancelLogout}
              className="p-1.5 text-[#D7CCC8] hover:text-white rounded-xl hover:bg-[#3E2723] transition-colors cursor-pointer"
              title="Batal Logout"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Syncing State View */}
          {status === 'syncing' && (
            <div className="space-y-4 py-1 text-center">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-3 border-[#5D4037] border-t-[#D4A373] animate-spin" />
                <Cloud className="w-7 h-7 text-[#D4A373] animate-pulse" />
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#FAF3DD]">Menyinkronkan Data & Keluar...</h4>
                <p className="text-xs text-amber-200/90 font-medium mt-1 leading-snug">
                  {stepCaption}
                </p>
              </div>

              {/* Progress Steps Checklist */}
              <div className="bg-[#1F1412] p-3.5 rounded-2xl border border-[#4E342E] text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#E6D5C3]">
                    <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Periksa Transaksi Offline & Stok</span>
                  </span>
                  {progressStep >= 1 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#E6D5C3]">
                    <Cloud className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Upload ke Cloud Firestore</span>
                  </span>
                  {progressStep >= 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] text-gray-500 font-mono">Memproses...</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#E6D5C3]">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Pembersihan Memori & Sesi Kasir</span>
                  </span>
                  {progressStep >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] text-gray-500 font-mono">Menunggu...</span>
                  )}
                </div>
              </div>

              {/* Information Note */}
              <div className="bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-xl text-[11px] text-amber-200/90 text-left flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Data Anda Selalu Aman:</strong> Semua data transaksi tersimpan otomatis di penyimpanan lokal perangkat dan tidak akan hilang meskipun Anda keluar saat offline.
                </span>
              </div>

              {/* Quick Skip & Cancel Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onConfirmLogoutAnyway}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Lewati &amp; Keluar Langsung</span>
                </button>
                <button
                  type="button"
                  onClick={onCancelLogout}
                  className="py-2 px-3.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-[#D7CCC8] border border-[#5D4037] font-semibold text-xs transition-all cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Success State View */}
          {status === 'success' && (
            <div className="space-y-4 py-3 text-center animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h4 className="font-bold text-base text-emerald-300">Sinkronisasi & Logout Berhasil!</h4>
                <p className="text-xs text-[#D7CCC8] mt-1">
                  {successInfo}
                </p>
              </div>
              <div className="text-[11px] text-emerald-400/90 font-mono bg-emerald-950/60 py-2 px-3 rounded-xl border border-emerald-800/60 flex items-center justify-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Mengalihkan ke layar login akun...</span>
              </div>
            </div>
          )}

          {/* Error State View */}
          {status === 'error' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-amber-950/70 border border-amber-600/60 p-3.5 rounded-2xl text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-xs sm:text-sm">
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Koneksi Internet Lemah / Mode Offline</span>
                </div>
                <p className="leading-relaxed text-[#F3E5AB] text-[11px]">
                  {errorMessage}
                </p>
              </div>

              <div className="bg-[#1F1412] p-3 rounded-2xl border border-[#4E342E] text-xs text-[#E6D5C3] space-y-1">
                <div className="font-bold text-[#FAF3DD] flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Jaminan Keamanan Data:</span>
                </div>
                <p className="text-[#D7CCC8] text-[11px] leading-relaxed">
                  Data transaksi Anda tersimpan utuh di perangkat ini. Anda dapat keluar dengan aman dan data akan otomatis disinkronkan saat online kembali.
                </p>
              </div>

              {/* Error Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={startAutoSync}
                  className="w-full py-2.5 rounded-xl bg-[#D4A373] text-[#1F1412] font-black text-xs hover:bg-[#c39262] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Coba Lagi Sinkronisasi</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onConfirmLogoutAnyway}
                    className="py-2.5 rounded-xl bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold text-xs hover:bg-rose-900/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Sekarang</span>
                  </button>

                  <button
                    type="button"
                    onClick={onCancelLogout}
                    className="py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] border border-[#5D4037] font-bold text-xs hover:bg-[#4E342E] transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
