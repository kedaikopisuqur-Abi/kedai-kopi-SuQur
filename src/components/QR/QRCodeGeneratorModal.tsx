import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Outlet, StoreSettings } from '../../types';
import { buildCustomerSelfOrderUrl } from '../../utils/publicUrlHelper';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  X,
  Store,
  Layers,
  Sparkles,
  Wifi,
  Coffee,
  CheckCircle2,
} from 'lucide-react';

interface QRCodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlets: Outlet[];
  currentOutlet?: Outlet;
  settings: StoreSettings;
  onOpenCustomerPreview?: (outletId: string, table: string) => void;
}

export const QRCodeGeneratorModal: React.FC<QRCodeGeneratorModalProps> = ({
  isOpen,
  onClose,
  outlets,
  currentOutlet,
  settings,
  onOpenCustomerPreview,
}) => {
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    currentOutlet?.id || outlets[0]?.id || ''
  );
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [tableNumber, setTableNumber] = useState<string>('Meja 01');

  // Batch Generation
  const [tablePrefix, setTablePrefix] = useState<string>('Meja');
  const [startNum, setStartNum] = useState<number>(1);
  const [endNum, setEndNum] = useState<number>(10);

  // Customization
  const [includeWifi, setIncludeWifi] = useState<boolean>(true);
  const [wifiName, setWifiName] = useState<string>(settings.wifiName || 'Kedai Kopi Wahid');
  const [wifiPassword, setWifiPassword] = useState<string>(settings.wifiPassword || 'kopi12345');

  // Single QR Preview
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Batch QR Data URLs
  const [batchQrs, setBatchQrs] = useState<
    Array<{ table: string; url: string; qrDataUrl: string }>
  >([]);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) || outlets[0];

  // Base customer self-ordering URL builder (always uses public unauthenticated origin)
  const getOrderUrl = (table: string, outletId: string) => {
    return buildCustomerSelfOrderUrl(outletId, table, settings);
  };

  // Generate Single QR
  useEffect(() => {
    if (!isOpen || mode !== 'single') return;
    const url = getOrderUrl(tableNumber.trim() || 'Meja 01', selectedOutletId);
    QRCode.toDataURL(url, {
      width: 380,
      margin: 2,
      color: {
        dark: '#2B1713',
        light: '#FFFFFF',
      },
    })
      .then((dataUrl) => {
        setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });
  }, [isOpen, selectedOutletId, tableNumber, mode]);

  // Generate Batch QRs
  const handleGenerateBatch = async () => {
    if (!selectedOutlet) return;
    setIsGenerating(true);
    const results: Array<{ table: string; url: string; qrDataUrl: string }> = [];

    const start = Math.max(1, startNum);
    const end = Math.max(start, Math.min(start + 50, endNum)); // max 50 tables per batch

    for (let i = start; i <= end; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      const tableName = `${tablePrefix} ${numStr}`.trim();
      const url = getOrderUrl(tableName, selectedOutletId);
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 320,
          margin: 2,
          color: {
            dark: '#2B1713',
            light: '#FFFFFF',
          },
        });
        results.push({ table: tableName, url, qrDataUrl: dataUrl });
      } catch (err) {
        console.error('Batch QR error for table', tableName, err);
      }
    }

    setBatchQrs(results);
    setIsGenerating(false);
  };

  useEffect(() => {
    if (mode === 'batch') {
      handleGenerateBatch();
    }
  }, [mode, selectedOutletId, tablePrefix, startNum, endNum]);

  if (!isOpen) return null;

  const currentOrderUrl = getOrderUrl(tableNumber.trim() || 'Meja 01', selectedOutletId);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentOrderUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleDownloadSingleQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR-Order-${selectedOutlet?.name || 'Cabang'}-${tableNumber.replace(/\s+/g, '-')}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrintCard = (customTable?: string, customQrUrl?: string) => {
    const tableToPrint = customTable || tableNumber;
    const qrToPrint = customQrUrl || qrDataUrl;
    const outletName = selectedOutlet?.name || 'Kedai Kopi Wahid';
    const outletAddress = selectedOutlet?.address || '';
    const outletPhone = selectedOutlet?.phone || '';

    const printWindow = window.open('', '_blank', 'width=600,height=750');
    if (!printWindow) {
      alert('Izinkan pop-up browser untuk mencetak label QR Meja.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak QR Meja - ${tableToPrint}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: 80mm 110mm;
              margin: 4mm;
            }
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 10px;
              text-align: center;
              color: #2B1713;
              background: #fff;
              -webkit-print-color-adjust: exact;
            }
            .card {
              border: 2px dashed #8D6E63;
              border-radius: 16px;
              padding: 16px 12px;
              max-width: 320px;
              margin: 0 auto;
              background: #FAF8F5;
            }
            .header-badge {
              display: inline-block;
              background: #3E2723;
              color: #FAF3DD;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 4px 12px;
              border-radius: 20px;
              margin-bottom: 6px;
            }
            .brand-title {
              font-size: 18px;
              font-weight: 900;
              margin: 4px 0 2px 0;
              color: #3E2723;
            }
            .outlet-info {
              font-size: 11px;
              color: #6D4C41;
              margin-bottom: 12px;
            }
            .qr-container {
              background: #fff;
              padding: 8px;
              border-radius: 12px;
              border: 1px solid #E6D5C3;
              display: inline-block;
              margin: 4px auto;
              box-shadow: 0 2px 6px rgba(0,0,0,0.06);
            }
            .qr-image {
              width: 190px;
              height: 190px;
              display: block;
            }
            .table-badge {
              font-size: 20px;
              font-weight: 900;
              color: #3E2723;
              margin-top: 8px;
              padding: 4px 12px;
              background: #EFEBE9;
              border-radius: 8px;
              display: inline-block;
              letter-spacing: 0.5px;
            }
            .instruction {
              font-size: 11px;
              font-weight: 700;
              color: #4E342E;
              margin-top: 8px;
            }
            .wifi-box {
              margin-top: 10px;
              padding: 6px;
              background: #ECEFF1;
              border-radius: 8px;
              font-size: 10px;
              color: #37474F;
              border: 1px solid #CFD8DC;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-badge">SCAN & PESAN DARI MEJA</div>
            <div class="brand-title">${outletName}</div>
            <div class="outlet-info">${outletAddress ? outletAddress : ''} ${outletPhone ? ' | ' + outletPhone : ''}</div>
            
            <div class="qr-container">
              <img class="qr-image" src="${qrToPrint}" alt="QR Code ${tableToPrint}" />
            </div>

            <div>
              <div class="table-badge">${tableToPrint}</div>
            </div>
            <div class="instruction">Buka Kamera HP &gt; Scan QR &gt; Pilih Menu &gt; Kirim Pesanan</div>

            ${
              includeWifi && (wifiName || wifiPassword)
                ? `
              <div class="wifi-box">
                📶 <b>WiFi Cafe:</b> ${wifiName} ${wifiPassword ? `| <b>Password:</b> ${wifiPassword}` : ''}
              </div>
            `
                : ''
            }
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintAllBatch = () => {
    if (batchQrs.length === 0) return;
    const outletName = selectedOutlet?.name || 'Kedai Kopi Wahid';
    const outletAddress = selectedOutlet?.address || '';
    const outletPhone = selectedOutlet?.phone || '';

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Izinkan pop-up browser untuk mencetak label batch QR Meja.');
      return;
    }

    const cardsHtml = batchQrs
      .map(
        (item) => `
        <div class="card">
          <div class="header-badge">SCAN & PESAN DARI MEJA</div>
          <div class="brand-title">${outletName}</div>
          <div class="outlet-info">${outletAddress}</div>
          <div class="qr-container">
            <img class="qr-image" src="${item.qrDataUrl}" alt="${item.table}" />
          </div>
          <div class="table-badge">${item.table}</div>
          <div class="instruction">Scan Kamera HP &gt; Pilih Menu &gt; Kirim Pesanan</div>
          ${
            includeWifi && (wifiName || wifiPassword)
              ? `
            <div class="wifi-box">
              📶 <b>WiFi:</b> ${wifiName} ${wifiPassword ? `| <b>Pass:</b> ${wifiPassword}` : ''}
            </div>
          `
              : ''
          }
        </div>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Semua QR Meja - ${outletName}</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #2B1713;
              background: #fff;
              -webkit-print-color-adjust: exact;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
            }
            .card {
              border: 2px dashed #8D6E63;
              border-radius: 14px;
              padding: 14px 10px;
              text-align: center;
              background: #FAF8F5;
              page-break-inside: avoid;
            }
            .header-badge {
              display: inline-block;
              background: #3E2723;
              color: #FAF3DD;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 3px 10px;
              border-radius: 16px;
              margin-bottom: 4px;
            }
            .brand-title {
              font-size: 15px;
              font-weight: 900;
              margin: 3px 0 2px 0;
              color: #3E2723;
            }
            .outlet-info {
              font-size: 9px;
              color: #6D4C41;
              margin-bottom: 8px;
            }
            .qr-container {
              background: #fff;
              padding: 6px;
              border-radius: 10px;
              border: 1px solid #E6D5C3;
              display: inline-block;
              margin: 2px auto;
            }
            .qr-image {
              width: 150px;
              height: 150px;
              display: block;
            }
            .table-badge {
              font-size: 16px;
              font-weight: 900;
              color: #3E2723;
              margin-top: 6px;
              padding: 3px 10px;
              background: #EFEBE9;
              border-radius: 6px;
              display: inline-block;
            }
            .instruction {
              font-size: 10px;
              font-weight: 700;
              color: #4E342E;
              margin-top: 4px;
            }
            .wifi-box {
              margin-top: 6px;
              padding: 4px;
              background: #ECEFF1;
              border-radius: 6px;
              font-size: 9px;
              color: #37474F;
              border: 1px solid #CFD8DC;
            }
            @media print {
              .grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${cardsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FAF3DD] w-full max-w-4xl max-h-[92vh] rounded-3xl p-6 shadow-2xl border-2 border-[#D4A373] text-[#3E2723] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#3E2723] text-amber-300 flex items-center justify-center shadow-md">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif italic font-bold text-xl text-[#3E2723] flex items-center gap-2">
                Generator QR Code Meja & Self-Ordering Pelanggan
              </h2>
              <p className="text-xs text-[#8D6E63]">
                Buat, cetak stiker nomor meja, dan bagikan tautan menu digital yang terintegrasi langsung ke POS Kasir.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/70 hover:bg-[#E6D5C3] text-[#8D6E63] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 text-xs">
          {/* Controls Bar: Outlet Selector & Mode Switch */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/80 p-4 rounded-2xl border border-[#E6D5C3]">
            <div>
              <label className="block font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-amber-700" />
                Pilih Lokasi Cabang / Outlet:
              </label>
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-white text-[#3E2723] font-bold focus:ring-2 focus:ring-[#3E2723] outline-hidden"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.isDefault ? '(Pusat)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-700" />
                Tipe Pembuatan QR:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all ${
                    mode === 'single'
                      ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  Satu Meja Spesifik
                </button>
                <button
                  type="button"
                  onClick={() => setMode('batch')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all ${
                    mode === 'batch'
                      ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  Batch (Banyak Meja)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-amber-700" />
                Keterangan WiFi di Meja:
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-stone-800 font-bold">
                  <input
                    type="checkbox"
                    checked={includeWifi}
                    onChange={(e) => setIncludeWifi(e.target.checked)}
                    className="rounded text-[#3E2723] focus:ring-[#3E2723] w-4 h-4"
                  />
                  <span>Tampilkan Info WiFi</span>
                </label>
              </div>
            </div>
          </div>

          {/* Wifi Inputs if enabled */}
          {includeWifi && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-xs">
              <div>
                <label className="block font-bold text-amber-900 mb-0.5">Nama WiFi Cafe / SSID:</label>
                <input
                  type="text"
                  placeholder="misal: Kedai Kopi Wahid"
                  value={wifiName}
                  onChange={(e) => setWifiName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-gray-800 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-amber-900 mb-0.5">Password WiFi:</label>
                <input
                  type="text"
                  placeholder="misal: kopi12345"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-gray-800 font-medium font-mono"
                />
              </div>
            </div>
          )}

          {/* Mode 1: Single Table QR */}
          {mode === 'single' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Controls Column */}
              <div className="md:col-span-6 space-y-4 bg-white p-5 rounded-2xl border border-[#E6D5C3]">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Nomor / Nama Meja:
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Contoh: Meja 01, Meja 05, VIP Room, Outdoor 2, Takeaway"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-[#3E2723] font-bold text-sm focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Meja 01', 'Meja 02', 'Meja 03', 'Meja 05', 'Meja 10', 'Outdoor 01', 'VIP Room', 'Takeaway'].map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTableNumber(preset)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-semibold transition-colors"
                        >
                          {preset}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Link Akses Menu Pelanggan (URL):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={currentOrderUrl}
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-stone-50 text-stone-600 font-mono text-[11px] truncate outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-2 rounded-xl bg-[#3E2723] hover:bg-[#2B1713] text-[#FAF3DD] font-bold shrink-0 flex items-center gap-1.5 shadow-xs"
                      title="Salin Tautan"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E6D5C3] space-y-2">
                  <button
                    type="button"
                    onClick={() => handlePrintCard()}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#3E2723] hover:bg-[#2B1713] text-[#FAF3DD] font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4 text-amber-300" />
                    <span>Cetak Label Meja / Print Kartu Meja</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadSingleQR}
                      className="py-2.5 px-3 rounded-xl bg-white border border-[#D4A373] text-[#5D4037] hover:bg-amber-50 font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenCustomerPreview) {
                          onOpenCustomerPreview(selectedOutletId, tableNumber);
                          onClose();
                        } else {
                          window.open(currentOrderUrl, '_blank');
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Uji Coba Menu</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview Card Column */}
              <div className="md:col-span-6 flex flex-col items-center justify-center">
                <div className="text-[11px] font-bold text-[#8D6E63] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Pratinjau Stiker Meja Pelanggan
                </div>

                <div className="w-full max-w-[280px] bg-[#FAF8F5] border-2 border-dashed border-[#8D6E63] rounded-2xl p-5 text-center shadow-lg relative">
                  <div className="inline-block bg-[#3E2723] text-[#FAF3DD] text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-1.5">
                    SCAN & PESAN DARI MEJA
                  </div>
                  <h4 className="font-serif italic font-bold text-base text-[#3E2723] leading-tight">
                    {selectedOutlet?.name || 'Kedai Kopi Wahid'}
                  </h4>
                  <p className="text-[10px] text-[#8D6E63] line-clamp-1 mb-3">
                    {selectedOutlet?.address || 'Outlet Aktif'}
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3] shadow-xs inline-block mb-3">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`QR Code ${tableNumber}`}
                        className="w-40 h-40 object-contain mx-auto"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-stone-400">
                        Memuat QR...
                      </div>
                    )}
                  </div>

                  <div className="bg-[#EFEBE9] px-4 py-1.5 rounded-lg inline-block text-sm font-black text-[#3E2723] mb-1">
                    {tableNumber || 'Meja 01'}
                  </div>

                  <p className="text-[10px] font-bold text-[#5D4037] mt-1">
                    Scan Kamera HP &gt; Pilih Menu &gt; Kirim Pesanan
                  </p>

                  {includeWifi && (wifiName || wifiPassword) && (
                    <div className="mt-3 p-1.5 bg-[#ECEFF1] rounded-lg border border-[#CFD8DC] text-[9px] text-[#37474F] font-mono">
                      📶 WiFi: <b>{wifiName}</b> {wifiPassword ? `| Pass: ${wifiPassword}` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Batch Table QR Generator */
            <div className="space-y-4">
              {/* Batch Configuration */}
              <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Awalan Label Meja:</label>
                  <input
                    type="text"
                    value={tablePrefix}
                    onChange={(e) => setTablePrefix(e.target.value)}
                    placeholder="misal: Meja"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-[#3E2723] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Nomor Awal:</label>
                  <input
                    type="number"
                    min={1}
                    value={startNum}
                    onChange={(e) => setStartNum(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-[#3E2723] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Nomor Akhir:</label>
                  <input
                    type="number"
                    min={startNum}
                    max={startNum + 50}
                    value={endNum}
                    onChange={(e) => setEndNum(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-[#3E2723] font-bold"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateBatch}
                    disabled={isGenerating}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#3E2723] hover:bg-[#2B1713] text-[#FAF3DD] font-bold transition-all shadow-xs"
                  >
                    {isGenerating ? 'Membuat...' : 'Perbarui QR'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintAllBatch}
                    disabled={batchQrs.length === 0}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs flex items-center gap-1"
                    title="Cetak Semua Kartu Sekaligus"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Semua</span>
                  </button>
                </div>
              </div>

              {/* Batch Grid Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1">
                {batchQrs.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 rounded-xl border border-[#E6D5C3] text-center flex flex-col justify-between shadow-xs hover:border-[#8D6E63] transition-all"
                  >
                    <div>
                      <div className="font-bold text-[#3E2723] text-xs mb-1">{item.table}</div>
                      <img
                        src={item.qrDataUrl}
                        alt={item.table}
                        className="w-24 h-24 mx-auto border border-stone-200 rounded-lg p-1 bg-white"
                      />
                    </div>
                    <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePrintCard(item.table, item.qrDataUrl)}
                        className="p-1.5 rounded-lg bg-[#3E2723] text-white hover:bg-black transition-colors"
                        title="Cetak Meja Ini"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `QR-${item.table.replace(/\s+/g, '-')}.png`;
                          link.href = item.qrDataUrl;
                          link.click();
                        }}
                        className="p-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
                        title="Unduh PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 mt-3 border-t border-[#E6D5C3] flex items-center justify-between text-[11px] text-[#8D6E63] shrink-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Terhubung otomatis: Pesanan pelanggan dari QR akan muncul langsung di tab <b>Pesanan QR</b> layar Kasir.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
