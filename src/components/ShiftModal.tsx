import React, { useState } from 'react';
import { Shift, User, StoreSettings } from '../types';
import { formatRp, formatDateTime, formatWaktuLokal } from '../utils/formatters';
import { Printer, CheckCircle2, X, Lock, Unlock, AlertCircle, AlertTriangle, FileText, ArrowLeft } from 'lucide-react';
import { ThermalShiftModal } from './ThermalShiftModal';
import { StorageService } from '../services/storage';

interface ShiftModalProps {
  user: User;
  activeShift: Shift | null;
  settings: StoreSettings;
  onStartShift: (startCash: number) => void;
  onEndShift: (actualEndCash: number) => Shift | null;
  onClose: () => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  user,
  activeShift,
  settings,
  onStartShift,
  onEndShift,
  onClose,
}) => {
  const [startCashInput, setStartCashInput] = useState<number>(200000);
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closedShiftResult, setClosedShiftResult] = useState<Shift | null>(null);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [showDiscrepancyWarning, setShowDiscrepancyWarning] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState('');

  // Calculate live shift sales for validation
  const txs = activeShift
    ? StorageService.getTransactions().filter(
        (t) =>
          t.cashierId === activeShift.cashierId &&
          new Date(t.timestamp) >= new Date(activeShift.startTime)
      )
    : [];

  let liveCashSales = 0;
  let liveNonCashSales = 0;
  txs.forEach((t) => {
    if (t.paymentMethod === 'cash') {
      liveCashSales += t.total;
    } else {
      liveNonCashSales += t.total;
    }
  });

  const expectedEndCash = activeShift ? activeShift.startCash + liveCashSales : 0;
  const liveDiff = actualCashInput - expectedEndCash;
  const isDiffExceeded = Math.abs(liveDiff) > 10000;

  const handleStart = () => {
    onStartShift(startCashInput);
    onClose();
  };

  const handleEnd = () => {
    // Guard Tutup Shift: check if difference exceeds Rp 10.000
    if (isDiffExceeded && !showDiscrepancyWarning) {
      setShowDiscrepancyWarning(true);
      return;
    }

    const closed = onEndShift(actualCashInput);
    if (closed) {
      setClosedShiftResult(closed);
      setShowDiscrepancyWarning(false);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscrepancyAndEnd = () => {
    const closed = onEndShift(actualCashInput);
    if (closed) {
      setClosedShiftResult(closed);
      setShowDiscrepancyWarning(false);
    } else {
      onClose();
    }
  };

  // If thermal modal is triggered
  if (isThermalModalOpen && (closedShiftResult || activeShift)) {
    const targetShift = closedShiftResult || activeShift!;
    return (
      <ThermalShiftModal
        shift={targetShift}
        settings={settings}
        onClose={() => setIsThermalModalOpen(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E6D5C3] space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
          <h3 className="font-bold text-base text-[#2B1713] flex items-center gap-2">
            {closedShiftResult ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : activeShift ? (
              <Lock className="w-5 h-5 text-amber-700" />
            ) : (
              <Unlock className="w-5 h-5 text-emerald-700" />
            )}
            {closedShiftResult
              ? 'Rekapitulasi Shift Selesai'
              : activeShift
              ? 'Tutup Kasir (End Shift)'
              : 'Buka Kasir (Start Shift)'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {closedShiftResult ? (
          /* REKAPAN SHIFT SETELAH CLOSED (WITH PRINT THERMAL OPTION) */
          <div className="space-y-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-xs">Shift Kasir Berhasil Ditutup!</p>
                <p className="text-[11px] text-emerald-700">
                  Rekapitulasi transaksi telah tersimpan di sistem & database Firestore.
                </p>
              </div>
            </div>

            {/* Rincian Ringkasan Shift */}
            <div className="bg-[#FAF3DD]/50 p-4 rounded-xl border border-[#E6D5C3] space-y-2">
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Kasir Bertugas:</span>
                <span className="font-bold text-[#2B1713]">{closedShiftResult.cashierName}</span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Waktu Buka:</span>
                <span className="font-semibold">{formatDateTime(closedShiftResult.startTime)} ({formatWaktuLokal(closedShiftResult.startTime)})</span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Waktu Tutup:</span>
                <span className="font-semibold">
                  {closedShiftResult.endTime ? `${formatDateTime(closedShiftResult.endTime)} (${formatWaktuLokal(closedShiftResult.endTime)})` : '-'}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Modal Awal Kas:</span>
                <span className="font-bold">{formatRp(closedShiftResult.startCash)}</span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Penjualan Tunai:</span>
                <span className="font-bold text-emerald-800">{formatRp(closedShiftResult.totalSalesCash)}</span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Penjualan Non-Tunai:</span>
                <span className="font-bold text-blue-800">{formatRp(closedShiftResult.totalSalesNonCash)}</span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 font-black text-sm text-[#2B1713]">
                <span>Total Omzet Shift:</span>
                <span className="text-amber-900">
                  {formatRp(closedShiftResult.totalSalesCash + closedShiftResult.totalSalesNonCash)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Ekspektasi Uang Laci:</span>
                <span className="font-bold">{formatRp(closedShiftResult.expectedEndCash)}</span>
              </div>
              <div className="flex justify-between border-b border-[#E6D5C3]/60 pb-1.5 text-gray-700">
                <span>Fisik Uang di Laci:</span>
                <span className="font-black text-[#2B1713]">{formatRp(closedShiftResult.actualEndCash)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 font-bold">
                <span>Selisih Uang Laci:</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-black ${
                    (closedShiftResult.difference || 0) === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : (closedShiftResult.difference || 0) > 0
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {(closedShiftResult.difference || 0) === 0
                    ? 'PAS (Rp 0)'
                    : (closedShiftResult.difference || 0) > 0
                    ? `SURPLUS (+${formatRp(closedShiftResult.difference)})`
                    : `MINUS (${formatRp(closedShiftResult.difference)})`}
                </span>
              </div>
            </div>

            {/* Print & Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => setIsThermalModalOpen(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4A373] to-[#c39262] text-[#1F1412] font-black text-xs shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2 border border-[#b58454]"
              >
                <Printer className="w-4 h-4 text-[#1F1412]" /> Cetak Struk Rekap (Printer Thermal)
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-[#D4A373]" /> Selesai & Tutup Modal
              </button>
            </div>
          </div>
        ) : !activeShift ? (
          /* BUKA KASIR FORM */
          <div className="space-y-4 text-xs">
            <div className="bg-[#FDFBF7] p-3 rounded-xl border border-[#E6D5C3]">
              <div className="text-gray-500">Kasir Bertugas:</div>
              <div className="font-bold text-sm text-[#2B1713] mt-0.5">{user.name}</div>
            </div>

            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">Kas Awal Modal Laci (Float Cash)</label>
              <input
                type="number"
                value={startCashInput}
                onChange={(e) => setStartCashInput(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-black text-lg text-[#2B1713] focus:outline-none focus:border-[#D4A373]"
              />
              <p className="text-[10px] text-gray-500 mt-1">Modal kembalian awal di laci kasir</p>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold text-xs shadow-md hover:from-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Buka Sesi Kasir Sekarang
            </button>
          </div>
        ) : showDiscrepancyWarning ? (
          /* PERINGATAN REKONSILIASI KAS (GUARD TUTUP SHIFT > Rp 10.000) */
          <div className="space-y-4 text-xs">
            <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-3.5 text-rose-900 space-y-2">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
                <span>Peringatan Selisih Kasir ({formatRp(Math.abs(liveDiff))})</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                Sistem mendeteksi selisih antara uang kas fisik di laci dengan pencatatan sistem sebesar{' '}
                <span className="font-bold underline">{formatRp(Math.abs(liveDiff))}</span> (melebihi batas toleransi Rp 10.000).
              </p>
            </div>

            {/* Rekonsiliasi Rincian */}
            <div className="bg-[#FDFBF7] p-3.5 rounded-xl border border-[#E6D5C3] space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Modal Kas Awal:</span>
                <span className="font-semibold">{formatRp(activeShift?.startCash || 0)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Penjualan Tunai Shift Ini:</span>
                <span className="font-semibold text-emerald-800">+{formatRp(liveCashSales)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E6D5C3] pt-1.5 font-bold text-gray-800">
                <span>Ekspektasi Uang Kas di Laci:</span>
                <span className="text-[#2B1713] font-black">{formatRp(expectedEndCash)}</span>
              </div>
              <div className="flex justify-between text-gray-800">
                <span>Fisik Kas yang Diinput:</span>
                <span className="font-black text-[#2B1713]">{formatRp(actualCashInput)}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-[#E6D5C3] pt-1.5 font-black text-sm">
                <span>Status Selisih:</span>
                <span className={liveDiff < 0 ? 'text-rose-600' : 'text-amber-600'}>
                  {liveDiff < 0 ? `Minus / Kurang ${formatRp(Math.abs(liveDiff))}` : `Surplus / Lebih ${formatRp(liveDiff)}`}
                </span>
              </div>
            </div>

            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">
                Catatan / Alasan Selisih Kas (Opsional)
              </label>
              <input
                type="text"
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                placeholder="Contoh: Pecahan uang koin kembalian, titipan bahan galon, dll."
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs text-[#2B1713] focus:outline-none focus:border-[#D4A373]"
              />
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscrepancyWarning(false)}
                className="w-full py-2.5 rounded-xl bg-[#F5EBE0] hover:bg-[#E6D5C3] text-[#3E2723] font-bold text-xs border border-[#E6D5C3] transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Hitung Ulang Fisik Kas di Laci
              </button>

              <button
                type="button"
                onClick={handleConfirmDiscrepancyAndEnd}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-700 to-rose-800 hover:from-rose-800 hover:to-rose-900 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Tetap Lanjutkan & Tutup Shift
              </button>
            </div>
          </div>
        ) : (
          /* TUTUP KASIR FORM */
          <div className="space-y-4 text-xs">
            <div className="bg-[#F5EBE0] p-3 rounded-xl border border-[#E6D5C3] space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Waktu Buka:</span>
                <span className="font-medium">{formatDateTime(activeShift.startTime)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Modal Kas Awal:</span>
                <span className="font-bold">{formatRp(activeShift.startCash)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Penjualan Tunai Berjalan:</span>
                <span className="font-bold text-emerald-800">{formatRp(liveCashSales)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E6D5C3] pt-1 text-gray-700 font-bold">
                <span>Ekspektasi Uang Kas di Laci:</span>
                <span className="font-black text-[#2B1713]">{formatRp(expectedEndCash)}</span>
              </div>
            </div>

            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">Total Kas Tunai Fisik di Laci (Rp)</label>
              <input
                type="number"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-black text-lg text-[#2B1713] focus:outline-none focus:border-[#D4A373]"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Hitung fisik uang tunai di laci sebelum menutup kasir & cetak bukti rekap.
              </p>
            </div>

            {/* Dynamic preview of discrepancy */}
            {actualCashInput > 0 && (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                Math.abs(liveDiff) > 10000
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : liveDiff === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}>
                <span>Perkiraan Selisih:</span>
                <span className="font-black">
                  {liveDiff === 0 ? 'Sesuai (Rp 0)' : `${liveDiff > 0 ? '+' : ''}${formatRp(liveDiff)}`}
                </span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                onClick={handleEnd}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#3E2723] to-[#2B1713] text-[#FAF3DD] font-bold text-xs shadow-md hover:from-[#4E342E] transition-all flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-[#D4A373]" /> Rekap & Tutup Kasir
              </button>

              <button
                onClick={() => setIsThermalModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-[#F5EBE0] hover:bg-[#E6D5C3] text-[#3E2723] font-bold text-xs border border-[#E6D5C3] transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-[#8D6E63]" /> Preview Struk Thermal Active Shift
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
