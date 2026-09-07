import React, { useState } from 'react';
import {
  CupSoda,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Minimize2,
  Maximize2,
  Lock,
  Layers,
} from 'lucide-react';
import { DailyCupTargetAnalytics } from '../../utils/cupAnalytics';
import { formatRp } from '../../utils/formatters';

interface DailyCupOverheadCardProps {
  analytics: DailyCupTargetAnalytics;
  onOpenDailyRecap?: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const DailyCupOverheadCard: React.FC<DailyCupOverheadCardProps> = ({
  analytics,
  onOpenDailyRecap,
}) => {
  // State minimize disimpan di localStorage agar preferensi admin diingat
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('suqur_cup_card_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showCupSizes, setShowCupSizes] = useState<boolean>(false);

  const toggleMinimize = () => {
    const nextState = !isMinimized;
    setIsMinimized(nextState);
    try {
      localStorage.setItem('suqur_cup_card_minimized', String(nextState));
    } catch {
      // ignore
    }
  };

  const {
    totalCupsUsed,
    dailyTargetCup,
    monthlyTargetCup,
    overheadPerCup,
    dailyOverheadExpense,
    monthlyOverheadExpense,
    recoveredOverheadToday,
    targetProgressPct,
    remainingCupsToTarget,
    isTargetAchieved,
    performanceStatus,
    statusMessage,
    infoExplanation,
    breakdown,
    anyCupLowStock,
  } = analytics;

  // Status visual themes
  const statusConfig = {
    excellent: {
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      badgeText: 'Target Tercapai',
      progressColor: 'bg-emerald-400',
      borderCard: 'border-emerald-500/30',
    },
    good: {
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      badgeText: 'Mendekati Target',
      progressColor: 'bg-blue-400',
      borderCard: 'border-blue-500/30',
    },
    warning: {
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      badgeText: 'Sedang Berjalan',
      progressColor: 'bg-amber-400',
      borderCard: 'border-amber-500/30',
    },
    danger: {
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      badgeText: 'Perlu Peningkatan',
      progressColor: 'bg-rose-400',
      borderCard: 'border-rose-500/30',
    },
  }[performanceStatus];

  // ===== MODE PERKECIL (MINIMIZED / COMPACT STRIP) =====
  if (isMinimized) {
    return (
      <div
        id="daily-cup-overhead-card-minimized"
        className="bg-slate-900 rounded-xl px-3 py-2 text-white shadow-xs border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap"
      >
        {/* Left Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <CupSoda className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1">
                Target Cup Overhead
                <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Admin
                </span>
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase border ${statusConfig.badgeBg}`}>
                {statusConfig.badgeText}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {totalCupsUsed}/{dailyTargetCup} Cup ({targetProgressPct}%) • Terkumpul {formatRp(recoveredOverheadToday)} ({formatRp(overheadPerCup)}/cup)
            </div>
          </div>
        </div>

        {/* Center Mini Progress Bar (Hidden on mobile) */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs">
          <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${statusConfig.progressColor}`}
              style={{ width: `${Math.min(100, targetProgressPct)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-amber-400">
            {targetProgressPct}%
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
          {onOpenDailyRecap && (
            <button
              onClick={onOpenDailyRecap}
              title="Buka Rekap Harian Lengkap"
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[10.5px] font-semibold transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
            >
              <span>Rekap</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={toggleMinimize}
            title="Perluas Tampilan Kartu Target Cup"
            className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-amber-500/30"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Perluas</span>
          </button>
        </div>
      </div>
    );
  }

  // ===== MODE STANDAR / DIPERKECIL & DIBUAT SIMPLE =====
  return (
    <div
      id="daily-cup-overhead-card"
      className={`bg-slate-900 rounded-xl sm:rounded-2xl text-white shadow-2xs border ${statusConfig.borderCard} p-3 sm:p-3.5 space-y-2.5 transition-all duration-200 relative overflow-hidden`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <CupSoda className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1">
                Target &amp; Pemakaian Cup Harian
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Khusus Admin
                </span>
              </h2>
              <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase border tracking-wider ${statusConfig.badgeBg}`}>
                {statusConfig.badgeText}
              </span>
              {anyCupLowStock && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                  Stok Menipis
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-400 truncate">
              Pemulihan Beban Operasional ({formatRp(overheadPerCup)}/cup)
            </p>
          </div>
        </div>

        {/* Quick Actions (Tombol Perkecil & Rekap) */}
        <div className="flex items-center gap-1 shrink-0">
          {onOpenDailyRecap && (
            <button
              onClick={onOpenDailyRecap}
              title="Buka Rekap Harian Lengkap"
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
            >
              <span>Rekap</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
          {/* Tombol Perkecil Tampilan */}
          <button
            onClick={toggleMinimize}
            title="Perkecil Tampilan Kartu Target Cup"
            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Perkecil</span>
          </button>
        </div>
      </div>

      {/* Main Target Progress Section - Simple & Compact */}
      <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/60 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Realisasi Cup:</span>
            <span className="text-sm font-black text-white">
              {totalCupsUsed} <span className="text-[11px] font-normal text-slate-400">/ {dailyTargetCup} Cup</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-black text-amber-400 text-xs font-mono">
              {targetProgressPct}%
            </span>
            {isTargetAchieved ? (
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9.5px] font-bold">
                +{totalCupsUsed - dailyTargetCup} Surplus
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9.5px] font-bold">
                Sisa {remainingCupsToTarget} Cup
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${statusConfig.progressColor}`}
            style={{ width: `${Math.min(100, targetProgressPct)}%` }}
          />
        </div>

        {/* Single Line Status & Overhead Info */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px]">
          <div className="flex items-center gap-1 text-slate-300 truncate">
            {isTargetAchieved ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            )}
            <span className="truncate">{statusMessage}</span>
          </div>
          <div className="text-slate-400 font-medium shrink-0">
            Overhead Terkumpul: <strong className="text-emerald-400">{formatRp(recoveredOverheadToday)}</strong> / {formatRp(dailyOverheadExpense)}
          </div>
        </div>
      </div>

      {/* 4 Financial Key Indicators - Compact Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
        <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-800">
          <span className="text-[9.5px] text-slate-400 block font-medium">Target Harian</span>
          <div className="font-bold text-white text-xs mt-0.5">
            {dailyTargetCup} <span className="text-[9.5px] font-normal text-slate-400">Cup/hari</span>
          </div>
          <span className="text-[9px] text-slate-500 block truncate">Target {monthlyTargetCup.toLocaleString('id-ID')}/bln</span>
        </div>

        <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-800">
          <span className="text-[9.5px] text-slate-400 block font-medium">Overhead / Cup</span>
          <div className="font-bold text-amber-400 text-xs mt-0.5">
            {formatRp(overheadPerCup)}
          </div>
          <span className="text-[9.5px] text-slate-500 block truncate">Beban tetap operasional</span>
        </div>

        <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-800">
          <span className="text-[9.5px] text-slate-400 block font-medium">Overhead Terkumpul</span>
          <div className="font-bold text-emerald-400 text-xs mt-0.5">
            {formatRp(recoveredOverheadToday)}
          </div>
          <span className="text-[9px] text-slate-500 block truncate">
            {isTargetAchieved ? '100% BEP Tercapai' : `Sisa ${formatRp(Math.max(0, dailyOverheadExpense - recoveredOverheadToday))}`}
          </span>
        </div>

        <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-800">
          <span className="text-[9.5px] text-slate-400 block font-medium">Beban Harian</span>
          <div className="font-bold text-slate-200 text-xs mt-0.5">
            {formatRp(dailyOverheadExpense)}
          </div>
          <span className="text-[9px] text-slate-500 block truncate">Bulan: {formatRp(monthlyOverheadExpense)}</span>
        </div>
      </div>

      {/* Accordions: Keterangan & Rincian Cup (Dibuat Simple & Ringkas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
        {/* Accordion 1: Keterangan & Info */}
        <div className="border border-slate-800/90 rounded-lg bg-slate-800/20 overflow-hidden">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-[10.5px] font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Info className="w-3 h-3 text-amber-400" />
              <span>Keterangan &amp; Info Rumus</span>
            </div>
            {showInfo ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>
          {showInfo && (
            <div className="p-2 text-[10px] text-slate-300 border-t border-slate-800 bg-slate-950/40 space-y-1 leading-relaxed">
              <p>{infoExplanation}</p>
              <div className="pt-0.5 text-slate-400 text-[9.5px] space-y-0.5">
                <div>• Beban per Cup = {formatRp(monthlyOverheadExpense)} ÷ {monthlyTargetCup} cup = <strong className="text-amber-300">{formatRp(overheadPerCup)}/cup</strong></div>
                <div>• Target Harian = {monthlyTargetCup} ÷ 30 hari = <strong className="text-amber-300">{dailyTargetCup} cup/hari</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: 4 Ukuran Cup */}
        <div className="border border-slate-800/90 rounded-lg bg-slate-800/20 overflow-hidden">
          <button
            onClick={() => setShowCupSizes(!showCupSizes)}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-[10.5px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-amber-400" />
              <span>Stok &amp; Pemakaian 4 Ukuran Cup</span>
            </div>
            {showCupSizes ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>
          {showCupSizes && (
            <div className="p-2 border-t border-slate-800 bg-slate-950/40">
              <div className="grid grid-cols-4 gap-1 text-center">
                {breakdown.map((c) => (
                  <div key={c.size} className="p-1 rounded bg-slate-900 border border-slate-800">
                    <div className="text-[9.5px] font-bold text-amber-300">{c.size}</div>
                    <div className="text-[11px] font-black text-white">{c.quantityUsed}</div>
                    <div className={`text-[8.5px] ${c.isLowStock ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                      Sisa: {c.currentStock}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
