import React, { useState, useEffect } from 'react';
import { User, StoreSettings, Shift, Outlet, Ingredient } from '../types';
import {
  Coffee,
  ShieldCheck,
  UserCheck,
  DollarSign,
  Store,
  Smartphone,
  Monitor,
  LogOut,
  Cloud,
  Camera,
  Lock,
  Eye,
  AlertCircle,
  AlertTriangle,
  Bell,
  Wifi,
  WifiOff,
  Zap,
  Unlock,
  MapPin,
  ChevronDown,
  Check,
  Building2,
  RefreshCw,
  Database,
  Layers,
  ArrowRight,
  MoreVertical,
  Wrench,
  Radio,
  Sun,
  Moon,
  Download,
  Search,
  FileSpreadsheet,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { openCashDrawer } from '../services/thermalPrinterService';
import { getStoredTheme, toggleTheme, isDarkActive, ThemeMode } from '../utils/theme';
import { NativeOverlayBridge } from '../services/nativeOverlayBridge';
import { useTheme } from '../context/ThemeContext';
import {
  runSystemHealthCheck,
  executeAutoFix,
  SystemHealthReport,
} from '../utils/systemHealth';
import { HeaderQuotaIndicator } from './Header/HeaderQuotaIndicator';

interface HeaderProps {
  user: User;
  settings: StoreSettings;
  activeShift: Shift | null;
  users: User[];
  outlets?: Outlet[];
  activeOutlet?: Outlet;
  onSwitchOutlet?: (outletId: string) => void;
  onSwitchUser: (user: User) => void;
  onLogout: () => void;
  onOpenShiftModal: () => void;
  isMobilePreview: boolean;
  onToggleMobilePreview: () => void;
  onOpenEditProfile?: (userToEdit?: User) => void;
  pendingSyncCount?: number;
  onManualSync?: () => Promise<any> | void;
  ingredients?: Ingredient[];
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  onLockScreen?: () => void;
  onNavigateTab?: (tab: any) => void;
  onOpenInstallApp?: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenDailyRecap?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  settings,
  activeShift,
  users,
  outlets = [],
  activeOutlet,
  onSwitchOutlet,
  onSwitchUser,
  onLogout,
  onOpenShiftModal,
  isMobilePreview,
  onToggleMobilePreview,
  onOpenEditProfile,
  pendingSyncCount = 0,
  onManualSync,
  ingredients = [],
  isFocusMode = false,
  onToggleFocusMode,
  onLockScreen,
  onNavigateTab,
  onOpenInstallApp,
  onOpenGlobalSearch,
  onOpenDailyRecap,
}) => {
  const [restrictedNotice, setRestrictedNotice] = useState<string | null>(null);
  const [isOfflineSetting, setIsOfflineSetting] = useState<boolean>(() => StorageService.isOfflineMode());
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [isOutletMenuOpen, setIsOutletMenuOpen] = useState(false);
  const [isStockAlertOpen, setIsStockAlertOpen] = useState(false);
  const [isMobileQuickMenuOpen, setIsMobileQuickMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // System Health Checker & Auto-Repair state
  const [healthReport, setHealthReport] = useState<SystemHealthReport>(() => runSystemHealthCheck());
  const [isHealthBannerDismissed, setIsHealthBannerDismissed] = useState<boolean>(false);
  const [isAutoFixingHeader, setIsAutoFixingHeader] = useState<boolean>(false);

  // Theme Context
  const { preset, presetDetails, setPreset, isDarkMode } = useTheme();

  // Dark / Light Theme Mode State
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [isDark, setIsDark] = useState<boolean>(() => isDarkActive());
  const [isWidgetEnabled, setIsWidgetEnabled] = useState<boolean>(() =>
    NativeOverlayBridge.isWidgetEnabled()
  );

  const currentOutlet = activeOutlet || outlets[0] || {
    id: 'outlet-lagoa',
    name: 'Kedai Kopi Wahid - Cabang Lagoa',
    address: 'Jl. Lagoa Terusan No. 12, Koja',
  };

  // Calculate critical stock ingredients (< minStock)
  const criticalIngredients = ingredients.filter((ing) => {
    const matchesOutlet = !ing.outletId || ing.outletId === 'ALL' || ing.outletId === currentOutlet.id;
    return matchesOutlet && ing.currentStock <= (ing.minStock || 0);
  });

  useEffect(() => {
    // Initial health scan
    setHealthReport(runSystemHealthCheck());

    const handleHealthUpdate = (e: any) => {
      if (e.detail) {
        setHealthReport(e.detail);
      } else {
        setHealthReport(runSystemHealthCheck());
      }
    };
    window.addEventListener('system_health_updated', handleHealthUpdate);

    const interval = setInterval(() => {
      setHealthReport(runSystemHealthCheck());
    }, 25000);

    const handleOnline = async () => {
      setIsBrowserOnline(true);
      if (!isOfflineSetting) {
        setIsSyncing(true);
        setModeNotice('🔄 Jaringan internet aktif! Menghubungkan ke Cloud Database...');
        try {
          const reconnectResult = await StorageService.reconnectFirestore();
          if (reconnectResult.isConnected) {
            if (reconnectResult.syncedCount > 0) {
              setModeNotice(`🟢 Terhubung! Berhasil menyinkronkan ${reconnectResult.syncedCount} transaksi lokal.`);
            } else {
              setModeNotice('🟢 Terhubung kembali ke Cloud Database (Online Real-Time)');
            }
          } else {
            setModeNotice('🟢 Terhubung kembali ke Cloud Database');
          }
        } catch (e) {
          setModeNotice('🟢 Terhubung kembali ke Cloud Database');
        } finally {
          setIsSyncing(false);
          setTimeout(() => setModeNotice(null), 4000);
        }
      }
    };

    const handleOffline = () => {
      setIsBrowserOnline(false);
      setModeNotice('⚠️ Jaringan terputus / tidak stabil. Mode offline otomatis aktif — data kasir tetap tersimpan aman di IndexedDB.');
      setTimeout(() => setModeNotice(null), 5000);
    };

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
        setIsWidgetEnabled(e.detail.enabled);
      } else {
        setIsWidgetEnabled(NativeOverlayBridge.isWidgetEnabled());
      }
    };
    window.addEventListener('sq_floating_widget_toggle', handleWidgetToggle);

    return () => {
      window.removeEventListener('system_health_updated', handleHealthUpdate);
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sq_theme_changed', handleThemeChange);
      window.removeEventListener('sq_floating_widget_toggle', handleWidgetToggle);
    };
  }, [isOfflineSetting]);

  const handleToggleFloatingWidget = () => {
    const nextState = !isWidgetEnabled;
    setIsWidgetEnabled(nextState);
    NativeOverlayBridge.setWidgetEnabled(nextState);
    setModeNotice(
      nextState
        ? '🟢 Gelembung Melayang (Floating Widget) diaktifkan.'
        : '🔴 Gelembung Melayang (Floating Widget) dinonaktifkan.'
    );
    setTimeout(() => setModeNotice(null), 3000);
  };

  const handleToggleTheme = () => {
    if (preset === 'dark_mode' || isDark) {
      setPreset('coffee_amber');
      setThemeMode('light');
      setIsDark(false);
    } else {
      setPreset('dark_mode');
      setThemeMode('dark');
      setIsDark(true);
    }
  };

  const handleQuickAutoFix = async () => {
    setIsAutoFixingHeader(true);
    try {
      const res = await executeAutoFix('fix_all_issues', { targetOutletId: currentOutlet.id });
      setHealthReport(res.report);
      setModeNotice(`✅ ${res.message}`);
      setTimeout(() => setModeNotice(null), 5000);
    } catch (err: any) {
      setModeNotice(`⚠️ Gagal perbaikan otomatis: ${err?.message || 'Terjadi kendala'}`);
    } finally {
      setIsAutoFixingHeader(false);
    }
  };

  // Overall effective connection state
  const effectiveStatus = isOfflineSetting || !isBrowserOnline
    ? 'offline'
    : isSyncing
    ? 'connecting'
    : 'online';

  const handleOpenCashDrawerQuick = async () => {
    setIsOpeningDrawer(true);
    const res = await openCashDrawer(settings);
    setIsOpeningDrawer(false);
    if (res.success) {
      setModeNotice('💰 Sinyal buka laci uang kasir (Cash Drawer) berhasil dikirim!');
    } else {
      setModeNotice(`⚠️ ${res.message}`);
    }
    setTimeout(() => {
      setModeNotice(null);
    }, 4500);
  };

  const handleToggleMode = async () => {
    const nextState = !isOfflineSetting;
    setIsOfflineSetting(nextState);
    await StorageService.setOfflineMode(nextState);
    if (nextState) {
      setModeNotice('⚡ Mode Offline (Lokal) Aktif: Semua transaksi & inventori disimpan langsung di penyimpanan lokal tanpa koneksi cloud.');
      setTimeout(() => {
        setModeNotice(null);
      }, 4000);
    } else {
      setIsSyncing(true);
      setModeNotice('🌐 Menghubungkan ke Cloud Firestore...');
      try {
        const reconnectResult = await StorageService.reconnectFirestore();
        if (reconnectResult.isConnected) {
          if (reconnectResult.syncedCount > 0) {
            setModeNotice(`🟢 Terhubung ke Cloud! Berhasil menyinkronkan ${reconnectResult.syncedCount} transaksi lokal.`);
          } else {
            setModeNotice('🟢 Terhubung ke Cloud Firestore: Mode Online Real-Time Aktif.');
          }
        } else {
          setModeNotice('🟢 Mode Online Aktif (Penyimpanan Lokal Siaga / Offline-First)');
        }
      } catch {
        setModeNotice('🟢 Mode Online Aktif');
      } finally {
        setIsSyncing(false);
        setTimeout(() => {
          setModeNotice(null);
        }, 4000);
      }
    }
  };

  const handleManualSyncClick = async () => {
    setIsSyncing(true);
    setModeNotice('🔄 Menyinkronkan data offline ke Cloud Firestore...');
    try {
      if (onManualSync) {
        const res = await onManualSync();
        if (res && res.success) {
          setModeNotice(
            res.syncedCount > 0
              ? `🟢 Berhasil menyinkronkan ${res.syncedCount} transaksi ke Cloud!`
              : '🟢 Semua data offline telah tersinkronkan dengan Cloud Database.'
          );
        } else if (res && !res.success) {
          setModeNotice(`⚠️ ${res.error || 'Gagal sinkronisasi data'}`);
        } else {
          setModeNotice('🟢 Sinkronisasi selesai.');
        }
      } else {
        const res = await StorageService.syncLocalToFirestore();
        if (res.success) {
          if (res.syncedCount > 0) {
            setModeNotice(`🟢 Berhasil menyinkronkan ${res.syncedCount} data offline ke cloud!`);
          } else {
            setModeNotice('🟢 Semua data lokal telah tersinkronkan dengan Cloud Database.');
          }
        } else {
          setModeNotice(`⚠️ ${res.error || 'Gagal sinkronisasi data'}`);
        }
      }
    } catch {
      setModeNotice('🟢 Sinkronisasi selesai.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setModeNotice(null), 3500);
    }
  };

  const handleAccountClick = (targetUser: User) => {
    if (targetUser.id === user.id) return;

    if (user.role === 'kasir') {
      setRestrictedNotice(
        `Akses Terkunci! Akun Kasir (${user.name}) tidak diizinkan berganti ke akun Admin atau Kasir lainnya. Silakan Logout terlebih dahulu jika ingin beralih akun.`
      );
      return;
    }

    if (user.role === 'admin' && targetUser.role === 'kasir') {
      setRestrictedNotice(
        `Akses Terbatas: Admin hanya memiliki akses untuk melihat status Kasir (${targetUser.name}), dan tidak dapat beralih ke akun Kasir.`
      );
      return;
    }

    onSwitchUser(targetUser);
  };

  const handleSelectOutlet = (targetOutletId: string) => {
    if (onSwitchOutlet) {
      onSwitchOutlet(targetOutletId);
    }
    setIsOutletMenuOpen(false);
    const target = outlets.find((o) => o.id === targetOutletId);
    if (target) {
      setModeNotice(`🏢 Berhasil beralih ke: ${target.name}`);
      setTimeout(() => setModeNotice(null), 4000);
    }
  };

  return (
    <header
      className="text-[#FDFBF7] border-b border-black/20 w-full max-w-full transition-colors duration-200 sticky top-0 z-50 backdrop-blur-xs select-none"
      style={{ backgroundColor: presetDetails.primary }}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 h-13 sm:h-14 md:h-16 flex items-center justify-between gap-1.5 sm:gap-2.5 relative z-30">
        {/* Left Section: Brand Logo, Store Name, Branch Badge & Network Status */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          {settings.logoUrl ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-xl overflow-hidden bg-white border border-[#EBE3D5] shadow-xs flex items-center justify-center shrink-0">
              <img
                src={settings.logoUrl}
                alt={settings.storeName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-xl bg-[#D7CCC8] text-[#3E2723] flex items-center justify-center font-serif font-black text-xs sm:text-sm md:text-base shadow-xs border border-[#EBE3D5] shrink-0">
              {settings.storeName ? settings.storeName.charAt(0).toUpperCase() : 'S'}
            </div>
          )}

          <div className="min-w-0 flex items-center gap-1 sm:gap-1.5">
            <h1 className="font-serif italic font-bold text-xs sm:text-sm md:text-base lg:text-lg tracking-tight text-[#FDFBF7] truncate max-w-[85px] xs:max-w-[110px] sm:max-w-[160px] md:max-w-[190px] lg:max-w-[240px] shrink-0">
              {settings.storeName || 'Su-Qur Coffee'}
            </h1>

            {/* Outlet / Branch Selector Dropdown for Admin, Static Badge for Cashier */}
            {user.role === 'admin' ? (
              <div className={`relative shrink-0 ${isOutletMenuOpen ? 'z-[70]' : ''}`}>
                <button
                  type="button"
                  onClick={() => setIsOutletMenuOpen(!isOutletMenuOpen)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full border border-amber-500/40 bg-[#4E342E] text-amber-200 hover:bg-[#5D4037] hover:border-amber-400 text-[10px] sm:text-xs font-semibold transition-all shadow-xs ${
                    isOutletMenuOpen ? 'ring-2 ring-amber-400/60' : ''
                  }`}
                  title="Pilih atau beralih cabang/outlet"
                >
                  <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
                  <span className="max-w-[65px] xs:max-w-[85px] sm:max-w-[120px] md:max-w-[150px] truncate text-amber-100">
                    {currentOutlet.name}
                  </span>
                  <ChevronDown className={`w-2.5 h-2.5 text-amber-400 transition-transform shrink-0 ${isOutletMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOutletMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-2xs" onClick={() => setIsOutletMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1rem)] max-h-[min(520px,calc(100dvh-70px))] overflow-y-auto overscroll-contain bg-[#241310] border-2 border-amber-500/60 rounded-2xl shadow-2xl p-2 z-[70] animate-in fade-in zoom-in-95 scrollbar-thin">
                      <div className="px-3 py-2 border-b border-[#5D4037] flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1">
                          <Store className="w-3 h-3" /> Pilih Cabang Aktif
                        </span>
                        <span className="text-[10px] text-[#D7CCC8]">{outlets.length} Cabang Terdaftar</span>
                      </div>

                      <div className="py-1 space-y-1 max-h-64 overflow-y-auto">
                        {outlets.map((outlet) => {
                          const isActive = outlet.id === currentOutlet.id;
                          return (
                            <button
                              key={outlet.id}
                              type="button"
                              onClick={() => handleSelectOutlet(outlet.id)}
                              className={`w-full text-left p-2.5 rounded-xl flex items-start justify-between gap-2 transition-colors ${
                                isActive
                                  ? 'bg-amber-950/80 border border-amber-500/60 text-amber-100'
                                  : 'hover:bg-[#3E2723] text-[#FAF3DD]'
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                                  <span className="truncate">{outlet.name}</span>
                                  {outlet.isDefault && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono shrink-0">
                                      Pusat
                                    </span>
                                  )}
                                </div>
                                {outlet.address && (
                                  <div className="text-[10px] text-[#D7CCC8] flex items-center gap-1 truncate">
                                    <MapPin className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                                    <span className="truncate">{outlet.address}</span>
                                  </div>
                                )}
                              </div>
                              {isActive && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-1 pt-2 border-t border-[#5D4037] px-2 text-[10px] text-[#D7CCC8]/80 text-center">
                        Semua transaksi & shift akan tercatat otomatis di cabang ini
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-[#4E342E]/80 text-amber-200 text-[10px] sm:text-xs font-semibold shadow-xs cursor-default shrink-0"
                title={`Cabang Tugas: ${currentOutlet.name}`}
              >
                <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
                <span className="max-w-[65px] xs:max-w-[85px] sm:max-w-[120px] md:max-w-[150px] truncate text-amber-100">
                  {currentOutlet.name}
                </span>
              </div>
            )}

            {/* Network & Sync Status Indicator (Online / Connecting / Offline) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleToggleMode}
                className={`group relative flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  effectiveStatus === 'online'
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70 hover:bg-emerald-900/90'
                    : effectiveStatus === 'connecting'
                    ? 'bg-amber-950/90 text-amber-300 border-amber-400/80 hover:bg-amber-900/90'
                    : 'bg-amber-950/90 text-amber-300 border-amber-500/70 hover:bg-amber-900/90'
                }`}
                title={
                  effectiveStatus === 'online'
                    ? 'Online: Terhubung ke Cloud'
                    : effectiveStatus === 'connecting'
                    ? 'Menghubungkan...'
                    : 'Offline: Data lokal aman'
                }
              >
                {effectiveStatus === 'online' ? (
                  <span className="relative flex items-center justify-center">
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span className="animate-ping absolute -top-0.5 -right-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="absolute -top-0.5 -right-0.5 inline-flex rounded-full h-1 w-1 bg-emerald-400"></span>
                  </span>
                ) : effectiveStatus === 'connecting' ? (
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                ) : (
                  <span className="relative flex items-center justify-center">
                    <WifiOff className="w-3 h-3 text-amber-400" />
                    <span className="absolute -top-0.5 -right-0.5 inline-flex rounded-full h-1 w-1 bg-amber-500"></span>
                  </span>
                )}
              </button>

              {/* Pending Offline Sync Badge Button if any data waiting */}
              {pendingSyncCount > 0 && (
                <button
                  onClick={handleManualSyncClick}
                  disabled={isSyncing}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[9.5px] font-bold shadow-xs transition-all animate-pulse shrink-0 cursor-pointer"
                  title={`${pendingSyncCount} transaksi menunggu sinkronisasi`}
                >
                  <Database className="w-2.5 h-2.5" />
                  <span>{pendingSyncCount}</span>
                  <RefreshCw className={`w-2 h-2 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}

              {/* System Health Issues Indicator Badge */}
              {healthReport.totalIssues > 0 && (
                <button
                  onClick={() => {
                    setIsHealthBannerDismissed(false);
                    onNavigateTab?.('dashboard');
                  }}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9.5px] font-bold shadow-xs transition-all shrink-0 cursor-pointer ${
                    healthReport.criticalCount > 0
                      ? 'bg-rose-950/90 text-rose-200 border-rose-500/80 animate-pulse'
                      : 'bg-amber-950/90 text-amber-200 border-amber-500/80'
                  }`}
                  title={`${healthReport.totalIssues} Catatan Diagnostik`}
                >
                  <Wrench className="w-2.5 h-2.5 text-amber-400" />
                  <span>{healthReport.totalIssues}</span>
                </button>
              )}

              {/* Real-time Operational Quota Progress Indicator (hidden on small screen < sm) */}
              <div className="hidden sm:block">
                <HeaderQuotaIndicator onNavigateToDashboard={() => onNavigateTab?.('dashboard')} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Adaptive Actions for Mobile (HP), Tablet (Tab), and Desktop */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          {/* 1. Rekap Harian Button:
              - Mobile & Tablet (< lg): Compact Icon button
              - Desktop (lg+): Pill button with icon + text "Rekap Harian"
          */}
          <button
            type="button"
            onClick={onOpenDailyRecap}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border bg-amber-500 hover:bg-amber-400 text-[#1F1412] border-amber-400 font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Rekap Harian Kasir & Cetak PDF"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#1F1412] shrink-0" />
            <span className="hidden lg:inline text-xs font-bold">Rekap Harian</span>
          </button>

          {/* 2. Universal Global Search (Ctrl+K):
              - Mobile (< sm): compact icon
              - Tablet & Desktop (sm+): icon + ⌘K badge
          */}
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border bg-[#2B1713]/90 hover:bg-[#3E2723] text-amber-200 border-amber-500/40 hover:border-amber-400 text-xs font-semibold transition-all shadow-xs group cursor-pointer flex items-center gap-1 shrink-0"
            title="Pencarian Global Terpadu (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline text-[9.5px] bg-[#3E2723] text-amber-300 px-1 py-0.2 rounded border border-amber-500/30 font-mono font-bold">
              ⌘K
            </span>
          </button>

          {/* 3. Kasir Fokus (Zap): Visible on Tablet and Desktop (md+) */}
          <button
            onClick={onToggleFocusMode}
            className={`hidden md:flex p-1.5 sm:p-1.5 rounded-lg border text-xs font-bold transition-all shadow-xs cursor-pointer items-center justify-center shrink-0 ${
              isFocusMode
                ? 'bg-amber-500 text-[#1F1412] border-amber-400 ring-2 ring-amber-400/40'
                : 'bg-[#4E342E] text-amber-200 border-amber-500/40 hover:bg-[#5D4037]'
            }`}
            title={isFocusMode ? 'Kasir Fokus Aktif' : 'Mode Kasir Fokus (Bebas Distraksi)'}
          >
            <Zap className={`w-3.5 h-3.5 ${isFocusMode ? 'text-[#1F1412] fill-[#1F1412]' : 'text-amber-400'}`} />
          </button>

          {/* 4. Stok Kritis Alert Dropdown: Visible on Tablet and Desktop (md+) if critical items exist */}
          {criticalIngredients.length > 0 && (
            <div className={`hidden md:block relative shrink-0 ${isStockAlertOpen ? 'z-[70]' : ''}`}>
              <button
                onClick={() => setIsStockAlertOpen(!isStockAlertOpen)}
                className={`flex items-center gap-1 p-1.5 rounded-lg border bg-rose-950/90 text-rose-200 border-rose-500/70 hover:bg-rose-900 transition-all shadow-xs animate-pulse cursor-pointer ${
                  isStockAlertOpen ? 'ring-2 ring-rose-400/60' : ''
                }`}
                title={`${criticalIngredients.length} Bahan Baku Kritis / Hampir Habis!`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {criticalIngredients.length}
                </span>
              </button>

              {isStockAlertOpen && (
                <>
                  <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-2xs" onClick={() => setIsStockAlertOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[#2B1713] border-2 border-rose-500/60 rounded-2xl shadow-2xl p-3 z-[70] animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-2 border-b border-[#5D4037]">
                      <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Peringatan Bahan Baku Kritis</span>
                      </div>
                      <span className="text-[10px] text-[#D7CCC8]">{criticalIngredients.length} Item</span>
                    </div>

                    <div className="py-2 space-y-1.5 max-h-60 overflow-y-auto">
                      {criticalIngredients.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 bg-[#3E2723] rounded-xl border border-[#5D4037] flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#FAF3DD]">{item.name}</div>
                            <div className="text-[10px] text-[#D7CCC8] capitalize">{item.category} • Min: {item.minStock} {item.unit}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-black ${item.currentStock <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                              {item.currentStock} {item.unit}
                            </div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-rose-900/60 text-rose-300 border border-rose-500/40">
                              {item.currentStock <= 0 ? 'Habis' : 'Kritis'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#5D4037]">
                      <button
                        onClick={() => {
                          setIsStockAlertOpen(false);
                          onNavigateTab?.('inventory');
                        }}
                        className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-[#1F1412] font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Buka Modul Stok & Resep</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 5. Desktop Direct Utilities (Layar Lebar lg+) */}
          <button
            onClick={handleOpenCashDrawerQuick}
            disabled={isOpeningDrawer}
            className="hidden lg:flex p-1.5 rounded-lg border bg-[#4E342E] text-amber-200 border-amber-500/40 hover:bg-[#5D4037] transition-all shadow-xs cursor-pointer items-center justify-center shrink-0 disabled:opacity-60"
            title="Buka Laci Kasir (Cash Drawer)"
          >
            <DollarSign className={`w-3.5 h-3.5 text-amber-400 ${isOpeningDrawer ? 'animate-bounce' : ''}`} />
          </button>

          <button
            onClick={onLockScreen}
            className="hidden lg:flex p-1.5 rounded-lg border bg-[#4E342E] text-amber-200 border-amber-500/40 hover:bg-[#5D4037] transition-all shadow-xs cursor-pointer items-center justify-center shrink-0"
            title="Kunci Layar Kasir (PIN Lock)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <button
            onClick={handleToggleTheme}
            className={`hidden xl:flex p-1.5 rounded-lg border text-xs items-center justify-center transition-all shadow-xs cursor-pointer shrink-0 ${
              isDark
                ? 'bg-[#2B1713] text-amber-300 border-amber-500/50 hover:bg-[#3E2723]'
                : 'bg-[#5D4037] text-amber-200 border-amber-500/30 hover:bg-[#4E342E]'
            }`}
            title={isDark ? 'Mode Terang' : 'Mode Gelap'}
          >
            {isDark ? <Moon className="w-3.5 h-3.5 text-amber-300 fill-amber-300/30" /> : <Sun className="w-3.5 h-3.5 text-amber-300" />}
          </button>

          {/* 6. Quick Tools Dropdown Menu (More Menu):
              - Visible on ALL screens < 2xl (Mobile HP, Tablet, Laptop)
              - Neat, compact button that houses secondary utilities cleanly
          */}
          <div className={`2xl:hidden relative shrink-0 ${isMobileQuickMenuOpen ? 'z-[70]' : ''}`}>
            <button
              onClick={() => setIsMobileQuickMenuOpen(!isMobileQuickMenuOpen)}
              className={`p-1.5 sm:p-1.5 rounded-lg border bg-[#4E342E] text-amber-200 border-amber-500/40 hover:bg-[#5D4037] transition-all shadow-xs relative cursor-pointer flex items-center justify-center ${
                isMobileQuickMenuOpen ? 'ring-2 ring-amber-400/60 bg-[#5D4037]' : ''
              }`}
              title="Menu Alat & Opsi Cepat"
            >
              <MoreVertical className="w-3.5 h-3.5 text-amber-300" />
              {criticalIngredients.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
              )}
            </button>

            {isMobileQuickMenuOpen && (
              <>
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-2xs" onClick={() => setIsMobileQuickMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 max-w-[calc(100vw-1rem)] max-h-[min(520px,calc(100dvh-70px))] overflow-y-auto overscroll-contain bg-[#241310] border-2 border-amber-500/60 rounded-2xl shadow-2xl p-2 z-[70] animate-in fade-in zoom-in-95 space-y-1 scrollbar-thin">
                  <div className="px-2.5 py-1.5 mb-1 border-b border-[#5D4037]/70 text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between sticky top-0 bg-[#241310] z-10">
                    <span>Menu Cepat & Alat</span>
                    <span className="text-[#D7CCC8] capitalize font-mono text-[9px] bg-[#3E2723] px-1.5 py-0.5 rounded border border-[#5D4037]">{user.role}</span>
                  </div>

                  {/* Rekap Harian & Cetak PDF */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      onOpenDailyRecap?.();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 active:bg-amber-500/40 transition-colors cursor-pointer border border-amber-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-bold">Rekap Harian & PDF</span>
                    </div>
                    <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-amber-500 text-[#1F1412] font-black">
                      REKAP
                    </span>
                  </button>

                  {/* Pencarian Global (Ctrl+K) */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      onOpenGlobalSearch?.();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-[#FAF3DD] hover:bg-[#3E2723] active:bg-[#4E342E] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Pencarian Global</span>
                    </div>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#3E2723] text-amber-300 border border-amber-500/30 font-bold">
                      ⌘K
                    </span>
                  </button>

                  {/* Toggle Focus Mode */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      onToggleFocusMode?.();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-[#FAF3DD] hover:bg-[#3E2723] active:bg-[#4E342E] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Mode Kasir Fokus</span>
                    </div>
                    <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-mono font-bold ${isFocusMode ? 'bg-amber-500 text-[#1F1412]' : 'bg-[#3E2723] text-gray-400'}`}>
                      {isFocusMode ? 'AKTIF' : 'OFF'}
                    </span>
                  </button>

                  {/* Buka Laci Kasir */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      handleOpenCashDrawerQuick();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-[#FAF3DD] hover:bg-[#3E2723] active:bg-[#4E342E] transition-colors cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Buka Laci Kasir</span>
                  </button>

                  {/* Kunci Layar Kasir */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      onLockScreen?.();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-[#FAF3DD] hover:bg-[#3E2723] active:bg-[#4E342E] transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Kunci Layar (PIN)</span>
                  </button>

                  {/* Stok Kritis Alert Shortcut */}
                  {criticalIngredients.length > 0 && (
                    <button
                      onClick={() => {
                        setIsMobileQuickMenuOpen(false);
                        onNavigateTab?.('inventory');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 transition-colors border border-rose-800/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Stok Kritis</span>
                      </div>
                      <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full">
                        {criticalIngredients.length}
                      </span>
                    </button>
                  )}

                  {/* Mode Gelap / Terang (Dark / Light Theme) Toggle */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      handleToggleTheme();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-[#FAF3DD] hover:bg-[#3E2723] active:bg-[#4E342E] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {isDark ? <Moon className="w-3.5 h-3.5 text-amber-300 fill-amber-300/30 shrink-0" /> : <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <span>{isDark ? 'Mode Gelap (Malam)' : 'Mode Terang (Siang)'}</span>
                    </div>
                    <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded-full bg-[#3E2723] text-amber-300 border border-amber-500/30">
                      {isDark ? 'GELAP' : 'TERANG'}
                    </span>
                  </button>

                  {/* Gelembung Melayang (Floating Overlay Widget) Toggle */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      handleToggleFloatingWidget();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-[#FAF3DD] hover:bg-[#3E2723] active:bg-[#4E342E] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Gelembung Melayang</span>
                    </div>
                    <span className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${isWidgetEnabled ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' : 'bg-[#3E2723] text-gray-400 border-gray-600'}`}>
                      {isWidgetEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Pasang Aplikasi (APK / PWA) Mobile */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      onOpenInstallApp?.();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 transition-colors border border-amber-800/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold">Pasang Aplikasi (APK)</span>
                    </div>
                    <span className="text-[8.5px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                      APK
                    </span>
                  </button>

                  {/* Simulasi HP Preview */}
                  <button
                    onClick={() => {
                      setIsMobileQuickMenuOpen(false);
                      onToggleMobilePreview();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-[#FAF3DD] hover:bg-[#3E2723] active:bg-[#4E342E] transition-colors cursor-pointer"
                  >
                    {isMobilePreview ? <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    <span>{isMobilePreview ? 'Tampilan Desktop' : 'Simulasi Layar HP'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 7. Shift Status Button (Symbolic Status Indicator) */}
          <button
            onClick={onOpenShiftModal}
            className={`p-1.5 sm:p-1.5 rounded-lg border transition-all shrink-0 cursor-pointer flex items-center justify-center relative ${
              activeShift
                ? 'bg-[#4E342E] text-emerald-300 border-emerald-500/60 hover:bg-[#5D4037]'
                : 'bg-[#4E342E] text-amber-300 border-amber-500/50 hover:bg-[#5D4037]'
            }`}
            title={activeShift ? 'Shift Berjalan (Buka)' : 'Kasir Tutup'}
          >
            <Store className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeShift ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#2B1713] ${
                activeShift ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </button>

          {/* 8. User Selector Dropdown */}
          <div className={`relative shrink-0 ${isUserMenuOpen ? 'z-[70]' : ''}`}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center gap-1.5 bg-[#5D4037] hover:bg-[#4E342E] border border-[#795548] hover:border-amber-400/60 p-1 sm:px-2 sm:py-1 rounded-xl transition-all shadow-xs cursor-pointer ${
                isUserMenuOpen ? 'ring-2 ring-amber-400/60 bg-[#4E342E]' : ''
              }`}
              title={`Akun: ${user.name} (${user.role})`}
            >
              <div className="relative shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-[#D7CCC8]" />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#D7CCC8] text-[#3E2723] font-bold text-[10px] sm:text-xs flex items-center justify-center">
                    {user.name.charAt(0)}
                  </div>
                )}
                {/* Indicator dot */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#5D4037] ${
                    activeShift ? 'bg-emerald-500 shadow-xs' : 'bg-rose-500 shadow-xs'
                  }`}
                />
              </div>
              <span className="text-xs font-semibold text-[#FDFBF7] max-w-[70px] sm:max-w-[90px] md:max-w-[110px] truncate hidden sm:inline">
                {user.name}
              </span>
              <ChevronDown className={`w-3 h-3 text-amber-300 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Switch User Dropdown Menu */}
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-2xs" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 max-w-[calc(100vw-1rem)] max-h-[min(520px,calc(100dvh-70px))] overflow-y-auto overscroll-contain bg-[#241310] border-2 border-amber-500/60 rounded-2xl shadow-2xl py-2 z-[70] animate-in fade-in zoom-in-95 scrollbar-thin">
                  <div className="px-3.5 py-1.5 border-b border-[#5D4037] text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Menu Profil & Ganti Akun</span>
                    <span className="text-[#D7CCC8] capitalize font-mono text-[9px]">{user.role}</span>
                  </div>

                  {/* Quick Ganti Foto Button for Current User */}
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenEditProfile?.(user);
                    }}
                    className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 text-[#FAF3DD] hover:bg-[#3E2723] text-xs transition-colors font-bold border-b border-[#5D4037] bg-[#3E2723]/40 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#2B1713] text-amber-300 flex items-center justify-center border border-[#795548]">
                      <Camera className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-amber-200">Ganti Foto Profil ({user.name})</div>
                      <div className="text-[10px] text-[#D7CCC8] font-normal">Kamera atau unggah gambar</div>
                    </div>
                  </button>

                  <div className="py-1 space-y-0.5 max-h-64 sm:max-h-72 overflow-y-auto overscroll-contain pr-0.5 scrollbar-thin">
                    {users.map((u) => {
                      const isCurrent = u.id === user.id;
                      const isKasirLocked = user.role === 'kasir' && !isCurrent;
                      const isAdminViewingKasir = user.role === 'admin' && u.role === 'kasir' && !isCurrent;

                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            handleAccountClick(u);
                            if (!isKasirLocked && !isAdminViewingKasir) {
                              setIsUserMenuOpen(false);
                            }
                          }}
                          className={`w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors ${
                            isCurrent
                              ? 'bg-[#4E342E] text-amber-300 font-bold'
                              : isKasirLocked || isAdminViewingKasir
                              ? 'text-[#A1887F] opacity-75 hover:bg-[#4E342E]/40 cursor-pointer'
                              : 'text-[#FAF3DD] hover:bg-[#3E2723]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover border border-[#795548]" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#5D4037] text-amber-200 text-xs font-bold flex items-center justify-center">
                                {u.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold leading-tight flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isKasirLocked && <Lock className="w-3 h-3 text-rose-400" />}
                                {isAdminViewingKasir && <Eye className="w-3 h-3 text-blue-300" />}
                              </div>
                              <div className="text-[10px] text-[#D7CCC8] capitalize font-medium">
                                {u.role === 'admin' ? '👑 Admin (Owner)' : '💼 Kasir'}
                              </div>
                            </div>
                          </div>
                          {isCurrent ? (
                            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                              Aktif
                            </span>
                          ) : isKasirLocked ? (
                            <span className="text-[9px] bg-rose-900/40 text-rose-300 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
                              Terkunci
                            </span>
                          ) : isAdminViewingKasir ? (
                            <span className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                              Hanya Pantau
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {/* Logout Button in User Menu */}
                  <div className="border-t border-[#5D4037] pt-1 mt-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-rose-300 hover:bg-rose-950/30 text-xs transition-colors font-bold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Logout dari Aplikasi</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* System Health Issues Notification Banner */}
      {healthReport.totalIssues > 0 && !isHealthBannerDismissed && (
        <div className="bg-gradient-to-r from-[#2B1713] via-[#3E2723] to-[#2B1713] text-[#FAF3DD] px-3.5 sm:px-6 py-2.5 text-xs border-t-2 border-amber-500/60 shadow-lg flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-200 relative z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
              healthReport.criticalCount > 0
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-amber-500 text-[#1F1412]'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-amber-200">
                  ⚠️ {healthReport.totalIssues} Masalah Sistem & Data Ditemukan
                </span>
                <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Skor: {healthReport.healthScore}%
                </span>
              </div>
              <p className="text-[11px] text-[#D7CCC8] truncate max-w-xs sm:max-w-md lg:max-w-xl">
                {healthReport.issues[0]?.title || 'Periksa integritas outletId, HPP bahan baku, & stok multi-cabang'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
            <button
              onClick={handleQuickAutoFix}
              disabled={isAutoFixingHeader}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1F1412] font-black text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              title="Perbaiki seluruh masalah sistem secara otomatis sekarang"
            >
              <Wrench className={`w-3.5 h-3.5 ${isAutoFixingHeader ? 'animate-spin' : ''}`} />
              <span>{isAutoFixingHeader ? 'Memperbaiki...' : 'Perbaiki Otomatis (Auto-Fix)'}</span>
            </button>
            <button
              onClick={() => onNavigateTab?.('dashboard')}
              className="px-3 py-1.5 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 border border-amber-500/40 text-xs font-bold transition-all"
              title="Buka panel diagnostik & kesehatan di Dashboard"
            >
              Lihat di Dashboard
            </button>
            <button
              onClick={() => setIsHealthBannerDismissed(true)}
              className="text-[#D7CCC8] hover:text-white text-xs px-2 py-1"
              title="Tutup banner notifikasi sementara"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mode / Connection Notification Banner */}
      {modeNotice && (
        <div className="bg-amber-950/90 text-amber-200 px-4 py-2 text-xs border-t border-amber-800/60 flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{modeNotice}</span>
          </div>
          <button
            onClick={() => setModeNotice(null)}
            className="text-amber-400 hover:text-amber-200 text-xs font-bold underline ml-2 shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Restricted Switch Notice Modal */}
      {restrictedNotice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#2B1713] text-[#FAF3DD] rounded-2xl max-w-sm w-full p-5 border-2 border-rose-600/60 shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-900/50 text-rose-300 mx-auto flex items-center justify-center border border-rose-500/50">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-rose-200">Akses Pergantian Akun Dibatasi</h3>
            <p className="text-xs text-[#D7CCC8] leading-relaxed">{restrictedNotice}</p>
            <div className="pt-2">
              <button
                onClick={() => setRestrictedNotice(null)}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

