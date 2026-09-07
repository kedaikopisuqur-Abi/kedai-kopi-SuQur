import React, { useState, useEffect, useId } from 'react';
import { motion } from 'motion/react';
import {
  X,
  User,
  Building2,
  Calendar,
  DollarSign,
  PlusCircle,
  MinusCircle,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Phone,
  Briefcase,
  CreditCard,
  FileText,
  Calculator,
} from 'lucide-react';
import { PayrollRecord, User as UserType, Outlet } from '../../types';
import { formatRp, numberToWordsIndonesian } from '../../utils/formatters';

interface PayrollFormModalProps {
  initialData?: PayrollRecord | null;
  users: UserType[];
  outlets: Outlet[];
  currentUserId?: string;
  currentOutletId?: string;
  onSave: (record: PayrollRecord, autoRecordCashLedger: boolean) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const PayrollFormModal: React.FC<PayrollFormModalProps> = ({
  initialData,
  users,
  outlets,
  currentUserId,
  currentOutletId,
  onSave,
  onClose,
}) => {
  const isEditing = !!initialData;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const defaultPeriod = `${currentMonthName} ${currentYear}`;
  const defaultToday = now.toISOString().split('T')[0];

  // Employee selection
  const [employeeId, setEmployeeId] = useState<string>(initialData?.employeeId || (users[0]?.id || ''));
  const [employeeName, setEmployeeName] = useState<string>(initialData?.employeeName || (users[0]?.name || ''));
  const [employeeRole, setEmployeeRole] = useState<string>(initialData?.employeeRole || (users[0]?.role || ''));
  const [employeePhone, setEmployeePhone] = useState<string>(initialData?.employeePhone || '');
  const [outletId, setOutletId] = useState<string>(
    initialData?.outletId || currentOutletId || outlets[0]?.id || 'outlet-kelapa-gading'
  );
  const [outletName, setOutletName] = useState<string>(
    initialData?.outletName || outlets[0]?.name || 'Outlet Kelapa Gading'
  );

  // Period & Dates
  const [period, setPeriod] = useState<string>(initialData?.period || defaultPeriod);
  const [paymentDate, setPaymentDate] = useState<string>(initialData?.paymentDate || defaultToday);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS' | 'OTHER'>(
    initialData?.paymentMethod || 'TRANSFER'
  );

  // Salary components
  const [baseSalary, setBaseSalary] = useState<number>(initialData?.baseSalary ?? 3500000);
  const [allowances, setAllowances] = useState<number>(initialData?.allowances ?? 500000);
  const [bonuses, setBonuses] = useState<number>(initialData?.bonuses ?? 0);
  const [deductions, setDeductions] = useState<number>(initialData?.deductions ?? 0);

  // Status & Notes
  const [status, setStatus] = useState<'DRAFT' | 'PAID'>(initialData?.status || 'DRAFT');
  const [notes, setNotes] = useState<string>(initialData?.notes || '');
  const [autoRecordCashLedger, setAutoRecordCashLedger] = useState<boolean>(true);

  // Unique IDs for form controls to satisfy accessibility
  const employeeSelectId = useId();
  const employeeNameId = useId();
  const employeeRoleId = useId();
  const employeePhoneId = useId();
  const outletSelectId = useId();
  const periodInputId = useId();
  const paymentDateId = useId();
  const paymentMethodId = useId();
  const baseSalaryId = useId();
  const allowancesId = useId();
  const bonusesId = useId();
  const deductionsId = useId();
  const statusSelectId = useId();
  const notesId = useId();

  // Handle employee change
  const handleEmployeeChange = (selectedId: string) => {
    setEmployeeId(selectedId);
    if (selectedId === 'CUSTOM') {
      setEmployeeName('');
      setEmployeeRole('Staff');
      setEmployeePhone('');
      return;
    }

    const selectedUser = users.find((u) => u.id === selectedId);
    if (selectedUser) {
      setEmployeeName(selectedUser.name);
      setEmployeeRole(selectedUser.role.toUpperCase());
      if (selectedUser.outletId) {
        setOutletId(selectedUser.outletId);
        const o = outlets.find((ot) => ot.id === selectedUser.outletId);
        if (o) setOutletName(o.name);
      }
    }
  };

  // Handle outlet change
  const handleOutletChange = (newOutletId: string) => {
    setOutletId(newOutletId);
    const o = outlets.find((ot) => ot.id === newOutletId);
    if (o) setOutletName(o.name);
  };

  // Calculated Net Salary
  const netSalary = Math.max(0, (baseSalary || 0) + (allowances || 0) + (bonuses || 0) - (deductions || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName.trim()) {
      alert('Mohon masukkan nama karyawan.');
      return;
    }

    if (!period.trim()) {
      alert('Mohon masukkan periode penggajian.');
      return;
    }

    const newRecord: PayrollRecord = {
      id: initialData?.id || `PAY-${Date.now().toString().slice(-6)}`,
      employeeId: employeeId || 'emp-custom',
      employeeName: employeeName.trim(),
      employeeRole: employeeRole.trim(),
      employeePhone: employeePhone.trim(),
      outletId,
      outletName,
      period: period.trim(),
      baseSalary: Number(baseSalary) || 0,
      allowances: Number(allowances) || 0,
      bonuses: Number(bonuses) || 0,
      deductions: Number(deductions) || 0,
      netSalary: Math.max(0, Number(netSalary) || 0),
      paymentDate: paymentDate || defaultToday,
      status,
      notes: notes.trim(),
      paidBy: status === 'PAID' ? (initialData?.paidBy || 'Admin Keuangan') : undefined,
      paidAt: status === 'PAID' ? (initialData?.paidAt || new Date().toISOString()) : undefined,
      paymentMethod,
      cashRecordId: initialData?.cashRecordId,
    };

    onSave(newRecord, autoRecordCashLedger);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#FDFBF7] rounded-3xl shadow-2xl border border-[#EBE3D5] w-full max-w-2xl overflow-hidden my-6"
      >
        {/* Header */}
        <div className="bg-[#3E2723] text-[#FDFBF7] p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#FDFBF7]">
                {isEditing ? 'Edit Slip Gaji Karyawan' : 'Buat Slip Gaji Baru'}
              </h3>
              <p className="text-xs text-[#D7CCC8]">
                Hitung gaji pokok, tunjangan, bonus, dan potongan kasbon otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#D7CCC8] hover:text-white hover:bg-[#5D4037] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* Section 1: Employee & Branch */}
          <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] space-y-4 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8D6E63] flex items-center gap-2">
              <User className="w-4 h-4 text-amber-700" />
              Informasi Karyawan & Outlet
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Employee Selection */}
              <div>
                <label htmlFor={employeeSelectId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Pilih Karyawan
                </label>
                <select
                  id={employeeSelectId}
                  value={employeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.toUpperCase()})
                    </option>
                  ))}
                  <option value="CUSTOM">+ Karyawan Lain / Input Manual</option>
                </select>
              </div>

              {/* Custom Employee Name */}
              <div>
                <label htmlFor={employeeNameId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Nama Lengkap Karyawan
                </label>
                <input
                  id={employeeNameId}
                  type="text"
                  required
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Budi Santoso"
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Employee Role */}
              <div>
                <label htmlFor={employeeRoleId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Jabatan / Posisi
                </label>
                <input
                  id={employeeRoleId}
                  type="text"
                  value={employeeRole}
                  onChange={(e) => setEmployeeRole(e.target.value)}
                  placeholder="e.g. Barista Senior, Kasir, Cook"
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Employee Phone (WhatsApp) */}
              <div>
                <label htmlFor={employeePhoneId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  No. WhatsApp (Kirim Slip)
                </label>
                <input
                  id={employeePhoneId}
                  type="tel"
                  value={employeePhone}
                  onChange={(e) => setEmployeePhone(e.target.value)}
                  placeholder="e.g. 081234567890"
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Outlet Assignment */}
              <div className="sm:col-span-2">
                <label htmlFor={outletSelectId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Outlet / Cabang Penempatan
                </label>
                <select
                  id={outletSelectId}
                  value={outletId}
                  onChange={(e) => handleOutletChange(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.type === 'CENTRAL' || o.isMaster || o.isMain ? '(Pusat)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Period & Date */}
          <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] space-y-4 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8D6E63] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700" />
              Periode & Jadwal Pembayaran
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Period Name */}
              <div>
                <label htmlFor={periodInputId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Periode Bulan
                </label>
                <input
                  id={periodInputId}
                  type="text"
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="e.g. Agustus 2026"
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Payment Date */}
              <div>
                <label htmlFor={paymentDateId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Tgl Pembayaran
                </label>
                <input
                  id={paymentDateId}
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label htmlFor={paymentMethodId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Metode Bayar
                </label>
                <select
                  id={paymentMethodId}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="TRANSFER">Transfer Bank / Payroll</option>
                  <option value="CASH">Tunai (Cash)</option>
                  <option value="QRIS">QRIS / E-Wallet</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Salary Breakdown */}
          <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] space-y-4 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8D6E63] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-700" />
              Komponen Gaji & Potongan
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Gaji Pokok */}
              <div>
                <label htmlFor={baseSalaryId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  1. Gaji Pokok (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-stone-400">Rp</span>
                  <input
                    id={baseSalaryId}
                    type="number"
                    min="0"
                    step="10000"
                    required
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">Gaji dasar bulanan karyawan</p>
              </div>

              {/* Tunjangan */}
              <div>
                <label htmlFor={allowancesId} className="block text-xs font-bold text-emerald-800 mb-1">
                  2. Tunjangan Tetap / Makan (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-emerald-500">+Rp</span>
                  <input
                    id={allowancesId}
                    type="number"
                    min="0"
                    step="10000"
                    value={allowances}
                    onChange={(e) => setAllowances(Number(e.target.value))}
                    className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-emerald-700 mt-1">Tunjangan transportasi, makan, jabatan</p>
              </div>

              {/* Bonus / Insentif */}
              <div>
                <label htmlFor={bonusesId} className="block text-xs font-bold text-emerald-800 mb-1">
                  3. Bonus, Lembur & Insentif (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-emerald-500">+Rp</span>
                  <input
                    id={bonusesId}
                    type="number"
                    min="0"
                    step="10000"
                    value={bonuses}
                    onChange={(e) => setBonuses(Number(e.target.value))}
                    className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-emerald-700 mt-1">Uang lembur atau bonus target outlet</p>
              </div>

              {/* Potongan / Kasbon */}
              <div>
                <label htmlFor={deductionsId} className="block text-xs font-bold text-rose-800 mb-1">
                  4. Potongan / Kasbon Karyawan (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-rose-500">-Rp</span>
                  <input
                    id={deductionsId}
                    type="number"
                    min="0"
                    step="10000"
                    value={deductions}
                    onChange={(e) => setDeductions(Number(e.target.value))}
                    className="w-full bg-rose-50/50 border border-rose-300 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-rose-950 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-rose-700 mt-1">Cicilan pinjaman kasbon atau denda keterlambatan</p>
              </div>
            </div>

            {/* Live Take Home Pay Calculation Banner */}
            <div className="bg-[#3E2723] text-[#FAF3DD] p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#D7CCC8] block">
                  TOTAL GAJI BERSIH (TAKE HOME PAY)
                </span>
                <p className="text-xs text-amber-200 mt-0.5 font-sans">
                  Formula: {formatRp(baseSalary)} + {formatRp(allowances)} + {formatRp(bonuses)} - {formatRp(deductions)}
                </p>
              </div>
              <div className="text-2xl font-serif font-black text-amber-300">
                {formatRp(netSalary)}
              </div>
            </div>
          </div>

          {/* Section 4: Status & Ledger Integration */}
          <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] space-y-3.5 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor={statusSelectId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Status Penggajian
                </label>
                <select
                  id={statusSelectId}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PAID')}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:outline-hidden ${
                    status === 'PAID'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 focus:ring-emerald-500'
                      : 'bg-amber-50 text-amber-900 border-amber-300 focus:ring-amber-500'
                  }`}
                >
                  <option value="DRAFT">⏳ DRAFT (Belum Dibayarkan)</option>
                  <option value="PAID">✅ PAID (Sudah Dibayarkan / Lunas)</option>
                </select>
              </div>

              <div>
                <label htmlFor={notesId} className="block text-xs font-bold text-[#3E2723] mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  id={notesId}
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Dibayar via transfer BCA a/n Budi"
                  className="w-full bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-3 py-2 text-xs font-medium text-[#2C1810] focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Auto Cash Ledger Integration checkbox */}
            {status === 'PAID' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="autoCashLedger"
                  checked={autoRecordCashLedger}
                  onChange={(e) => setAutoRecordCashLedger(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500"
                />
                <label htmlFor="autoCashLedger" className="text-xs text-emerald-900 font-medium cursor-pointer">
                  <span className="font-bold block text-emerald-950">
                    Otomatis Catat Kas Keluar ke Buku Kas ({outletName})
                  </span>
                  Sistem akan menambahkan transaksi Kas Keluar kategori{' '}
                  <span className="font-semibold underline">
                    Pengeluaran Operasional - Gaji Karyawan
                  </span>{' '}
                  senilai <span className="font-bold">{formatRp(netSalary)}</span>.
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-[#D7CCC8] text-[#3E2723] hover:bg-[#F4EDE4] text-xs font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#2B1713] text-amber-200 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>{isEditing ? 'Simpan Perubahan' : 'Terbitkan Slip Gaji'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
