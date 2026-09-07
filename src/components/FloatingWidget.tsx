import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coffee,
  X,
  Zap,
  Lock,
  DollarSign,
  Printer,
  Store,
  Wifi,
  Radio,
  Bell,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Volume2,
  Sun,
  Moon,
  Smartphone,
  Move,
  Power,
  RotateCcw,
  ExternalLink,
  Layers,
  HelpCircle,
  ChevronRight,
  Info,
} from 'lucide-react';
import { User, Outlet, Shift, StoreSettings } from '../types';
import { NavTab } from './Navigation';
import { NotificationService } from '../services/notificationService';
import { openCashDrawer } from '../services/thermalPrinterService';
import { StorageService } from '../services/storage';
import { getStoredTheme, toggleTheme, isDarkActive, ThemeMode } from '../utils/theme';
import { NativeOverlayBridge } from '../services/nativeOverlayBridge';
import { useTheme } from '../context/ThemeContext';

interface FloatingWidgetProps {
  user: User;
  activeOutlet: Outlet;
  outlets: Outlet[];
  activeShift: Shift | null;
  settings: StoreSettings;
  pendingSyncCount: number;
  isFocusMode: boolean;
  onNavigateTab: (tab: NavTab) => void;
  onSwitchOutlet: (outletId: string) => void;
  onToggleFocusMode: () => void;
  onLockScreen: () => void;
  onOpenShiftModal: () => void;
  onManualSync: () => Promise<any> | void;
  onOpenLastReceipt?: () => void;
  incomingOrdersCount?: number;
}

export const FloatingWidget: React.FC<FloatingWidgetProps> = ({
  user,
  activeOutlet,
  outlets,
  activeShift,
  settings,
  pendingSyncCount,
  isFocusMode,
  onNavigateTab,
  onSwitchOutlet,
  onToggleFocusMode,
  onLockScreen,
  onOpenShiftModal,
  onManualSync,
  onOpenLastReceipt,
  incomingOrdersCount = 0,
}) => {
  const { preset, presetDetails, isDarkMode } = useTheme();

  // Master ON/OFF state (Persisted in localStorage)
  const [isEnabled, setIsEnabled] = useState<boolean>(() =>
    NativeOverlayBridge.isWidgetEnabled()
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [isKickingDrawer, setIsKickingDrawer] = useState(false);
  const [isAndroidGuideOpen, setIsAndroidGuideOpen] = useState(false);
  const [activeGuideBrand, setActiveGuideBrand] = useState<'general' | 'xiaomi' | 'samsung' | 'oppo_vivo'>('general');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    NotificationService.getPermission()
  );
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [isDark, setIsDark] = useState<boolean>(() => isDarkActive());

  // Position coordinates state (persisted in localStorage)
  const [position, setPosition] = useState<{ x: number; y: number }>(() =>
    NativeOverlayBridge.getSavedPosition()
  );

  // Drag tracking to distinguish tap from drag
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const widgetNodeRef = useRef<HTMLDivElement>(null);

  // Viewport dimensions for mobile clamp boundaries
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1000,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Online / offline & custom toggle listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleThemeChange = (e: any) => {
      const mode = e?.detail?.mode || getStoredTheme();
      setThemeMode(mode);
      setIsDark(e?.detail?.isDark ?? isDarkActive(mode));
    };
    window.addEventListener('sq_theme_changed', handleThemeChange);

    const handleWidgetToggle = (e: any) => {
      if (typeof e?.detail?.enabled === 'boolean') {
        setIsEnabled(e.detail.enabled);
      } else {
        setIsEnabled(NativeOverlayBridge.isWidgetEnabled());
      }
    };
    window.addEventListener('sq_floating_widget_toggle', handleWidgetToggle);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sq_theme_changed', handleThemeChange);
      window.removeEventListener('sq_floating_widget_toggle', handleWidgetToggle);
    };
  }, []);

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setThemeMode(next);
    setIsDark(isDarkActive(next));
  };

  // Toggle Widget ON/OFF
  const handleToggleEnabled = (nextState: boolean) => {
    setIsEnabled(nextState);
    NativeOverlayBridge.setWidgetEnabled(nextState);
    if (!nextState) {
      setNoticeMessage('Gelembung melayang disembunyikan. Anda dapat menyalakannya kembali lewat menu Pengaturan atau Header bar.');
      setTimeout(() => {
        setIsOpen(false);
        setNoticeMessage(null);
      }, 1800);
    }
  };

  // Reset position
  const handleResetPosition = () => {
    const resetPos = NativeOverlayBridge.resetPosition();
    setPosition(resetPos);
    setNoticeMessage('Posisi gelembung berhasil dikembalikan ke pojok kanan bawah.');
    setTimeout(() => setNoticeMessage(null), 2500);
  };

  // Request Notification permission handler
  const handleRequestNotification = async () => {
    const perm = await NotificationService.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      await NotificationService.testNotification();
    }
  };

  // Test sound & notification
  const handleTestSoundAndNotif = async () => {
    setIsTestingNotif(true);
    await NotificationService.testNotification();
    setTimeout(() => setIsTestingNotif(false), 800);
  };

  // Kick Cash Drawer pulse
  const handleKickDrawer = async () => {
    setIsKickingDrawer(true);
    try {
      await openCashDrawer(settings);
    } catch (e) {
      console.warn('Gagal membuka laci kasir:', e);
    } finally {
      setTimeout(() => setIsKickingDrawer(false), 1000);
    }
  };

  // Manual Sync
  const handleSyncClick = async () => {
    setIsSyncing(true);
    try {
      await onManualSync();
    } finally {
      setIsSyncing(false);
    }
  };

  // Drag start
  const handleDragStart = () => {
    isDraggingRef.current = true;
    dragStartTimeRef.current = Date.now();
  };

  // Drag end save position with screen clamp safety
  const handleDragEnd = (_: any, info: any) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);

    const winW = typeof window !== 'undefined' ? window.innerWidth : 800;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 600;

    // Minimum distance from edges (px)
    const minX = -(winW - 80);
    const maxX = 10;
    const minY = -(winH - 120);
    const maxY = 20;

    const rawX = position.x + (info?.offset?.x || 0);
    const rawY = position.y + (info?.offset?.y || 0);

    const clampedX = Math.max(minX, Math.min(maxX, rawX));
    const clampedY = Math.max(minY, Math.min(maxY, rawY));

    const newPos = {
      x: clampedX,
      y: clampedY,
    };

    setPosition(newPos);
    NativeOverlayBridge.savePosition(newPos);
  };

  // Trigger Native Android ActionSheet Menu
  const handleOpenNativeActionSheet = async () => {
    await NativeOverlayBridge.showNativeQuickActions({
      currentEnabled: isEnabled,
      onOpenPos: () => {
        setIsOpen(false);
        onNavigateTab('pos');
      },
      onToggleFocus: onToggleFocusMode,
      onOpenShift: () => {
        setIsOpen(false);
        onOpenShiftModal();
      },
      onLockScreen: () => {
        setIsOpen(false);
        onLockScreen();
      },
      onToggleWidget: handleToggleEnabled,
      onRequestOverlayPermission: () => {
        setIsAndroidGuideOpen(true);
      },
    });
  };

  if (!isEnabled && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Draggable Floating Bubble Button */}
      {isEnabled && (
        <motion.div
          ref={widgetNodeRef}
          drag
          dragMomentum={false}
          dragElastic={0.08}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          animate={{ x: position.x, y: position.y }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className="fixed bottom-20 right-4 sm:bottom-8 sm:right-6 z-40 pointer-events-auto cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="relative group">
            {/* Draggable Touch Hint Indicator on Hover/Focus */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-amber-200 text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow-xs pointer-events-none flex items-center gap-1 border border-amber-500/30">
              <Move className="w-2.5 h-2.5" />
              <span>Geser Bebas / Klik</span>
            </div>

            <button
              onClick={() => {
                if (!isDraggingRef.current) {
                  setIsOpen((prev) => !prev);
                }
              }}
              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 shadow-2xl border-2 flex items-center justify-center transition-all focus:outline-hidden focus:ring-4 focus:ring-amber-400/40 cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: presetDetails.primary,
                borderColor: presetDetails.secondary,
              }}
              title="Quick Kasir & Status Cabang Su-Qur POS (Geser di layar HP / Klik)"
              aria-label="Floating Quick Kasir Menu"
            >
              {/* Glowing Aura Ring */}
              <div
                className="absolute inset-0 rounded-full blur-sm opacity-60 transition-all animate-pulse"
                style={{ backgroundColor: presetDetails.secondary }}
              />

              {/* Internal Icon Container */}
              <div
                className="relative w-full h-full rounded-full flex flex-col items-center justify-center"
                style={{ backgroundColor: presetDetails.primary }}
              >
                <Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 transition-transform group-hover:rotate-6" />
                <span className="text-[8.5px] font-black tracking-tighter text-amber-200 uppercase -mt-0.5">
                  Quick
                </span>
              </div>

              {/* Online Background Status Dot */}
              <div className="absolute top-0 right-0 w-4 h-4 rounded-full bg-[#1F1412] p-0.5 flex items-center justify-center">
                <span
                  className={`w-full h-full rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'
                  }`}
                />
                <span
                  className={`absolute w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
              </div>

              {/* Incoming QR/WA Orders Alert Badge */}
              {incomingOrdersCount > 0 && (
                <div className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-full bg-rose-600 border border-white text-white font-black text-[10px] shadow-lg animate-bounce">
                  {incomingOrdersCount}
                </div>
              )}

              {/* Pending Sync Alert Badge */}
              {pendingSyncCount > 0 && incomingOrdersCount === 0 && (
                <div className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 border border-[#1F1412] text-[#1F1412] font-black text-[10px] shadow-lg animate-pulse">
                  {pendingSyncCount}
                </div>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick Kasir & Status Cabang Pop-up Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-md bg-[#2B1713] border-2 border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header: User, Outlet & Live Status */}
              <div className="relative bg-gradient-to-r from-[#1F1412] via-[#3E2723] to-[#1F1412] p-4 sm:p-5 border-b border-amber-500/30 text-[#FAF3DD]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-md shrink-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-2xl bg-[#3E2723] flex items-center justify-center font-black text-amber-200 text-base">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-amber-200 leading-tight">
                          {user.name}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold uppercase border border-amber-500/30">
                          {user.role}
                        </span>
                      </div>
                      <p className="text-xs text-[#D7CCC8] flex items-center gap-1.5 mt-0.5">
                        <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-semibold text-amber-100 truncate max-w-[180px]">
                          {activeOutlet.name}
                        </span>
                        <span className="text-[10px] text-[#A1887F]">
                          ({activeOutlet.code || activeOutlet.type || 'CABANG'})
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-xl bg-[#4E342E]/70 hover:bg-[#4E342E] text-[#D7CCC8] hover:text-white transition-all cursor-pointer"
                    title="Tutup Quick Menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Background System Status Badge */}
                <div className="mt-3.5 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#1F1412]/80 border border-emerald-500/30 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isOnline ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </span>
                    <span className="font-bold text-emerald-300 truncate">
                      {isOnline
                        ? 'Sistem Berjalan di Latar Belakang (Online)'
                        : 'Mode Mandiri Lokal (Offline)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono shrink-0 font-bold">
                    {NativeOverlayBridge.isNative() ? '📱 Android Native APK' : '⚡ PWA Active'}
                  </span>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-[#D7CCC8]">
                {/* Temporary Notice Banner */}
                {noticeMessage && (
                  <div className="bg-amber-500/20 text-amber-200 border border-amber-500/40 p-3 rounded-2xl text-xs flex items-center gap-2 animate-fade-in">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{noticeMessage}</span>
                  </div>
                )}

                {/* 1. MASTER SWITCH & TOUCH POSITION CONTROLS */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#3E2723] to-[#2B1713] border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                        <Power className={`w-4 h-4 ${isEnabled ? 'text-amber-400' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <span className="font-bold text-amber-100 block text-xs">
                          Gelembung Melayang (Floating Widget)
                        </span>
                        <span className="text-[10px] text-[#A1887F]">
                          {isEnabled ? '🟢 Status: Aktif & Melayang di Layar' : '🔴 Status: Disembunyikan (OFF)'}
                        </span>
                      </div>
                    </div>

                    {/* Switch ON/OFF Toggle */}
                    <button
                      onClick={() => handleToggleEnabled(!isEnabled)}
                      className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isEnabled ? 'bg-emerald-600' : 'bg-[#1F1412]'
                      }`}
                      role="switch"
                      aria-checked={isEnabled}
                      title="Klik untuk mengaktifkan atau menyembunyikan gelembung melayang"
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Touch Drag & Position Reset Bar */}
                  <div className="pt-2 border-t border-[#4E342E] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10.5px] text-[#D7CCC8]/80">
                      <Move className="w-3.5 h-3.5 text-amber-400" />
                      <span>Dapat digeser bebas di seluruh layar HP</span>
                    </div>

                    <button
                      onClick={handleResetPosition}
                      className="px-2.5 py-1 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 font-bold text-[10.5px] flex items-center gap-1 border border-amber-500/30 transition-all cursor-pointer"
                      title="Kembalikan posisi gelembung ke pojok kanan bawah"
                    >
                      <RotateCcw className="w-3 h-3 text-amber-400" />
                      <span>Reset Posisi</span>
                    </button>
                  </div>
                </div>

                {/* 2. ANDROID NATIVE CAPACITOR & APK OVERLAY INTEGRATION */}
                <div className="p-3.5 rounded-2xl bg-[#1F1412]/90 border border-amber-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-amber-200 text-xs">
                        Persiapan APK Android & Floating Overlay
                      </span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                      Capacitor v8
                    </span>
                  </div>

                  <p className="text-[11px] text-[#D7CCC8]/80 leading-relaxed">
                    Saat aplikasi di-build menjadi file <strong>.APK Android</strong>, gelembung dapat melayang di luar aplikasi (Draw over other apps / <code>SYSTEM_ALERT_WINDOW</code>) dan menggunakan menu Action Sheet native.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Native Action Sheet Button */}
                    <button
                      onClick={handleOpenNativeActionSheet}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-[#1F1412] font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Action Sheet Android</span>
                    </button>

                    {/* Panduan Izin SYSTEM_ALERT_WINDOW */}
                    <button
                      onClick={() => setIsAndroidGuideOpen(!isAndroidGuideOpen)}
                      className="p-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Izin Tampil di Luar HP</span>
                    </button>
                  </div>

                  {/* Expandable Android Overlay Permission Guide */}
                  {isAndroidGuideOpen && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#2B1713] border border-amber-500/40 space-y-2 text-[11px] text-[#D7CCC8] animate-in fade-in">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#4E342E]">
                        <span className="font-bold text-amber-300 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Panduan Izin SYSTEM_ALERT_WINDOW
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setActiveGuideBrand('general')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activeGuideBrand === 'general' ? 'bg-amber-500 text-[#1F1412]' : 'bg-[#3E2723] text-gray-400'}`}
                          >
                            Umum
                          </button>
                          <button
                            onClick={() => setActiveGuideBrand('xiaomi')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activeGuideBrand === 'xiaomi' ? 'bg-amber-500 text-[#1F1412]' : 'bg-[#3E2723] text-gray-400'}`}
                          >
                            Xiaomi
                          </button>
                          <button
                            onClick={() => setActiveGuideBrand('samsung')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activeGuideBrand === 'samsung' ? 'bg-amber-500 text-[#1F1412]' : 'bg-[#3E2723] text-gray-400'}`}
                          >
                            Samsung
                          </button>
                        </div>
                      </div>

                      {activeGuideBrand === 'general' && (
                        <div className="space-y-1 text-[#D7CCC8]/90">
                          <p>1. Buka <strong>Pengaturan (Settings)</strong> HP Android Anda.</p>
                          <p>2. Pilih <strong>Aplikasi / Manajemen Aplikasi</strong> &gt; Pilih <strong>Su-Qur POS</strong>.</p>
                          <p>3. Cari menu <strong>Tampil di atas aplikasi lain (Draw over apps)</strong> lalu aktifkan ke posisi <strong>ON / IZINKAN</strong>.</p>
                        </div>
                      )}

                      {activeGuideBrand === 'xiaomi' && (
                        <div className="space-y-1 text-amber-200">
                          <p><strong>Khusus Xiaomi / Redmi / POCO (MIUI / HyperOS):</strong></p>
                          <p>1. Buka Info Aplikasi <strong>Su-Qur POS</strong> &gt; <strong>Izin Lainnya (Other Permissions)</strong>.</p>
                          <p>2. Aktifkan <strong>Tampilkan jendela pop-up saat berjalan di latar belakang</strong> (Centang Hijau).</p>
                          <p>3. Matikan <strong>Penghemat Baterai (Battery Saver: No Restrictions)</strong> agar gelembung selalu siap siaga.</p>
                        </div>
                      )}

                      {activeGuideBrand === 'samsung' && (
                        <div className="space-y-1 text-sky-200">
                          <p><strong>Khusus Samsung Galaxy (One UI):</strong></p>
                          <p>1. Buka Pengaturan &gt; Aplikasi &gt; Menu Titik Tiga (Kanan Atas) &gt; <strong>Akses Khusus</strong>.</p>
                          <p>2. Pilih <strong>Muncul di atas (Appear on top)</strong> &gt; Cari <strong>Su-Qur POS</strong> &gt; Aktifkan.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Quick Shift Status */}
                <div className="p-3.5 rounded-2xl bg-[#3E2723]/60 border border-[#5D4037] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1887F] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Status Shift Kasir
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                        activeShift
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {activeShift ? '🟢 Shift Sedang Aktif' : '🔴 Shift Belum Dibuka'}
                    </span>
                  </div>

                  {activeShift ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-[#2B1713]/80 p-2 rounded-xl border border-[#4E342E]">
                        <span className="text-[10px] text-[#A1887F] block">Mulai Shift</span>
                        <span className="font-bold text-amber-100">
                          {new Date(activeShift.startTime).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="bg-[#2B1713]/80 p-2 rounded-xl border border-[#4E342E]">
                        <span className="text-[10px] text-[#A1887F] block">Total Penjualan</span>
                        <span className="font-bold text-emerald-400">
                          Rp{' '}
                          {(
                            (activeShift.totalSalesCash || 0) +
                            (activeShift.totalSalesNonCash || 0)
                          ).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#D7CCC8]/80">
                      Buka shift kasir terlebih dahulu untuk mencatat modal kas masuk dan transaksi harian.
                    </p>
                  )}

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenShiftModal();
                    }}
                    className="w-full mt-1 py-2 px-3 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/30 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{activeShift ? 'Kelola / Tutup Shift' : 'Buka Shift Kasir Sekarang'}</span>
                  </button>
                </div>

                {/* 4. Quick Actions Grid */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1887F] block">
                    Aksi Cepat Kasir
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Buka POS Screen */}
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateTab('pos');
                      }}
                      className="p-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-[#1F1412] font-black text-xs flex flex-col items-start gap-1 shadow-md transition-all group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#1F1412]/15 flex items-center justify-center">
                        <Coffee className="w-4 h-4 text-[#1F1412]" />
                      </div>
                      <span className="text-sm">Buka Kasir POS</span>
                      <span className="text-[10px] font-semibold opacity-80">
                        Input pesanan baru
                      </span>
                    </button>

                    {/* Mode Kasir Fokus Toggle */}
                    <button
                      onClick={onToggleFocusMode}
                      className={`p-3 rounded-2xl border text-xs flex flex-col items-start gap-1 transition-all cursor-pointer ${
                        isFocusMode
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-[#3E2723]/60 border-[#5D4037] hover:bg-[#4E342E] text-[#D7CCC8]'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#2B1713] flex items-center justify-center">
                        <Zap
                          className={`w-4 h-4 ${
                            isFocusMode ? 'text-amber-400 fill-amber-400' : 'text-amber-300'
                          }`}
                        />
                      </div>
                      <span className="font-bold text-amber-100">
                        {isFocusMode ? 'Matikan Fokus' : 'Kasir Fokus'}
                      </span>
                      <span className="text-[10px] text-[#A1887F]">
                        {isFocusMode ? 'Mode Bebas Menu' : 'Mode Sentuh Penuh'}
                      </span>
                    </button>

                    {/* Buka Laci Uang (Drawer Pulse) */}
                    <button
                      onClick={handleKickDrawer}
                      disabled={isKickingDrawer}
                      className="p-3 rounded-2xl bg-[#3E2723]/60 hover:bg-[#4E342E] border border-[#5D4037] text-left transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#2B1713] flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="font-bold text-amber-100 block mt-1">
                        {isKickingDrawer ? 'Membuka Laci...' : 'Buka Laci Uang'}
                      </span>
                      <span className="text-[10px] text-[#A1887F]">Sinyal Laci Printer</span>
                    </button>

                    {/* Kunci Layar (Auto-Lock) */}
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onLockScreen();
                      }}
                      className="p-3 rounded-2xl bg-[#3E2723]/60 hover:bg-[#4E342E] border border-[#5D4037] text-left transition-all cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#2B1713] flex items-center justify-center">
                        <Lock className="w-4 h-4 text-rose-400" />
                      </div>
                      <span className="font-bold text-amber-100 block mt-1">Kunci Layar (PIN)</span>
                      <span className="text-[10px] text-[#A1887F]">Proteksi Layar Kasir</span>
                    </button>

                    {/* Mode Gelap / Terang Toggle Button */}
                    <button
                      onClick={handleToggleTheme}
                      className={`p-3 rounded-2xl border text-left transition-all col-span-2 cursor-pointer ${
                        isDark
                          ? 'bg-[#2B1713] border-amber-500/50 hover:bg-[#3E2723]'
                          : 'bg-[#3E2723]/60 border-[#5D4037] hover:bg-[#4E342E]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#1F1412] flex items-center justify-center">
                            {isDark ? (
                              <Moon className="w-4 h-4 text-amber-300 fill-amber-300/30" />
                            ) : (
                              <Sun className="w-4 h-4 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-amber-100 block text-xs">
                              {isDark ? 'Mode Gelap Aktif (Malam)' : 'Mode Terang Aktif (Siang)'}
                            </span>
                            <span className="text-[10px] text-[#A1887F]">
                              Klik untuk beralih ke {isDark ? 'Mode Terang' : 'Mode Gelap (Malam)'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1F1412] text-amber-300 border border-amber-500/30 font-bold">
                          {isDark ? '🌙 DARK' : '☀️ LIGHT'}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 5. Ganti Cabang / Switch Outlet */}
                {outlets.length > 1 && (
                  <div className="p-3 rounded-2xl bg-[#3E2723]/40 border border-[#5D4037] space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1887F] block">
                      Pindah Cabang Cepat
                    </span>
                    <select
                      value={activeOutlet.id}
                      onChange={(e) => onSwitchOutlet(e.target.value)}
                      className="w-full bg-[#1F1412] text-amber-100 text-xs font-semibold px-3 py-2 rounded-xl border border-amber-500/30 focus:outline-hidden focus:border-amber-400"
                    >
                      {outlets.map((out) => (
                        <option key={out.id} value={out.id}>
                          {out.name} ({out.type || 'OUTLET'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 6. Background Service & Push Notification Control */}
                <div className="p-3.5 rounded-2xl bg-[#1F1412]/90 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span className="font-bold text-amber-200">Push Notification & Suara</span>
                    </div>
                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold ${
                        notificationPermission === 'granted'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {notificationPermission === 'granted' ? 'Aktif (Izinkan)' : 'Belum Aktif'}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#A1887F] leading-relaxed">
                    Menerima notifikasi otomatis ke HP saat pesanan QR Meja atau WhatsApp masuk,
                    meskipun browser sedang di-minimize.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    {notificationPermission !== 'granted' ? (
                      <button
                        onClick={handleRequestNotification}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1F1412] font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Izinkan Notifikasi HP</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleTestSoundAndNotif}
                        disabled={isTestingNotif}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/30 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isTestingNotif ? 'Membunyikan...' : 'Tes Suara Bel & Notif'}</span>
                      </button>
                    )}

                    {pendingSyncCount > 0 && (
                      <button
                        onClick={handleSyncClick}
                        disabled={isSyncing}
                        className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        title="Upload transaksi offline"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>Sync ({pendingSyncCount})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer with Floating Switch summary & Dashboard shortcut */}
              <div className="p-3 bg-[#1F1412] border-t border-[#4E342E] flex items-center justify-between text-[11px] text-[#A1887F]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Su-Qur POS v2.6 • Touch & Overlay Ready</span>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateTab('dashboard');
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  Dashboard <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
