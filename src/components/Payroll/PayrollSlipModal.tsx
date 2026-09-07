import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Printer,
  FileText,
  Download,
  Share2,
  CheckCircle2,
  Copy,
  Building2,
  User,
  Calendar,
  CreditCard,
  Send,
  Sparkles,
} from 'lucide-react';
import { PayrollRecord, StoreSettings } from '../../types';
import {
  formatRp,
  formatDate,
  formatDateTime,
  numberToWordsIndonesian,
  formatPayrollSlipThermal,
  formatPayrollSlipWhatsAppMessage,
  exportElementToPng,
} from '../../utils/formatters';
import { printReceiptThermal } from '../../services/thermalPrinterService';

interface PayrollSlipModalProps {
  record: PayrollRecord;
  settings: StoreSettings;
  onClose: () => void;
  onMarkAsPaid?: (recordId: string) => void;
}

export const PayrollSlipModal: React.FC<PayrollSlipModalProps> = ({
  record,
  settings,
  onClose,
  onMarkAsPaid,
}) => {
  const [viewMode, setViewMode] = useState<'formal' | 'thermal'>('formal');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  const slipRef = useRef<HTMLDivElement>(null);
  const thermalSlipRef = useRef<HTMLDivElement>(null);

  const totalEarnings = record.baseSalary + (record.allowances || 0) + (record.bonuses || 0);

  // Print via ESC/POS hardware thermal printer or fallback
  const handleThermalPrint = async () => {
    setIsPrinting(true);
    setPrintStatus('Mengirim data slip ke printer thermal...');
    const thermalText = formatPayrollSlipThermal(record, settings);
    try {
      const res = await printReceiptThermal(thermalText, settings);
      if (res.success) {
        setPrintStatus(`✓ Berhasil dicetak via ${res.method.toUpperCase()}!`);
      } else {
        setPrintStatus(`Gagal cetak: ${res.error || 'Periksa koneksi printer'}`);
      }
    } catch (err: any) {
      setPrintStatus(`Error: ${err.message}`);
    } finally {
      setIsPrinting(false);
      setTimeout(() => setPrintStatus(null), 4000);
    }
  };

  // Browser standard print
  const handleStandardPrint = () => {
    window.print();
  };

  // Download image PNG
  const handleDownloadPng = async () => {
    const target = viewMode === 'formal' ? slipRef.current : thermalSlipRef.current;
    if (!target) return;
    setIsExportingPng(true);
    try {
      await exportElementToPng(target, `slip_gaji_${record.employeeName.replace(/\s+/g, '_')}_${record.period}.png`);
    } catch (err) {
      console.error('Failed to export PNG', err);
      alert('Gagal mendownload gambar slip gaji.');
    } finally {
      setIsExportingPng(false);
    }
  };

  // Share to WhatsApp
  const handleShareWhatsApp = () => {
    const message = formatPayrollSlipWhatsAppMessage(record, settings);
    const phone = record.employeePhone ? record.employeePhone.replace(/[^0-9]/g, '') : '';
    let waPhone = phone;
    if (waPhone.startsWith('0')) {
      waPhone = '62' + waPhone.slice(1);
    }
    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Copy text
  const handleCopyText = () => {
    const message = formatPayrollSlipWhatsAppMessage(record, settings);
    navigator.clipboard.writeText(message).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#FDFBF7] rounded-3xl shadow-2xl border border-[#EBE3D5] w-full max-w-2xl overflow-hidden my-8"
      >
        {/* Modal Header */}
        <div className="bg-[#3E2723] text-[#FDFBF7] p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#FDFBF7] flex items-center gap-2">
                Slip Gaji Karyawan
                {record.status === 'PAID' ? (
                  <span className="text-[10px] uppercase font-sans tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    Lunas
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-sans tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    Draft
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#D7CCC8]">
                {record.employeeName} • Periode {record.period}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-[#2B1713] p-1 rounded-xl flex items-center gap-1 border border-[#5D4037]">
              <button
                type="button"
                onClick={() => setViewMode('formal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'formal'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-[#D7CCC8] hover:text-white'
                }`}
              >
                Formal A4
              </button>
              <button
                type="button"
                onClick={() => setViewMode('thermal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                  viewMode === 'thermal'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-[#D7CCC8] hover:text-white'
                }`}
              >
                <Printer className="w-3.5 h-3.5" /> Thermal POS
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#D7CCC8] hover:text-white hover:bg-[#5D4037] rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Status Notice */}
        {printStatus && (
          <div className="bg-amber-100 text-amber-900 px-4 py-2 text-xs font-medium border-b border-amber-200 text-center flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            {printStatus}
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 max-h-[68vh] overflow-y-auto bg-[#F4EDE4]/40">
          {viewMode === 'formal' ? (
            /* ================= FORMAL SLIP GAJI CARD ================= */
            <div
              ref={slipRef}
              id="formal-payroll-slip"
              className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EBE3D5] shadow-xs space-y-6 text-[#2C1810]"
            >
              {/* Header Slip */}
              <div className="flex items-start justify-between border-b-2 border-[#3E2723] pb-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {settings.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt="Logo"
                        className="w-10 h-10 object-contain rounded-lg border border-stone-200"
                      />
                    )}
                    <div>
                      <h4 className="font-serif font-black text-xl text-[#3E2723] tracking-tight">
                        {settings.storeName || 'SU-QUR POS'}
                      </h4>
                      <p className="text-[11px] text-stone-500 font-medium">
                        {record.outletName || 'Cabang Utama'} • {settings.address || settings.storeAddress || ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block bg-[#3E2723] text-[#FAF3DD] font-serif font-bold text-xs uppercase px-3 py-1 rounded-md tracking-wider">
                    SLIP GAJI RESMI
                  </span>
                  <div className="text-[11px] font-mono text-stone-500 mt-1">
                    No: {record.id}
                  </div>
                </div>
              </div>

              {/* Employee & Period Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAF8F5] p-3.5 rounded-xl border border-[#EBE3D5] text-xs">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Nama Karyawan</span>
                  <span className="font-bold text-[#3E2723]">{record.employeeName}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Jabatan / Peran</span>
                  <span className="font-semibold text-stone-700">{record.employeeRole || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Periode Penggajian</span>
                  <span className="font-bold text-amber-900">{record.period}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Tgl Pembayaran</span>
                  <span className="font-medium text-stone-700">{formatDate(record.paymentDate)}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Metode Bayar</span>
                  <span className="font-medium text-stone-700">{record.paymentMethod || 'TRANSFER'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Status Pembayaran</span>
                  <span
                    className={`font-bold inline-block px-1.5 py-0.2 rounded text-[10px] ${
                      record.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {record.status === 'PAID' ? '✓ SUDAH DIBAYAR' : '⏳ DRAFT'}
                  </span>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Penerimaan / Earnings */}
                <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50/40 space-y-2">
                  <div className="font-bold text-xs text-emerald-900 border-b border-emerald-200 pb-1.5 flex items-center justify-between">
                    <span>A. PENGHASILAN (EARNINGS)</span>
                    <span>JUMLAH</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-700">
                      <span>1. Gaji Pokok</span>
                      <span className="font-semibold">{formatRp(record.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between text-stone-700">
                      <span>2. Tunjangan (Makan/Transport)</span>
                      <span className="font-semibold text-emerald-700">+{formatRp(record.allowances)}</span>
                    </div>
                    <div className="flex justify-between text-stone-700">
                      <span>3. Bonus & Insentif Lembur</span>
                      <span className="font-semibold text-emerald-700">+{formatRp(record.bonuses)}</span>
                    </div>
                    <div className="border-t border-emerald-200 pt-1.5 flex justify-between font-bold text-emerald-950">
                      <span>Total Penghasilan Bruto</span>
                      <span>{formatRp(totalEarnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Potongan / Deductions */}
                <div className="border border-rose-200 rounded-xl p-3.5 bg-rose-50/40 space-y-2">
                  <div className="font-bold text-xs text-rose-900 border-b border-rose-200 pb-1.5 flex items-center justify-between">
                    <span>B. POTONGAN (DEDUCTIONS)</span>
                    <span>JUMLAH</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-700">
                      <span>1. Kasbon / Pinjaman</span>
                      <span className="font-semibold text-rose-700">
                        {record.deductions > 0 ? `-${formatRp(record.deductions)}` : 'Rp 0'}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-700">
                      <span>2. Potongan Keterlambatan/Lainnya</span>
                      <span className="font-semibold text-stone-400">Rp 0</span>
                    </div>
                    <div className="border-t border-rose-200 pt-1.5 flex justify-between font-bold text-rose-950 mt-5">
                      <span>Total Potongan</span>
                      <span className="text-rose-700">{formatRp(record.deductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Take Home Pay Box */}
              <div className="bg-[#3E2723] text-[#FAF3DD] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#D7CCC8] block font-semibold">
                    TOTAL GAJI BERSIH (TAKE HOME PAY)
                  </span>
                  <div className="text-xs text-amber-200 italic mt-0.5">
                    Terbilang: {numberToWordsIndonesian(record.netSalary)}
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-serif font-black text-amber-300">
                  {formatRp(record.netSalary)}
                </div>
              </div>

              {/* Notes */}
              {record.notes && (
                <div className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                  <span className="font-bold text-stone-800">Catatan:</span> {record.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-4 border-t border-stone-200 grid grid-cols-2 text-center text-xs text-stone-600">
                <div className="space-y-12">
                  <p className="font-medium text-stone-500">Penerima (Karyawan),</p>
                  <p className="font-bold text-stone-800 underline underline-offset-4">
                    {record.employeeName}
                  </p>
                </div>
                <div className="space-y-12">
                  <p className="font-medium text-stone-500">
                    {record.outletName || settings.storeName}, {formatDate(record.paymentDate)}
                    <br />
                    <span className="text-[11px]">Bagian Keuangan / Pimpinan,</span>
                  </p>
                  <p className="font-bold text-stone-800 underline underline-offset-4">
                    {record.paidBy || 'Pimpinan Outlet'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ================= THERMAL RECEIPT STRUK PREVIEW ================= */
            <div className="flex justify-center">
              <div
                ref={thermalSlipRef}
                id="thermal-payroll-slip"
                className="bg-white text-black p-5 rounded-xl shadow-lg border border-stone-300 font-mono text-xs w-[320px] max-w-full space-y-3"
              >
                <div className="text-center space-y-0.5">
                  <div className="font-bold text-sm uppercase">{settings.storeName || 'SU-QUR POS'}</div>
                  <div className="text-[10px] text-stone-600">{record.outletName || 'Cabang Utama'}</div>
                  <div className="border-t border-b border-dashed border-stone-400 py-1 my-1 font-bold">
                    SLIP GAJI KARYAWAN
                    <div className="text-[10px] font-normal">{record.period.toUpperCase()}</div>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-stone-300 pb-2">
                  <div className="flex justify-between">
                    <span>No Slip:</span>
                    <span className="font-bold">{record.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Karyawan:</span>
                    <span className="font-bold">{record.employeeName}</span>
                  </div>
                  {record.employeeRole && (
                    <div className="flex justify-between">
                      <span>Jabatan:</span>
                      <span>{record.employeeRole}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Tgl Bayar:</span>
                    <span>{formatDate(record.paymentDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode:</span>
                    <span>{record.paymentMethod || 'TRANSFER'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-bold">{record.status === 'PAID' ? 'LUNAS' : 'DRAFT'}</span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-stone-300 pb-2">
                  <div className="text-center font-bold text-[10px] uppercase text-stone-500">Rincian Penghasilan</div>
                  <div className="flex justify-between">
                    <span>Gaji Pokok:</span>
                    <span>{formatRp(record.baseSalary)}</span>
                  </div>
                  {record.allowances > 0 && (
                    <div className="flex justify-between">
                      <span>Tunjangan:</span>
                      <span>+{formatRp(record.allowances)}</span>
                    </div>
                  )}
                  {record.bonuses > 0 && (
                    <div className="flex justify-between">
                      <span>Bonus/Lembur:</span>
                      <span>+{formatRp(record.bonuses)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-1 border-t border-stone-200">
                    <span>Subtotal:</span>
                    <span>{formatRp(totalEarnings)}</span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-stone-300 pb-2">
                  <div className="text-center font-bold text-[10px] uppercase text-stone-500">Potongan</div>
                  <div className="flex justify-between">
                    <span>Kasbon:</span>
                    <span>{record.deductions > 0 ? `-${formatRp(record.deductions)}` : 'Rp 0'}</span>
                  </div>
                </div>

                <div className="border-b-2 border-stone-800 pb-2 text-[12px] font-bold flex justify-between">
                  <span>TAKE HOME PAY:</span>
                  <span>{formatRp(record.netSalary)}</span>
                </div>

                {record.notes && (
                  <div className="text-[10px] text-stone-600 italic">
                    Note: {record.notes}
                  </div>
                )}

                <div className="text-center text-[10px] text-stone-500 pt-2 space-y-1">
                  <div>Terima kasih atas dedikasi Anda!</div>
                  <div className="text-[9px]">{formatDateTime(new Date().toISOString())}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-[#FAF8F5] p-4 sm:p-5 border-t border-[#EBE3D5] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Direct Hardware Thermal Print */}
            <button
              type="button"
              disabled={isPrinting}
              onClick={handleThermalPrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3E2723] text-amber-100 hover:bg-[#2B1713] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>{isPrinting ? 'Mencetak...' : 'Cetak Thermal (58/80mm)'}</span>
            </button>

            {/* Standard Browser Print / PDF */}
            <button
              type="button"
              onClick={handleStandardPrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#D7CCC8] text-[#3E2723] hover:bg-[#F4EDE4] text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-stone-600" />
              <span>Cetak / PDF</span>
            </button>

            {/* Download Image PNG */}
            <button
              type="button"
              disabled={isExportingPng}
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#D7CCC8] text-[#3E2723] hover:bg-[#F4EDE4] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>{isExportingPng ? 'Menyimpan...' : 'Gambar PNG'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy Text */}
            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs font-bold transition-colors cursor-pointer"
            >
              {copySuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copySuccess ? 'Tersalin!' : 'Salin Teks'}</span>
            </button>

            {/* Share to WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Kirim ke WhatsApp</span>
            </button>

            {/* Mark as paid button if DRAFT */}
            {record.status === 'DRAFT' && onMarkAsPaid && (
              <button
                type="button"
                onClick={() => {
                  onMarkAsPaid(record.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Bayar & Catat Kas</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
