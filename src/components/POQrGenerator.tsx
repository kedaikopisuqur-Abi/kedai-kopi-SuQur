import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  X,
  Store,
  Sparkles,
  Share2,
  Printer,
  Coffee,
  CheckCircle2,
  Calendar,
  Layers,
  MessageCircle,
} from 'lucide-react';
import { Outlet, StoreSettings, User } from '../types';
import { StorageService } from '../services/storage';
import { buildCustomerPOUrl } from '../utils/publicUrlHelper';

interface POQrGeneratorProps {
  isOpen?: boolean;
  onClose?: () => void;
  isModal?: boolean;
  outlets?: Outlet[];
  currentOutlet?: Outlet;
  settings?: StoreSettings;
  user?: User;
  isKasir?: boolean;
}

export const POQrGenerator: React.FC<POQrGeneratorProps> = ({
  isOpen = true,
  onClose,
  isModal = true,
  outlets: propOutlets,
  currentOutlet: propCurrentOutlet,
  settings: propSettings,
  user,
  isKasir: propIsKasir,
}) => {
  const outlets = propOutlets || StorageService.getOutlets();
  const settings = propSettings || StorageService.getSettings();
  const isKasir = propIsKasir ?? (user?.role === 'kasir');

  const defaultOutlet = propCurrentOutlet || outlets[0] || {
    id: 'outlet-main',
    name: 'Kedai Kopi Wahid Su-Qur',
    address: 'Jl. Lagoa Terusan No. 12, Koja, Jakarta Utara',
    phone: '0812-9988-1001',
  };

  const [selectedOutletId, setSelectedOutletId] = useState<string>(defaultOutlet.id);

  // Keep selectedOutletId in sync if propCurrentOutlet or cashier status changes
  useEffect(() => {
    if (defaultOutlet?.id) {
      setSelectedOutletId(defaultOutlet.id);
    }
  }, [defaultOutlet?.id]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [qrSize, setQrSize] = useState<number>(320);
  const flyerCanvasRef = useRef<HTMLCanvasElement>(null);

  const activeOutlet = outlets.find((o) => o.id === selectedOutletId) || defaultOutlet;

  // Build Customer PO URL (always uses public unauthenticated origin)
  const customerPOUrl = React.useMemo(() => {
    return buildCustomerPOUrl(activeOutlet.id, settings);
  }, [activeOutlet.id, settings]);

  // Generate QR Code data URL dynamically
  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);

    QRCode.toDataURL(customerPOUrl, {
      width: qrSize,
      margin: 2,
      color: {
        dark: '#2B1713',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.warn('QRCode library error, using fallback API:', err);
        // Fallback to QR Server API
        const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(
          customerPOUrl
        )}&color=2B1713&bgcolor=FFFFFF&margin=8`;
        if (isMounted) {
          setQrDataUrl(fallbackUrl);
          setIsGenerating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [customerPOUrl, qrSize]);

  // WhatsApp broadcast share text
  const waBroadcastText = useMemo(() => {
    return `☕ *FORM PRE-ORDER & RESERVASI RESMI*\n*${settings.storeName || 'KEDAI KOPI WAHID SU-QUR'}* (${activeOutlet.name})\n\nHalo Sahabat Su-Qur! Mau order katering kopi, snack partai besar, atau reservasi meja tanpa repot?\n\n📲 *Klik tautan formulir Pre-Order berikut:*\n${customerPOUrl}\n\nTerima kasih dan kami siap melayani pesanan Anda!`;
  }, [settings.storeName, activeOutlet.name, customerPOUrl]);

  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waBroadcastText)}`;
    window.open(waUrl, '_blank');
  };

  // Copy Link to Clipboard
  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(customerPOUrl).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      });
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = customerPOUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  // Download QR Code Flyer / Card as PNG
  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 1100;

    // Background Gradient Warm Cream
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#FAF3DD');
    bgGrad.addColorStop(1, '#FDFBF7');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Header Top Bar (Dark Coffee)
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(0, 0, canvas.width, 180);

    // Gold Accent Stripe
    ctx.fillStyle = '#D4A373';
    ctx.fillRect(0, 180, canvas.width, 12);

    // Brand Name Text
    ctx.fillStyle = '#FAF3DD';
    ctx.font = 'bold 36px serif';
    ctx.textAlign = 'center';
    ctx.fillText(settings.storeName || 'KEDAI KOPI WAHID SU-QUR', canvas.width / 2, 75);

    // Subheader Text
    ctx.fillStyle = '#FFD54F';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('FORM PEMESANAN PRE-ORDER & RESERVASI', canvas.width / 2, 125);

    ctx.fillStyle = '#E0D0C1';
    ctx.font = '16px sans-serif';
    ctx.fillText('Katering • Acara Partai Besar • Reservasi Meja', canvas.width / 2, 155);

    // Call to Action Card Container
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(43, 23, 19, 0.15)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;
    const cardX = 100;
    const cardY = 240;
    const cardW = 600;
    const cardH = 650;
    const cardRadius = 32;

    // Rounded rectangle helper
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Border around card
    ctx.strokeStyle = '#D4A373';
    ctx.lineWidth = 4;
    ctx.stroke();

    // "SCAN UNTUK ORDER" Title
    ctx.fillStyle = '#2B1713';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('SCAN KODE QR DI BAWAH', canvas.width / 2, cardY + 65);

    ctx.fillStyle = '#795548';
    ctx.font = '16px sans-serif';
    ctx.fillText('Akses Form Pre-Order langsung dari HP Anda', canvas.width / 2, cardY + 98);

    // Draw QR Code Image in Center
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      const qrDrawSize = 380;
      const qrX = (canvas.width - qrDrawSize) / 2;
      const qrY = cardY + 125;

      // Draw QR border / background
      ctx.fillStyle = '#FAF3DD';
      ctx.beginPath();
      ctx.roundRect(qrX - 15, qrY - 15, qrDrawSize + 30, qrDrawSize + 30, 20);
      ctx.fill();
      ctx.strokeStyle = '#D4A373';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.drawImage(qrImg, qrX, qrY, qrDrawSize, qrDrawSize);

      // Outlet info inside card
      ctx.fillStyle = '#3E2723';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(activeOutlet.name, canvas.width / 2, cardY + 565);

      ctx.fillStyle = '#5D4037';
      ctx.font = '14px sans-serif';
      ctx.fillText(activeOutlet.address || 'Kedai Su-Qur', canvas.width / 2, cardY + 595);

      ctx.fillStyle = '#8D6E63';
      ctx.font = '13px sans-serif';
      ctx.fillText(`WhatsApp: ${activeOutlet.phone || settings.phone || settings.storePhone || '0812-9988-1001'}`, canvas.width / 2, cardY + 622);

      // Footer Banner
      ctx.fillStyle = '#3E2723';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Su-Qur POS • Sistem Kasir & Pre-Order Terpadu', canvas.width / 2, canvas.height - 45);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `QR_PreOrder_${activeOutlet.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = qrDataUrl;
  };

  // Print Standee / Flyer directly
  const handlePrintFlyer = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup blocker aktif. Silakan izinkan popup untuk mencetak flyer.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak QR Pre-Order - ${activeOutlet.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 1.5cm;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #2B1713;
              text-align: center;
              padding: 20px;
              background: #FAF3DD;
            }
            .flyer-card {
              background: #FFFFFF;
              border: 3px solid #D4A373;
              border-radius: 28px;
              padding: 40px 30px;
              max-width: 500px;
              margin: 0 auto;
              box-shadow: 0 10px 25px rgba(0,0,0,0.08);
            }
            .header-badge {
              background: #3E2723;
              color: #FFD54F;
              font-size: 14px;
              font-weight: 800;
              padding: 6px 16px;
              border-radius: 50px;
              display: inline-block;
              margin-bottom: 12px;
              letter-spacing: 1px;
            }
            h1 {
              font-size: 24px;
              margin: 0 0 6px 0;
              color: #2B1713;
            }
            p.sub {
              font-size: 13px;
              color: #795548;
              margin: 0 0 24px 0;
            }
            .qr-wrapper {
              background: #FAF3DD;
              padding: 18px;
              border-radius: 20px;
              display: inline-block;
              border: 2px solid #D4A373;
              margin-bottom: 20px;
            }
            .qr-wrapper img {
              display: block;
              width: 280px;
              height: 280px;
            }
            .outlet-title {
              font-size: 16px;
              font-weight: 700;
              color: #3E2723;
              margin-bottom: 4px;
            }
            .outlet-desc {
              font-size: 12px;
              color: #5D4037;
              margin-bottom: 6px;
            }
            .url-text {
              font-family: monospace;
              font-size: 11px;
              color: #8D6E63;
              background: #F5EBE0;
              padding: 6px 12px;
              border-radius: 8px;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="flyer-card">
            <div class="header-badge">KEDAI SU-QUR • PRE-ORDER</div>
            <h1>SCAN UNTUK FORM PRE-ORDER</h1>
            <p class="sub">Pesan menu katering & reservasi slot waktu dari HP Anda</p>
            
            <div class="qr-wrapper">
              <img src="${qrDataUrl}" alt="QR Code Pre-Order" />
            </div>

            <div class="outlet-title">${activeOutlet.name}</div>
            <div class="outlet-desc">${activeOutlet.address || ''}</div>
            <div class="url-text">${customerPOUrl}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const content = (
    <div className="space-y-5 text-[#2B1713]">
      {/* Modal / Widget Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#D4A373]/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-900 border border-amber-400/40 flex items-center justify-center font-black shrink-0 shadow-inner">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-black text-base sm:text-lg text-[#2B1713]">
                Share Link & Scan QR Pre-Order
              </h3>
              <span className="text-[10px] bg-amber-400 text-[#2B1713] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                Publik
              </span>
            </div>
            <p className="text-xs text-[#795548]">
              Bagikan tautan formulir atau cetak QR Code untuk memudahkan pelanggan memesan PO.
            </p>
          </div>
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Outlet Selector (Admin selectable / Kasir Locked) */}
      {isKasir ? (
        <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-300 flex items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-200/70 border border-amber-400 text-amber-900 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 text-amber-800" />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Cabang Kasir Aktif</span>
              <span className="font-bold text-[#2B1713] truncate block">{activeOutlet.name}</span>
            </div>
          </div>
          <span className="text-[10px] bg-amber-200 text-[#2B1713] font-black px-2 py-0.5 rounded-md shrink-0 border border-amber-300/80">
            Terkunci Akun Kasir
          </span>
        </div>
      ) : (
        outlets.length > 1 && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#5D4037]">Pilih Cabang Outlet Tujuan</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {outlets.map((out) => (
                <button
                  key={out.id}
                  type="button"
                  onClick={() => setSelectedOutletId(out.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 text-xs ${
                    selectedOutletId === out.id
                      ? 'bg-[#FAF3DD] border-amber-600 ring-2 ring-amber-400/40 font-bold text-[#2B1713]'
                      : 'bg-white border-[#E6D5C3] text-[#5D4037] hover:border-[#D4A373]'
                  }`}
                >
                  <Store className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="truncate">{out.name}</span>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* QR Code & Card Preview Area */}
      <div className="bg-[#FAF3DD] rounded-3xl p-5 border border-[#D4A373] text-center space-y-4 shadow-inner">
        <div className="inline-block relative">
          <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-[#D4A373] inline-block">
            {isGenerating || !qrDataUrl ? (
              <div className="w-56 h-56 flex items-center justify-center bg-stone-50 rounded-xl">
                <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <img
                src={qrDataUrl}
                alt="QR Code Form PO"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
              />
            )}
          </div>
        </div>

        <div className="space-y-1 max-w-sm mx-auto">
          <div className="font-bold text-xs sm:text-sm text-[#2B1713]">{activeOutlet.name}</div>
          <p className="text-[11px] text-[#795548]">
            Scan kode di atas menggunakan kamera HP untuk langsung membuka Form PO Pelanggan.
          </p>
        </div>

        {/* URL Box & Copy */}
        <div className="flex items-center gap-2 max-w-md mx-auto bg-white p-2 rounded-2xl border border-[#D4A373] shadow-xs">
          <input
            type="text"
            readOnly
            value={customerPOUrl}
            className="flex-1 bg-transparent text-xs font-mono text-[#5D4037] px-2 outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              isCopied
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-2xs'
            }`}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Action Buttons (Download, Print, Test Open, WhatsApp) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        <button
          type="button"
          onClick={handleDownloadQrPng}
          disabled={!qrDataUrl}
          className="py-2 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-stone-300 text-white font-semibold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh PNG</span>
        </button>

        <button
          type="button"
          onClick={handlePrintFlyer}
          disabled={!qrDataUrl}
          className="py-2 px-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-amber-200 font-semibold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Cetak Standee</span>
        </button>

        <button
          type="button"
          onClick={handleShareWhatsApp}
          className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp</span>
        </button>

        <a
          href={customerPOUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#FAF3DD] text-[#3E2723] border border-[#D4A373] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
          <span>Buka Form</span>
        </a>
      </div>
    </div>
  );

  if (!isModal) {
    return <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E6D5C3] shadow-sm">{content}</div>;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white text-[#2B1713] rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-2 border-[#D4A373] max-h-[90vh] overflow-y-auto z-10"
      >
        {content}
      </motion.div>
    </div>
  );
};
