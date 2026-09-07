import React, { useState, useEffect, useRef } from 'react';
import { Transaction, StoreSettings } from '../../types';
import { formatRp } from '../../utils/formatters';
import {
  QrCode,
  CheckCircle2,
  RefreshCw,
  X,
  ShieldCheck,
  Maximize2,
  AlertCircle,
  Radio,
  Sparkles,
  Volume2,
  Printer,
  Check
} from 'lucide-react';
import {
  startQRISPaymentWatcher,
  dispatchQRISPaymentSuccess,
  playQRISSuccessSound,
  QRISPaymentPayload
} from '../../utils/qrisListener';

interface QRISModalProps {
  tx: Transaction;
  settings: StoreSettings;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export const QRISModal: React.FC<QRISModalProps> = ({ tx, settings, onClose, onPaymentSuccess }) => {
  const [status, setStatus] = useState<'waiting' | 'verifying' | 'success'>('waiting');
  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [paidDetails, setPaidDetails] = useState<QRISPaymentPayload | null>(null);
  
  const hasTriggeredRef = useRef(false);
  const timerRef = useRef<any>(null);

  // Start background Polling / Webhook / Realtime listener when modal mounts
  useEffect(() => {
    const unsub = startQRISPaymentWatcher(tx, (payload) => {
      handlePaymentCompleted(payload);
    }, { pollIntervalMs: 2000 });

    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tx.id]);

  const handlePaymentCompleted = (payload?: QRISPaymentPayload) => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    setStatus('success');
    setPaidDetails(payload || {
      txId: tx.id,
      invoiceNo: tx.invoiceNo || `INV-${tx.id}`,
      amount: tx.total,
      paymentMethod: 'qris',
      paidAt: new Date().toISOString(),
      issuer: 'QRIS Realtime Notifier'
    });

    // Play chime sound & Indonesian Voice TTS
    playQRISSuccessSound(tx.total, `Pembayaran QRIS berhasil sebesar ${tx.total.toLocaleString('id-ID')} rupiah.`);

    // Auto-countdown to close modal and trigger receipt printing
    let currentSec = 3;
    setCountdown(3);
    timerRef.current = setInterval(() => {
      currentSec -= 1;
      setCountdown(currentSec);
      if (currentSec <= 0) {
        clearInterval(timerRef.current);
        onPaymentSuccess();
      }
    }, 1000);
  };

  const handleSimulatePayment = () => {
    setStatus('verifying');
    setTimeout(() => {
      // Dispatch simulated webhook / scan event
      dispatchQRISPaymentSuccess({
        txId: tx.id,
        invoiceNo: tx.invoiceNo || `INV-${tx.id}`,
        amount: tx.total,
        paymentMethod: 'qris',
        paidAt: new Date().toISOString(),
        issuer: 'BCA QRIS Mobile',
        referenceNo: `REF-${Date.now().toString().slice(-6)}`
      });
    }, 1200);
  };

  const hasCustomQrisImage = Boolean(settings.qrisImageUrl && settings.qrisImageUrl.trim() !== '' && !imgError);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
        {/* Success Modal Overlay (Big Green Celebration Popup) */}
        {status === 'success' ? (
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-4 border-emerald-500 text-center space-y-5 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Ambient Green Background Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-100 rounded-full blur-3xl opacity-70 pointer-events-none" />

            {/* Success Check Icon */}
            <div className="relative mx-auto w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-bounce">
              <Check className="w-10 h-10 stroke-[3]" />
            </div>

            {/* Header Text */}
            <div className="space-y-1 relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>QRIS Lunas & Terverifikasi</span>
              </div>
              <h3 className="text-2xl font-black text-[#2B1713] tracking-tight">
                PEMBAYARAN QRIS BERHASIL
              </h3>
              <p className="text-xs text-gray-500">
                Faktur: <span className="font-mono font-bold text-gray-700">{tx.invoiceNo || tx.id}</span>
              </p>
            </div>

            {/* Amount Paid Box */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 space-y-1">
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Total Diterima
              </div>
              <div className="text-3xl font-black text-emerald-900 tracking-tight">
                {formatRp(tx.total)}
              </div>
              {paidDetails?.issuer && (
                <div className="text-[10px] text-emerald-600 font-medium">
                  Metode: {paidDetails.issuer} • Real-time Sync
                </div>
              )}
            </div>

            {/* Voice & Sound Alert Notice */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-600 bg-gray-50 py-2 px-3 rounded-xl border border-gray-200">
              <Volume2 className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>Notifikasi suara & TTS nominal telah diaktifkan</span>
            </div>

            {/* Countdown & Instant Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  onPaymentSuccess();
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk Sekarang ({countdown}s)</span>
              </button>
              <div className="text-[11px] text-gray-400">
                Otomatis menutup dan mencetak struk kasir dalam {countdown} detik
              </div>
            </div>
          </div>
        ) : (
          /* Normal QR Code Waiting Screen */
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#E6D5C3] text-center space-y-4 relative overflow-hidden">
            {/* Top Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors z-10"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* QRIS Official Top Red Header Banner */}
            <div className="bg-[#D32F2F] text-white py-2 px-4 rounded-xl shadow-xs flex items-center justify-between font-black text-sm tracking-widest">
              <span>QRIS</span>
              <span className="text-[10px] font-normal opacity-90">PEMBAYARAN DITERIMA DI SINI</span>
            </div>

            {/* Merchant Info */}
            <div className="text-center">
              <div className="font-bold text-base text-[#2B1713] uppercase tracking-wide">
                {settings.qrisMerchantName || settings.storeName}
              </div>
              {settings.qrisNmid && (
                <div className="text-[11px] text-gray-500 font-mono mt-0.5">NMID: {settings.qrisNmid}</div>
              )}
            </div>

            {/* QR Code Container */}
            <div className="bg-[#FDFBF7] p-3 sm:p-4 rounded-2xl border-2 border-dashed border-[#D4A373] flex flex-col items-center justify-center relative">
              {hasCustomQrisImage ? (
                /* Custom Uploaded QRIS Image Display */
                <div className="w-full flex flex-col items-center">
                  <div className="relative group w-full max-w-[260px] bg-white p-2 rounded-xl border border-gray-200 shadow-md flex items-center justify-center overflow-hidden">
                    <img
                      src={settings.qrisImageUrl}
                      alt={`QRIS ${settings.qrisMerchantName}`}
                      onError={() => setImgError(true)}
                      className="w-full max-h-64 sm:max-h-72 object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsZoomed(true)}
                      className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-xs flex items-center gap-1 shadow-md transition-all"
                    >
                      <Maximize2 className="w-3 h-3 text-[#D4A373]" /> Perbesar
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsZoomed(true)}
                    className="mt-2 text-[11px] font-bold text-[#5D4037] hover:text-[#3E2723] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#D4A373]" /> Klik untuk Tampilan Penuh (Full Screen)
                  </button>
                </div>
              ) : (
                /* Default SVG QR Code Fallback */
                <div className="w-full flex flex-col items-center">
                  <div className="w-48 h-48 bg-white p-2 rounded-xl shadow-md border border-gray-200 flex flex-col items-center justify-center relative">
                    <svg className="w-full h-full text-black" viewBox="0 0 100 100">
                      <path
                        fill="currentColor"
                        d="M0,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z M70,0 h30 v30 h-30 z M80,10 h10 v10 h-10 z M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z M40,10 h10 v10 h-10 z M60,40 h20 v20 h-20 z M40,70 h20 v20 h-20 z M70,70 h20 v20 h-20 z"
                      />
                      <path fill="#3E2723" d="M35,35 h30 v30 h-30 z M40,40 h20 v20 h-20 z" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-9 h-9 bg-[#3E2723] rounded-lg border-2 border-white flex items-center justify-center text-[#D4A373] font-bold text-xs shadow-md">
                        ☕
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>
                      Belum ada foto QRIS? Upload barcode QRIS toko Anda di menu <b>Pengaturan Toko</b>.
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 text-[11px] font-bold text-[#3E2723] flex items-center justify-center gap-1 text-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, DANA</span>
              </div>
            </div>

            {/* Live Auto-Polling / Webhook Listener Status Indicator */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-[11px]">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span>Auto-Payment Notifier:</span>
              </div>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                Mendengarkan Transaksi
              </span>
            </div>

            {/* Amount to pay */}
            <div className="bg-[#F5EBE0] p-3 rounded-xl border border-[#E6D5C3]">
              <div className="text-[10px] text-[#8D6E63] uppercase font-bold tracking-wider">Total Pembayaran</div>
              <div className="text-2xl font-black text-[#2B1713]">{formatRp(tx.total)}</div>
            </div>

            {/* Status Indicator / Simulation trigger */}
            {status === 'waiting' && (
              <button
                onClick={handleSimulatePayment}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold text-xs shadow-md hover:from-emerald-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <QrCode className="w-4 h-4" /> Simulasi Pelanggan Scan & Bayar Instan
              </button>
            )}

            {status === 'verifying' && (
              <div className="py-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-semibold flex items-center justify-center gap-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600" /> Memverifikasi Notifikasi Pembayaran...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Zoom Modal for QRIS Image */}
      {isZoomed && settings.qrisImageUrl && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="relative max-w-xl w-full bg-white rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col items-center">
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors cursor-pointer"
              title="Tutup Zoom"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center mb-3">
              <div className="font-extrabold text-lg text-[#2B1713]">{settings.qrisMerchantName || settings.storeName}</div>
              <div className="text-xs text-gray-500 font-mono">Tampilan Penuh Barcode QRIS</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-inner flex items-center justify-center max-h-[75vh] w-full">
              <img
                src={settings.qrisImageUrl}
                alt={`QRIS Full ${settings.qrisMerchantName}`}
                className="max-h-[70vh] w-full object-contain rounded-lg"
              />
            </div>
            <div className="mt-4 flex items-center justify-between w-full text-xs font-bold text-[#3E2723] px-2">
              <span>Total: <strong className="text-base text-emerald-700">{formatRp(tx.total)}</strong></span>
              <button
                onClick={() => setIsZoomed(false)}
                className="px-4 py-2 bg-[#3E2723] text-white rounded-xl hover:bg-[#4E342E] transition-colors cursor-pointer"
              >
                Selesai / Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

