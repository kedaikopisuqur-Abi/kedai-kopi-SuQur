import React, { useState, useMemo } from 'react';
import { CashLedger, Outlet, User, Ingredient } from '../../types';
import { formatRp, formatDate } from '../../utils/formatters';
import { InventoryService } from '../../services/inventoryService';
import { StorageService } from '../../services/storage';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Plus,
  Trash2,
  X,
  Search,
  Calendar,
  Filter,
  Building2,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  DollarSign,
  Package,
  Sparkles,
  Calculator,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CashLedgerTabProps {
  cashLedgers: CashLedger[];
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  currentUser: User;
  ingredients?: Ingredient[];
  onAddLedger: (ledger: CashLedger) => void;
  onDeleteLedger: (id: string) => void;
}

export const CashLedgerTab: React.FC<CashLedgerTabProps> = ({
  cashLedgers,
  outlets,
  activeOutlet,
  currentUser,
  ingredients: passedIngredients,
  onAddLedger,
  onDeleteLedger,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'IN' | 'OUT'>('IN');
  const [category, setCategory] = useState<string>('Modal Usaha');
  const [amount, setAmount] = useState<number>(500000);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS' | 'OTHER'>('CASH');
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : '')
  );

  // Raw Material Linkage State
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [purchaseQty, setPurchaseQty] = useState<number>(1);
  const [autoUpdateStock, setAutoUpdateStock] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const isKasir = currentUser.role === 'kasir';
  const defaultFilterOutlet = isKasir
    ? activeOutlet?.id || currentUser.assignedOutletId || currentUser.outletId || (outlets.length > 0 ? outlets[0].id : 'ALL')
    : 'ALL';

  const [filterOutletId, setFilterOutletId] = useState<string>(defaultFilterOutlet);
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | 'TODAY' | 'THIS_MONTH'>('ALL');

  // Master ingredients list
  const allIngredients = useMemo(() => {
    return passedIngredients && passedIngredients.length > 0
      ? passedIngredients
      : StorageService.getIngredients();
  }, [passedIngredients]);

  const inCategories = [
    'Modal Usaha',
    'Penjualan POS',
    'Pelunasan Piutang Pelanggan',
    'Pendapatan Jasa / Katering',
    'Pendapatan Lain-lain',
  ];

  const outCategories = [
    'Belanja Bahan Baku',
    'Operasional Harian',
    'Pembayaran Hutang Supplier',
    'Gaji Karyawan',
    'Listrik & Air / Utilitas',
    'Sewa Tempat / Booth',
    'Pemeliharaan & Servis Alat',
    'Pengeluaran Lain-lain',
  ];

  const isBahanBakuCategory = selectedType === 'OUT' && (category === 'Belanja Bahan Baku' || category.includes('Bahan'));

  const selectedIngredient = useMemo(() => {
    if (!selectedIngredientId) return null;
    return allIngredients.find((i) => i.id === selectedIngredientId) || null;
  }, [selectedIngredientId, allIngredients]);

  // Current outlet branch stock for selected ingredient
  const currentBranchStock = useMemo(() => {
    if (!selectedIngredientId) return 0;
    return InventoryService.getIngredientStockForOutlet(selectedOutletId, selectedIngredientId);
  }, [selectedOutletId, selectedIngredientId]);

  // Calculated unit cost and weighted average HPP
  const calculatedUnitCost = useMemo(() => {
    if (!purchaseQty || purchaseQty <= 0 || !amount || amount <= 0) return 0;
    return Math.round(amount / purchaseQty);
  }, [amount, purchaseQty]);

  const newEstimatedHPP = useMemo(() => {
    if (!selectedIngredient || !purchaseQty || purchaseQty <= 0 || !amount || amount <= 0) return 0;
    const oldStock = selectedIngredient.currentStock || 0;
    const oldCost = selectedIngredient.costPerUnit || 0;
    if (oldStock <= 0 || oldCost <= 0) return calculatedUnitCost;
    const totalOld = oldStock * oldCost;
    const totalNew = amount;
    return Math.round((totalOld + totalNew) / (oldStock + purchaseQty));
  }, [selectedIngredient, amount, purchaseQty, calculatedUnitCost]);

  // Set default category when type toggles
  const handleTypeToggle = (type: 'IN' | 'OUT') => {
    setSelectedType(type);
    const newCat = type === 'IN' ? inCategories[0] : outCategories[0];
    setCategory(newCat);
    if (type === 'OUT' && newCat === 'Belanja Bahan Baku' && allIngredients.length > 0 && !selectedIngredientId) {
      setSelectedIngredientId(allIngredients[0].id);
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (newCat === 'Belanja Bahan Baku' && allIngredients.length > 0 && !selectedIngredientId) {
      setSelectedIngredientId(allIngredients[0].id);
      if (!description) {
        setDescription(`Belanja ${allIngredients[0].name}`);
      }
    }
  };

  const handleIngredientChange = (ingId: string) => {
    setSelectedIngredientId(ingId);
    const ing = allIngredients.find((i) => i.id === ingId);
    if (ing) {
      setDescription(`Belanja ${ing.name} (${purchaseQty} ${ing.unit})`);
    }
  };

  const handleOpenModal = (type: 'IN' | 'OUT') => {
    handleTypeToggle(type);
    setSelectedOutletId(activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : ''));
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setAmount(type === 'IN' ? 500000 : 150000);
    setPurchaseQty(1);
    setAutoUpdateStock(true);
    if (type === 'OUT' && allIngredients.length > 0) {
      setSelectedIngredientId(allIngredients[0].id);
      setDescription(`Belanja ${allIngredients[0].name}`);
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !description.trim()) {
      alert('Mohon lengkapi nominal dan deskripsi transaksi kas.');
      return;
    }

    const targetOutlet = outlets.find((o) => o.id === selectedOutletId) || activeOutlet;
    const isBelanja = isBahanBakuCategory && selectedIngredient;

    const newEntry: CashLedger = {
      id: 'cl-' + Date.now(),
      date,
      type: selectedType,
      category,
      amount: Number(amount),
      description: description.trim(),
      outletId: targetOutlet?.id || 'outlet-default',
      outletName: targetOutlet?.name || 'Cabang Aktif',
      createdBy: currentUser.name,
      paymentMethod,
      createdAt: new Date().toISOString(),
      ...(isBelanja
        ? {
            ingredientId: selectedIngredient.id,
            ingredientName: selectedIngredient.name,
            quantity: Number(purchaseQty),
            unit: selectedIngredient.unit,
            unitCost: calculatedUnitCost,
            autoUpdateStock: autoUpdateStock,
          }
        : {}),
    };

    // Execute atomic stock increment & HPP recalculation if linked to ingredient
    if (isBelanja && autoUpdateStock && purchaseQty > 0) {
      InventoryService.processPurchaseFromCashExpense({
        outletId: newEntry.outletId,
        outletName: newEntry.outletName,
        ingredientId: selectedIngredient.id,
        quantity: Number(purchaseQty),
        totalCost: Number(amount),
        recordedBy: currentUser.name,
        date: newEntry.date,
        paymentMethod: newEntry.paymentMethod,
        notes: newEntry.description,
        ledgerId: newEntry.id,
      });
    }

    onAddLedger(newEntry);
    setIsModalOpen(false);
    setDescription('');
    setSelectedIngredientId('');
  };

  // Filtered List
  const filteredLedgers = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

    return cashLedgers.filter((item) => {
      if (filterOutletId !== 'ALL' && item.outletId !== filterOutletId) return false;
      if (filterType !== 'ALL' && item.type !== filterType) return false;
      if (filterDateRange === 'TODAY' && item.date !== todayStr) return false;
      if (filterDateRange === 'THIS_MONTH' && !item.date.startsWith(currentMonthPrefix)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        const matchUser = item.createdBy.toLowerCase().includes(q);
        const matchOutlet = (item.outletName || '').toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchUser && !matchOutlet) return false;
      }

      return true;
    });
  }, [cashLedgers, filterOutletId, filterType, filterDateRange, searchQuery]);

  // Totals for Summary Cards (scoped to selected outlet or all)
  const summaryScopedLedgers = useMemo(() => {
    if (filterOutletId === 'ALL') return cashLedgers;
    return cashLedgers.filter((item) => item.outletId === filterOutletId);
  }, [cashLedgers, filterOutletId]);

  const totalKasMasuk = summaryScopedLedgers
    .filter((l) => l.type === 'IN')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalKasKeluar = summaryScopedLedgers
    .filter((l) => l.type === 'OUT')
    .reduce((sum, l) => sum + l.amount, 0);

  const saldoKasBersih = totalKasMasuk - totalKasKeluar;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayIn = summaryScopedLedgers
    .filter((l) => l.type === 'IN' && l.date === todayStr)
    .reduce((sum, l) => sum + l.amount, 0);
  const todayOut = summaryScopedLedgers
    .filter((l) => l.type === 'OUT' && l.date === todayStr)
    .reduce((sum, l) => sum + l.amount, 0);

  const activeOutletName =
    filterOutletId === 'ALL'
      ? 'Semua Cabang'
      : outlets.find((o) => o.id === filterOutletId)?.name || 'Cabang Aktif';

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLedgers.length === 0) {
      alert('Tidak ada data buku kas untuk diekspor.');
      return;
    }

    const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Nominal (Rp)', 'Metode', 'Cabang', 'Pencatat'];
    const rows = filteredLedgers.map((l) => [
      l.id,
      l.date,
      l.type === 'IN' ? 'KAS MASUK' : 'KAS KELUAR',
      `"${l.category}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      l.amount,
      l.paymentMethod || 'CASH',
      `"${l.outletName || l.outletId}"`,
      `"${l.createdBy}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Buku_Kas_${activeOutletName.replace(/\s+/g, '_')}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Action Header & Quick Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-[#2B1713] flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-800" />
            Buku Kas Masuk & Keluar
          </h2>
          <p className="text-xs text-[#5D4037] mt-0.5">
            Pencatatan seluruh arus kas operasional, modal awal, belanja, serta mutasi harian cabang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenModal('IN')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Catat Kas Masuk
          </button>
          <button
            onClick={() => handleOpenModal('OUT')}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <ArrowUpRight className="w-4 h-4" />
            Catat Kas Keluar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kas Masuk */}
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-700" /> Total Kas Masuk
            </span>
            <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
              {activeOutletName}
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-2">
            {formatRp(totalKasMasuk)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Hari ini: <strong className="text-emerald-950 font-bold">{formatRp(todayIn)}</strong>
          </div>
        </div>

        {/* Total Kas Keluar */}
        <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-700" /> Total Kas Keluar
            </span>
            <span className="text-[10px] font-bold bg-rose-200/70 text-rose-900 px-2 py-0.5 rounded-full">
              {activeOutletName}
            </span>
          </div>
          <div className="text-2xl font-black text-rose-900 mt-2">
            {formatRp(totalKasKeluar)}
          </div>
          <div className="text-[11px] text-rose-700 font-medium mt-1">
            Hari ini: <strong className="text-rose-950 font-bold">{formatRp(todayOut)}</strong>
          </div>
        </div>

        {/* Saldo Kas Bersih */}
        <div className={`rounded-2xl p-4.5 shadow-xs border ${
          saldoKasBersih >= 0
            ? 'bg-amber-50/80 border-amber-300 text-amber-950'
            : 'bg-red-50/90 border-red-300 text-red-950'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5 text-amber-900">
              <Wallet className="w-4 h-4 text-amber-700" /> Saldo Kas Aktif
            </span>
            <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
              Bersih
            </span>
          </div>
          <div className="text-2xl font-black mt-2">
            {formatRp(saldoKasBersih)}
          </div>
          <div className="text-[11px] text-amber-800 font-medium mt-1">
            Akumulasi Kas Masuk - Keluar
          </div>
        </div>

        {/* Total Catatan & Outlet Selector */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-stone-600" /> Filter Cabang Kas
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
                className="mt-2 w-full text-xs font-bold bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
              >
                <option value="ALL">🏢 Semua Cabang ({cashLedgers.length} transaksi)</option>
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
            <span className="font-bold text-stone-800">{filteredLedgers.length} baris</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Search */}
      <div className="bg-white p-4 rounded-2xl border border-[#D7CCC8]/60 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari deskripsi, kategori, atau pencatat..."
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

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterType === 'ALL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterType('IN')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterType === 'IN' ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-100/60'
              }`}
            >
              <ArrowDownLeft className="w-3 h-3" /> Masuk
            </button>
            <button
              onClick={() => setFilterType('OUT')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterType === 'OUT' ? 'bg-rose-700 text-white shadow-xs' : 'text-rose-800 hover:bg-rose-100/60'
              }`}
            >
              <ArrowUpRight className="w-3 h-3" /> Keluar
            </button>
          </div>

          {/* Date Filter Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterDateRange('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterDateRange === 'ALL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Semua Waktu
            </button>
            <button
              onClick={() => setFilterDateRange('TODAY')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterDateRange === 'TODAY' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setFilterDateRange('THIS_MONTH')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterDateRange === 'THIS_MONTH' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors shrink-0"
            title="Download CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-[#D7CCC8]/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF3DD]/50 border-b border-[#D7CCC8]/60 text-[11px] font-bold text-[#5D4037] uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal & Waktu</th>
                <th className="py-3 px-4">Tipe & Kategori</th>
                <th className="py-3 px-4">Deskripsi / Catatan</th>
                <th className="py-3 px-4">Cabang</th>
                <th className="py-3 px-4">Metode</th>
                <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                <th className="py-3 px-4">Pencatat</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {filteredLedgers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30 text-stone-500" />
                    <div className="font-bold text-stone-600">Belum ada catatan transaksi buku kas.</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      Gunakan tombol "Catat Kas Masuk" atau "Catat Kas Keluar" di atas untuk menambah data.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLedgers.map((item) => {
                  const isIncoming = item.type === 'IN';
                  return (
                    <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                      {/* Tanggal */}
                      <td className="py-3.5 px-4 font-medium text-stone-700 whitespace-nowrap">
                        <div>{formatDate(item.date)}</div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                      </td>

                      {/* Tipe & Kategori */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIncoming
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isIncoming ? (
                              <>
                                <ArrowDownLeft className="w-2.5 h-2.5" /> Masuk
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="w-2.5 h-2.5" /> Keluar
                              </>
                            )}
                          </span>
                        </div>
                        <div className="font-bold text-[#2B1713] mt-0.5">{item.category}</div>
                      </td>

                      {/* Deskripsi */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-stone-800 truncate" title={item.description}>
                          {item.description}
                        </div>
                        {item.ingredientName && (
                          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                            <Package className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>+{item.quantity} {item.unit || ''} {item.ingredientName}</span>
                            {item.autoUpdateStock !== false && (
                              <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1 py-0.2 rounded-xs font-semibold">
                                Stok Auto
                              </span>
                            )}
                          </div>
                        )}
                        {item.referenceId && (
                          <span className="text-[10px] text-stone-400 font-mono block mt-0.5">
                            Ref: {item.referenceId}
                          </span>
                        )}
                      </td>

                      {/* Cabang */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          <Building2 className="w-3 h-3 text-stone-500" />
                          {item.outletName || item.outletId}
                        </span>
                      </td>

                      {/* Metode */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-stone-600 uppercase">
                        {item.paymentMethod || 'CASH'}
                      </td>

                      {/* Nominal */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-black text-sm ${
                            isIncoming ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIncoming ? '+' : '-'} {formatRp(item.amount)}
                        </span>
                      </td>

                      {/* Pencatat */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-stone-600 text-[11px]">
                        {item.createdBy}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus catatan kas "${item.description}" senilai ${formatRp(item.amount)}?`)) {
                              onDeleteLedger(item.id);
                            }
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Catatan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Kas Masuk / Keluar */}
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
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                      selectedType === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {selectedType === 'IN' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2B1713]">
                      Catat {selectedType === 'IN' ? 'Kas Masuk (+)' : 'Kas Keluar (-)'}
                    </h3>
                    <p className="text-xs text-stone-500">
                      Entri buku kas cabang Su-Qur POS
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
                {/* Switcher Tipe */}
                <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleTypeToggle('IN')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      selectedType === 'IN'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" /> Kas Masuk (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeToggle('OUT')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      selectedType === 'OUT'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Kas Keluar (-)
                  </button>
                </div>

                {/* Cabang */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Cabang / Lokasi Kas
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

                {/* Kategori */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Kategori Transaksi
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  >
                    {(selectedType === 'IN' ? inCategories : outCategories).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section Khusus: Integrasi Otomatis Stok Bahan Baku & HPP (Jika Kategori Belanja Bahan Baku) */}
                {isBahanBakuCategory && (
                  <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                        <Package className="w-4 h-4 text-amber-700" />
                        <span>Integrasi Stok Bahan Baku & HPP</span>
                      </div>
                      <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Auto-Sync
                      </span>
                    </div>

                    {/* Dropdown Pilih Bahan Baku */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        Pilih Item Bahan Baku <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedIngredientId}
                        onChange={(e) => handleIngredientChange(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700 shadow-2xs"
                        required={isBahanBakuCategory}
                      >
                        <option value="" disabled>-- Pilih Bahan Baku dari Inventori --</option>
                        {allIngredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            📦 {ing.name} (Stok: {ing.currentStock} {ing.unit} | HPP: Rp {ing.costPerUnit.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Input Jumlah Pembelian (Qty) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 mb-1">
                          Jumlah Pembelian (Qty) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={purchaseQty || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setPurchaseQty(val);
                              if (selectedIngredient) {
                                setDescription(`Belanja ${selectedIngredient.name} (${val} ${selectedIngredient.unit})`);
                              }
                            }}
                            className="w-full pl-3 pr-14 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700 shadow-2xs"
                            placeholder="Contoh: 5"
                            required={isBahanBakuCategory}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                            {selectedIngredient?.unit || 'satuan'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Qty Shortcuts */}
                      <div className="flex flex-col justify-end">
                        <span className="text-[10px] text-amber-800 font-semibold mb-1">Tambah Cepat:</span>
                        <div className="flex items-center gap-1">
                          {[1, 5, 10, 50].map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => {
                                const nextVal = (purchaseQty || 0) + step;
                                setPurchaseQty(nextVal);
                                if (selectedIngredient) {
                                  setDescription(`Belanja ${selectedIngredient.name} (${nextVal} ${selectedIngredient.unit})`);
                                }
                              }}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 text-[10px] font-bold rounded-lg transition-colors shadow-2xs"
                            >
                              +{step}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Simulation Card (HPP & Cabang Stock) */}
                    {selectedIngredient && purchaseQty > 0 && amount > 0 && (
                      <div className="bg-white/90 border border-amber-200 rounded-xl p-2.5 text-[11px] space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-stone-700">
                          <span className="text-stone-500">Harga Satuan Beli:</span>
                          <span className="font-bold text-stone-900">
                            Rp {calculatedUnitCost.toLocaleString('id-ID')} / {selectedIngredient.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-stone-700">
                          <span className="text-stone-500">HPP Baru (Moving Avg):</span>
                          <span className="font-bold text-amber-900">
                            Rp {selectedIngredient.costPerUnit?.toLocaleString('id-ID') || 0} ➔ <span className="text-emerald-700">Rp {newEstimatedHPP.toLocaleString('id-ID')}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-stone-700 pt-1 border-t border-amber-100">
                          <span className="text-stone-500">Stok Cabang ({outlets.find(o => o.id === selectedOutletId)?.name || 'Aktif'}):</span>
                          <span className="font-bold text-emerald-800">
                            {currentBranchStock} {selectedIngredient.unit} ➔ <span className="underline">{(currentBranchStock + Number(purchaseQty)).toLocaleString('id-ID')} {selectedIngredient.unit}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Checkbox Otomatis Update */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-amber-950 cursor-pointer select-none pt-0.5">
                      <input
                        type="checkbox"
                        checked={autoUpdateStock}
                        onChange={(e) => setAutoUpdateStock(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-800 focus:ring-amber-700 border-amber-300"
                      />
                      <span>Otomatis tambah stok cabang & perbarui HPP inventori</span>
                    </label>
                  </div>
                )}

                {/* Nominal */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    {isBahanBakuCategory ? 'Total Biaya Belanja Kas (Rp)' : 'Nominal Kas (Rp)'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1000"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                {/* Tanggal & Metode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#5D4037] mb-1">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5D4037] mb-1">
                      Metode Pembayaran
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                    >
                      <option value="CASH">Tunai (Cash Laci)</option>
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="QRIS">QRIS / E-Wallet</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Keterangan / Deskripsi <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contoh: Beli es batu kristal 5 kantong / Tambahan modal kasir shift 1..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                    required
                  />
                </div>

                {/* Action Buttons */}
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
                    className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-all ${
                      selectedType === 'IN'
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : 'bg-rose-700 hover:bg-rose-800'
                    }`}
                  >
                    Simpan Catatan Kas
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
