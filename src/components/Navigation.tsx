import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, ShoppingCart, Layers, Truck, FileText, Settings, Wallet, Banknote, CalendarClock } from 'lucide-react';
import { UserRole } from '../types';

export type NavTab = 'dashboard' | 'pos' | 'pre_order' | 'inventory' | 'expenses' | 'cash_debt' | 'payroll' | 'reports' | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole: UserRole;
  cartCount?: number;
  isFocusMode?: boolean;
  allowCashierInventoryAccess?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  cartCount = 0,
  isFocusMode = false,
  allowCashierInventoryAccess = false,
}) => {
  const tabs = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      adminOnly: false,
      hideInFocusMode: true,
    },
    {
      id: 'pos' as NavTab,
      label: 'Kasir POS',
      icon: ShoppingCart,
      adminOnly: false,
      badge: cartCount > 0 ? cartCount : undefined,
      hideInFocusMode: false,
    },
    {
      id: 'pre_order' as NavTab,
      label: 'Pre-Order & Jadwal',
      icon: CalendarClock,
      adminOnly: false,
      hideInFocusMode: false,
    },
    {
      id: 'inventory' as NavTab,
      label: 'Stok & Resep',
      icon: Layers,
      adminOnly: false,
      hideForCashier: !allowCashierInventoryAccess, // Disembunyikan untuk kasir jika admin tidak membuka akses
      hideInFocusMode: false,
    },
    {
      id: 'expenses' as NavTab,
      label: 'Operasional',
      icon: Truck,
      adminOnly: false,
      hideInFocusMode: true,
    },
    {
      id: 'cash_debt' as NavTab,
      label: 'Buku Kas & Hutang',
      icon: Wallet,
      adminOnly: false,
      hideInFocusMode: true,
    },
    {
      id: 'payroll' as NavTab,
      label: 'Slip Gaji',
      icon: Banknote,
      adminOnly: true,
      hideInFocusMode: true,
    },
    {
      id: 'reports' as NavTab,
      label: 'Laporan',
      icon: FileText,
      adminOnly: false,
      hideInFocusMode: true,
    },
    {
      id: 'settings' as NavTab,
      label: 'Pengaturan',
      icon: Settings,
      adminOnly: true,
      hideInFocusMode: true,
    },
  ];

  return (
    <>
      {/* Top Navigation for Desktop & Tablet */}
      <nav className="bg-[#3E2723] text-[#FDFBF7] border-b border-[#5D4037] hidden md:block select-none relative z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none touch-pan-x overscroll-x-contain">
            {tabs.map((t) => {
              if (t.adminOnly && userRole !== 'admin') return null;
              if (t.hideForCashier && userRole !== 'admin') return null;
              if (isFocusMode && t.hideInFocusMode) return null;
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <motion.button
                  key={t.id}
                  onClick={() => onSelectTab(t.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-colors whitespace-nowrap relative shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#FDFBF7]'
                      : 'text-[#D7CCC8] hover:bg-[#5D4037]/60 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="desktopActiveTabHighlight"
                      className="absolute inset-0 bg-[#5D4037] border border-[#795548] rounded-lg shadow-xs -z-0"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.label}</span>
                    {t.badge && (
                      <span className="bg-amber-600 text-white text-[9.5px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center">
                        {t.badge}
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {isFocusMode && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/50 px-2.5 py-1 rounded-full shadow-inner shrink-0 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="hidden lg:inline">⚡ Mode Kasir Fokus (Menu Admin Disembunyikan)</span>
              <span className="lg:hidden">⚡ Kasir Fokus</span>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Target selector: nav:nth-of-type(2)) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#3E2723] border-t border-[#5D4037] z-40 md:hidden shadow-2xl backdrop-blur-md bg-opacity-95 select-none">
        <div className="flex items-center gap-1 py-1 px-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] w-full overflow-x-auto overscroll-x-contain scrollbar-none touch-pan-x justify-start sm:justify-center scroll-smooth">
          {tabs.map((t) => {
            if (t.adminOnly && userRole !== 'admin') return null;
            if (t.hideForCashier && userRole !== 'admin') return null;
            if (isFocusMode && t.hideInFocusMode) return null;
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => onSelectTab(t.id)}
                whileTap={{ scale: 0.92 }}
                className={`flex flex-col items-center justify-center min-w-[52px] xs:min-w-[58px] shrink-0 py-1 px-1 rounded-lg text-xs transition-colors relative cursor-pointer ${
                  isActive ? 'text-[#FDFBF7] font-bold bg-[#4E342E]/70' : 'text-[#D7CCC8]/70 hover:text-[#D7CCC8]'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 xs:w-4.5 xs:h-4.5 transition-transform ${isActive ? 'scale-110 text-amber-300' : ''}`} />
                  {t.badge && (
                    <span className="absolute -top-1 -right-2 bg-amber-600 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs">
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[8.5px] xs:text-[9px] uppercase tracking-tight mt-0.5 truncate max-w-[58px] text-center leading-none ${isActive ? 'text-amber-200 font-bold' : ''}`}>
                  {t.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveIndicator"
                    className="w-3.5 h-0.5 bg-amber-400 rounded-full mt-0.5"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
