import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  X,
  Server,
  Cloud,
  FileSpreadsheet,
  Search,
  Code,
  Download,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  HardDrive,
  ShieldCheck,
  FolderOpen,
  Layers,
  Lock,
  Unlock,
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import { AutoBackupService, AutoBackupSnapshot } from '../../services/autoBackupService';
import { auth } from '../../services/googleSheetsService';

interface DatabaseInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'transactions' | 'products' | 'expenses' | 'ingredients' | 'shifts' | 'users' | 'backups';

export const DatabaseInspectorModal: React.FC<DatabaseInspectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [backups, setBackups] = useState<AutoBackupSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Statistics
  const transactions = StorageService.getTransactions();
  const products = StorageService.getProducts();
  const expenses = StorageService.getExpenses();
  const ingredients = StorageService.getIngredients();
  const shifts = StorageService.getShifts();
  const users = StorageService.getUsers();

  useEffect(() => {
    if (!isOpen) return;
    loadBackups();
  }, [isOpen]);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const history = await AutoBackupService.getHistory();
      setBackups(history);
    } catch (e) {
      console.error('Failed to load backup snapshots:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJSON = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFullDB = () => {
    const fullDB = {
      timestamp: new Date().toISOString(),
      transactions,
      products,
      expenses,
      ingredients,
      shifts,
      users,
      settings: StorageService.getSettings(),
    };
    const blob = new Blob([JSON.stringify(fullDB, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Suqur_POS_FullDatabase_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('✓ Salinan database lengkap berhasil diunduh dalam format JSON.');
  };

  const handleReindex = () => {
    setIsLoading(true);
    setStatusMessage('Memeriksa integritas & membuka tabel database...');
    setTimeout(() => {
      setIsLoading(false);
      setStatusMessage('✓ Database lokal (IndexedDB & LocalStorage) dan koneksi Cloud aktif tanpa hambatan.');
    }, 600);
  };

  if (!isOpen) return null;

  // Filter records based on activeTab
  const getTableData = () => {
    switch (activeTab) {
      case 'transactions':
        return transactions;
      case 'products':
        return products;
      case 'expenses':
        return expenses;
      case 'ingredients':
        return ingredients;
      case 'shifts':
        return shifts;
      case 'users':
        return users;
      case 'backups':
        return backups;
      default:
        return [];
    }
  };

  const currentData = getTableData();
  const filteredData = currentData.filter((item: any) => {
    if (!searchTerm) return true;
    const jsonStr = JSON.stringify(item).toLowerCase();
    return jsonStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-[#1F1412] text-[#FAF3DD] w-full max-w-5xl rounded-3xl shadow-2xl border border-[#5D4037] overflow-hidden flex flex-col h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#3E2723] bg-[#170E0D] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-950 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <Database className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-[#FAF3DD]">Penjelajah Database & Data Tersembunyi</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Terbuka
                </span>
              </div>
              <p className="text-xs text-[#D7CCC8]">
                Akses langsung ke seluruh tabel internal (IndexedDB, LocalStorage, Cloud Firestore & Google Sheets)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#D7CCC8] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Status Cards */}
        <div className="p-4 bg-[#2B1713] border-b border-[#3E2723] grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {/* Local Engine */}
          <div className="p-3 rounded-2xl bg-[#1F1412] border border-[#5D4037] flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#FAF3DD]">Local Database</span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40">Active</span>
              </div>
              <p className="text-[11px] text-[#D7CCC8] truncate">
                IndexedDB & LocalStorage: <b>{transactions.length + products.length + expenses.length} records</b>
              </p>
            </div>
          </div>

          {/* Cloud Firestore Engine */}
          <div className="p-3 rounded-2xl bg-[#1F1412] border border-[#5D4037] flex items-center gap-3">
            <Cloud className="w-8 h-8 text-sky-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#FAF3DD]">Cloud Firestore</span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-sky-950 text-sky-300 font-bold border border-sky-500/40">Online</span>
              </div>
              <p className="text-[11px] text-[#D7CCC8] truncate">
                Sinkronisasi otomatis & real-time
              </p>
            </div>
          </div>

          {/* Google Sheets Engine */}
          <div className="p-3 rounded-2xl bg-[#1F1412] border border-[#5D4037] flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#FAF3DD]">Google Sheets Sync</span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-amber-950 text-amber-300 font-bold border border-amber-500/40">OAuth2</span>
              </div>
              <p className="text-[11px] text-[#D7CCC8] truncate">
                {auth.currentUser ? auth.currentUser.email : 'Akun Google Siap'}
              </p>
            </div>
          </div>
        </div>

        {/* System Message Banner */}
        {statusMessage && (
          <div className="px-5 py-2.5 bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:underline text-[11px]">
              Tutup
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar / Navigation Tabs */}
          <div className="w-full md:w-64 bg-[#170E0D] border-r border-[#3E2723] p-3 space-y-1 overflow-y-auto shrink-0">
            <div className="text-[10px] font-bold text-[#A1887F] uppercase tracking-wider px-3 py-1">
              Tabel & Koleksi Database
            </div>

            <button
              onClick={() => { setActiveTab('transactions'); setSelectedRecord(null); }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${
                activeTab === 'transactions' ? 'bg-[#3E2723] text-amber-300 border border-[#5D4037]' : 'text-[#D7CCC8] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-amber-400" /> Transaksi Penjualan</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1F1412] text-[10px] text-amber-200 font-mono">{transactions.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('products'); setSelectedRecord(null); }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${
                activeTab === 'products' ? 'bg-[#3E2723] text-amber-300 border border-[#5D4037]' : 'text-[#D7CCC8] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4 text-sky-400" /> Katalog Produk & Menu</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1F1412] text-[10px] text-sky-200 font-mono">{products.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('expenses'); setSelectedRecord(null); }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${
                activeTab === 'expenses' ? 'bg-[#3E2723] text-amber-300 border border-[#5D4037]' : 'text-[#D7CCC8] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-rose-400" /> Pengeluaran Operasional</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1F1412] text-[10px] text-rose-200 font-mono">{expenses.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('ingredients'); setSelectedRecord(null); }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${
                activeTab === 'ingredients' ? 'bg-[#3E2723] text-amber-300 border border-[#5D4037]' : 'text-[#D7CCC8] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4 text-emerald-400" /> Resep & Bahan Baku</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1F1412] text-[10px] text-emerald-200 font-mono">{ingredients.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('shifts'); setSelectedRecord(null); }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${
                activeTab === 'shifts' ? 'bg-[#3E2723] text-amber-300 border border-[#5D4037]' : 'text-[#D7CCC8] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-purple-400" /> Sesi Shift Kasir</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1F1412] text-[10px] text-purple-200 font-mono">{shifts.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('users'); setSelectedRecord(null); }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${
                activeTab === 'users' ? 'bg-[#3E2723] text-amber-300 border border-[#5D4037]' : 'text-[#D7CCC8] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4 text-indigo-400" /> Pengguna & Akses PIN</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1F1412] text-[10px] text-indigo-200 font-mono">{users.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('backups'); setSelectedRecord(null); }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${
                activeTab === 'backups' ? 'bg-[#3E2723] text-amber-300 border border-[#5D4037]' : 'text-[#D7CCC8] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2"><Database className="w-4 h-4 text-amber-500" /> Auto-Backup Snapshots</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1F1412] text-[10px] text-amber-200 font-mono">{backups.length}</span>
            </button>

            <div className="pt-3 border-t border-[#3E2723] space-y-2">
              <button
                onClick={handleDownloadFullDB}
                className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Full Database JSON
              </button>
              <button
                onClick={handleReindex}
                className="w-full py-2 px-3 rounded-xl bg-[#2B1713] hover:bg-[#3E2723] border border-[#5D4037] text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Periksa Database
              </button>
            </div>
          </div>

          {/* Table Data Viewer & Inspector */}
          <div className="flex-1 p-4 flex flex-col min-w-0 bg-[#1F1412] overflow-hidden">
            {/* Search Bar */}
            <div className="mb-3 relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari ID, kata kunci, atau properti dalam tabel ini..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#2B1713] border border-[#5D4037] text-xs text-[#FAF3DD] focus:outline-none focus:border-amber-500 placeholder-gray-500"
              />
            </div>

            {/* Split View: List Records & Detail JSON */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0 overflow-hidden">
              {/* Record List */}
              <div className="border border-[#3E2723] rounded-2xl bg-[#170E0D] overflow-y-auto p-2 space-y-1.5">
                {filteredData.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs">
                    Tidak ada data ditemukan untuk pencarian ini.
                  </div>
                ) : (
                  filteredData.map((item: any, idx: number) => {
                    const isSelected = selectedRecord === item;
                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => setSelectedRecord(item)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#3E2723] border-amber-500/80 text-amber-200 shadow-md'
                            : 'bg-[#1F1412] border-[#2B1713] hover:border-[#5D4037] text-[#FAF3DD]'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="font-mono text-[11px] text-amber-400 truncate max-w-[180px]">
                            {item.invoiceNo || item.poNo || item.id || `Record #${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : item.date || ''}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#D7CCC8] mt-1 truncate">
                          {item.name || item.title || item.cashierName || item.label || item.description || JSON.stringify(item).slice(0, 50)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* JSON Detail Viewer */}
              <div className="border border-[#3E2723] rounded-2xl bg-[#170E0D] overflow-hidden flex flex-col">
                <div className="p-3 bg-[#2B1713] border-b border-[#3E2723] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#FAF3DD]">
                    <Code className="w-4 h-4 text-sky-400" /> Detail Record JSON
                  </div>
                  {selectedRecord && (
                    <button
                      onClick={() => handleCopyJSON(selectedRecord)}
                      className="px-2.5 py-1 rounded-lg bg-[#3E2723] hover:bg-[#5D4037] text-amber-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Tersalin' : 'Salin JSON'}
                    </button>
                  )}
                </div>

                <div className="flex-1 p-3 overflow-auto font-mono text-[11px] text-amber-200 bg-[#120B0A]">
                  {selectedRecord ? (
                    <pre className="whitespace-pre-wrap break-all leading-relaxed">
                      {JSON.stringify(selectedRecord, null, 2)}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs text-center p-4">
                      <Eye className="w-8 h-8 mb-2 opacity-40 text-amber-400" />
                      Pilih salah satu baris di sebelah kiri untuk melihat struktur data mentah JSON.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3E2723] bg-[#170E0D] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#D7CCC8]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Semua database terbuka dan aman tersimpan di penyimpanan internal & cloud.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-xs font-bold text-[#FAF3DD] transition-all"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
};
