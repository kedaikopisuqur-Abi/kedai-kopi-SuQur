import React, { useState, useMemo } from 'react';
import { CapitalRecord, Outlet, User } from '../../types';
import { formatRp, formatDate } from '../../utils/formatters';
import {
  Coins,
  Plus,
  Trash2,
  X,
  Search,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  PieChart,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CapitalRecordsTabProps {
  capitalRecords: CapitalRecord[];
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  currentUser: User;
  onAddCapital: (record: CapitalRecord, autoAddToCashLedger?: boolean) => void;
  onDeleteCapital: (id: string) => void;
}

export const CapitalRecordsTab: React.FC<CapitalRecordsTabProps> = ({
  capitalRecords,
  outlets,
  activeOutlet,
  currentUser,
  onAddCapital,
  onDeleteCapital,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState<number>(5000000);
  const [source, setSource] = useState<string>('Modal Pribadi Pemilik');
  const [note, setNote] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : '')
  );
  const [autoRecordCash, setAutoRecordCash] = useState<boolean>(true);

  // Filters
  const isKasir = currentUser.role === 'kasir';
  const defaultFilterOutlet = isKasir
    ? activeOutlet?.id || currentUser.assignedOutletId || currentUser.outletId || (outlets.length > 0 ? outlets[0].id : 'ALL')
    : 'ALL';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOutletId, setFilterOutletId] = useState<string>(defaultFilterOutlet);

  const sourcesList = [
    'Modal Pribadi Pemilik',
    'Investor / Mitra Usaha',
    'Pinjaman Usaha / Bank / KUR',
    'Laba Ditahan / Reinvestasi',
    'Hibah / Sumber Lain',
  ];

  const handleOpenModal = () => {
    setSelectedOutletId(activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : ''));
    setDate(new Date().toISOString().split('T')[0]);
    setAmount(5000000);
    setSource(sourcesList[0]);
    setNote('');
    setAutoRecordCash(true);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !source.trim()) {
      alert('Mohon masukkan nominal modal dan sumber dana.');
      return;
    }

    const targetOutlet = outlets.find((o) => o.id === selectedOutletId) || activeOutlet;
    const newRecord: CapitalRecord = {
      id: 'cap-' + Date.now(),
      date,
      amount: Number(amount),
      source: source.trim(),
      note: note.trim() || 'Penyertaan Modal Usaha',
      outletId: targetOutlet?.id || 'outlet-default',
      outletName: targetOutlet?.name || 'Cabang Aktif',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    onAddCapital(newRecord, autoRecordCash);
    setIsModalOpen(false);
  };

  // Filtered List
  const filteredRecords = useMemo(() => {
    return capitalRecords.filter((item) => {
      if (filterOutletId !== 'ALL' && item.outletId !== filterOutletId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSource = item.source.toLowerCase().includes(q);
        const matchNote = item.note.toLowerCase().includes(q);
        const matchOutlet = (item.outletName || '').toLowerCase().includes(q);
        const matchUser = (item.createdBy || '').toLowerCase().includes(q);
        if (!matchSource && !matchNote && !matchOutlet && !matchUser) return false;
      }

      return true;
    });
  }, [capitalRecords, filterOutletId, searchQuery]);

  // Total Modal Disetor
  const totalModalGlobal = useMemo(() => {
    return capitalRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [capitalRecords]);

  const totalModalScoped = useMemo(() => {
    if (filterOutletId === 'ALL') return totalModalGlobal;
    return capitalRecords
      .filter((r) => r.outletId === filterOutletId)
      .reduce((sum, r) => sum + r.amount, 0);
  }, [capitalRecords, filterOutletId, totalModalGlobal]);

  const activeOutletName =
    filterOutletId === 'ALL'
      ? 'Semua Cabang'
      : outlets.find((o) => o.id === filterOutletId)?.name || 'Cabang Aktif';

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('Tidak ada data modal untuk diekspor.');
      return;
    }

    const headers = ['ID', 'Tanggal', 'Sumber Dana', 'Nominal (Rp)', 'Catatan', 'Cabang', 'Pencatat'];
    const rows = filteredRecords.map((r) => [
      r.id,
      r.date,
      `"${r.source}"`,
      r.amount,
      `"${r.note.replace(/"/g, '""')}"`,
      `"${r.outletName || r.outletId}"`,
      `"${r.createdBy || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pencatatan_Modal_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-[#2B1713] flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-700" />
            Pencatatan Modal Usaha (Owner's Equity)
          </h2>
          <p className="text-xs text-[#5D4037] mt-0.5">
            Kelola histori penyertaan modal awal, suntikan dana investor, maupun reinvestasi laba per cabang.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-800 hover:bg-amber-900 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Input Tambahan Modal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Modal Terfilter */}
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-700" /> Total Modal Disetor
            </span>
            <span className="text-[10px] font-bold bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full">
              {activeOutletName}
            </span>
          </div>
          <div className="text-2xl font-black text-amber-950 mt-2">
            {formatRp(totalModalScoped)}
          </div>
          <div className="text-[11px] text-amber-800 font-medium mt-1">
            Dari total {filteredRecords.length} kali pencatatan setoran modal
          </div>
        </div>

        {/* Total Modal Global Seluruh Cabang */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-stone-600" /> Total Modal Konsolidasi
            </span>
            <span className="text-[10px] font-bold bg-stone-200 text-stone-800 px-2 py-0.5 rounded-full">
              Seluruh Outlet
            </span>
          </div>
          <div className="text-2xl font-black text-stone-900 mt-2">
            {formatRp(totalModalGlobal)}
          </div>
          <div className="text-[11px] text-stone-500 font-medium mt-1">
            Akumulasi seluruh unit cabang Su-Qur POS
          </div>
        </div>

        {/* Filter Outlet Card */}
        <div className="bg-white border border-[#D7CCC8]/60 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-[#5D4037] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-stone-600" /> Filter Cabang Modal
            </div>
            {isKasir ? (
              <div className="mt-2 p-2 rounded-xl bg-amber-100/70 border border-amber-300 text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                <span className="truncate">{activeOutlet?.name || 'Cabang Tugas Kasir'}</span>
              </div>
            ) : (
              <select
                value={filterOutletId}
                onChange={(e) => setFilterOutletId(e.target.value)}
                className="mt-2 w-full text-xs font-bold bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
              >
                <option value="ALL">🏢 Semua Cabang ({capitalRecords.length} setoran)</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    📍 {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="text-[11px] text-stone-500 font-medium mt-2 flex items-center justify-between">
            <span>Data ditampilkan:</span>
            <span className="font-bold text-stone-800">{filteredRecords.length} baris</span>
          </div>
        </div>
      </div>

      {/* Toolbar Search & Export */}
      <div className="bg-white p-4 rounded-2xl border border-[#D7CCC8]/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari sumber dana, catatan, cabang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors shrink-0 w-full sm:w-auto"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          Ekspor CSV
        </button>
      </div>

      {/* Table Records */}
      <div className="bg-white rounded-2xl border border-[#D7CCC8]/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF3DD]/50 border-b border-[#D7CCC8]/60 text-[11px] font-bold text-[#5D4037] uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Sumber Dana Modal</th>
                <th className="py-3 px-4">Catatan & Keperluan</th>
                <th className="py-3 px-4">Cabang Penempatan</th>
                <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                <th className="py-3 px-4">Pencatat</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    <Coins className="w-10 h-10 mx-auto mb-2 opacity-30 text-stone-500" />
                    <div className="font-bold text-stone-600">Belum ada catatan modal usaha.</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      Klik tombol "Input Tambahan Modal" untuk mencatat setoran modal usaha.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-stone-700 whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#2B1713]">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-xs">
                        {item.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-medium text-stone-800">{item.note}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        <Building2 className="w-3 h-3 text-stone-500" />
                        {item.outletName || item.outletId}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="font-black text-sm text-emerald-800">
                        {formatRp(item.amount)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-stone-600 text-[11px]">
                      {item.createdBy || 'Admin'}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (window.confirm(`Hapus catatan modal dari "${item.source}" sebesar ${formatRp(item.amount)}?`)) {
                            onDeleteCapital(item.id);
                          }
                        }}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus Catatan Modal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2B1713]">
                      Pencatatan Tambahan Modal Usaha
                    </h3>
                    <p className="text-xs text-stone-500">
                      Entri modal disetor untuk operasional / investasi
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 mt-4">
                {/* Cabang */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Cabang Penempatan Modal
                  </label>
                  <select
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        📍 {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sumber Dana */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Sumber Dana Modal <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  >
                    {sourcesList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nominal Modal */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Nominal Modal (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="10000"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Tanggal Setoran Modal
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                {/* Catatan / Keperluan */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Catatan / Alokasi Modal
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Contoh: Pembelian mesin kopi baru / Modal operasional laci kasir..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                {/* Checkbox Auto-Record ke Buku Kas */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="autoRecordCashCheck"
                    checked={autoRecordCash}
                    onChange={(e) => setAutoRecordCash(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-amber-700 focus:ring-amber-700 accent-amber-800"
                  />
                  <label htmlFor="autoRecordCashCheck" className="text-xs text-amber-950 font-medium cursor-pointer">
                    <strong>Otomatis catat ke Buku Kas Masuk (+)</strong>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Menambahkan transaksi kas masuk ke buku kas cabang terkait sehingga saldo kas otomatis bertambah.
                    </p>
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                  >
                    Simpan Modal Usaha
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
