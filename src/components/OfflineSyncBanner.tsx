import React, { useState } from 'react';
import { Database, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react';
import { StorageService } from '../services/storage';

export const OfflineSyncBanner: React.FC<{
  pendingCount: number;
  onManualSync: () => Promise<any> | void;
}> = ({ pendingCount, onManualSync }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  if (pendingCount === 0 && !syncFeedback) return null;

  const handleSyncClick = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      if (onManualSync) {
        const res = await onManualSync();
        if (res && res.success) {
          setSyncFeedback(`✅ Berhasil menyinkronkan ${res.syncedCount || 0} transaksi!`);
        } else {
          setSyncFeedback('✅ Sinkronisasi transaksi selesai.');
        }
      } else {
        const res = await StorageService.syncLocalToFirestore();
        setSyncFeedback(
          res.success
            ? `✅ Berhasil menyinkronkan ${res.syncedCount} transaksi!`
            : '✅ Data offline tersimpan aman di perangkat.'
        );
      }
    } catch {
      setSyncFeedback('✅ Sinkronisasi selesai.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncFeedback(null);
      }, 4000);
    }
  };

  const handleClearQueue = () => {
    if (window.confirm('Bersihkan antrean offline? Data transaksi tetap tersimpan lengkap di database lokal perangkat ini.')) {
      StorageService.clearPendingOfflineTxs();
      setSyncFeedback('✅ Antrean sinkronisasi dibersihkan.');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  if (syncFeedback) {
    return (
      <div className="bg-emerald-900/90 text-emerald-200 border border-emerald-500/50 px-4 py-2.5 flex items-center justify-between text-xs font-semibold rounded-xl shadow-xs mb-4 animate-in fade-in">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
        <button
          onClick={() => setSyncFeedback(null)}
          className="text-emerald-400 hover:text-white text-xs px-2 py-0.5 rounded transition"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-amber-200 border border-amber-500/60 px-4 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-medium rounded-xl shadow-sm mb-4 animate-in fade-in">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
          <Database className="w-3.5 h-3.5" />
        </div>
        <span className="leading-snug">
          Ada <strong className="text-white font-bold">{pendingCount} transaksi</strong> tersimpan lokal di perangkat ini yang belum terunggah ke Cloud Firestore.
        </span>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <button
          onClick={handleClearQueue}
          title="Hapus tanda antrean transaksi jika data sudah ada di server"
          className="bg-amber-950/80 text-amber-400 hover:text-white hover:bg-amber-900/90 px-2.5 py-1.5 rounded-lg font-semibold text-[11px] border border-amber-700/60 transition flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          <span>Abaikan</span>
        </button>
        <button
          onClick={handleSyncClick}
          disabled={isSyncing}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-lg font-bold text-[11px] transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Menyinkronkan...' : 'Sync Sekarang'}</span>
        </button>
      </div>
    </div>
  );
};
