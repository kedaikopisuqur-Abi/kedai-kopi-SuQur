import React, { useState, useMemo } from 'react';
import { DebtRecord, DebtPayment, Outlet, User } from '../../types';
import { formatRp, formatDate } from '../../utils/formatters';
import {
  CreditCard,
  Plus,
  Trash2,
  X,
  Search,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  History,
  Phone,
  DollarSign,
  AlertCircle,
  Eye,
  BadgeAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DebtReceivablesTabProps {
  debtRecords: DebtRecord[];
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  currentUser: User;
  onAddDebt: (record: DebtRecord) => void;
  onAddPayment: (
    debtId: string,
    payment: DebtPayment,
    autoRecordCashLedger?: boolean
  ) => void;
  onDeleteDebt: (id: string) => void;
}

export const DebtReceivablesTab: React.FC<DebtReceivablesTabProps> = ({
  debtRecords,
  outlets,
  activeOutlet,
  currentUser,
  onAddDebt,
  onAddPayment,
  onDeleteDebt,
}) => {
  // Modal State for New Debt/Receivable
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [recordType, setRecordType] = useState<'DEBT_SUPPLIER' | 'RECEIVABLE_CUSTOMER'>('DEBT_SUPPLIER');
  const [entityName, setEntityName] = useState('');
  const [phone, setPhone] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(1000000);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // Default 14 hari kedepan
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : '')
  );

  // Modal State for Installment Payment
  const [paymentModalDebt, setPaymentModalDebt] = useState<DebtRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS'>('TRANSFER');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [autoRecordCash, setAutoRecordCash] = useState<boolean>(true);

  // Modal State for Payment History Timeline View
  const [historyModalDebt, setHistoryModalDebt] = useState<DebtRecord | null>(null);

  // Filters
  const isKasir = currentUser.role === 'kasir';
  const defaultFilterOutlet = isKasir
    ? activeOutlet?.id || currentUser.assignedOutletId || currentUser.outletId || (outlets.length > 0 ? outlets[0].id : 'ALL')
    : 'ALL';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DEBT_SUPPLIER' | 'RECEIVABLE_CUSTOMER'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID_PARTIAL' | 'PAID' | 'OVERDUE'>('ALL');
  const [filterOutletId, setFilterOutletId] = useState<string>(defaultFilterOutlet);

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper check overdue
  const isOverdue = (record: DebtRecord) => {
    if (record.status === 'PAID') return false;
    return record.dueDate < todayStr;
  };

  const isDueSoon = (record: DebtRecord) => {
    if (record.status === 'PAID') return false;
    const diffDays = Math.ceil((new Date(record.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return diffDays >= 0 && diffDays <= 3;
  };

  const handleOpenAddModal = (type: 'DEBT_SUPPLIER' | 'RECEIVABLE_CUSTOMER') => {
    setRecordType(type);
    setSelectedOutletId(activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : ''));
    setEntityName('');
    setPhone('');
    setTotalAmount(type === 'DEBT_SUPPLIER' ? 1500000 : 350000);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split('T')[0]);
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleSaveNewDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim() || totalAmount <= 0 || !dueDate) {
      alert('Mohon lengkapi nama pihak, nominal total, dan tanggal jatuh tempo.');
      return;
    }

    const targetOutlet = outlets.find((o) => o.id === selectedOutletId) || activeOutlet;
    const newRecord: DebtRecord = {
      id: 'debt-' + Date.now(),
      type: recordType,
      entityName: entityName.trim(),
      phone: phone.trim() || undefined,
      totalAmount: Number(totalAmount),
      remainingAmount: Number(totalAmount),
      dueDate,
      status: 'UNPAID',
      notes: notes.trim(),
      outletId: targetOutlet?.id || 'outlet-default',
      outletName: targetOutlet?.name || 'Cabang Aktif',
      historyPayment: [],
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
    };

    onAddDebt(newRecord);
    setIsAddModalOpen(false);
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (record: DebtRecord) => {
    setPaymentModalDebt(record);
    setPaymentAmount(record.remainingAmount);
    setPaymentMethod('TRANSFER');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setAutoRecordCash(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebt) return;

    if (paymentAmount <= 0) {
      alert('Nominal pembayaran cicilan harus lebih dari Rp 0.');
      return;
    }

    if (paymentAmount > paymentModalDebt.remainingAmount) {
      alert(`Nominal bayar (${formatRp(paymentAmount)}) melebihi sisa tagihan (${formatRp(paymentModalDebt.remainingAmount)}).`);
      return;
    }

    const newPayment: DebtPayment = {
      id: 'pay-' + Date.now(),
      date: paymentDate,
      amount: Number(paymentAmount),
      paymentMethod,
      notes: paymentNotes.trim() || (paymentAmount >= paymentModalDebt.remainingAmount ? 'Pelunasan Tagihan' : 'Cicilan Tagihan'),
      recordedBy: currentUser.name,
    };

    onAddPayment(paymentModalDebt.id, newPayment, autoRecordCash);
    setPaymentModalDebt(null);
  };

  // Filtered Debt Records
  const filteredRecords = useMemo(() => {
    return debtRecords.filter((item) => {
      if (filterOutletId !== 'ALL' && item.outletId !== filterOutletId) return false;
      if (filterType !== 'ALL' && item.type !== filterType) return false;

      if (filterStatus === 'UNPAID_PARTIAL') {
        if (item.status === 'PAID') return false;
      } else if (filterStatus === 'PAID') {
        if (item.status !== 'PAID') return false;
      } else if (filterStatus === 'OVERDUE') {
        if (!isOverdue(item)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.entityName.toLowerCase().includes(q);
        const matchNotes = item.notes.toLowerCase().includes(q);
        const matchPhone = (item.phone || '').toLowerCase().includes(q);
        const matchOutlet = (item.outletName || '').toLowerCase().includes(q);
        if (!matchName && !matchNotes && !matchPhone && !matchOutlet) return false;
      }

      return true;
    });
  }, [debtRecords, filterOutletId, filterType, filterStatus, searchQuery, todayStr]);

  // Summaries
  const scopedList = useMemo(() => {
    if (filterOutletId === 'ALL') return debtRecords;
    return debtRecords.filter((r) => r.outletId === filterOutletId);
  }, [debtRecords, filterOutletId]);

  const totalHutangSupplierSisa = scopedList
    .filter((r) => r.type === 'DEBT_SUPPLIER')
    .reduce((sum, r) => sum + r.remainingAmount, 0);

  const totalPiutangPelangganSisa = scopedList
    .filter((r) => r.type === 'RECEIVABLE_CUSTOMER')
    .reduce((sum, r) => sum + r.remainingAmount, 0);

  const totalOverdueCount = scopedList.filter((r) => isOverdue(r)).length;
  const totalOverdueAmount = scopedList
    .filter((r) => isOverdue(r))
    .reduce((sum, r) => sum + r.remainingAmount, 0);

  const activeOutletName =
    filterOutletId === 'ALL'
      ? 'Semua Cabang'
      : outlets.find((o) => o.id === filterOutletId)?.name || 'Cabang Aktif';

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('Tidak ada data hutang/piutang untuk diekspor.');
      return;
    }

    const headers = [
      'ID',
      'Tipe',
      'Nama Pihak (Supplier/Pelanggan)',
      'No Telp',
      'Total Tagihan (Rp)',
      'Sisa Tagihan (Rp)',
      'Jatuh Tempo',
      'Status',
      'Catatan',
      'Cabang',
      'Jumlah Cicilan',
    ];

    const rows = filteredRecords.map((r) => [
      r.id,
      r.type === 'DEBT_SUPPLIER' ? 'HUTANG SUPPLIER' : 'PIUTANG BON PELANGGAN',
      `"${r.entityName}"`,
      `"${r.phone || '-'}"`,
      r.totalAmount,
      r.remainingAmount,
      r.dueDate,
      r.status,
      `"${r.notes.replace(/"/g, '""')}"`,
      `"${r.outletName || r.outletId}"`,
      r.historyPayment?.length || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Hutang_Piutang_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-[#2B1713] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-700" />
            Manajemen Hutang Supplier & Piutang Bon Pelanggan
          </h2>
          <p className="text-xs text-[#5D4037] mt-0.5">
            Catat invoice tagihan bahan ke supplier, bon tagihan pelanggan, pembayaran bertahap, dan notifikasi jatuh tempo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenAddModal('DEBT_SUPPLIER')}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Catat Hutang Supplier
          </button>
          <button
            onClick={() => handleOpenAddModal('RECEIVABLE_CUSTOMER')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Catat Piutang Bon Pelanggan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Hutang Supplier */}
        <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-rose-700" /> Sisa Hutang ke Supplier
            </span>
            <span className="text-[10px] font-bold bg-rose-200/70 text-rose-900 px-2 py-0.5 rounded-full">
              Kewajiban
            </span>
          </div>
          <div className="text-2xl font-black text-rose-950 mt-2">
            {formatRp(totalHutangSupplierSisa)}
          </div>
          <div className="text-[11px] text-rose-700 font-medium mt-1">
            Harus dibayarkan ke rekanan supplier
          </div>
        </div>

        {/* Total Piutang Pelanggan */}
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-700" /> Sisa Piutang Pelanggan
            </span>
            <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
              Tagihan Bon
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">
            {formatRp(totalPiutangPelangganSisa)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Penerimaan kas tertunda dari pelanggan
          </div>
        </div>

        {/* Tagihan Overdue / Jatuh Tempo */}
        <div className={`rounded-2xl p-4.5 shadow-xs border ${
          totalOverdueCount > 0
            ? 'bg-amber-50/90 border-amber-300 text-amber-950'
            : 'bg-stone-50 border-stone-200 text-stone-700'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-700" /> Lewat Jatuh Tempo
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              totalOverdueCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-stone-200 text-stone-800'
            }`}>
              {totalOverdueCount} Tagihan
            </span>
          </div>
          <div className="text-2xl font-black mt-2">
            {formatRp(totalOverdueAmount)}
          </div>
          <div className="text-[11px] font-medium mt-1 opacity-80">
            {totalOverdueCount > 0 ? 'Perlu tindakan follow-up / bayar segera' : 'Tidak ada tagihan tertunggak'}
          </div>
        </div>

        {/* Filter Outlet Card */}
        <div className="bg-white border border-[#D7CCC8]/60 rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-[#5D4037] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-stone-600" /> Filter Cabang Tagihan
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
                className="mt-2 w-full text-xs font-bold bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
              >
                <option value="ALL">🏢 Semua Cabang ({debtRecords.length} tagihan)</option>
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
            <span className="font-bold text-stone-800">{filteredRecords.length} tagihan</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Search */}
      <div className="bg-white p-4 rounded-2xl border border-[#D7CCC8]/60 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama supplier/pelanggan, nomor telp, atau catatan..."
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
              Semua Tipe
            </button>
            <button
              onClick={() => setFilterType('DEBT_SUPPLIER')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterType === 'DEBT_SUPPLIER'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-rose-800 hover:bg-rose-100/60'
              }`}
            >
              Hutang Supplier
            </button>
            <button
              onClick={() => setFilterType('RECEIVABLE_CUSTOMER')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterType === 'RECEIVABLE_CUSTOMER'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-100/60'
              }`}
            >
              Piutang Pelanggan
            </button>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterStatus === 'ALL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Semua Status
            </button>
            <button
              onClick={() => setFilterStatus('UNPAID_PARTIAL')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterStatus === 'UNPAID_PARTIAL'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-amber-900 hover:bg-amber-100/60'
              }`}
            >
              Belum Lunas
            </button>
            <button
              onClick={() => setFilterStatus('OVERDUE')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterStatus === 'OVERDUE'
                  ? 'bg-rose-800 text-white shadow-xs'
                  : 'text-rose-800 hover:bg-rose-100/60'
              }`}
            >
              Jatuh Tempo ⚠️
            </button>
            <button
              onClick={() => setFilterStatus('PAID')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterStatus === 'PAID'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-100/60'
              }`}
            >
              Lunas
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Debt / Receivables Table */}
      <div className="bg-white rounded-2xl border border-[#D7CCC8]/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF3DD]/50 border-b border-[#D7CCC8]/60 text-[11px] font-bold text-[#5D4037] uppercase tracking-wider">
                <th className="py-3 px-4">Tipe & Entitas</th>
                <th className="py-3 px-4">Keterangan / Faktur</th>
                <th className="py-3 px-4">Cabang</th>
                <th className="py-3 px-4 text-right">Total Nominal</th>
                <th className="py-3 px-4 text-right">Sisa Tagihan</th>
                <th className="py-3 px-4">Jatuh Tempo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi / Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30 text-stone-500" />
                    <div className="font-bold text-stone-600">Tidak ada catatan hutang / piutang yang sesuai.</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      Gunakan tombol pendaftaran hutang supplier atau piutang pelanggan untuk menambah tagihan baru.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => {
                  const isSupplierDebt = item.type === 'DEBT_SUPPLIER';
                  const overdue = isOverdue(item);
                  const dueSoon = isDueSoon(item);
                  const isPaid = item.status === 'PAID';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        overdue ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Tipe & Entitas */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-1 ${
                            isSupplierDebt
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isSupplierDebt ? 'Hutang Supplier' : 'Piutang Bon Pelanggan'}
                        </span>
                        <div className="font-bold text-[#2B1713] text-sm">
                          {item.entityName}
                        </div>
                        {item.phone && (
                          <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-stone-400" /> {item.phone}
                          </div>
                        )}
                      </td>

                      {/* Keterangan */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-stone-800 line-clamp-2" title={item.notes}>
                          {item.notes || '-'}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                          Tgl Dibuat: {item.createdAt ? formatDate(item.createdAt.split('T')[0]) : '-'}
                        </div>
                      </td>

                      {/* Cabang */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          <Building2 className="w-3 h-3 text-stone-500" />
                          {item.outletName || item.outletId}
                        </span>
                      </td>

                      {/* Total Nominal */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-stone-600">
                        {formatRp(item.totalAmount)}
                      </td>

                      {/* Sisa Tagihan */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div
                          className={`font-black text-sm ${
                            isPaid
                              ? 'text-emerald-700'
                              : isSupplierDebt
                              ? 'text-rose-700'
                              : 'text-amber-800'
                          }`}
                        >
                          {formatRp(item.remainingAmount)}
                        </div>
                        {item.historyPayment && item.historyPayment.length > 0 && (
                          <div className="text-[10px] text-stone-400">
                            {item.historyPayment.length}x cicilan
                          </div>
                        )}
                      </td>

                      {/* Jatuh Tempo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-stone-700 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          {formatDate(item.dueDate)}
                        </div>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-md mt-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Terlambat
                          </span>
                        )}
                        {!overdue && dueSoon && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md mt-1">
                            <Clock className="w-2.5 h-2.5" /> Segera Jatuh Tempo
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Lunas
                          </span>
                        ) : item.status === 'PARTIAL' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                            <Clock className="w-3.5 h-3.5" /> Dicicil Sebagian
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-800 border border-stone-300">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Belum Dibayar
                          </span>
                        )}
                      </td>

                      {/* Aksi & Pembayaran */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => handleOpenPaymentModal(item)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-bold text-xs shadow-xs transition-all"
                              title="Bayar Cicilan / Pelunasan"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Bayar / Cicil
                            </button>
                          )}

                          {item.historyPayment && item.historyPayment.length > 0 && (
                            <button
                              onClick={() => setHistoryModalDebt(item)}
                              className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                              title="Lihat Riwayat Cicilan"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus catatan tagihan "${item.entityName}" senilai ${formatRp(item.totalAmount)}?`)) {
                                onDeleteDebt(item.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Tagihan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Pendaftaran Hutang / Piutang Baru */}
      <AnimatePresence>
        {isAddModalOpen && (
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
                      recordType === 'DEBT_SUPPLIER'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2B1713]">
                      Catat {recordType === 'DEBT_SUPPLIER' ? 'Hutang ke Supplier' : 'Piutang Bon Pelanggan'}
                    </h3>
                    <p className="text-xs text-stone-500">
                      Entri kewajiban bayar atau tagihan tempo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewDebt} className="space-y-4 mt-4">
                {/* Switcher Tipe */}
                <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setRecordType('DEBT_SUPPLIER')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      recordType === 'DEBT_SUPPLIER'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Hutang Supplier
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordType('RECEIVABLE_CUSTOMER')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      recordType === 'RECEIVABLE_CUSTOMER'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" /> Piutang Pelanggan
                  </button>
                </div>

                {/* Cabang */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Cabang Terkait
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

                {/* Nama Pihak (Supplier / Pelanggan) */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    {recordType === 'DEBT_SUPPLIER' ? 'Nama Supplier / Rekanan' : 'Nama Pelanggan / Instansi'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder={
                      recordType === 'DEBT_SUPPLIER'
                        ? 'Contoh: CV Gayo Roastery / Toko Plastik Makmur'
                        : 'Contoh: Pak Budi (Kantor Kelurahan) / Ibu Anita'
                    }
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                    required
                  />
                </div>

                {/* No Telepon */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Nomor WhatsApp / Kontak (Opsional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                {/* Nominal & Jatuh Tempo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#5D4037] mb-1">
                      Total Nominal (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1000"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5D4037] mb-1">
                      Tanggal Jatuh Tempo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                      required
                    />
                  </div>
                </div>

                {/* Keterangan / Faktur */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Catatan / Nomor Faktur / Rincian Pesanan
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Faktur PO-089 Biji Kopi Arabika 10kg / Bon Katering 35 Cup Es Kopi..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-all ${
                      recordType === 'DEBT_SUPPLIER'
                        ? 'bg-rose-700 hover:bg-rose-800'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                    }`}
                  >
                    Simpan Tagihan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Pembayaran Cicilan / Pelunasan */}
      <AnimatePresence>
        {paymentModalDebt && (
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
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2B1713]">
                      {paymentModalDebt.type === 'DEBT_SUPPLIER' ? 'Bayar Hutang Supplier' : 'Terima Piutang Pelanggan'}
                    </h3>
                    <p className="text-xs text-stone-500">
                      {paymentModalDebt.entityName} &bull; Sisa: {formatRp(paymentModalDebt.remainingAmount)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPaymentModalDebt(null)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePayment} className="space-y-4 mt-4">
                {/* Info Card */}
                <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Total Tagihan Awal:</span>
                    <strong className="text-stone-800">{formatRp(paymentModalDebt.totalAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Sisa Tagihan Saat Ini:</span>
                    <strong className="text-amber-900 font-bold">{formatRp(paymentModalDebt.remainingAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Jatuh Tempo:</span>
                    <span className="text-stone-700">{formatDate(paymentModalDebt.dueDate)}</span>
                  </div>
                </div>

                {/* Quick Buttons Nominal */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={paymentModalDebt.remainingAmount}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(paymentModalDebt.remainingAmount)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold rounded-lg transition-colors"
                    >
                      Bayar Lunas ({formatRp(paymentModalDebt.remainingAmount)})
                    </button>
                    {paymentModalDebt.remainingAmount > 100000 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(Math.round(paymentModalDebt.remainingAmount / 2))}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold rounded-lg transition-colors"
                      >
                        50% Tagihan
                      </button>
                    )}
                  </div>
                </div>

                {/* Tanggal & Metode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#5D4037] mb-1">
                      Tanggal Bayar
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
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
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="CASH">Tunai (Kas Laci)</option>
                      <option value="QRIS">QRIS / E-Wallet</option>
                    </select>
                  </div>
                </div>

                {/* Catatan Pembayaran */}
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1">
                    Catatan Pembayaran / No Referensi
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Contoh: Cicilan termin 1 via BCA / Pelunasan tunai..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                {/* Auto Record Cash Ledger */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="autoRecordDebtCash"
                    checked={autoRecordCash}
                    onChange={(e) => setAutoRecordCash(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-amber-700 focus:ring-amber-700 accent-amber-800"
                  />
                  <label htmlFor="autoRecordDebtCash" className="text-xs text-stone-900 font-medium cursor-pointer">
                    <strong>
                      Otomatis catat ke Buku Kas (
                      {paymentModalDebt.type === 'DEBT_SUPPLIER' ? 'Kas Keluar -' : 'Kas Masuk +'}
                      )
                    </strong>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {paymentModalDebt.type === 'DEBT_SUPPLIER'
                        ? 'Membuat mutasi kas keluar di buku kas cabang'
                        : 'Membuat mutasi kas masuk pelunasan piutang di buku kas cabang'}
                    </p>
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setPaymentModalDebt(null)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                  >
                    Proses Pembayaran
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Riwayat Cicilan / Pembayaran */}
      <AnimatePresence>
        {historyModalDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2B1713]">
                      Riwayat Pembayaran & Cicilan
                    </h3>
                    <p className="text-xs text-stone-500">
                      {historyModalDebt.entityName} &bull; Total: {formatRp(historyModalDebt.totalAmount)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryModalDebt(null)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
                {/* Summary Box */}
                <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
                  <div>
                    <span className="text-stone-400 text-[11px]">Total Terbayar:</span>
                    <div className="font-black text-emerald-800 text-sm">
                      {formatRp(historyModalDebt.totalAmount - historyModalDebt.remainingAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[11px]">Sisa Tagihan:</span>
                    <div className="font-black text-amber-900 text-sm">
                      {formatRp(historyModalDebt.remainingAmount)}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-[#5D4037] uppercase tracking-wider">
                    Log Transaksi Pembayaran ({historyModalDebt.historyPayment?.length || 0})
                  </h4>

                  {!historyModalDebt.historyPayment || historyModalDebt.historyPayment.length === 0 ? (
                    <div className="text-center py-6 text-stone-400 text-xs">
                      Belum ada catatan pembayaran cicilan.
                    </div>
                  ) : (
                    historyModalDebt.historyPayment.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            {formatDate(p.date)} &bull;{' '}
                            <span className="font-mono text-stone-500 uppercase">{p.paymentMethod}</span>
                          </div>
                          <div className="text-stone-500 text-[11px] mt-0.5 ml-6.5">
                            {p.notes || 'Tanpa catatan tambahan'}
                          </div>
                          <div className="text-stone-400 text-[10px] ml-6.5">
                            Diterima oleh: {p.recordedBy}
                          </div>
                        </div>

                        <div className="font-black text-emerald-700 text-sm">
                          {formatRp(p.amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 mt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setHistoryModalDebt(null)}
                  className="px-5 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
