import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Download,
  Printer,
  Sparkles,
  Store,
  Smartphone,
  Send,
} from 'lucide-react';
import { Outlet, StoreSettings, User } from '../../types';
import { buildCustomerSelfOrderUrl } from '../../utils/publicUrlHelper';

interface QuickTableQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  settings: StoreSettings;
  activeOutlet?: Outlet;
  outlets: Outlet[];
  onOpenFullQRGenerator?: () => void;
}

export const QuickTableQRModal: React.FC<QuickTableQRModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  settings,
  activeOutlet,
  outlets,
  onOpenFullQRGenerator,
}) => {
  const isKasir = currentUser.role === 'kasir';
  const initialOutletId = isKasir
    ? currentUser.outletId || outlets[0]?.id || 'outlet-lagoa'
    : activeOutlet?.id || outlets[0]?.id || 'outlet-lagoa';

  const [selectedOutletId, setSelectedOutletId] = useState<string>(initialOutletId);
  const [selectedTable, setSelectedTable] = useState<string>('Meja 01');
  const [customTable, setCustomTable] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Sync initial outlet
  useEffect(() => {
    if (initialOutletId) {
      setSelectedOutletId(initialOutletId);
    }
  }, [initialOutletId, isOpen]);

  const currentOutletObj = useMemo(() => {
    return outlets.find((o) => o.id === selectedOutletId) || activeOutlet || outlets[0];
  }, [outlets, selectedOutletId, activeOutlet]);

  const activeTableName = isCustomMode ? (customTable.trim() || 'Meja 01') : selectedTable;

  // Build target customer self-ordering URL (always uses public unauthenticated origin)
  const orderUrl = useMemo(() => {
    return buildCustomerSelfOrderUrl(selectedOutletId, activeTableName, settings);
  }, [settings, selectedOutletId, activeTableName]);

  // Generate QR Code dynamically
  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(orderUrl, {
      width: 420,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('[QuickTableQRModal] QR Generation error:', err));
  }, [isOpen, orderUrl]);

  // Copy to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed, fallback manual copy');
    }
  };

  // Share to WhatsApp
  const handleShareWhatsApp = () => {
    const storeName = currentOutletObj?.name || settings.storeName || 'SU-QUR Coffee';
    const message = encodeURIComponent(
      `Halo! ☕\nSilakan buka tautan menu digital dan lakukan pemesanan mandiri untuk *${activeTableName}* (${storeName}):\n\n👉 ${orderUrl}\n\nPesanan Anda akan langsung diproses oleh tim kasir & barista kami!`
    );
    const waUrl = `https://api.whatsapp.com/send?text=${message}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Download QR Code PNG
  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    setDownloading(true);
    const link = document.createElement('a');
    link.download = `QR_${(currentOutletObj?.name || 'Outlet').replace(/\s+/g, '_')}_${activeTableName.replace(
      /\s+/g,
      '_'
    )}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 800);
  };

  const quickTables = [
    'Meja 01',
    'Meja 02',
    'Meja 03',
    'Meja 04',
    'Meja 05',
    'Meja 06',
    'Meja 07',
    'Meja 08',
    'Takeaway / Kasir',
    'Area Bar',
    'Lantai 2 - Meja 1',
    'Outdoor 01',
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 px-4 py-3 sm:px-5 sm:py-3.5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                  QR Meja &amp; Link Menu
                  <span className="bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full">
                    Self-Order
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  Akses menu digital mandiri untuk meja kasir / pelanggan
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-3.5 overflow-y-auto max-h-[calc(85vh-100px)] text-slate-800">
            {/* Outlet Selector (if admin) */}
            {!isKasir && outlets.length > 1 && (
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-600" />
                  Pilih Cabang / Outlet
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {outlets.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOutletId(o.id)}
                      className={`p-1.5 rounded-lg text-xs font-semibold text-left transition-all border cursor-pointer ${
                        selectedOutletId === o.id
                          ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="truncate text-xs">{o.name}</div>
                      <div className="text-[9.5px] font-normal text-slate-400 truncate">{o.address || 'Outlet Aktif'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Table Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  Pilih Nomor Meja / Posisi
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className="text-[10.5px] font-bold text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
                >
                  {isCustomMode ? 'Pilih Cepat' : '+ Kustom Meja'}
                </button>
              </div>

              {isCustomMode ? (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Contoh: Meja VIP 01 / Gazebo 2"
                    value={customTable}
                    onChange={(e) => setCustomTable(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-amber-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customTable.trim()) {
                        setSelectedTable(customTable.trim());
                        setIsCustomMode(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Terapkan
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {quickTables.map((tbl) => (
                    <button
                      key={tbl}
                      type="button"
                      onClick={() => {
                        setSelectedTable(tbl);
                        setIsCustomMode(false);
                      }}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all border cursor-pointer ${
                        selectedTable === tbl && !isCustomMode
                          ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                      }`}
                    >
                      {tbl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* QR Card & Live Visual */}
            <div className="bg-slate-50 border border-slate-200 p-3 sm:p-3.5 rounded-xl flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              {/* QR Image Box */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col items-center justify-center shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${activeTableName}`}
                    className="w-32 h-32 object-contain rounded-md"
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center text-slate-400 text-xs font-semibold">
                    Memuat QR...
                  </div>
                )}
                <div className="mt-1.5 text-center">
                  <div className="text-xs font-bold text-slate-900">{activeTableName}</div>
                  <div className="text-[9.5px] text-amber-700 font-medium truncate max-w-[130px]">
                    {currentOutletObj?.name || 'SU-QUR Coffee'}
                  </div>
                </div>
              </div>

              {/* URL & Instant Actions */}
              <div className="flex-1 w-full space-y-2 min-w-0">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Link Pemesanan Pelanggan
                  </div>
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-[10.5px] text-slate-600 break-all select-all flex items-center justify-between gap-1.5 shadow-2xs">
                    <span className="truncate">{orderUrl}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  {/* Copy Link Button */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`py-1.5 px-2.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      copied
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 border-amber-600 text-white shadow-2xs'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{copied ? 'Tersalin!' : 'Salin Link'}</span>
                  </button>

                  {/* Share WhatsApp Button */}
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 border border-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </button>

                  {/* Test in New Tab */}
                  <a
                    href={orderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-200 shadow-2xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">Buka Tab Baru</span>
                  </a>

                  {/* Download PNG */}
                  <button
                    type="button"
                    onClick={handleDownloadQR}
                    disabled={downloading}
                    className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{downloading ? 'Mengunduh...' : 'Unduh Gambar'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Print & Batch Generator Link */}
            {onOpenFullQRGenerator && (
              <div className="bg-amber-50/80 border border-amber-200/80 px-3 py-2 rounded-xl flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                    <Printer className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Cetak Stiker Meja Massal</div>
                    <div className="text-[10px] text-slate-600 truncate">
                      Cetak QR Meja 01 s/d Meja 30 format print siap tempel
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFullQRGenerator();
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  Cetak Massal
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
            <div className="text-[10.5px] text-slate-500 flex items-center gap-1 truncate">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="truncate">Pesanan otomatis masuk ke kasir via link ini.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
