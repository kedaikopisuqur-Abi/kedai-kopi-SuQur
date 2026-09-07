import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Printer,
  DollarSign,
  CheckCircle2,
  Clock,
  Building2,
  User,
  Trash2,
  Edit3,
  Send,
  Download,
  Share2,
  Calendar,
  Layers,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Calculator,
} from 'lucide-react';
import { PayrollRecord, StoreSettings, User as UserType, Outlet } from '../../types';
import { StorageService } from '../../services/storage';
import { formatRp, formatDate } from '../../utils/formatters';
import { PayrollSlipModal } from './PayrollSlipModal';
import { PayrollFormModal } from './PayrollFormModal';

interface PayrollScreenProps {
  settings: StoreSettings;
  users: UserType[];
  outlets: Outlet[];
  currentOutletId: string;
  currentUser?: UserType | null;
  onNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PayrollScreen: React.FC<PayrollScreenProps> = ({
  settings,
  users,
  outlets,
  currentOutletId,
  currentUser,
  onNotification,
}) => {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() =>
    StorageService.getPayrollRecords()
  );

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [selectedSlipForPrint, setSelectedSlipForPrint] = useState<PayrollRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'DRAFT'>('ALL');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(
    currentOutletId && currentOutletId !== 'ALL' ? currentOutletId : 'ALL'
  );
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('ALL');

  // Quick Pay Modal State
  const [payingRecord, setPayingRecord] = useState<PayrollRecord | null>(null);
  const [payMethod, setPayMethod] = useState<'TRANSFER' | 'CASH' | 'QRIS' | 'OTHER'>('TRANSFER');

  // Refresh records from storage
  const refreshRecords = () => {
    setPayrollRecords(StorageService.getPayrollRecords());
  };

  // Available Periods list for dropdown filter
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    payrollRecords.forEach((r) => {
      if (r.period) set.add(r.period);
    });
    return Array.from(set);
  }, [payrollRecords]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return payrollRecords.filter((rec) => {
      const matchSearch =
        rec.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.employeeRole && rec.employeeRole.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rec.period && rec.period.toLowerCase().includes(searchQuery.toLowerCase())) ||
        rec.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || rec.status === statusFilter;
      const matchOutlet = selectedOutletFilter === 'ALL' || rec.outletId === selectedOutletFilter;
      const matchPeriod = selectedPeriodFilter === 'ALL' || rec.period === selectedPeriodFilter;

      return matchSearch && matchStatus && matchOutlet && matchPeriod;
    });
  }, [payrollRecords, searchQuery, statusFilter, selectedOutletFilter, selectedPeriodFilter]);

  // Stats Calculations
  const stats = useMemo(() => {
    const targetList =
      selectedOutletFilter === 'ALL'
        ? payrollRecords
        : payrollRecords.filter((r) => r.outletId === selectedOutletFilter);

    const totalAllTHP = targetList.reduce((acc, curr) => acc + curr.netSalary, 0);
    const paidList = targetList.filter((r) => r.status === 'PAID');
    const totalPaidTHP = paidList.reduce((acc, curr) => acc + curr.netSalary, 0);
    const draftList = targetList.filter((r) => r.status === 'DRAFT');
    const totalDraftTHP = draftList.reduce((acc, curr) => acc + curr.netSalary, 0);
    const totalEmployeesCount = new Set(targetList.map((r) => r.employeeName)).size;

    return {
      totalAllTHP,
      totalPaidTHP,
      totalDraftTHP,
      paidCount: paidList.length,
      draftCount: draftList.length,
      totalEmployeesCount,
    };
  }, [payrollRecords, selectedOutletFilter]);

  // Handle Save (Add / Update)
  const handleSaveRecord = (record: PayrollRecord, autoRecordCashLedger: boolean) => {
    if (editingRecord) {
      StorageService.updatePayrollRecord(record, autoRecordCashLedger);
      onNotification?.('Data slip gaji berhasil diperbarui!', 'success');
    } else {
      StorageService.addPayrollRecord(record, autoRecordCashLedger);
      onNotification?.('Slip gaji baru berhasil diterbitkan!', 'success');
    }
    refreshRecords();
    setEditingRecord(null);
    setIsFormOpen(false);
  };

  // Handle Delete
  const handleDeleteRecord = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus slip gaji ini? Jika sudah tercatat di Buku Kas, transaksi kas terkait juga akan dihapus.')) {
      StorageService.deletePayrollRecord(id);
      refreshRecords();
      onNotification?.('Slip gaji berhasil dihapus.', 'info');
    }
  };

  // Handle Quick Pay
  const handleConfirmQuickPay = (record: PayrollRecord) => {
    const updated = StorageService.markPayrollPaid(
      record.id,
      payMethod,
      currentUser?.name || 'Admin',
      true
    );
    if (updated) {
      refreshRecords();
      onNotification?.(
        `Gaji ${record.employeeName} (${formatRp(record.netSalary)}) berhasil dibayar & dicatat ke Buku Kas!`,
        'success'
      );
    }
    setPayingRecord(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-[#3E2723] to-[#2B1713] text-[#FAF3DD] p-6 rounded-3xl shadow-xl border border-[#5D4037]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-[#FAF3DD]">
              Manajemen & Slip Gaji Karyawan (Payroll)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#D7CCC8] pl-12.5">
            Kelola gaji pokok, tunjangan, insentif, potongan kasbon, cetak struk thermal, dan integrasi kas otomatis.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Slip Gaji Baru</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Payroll */}
        <div className="bg-white p-5 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Penggajian</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-serif font-black text-[#3E2723]">
            {formatRp(stats.totalAllTHP)}
          </div>
          <p className="text-[11px] text-stone-500 font-medium">
            Akumulasi seluruh slip gaji di outlet terpilih
          </p>
        </div>

        {/* Card 2: Total Paid */}
        <div className="bg-white p-5 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <span>Sudah Dibayar (PAID)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-serif font-black text-emerald-800">
            {formatRp(stats.totalPaidTHP)}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">
            {stats.paidCount} transaksi lunas & tercatat di Buku Kas
          </p>
        </div>

        {/* Card 3: Pending Draft */}
        <div className="bg-white p-5 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold uppercase tracking-wider">
            <span>Menunggu Bayar (DRAFT)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-serif font-black text-amber-800">
            {formatRp(stats.totalDraftTHP)}
          </div>
          <p className="text-[11px] text-amber-600 font-medium">
            {stats.draftCount} slip menunggu pelunasan
          </p>
        </div>

        {/* Card 4: Total Employees */}
        <div className="bg-white p-5 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider">
            <span>Karyawan Tergaji</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-serif font-black text-[#3E2723]">
            {stats.totalEmployeesCount} Orang
          </div>
          <p className="text-[11px] text-stone-500 font-medium">
            Total staf aktif menerima gaji periode ini
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan, jabatan, periode..."
              className="w-full pl-10 pr-4 py-2 bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl text-xs sm:text-sm text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === 'ALL' ? 'bg-[#3E2723] text-amber-200 shadow-xs' : 'text-stone-600 hover:text-black'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PAID')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === 'PAID' ? 'bg-emerald-700 text-white shadow-xs' : 'text-stone-600 hover:text-black'
                }`}
              >
                Lunas (PAID)
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DRAFT')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === 'DRAFT' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:text-black'
                }`}
              >
                Draft
              </button>
            </div>

            {/* Outlet Filter */}
            <select
              value={selectedOutletFilter}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-semibold text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            >
              <option value="ALL">Semua Cabang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            {/* Period Filter */}
            {availablePeriods.length > 0 && (
              <select
                value={selectedPeriodFilter}
                onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                className="bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-semibold text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="ALL">Semua Periode</option>
                {availablePeriods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Payroll List / Table */}
      <div className="bg-white rounded-3xl border border-[#EBE3D5] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#EBE3D5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-800" />
            <h3 className="font-serif font-bold text-base text-[#3E2723]">
              Daftar Slip Gaji ({filteredRecords.length})
            </h3>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-14 px-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center mx-auto border border-amber-200">
              <FileText className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="font-serif font-bold text-base text-[#3E2723]">
                Belum Ada Slip Gaji
              </h4>
              <p className="text-xs text-stone-500">
                Buat slip gaji untuk karyawan Anda sekarang untuk mencetak struk thermal dan otomatis mencatat ke buku kas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setIsFormOpen(true);
              }}
              className="px-5 py-2 bg-[#3E2723] text-amber-200 hover:bg-[#2B1713] rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" /> Buat Slip Gaji
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] text-stone-500 font-bold text-[11px] uppercase tracking-wider border-b border-[#EBE3D5]">
                  <th className="py-3.5 px-4">Karyawan & Posisi</th>
                  <th className="py-3.5 px-4">Cabang</th>
                  <th className="py-3.5 px-4">Periode</th>
                  <th className="py-3.5 px-4">Rincian Penghasilan</th>
                  <th className="py-3.5 px-4">Potongan</th>
                  <th className="py-3.5 px-4">Gaji Bersih (THP)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBE3D5] text-xs">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    {/* Employee & Role */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#3E2723] text-sm">
                        {record.employeeName}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                        <span className="bg-stone-100 px-1.5 py-0.5 rounded font-medium text-stone-700">
                          {record.employeeRole || 'Staff'}
                        </span>
                        {record.employeePhone && (
                          <span>• WA: {record.employeePhone}</span>
                        )}
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="py-3.5 px-4 text-stone-700">
                      <div className="font-medium">{record.outletName || 'Cabang Utama'}</div>
                      <div className="text-[10px] text-stone-400">ID: {record.id}</div>
                    </td>

                    {/* Period & Payment Date */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-amber-900">{record.period}</div>
                      <div className="text-[11px] text-stone-500">
                        Bayar: {formatDate(record.paymentDate)}
                      </div>
                    </td>

                    {/* Earnings */}
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="text-stone-700 font-medium">
                        Gaji Pokok: {formatRp(record.baseSalary)}
                      </div>
                      {record.allowances > 0 && (
                        <div className="text-[11px] text-emerald-700">
                          Tunjangan: +{formatRp(record.allowances)}
                        </div>
                      )}
                      {record.bonuses > 0 && (
                        <div className="text-[11px] text-emerald-700">
                          Bonus: +{formatRp(record.bonuses)}
                        </div>
                      )}
                    </td>

                    {/* Deductions */}
                    <td className="py-3.5 px-4">
                      {record.deductions > 0 ? (
                        <span className="font-semibold text-rose-700">
                          -{formatRp(record.deductions)}
                        </span>
                      ) : (
                        <span className="text-stone-400 font-medium">Rp 0</span>
                      )}
                    </td>

                    {/* Net Salary (THP) */}
                    <td className="py-3.5 px-4">
                      <div className="font-serif font-black text-sm text-[#3E2723]">
                        {formatRp(record.netSalary)}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {record.paymentMethod || 'TRANSFER'}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {record.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> LUNAS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" /> DRAFT
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Quick Pay if DRAFT */}
                        {record.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => setPayingRecord(record)}
                            title="Bayar & Catat ke Kas"
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Bayar</span>
                          </button>
                        )}

                        {/* View / Print Slip Modal */}
                        <button
                          type="button"
                          onClick={() => setSelectedSlipForPrint(record)}
                          title="Cetak Struk / Slip Gaji"
                          className="p-1.5 bg-[#FAF8F5] border border-[#D7CCC8] text-[#3E2723] hover:bg-[#F4EDE4] rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-stone-700" />
                        </button>

                        {/* Edit Record */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecord(record);
                            setIsFormOpen(true);
                          }}
                          title="Edit Slip Gaji"
                          className="p-1.5 bg-[#FAF8F5] border border-[#D7CCC8] text-[#3E2723] hover:bg-[#F4EDE4] rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4 text-stone-700" />
                        </button>

                        {/* Delete Record */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          title="Hapus Slip Gaji"
                          className="p-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slip Modal (Print & Share) */}
      <AnimatePresence>
        {selectedSlipForPrint && (
          <PayrollSlipModal
            record={selectedSlipForPrint}
            settings={settings}
            onClose={() => setSelectedSlipForPrint(null)}
            onMarkAsPaid={(recId) => {
              const rec = payrollRecords.find((r) => r.id === recId);
              if (rec) {
                handleConfirmQuickPay(rec);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Form Modal (Create / Edit) */}
      <AnimatePresence>
        {isFormOpen && (
          <PayrollFormModal
            initialData={editingRecord}
            users={users}
            outlets={outlets}
            currentOutletId={selectedOutletFilter !== 'ALL' ? selectedOutletFilter : currentOutletId}
            currentUserId={currentUser?.id}
            onSave={handleSaveRecord}
            onClose={() => {
              setIsFormOpen(false);
              setEditingRecord(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Quick Pay Confirmation Modal */}
      <AnimatePresence>
        {payingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 border border-[#EBE3D5] shadow-2xl w-full max-w-md space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#3E2723]">
                    Konfirmasi Pembayaran Gaji
                  </h3>
                  <p className="text-xs text-stone-500">
                    Gaji akan diubah ke status PAID & dicatat ke Buku Kas
                  </p>
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#EBE3D5] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Karyawan:</span>
                  <span className="font-bold text-[#3E2723]">{payingRecord.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Periode:</span>
                  <span className="font-semibold text-amber-900">{payingRecord.period}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Cabang Outlet:</span>
                  <span className="font-semibold text-stone-700">{payingRecord.outletName}</span>
                </div>
                <div className="border-t border-[#EBE3D5] pt-2 flex justify-between font-bold text-sm text-emerald-900">
                  <span>Take Home Pay:</span>
                  <span>{formatRp(payingRecord.netSalary)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3E2723] mb-1">
                  Pilih Metode Pembayaran
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="TRANSFER">Transfer Bank / Payroll</option>
                  <option value="CASH">Tunai (Kas Toko)</option>
                  <option value="QRIS">QRIS / E-Wallet</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingRecord(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmQuickPay(payingRecord)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bayar Sekarang</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
