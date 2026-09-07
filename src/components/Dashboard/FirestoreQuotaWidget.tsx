import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Zap,
  ShieldCheck,
  RotateCcw,
  Clock,
  CheckCircle2,
  Layers,
  Database,
  Server,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import {
  getFirestoreQuotaStats,
  getFirestoreQuotaRemaining,
  subscribeQuotaUpdates,
  resetFirestoreQuotaStats,
  simulateLowQuota,
  FirestoreQuotaStats,
  FirestoreQuotaRemaining,
} from '../../utils/firestoreQuotaTracker';

export const FirestoreQuotaWidget: React.FC = () => {
  const [stats, setStats] = useState<FirestoreQuotaStats>(() => getFirestoreQuotaStats());
  const [remaining, setRemaining] = useState<FirestoreQuotaRemaining>(() =>
    getFirestoreQuotaRemaining()
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('suqur_quota_widget_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeQuotaUpdates((newStats, newRemaining) => {
      setStats(newStats);
      setRemaining(newRemaining);
    });
    return unsub;
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('suqur_quota_widget_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleReset = () => {
    if (window.confirm('Apakah Anda yakin ingin mengatur ulang penghitung kuota hari ini?')) {
      resetFirestoreQuotaStats();
      setToastMessage('Penghitung kuota harian berhasil diatur ulang.');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const getStatusColor = (percentRemaining: number) => {
    if (percentRemaining > 35) {
      return {
        text: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        bar: 'bg-emerald-500',
        dot: 'bg-emerald-500',
      };
    }
    if (percentRemaining > 15) {
      return {
        text: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        bar: 'bg-amber-500',
        dot: 'bg-amber-500',
      };
    }
    return {
      text: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      bar: 'bg-rose-500',
      dot: 'bg-rose-500',
    };
  };

  const readTheme = getStatusColor(remaining.readPercentageRemaining);
  const writeTheme = getStatusColor(remaining.writePercentageRemaining);

  const lowestRemainingPct = Math.min(
    remaining.readPercentageRemaining,
    remaining.writePercentageRemaining
  );
  const overallTheme = getStatusColor(lowestRemainingPct);

  // Tampilan Terciutkan (Slim Minimal Bar)
  if (isCollapsed) {
    return (
      <div
        id="firestore-quota-widget"
        className="bg-white rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 border border-slate-200 shadow-2xs transition-all flex items-center justify-between gap-2.5"
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 ${overallTheme.bg} ${overallTheme.text} ${overallTheme.border}`}
          >
            <Database className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate">
              Kuota API Firestore
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${overallTheme.bg} ${overallTheme.text} ${overallTheme.border} shrink-0`}
            >
              {lowestRemainingPct > 35 ? 'Aman' : lowestRemainingPct > 15 ? 'Waspada' : 'Kritis'} ({lowestRemainingPct}% Sisa)
            </span>
            <span className="hidden md:inline text-[11px] text-slate-500 font-medium truncate">
              Baca: {remaining.readPercentageRemaining}% • Tulis: {remaining.writePercentageRemaining}% • Reset: {remaining.timeUntilReset}
            </span>
          </div>
        </div>

        <button
          onClick={toggleCollapse}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-all cursor-pointer shrink-0"
          title="Buka tampilan kartu kuota"
        >
          <span>Buka Kartu</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      id="firestore-quota-widget"
      className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs transition-all space-y-3"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-2.5 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm flex items-center justify-between text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white text-[11px] underline ml-2 shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Compact Row (Identik dengan gaya Kartu Integritas Sistem) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Left: Icon, Title & Status Badges */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border shrink-0 ${overallTheme.bg} ${overallTheme.text} ${overallTheme.border}`}
          >
            {lowestRemainingPct > 15 ? (
              <Database className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900">Sisa Kuota API (Firestore)</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${overallTheme.bg} ${overallTheme.text} ${overallTheme.border}`}
              >
                {lowestRemainingPct > 35 ? 'Aman' : lowestRemainingPct > 15 ? 'Waspada' : 'Kritis'} ({lowestRemainingPct}% Sisa)
              </span>
            </div>
          </div>

          {/* Mini Quota Indicator Badges */}
          <div className="hidden sm:flex items-center gap-1.5 ml-1 flex-wrap">
            {/* Reads Mini Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border ${readTheme.bg} ${readTheme.text} ${readTheme.border}`}
              title={`Operasi Baca (Reads): ${remaining.readsRemaining.toLocaleString('id-ID')} tersisa dari batas 50.000/hari`}
            >
              <Database className="w-2.5 h-2.5 shrink-0" />
              <span>Baca: <b>{remaining.readPercentageRemaining}%</b></span>
              <div className="w-10 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full ${readTheme.bar} rounded-full`}
                  style={{ width: `${remaining.readPercentageRemaining}%` }}
                />
              </div>
            </div>

            {/* Writes Mini Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border ${writeTheme.bg} ${writeTheme.text} ${writeTheme.border}`}
              title={`Operasi Tulis/Hapus (Writes): ${remaining.writesRemaining.toLocaleString('id-ID')} tersisa dari batas 20.000/hari`}
            >
              <Server className="w-2.5 h-2.5 shrink-0" />
              <span>Tulis: <b>{remaining.writePercentageRemaining}%</b></span>
              <div className="w-10 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full ${writeTheme.bar} rounded-full`}
                  style={{ width: `${remaining.writePercentageRemaining}%` }}
                />
              </div>
            </div>

            {/* Reset Time Badge */}
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-slate-50 text-slate-600 border-slate-200">
              <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
              <span>Reset: {remaining.timeUntilReset}</span>
            </div>
          </div>
        </div>

        {/* Right: Actions, Rincian, dan Tombol Ciutkan */}
        <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
          <button
            onClick={() => {
              simulateLowQuota(8);
              setToastMessage('Simulasi kuota kritis (< 10%) aktif.');
              setTimeout(() => setToastMessage(null), 3500);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
            title="Uji coba peringatan kuota < 10%"
          >
            <Zap className="w-3 h-3 text-rose-500" />
            <span className="hidden sm:inline">Tes</span> &lt; 10%
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            title="Atur ulang statistik hari ini"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
            title="Tampilkan rincian grafik kuota"
          >
            <span>{isDetailsOpen ? 'Tutup' : 'Rincian'}</span>
            {isDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Tombol Ciutkan Kartu */}
          <button
            onClick={toggleCollapse}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-all cursor-pointer"
            title="Ciutkan kartu ini agar tidak terlalu memenuhi layar"
          >
            <span>Ciutkan</span>
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      <AnimatePresence>
        {isDetailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-2 border-t border-slate-100 space-y-3 overflow-hidden"
          >
            {/* Progress Bars Grid: Read & Write */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Read Operations Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Operasi Baca (Reads)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${readTheme.bg} ${readTheme.text} ${readTheme.border}`}
                  >
                    {remaining.readPercentageRemaining}% Tersisa
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full ${readTheme.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${remaining.readPercentageRemaining}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-600 font-medium">
                    <span>{stats.readsUsed.toLocaleString('id-ID')} terpakai ({remaining.readPercentageUsed}%)</span>
                    <span className="font-bold text-slate-800">
                      Sisa: {remaining.readsRemaining.toLocaleString('id-ID')} / {stats.readLimit.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60">
                  <span>Query transaksi, menu, stok & laporan</span>
                  <span className="text-emerald-700 font-medium">Batas: 50.000 / hari</span>
                </div>
              </div>

              {/* Write & Delete Operations Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">Operasi Tulis & Hapus (Writes)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${writeTheme.bg} ${writeTheme.text} ${writeTheme.border}`}
                  >
                    {remaining.writePercentageRemaining}% Tersisa
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full ${writeTheme.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${remaining.writePercentageRemaining}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-600 font-medium">
                    <span>{(stats.writesUsed + stats.deletesUsed).toLocaleString('id-ID')} terpakai ({remaining.writePercentageUsed}%)</span>
                    <span className="font-bold text-slate-800">
                      Sisa: {remaining.writesRemaining.toLocaleString('id-ID')} / {stats.writeLimit.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60">
                  <span>Input transaksi, kasir, pergeseran stok, shift</span>
                  <span className="text-amber-700 font-medium">Batas: 20.000 / hari</span>
                </div>
              </div>
            </div>

            {/* Safety & Optimization Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 text-[10.5px]">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="leading-tight">
                  <span className="font-bold text-emerald-950">Deduplikasi 25 Detik</span>
                  <p className="text-[9.5px] text-emerald-800">Cegah penulisan ganda berulang</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="leading-tight">
                  <span className="font-bold text-emerald-950">Limit Query Terbatas</span>
                  <p className="text-[9.5px] text-emerald-800">Maks 100 dokumen per listener</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="leading-tight">
                  <span className="font-bold text-emerald-950">Auto-Fallback Offline</span>
                  <p className="text-[9.5px] text-emerald-800">Siaga IndexedDB tanpa crash</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
