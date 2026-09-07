import React, { useState } from 'react';
import { Shift, StoreSettings } from '../types';
import {
  formatThermalShiftSummary,
  captureElementToCanvas,
  openWhatsApp,
  shareOrDownloadReceiptImage,
  buildShiftWhatsAppText,
  downloadCanvasImageToDevice,
  sanitizePhoneForWA,
} from '../utils/formatters';
import { printReceiptThermal } from '../services/thermalPrinterService';
import {
  Printer,
  X,
  Check,
  Copy,
  Download,
  CheckCircle,
  Image,
  MessageCircle,
  Share2,
} from 'lucide-react';

interface ThermalShiftModalProps {
  shift: Shift;
  settings: StoreSettings;
  onClose: () => void;
}

export const ThermalShiftModal: React.FC<ThermalShiftModalProps> = ({ shift, settings, onClose }) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(settings.printerPaperSize || '58mm');
  const [logoSize, setLogoSize] = useState<'small' | 'medium' | 'large' | 'none'>(
    settings.receiptLogoSize || 'medium'
  );
  const [copied, setCopied] = useState(false);
  const [pdfTip, setPdfTip] = useState(false);
  const [isExportingJPG, setIsExportingJPG] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [targetPhone, setTargetPhone] = useState(settings.phone || '');

  const receiptText = formatThermalShiftSummary(shift, { ...settings, printerPaperSize: paperWidth });

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

  const handlePrint = async () => {
    await printReceiptThermal(receiptText, settings);
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
    const element = document.getElementById('thermal-shift-container');
    if (!element) return;

    setIsExportingJPG(true);
    try {
      const canvas = await captureElementToCanvas(element);
      const fileName = `Rekap-Shift-${shift.cashierName.replace(/\s+/g, '_')}.jpg`;
      const ok = await downloadCanvasImageToDevice(canvas, fileName);
      if (ok) {
        setSaveSuccessMsg('Rekap Shift berhasil disimpan di Memori HP (Folder Download / Galeri)');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Error downloading shift JPG:', err);
    } finally {
      setIsExportingJPG(false);
    }
  };

  const handleSendWhatsAppDirect = () => {
    const waText = buildShiftWhatsAppText(shift, settings);
    openWhatsApp(targetPhone || settings.phone, waText);
  };

  const handleShareWhatsAppImage = async () => {
    const element = document.getElementById('thermal-shift-container');
    if (!element) {
      handleSendWhatsAppDirect();
      return;
    }

    setIsExportingJPG(true);
    try {
      const canvas = await captureElementToCanvas(element);
      const waText = buildShiftWhatsAppText(shift, settings);
      await shareOrDownloadReceiptImage({
        canvas,
        fileName: `Rekap-Shift-${shift.cashierName.replace(/\s+/g, '_')}.jpg`,
        phone: targetPhone || settings.phone,
        text: waText,
      });
      setSaveSuccessMsg('Rekap shift dikirim ke WhatsApp / Tersimpan di HP');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error sharing shift:', err);
    } finally {
      setIsExportingJPG(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanTargetPhone = sanitizePhoneForWA(targetPhone);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#2B1713] rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-[#4E342E] text-[#F5EBE0] space-y-3.5 my-auto max-h-[95vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#4E342E] pb-3">
          <div>
            <h3 className="font-bold text-base text-[#FAF3DD] flex items-center gap-2">
              <Printer className="w-5 h-5 text-[#D4A373]" /> Struk Rekap Shift Kasir
            </h3>
            <p className="text-xs text-[#D4A373]/80">Bukti Fisik & Laporan Setoran Kasir ke Admin</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

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

        {/* Paper Size & Logo Controls */}
        <div className="flex flex-col gap-2 text-xs bg-[#1F1412] p-2.5 rounded-xl border border-[#4E342E]">
          <div className="flex items-center justify-between">
            <span className="text-[#D4A373] font-medium">Ukuran Kertas:</span>
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
        </div>

        {/* Visual Receipt Paper Preview Container */}
        <div className="flex justify-center my-2">
          <div
            id="thermal-shift-container"
            className={`bg-[#FAF8F5] text-black font-mono p-4 rounded-t-sm shadow-inner overflow-hidden border-t-4 border-[#3E2723] transition-all text-xs leading-relaxed ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
            style={{
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              backgroundImage: 'radial-gradient(#E0D5C1 1px, transparent 0)',
              backgroundSize: '8px 8px',
            }}
          >
            {/* Logo Cafe di Paling Atas Struk */}
            {settings.logoUrl && logoSize !== 'none' && (
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
              {receiptText}
            </pre>

            {/* Simulated Zigzag Paper Cut Edge */}
            <div className="mt-4 border-t border-dashed border-gray-400 pt-2 text-center text-[10px] text-gray-500 font-mono">
              [--- BUKTI FISIK SERAH TERIMA SHIFT ---]
            </div>
          </div>
        </div>

        {/* WhatsApp Target Phone Input */}
        <div className="bg-[#1F1412] p-3 rounded-xl border border-[#4E342E] space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#D4A373] flex items-center gap-1.5 shrink-0">
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              No. WA Admin / Owner:
            </label>
            {settings.phone && (
              <button
                type="button"
                onClick={() => setTargetPhone(settings.phone || '')}
                className="text-[10px] px-2 py-0.5 rounded bg-[#3E2723] hover:bg-[#4E342E] text-amber-200 border border-[#4E342E]"
              >
                No. Toko ({settings.phone})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx"
              className="w-full bg-[#2B1713] border border-[#4E342E] rounded-lg px-3 py-2 text-xs text-[#FAF3DD] focus:outline-none focus:border-[#25D366] font-mono"
            />
            {cleanTargetPhone && (
              <span className="text-[10px] text-emerald-400 font-mono shrink-0 hidden sm:inline">
                +{cleanTargetPhone}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#4E342E]">
          {/* 1. Kirim WA Langsung */}
          <button
            onClick={handleSendWhatsAppDirect}
            className="py-2.5 px-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5"
            title="Kirim laporan shift ke WhatsApp Admin / Owner"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Kirim ke WA</span>
          </button>

          {/* 2. Share Foto Struk */}
          <button
            onClick={handleShareWhatsAppImage}
            disabled={isExportingJPG}
            className="py-2.5 px-2 rounded-xl bg-[#1F8A4C] hover:bg-[#197540] disabled:opacity-50 text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5"
            title="Bagikan foto struk shift langsung ke WhatsApp atau aplikasi lain"
          >
            <Share2 className="w-4 h-4 shrink-0" />
            <span className="truncate">{isExportingJPG ? 'Proses...' : 'Share Foto'}</span>
          </button>

          {/* 3. Simpan di HP */}
          <button
            onClick={handleDownloadJPG}
            disabled={isExportingJPG}
            className="py-2.5 px-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-xs font-bold text-[#FAF3DD] border border-[#4E342E] shadow-md transition-all flex items-center justify-center gap-1.5"
            title="Simpan gambar rekap shift JPG ke memori / galeri HP"
          >
            <Download className="w-4 h-4 text-[#D4A373] shrink-0" />
            <span className="truncate">{isExportingJPG ? 'Menyimpan...' : 'Simpan di HP'}</span>
          </button>

          {/* 4. Cetak Thermal */}
          <button
            onClick={handlePrint}
            className="py-2.5 px-2 rounded-xl bg-[#D4A373] hover:bg-[#c39262] text-xs font-bold text-[#1F1412] shadow-md transition-all flex items-center justify-center gap-1.5"
            title="Cetak struk rekap shift ke printer thermal"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span className="truncate">Cetak Thermal</span>
          </button>
        </div>

        {/* Secondary Utility Controls */}
        <div className="flex items-center justify-between text-xs pt-1 text-gray-400">
          <button
            onClick={handleCopyText}
            className="hover:text-amber-200 flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#D4A373]" />}
            <span>{copied ? 'Teks Tersalin!' : 'Salin Teks Shift'}</span>
          </button>

          <button
            onClick={handlePrintPDF}
            className="hover:text-amber-200 flex items-center gap-1 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Dialog Print / Simpan PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};


