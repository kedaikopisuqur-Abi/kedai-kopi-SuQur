import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle,
  Share2,
  PlusSquare,
  Sparkles,
  Maximize2,
  Wifi,
  Zap,
  ArrowRight,
  X,
  ExternalLink,
  Shield,
  Layers,
  HelpCircle,
  Monitor,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'pc'>('android');

  useEffect(() => {
    // Check if running as standalone PWA / APK
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(Boolean(isStandaloneMode));
    };
    checkStandalone();

    // Check OS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    setIsIos(isIosDevice);
    setIsAndroid(isAndroidDevice);

    if (isIosDevice) setActiveTab('ios');
    else if (isAndroidDevice) setActiveTab('android');
    else setActiveTab('pc');

    // Capture beforeinstallprompt if available
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setInstallSuccess(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallSuccess(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      } finally {
        setIsInstalling(false);
      }
    } else {
      // If prompt not natively ready, trigger fullscreen or guide user
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (e) {}
      }
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#2B1713] text-white border-2 border-amber-500/40 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto overflow-hidden relative"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#5D4037] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-[#1F1412] flex items-center justify-center shadow-lg font-serif font-black text-2xl shrink-0 border border-amber-300">
              ☕
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg sm:text-xl text-amber-100">
                  Pasang Aplikasi Su-Qur POS
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  PWA / APK
                </span>
              </div>
              <p className="text-xs text-[#D7CCC8]">
                Buka kasir layaknya aplikasi bawaan HP (Layar Penuh, Ikon Menu, & Mode Offline)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Highlight Banner */}
        {isInstalled || installSuccess ? (
          <div className="p-4 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <div className="font-bold text-emerald-200">Aplikasi Sudah Terpasang!</div>
              <div className="text-emerald-300/80">
                Aplikasi Su-Qur POS siap digunakan langsung dari layar utama HP Anda dengan kecepatan maksimal.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-950/70 border border-amber-500/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" /> Keunggulan Mode Aplikasi (PWA):
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                Tanpa Kuota PlayStore
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-[#1F1412] p-2 rounded-xl border border-amber-900/40 text-[11px]">
                <Maximize2 className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <span className="font-bold text-[#FAF3DD] block">Layar Penuh</span>
                <span className="text-[9px] text-[#A1887F]">Tanpa Bar Browser</span>
              </div>
              <div className="bg-[#1F1412] p-2 rounded-xl border border-amber-900/40 text-[11px]">
                <Wifi className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <span className="font-bold text-[#FAF3DD] block">Offline First</span>
                <span className="text-[9px] text-[#A1887F]">Kasir Tetap Jalan</span>
              </div>
              <div className="bg-[#1F1412] p-2 rounded-xl border border-amber-900/40 text-[11px]">
                <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <span className="font-bold text-[#FAF3DD] block">1-Ketukan</span>
                <span className="text-[9px] text-[#A1887F]">Ikon di Beranda</span>
              </div>
            </div>
          </div>
        )}

        {/* Device Switcher Tabs */}
        <div className="flex rounded-xl bg-[#1F1412] p-1 border border-[#5D4037]">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#D7CCC8] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android (Chrome)</span>
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ios'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#D7CCC8] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>iPhone / iPad</span>
          </button>
          <button
            onClick={() => setActiveTab('pc')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'pc'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#D7CCC8] hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Laptop / PC</span>
          </button>
        </div>

        {/* Step-by-step Guide by Platform */}
        <div className="bg-[#1F1412] p-4 rounded-2xl border border-[#5D4037] space-y-3">
          {activeTab === 'android' && (
            <div className="space-y-2.5 text-xs text-stone-200">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-amber-200">Klik tombol "Pasang Aplikasi Sekarang" di bawah.</p>
                  <p className="text-[11px] text-[#A1887F]">
                    Browser Android akan memunculkan dialog persetujuan pemasangan instan.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-amber-200">Alternatif Manual (Menu Chrome ⋮):</p>
                  <p className="text-[11px] text-[#D7CCC8]">
                    Ketuk menu titik tiga (⋮) di pojok kanan atas browser, lalu pilih{' '}
                    <strong className="text-amber-300">"Tambahkan ke Layar Utama"</strong> atau{' '}
                    <strong className="text-amber-300">"Instal Aplikasi"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-2.5 text-xs text-stone-200">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-amber-200">Buka di Browser Safari.</p>
                  <p className="text-[11px] text-[#D7CCC8]">
                    Ketuk ikon <strong className="text-amber-300 inline-flex items-center gap-0.5"><Share2 className="w-3 h-3 inline" /> Bagikan (Share)</strong> di bilah bawah Safari.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-amber-200">Pilih "Tambah ke Layar Utama".</p>
                  <p className="text-[11px] text-[#D7CCC8]">
                    Gulir opsi ke bawah lalu pilih <strong className="text-amber-300 inline-flex items-center gap-0.5"><PlusSquare className="w-3 h-3 inline" /> Tambah ke Layar Utama (Add to Home Screen)</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pc' && (
            <div className="space-y-2.5 text-xs text-stone-200">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-amber-200">Instal via Google Chrome / Microsoft Edge:</p>
                  <p className="text-[11px] text-[#D7CCC8]">
                    Klik ikon monitor/install di bilah alamat URL paling kanan (Omnibox), lalu klik <strong>Instal</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-amber-200">Jalankan Mode Layar Penuh (F11):</p>
                  <p className="text-[11px] text-[#D7CCC8]">
                    Aplikasi akan tampil di jendela terpisah tanpa gangguan tab browser.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          {deferredPrompt ? (
            <button
              onClick={handleInstallPWA}
              disabled={isInstalling}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1F1412] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isInstalling ? 'Memasang Aplikasi...' : 'Pasang Aplikasi Sekarang (1-Klik)'}</span>
            </button>
          ) : (
            <button
              onClick={handleToggleFullscreen}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Maximize2 className="w-4 h-4 text-amber-300" />
              <span>Aktifkan Mode Layar Penuh (Fullscreen)</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-stone-300 text-xs font-bold transition-colors text-center"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
};
