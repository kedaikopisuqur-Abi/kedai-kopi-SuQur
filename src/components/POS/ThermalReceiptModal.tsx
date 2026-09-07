import React, { useState } from 'react';
import { Transaction, StoreSettings, User } from '../../types';
import {
  formatThermalReceipt,
  formatKitchenTicketThermal,
  formatRp,
  formatDateTime,
  captureElementToCanvas,
  openWhatsApp,
  shareOrDownloadReceiptImage,
  buildReceiptWhatsAppText,
  buildKitchenTicketWhatsAppText,
  downloadCanvasImageToDevice,
  sanitizePhoneForWA,
  resolveOutletInfo,
} from '../../utils/formatters';
import { printReceiptThermal, openCashDrawer } from '../../services/thermalPrinterService';
import {
  Printer,
  Download,
  X,
  Check,
  Copy,
  FileText,
  CheckCircle,
  Image,
  MessageCircle,
  Eye,
  Share2,
  Phone,
  Sparkles,
  DollarSign,
  Unlock,
  Radio,
  Usb,
  Wifi,
  ChefHat,
  Coffee,
  Receipt,
} from 'lucide-react';

interface ThermalReceiptModalProps {
  tx: Transaction;
  settings: StoreSettings;
  currentUser?: User;
  isDraftPreview?: boolean;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  tx,
  settings,
  currentUser,
  isDraftPreview = false,
  onClose,
}) => {
  if (!tx) return null;

  const [printMode, setPrintMode] = useState<'thermal_customer' | 'thermal_kitchen' | 'a4pdf'>('thermal_customer');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(settings?.printerPaperSize || '58mm');
  const [logoSize, setLogoSize] = useState<'small' | 'medium' | 'large' | 'none'>(
    settings?.receiptLogoSize || 'medium'
  );
  const [copied, setCopied] = useState(false);
  const [pdfTip, setPdfTip] = useState(false);
  const [isExportingJPG, setIsExportingJPG] = useState(false);
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [targetPhone, setTargetPhone] = useState(tx.customerPhone || settings?.phone || '');

  const customerReceiptText = formatThermalReceipt(tx, { ...settings, printerPaperSize: paperWidth });
  const kitchenReceiptText = formatKitchenTicketThermal(tx, { ...settings, printerPaperSize: paperWidth });
  const currentReceiptText = printMode === 'thermal_kitchen' ? kitchenReceiptText : customerReceiptText;

  const getLogoHeight = () => {
    switch (logoSize) {
      case 'small':
        return '44px';
      case 'medium':
        return '64px';
      case 'large':
        return '88px';
      default:
        return '0px';
    }
  };

  const handlePrint = async (target: 'current' | 'customer' | 'kitchen' | 'both' = 'current') => {
    if (target === 'both') {
      setSaveSuccessMsg('Mencetak Struk Kasir & Tiket Dapur...');
      const res1 = await printReceiptThermal(customerReceiptText, settings, {
        kickCashDrawer: tx.paymentMethod === 'cash' || settings.autoOpenCashDrawer,
      });
      await new Promise((r) => setTimeout(r, 600));
      const res2 = await printReceiptThermal(kitchenReceiptText, settings, {
        kickCashDrawer: false,
      });
      if (res1.success || res2.success) {
        setSaveSuccessMsg('✅ Struk Pelanggan & Tiket Dapur Berhasil Dicetak!');
      } else {
        setSaveSuccessMsg('⚠️ Gagal mencetak ke printer thermal.');
      }
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      return;
    }

    const textToPrint =
      target === 'kitchen' ? kitchenReceiptText : target === 'customer' ? customerReceiptText : currentReceiptText;
    const isKitchen = target === 'kitchen' || (target === 'current' && printMode === 'thermal_kitchen');

    const res = await printReceiptThermal(textToPrint, settings, {
      kickCashDrawer: !isKitchen && (tx.paymentMethod === 'cash' || settings.autoOpenCashDrawer),
    });
    if (res.success) {
      setSaveSuccessMsg(
        `${isKitchen ? 'Tiket Dapur/Barista' : 'Struk Kasir'} dicetak via ${res.method.toUpperCase()}${res.deviceName ? ` (${res.deviceName})` : ''}!`
      );
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  const handleOpenCashDrawerManual = async () => {
    setIsOpeningDrawer(true);
    const res = await openCashDrawer(settings);
    setIsOpeningDrawer(false);
    if (res.success) {
      setSaveSuccessMsg('💰 Sinyal buka laci kasir (Cash Drawer) berhasil dikirim!');
    } else {
      setSaveSuccessMsg(`⚠️ ${res.message}`);
    }
    setTimeout(() => setSaveSuccessMsg(null), 4500);
  };

  const handlePrintPDF = () => {
    setPdfTip(true);
    setTimeout(() => {
      window.print();
    }, 200);
    setTimeout(() => {
      setPdfTip(false);
    }, 4000);
  };

  const handleDownloadJPG = async () => {
    const element = document.getElementById('thermal-receipt-container');
    if (!element) return;

    setIsExportingJPG(true);
    try {
      const canvas = await captureElementToCanvas(element);
      const isKitchen = printMode === 'thermal_kitchen';
      const fileName = `${isKitchen ? 'Tiket-Dapur' : 'Struk'}-${tx.invoiceNo}.jpg`;
      const ok = await downloadCanvasImageToDevice(canvas, fileName);
      if (ok) {
        setSaveSuccessMsg(
          `${isKitchen ? 'Tiket Dapur' : 'Struk'} berhasil disimpan di Memori HP (Folder Download / Galeri)`
        );
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Error downloading JPG:', err);
    } finally {
      setIsExportingJPG(false);
    }
  };

  const handleSendWhatsAppDirect = () => {
    const isKitchen = printMode === 'thermal_kitchen';
    const waText = isKitchen ? buildKitchenTicketWhatsAppText(tx, settings) : buildReceiptWhatsAppText(tx, settings);
    openWhatsApp(targetPhone || tx.customerPhone || settings.phone, waText);
  };

  const handleShareWhatsAppImage = async () => {
    const element = document.getElementById('thermal-receipt-container');
    if (!element) {
      handleSendWhatsAppDirect();
      return;
    }

    setIsExportingJPG(true);
    try {
      const canvas = await captureElementToCanvas(element);
      const isKitchen = printMode === 'thermal_kitchen';
      const waText = isKitchen ? buildKitchenTicketWhatsAppText(tx, settings) : buildReceiptWhatsAppText(tx, settings);
      await shareOrDownloadReceiptImage({
        canvas,
        fileName: `${isKitchen ? 'Tiket-Dapur' : 'Struk'}-${tx.invoiceNo}.jpg`,
        phone: targetPhone || tx.customerPhone || settings.phone,
        text: waText,
      });
      setSaveSuccessMsg(`${isKitchen ? 'Tiket Dapur' : 'Struk'} dikirim ke WhatsApp / Tersimpan di HP`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error sharing receipt:', err);
    } finally {
      setIsExportingJPG(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(currentReceiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanTargetPhone = sanitizePhoneForWA(targetPhone);

  const connectionLabel = () => {
    const type = settings.printerConnectionType || 'bluetooth';
    if (type === 'bluetooth') return 'Bluetooth Thermal POS';
    if (type === 'usb') return 'USB Cable POS';
    if (type === 'network') return `WiFi/LAN (${settings.printerNetworkIp || 'IP'})`;
    return 'Printer Sistem';
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-[#2B1713] rounded-2xl max-w-lg w-full h-[94vh] sm:h-[90vh] max-h-[820px] flex flex-col shadow-2xl border border-[#4E342E] text-[#F5EBE0] my-auto overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#4E342E] px-4 py-3 sm:px-5 sm:py-3.5 shrink-0 bg-[#2B1713]">
          <div>
            <h3 className="font-bold text-base text-[#FAF3DD] flex items-center gap-2">
              {isDraftPreview ? (
                <>
                  <Eye className="w-5 h-5 text-amber-400" />
                  <span>Pratinjau Struk (Simulasi Cetak)</span>
                </>
              ) : (
                <>
                  <Printer className="w-5 h-5 text-[#D4A373]" />
                  <span>Cetak Struk & Tiket Dapur</span>
                </>
              )}
            </h3>
            <p className="text-xs text-[#D4A373]/80">
              {isDraftPreview ? 'Simulasi Sebelum Transaksi Selesai' : `Faktur #${tx.invoiceNo}`} • {formatDateTime(tx.timestamp)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto min-h-0 px-4 py-3 sm:px-5 space-y-3 flex-1 text-xs overscroll-contain">

        {/* Prominent Queue Number Badge */}
        {tx.queueNo && (
          <div className="bg-gradient-to-r from-[#D4A373]/20 via-[#D4A373]/10 to-[#3E2723] border border-[#D4A373]/50 rounded-2xl p-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D4A373] text-[#1F1412] font-black flex items-center justify-center text-sm shadow-md">
                #
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#D4A373] tracking-widest block">
                  Nomor Antrian Pesanan:
                </span>
                <span className="text-xl font-mono font-black text-[#FFF8E7] tracking-wider">
                  {tx.queueNo}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-[#3E2723] text-amber-200 text-[11px] font-bold border border-[#4E342E]">
                {tx.orderType === 'take_away' || (tx.orderType as any) === 'takeaway'
                  ? '🛍️ Take Away'
                  : tx.orderType === 'online_delivery'
                  ? `🛵 ${tx.onlinePlatform || 'Online'}`
                  : `🍽️ Dine In ${tx.tableNo ? `(Meja ${tx.tableNo})` : ''}`}
              </span>
            </div>
          </div>
        )}

        {/* Draft Preview Banner */}
        {isDraftPreview && (
          <div className="bg-amber-950/80 text-amber-200 p-3 rounded-xl border border-amber-500/50 text-xs font-bold flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-amber-100 font-extrabold block uppercase tracking-wider text-[10px]">
                🔍 MODE PRATINJAU STRUK (SIMULASI)
              </span>
              <span className="text-[11px] font-medium text-amber-200/90">
                Periksa rincian pesanan, nomor antrian, dan total bayar sebelum konfirmasi pembayaran.
              </span>
            </div>
          </div>
        )}

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-950 text-emerald-200 p-3 rounded-xl border border-emerald-500/50 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
            <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-300 hover:text-white">✕</button>
          </div>
        )}

        {/* Tip Banner for PDF saving */}
        {pdfTip && (
          <div className="bg-emerald-950 text-emerald-200 p-3 rounded-xl border border-emerald-500/50 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Membuka dialog cetak... Pilih <strong>"Simpan sebagai PDF" / "Save as PDF"</strong> pada opsi Printer HP.</span>
            </div>
            <button onClick={() => setPdfTip(false)} className="text-white hover:text-gray-300">✕</button>
          </div>
        )}

        {/* 3-Way Mode Selector: Struk Pelanggan vs Tiket Dapur/Barista vs Invoice A4 */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#1F1412] rounded-xl border border-[#4E342E] text-xs font-bold">
          <button
            onClick={() => setPrintMode('thermal_customer')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center ${
              printMode === 'thermal_customer' ? 'bg-[#D4A373] text-[#1F1412] shadow-sm font-black' : 'text-[#D4A373]/70 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Struk Kasir</span>
          </button>
          <button
            onClick={() => setPrintMode('thermal_kitchen')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center ${
              printMode === 'thermal_kitchen' ? 'bg-amber-600 text-white shadow-sm font-black' : 'text-[#D4A373]/70 hover:text-white'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Tiket Dapur</span>
          </button>
          <button
            onClick={() => setPrintMode('a4pdf')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center ${
              printMode === 'a4pdf' ? 'bg-[#D4A373] text-[#1F1412] shadow-sm font-black' : 'text-[#D4A373]/70 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Nota A4</span>
          </button>
        </div>

        {/* Paper Size & Logo Controls (for Thermal Mode) */}
        {printMode !== 'a4pdf' && (
          <div className="flex flex-col gap-2 text-xs bg-[#1F1412] p-2.5 rounded-xl border border-[#4E342E]">
            <div className="flex items-center justify-between">
              <span className="text-[#D4A373] font-medium">Ukuran Kertas Thermal:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPaperWidth('58mm')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    paperWidth === '58mm' ? 'bg-[#D4A373] text-[#1F1412]' : 'bg-[#3E2723] text-white hover:bg-[#4E342E]'
                  }`}
                >
                  58 mm
                </button>
                <button
                  onClick={() => setPaperWidth('80mm')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    paperWidth === '80mm' ? 'bg-[#D4A373] text-[#1F1412]' : 'bg-[#3E2723] text-white hover:bg-[#4E342E]'
                  }`}
                >
                  80 mm
                </button>
              </div>
            </div>

            {printMode === 'thermal_customer' && (
              <div className="flex items-center justify-between pt-2 border-t border-[#3E2723]">
                <span className="text-[#D4A373] font-medium">Logo Struk Atas:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLogoSize('small')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      logoSize === 'small' ? 'bg-[#D4A373] text-[#1F1412]' : 'bg-[#3E2723] text-white hover:bg-[#4E342E]'
                    }`}
                    title="Ukuran Logo Kecil (44px)"
                  >
                    Kecil
                  </button>
                  <button
                    onClick={() => setLogoSize('medium')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      logoSize === 'medium' ? 'bg-[#D4A373] text-[#1F1412]' : 'bg-[#3E2723] text-white hover:bg-[#4E342E]'
                    }`}
                    title="Ukuran Logo Sedang (64px)"
                  >
                    Sedang
                  </button>
                  <button
                    onClick={() => setLogoSize('large')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      logoSize === 'large' ? 'bg-[#D4A373] text-[#1F1412]' : 'bg-[#3E2723] text-white hover:bg-[#4E342E]'
                    }`}
                    title="Ukuran Logo Besar (88px)"
                  >
                    Besar
                  </button>
                  <button
                    onClick={() => setLogoSize('none')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      logoSize === 'none' ? 'bg-[#D4A373] text-[#1F1412]' : 'bg-[#3E2723] text-white hover:bg-[#4E342E]'
                    }`}
                    title="Sembunyikan Logo"
                  >
                    Sembunyi
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview Container */}
        {printMode !== 'a4pdf' ? (
          <div className="flex justify-center my-2">
            <div
              id="thermal-receipt-container"
              className={`bg-[#FAF8F5] text-black font-mono p-4 rounded-t-sm shadow-inner overflow-hidden transition-all text-xs leading-relaxed ${
                printMode === 'thermal_kitchen' ? 'border-t-4 border-amber-600' : 'border-t-4 border-[#3E2723]'
              } ${paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'}`}
              style={{
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                backgroundImage: 'radial-gradient(#E0D5C1 1px, transparent 0)',
                backgroundSize: '8px 8px',
              }}
            >
              {/* Badge Tiket Dapur */}
              {printMode === 'thermal_kitchen' && (
                <div className="bg-amber-100 border border-amber-300 text-amber-950 p-2 rounded-lg text-center mb-2 font-sans font-bold">
                  <div className="text-[10px] uppercase tracking-wider">Tiket Khusus Barista & Dapur</div>
                  <div className="text-sm font-black text-amber-900 mt-0.5">
                    Antrian #{tx.queueNo || '-'}
                  </div>
                </div>
              )}

              {/* Logo Cafe di Paling Atas Struk (Customer Mode only) */}
              {printMode === 'thermal_customer' && settings.logoUrl && logoSize !== 'none' && (
                <div className="flex justify-center mb-2 pb-2 border-b border-dashed border-gray-400">
                  <img
                    src={settings.logoUrl}
                    alt="Logo Cafe"
                    style={{
                      height: getLogoHeight(),
                      maxWidth: '85%',
                      objectFit: 'contain',
                      filter: 'contrast(130%) grayscale(100%)',
                    }}
                    className="mx-auto block"
                  />
                </div>
              )}

              {/* Thermal Print Text Rendering */}
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-tight select-all text-black">
                {currentReceiptText}
              </pre>

              {/* Simulated Zigzag Paper Cut Edge */}
              <div className="mt-4 border-t border-dashed border-gray-400 pt-2 text-center text-[10px] text-gray-500 font-mono">
                [--- POTONG KERTAS DI SINI ---]
              </div>
            </div>
          </div>
        ) : (
          /* A4 PDF Invoice Preview */
          <div className="flex justify-center my-2">
            <div
              id="thermal-receipt-container"
              className="bg-white text-black p-6 rounded-lg shadow-lg border border-gray-300 w-full font-sans text-xs space-y-4"
            >
              {/* Header Invoice */}
              {(() => {
                const outletInfo = resolveOutletInfo(tx, settings);
                return (
                  <div className="flex justify-between items-start border-b-2 border-[#3E2723] pb-3">
                    <div className="flex items-center gap-3">
                      {settings.logoUrl && (
                        <img src={settings.logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                      )}
                      <div>
                        <h2 className="font-serif font-bold text-lg text-[#3E2723] uppercase">{settings.storeName}</h2>
                        {outletInfo.name && (
                          <div className="font-bold text-xs text-amber-900">{outletInfo.name.toUpperCase()}</div>
                        )}
                        <p className="text-[10px] text-gray-600">
                          {outletInfo.address} {outletInfo.phone && outletInfo.phone !== '-' ? `• Telp/WA: ${outletInfo.phone}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm bg-[#3E2723] text-white px-2.5 py-1 rounded-sm uppercase tracking-wider">
                        NOTA / INVOICE
                      </span>
                      {tx.queueNo && (
                        <div className="font-mono font-black text-xs text-amber-800 mt-1">
                          Antrian: {tx.queueNo}
                        </div>
                      )}
                      <div className="font-bold text-xs mt-0.5">No: {tx.invoiceNo}</div>
                      <div className="text-[10px] text-gray-500">{formatDateTime(tx.timestamp)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Info Pelanggan & Kasir */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-2.5 rounded-md text-[11px]">
                <div>
                  <div><strong className="text-gray-600">Kasir:</strong> {tx.cashierName}</div>
                  <div><strong className="text-gray-600">Pelanggan:</strong> {tx.customerName || 'Umum'}</div>
                </div>
                <div>
                  <div><strong className="text-gray-600">Meja / Tipe:</strong> {tx.tableNo || tx.orderType || '-'}</div>
                  <div><strong className="text-gray-600">Metode Bayar:</strong> {tx.paymentMethod.toUpperCase()}</div>
                </div>
              </div>

              {/* Rincian Item */}
              <table className="w-full text-left text-xs border border-gray-200">
                <thead className="bg-[#F5EBE0] font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-2">Item Menu</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Harga</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tx.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <div className="font-bold">{item.productName}</div>
                        {(item.selectedCup || item.selectedIce || item.variantName) && (
                          <div className="text-[10px] text-gray-600 flex gap-1 flex-wrap mt-0.5">
                            {item.selectedCup && <span className="bg-gray-100 px-1 rounded border border-gray-300 font-semibold">Cup {item.selectedCup}</span>}
                            {item.selectedIce && <span className="bg-cyan-50 text-cyan-800 px-1 rounded border border-cyan-200 font-semibold">{item.selectedIce}</span>}
                            {item.variantName && !item.variantName.includes(item.selectedCup || '') && (
                              <span className="text-gray-500">Varian: {item.variantName}</span>
                            )}
                          </div>
                        )}
                        {item.notes && <div className="text-[10px] italic text-gray-500 mt-0.5">Catatan: {item.notes}</div>}
                      </td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">{formatRp(item.unitPrice)}</td>
                      <td className="p-2 text-right font-bold">{formatRp(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Ringkasan Pembayaran */}
              <div className="flex justify-end pt-2 border-t">
                <div className="w-56 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>{formatRp(tx.subtotal)}</span>
                  </div>
                  {tx.discount > 0 && (
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>Diskon:</span>
                      <span>-{formatRp(tx.discount)}</span>
                    </div>
                  )}
                  {tx.tax > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>PPN:</span>
                      <span>{formatRp(tx.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm text-[#3E2723] pt-1 border-t border-gray-300">
                    <span>TOTAL BAYAR:</span>
                    <span>{formatRp(tx.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>Uang Diterima:</span>
                    <span>{formatRp(tx.cashAmountPaid || tx.total)}</span>
                  </div>
                  {tx.changeAmount && tx.changeAmount > 0 ? (
                    <div className="flex justify-between text-[11px] text-emerald-700 font-bold">
                      <span>Kembalian:</span>
                      <span>{formatRp(tx.changeAmount)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Tanda Terima / Footer */}
              <div className="pt-4 flex justify-between items-end border-t border-dashed border-gray-300 text-[10px] text-gray-500">
                <div className="text-center">
                  <p>Hormat Kami,</p>
                  <div className="h-10" />
                  <p className="font-bold text-gray-800">{settings.storeName}</p>
                </div>
                <div className="italic text-center">
                  <p>Terima kasih atas kunjungan Anda!</p>
                  <p>{settings.receiptFooter || 'Semoga hari Anda menyenangkan!'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Phone Target Section (Always Accessible) */}
        <div className="bg-[#1F1412] p-3 rounded-xl border border-[#4E342E] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <label className="text-xs font-bold text-[#D4A373] flex items-center gap-1.5 shrink-0">
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              No. WhatsApp Tujuan:
            </label>
            <div className="flex items-center gap-1">
              {tx.customerPhone && (
                <button
                  type="button"
                  onClick={() => setTargetPhone(tx.customerPhone || '')}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#3E2723] hover:bg-[#4E342E] text-amber-200 border border-[#4E342E]"
                >
                  Pelanggan ({tx.customerPhone})
                </button>
              )}
              {settings.phone && (
                <button
                  type="button"
                  onClick={() => setTargetPhone(settings.phone || '')}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#3E2723] hover:bg-[#4E342E] text-amber-200 border border-[#4E342E]"
                >
                  Toko / Barista ({settings.phone})
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="tel"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx"
                className="w-full bg-[#2B1713] border border-[#4E342E] rounded-lg px-3 py-2 text-xs text-[#FAF3DD] focus:outline-none focus:border-[#25D366] font-mono"
              />
            </div>
            {cleanTargetPhone && (
              <span className="text-[10px] text-emerald-400 font-mono shrink-0 hidden sm:inline">
                +{cleanTargetPhone}
              </span>
            )}
          </div>
        </div>

        </div>

        {/* Sticky Action Footer (Fixed Bottom, Never Cut Off) */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#1F1412] border-t border-[#4E342E] shrink-0 space-y-2 shadow-2xl">
          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 1. Kirim WA Langsung */}
            <button
              onClick={handleSendWhatsAppDirect}
              className="py-2.5 px-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Buka WhatsApp langsung dan kirim struk / tiket ke nomor tujuan"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">Kirim ke WA</span>
            </button>

            {/* 2. Share Foto Struk */}
            <button
              onClick={handleShareWhatsAppImage}
              disabled={isExportingJPG}
              className="py-2.5 px-2 rounded-xl bg-[#1F8A4C] hover:bg-[#197540] disabled:opacity-50 text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Bagikan foto struk langsung ke aplikasi WhatsApp atau kontak di HP"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span className="truncate">{isExportingJPG ? 'Memproses...' : 'Share Foto'}</span>
            </button>

            {/* 3. Unduh Gambar ke HP */}
            <button
              onClick={handleDownloadJPG}
              disabled={isExportingJPG}
              className="py-2.5 px-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-xs font-bold text-[#FAF3DD] border border-[#4E342E] shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Simpan gambar struk / tiket ke memori HP"
            >
              <Download className="w-4 h-4 text-[#D4A373] shrink-0" />
              <span className="truncate">{isExportingJPG ? 'Menyimpan...' : 'Simpan di HP'}</span>
            </button>

            {/* 4. Cetak Thermal */}
            <button
              onClick={() => handlePrint('current')}
              className={`py-2.5 px-2 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                printMode === 'thermal_kitchen'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-[#D4A373] hover:bg-[#c39262] text-[#1F1412]'
              }`}
              title={`Cetak ${printMode === 'thermal_kitchen' ? 'tiket dapur' : 'struk kasir'} ke printer thermal`}
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {printMode === 'thermal_kitchen' ? 'Cetak Tiket Dapur' : 'Cetak Thermal'}
              </span>
            </button>
          </div>

          {/* Quick Dual Print, Cash Drawer & Close Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={() => handlePrint('both')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A373] to-amber-600 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-sm hover:brightness-110 cursor-pointer active:scale-95"
              title="Cetak Struk Kasir lalu otomatis cetak Tiket Dapur berturut-turut"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>⚡ Cetak Struk + Tiket Dapur</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCashDrawerManual}
                disabled={isOpeningDrawer}
                className="px-2.5 py-1.5 rounded-xl bg-[#2B1713] hover:bg-[#3E2723] border border-[#4E342E] text-amber-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Kirim sinyal pulse RJ11 untuk membuka laci uang kasir (Cash Drawer)"
              >
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>{isOpeningDrawer ? 'Membuka...' : 'Laci'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Selesai</span>
              </button>
            </div>
          </div>

          {/* Secondary Utility Controls */}
          <div className="flex items-center justify-between text-[11px] pt-1 text-gray-400 border-t border-[#3E2723]/60">
            <button
              onClick={handleCopyText}
              className="hover:text-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-[#D4A373]" />}
              <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
            </button>

            <button
              onClick={handlePrintPDF}
              className="hover:text-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-[#D4A373]" />
              <span>Simpan Dokumen PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


