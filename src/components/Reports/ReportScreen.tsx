import React, { useState, useEffect } from 'react';
import { Transaction, Expense, StoreSettings, Shift, User, Outlet } from '../../types';
import { StorageService } from '../../services/storage';
import { ThermalShiftModal } from '../ThermalShiftModal';
import { formatRp, formatDate, formatDateTime, exportToCSV, openWhatsApp, captureElementToCanvas, getPaymentMethodLabel } from '../../utils/formatters';
import { FileText, Download, Printer, Calendar, DollarSign, Users, X, ShoppingBag, Receipt, PieChart, Lock, Unlock, Clock, Trash2, Image, UploadCloud, ShieldCheck, CheckCircle, FileJson, Database, RefreshCw, AlertCircle, MessageCircle, FileSpreadsheet, Bike, Building2 } from 'lucide-react';
import { GoogleSheetsSyncModal } from '../GoogleSheets/GoogleSheetsSyncModal';
import { DailyRecapModal } from './DailyRecapModal';

interface ReportScreenProps {
  transactions: Transaction[];
  expenses: Expense[];
  settings: StoreSettings;
  user?: User;
  outlets?: Outlet[];
  activeOutlet?: Outlet;
  onOpenReceipt: (tx: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onDeleteShift?: (id: string) => void;
  onDeleteExpense?: (id: string) => void;
  onResetData?: () => void;
  onResetOperationalAndReports?: () => void;
  onRestoreBackup?: (jsonString: string) => boolean;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  transactions,
  expenses,
  settings,
  user,
  outlets = [],
  activeOutlet,
  onOpenReceipt,
  onDeleteTransaction,
  onDeleteShift,
  onDeleteExpense,
  onResetData,
  onResetOperationalAndReports,
  onRestoreBackup,
}) => {
  const currentUser = user || StorageService.getCurrentUser();
  const isAdmin = currentUser.role === 'admin';

  const cashierAssignedOutletId =
    currentUser.role === 'kasir'
      ? currentUser.assignedOutletId ||
        currentUser.outletId ||
        activeOutlet?.id ||
        (outlets.length > 0 ? outlets[0].id : 'ALL')
      : 'ALL';

  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(cashierAssignedOutletId);
  
  // Custom date range state (from date to date)
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const [startDate, setStartDate] = useState<string>(startOfMonthStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false);
  const [isDailyRecapModalOpen, setIsDailyRecapModalOpen] = useState(false);
  const [selectedShiftForThermal, setSelectedShiftForThermal] = useState<Shift | null>(null);
  const [isExportingJPG, setIsExportingJPG] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);

  // Helper for formatted period text and slug
  const getPeriodDisplay = () => {
    if (reportType === 'daily') return formatDate(selectedDate);
    if (reportType === 'monthly') {
      const [y, m] = selectedDate.split('-');
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const mIdx = parseInt(m, 10) - 1;
      return `${monthNames[mIdx] || m} ${y}`;
    }
    if (reportType === 'yearly') return `Tahun ${selectedDate}`;
    return `${formatDate(startDate)} s/d ${formatDate(endDate)}`;
  };

  const getPeriodSlug = () => {
    if (reportType === 'daily') return selectedDate;
    if (reportType === 'monthly') return selectedDate;
    if (reportType === 'yearly') return selectedDate;
    return `${startDate}_sd_${endDate}`;
  };

  // Presets for custom date range
  const applyDatePreset = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const d = toYMD(now);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = toYMD(y);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'last7') {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      setStartDate(toYMD(s));
      setEndDate(toYMD(now));
    } else if (preset === 'last30') {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      setStartDate(toYMD(s));
      setEndDate(toYMD(now));
    } else if (preset === 'thisMonth') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toYMD(s));
      setEndDate(toYMD(e));
    } else if (preset === 'lastMonth') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(toYMD(s));
      setEndDate(toYMD(e));
    }
  };

  // Restore Modal State (Admin Only)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreJsonText, setRestoreJsonText] = useState('');
  const [parsedBackup, setParsedBackup] = useState<any>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreTab, setRestoreTab] = useState<'upload' | 'text'>('upload');

  const handleDownloadReportJPG = async () => {
    const element = document.getElementById('printable-report-container');
    if (!element) return;

    setIsExportingJPG(true);
    try {
      const canvas = await captureElementToCanvas(element);
      const image = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = image;
      link.download = `Laporan-Keuangan-${getPeriodSlug()}.jpg`;
      link.click();
    } catch (err) {
      console.error('Error exporting report JPG:', err);
    } finally {
      setIsExportingJPG(false);
    }
  };

  const handleDownloadBackupJSON = () => {
    StorageService.exportBackupJSON();
  };

  const handleRestoreFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setRestoreJsonText(content);
        const obj = JSON.parse(content);
        if (obj.products || obj.transactions || obj.ingredients || obj.settings) {
          setParsedBackup(obj);
        } else {
          setRestoreError('File JSON tidak berisi struktur data backup POS yang valid.');
          setParsedBackup(null);
        }
      } catch (err) {
        setRestoreError('Format file bukan JSON yang valid.');
        setParsedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreTextChange = (text: string) => {
    setRestoreJsonText(text);
    setRestoreError(null);
    if (!text.trim()) {
      setParsedBackup(null);
      return;
    }
    try {
      const obj = JSON.parse(text);
      if (obj.products || obj.transactions || obj.ingredients || obj.settings) {
        setParsedBackup(obj);
      } else {
        setRestoreError('Struktur JSON tidak valid untuk data backup POS.');
        setParsedBackup(null);
      }
    } catch (err) {
      setRestoreError('Format teks JSON tidak valid.');
      setParsedBackup(null);
    }
  };

  const handleExecuteRestore = () => {
    if (!restoreJsonText.trim()) {
      alert('Pilih file backup (.json) atau tempel teks JSON terlebih dahulu.');
      return;
    }

    if (!confirm('Peringatan Admin: Apakah Anda yakin ingin memulihkan (Restore) seluruh data sistem dari file backup ini? Data lama di sistem akan diperbarui.')) {
      return;
    }

    const success = onRestoreBackup ? onRestoreBackup(restoreJsonText) : StorageService.restoreBackupJSON(restoreJsonText);
    if (success) {
      setRestoreSuccess(true);
      setTimeout(() => {
        setIsRestoreModalOpen(false);
        setRestoreSuccess(false);
        setRestoreJsonText('');
        setParsedBackup(null);
        if (onResetData) {
          onResetData();
        } else {
          window.location.reload();
        }
      }, 1500);
    } else {
      setRestoreError('Gagal memulihkan backup. Pastikan file JSON sesuai format backup POS.');
    }
  };

  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [selectedCashierFilter, setSelectedCashierFilter] = useState<string>(
    isAdmin ? 'ALL' : currentUser.name
  );

  useEffect(() => {
    setAllShifts(StorageService.getShifts());
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedCashierFilter(currentUser.name);
    }
  }, [currentUser.name, isAdmin]);

  // Available cashier names for filter dropdown (for Admin)
  const availableCashierNames = Array.from(
    new Set([
      ...transactions.map((t) => t.cashierName || 'Kasir Default'),
      ...allShifts.map((s) => s.cashierName),
      currentUser.name,
    ])
  ).filter(Boolean);

  // Filter transactions by period and outlet
  const periodTxs = transactions.filter((tx) => {
    if (tx.status === 'voided') return false;
    if (selectedOutletFilter !== 'ALL' && tx.outletId && tx.outletId !== selectedOutletFilter) {
      return false;
    }
    const txDate = new Date(tx.timestamp);
    const txDateStr = tx.timestamp.split('T')[0];
    if (reportType === 'daily') {
      return tx.timestamp.startsWith(selectedDate);
    } else if (reportType === 'monthly') {
      const [year, month] = selectedDate.split('-');
      return txDate.getFullYear() === parseInt(year) && txDate.getMonth() + 1 === parseInt(month);
    } else if (reportType === 'yearly') {
      const year = selectedDate.split('-')[0];
      return txDate.getFullYear() === parseInt(year);
    } else if (reportType === 'custom') {
      if (!startDate && !endDate) return true;
      if (startDate && txDateStr < startDate) return false;
      if (endDate && txDateStr > endDate) return false;
      return true;
    }
    return true;
  });

  // Filter transactions by selected cashier account (Kasir role is fixed to currentUser.name)
  const filteredTxs = periodTxs.filter((tx) => {
    if (selectedCashierFilter === 'ALL') return true;
    const name = tx.cashierName || 'Kasir Default';
    return name.trim().toLowerCase() === selectedCashierFilter.trim().toLowerCase();
  });

  // Filter expenses for the period and outlet
  const filteredExpenses = expenses.filter((e) => {
    if (selectedOutletFilter !== 'ALL' && e.outletId && e.outletId !== selectedOutletFilter) {
      return false;
    }
    if (reportType === 'daily') return e.date === selectedDate;
    if (reportType === 'monthly') return e.date.startsWith(selectedDate.substring(0, 7));
    if (reportType === 'yearly') return e.date.startsWith(selectedDate.substring(0, 4));
    if (reportType === 'custom') {
      if (!startDate && !endDate) return true;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    }
    return false;
  });

  // Financial calculations
  const grossSales = filteredTxs.reduce((acc, t) => acc + t.subtotal, 0);
  const totalDiscount = filteredTxs.reduce((acc, t) => acc + t.discount, 0);
  const netSales = filteredTxs.reduce((acc, t) => acc + t.total, 0);
  const totalHpp = filteredTxs.reduce((acc, t) => acc + t.totalCogs, 0);
  const grossProfit = netSales - totalHpp;

  // Total expenses
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  const netProfit = grossProfit - totalExpenses;
  const marginPct = netSales > 0 ? ((netProfit / netSales) * 100).toFixed(1) : '0';

  // Payment Breakdown
  const cashSales = filteredTxs.filter((t) => t.paymentMethod === 'cash').reduce((acc, t) => acc + t.total, 0);
  const qrisSales = filteredTxs.filter((t) => t.paymentMethod === 'qris').reduce((acc, t) => acc + t.total, 0);
  const debitSales = filteredTxs.filter((t) => t.paymentMethod === 'debit' || t.paymentMethod === 'gopay_shopee').reduce((acc, t) => acc + t.total, 0);
  const shopeeFoodSales = filteredTxs.filter((t) => t.paymentMethod === 'shopeefood').reduce((acc, t) => acc + t.total, 0);
  const goFoodSales = filteredTxs.filter((t) => t.paymentMethod === 'gofood').reduce((acc, t) => acc + t.total, 0);
  const grabFoodSales = filteredTxs.filter((t) => t.paymentMethod === 'grabfood').reduce((acc, t) => acc + t.total, 0);
  const totalOnlineSales = shopeeFoodSales + goFoodSales + grabFoodSales;

  // Calculate breakdown per Cashier
  const cashierSummaryMap = new Map<
    string,
    {
      cashierName: string;
      txCount: number;
      grossSales: number;
      discount: number;
      netSales: number;
      totalCogs: number;
      grossProfit: number;
      cashCount: number;
      qrisCount: number;
      debitCount: number;
    }
  >();

  periodTxs.forEach((tx) => {
    const name = tx.cashierName || 'Kasir Default';
    const existing = cashierSummaryMap.get(name) || {
      cashierName: name,
      txCount: 0,
      grossSales: 0,
      discount: 0,
      netSales: 0,
      totalCogs: 0,
      grossProfit: 0,
      cashCount: 0,
      qrisCount: 0,
      debitCount: 0,
    };

    existing.txCount += 1;
    existing.grossSales += tx.subtotal;
    existing.discount += tx.discount;
    existing.netSales += tx.total;
    existing.totalCogs += tx.totalCogs;
    existing.grossProfit += tx.grossProfit;

    if (tx.paymentMethod === 'cash') existing.cashCount += 1;
    else if (tx.paymentMethod === 'qris') existing.qrisCount += 1;
    else existing.debitCount += 1;

    cashierSummaryMap.set(name, existing);
  });

  const allCashierSummaries = Array.from(cashierSummaryMap.values()).sort(
    (a, b) => b.netSales - a.netSales
  );

  // Filter cashier summaries for non-admin accounts
  const cashierSummaries = allCashierSummaries.filter((c) => {
    if (selectedCashierFilter === 'ALL') return true;
    return c.cashierName.trim().toLowerCase() === selectedCashierFilter.trim().toLowerCase();
  });

  // Filter Shift history for non-admin accounts & date period
  const visibleShifts = allShifts.filter((s) => {
    if (selectedCashierFilter !== 'ALL') {
      if (s.cashierName.trim().toLowerCase() !== selectedCashierFilter.trim().toLowerCase()) return false;
    }
    const shiftDateStr = (s.startTime || '').split('T')[0];
    if (reportType === 'daily') {
      return shiftDateStr === selectedDate;
    } else if (reportType === 'monthly') {
      return shiftDateStr.startsWith(selectedDate.substring(0, 7));
    } else if (reportType === 'yearly') {
      return shiftDateStr.startsWith(selectedDate.substring(0, 4));
    } else if (reportType === 'custom') {
      if (startDate && shiftDateStr < startDate) return false;
      if (endDate && shiftDateStr > endDate) return false;
      return true;
    }
    return true;
  });

  const [backupNotice, setBackupNotice] = useState(false);

  const handleSendWhatsAppReport = () => {
    const cashierListText = cashierSummaries.length > 0
      ? `\n\n👤 *RINCIAN KASIR*:\n` + cashierSummaries.map((c) => `• ${c.cashierName}: ${c.txCount} tx | Net: ${formatRp(c.netSales)}`).join('\n')
      : '';

    const periodLabel = reportType === 'daily' ? 'Harian' : reportType === 'monthly' ? 'Bulanan' : reportType === 'yearly' ? 'Tahunan' : 'Rentang Tanggal';
    const periodDisplay = getPeriodDisplay();

    let text = '';
    if (currentUser.role === 'admin') {
      text = `📊 *LAPORAN PENJUALAN & LABA RUGI*
🏪 *Toko*: ${settings.storeName}
📅 *Periode*: ${periodDisplay} (${periodLabel})
👤 *Akun*: ${currentUser.name} (Admin)

💵 *RINGKASAN KEUANGAN*:
• Total Transaksi: ${filteredTxs.length} transaksi
• Penjualan Kotor (Gross): ${formatRp(grossSales)}
• Total Diskon: -${formatRp(totalDiscount)}
• Penjualan Bersih (Omzet): *${formatRp(netSales)}*
• Total HPP (COGS): -${formatRp(totalHpp)}
• Laba Kotor: ${formatRp(grossProfit)}
• Total Pengeluaran: -${formatRp(totalExpenses)}
----------------------------------------
💰 *LABA BERSIH (NET PROFIT)*: *${formatRp(netProfit)}* (${marginPct}%)

💳 *METODE PEMBAYARAN*:
• Tunai (Cash): ${formatRp(cashSales)}
• QRIS: ${formatRp(qrisSales)}
• Debit / Transfer / e-Wallet: ${formatRp(debitSales)}${cashierListText}

_Laporan dikirim otomatis dari POS ${settings.storeName}_`;
    } else {
      text = `📊 *LAPORAN REKAPITULASI PENJUALAN KASIR*
🏪 *Toko*: ${settings.storeName}
📅 *Periode*: ${periodDisplay} (${periodLabel})
👤 *Akun Kasir*: ${currentUser.name}

💵 *REKAPITULASI PENJUALAN*:
• Total Transaksi Selesai: ${filteredTxs.length} nota
• Penjualan Kotor (Gross): ${formatRp(grossSales)}
• Total Diskon: -${formatRp(totalDiscount)}
• Penjualan Bersih (Omzet): *${formatRp(netSales)}*

💳 *PENERIMAAN KAS & PEMBAYARAN*:
• Kas Tunai (Cash di Laci): ${formatRp(cashSales)}
• QRIS: ${formatRp(qrisSales)}
• Debit / Transfer / Ojol: ${formatRp(debitSales)}${cashierListText}

_Rekapitulasi penjualan shift kasir ${settings.storeName}_`;
    }

    openWhatsApp(settings.phone, text);
  };

  const handleSendBackupWhatsApp = () => {
    const backupObj = StorageService.exportBackupJSON();

    const txCount = backupObj.transactions?.length || 0;
    const txTotal = (backupObj.transactions || []).reduce((sum: number, t: any) => sum + (t.grandTotal || 0), 0);
    const prodCount = backupObj.products?.length || 0;
    const ingCount = backupObj.ingredients?.length || 0;
    const expCount = backupObj.expenses?.length || 0;
    const shiftCount = backupObj.shifts?.length || 0;

    const dateStr = new Date().toISOString().split('T')[0];

    const text = `📦 *BACKUP FILE DATABASE & LAPORAN OPERASIONAL POS*
🏪 *Toko*: ${settings.storeName}
📅 *Waktu Backup*: ${new Date().toLocaleString('id-ID')}
👤 *Pengirim*: ${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Kasir'})

📊 *RINGKASAN DATABASE TERBARU*:
• Total Transaksi: ${txCount} data (${formatRp(txTotal)})
• Total Produk Menu: ${prodCount} item
• Total Stok Bahan: ${ingCount} bahan
• Total Operasional: ${expCount} pengeluaran
• Total Shift Kasir: ${shiftCount} shift

📁 *PETUNJUK RESTORE UNTUK ADMIN*:
1. File backup format .json (\`suqur_pos_backup_${dateStr}.json\`) telah otomatis TERUNDUH di HP/Komputer kasir ini.
2. Silakan LAMPIRKAN file .json tersebut ke pesan WhatsApp ini.
3. Admin dapat mengunduh file .json tersebut dan menekan tombol *"Restore File Backup (Admin)"* di menu Laporan untuk memulihkan seluruh data secara instan.

_Pesan & File Backup dikirim otomatis dari Sistem POS ${settings.storeName}_`;

    setBackupNotice(true);
    openWhatsApp(settings.phone, text);
  };

  // Export to Excel (CSV)
  const handleExportCSV = () => {
    const isAdmin = currentUser.role === 'admin';
    const headers = isAdmin
      ? ['No. Faktur', 'Waktu', 'Kasir', 'Pelanggan', 'Metode Bayar', 'Subtotal', 'Diskon', 'Total', 'HPP', 'Laba Kotor']
      : ['No. Faktur', 'Waktu', 'Kasir', 'Pelanggan', 'Metode Bayar', 'Subtotal', 'Diskon', 'Total'];

    const rows = filteredTxs.map((t) => {
      const baseRow = [
        t.invoiceNo,
        t.timestamp,
        t.cashierName,
        t.customerName || '-',
        t.paymentMethod,
        t.subtotal,
        t.discount,
        t.total,
      ];
      if (isAdmin) {
        baseRow.push(t.totalCogs, t.grossProfit);
      }
      return baseRow;
    });

    exportToCSV(`Laporan_Penjualan_${settings.storeName.replace(/\s+/g, '_')}_${getPeriodSlug()}`, headers, rows);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-gradient-to-r from-[#3E2723] to-[#2B1713] p-5 rounded-2xl text-[#F5EBE0] shadow-xl border border-[#4E342E]">
        <div>
          <h2 className="text-xl font-bold text-[#FAF3DD] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#D4A373]" /> Laporan Keuangan & Laba Rugi
          </h2>
          <p className="text-xs text-[#D4A373] mt-0.5">
            Laporan harian, bulanan & tahunan lengkap dengan audit HPP, omzet & laba bersih
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser.role === 'kasir' ? (
            <>
              <button
                onClick={handleSendBackupWhatsApp}
                className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md border border-blue-400/40"
                title="Unduh file backup .json dan kirim instruksi restore ke WhatsApp Pemilik"
              >
                <UploadCloud className="w-4 h-4 text-blue-200" /> Kirim Backup ke WhatsApp
              </button>

              <button
                onClick={handleSendWhatsAppReport}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md border border-emerald-500/50"
                title="Kirim ringkasan laporan keuangan via WhatsApp ke pemilik"
              >
                <MessageCircle className="w-4 h-4 text-emerald-200" /> Kirim Laporan ke WA
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsRestoreModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md border border-amber-400/50"
                title="Akses Admin: Restore / Pulihkan data dari file backup (.json)"
              >
                <ShieldCheck className="w-4 h-4 text-amber-200" /> Restore Backup (Admin)
              </button>

              <button
                onClick={handleDownloadBackupJSON}
                className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md border border-blue-400/40"
                title="Unduh file backup database (.json)"
              >
                <UploadCloud className="w-4 h-4 text-blue-200" /> Backup Database (.JSON)
              </button>
            </>
          )}

          <button
            onClick={() => setIsDailyRecapModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-[#1F1412] transition-all flex items-center gap-1.5 shadow-md border border-amber-400 cursor-pointer"
            title="Rekap Harian: Kas Keluar/Masuk, Penggunaan Bahan Baku, Laba Rugi, Log Aktivitas & Cetak PDF"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1F1412]" /> Rekap Harian & Cetak PDF
          </button>

          <button
            onClick={() => setIsSheetsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-md"
            title="Ekspor & Sinkronkan Laporan ke Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" /> Ekspor Google Sheets
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-xs font-bold text-[#F5EBE0] border border-[#4E342E] transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4 text-[#D4A373]" /> Ekspor CSV
          </button>
          <button
            onClick={() => setIsPDFPreviewOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#D4A373] hover:bg-[#c39262] text-xs font-bold text-[#1F1412] transition-all flex items-center gap-1.5 shadow-md"
          >
            <Printer className="w-4 h-4" /> Preview PDF
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Yakin ingin menghapus seluruh pencatatan operasional (pengeluaran, PO, supplier) dan laporan transaksi menjadi Rp 0 untuk keseimbangan periode 1 bulan?'
                  )
                ) {
                  if (onResetOperationalAndReports) {
                    onResetOperationalAndReports();
                  } else if (onResetData) {
                    onResetData();
                  }
                  setReportType('monthly');
                  setResetNotice(
                    '✓ Seluruh pencatatan operasional & laporan telah berhasil dikosongkan (Rp 0). Laporan periode 1 bulan (Bulanan) kini seimbang di Rp 0.'
                  );
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-400/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
              title="Kosongkan operasional & laporan transaksi menjadi 0 untuk balance periode 1 bulan"
            >
              <Trash2 className="w-4 h-4 text-white" /> Hapus Operasional & Laporan (Rp 0)
            </button>
          )}
        </div>
      </div>

      {/* Reset Notice Banner */}
      {resetNotice && (
        <div className="bg-emerald-950 text-emerald-200 p-4 rounded-2xl border border-emerald-500/50 shadow-lg text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-100">Pencatatan Operasional & Laporan Berhasil Direset!</p>
              <p className="text-emerald-300/90 mt-0.5">{resetNotice}</p>
            </div>
          </div>
          <button onClick={() => setResetNotice(null)} className="text-emerald-300 hover:text-white font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {/* Backup Notice Banner */}
      {backupNotice && (
        <div className="bg-emerald-950 text-emerald-200 p-4 rounded-2xl border border-emerald-500/50 shadow-lg text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-100">File Backup (.JSON) Telah Diunduh & WhatsApp Dibuka!</p>
              <p className="text-emerald-300/90 mt-0.5">
                File backup <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-emerald-200">suqur_pos_backup_....json</span> sudah tersimpan di perangkat ini. Silakan lampirkan file .json tersebut ke ruang chat WhatsApp pemilik.
              </p>
            </div>
          </div>
          <button onClick={() => setBackupNotice(false)} className="text-emerald-300 hover:text-white font-bold p-1">✕</button>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Period Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-[#F5EBE0] p-1 rounded-xl w-full lg:w-auto">
            <button
              onClick={() => setReportType('daily')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'daily' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-sm' : 'text-[#8D6E63] hover:text-[#3E2723]'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'monthly' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-sm' : 'text-[#8D6E63] hover:text-[#3E2723]'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setReportType('yearly')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reportType === 'yearly' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-sm' : 'text-[#8D6E63] hover:text-[#3E2723]'
              }`}
            >
              Tahunan
            </button>
            <button
              onClick={() => setReportType('custom')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                reportType === 'custom' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-sm' : 'text-[#8D6E63] hover:text-[#3E2723]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Rentang Tanggal
            </button>
          </div>

          {/* Outlet & Cashier Filter Group */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Branch / Outlet Filter */}
            {outlets.length > 0 && (
              isAdmin ? (
                <div className="flex items-center gap-1.5 bg-[#FDFBF7] px-3 py-1.5 rounded-xl border border-[#E6D5C3] w-full sm:w-auto">
                  <Building2 className="w-4 h-4 text-[#8D6E63] shrink-0" />
                  <select
                    value={selectedOutletFilter}
                    onChange={(e) => setSelectedOutletFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#2B1713] focus:outline-hidden cursor-pointer"
                    title="Filter laporan berdasarkan cabang"
                  >
                    <option value="ALL">🏢 Semua Cabang (Gabungan)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        📍 {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#F5EBE0] px-3 py-1.5 rounded-xl border border-[#E6D5C3] text-xs font-bold text-[#3E2723]">
                  <Building2 className="w-3.5 h-3.5 text-[#8D6E63] shrink-0" />
                  <span>Cabang: <strong>{activeOutlet?.name || outlets.find((o) => o.id === cashierAssignedOutletId)?.name || 'Cabang Kasir'}</strong></span>
                </div>
              )
            )}

            {/* Account Filter (Admin vs Kasir) */}
            {isAdmin ? (
              <div className="flex items-center gap-1.5 bg-[#FDFBF7] px-3 py-1.5 rounded-xl border border-[#E6D5C3] w-full sm:w-auto">
                <Users className="w-4 h-4 text-[#D4A373] shrink-0" />
                <select
                  value={selectedCashierFilter}
                  onChange={(e) => setSelectedCashierFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#2B1713] focus:outline-hidden cursor-pointer w-full"
                >
                  <option value="ALL">Semua Kasir & Admin</option>
                  {availableCashierNames.map((name) => (
                    <option key={name} value={name}>
                      Akun: {name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#F5EBE0] text-[#3E2723] px-3.5 py-1.5 rounded-xl border border-[#E6D5C3] text-xs font-bold">
                <Users className="w-4 h-4 text-[#D4A373] shrink-0" />
                <span>Akun Kasir: <strong>{currentUser.name}</strong></span>
                <span className="bg-amber-200/80 text-amber-900 text-[10px] px-2 py-0.5 rounded-md font-extrabold">
                  Rekapan Terfilter
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Date Inputs Sub-Row */}
        <div className="pt-2 border-t border-[#F5EBE0] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {reportType === 'custom' ? (
            /* Custom Date Range: Dari Tanggal - Sampai Tanggal */
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#FDFBF7] px-2.5 py-1.5 rounded-xl border border-[#E6D5C3]">
                <span className="text-[11px] font-bold text-[#8D6E63]">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#2B1713] focus:outline-none"
                />
              </div>

              <span className="text-xs font-bold text-[#8D6E63] text-center sm:text-left">s/d</span>

              <div className="flex items-center gap-1.5 bg-[#FDFBF7] px-2.5 py-1.5 rounded-xl border border-[#E6D5C3]">
                <span className="text-[11px] font-bold text-[#8D6E63]">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#2B1713] focus:outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => applyDatePreset('today')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5EBE0] text-[#3E2723] hover:bg-[#D4A373] hover:text-white transition-colors shrink-0"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('yesterday')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5EBE0] text-[#3E2723] hover:bg-[#D4A373] hover:text-white transition-colors shrink-0"
                >
                  Kemarin
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('last7')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5EBE0] text-[#3E2723] hover:bg-[#D4A373] hover:text-white transition-colors shrink-0"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('last30')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5EBE0] text-[#3E2723] hover:bg-[#D4A373] hover:text-white transition-colors shrink-0"
                >
                  30 Hari
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('thisMonth')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5EBE0] text-[#3E2723] hover:bg-[#D4A373] hover:text-white transition-colors shrink-0"
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('lastMonth')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5EBE0] text-[#3E2723] hover:bg-[#D4A373] hover:text-white transition-colors shrink-0"
                >
                  Bulan Lalu
                </button>
              </div>
            </div>
          ) : (
            /* Single Date/Month/Year Picker */
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#8D6E63] flex items-center gap-1">
                <Calendar className="w-4 h-4 text-[#D4A373]" />
                {reportType === 'daily' ? 'Pilih Tanggal:' : reportType === 'monthly' ? 'Pilih Bulan:' : 'Pilih Tahun:'}
              </span>
              <input
                type={reportType === 'daily' ? 'date' : reportType === 'monthly' ? 'month' : 'number'}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E6D5C3] text-xs font-bold text-[#2B1713] bg-[#FDFBF7] focus:outline-none focus:border-[#D4A373]"
              />
            </div>
          )}

          {/* Active Period Badge */}
          <div className="text-right text-[11px] font-bold text-[#8D6E63] flex items-center justify-end gap-1.5 self-center">
            <span className="px-2.5 py-1 rounded-lg bg-[#FAF3DD] text-[#3E2723] border border-[#E6D5C3]">
              Periode Aktif: <strong>{getPeriodDisplay()}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Simplified Financial Summary Cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Omset Net Sales */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
              <span className="flex items-center gap-1.5 text-[#3E2723]">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Penjualan Bersih
              </span>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold border border-emerald-200">
                {filteredTxs.length} Order
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#2B1713]">
              {formatRp(netSales)}
            </div>
            <div className="text-[11px] text-gray-500 flex justify-between border-t border-gray-100 pt-1.5">
              <span>Kotor: {formatRp(grossSales)}</span>
              <span className="text-amber-800 font-medium">Disc: -{formatRp(totalDiscount)}</span>
            </div>
          </div>

          {currentUser.role === 'admin' ? (
            <>
              {/* Card 2: HPP COGS */}
              <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span className="flex items-center gap-1.5 text-[#3E2723]">
                    <ShoppingBag className="w-4 h-4 text-amber-600" /> Total HPP Bahan
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">COGS</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#8D6E63]">
                  {formatRp(totalHpp)}
                </div>
                <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-1.5">
                  Modal Bahan Baku Produk
                </div>
              </div>

              {/* Card 3: Laba Kotor */}
              <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span className="flex items-center gap-1.5 text-[#3E2723]">
                    <PieChart className="w-4 h-4 text-blue-600" /> Laba Kotor
                  </span>
                  <span className="text-[10px] text-blue-800 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Gross Profit
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-950">
                  {formatRp(grossProfit)}
                </div>
                <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-1.5">
                  Omset - HPP Bahan
                </div>
              </div>

              {/* Card 4: Laba Bersih Akhir */}
              <div className="bg-gradient-to-br from-[#2B1713] to-[#3E2723] p-4 rounded-2xl border border-[#4E342E] shadow-md text-[#F5EBE0] flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#D4A373]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" /> Laba Bersih Akhir
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">
                    Margin {marginPct}%
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">
                  {formatRp(netProfit)}
                </div>
                <div className="text-[11px] text-[#D4A373]/90 flex justify-between border-t border-[#4E342E] pt-1.5">
                  <span>Operasional:</span>
                  <span className="text-rose-300 font-semibold">-{formatRp(totalExpenses)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Card 2: Total Transaksi Selesai */}
              <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span className="flex items-center gap-1.5 text-[#3E2723]">
                    <ShoppingBag className="w-4 h-4 text-amber-600" /> Transaksi Selesai
                  </span>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Nota
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#2B1713]">
                  {filteredTxs.length} <span className="text-xs font-normal text-gray-500">Nota</span>
                </div>
                <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-1.5">
                  Total pesanan selesai terlayani
                </div>
              </div>

              {/* Card 3: Kas Tunai */}
              <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span className="flex items-center gap-1.5 text-[#3E2723]">
                    <DollarSign className="w-4 h-4 text-emerald-600" /> Penerimaan Kas Tunai
                  </span>
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Cash Laci
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-800">
                  {formatRp(cashSales)}
                </div>
                <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-1.5">
                  Fisik uang kas di laci kasir
                </div>
              </div>

              {/* Card 4: Non-Tunai & QRIS */}
              <div className="bg-gradient-to-br from-[#2B1713] to-[#3E2723] p-4 rounded-2xl border border-[#4E342E] shadow-md text-[#F5EBE0] flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#D4A373]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-blue-400" /> Non-Tunai & QRIS
                  </span>
                  <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-400/30 font-bold">
                    Digital
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-300">
                  {formatRp(qrisSales + debitSales)}
                </div>
                <div className="text-[11px] text-[#D4A373]/90 flex justify-between border-t border-[#4E342E] pt-1.5">
                  <span>QRIS: {formatRp(qrisSales)}</span>
                  <span>Ojol/Bank: {formatRp(debitSales)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Payment Method Breakdown Bar */}
        <div className="bg-white p-3 rounded-2xl border border-[#E6D5C3] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-[#FDFBF7] p-2 rounded-xl border border-[#E6D5C3]">
            <div className="text-[10px] text-gray-500 font-bold">💵 Tunai (Cash)</div>
            <div className="font-bold text-[#3E2723] text-xs mt-0.5">{formatRp(cashSales)}</div>
          </div>
          <div className="bg-[#FDFBF7] p-2 rounded-xl border border-[#E6D5C3]">
            <div className="text-[10px] text-gray-500 font-bold">📱 QRIS</div>
            <div className="font-bold text-[#3E2723] text-xs mt-0.5">{formatRp(qrisSales)}</div>
          </div>
          <div className="bg-[#FDFBF7] p-2 rounded-xl border border-[#E6D5C3]">
            <div className="text-[10px] text-gray-500 font-bold">💳 Kartu / EDC</div>
            <div className="font-bold text-[#3E2723] text-xs mt-0.5">{formatRp(debitSales)}</div>
          </div>
          <div className="bg-orange-50/70 p-2 rounded-xl border border-orange-200">
            <div className="text-[10px] text-orange-800 font-bold">🧡 ShopeeFood</div>
            <div className="font-bold text-orange-950 text-xs mt-0.5">{formatRp(shopeeFoodSales)}</div>
          </div>
          <div className="bg-red-50/70 p-2 rounded-xl border border-red-200">
            <div className="text-[10px] text-red-800 font-bold">💚 GoFood (GoBiz)</div>
            <div className="font-bold text-red-950 text-xs mt-0.5">{formatRp(goFoodSales)}</div>
          </div>
          <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
            <div className="text-[10px] text-emerald-800 font-bold">🟢 GrabFood</div>
            <div className="font-bold text-emerald-950 text-xs mt-0.5">{formatRp(grabFoodSales)}</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: REKAPAN KINERJA PENJUALAN PER KASIR */}
      <div className="bg-white rounded-2xl border border-[#E6D5C3] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D5C3] pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#2B1713] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D4A373]" /> Rekapan Penjualan Masing-Masing Kasir
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Rincian jumlah transaksi, omzet penjualan, HPP & kontribusi atas nama masing-masing kasir
            </p>
          </div>
          <span className="bg-[#F5EBE0] text-[#3E2723] px-3 py-1 rounded-full text-xs font-bold border border-[#E6D5C3] w-fit">
            {cashierSummaries.length} Kasir Bertugas
          </span>
        </div>

        {cashierSummaries.length === 0 ? (
          <div className="text-xs text-gray-400 py-6 text-center">Belum ada transaksi penjualan pada periode ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Nama Kasir</th>
                  <th className="py-2.5 px-3">Jumlah Order</th>
                  <th className="py-2.5 px-3">Penjualan Kotor</th>
                  <th className="py-2.5 px-3">Diskon</th>
                  <th className="py-2.5 px-3">Penjualan Bersih</th>
                  {currentUser.role === 'admin' && (
                    <>
                      <th className="py-2.5 px-3">Total HPP</th>
                      <th className="py-2.5 px-3">Laba Kotor</th>
                    </>
                  )}
                  <th className="py-2.5 px-3">Pembayaran (Cash/QRIS/Other)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D5C3]">
                {cashierSummaries.map((c, i) => {
                  const sharePct = netSales > 0 ? Math.round((c.netSales / netSales) * 100) : 0;
                  return (
                    <tr key={i} className="hover:bg-amber-50/50">
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-[#3E2723] flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-[#3E2723] text-white flex items-center justify-center text-[10px] font-bold">
                            {c.cashierName.charAt(0)}
                          </span>
                          {c.cashierName}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Kontribusi: <strong className="text-emerald-700">{sharePct}%</strong> dari total omzet
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-[#2B1713]">{c.txCount} Transaksi</td>
                      <td className="py-3 px-3 text-gray-700">{formatRp(c.grossSales)}</td>
                      <td className="py-3 px-3 text-amber-800">-{formatRp(c.discount)}</td>
                      <td className="py-3 px-3 font-black text-[#2B1713] bg-[#FDFBF7]">{formatRp(c.netSales)}</td>
                      {currentUser.role === 'admin' && (
                        <>
                          <td className="py-3 px-3 text-[#8D6E63] font-semibold">{formatRp(c.totalCogs)}</td>
                          <td className="py-3 px-3 font-bold text-emerald-700">{formatRp(c.grossProfit)}</td>
                        </>
                      )}
                      <td className="py-3 px-3">
                        <div className="flex gap-1 text-[10px]">
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                            Cash: {c.cashCount}
                          </span>
                          <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                            QRIS: {c.qrisCount}
                          </span>
                          <span className="bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                            Lain: {c.debitCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION: RIWAYAT SHIFT KASIR & CETAK STRUK THERMAL */}
      <div className="bg-white rounded-2xl border border-[#E6D5C3] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D5C3] pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#2B1713] flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#D4A373]" /> Riwayat Shift Kasir & Bukti Cetak Thermal
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Daftar sesi shift kasir dengan opsi cetak ulang bukti rekap fisik via printer thermal 58mm/80mm
            </p>
          </div>
          <span className="bg-[#F5EBE0] text-[#3E2723] px-3 py-1 rounded-full text-xs font-bold border border-[#E6D5C3] w-fit">
            {visibleShifts.length} Sesi Shift Terdata
          </span>
        </div>

        {visibleShifts.length === 0 ? (
          <div className="text-xs text-gray-400 py-6 text-center">Belum ada riwayat shift kasir terdaftar untuk akun ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Kasir Bertugas</th>
                  <th className="py-2.5 px-3">Waktu Buka / Tutup</th>
                  <th className="py-2.5 px-3">Modal Awal</th>
                  <th className="py-2.5 px-3">Penjualan Tunai</th>
                  <th className="py-2.5 px-3">Non-Tunai</th>
                  <th className="py-2.5 px-3">Kas Fisik Laci</th>
                  <th className="py-2.5 px-3">Selisih Kas</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi Cetak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D5C3]">
                {visibleShifts.map((s) => {
                  const expected = s.expectedEndCash ?? (s.startCash + s.totalSalesCash);
                  const actual = s.actualEndCash ?? expected;
                  const diff = s.difference ?? (actual - expected);

                  return (
                    <tr key={s.id} className="hover:bg-amber-50/50">
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-[#3E2723] flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-[#3E2723] text-white flex items-center justify-center text-[10px] font-bold">
                            {s.cashierName.charAt(0)}
                          </span>
                          {s.cashierName}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        <div>
                          <strong>Buka:</strong> {formatDateTime(s.startTime)}
                        </div>
                        <div>
                          <strong>Tutup:</strong> {s.endTime ? formatDateTime(s.endTime) : 'Shift Berjalan'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-700">{formatRp(s.startCash)}</td>
                      <td className="py-3 px-3 font-bold text-emerald-800">{formatRp(s.totalSalesCash)}</td>
                      <td className="py-3 px-3 font-bold text-blue-800">{formatRp(s.totalSalesNonCash)}</td>
                      <td className="py-3 px-3 font-black text-[#2B1713]">
                        {s.status === 'closed' ? formatRp(actual) : '-'}
                      </td>
                      <td className="py-3 px-3">
                        {s.status === 'closed' ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              diff === 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : diff > 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {diff === 0 ? 'PAS (Rp 0)' : diff > 0 ? `+${formatRp(diff)}` : formatRp(diff)}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            s.status === 'open'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-gray-100 text-gray-800 border border-gray-300'
                          }`}
                        >
                          {s.status === 'open' ? '🟢 SHIFT AKTIF' : '⚪ SHIFT DITUTUP'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedShiftForThermal(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#D4A373] hover:bg-[#c39262] text-[#1F1412] font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
                            title="Cetak Struk Rekap Thermal"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Thermal</span>
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Yakin ingin menghapus riwayat shift kasir "${s.cashierName}"?`)) {
                                onDeleteShift?.(s.id);
                                setAllShifts(prev => prev.filter(x => x.id !== s.id));
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                            title="Hapus Riwayat Shift"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: REKAPAN PENGELUARAN OPERASIONAL */}
      <div className="bg-white rounded-2xl border border-[#E6D5C3] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D5C3] pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#2B1713] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#D4A373]" /> Rekapan Rincian Pengeluaran Operasional
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Daftar seluruh biaya operasional katering, listrik, gaji & keperluan toko periode terpilih
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-gray-400">Total Operational Expense</span>
            <div className="text-base font-black text-amber-900">{formatRp(totalExpenses)}</div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-xs text-gray-400 py-6 text-center">Belum ada catatan pengeluaran operasional pada periode ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Kategori Pengeluaran</th>
                  <th className="py-2.5 px-3">Keterangan / Detail</th>
                  <th className="py-2.5 px-3">Dicatat Oleh</th>
                  <th className="py-2.5 px-3 text-right">Jumlah Biaya</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D5C3]">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-amber-50/50">
                    <td className="py-3 px-3 font-semibold text-[#3E2723]">{exp.date}</td>
                    <td className="py-3 px-3 font-bold text-[#2B1713]">
                      <span className="bg-[#F5EBE0] text-[#3E2723] px-2 py-0.5 rounded-md text-[10px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-700">{exp.description || exp.note || '-'}</td>
                    <td className="py-3 px-3 text-gray-600">{exp.recordedBy || 'Admin'}</td>
                    <td className="py-3 px-3 font-black text-amber-950 text-right">{formatRp(exp.amount)}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm(`Yakin ingin menghapus catatan pengeluaran "${exp.category}" sebesar ${formatRp(exp.amount)}?`)) {
                            onDeleteExpense?.(exp.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Hapus Pengeluaran"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-[#E6D5C3] p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#2B1713]">Daftar Transaksi Periode Terpilih ({filteredTxs.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Antrian</th>
                <th className="py-2.5 px-3">No. Faktur</th>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">Kasir</th>
                <th className="py-2.5 px-3">Pelanggan</th>
                <th className="py-2.5 px-3">Metode</th>
                {currentUser.role === 'admin' && <th className="py-2.5 px-3">HPP</th>}
                <th className="py-2.5 px-3">Total</th>
                <th className="py-2.5 px-3 text-right">Struk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D5C3]">
              {filteredTxs.map((tx) => (
                <tr key={tx.id} className="hover:bg-amber-50/50">
                  <td className="py-3 px-3 font-mono font-black text-[#2B1713]">
                    {tx.queueNo ? (
                      <span className="bg-amber-100 border border-amber-300 text-amber-950 px-2 py-0.5 rounded-lg text-xs font-mono font-black">
                        {tx.queueNo}
                      </span>
                    ) : (
                      <span className="text-gray-400 font-mono text-[11px]">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-bold text-[#3E2723]">{tx.invoiceNo}</td>
                  <td className="py-3 px-3 text-gray-600">{formatDate(tx.timestamp)}</td>
                  <td className="py-3 px-3 text-gray-700">{tx.cashierName}</td>
                  <td className="py-3 px-3 text-gray-800">
                    <div>{tx.customerName || '-'}</div>
                    {tx.onlineOrderNo && (
                      <div className="text-[10px] text-orange-800 font-bold flex items-center gap-1 mt-0.5">
                        <Bike className="w-3 h-3 text-orange-600 inline" />
                        <span>Order #{tx.onlineOrderNo}</span>
                        {tx.driverName && <span className="text-gray-500 font-normal">({tx.driverName})</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.paymentMethod === 'shopeefood'
                          ? 'bg-orange-100 text-orange-800 border border-orange-200'
                          : tx.paymentMethod === 'gofood'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : tx.paymentMethod === 'grabfood'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : tx.paymentMethod === 'cash'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : tx.paymentMethod === 'qris'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-[#3E2723]/10 text-[#3E2723]'
                      }`}
                    >
                      {getPaymentMethodLabel(tx.paymentMethod)}
                    </span>
                  </td>
                  {currentUser.role === 'admin' && (
                    <td className="py-3 px-3 text-[#8D6E63] font-semibold">{formatRp(tx.totalCogs)}</td>
                  )}
                  <td className="py-3 px-3 font-black text-[#2B1713]">{formatRp(tx.total)}</td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenReceipt(tx)}
                        className="p-1.5 rounded-lg bg-[#F5EBE0] hover:bg-[#D4A373] text-[#3E2723] transition-colors"
                        title="Lihat / Cetak Struk"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Yakin ingin menghapus transaksi No. Faktur "${tx.invoiceNo}"?`)) {
                            onDeleteTransaction?.(tx.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable PDF Report Preview Modal */}
      {isPDFPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#E6D5C3] text-black space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-gray-200">
              <h3 className="font-bold text-base text-[#2B1713]">Pratinjau Laporan Keuangan</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {currentUser.role === 'kasir' && (
                  <button
                    onClick={handleSendWhatsAppReport}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    title="Kirim ringkasan laporan keuangan via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-100" /> Kirim WA
                  </button>
                )}
                <button
                  onClick={handleDownloadReportJPG}
                  disabled={isExportingJPG}
                  className="px-3.5 py-1.5 rounded-lg bg-[#3E2723] hover:bg-[#5D4037] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  title="Unduh laporan dalam format gambar JPG"
                >
                  <Image className="w-4 h-4 text-[#D4A373]" /> {isExportingJPG ? 'Proses...' : 'Unduh Dokumen (JPG)'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#3E2723] text-[#FAF3DD] hover:bg-[#5D4037] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Cetak
                </button>
                <button onClick={() => setIsPDFPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Simulated Printed Document Page */}
            <div id="printable-report-container" className="border border-gray-300 p-8 rounded-lg bg-white space-y-6 font-sans text-xs">
              {/* Header Company */}
              <div className="border-b-2 border-[#3E2723] pb-4 flex items-center justify-between">
                <div>
                  <h1 className="font-black text-xl text-[#3E2723] uppercase">{settings.storeName}</h1>
                  <p className="text-gray-600 text-xs">{settings.address} | Telp: {settings.phone}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm uppercase">LAPORAN LABA RUGI</div>
                  <div className="text-gray-500">Periode: {getPeriodDisplay()}</div>
                </div>
              </div>

              {/* Table P&L / Rekapitulasi */}
              <table className="w-full text-left text-xs border border-gray-300">
                <thead className="bg-[#F5EBE0] font-bold border-b border-gray-300">
                  <tr>
                    <th className="p-2.5">Keterangan Akun</th>
                    <th className="p-2.5 text-right">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="p-2.5 font-bold">Penjualan Kotor (Gross Sales)</td>
                    <td className="p-2.5 text-right font-bold">{formatRp(grossSales)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-red-700">Potongan Diskon Penjualan</td>
                    <td className="p-2.5 text-right text-red-700">-{formatRp(totalDiscount)}</td>
                  </tr>
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-2.5">Total Penjualan Bersih (Net Sales)</td>
                    <td className="p-2.5 text-right">{formatRp(netSales)}</td>
                  </tr>
                  {currentUser.role === 'admin' ? (
                    <>
                      <tr>
                        <td className="p-2.5 text-gray-700">Harga Pokok Penjualan (HPP / COGS)</td>
                        <td className="p-2.5 text-right text-gray-700">-{formatRp(totalHpp)}</td>
                      </tr>
                      <tr className="bg-emerald-50 font-bold text-emerald-950">
                        <td className="p-2.5">Laba Kotor (Gross Profit)</td>
                        <td className="p-2.5 text-right">{formatRp(grossProfit)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-amber-900">Total Pengeluaran Operasional</td>
                        <td className="p-2.5 text-right text-amber-900">-{formatRp(totalExpenses)}</td>
                      </tr>
                      <tr className="bg-[#3E2723] text-[#FAF3DD] font-black text-sm">
                        <td className="p-3">LABA BERSIH AKHIR (NET PROFIT)</td>
                        <td className="p-3 text-right">{formatRp(netProfit)}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="p-2.5 text-emerald-800 font-bold">Penerimaan Kas Tunai (Cash Laci)</td>
                        <td className="p-2.5 text-right text-emerald-800 font-bold">{formatRp(cashSales)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-blue-800 font-bold">Penerimaan QRIS & Digital</td>
                        <td className="p-2.5 text-right text-blue-800 font-bold">{formatRp(qrisSales)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-orange-800 font-bold">Penerimaan Transfer & Ojol</td>
                        <td className="p-2.5 text-right text-orange-800 font-bold">{formatRp(debitSales)}</td>
                      </tr>
                      <tr className="bg-[#3E2723] text-[#FAF3DD] font-black text-sm">
                        <td className="p-3">TOTAL REKAPITULASI PENJUALAN</td>
                        <td className="p-3 text-right">{formatRp(netSales)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              {/* PDF Breakdown 1: Cashier Performance */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-xs text-[#3E2723] border-b border-gray-300 pb-1 uppercase">
                  1. Rincian Penjualan Per Kasir
                </h4>
                <table className="w-full text-left text-[11px] border border-gray-300">
                  <thead className="bg-gray-100 font-bold border-b border-gray-300">
                    <tr>
                      <th className="p-1.5">Nama Kasir</th>
                      <th className="p-1.5 text-center">Transaksi</th>
                      <th className="p-1.5 text-right">Omzet Kotor</th>
                      <th className="p-1.5 text-right">Penjualan Bersih</th>
                      <th className="p-1.5 text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cashierSummaries.map((c, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5 font-bold">{c.cashierName}</td>
                        <td className="p-1.5 text-center">{c.txCount} tx</td>
                        <td className="p-1.5 text-right">{formatRp(c.grossSales)}</td>
                        <td className="p-1.5 text-right font-bold">{formatRp(c.netSales)}</td>
                        <td className="p-1.5 text-right text-emerald-700 font-bold">{formatRp(c.grossProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PDF Breakdown 2: Operational Expenses */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-xs text-[#3E2723] border-b border-gray-300 pb-1 uppercase">
                  2. Rincian Pengeluaran Operasional
                </h4>
                {filteredExpenses.length === 0 ? (
                  <p className="text-gray-500 italic text-[10px]">Tidak ada pengeluaran operasional pada periode ini.</p>
                ) : (
                  <table className="w-full text-left text-[11px] border border-gray-300">
                    <thead className="bg-gray-100 font-bold border-b border-gray-300">
                      <tr>
                        <th className="p-1.5">Tanggal</th>
                        <th className="p-1.5">Kategori</th>
                        <th className="p-1.5">Keterangan</th>
                        <th className="p-1.5 text-right">Biaya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id}>
                          <td className="p-1.5">{exp.date}</td>
                          <td className="p-1.5 font-bold">{exp.category}</td>
                          <td className="p-1.5">{exp.description || exp.note || '-'}</td>
                          <td className="p-1.5 text-right font-bold text-amber-900">{formatRp(exp.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Signatures Footer */}
              <div className="pt-8 flex justify-between text-center text-xs">
                <div>
                  <p className="text-gray-500">Dibuat Oleh (Kasir/Admin),</p>
                  <div className="h-14" />
                  <p className="font-bold border-t border-gray-400 pt-1 px-4">{settings.storeName}</p>
                </div>
                <div>
                  <p className="text-gray-500">Disetujui Oleh (Owner),</p>
                  <div className="h-14" />
                  <p className="font-bold border-t border-gray-400 pt-1 px-4">Management Su-Qur</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* THERMAL SHIFT REKAP MODAL */}
      {selectedShiftForThermal && (
        <ThermalShiftModal
          shift={selectedShiftForThermal}
          settings={settings}
          onClose={() => setSelectedShiftForThermal(null)}
        />
      )}

      {/* ADMIN RESTORE FILE BACKUP MODAL */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#2B1713] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#4E342E] text-[#F5EBE0] space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#4E342E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#FAF3DD] flex items-center gap-2">
                    Restore File Backup Database
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
                      Khusus Admin
                    </span>
                  </h3>
                  <p className="text-xs text-[#D4A373]">
                    Pulihkan seluruh data transaksi, produk, bahan & operasional dari file backup .json kasir
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setRestoreError(null);
                  setRestoreJsonText('');
                  setParsedBackup(null);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Alert */}
            {restoreSuccess && (
              <div className="p-4 bg-emerald-950 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>BERHASIL! Data sistem telah dipulihkan. Memperbarui halaman...</span>
              </div>
            )}

            {/* Error Alert */}
            {restoreError && (
              <div className="p-3 bg-rose-950 border border-rose-500/50 rounded-xl text-rose-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            {/* Tabs selection: File Upload vs Text Paste */}
            <div className="flex items-center gap-2 bg-[#1F1412] p-1 rounded-xl border border-[#4E342E]">
              <button
                onClick={() => setRestoreTab('upload')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  restoreTab === 'upload' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-sm' : 'text-[#8D6E63] hover:text-[#F5EBE0]'
                }`}
              >
                <UploadCloud className="w-4 h-4 text-[#D4A373]" /> Upload File .JSON
              </button>
              <button
                onClick={() => setRestoreTab('text')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  restoreTab === 'text' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-sm' : 'text-[#8D6E63] hover:text-[#F5EBE0]'
                }`}
              >
                <FileJson className="w-4 h-4 text-[#D4A373]" /> Tempel Teks JSON
              </button>
            </div>

            {restoreTab === 'upload' ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#D4A373]">
                  Pilih File Backup (.json) yang dikirim oleh Kasir:
                </label>
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#4E342E] hover:border-[#D4A373] bg-[#1F1412] rounded-xl cursor-pointer transition-all hover:bg-[#251815] group">
                  <UploadCloud className="w-8 h-8 text-[#D4A373] group-hover:scale-110 transition-transform mb-2" />
                  <span className="text-xs font-bold text-[#FAF3DD]">Klik untuk Cari File Backup (.json)</span>
                  <span className="text-[11px] text-[#8D6E63] mt-0.5">Mendukung format suqur_pos_backup_*.json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#D4A373]">
                  Tempelkan (Paste) Teks Isi File Backup JSON di bawah:
                </label>
                <textarea
                  value={restoreJsonText}
                  onChange={(e) => handleRestoreTextChange(e.target.value)}
                  rows={5}
                  placeholder='{"timestamp": "...", "app": "Su-Qur POS", "products": [...], ...}'
                  className="w-full bg-[#1F1412] border border-[#4E342E] rounded-xl p-3 text-xs text-[#F5EBE0] font-mono focus:outline-none focus:border-[#D4A373]"
                />
              </div>
            )}

            {/* Parsed Preview Card */}
            {parsedBackup && (
              <div className="bg-[#1F1412] p-4 rounded-xl border border-amber-500/40 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-[#4E342E] pb-2">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-amber-400" /> Pratinjau Isi File Backup:
                  </span>
                  <span className="text-[11px] text-gray-400">{parsedBackup.timestamp ? new Date(parsedBackup.timestamp).toLocaleString('id-ID') : '-'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#F5EBE0]">
                  <div className="bg-[#2B1713] p-2 rounded-lg border border-[#4E342E]">
                    <span className="text-[#8D6E63] block text-[10px]">Nama Toko</span>
                    <strong className="text-amber-200">{parsedBackup.settings?.storeName || 'Su-Qur POS'}</strong>
                  </div>
                  <div className="bg-[#2B1713] p-2 rounded-lg border border-[#4E342E]">
                    <span className="text-[#8D6E63] block text-[10px]">Total Transaksi</span>
                    <strong className="text-emerald-300">{parsedBackup.transactions?.length || 0} Transaksi</strong>
                  </div>
                  <div className="bg-[#2B1713] p-2 rounded-lg border border-[#4E342E]">
                    <span className="text-[#8D6E63] block text-[10px]">Produk Menu</span>
                    <strong className="text-[#FAF3DD]">{parsedBackup.products?.length || 0} Item</strong>
                  </div>
                  <div className="bg-[#2B1713] p-2 rounded-lg border border-[#4E342E]">
                    <span className="text-[#8D6E63] block text-[10px]">Pengeluaran / Shift</span>
                    <strong className="text-[#FAF3DD]">{(parsedBackup.expenses?.length || 0)} Exp / {(parsedBackup.shifts?.length || 0)} Shift</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#4E342E]">
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-xs font-bold text-[#F5EBE0] transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={!parsedBackup || restoreSuccess}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                {restoreSuccess ? 'Memulihkan...' : 'Proses Restore Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Live Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
      />

      {/* Rekap Harian Pencatatan Keluar Masuk Harian & Cetak PDF */}
      {isDailyRecapModalOpen && (
        <DailyRecapModal
          isOpen={isDailyRecapModalOpen}
          onClose={() => setIsDailyRecapModalOpen(false)}
          transactions={transactions}
          expenses={expenses}
          settings={settings}
          outlets={outlets}
          activeOutlet={activeOutlet}
          user={currentUser}
        />
      )}
    </div>
  );
};
