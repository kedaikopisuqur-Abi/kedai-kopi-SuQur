import React, { useState, useMemo } from 'react';
import { Transaction, Expense, StoreSettings, Shift, User, Outlet, Ingredient, Product } from '../../types';
import { StorageService } from '../../services/storage';
import { formatRp, formatDate, formatDateTime, openWhatsApp } from '../../utils/formatters';
import { calculateCupUsageAndTargetAnalytics } from '../../utils/cupAnalytics';
import {
  FileText,
  Printer,
  Calendar,
  DollarSign,
  X,
  Layers,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  MessageCircle,
  Building2,
  Lock,
  RotateCcw,
  Sparkles,
  Receipt,
  FileSpreadsheet,
  CupSoda,
  Coffee,
  Target,
  Info,
} from 'lucide-react';

interface DailyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  expenses?: Expense[];
  ingredients?: Ingredient[];
  settings?: StoreSettings;
  shifts?: Shift[];
  activeShift?: Shift | null;
  outlets?: Outlet[];
  activeOutlet?: Outlet;
  user?: User;
}

interface IngredientUsageSummary {
  ingredientId: string;
  name: string;
  category: string;
  unit: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
}

export const DailyRecapModal: React.FC<DailyRecapModalProps> = ({
  isOpen,
  onClose,
  transactions: propTransactions,
  expenses: propExpenses,
  ingredients: propIngredients,
  settings: propSettings,
  shifts: propShifts = [],
  activeShift,
  outlets = [],
  activeOutlet,
  user,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(activeOutlet?.id || 'ALL');
  const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
  const [activeTab, setActiveTab] = useState<'semua' | 'untung_rugi' | 'kas' | 'cup' | 'menu' | 'bahan_baku' | 'aktivitas'>('semua');
  const currentUser = user || StorageService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const settings = useMemo(() => propSettings || StorageService.getSettings(), [propSettings]);
  const transactions = useMemo(() => propTransactions || StorageService.getTransactions(), [propTransactions]);
  const expenses = useMemo(() => propExpenses || StorageService.getExpenses(), [propExpenses]);
  const ingredients = useMemo(() => (propIngredients && propIngredients.length > 0 ? propIngredients : StorageService.getIngredients()), [propIngredients]);
  const products: Product[] = useMemo(() => StorageService.getProducts(), []);
  const allShifts: Shift[] = useMemo(() => (propShifts && propShifts.length > 0 ? propShifts : StorageService.getShifts()), [propShifts]);
  const purchases = useMemo(() => StorageService.getPurchases(), []);

  // Filter Data according to selected date and outlet
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchDate = tx.timestamp.startsWith(selectedDate);
      const matchOutlet = selectedOutletId === 'ALL' || (tx.outletId || activeOutlet?.id) === selectedOutletId;
      return matchDate && matchOutlet;
    });
  }, [transactions, selectedDate, selectedOutletId, activeOutlet]);

  const validTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.status !== 'voided');
  }, [filteredTransactions]);

  const voidedTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.status === 'voided');
  }, [filteredTransactions]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchDate = exp.date === selectedDate;
      const matchOutlet = selectedOutletId === 'ALL' || (exp.outletId || activeOutlet?.id) === selectedOutletId;
      return matchDate && matchOutlet;
    });
  }, [expenses, selectedDate, selectedOutletId, activeOutlet]);

  const filteredShifts = useMemo(() => {
    return allShifts.filter((s) => {
      const matchDate = s.startTime.startsWith(selectedDate) || (s.endTime && s.endTime.startsWith(selectedDate));
      const matchOutlet = selectedOutletId === 'ALL' || (s.outletId || activeOutlet?.id) === selectedOutletId;
      return matchDate && matchOutlet;
    });
  }, [allShifts, selectedDate, selectedOutletId, activeOutlet]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchDate = p.date === selectedDate;
      const matchOutlet = selectedOutletId === 'ALL' || (p.outletId || activeOutlet?.id) === selectedOutletId;
      return matchDate && matchOutlet;
    });
  }, [purchases, selectedDate, selectedOutletId, activeOutlet]);

  // 1. KEUANGAN & LABA RUGI (P&L)
  const grossSales = validTransactions.reduce((sum, tx) => sum + (tx.total || 0), 0);
  const totalDiscount = validTransactions.reduce((sum, tx) => sum + (tx.discount || 0), 0);
  const totalTax = validTransactions.reduce((sum, tx) => sum + (tx.tax || 0), 0);
  const netSales = grossSales; // Di aplikasi total sudah memperhitungkan diskon

  // HPP dari transaksi
  const totalCogs = validTransactions.reduce((sum, tx) => sum + (tx.totalCogs || 0), 0);
  const grossProfit = netSales - totalCogs;
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // Beban Pengeluaran Kasir / Operasional
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;
  const isProfitable = netProfit >= 0;

  // 2. ARUS KAS KELUAR MASUK KASIR
  const cashSales = validTransactions
    .filter((tx) => tx.paymentMethod === 'cash')
    .reduce((sum, tx) => sum + (tx.total || 0), 0);

  const nonCashSales = validTransactions
    .filter((tx) => tx.paymentMethod !== 'cash')
    .reduce((sum, tx) => sum + (tx.total || 0), 0);

  const qrisSales = validTransactions
    .filter((tx) => tx.paymentMethod === 'qris')
    .reduce((sum, tx) => sum + (tx.total || 0), 0);

  const merchantDeliverySales = validTransactions
    .filter((tx) => ['shopeefood', 'gofood', 'grabfood', 'shopeefood_merchant', 'non_cash_merchant'].includes(tx.paymentMethod))
    .reduce((sum, tx) => sum + (tx.total || 0), 0);

  const debitSales = validTransactions
    .filter((tx) => tx.paymentMethod === 'debit' || tx.paymentMethod === 'gopay_shopee')
    .reduce((sum, tx) => sum + (tx.total || 0), 0);

  // Modal Kasir Awal dari Shift hari ini
  const startCashTotal = filteredShifts.reduce((sum, s) => sum + (s.startCash || 0), 0);
  const totalCashIn = startCashTotal + cashSales;
  const totalCashOut = totalExpenses;
  const expectedCashInDrawer = totalCashIn - totalCashOut;

  // Data Tutup Shift Aktual
  const closedShifts = filteredShifts.filter((s) => s.status === 'closed');
  const actualEndCashTotal = closedShifts.reduce((sum, s) => sum + (s.actualEndCash || 0), 0);
  const cashDifferenceTotal = closedShifts.reduce((sum, s) => sum + (s.difference || 0), 0);

  // 3. PEMAKAIAN BAHAN BAKU (BAHAN KELUAR & MASUK)
  const ingredientUsageMap = useMemo(() => {
    const map = new Map<string, IngredientUsageSummary>();

    // Inisialisasi dari master ingredients
    ingredients.forEach((ing) => {
      map.set(ing.id, {
        ingredientId: ing.id,
        name: ing.name,
        category: ing.category || 'Umum',
        unit: ing.unit,
        quantityUsed: 0,
        unitCost: ing.costPerUnit || 0,
        totalCost: 0,
        currentStock: ing.currentStock,
        minStock: ing.minStock,
        isLowStock: ing.currentStock <= ing.minStock,
      });
    });

    // Hitung pemakaian bahan dari setiap item transaksi yang terjual
    validTransactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (prod && prod.recipe && prod.recipe.length > 0) {
          prod.recipe.forEach((recipeItem) => {
            const deduct = recipeItem.amount * item.quantity;
            const matchedIng = ingredients.find((i) => i.id === recipeItem.ingredientId);
            const unitCost = matchedIng?.costPerUnit || 0;
            const costDeduct = unitCost * deduct;
            let existing = map.get(recipeItem.ingredientId);
            if (!existing) {
              existing = {
                ingredientId: recipeItem.ingredientId,
                name: matchedIng?.name || 'Bahan Baku',
                category: matchedIng?.category || 'Resep',
                unit: matchedIng?.unit || 'satuan',
                quantityUsed: 0,
                unitCost: unitCost,
                totalCost: 0,
                currentStock: matchedIng?.currentStock || 0,
                minStock: matchedIng?.minStock || 0,
                isLowStock: (matchedIng?.currentStock || 0) <= (matchedIng?.minStock || 0),
              };
              map.set(recipeItem.ingredientId, existing);
            }
            existing.quantityUsed += deduct;
            existing.totalCost += costDeduct;
          });
        }
      });
    });

    // Hanya ambil bahan baku yang terpakai > 0
    return Array.from(map.values())
      .filter((u) => u.quantityUsed > 0)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [validTransactions, ingredients, products]);

  const totalRawMaterialCostUsed = ingredientUsageMap.reduce((sum, item) => sum + item.totalCost, 0);

  // Rekapitulasi Pemakaian Cup & Target Harian dari Overhead Operasional
  const cupAnalytics = useMemo(() => {
    return calculateCupUsageAndTargetAnalytics(validTransactions, ingredients, products, settings);
  }, [validTransactions, ingredients, products, settings]);

  // Rekapitulasi Produk / Menu Terjual Hari Ini (Untuk Rekap Kasir & Cetak PDF)
  const soldProductsSummary = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      productName: string;
      category: string;
      variantName?: string;
      cupSize?: string;
      quantity: number;
      unitPrice: number;
      totalSales: number;
    }>();

    validTransactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const key = `${item.productId}_${item.selectedCup || ''}_${item.variantName || ''}`;
        const existing = map.get(key);
        const itemTotal = item.totalPrice || (item.unitPrice * item.quantity);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalSales += itemTotal;
        } else {
          const prod = products.find((p) => p.id === item.productId);
          map.set(key, {
            productId: item.productId,
            productName: item.productName || prod?.name || 'Menu',
            category: prod?.category || 'Minuman / Makanan',
            variantName: item.variantName,
            cupSize: item.selectedCup,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalSales: itemTotal,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  }, [validTransactions, products]);

  const totalItemsSold = useMemo(() => {
    return soldProductsSummary.reduce((sum, item) => sum + item.quantity, 0);
  }, [soldProductsSummary]);

  // 4. KETERANGAN SEMUA AKTIVITAS DARI APLIKASI (LOG TROBEL & OPERASIONAL)
  const troubleLogs = useMemo(() => {
    const list: { id: string; time: string; type: 'critical' | 'warning' | 'info'; title: string; desc: string }[] = [];

    // Cek Stok Kritis / Habis
    ingredients.forEach((ing) => {
      if (ing.currentStock <= 0) {
        list.push({
          id: `stock-empty-${ing.id}`,
          time: 'Hari Ini',
          type: 'critical',
          title: `Stok Habis: ${ing.name}`,
          desc: `Stok bahan baku ${ing.name} telah kosong (0 ${ing.unit}). Segera lakukan restock ke supplier.`,
        });
      } else if (ing.currentStock <= ing.minStock) {
        list.push({
          id: `stock-low-${ing.id}`,
          time: 'Hari Ini',
          type: 'warning',
          title: `Stok Menipis: ${ing.name}`,
          desc: `Sisa stok ${ing.name}: ${ing.currentStock} ${ing.unit} (Batas minimal aman: ${ing.minStock} ${ing.unit}).`,
        });
      }
    });

    // Cek Transaksi Voided / Dibatalkan
    voidedTransactions.forEach((tx) => {
      list.push({
        id: `void-${tx.id}`,
        time: tx.timestamp ? formatDateTime(tx.timestamp).split(', ')[1] || tx.timestamp : '-',
        type: 'warning',
        title: `Transaksi Dibatalkan (Void): ${tx.invoiceNo}`,
        desc: `Nominal Rp ${formatRp(tx.total)} dibatalkan oleh kasir ${tx.cashierName}. Meja: ${tx.tableNo || '-'}.`,
      });
    });

    // Cek Selisih Kasir saat Tutup Shift
    closedShifts.forEach((s) => {
      if (s.difference && s.difference !== 0) {
        const isMinus = s.difference < 0;
        list.push({
          id: `shift-diff-${s.id}`,
          time: s.endTime ? formatDateTime(s.endTime).split(', ')[1] || s.endTime : '-',
          type: isMinus ? 'critical' : 'warning',
          title: `Selisih Kas Shift Kasir: ${isMinus ? 'MINUS' : 'SURPLUS'} ${formatRp(Math.abs(s.difference))}`,
          desc: `Kasir: ${s.cashierName}. Kas Diharapkan: ${formatRp(s.expectedEndCash)}, Kas Fisik Aktual: ${formatRp(s.actualEndCash)}. Selisih: ${formatRp(s.difference)}.`,
        });
      }
    });

    return list;
  }, [ingredients, voidedTransactions, closedShifts]);

  // Log Aktivitas Pemakaian Bahan Baku (Rincian Menu dan Bahan yang Dikeluarkan)
  const menuUsageLogs = useMemo(() => {
    return validTransactions.map((tx) => {
      const itemsDetail = tx.items.map((it) => `${it.productName} x${it.quantity}`).join(', ');
      return {
        id: tx.id,
        invoiceNo: tx.invoiceNo,
        time: tx.timestamp ? formatDateTime(tx.timestamp).split(', ')[1] || tx.timestamp : '-',
        cashier: tx.cashierName,
        total: tx.total,
        paymentMethod: tx.paymentMethod,
        itemsSummary: itemsDetail,
        cogs: tx.totalCogs,
      };
    });
  }, [validTransactions]);

  // Print PDF Trigger
  const handlePrintPDF = () => {
    window.print();
  };

  // WhatsApp Share Helper
  const handleShareWA = () => {
    const outletName = selectedOutletId === 'ALL' ? 'Semua Cabang' : outlets.find((o) => o.id === selectedOutletId)?.name || 'Pusat';
    
    if (isAdmin) {
      const text = `*REKAPITULASI HARIAN KEDAI KOPI*
🏢 *Toko:* ${settings.storeName}
📅 *Tanggal:* ${formatDate(selectedDate)}
📍 *Cabang:* ${outletName}

*📊 RINGKASAN LABA & RUGI (P&L):*
• Penjualan Kotor (Omzet): ${formatRp(netSales)} (${validTransactions.length} Transaksi)
• HPP Bahan Baku: -${formatRp(totalCogs)}
• Laba Kotor (Gross Profit): ${formatRp(grossProfit)} (${grossMarginPct.toFixed(1)}%)
• Pengeluaran Operasional: -${formatRp(totalExpenses)} (${filteredExpenses.length} Item)
• *Laba Bersih:* *${formatRp(netProfit)}* (${isProfitable ? 'UNTUNG' : 'RUGI'})

*💵 ARUS KAS KASIR:*
• Modal Awal Kasir: ${formatRp(startCashTotal)}
• Penjualan Kasir Tunai: ${formatRp(cashSales)}
• Penjualan Non-Tunai / QRIS: ${formatRp(nonCashSales)}
• Total Kas Keluar: -${formatRp(totalExpenses)}
• Estimasi Uang Kas di Laci: *${formatRp(expectedCashInDrawer)}*
${cashDifferenceTotal !== 0 ? `• Selisih Kasir: ${formatRp(cashDifferenceTotal)}\n` : ''}
*🥤 PEMAKAIAN CUP & TARGET OVERHEAD OPERASIONAL:*
• Realisasi Hari Ini: *${cupAnalytics.totalCupsUsed} Cup* (Target: ${cupAnalytics.dailyTargetCup} Cup/hari)
• Persentase Target: *${cupAnalytics.targetProgressPct}%* (${cupAnalytics.isTargetAchieved ? 'SURPLUS +' + (cupAnalytics.totalCupsUsed - cupAnalytics.dailyTargetCup) + ' CUP' : 'KURANG ' + cupAnalytics.remainingCupsToTarget + ' CUP'})
• Alokasi Overhead: ${formatRp(cupAnalytics.overheadPerCup)}/cup (Terkumpul: ${formatRp(cupAnalytics.recoveredOverheadToday)} dari target ${formatRp(cupAnalytics.dailyOverheadExpense)})
${cupAnalytics.breakdown.map((c) => `  - ${c.size}: ${c.quantityUsed} pcs (Sisa Stok: ${c.currentStock.toLocaleString('id-ID')} pcs)`).join('\n')}
• Biaya Kemasan Cup: ${formatRp(cupAnalytics.totalCupsCost)}

*☕ MENU TERJUAL HARI INI (${totalItemsSold} Pcs):*
${soldProductsSummary.slice(0, 5).map((m, idx) => `${idx + 1}. ${m.productName}${m.cupSize ? ` (${m.cupSize})` : ''}: ${m.quantity} pcs - ${formatRp(m.totalSales)}`).join('\n')}

*📦 PEMAKAIAN BAHAN BAKU:*
${ingredientUsageMap.slice(0, 5).map((ing) => `• ${ing.name}: ${ing.quantityUsed} ${ing.unit} (${formatRp(ing.totalCost)})`).join('\n')}

*⚠️ STATUS SISTEM & TROBEL:*
${troubleLogs.length > 0 ? troubleLogs.map((l) => `• [${l.type.toUpperCase()}] ${l.title}`).join('\n') : '• Semua sistem & stok berjalan normal tanpa kendala.'}

_Laporan otomatis aplikasi Su-Qur POS._`;

      openWhatsApp(settings.phone, text);
    } else {
      const text = `*REKAP PENJUALAN & TARGET KASIR*
🏢 *Toko:* ${settings.storeName}
📅 *Tanggal:* ${formatDate(selectedDate)}
📍 *Cabang:* ${outletName}
👤 *Kasir:* ${currentUser?.name || validTransactions[0]?.cashierName || 'Kasir Bertugas'}

*🥤 SKOR TARGET PENCAPAIAN PENJUALAN CUP:*
• Realisasi Hari Ini: *${cupAnalytics.totalCupsUsed} Cup* (Target: ${cupAnalytics.dailyTargetCup} Cup/hari)
• Skor Pencapaian: *${cupAnalytics.targetProgressPct}%*
• Status: *${cupAnalytics.isTargetAchieved ? 'TARGET TERCAPAI (SURPLUS +' + (cupAnalytics.totalCupsUsed - cupAnalytics.dailyTargetCup) + ' CUP)' : 'KURANG ' + cupAnalytics.remainingCupsToTarget + ' CUP'}*
${cupAnalytics.breakdown.map((c) => `  - ${c.size}: ${c.quantityUsed} pcs terpakai (Sisa Stok: ${c.currentStock.toLocaleString('id-ID')} pcs)`).join('\n')}

*☕ MENU TERJUAL HARI INI (${totalItemsSold} Pcs):*
${soldProductsSummary.slice(0, 8).map((m, idx) => `${idx + 1}. ${m.productName}${m.cupSize ? ` (${m.cupSize})` : ''}: ${m.quantity} ${m.cupSize ? 'Cup' : 'pcs'} - ${formatRp(m.totalSales)}`).join('\n')}${soldProductsSummary.length > 8 ? `\n...dan ${soldProductsSummary.length - 8} menu lainnya` : ''}

*💵 ARUS KAS KASIR:*
• Modal Awal Kasir: ${formatRp(startCashTotal)}
• Penjualan Kasir Tunai: ${formatRp(cashSales)}
• Penjualan Non-Tunai / QRIS: ${formatRp(nonCashSales)}
• Total Kas Keluar: -${formatRp(totalExpenses)}
• Estimasi Uang Kas di Laci: *${formatRp(expectedCashInDrawer)}*
${cashDifferenceTotal !== 0 ? `• Selisih Kasir Tutup Shift: ${formatRp(cashDifferenceTotal)}\n` : ''}
*Total Penjualan Kasir:* *${formatRp(netSales)}* (${validTransactions.length} Struk Transaksi)

_Laporan otomatis kasir aplikasi Su-Qur POS._`;

      openWhatsApp(settings.phone, text);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Printable CSS Media Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #rekap-harian-print-container, #rekap-harian-print-container * {
            visibility: visible;
          }
          #rekap-harian-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 15px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: ${printMode === 'thermal' ? '80mm auto' : 'A4 portrait'};
            margin: ${printMode === 'thermal' ? '2mm' : '10mm'};
          }
        }
      `}</style>

      <div className="bg-[#FAF3DD] rounded-2xl sm:rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl border-2 border-amber-500/40 overflow-hidden text-slate-900 animate-in fade-in zoom-in-95">
        {/* Header Modal Bar */}
        <div className="bg-[#3E2723] text-[#FDFBF7] px-3.5 sm:px-6 py-3 border-b border-[#5D4037] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0 text-amber-300">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-amber-200 truncate flex items-center gap-2">
                <span>{isAdmin ? 'Rekap Harian Toko & Laba Rugi (P&L)' : 'Rekap Penjualan & Target Kasir'}</span>
                {isAdmin ? (
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${isProfitable ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {isProfitable ? 'Untung' : 'Rugi'}
                  </span>
                ) : (
                  <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${cupAnalytics.isTargetAchieved ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                    {cupAnalytics.isTargetAchieved ? 'Target Tercapai' : `Skor: ${cupAnalytics.targetProgressPct}%`}
                  </span>
                )}
              </h2>
              <p className="text-[10.5px] text-[#D7CCC8] truncate">
                {isAdmin
                  ? 'Laba/Rugi, Arus Kas, Target Cup, Pemakaian Bahan Baku & Cetak Dokumen PDF'
                  : 'Skor Target Pencapaian Cup, Rincian Menu Terjual, Arus Kas Kasir & Cetak PDF'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Print PDF Button */}
            <button
              onClick={handlePrintPDF}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1F1412] font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Cetak atau Simpan Dokumen Rekap ke PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Print PDF</span>
            </button>

            {/* WA Share Button */}
            <button
              onClick={handleShareWA}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Kirim ringkasan laporan ke WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline">Kirim WA</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 flex items-center justify-center transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Tanggal, Outlet, & Opsi Ukuran Kertas Print) */}
        <div className="bg-[#2B1713] text-[#FAF3DD] px-3.5 sm:px-6 py-2.5 border-b border-[#5D4037] flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Picker */}
            <div className="flex items-center gap-1.5 bg-[#3E2723] border border-amber-500/40 rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-amber-200 text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>

            {/* Quick Date Buttons */}
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                selectedDate === todayStr ? 'bg-amber-600 text-white' : 'bg-[#3E2723] text-[#D7CCC8] hover:bg-[#4E342E]'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setSelectedDate(y.toISOString().split('T')[0]);
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#3E2723] text-[#D7CCC8] hover:bg-[#4E342E] transition-colors cursor-pointer"
            >
              Kemarin
            </button>

            {/* Outlet Filter */}
            {outlets.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#3E2723] border border-amber-500/40 rounded-xl px-2.5 py-1">
                <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  className="bg-transparent text-amber-200 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#2B1713] text-amber-200">Semua Cabang / Outlet</option>
                  {outlets.map((out) => (
                    <option key={out.id} value={out.id} className="bg-[#2B1713] text-amber-200">
                      {out.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mode Print Format Picker (A4 Dokumen / Struk 80mm) */}
          <div className="flex items-center gap-1 bg-[#3E2723] p-0.5 rounded-xl border border-[#5D4037]">
            <button
              onClick={() => setPrintMode('a4')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                printMode === 'a4' ? 'bg-amber-500 text-[#1F1412]' : 'text-[#D7CCC8] hover:text-white'
              }`}
            >
              Dokumen A4
            </button>
            <button
              onClick={() => setPrintMode('thermal')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                printMode === 'thermal' ? 'bg-amber-500 text-[#1F1412]' : 'text-[#D7CCC8] hover:text-white'
              }`}
            >
              Struk 80mm
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="bg-[#F5EBE0] px-3.5 sm:px-6 py-2 border-b border-[#E6D5C3] flex items-center gap-1.5 overflow-x-auto scrollbar-none touch-pan-x">
          <button
            onClick={() => setActiveTab('semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'semua' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#5D4037] hover:bg-[#EBE3D5]'
            }`}
          >
            📋 {isAdmin ? 'Semua Rekap Lengkap' : 'Semua Rekap Kasir'}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('untung_rugi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'untung_rugi' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#5D4037] hover:bg-[#EBE3D5]'
              }`}
            >
              💰 Untung &amp; Rugi (P&amp;L)
            </button>
          )}
          <button
            onClick={() => setActiveTab('cup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cup' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#5D4037] hover:bg-[#EBE3D5]'
            }`}
          >
            <CupSoda className="w-3.5 h-3.5 text-amber-500" />
            <span>{isAdmin ? 'Target & Cup' : 'Skor Target Cup'} ({cupAnalytics.totalCupsUsed}/{cupAnalytics.dailyTargetCup})</span>
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'menu' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#5D4037] hover:bg-[#EBE3D5]'
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-amber-600" />
            <span>Menu Terjual ({soldProductsSummary.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('kas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'kas' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#5D4037] hover:bg-[#EBE3D5]'
            }`}
          >
            💵 {isAdmin ? 'Arus Kas Masuk & Keluar' : 'Arus Kas Kasir'}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('bahan_baku')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bahan_baku' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#5D4037] hover:bg-[#EBE3D5]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Pemakaian Bahan Baku ({ingredientUsageMap.length})</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('aktivitas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'aktivitas' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#5D4037] hover:bg-[#EBE3D5]'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${troubleLogs.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>{isAdmin ? `Keterangan Aktivitas & Trobel (${troubleLogs.length})` : `Shift & Transaksi (${validTransactions.length})`}</span>
          </button>
        </div>

        {/* Scrollable Main Content & Printable Document Container */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-6">
          <div id="rekap-harian-print-container" className="space-y-6 bg-white p-4 sm:p-7 rounded-2xl border border-amber-200/80 shadow-xs">
            {/* Printable Document Official Header */}
            <div className="border-b-2 border-[#3E2723] pb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-amber-200" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#3E2723] text-[#FAF3DD] flex items-center justify-center font-bold text-xl">
                    {settings.storeName ? settings.storeName.charAt(0) : 'S'}
                  </div>
                )}
                <div>
                  <h1 className="font-black text-base sm:text-xl text-[#2B1713] uppercase tracking-tight">
                    {settings.storeName || 'Kedai Kopi Wahid Su-Qur'}
                  </h1>
                  <p className="text-xs text-gray-600">
                    {settings.address} {settings.phone ? `• Telp: ${settings.phone}` : ''}
                  </p>
                  <p className="text-[11px] text-amber-900 font-semibold mt-0.5">
                    Cabang: {selectedOutletId === 'ALL' ? 'Semua Cabang' : outlets.find((o) => o.id === selectedOutletId)?.name || 'Pusat'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block bg-[#3E2723] text-[#FAF3DD] text-xs font-black px-3 py-1 rounded-lg uppercase tracking-wider">
                  {isAdmin ? 'Rekapitulasi Harian & Laba Rugi' : 'Rekap Penjualan & Target Kasir'}
                </div>
                <div className="text-xs font-bold text-gray-800 mt-1">Tanggal: {formatDate(selectedDate)}</div>
                {!isAdmin && (
                  <div className="text-[11px] font-semibold text-amber-950 mt-0.5">
                    Kasir: {currentUser?.name || validTransactions[0]?.cashierName || 'Kasir Bertugas'}
                  </div>
                )}
                <div className="text-[10px] text-gray-500">Dicetak: {formatDateTime(new Date().toISOString())}</div>
              </div>
            </div>

            {/* SEKSI 1: RINGKASAN LABA & RUGI (PROFIT & LOSS) - KHUSUS ADMIN */}
            {(activeTab === 'semua' || activeTab === 'untung_rugi') && isAdmin && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-[#2B1713] uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-700" />
                    <span>1. Ringkasan Keuangan Untung & Rugi (Laba/Rugi Harian)</span>
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${isProfitable ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                    Status: {isProfitable ? `🟢 UNTUNG (Margin ${netMarginPct.toFixed(1)}%)` : `🔴 RUGI (${netMarginPct.toFixed(1)}%)`}
                  </span>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-bold text-amber-900">Penjualan Kotor (Omzet)</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{formatRp(netSales)}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{validTransactions.length} Struk Penjualan</div>
                  </div>

                  <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-bold text-orange-900">Total HPP Bahan Baku</div>
                    <div className="text-sm sm:text-base font-black text-orange-700 mt-0.5">-{formatRp(totalCogs)}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Biaya Pokok Menu Terjual</div>
                  </div>

                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-bold text-blue-900">Laba Kotor (Gross Profit)</div>
                    <div className="text-sm sm:text-base font-black text-blue-900 mt-0.5">{formatRp(grossProfit)}</div>
                    <div className="text-[10px] text-blue-700 font-semibold mt-0.5">Margin: {grossMarginPct.toFixed(1)}%</div>
                  </div>

                  <div className={`border rounded-xl p-3 ${isProfitable ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' : 'bg-rose-50/80 border-rose-300 text-rose-950'}`}>
                    <div className="text-[10px] uppercase font-bold">Laba Bersih Harian</div>
                    <div className="text-sm sm:text-base font-black mt-0.5">{formatRp(netProfit)}</div>
                    <div className="text-[10px] font-semibold mt-0.5">{isProfitable ? 'Laba Bersih Setelah Biaya' : 'Mengalami Defisit Harian'}</div>
                  </div>
                </div>

                {/* Highlight Cup & Overhead Target Banner (Khusus Admin) */}
                {isAdmin && (
                  <div className="bg-gradient-to-r from-[#FAF3DD] to-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#3E2723] text-amber-300 flex items-center justify-center shrink-0">
                        <CupSoda className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#2B1713] flex items-center gap-2">
                          <span>Target Pemakaian Cup &amp; Overhead:</span>
                          <span className={`px-2 py-0.2 rounded-md text-[10px] font-black ${
                            cupAnalytics.isTargetAchieved ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                          }`}>
                            {cupAnalytics.totalCupsUsed} / {cupAnalytics.dailyTargetCup} Cup ({cupAnalytics.targetProgressPct}%)
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600">
                          Alokasi Overhead: <strong>{formatRp(cupAnalytics.overheadPerCup)}/cup</strong> • Pemulihan terkumpul: <strong>{formatRp(cupAnalytics.recoveredOverheadToday)}</strong> dari target harian <strong>{formatRp(cupAnalytics.dailyOverheadExpense)}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('cup')}
                      className="self-start sm:self-auto px-2.5 py-1 bg-[#3E2723] hover:bg-[#5D4037] text-amber-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Rincian Cup &amp; Target</span>
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Tabel Rincian P&L */}
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-2 text-left">Komponen Finansial</th>
                      <th className="p-2 text-right">Nilai (Rp)</th>
                      <th className="p-2 text-right hidden sm:table-cell">Persentase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="p-2 font-medium">Total Penjualan Kotor (Gross Revenue)</td>
                      <td className="p-2 text-right font-black text-slate-900">{formatRp(grossSales)}</td>
                      <td className="p-2 text-right hidden sm:table-cell text-gray-500">100.0%</td>
                    </tr>
                    {totalDiscount > 0 && (
                      <tr className="text-rose-700">
                        <td className="p-2 pl-4">Potongan Diskon / Promosi</td>
                        <td className="p-2 text-right font-semibold">-{formatRp(totalDiscount)}</td>
                        <td className="p-2 text-right hidden sm:table-cell">{netSales > 0 ? `-${((totalDiscount / netSales) * 100).toFixed(1)}%` : '-'}</td>
                      </tr>
                    )}
                    <tr className="text-orange-900">
                      <td className="p-2 pl-4">Harga Pokok Penjualan (HPP / COGS Bahan Terpakai)</td>
                      <td className="p-2 text-right font-semibold text-orange-700">-{formatRp(totalCogs)}</td>
                      <td className="p-2 text-right hidden sm:table-cell">{netSales > 0 ? `${((totalCogs / netSales) * 100).toFixed(1)}%` : '-'}</td>
                    </tr>
                    <tr className="bg-gray-50 font-bold">
                      <td className="p-2">Laba Kotor Penjualan (Gross Profit)</td>
                      <td className="p-2 text-right text-blue-900 font-black">{formatRp(grossProfit)}</td>
                      <td className="p-2 text-right hidden sm:table-cell text-blue-900">{grossMarginPct.toFixed(1)}%</td>
                    </tr>
                    <tr className="text-rose-900">
                      <td className="p-2 pl-4">Beban Kasir & Operasional Toko ({filteredExpenses.length} Pengeluaran)</td>
                      <td className="p-2 text-right font-semibold text-rose-700">-{formatRp(totalExpenses)}</td>
                      <td className="p-2 text-right hidden sm:table-cell">{netSales > 0 ? `${((totalExpenses / netSales) * 100).toFixed(1)}%` : '-'}</td>
                    </tr>
                    <tr className={`font-black text-sm ${isProfitable ? 'bg-emerald-50 text-emerald-950' : 'bg-rose-50 text-rose-950'}`}>
                      <td className="p-2.5">LABA BERSIH HARIAN (NET PROFIT)</td>
                      <td className="p-2.5 text-right">{formatRp(netProfit)}</td>
                      <td className="p-2.5 text-right hidden sm:table-cell">{netMarginPct.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* SEKSI 1 KASIR: SKOR TARGET PENCAPAIAN CUP & PENJUALAN MENU (SIMPEL, JELAS, OPERASIONAL TANPA HPP & BAHAN BAKU) */}
            {(activeTab === 'semua' || activeTab === 'cup' || activeTab === 'menu') && !isAdmin && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-black text-sm text-[#2B1713] uppercase flex items-center gap-1.5">
                    <CupSoda className="w-4 h-4 text-amber-700" />
                    <span>1. Skor Target Pencapaian Cup &amp; Ringkasan Penjualan Kasir</span>
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                      cupAnalytics.isTargetAchieved
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {cupAnalytics.isTargetAchieved
                      ? `🟢 TARGET TERCAPAI (${cupAnalytics.targetProgressPct}%)`
                      : `🟡 SKOR TARGET ${cupAnalytics.targetProgressPct}% (SISA ${cupAnalytics.remainingCupsToTarget} CUP)`}
                  </span>
                </div>

                {/* Scorecard Visual Target Pencapaian Cup Kasir */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border-2 border-amber-300 rounded-2xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-[#2B1713] uppercase tracking-wide flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-amber-700" />
                        <span>Skor Target Penjualan Cup Hari Ini</span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Pencapaian penjualan minuman kemasan cup kasir hari ini
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-black text-[#3E2723]">
                        {cupAnalytics.totalCupsUsed}{' '}
                        <span className="text-sm font-semibold text-gray-500">/ {cupAnalytics.dailyTargetCup} Cup</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar Target Pencapaian Cup */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                      <span>Progres Pencapaian:</span>
                      <span className={cupAnalytics.isTargetAchieved ? 'text-emerald-700 font-black' : 'text-amber-800 font-bold'}>
                        {cupAnalytics.targetProgressPct}% ({cupAnalytics.totalCupsUsed} dari {cupAnalytics.dailyTargetCup} Cup)
                      </span>
                    </div>
                    <div className="w-full h-3.5 bg-amber-100 rounded-full overflow-hidden p-0.5 border border-amber-300">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cupAnalytics.isTargetAchieved
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : cupAnalytics.targetProgressPct >= 75
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                            : 'bg-gradient-to-r from-amber-400 to-rose-400'
                        }`}
                        style={{ width: `${Math.min(cupAnalytics.targetProgressPct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10.5px] text-gray-600 font-medium">
                      <span>0 Cup</span>
                      <span>Target: {cupAnalytics.dailyTargetCup} Cup/hari</span>
                      <span className="font-bold">
                        {cupAnalytics.isTargetAchieved
                          ? `Surplus +${cupAnalytics.totalCupsUsed - cupAnalytics.dailyTargetCup} Cup`
                          : `Kurang ${cupAnalytics.remainingCupsToTarget} Cup lagi`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4 Scorecard Operasional Kasir */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-bold text-amber-900 flex items-center gap-1">
                      <CupSoda className="w-3.5 h-3.5 text-amber-700" />
                      <span>Total Cup Terjual</span>
                    </div>
                    <div className="text-base sm:text-xl font-black text-slate-900 mt-1">
                      {cupAnalytics.totalCupsUsed} <span className="text-xs font-semibold text-gray-500">Cup</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Minuman Kemasan</div>
                  </div>

                  <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-bold text-orange-900 flex items-center gap-1">
                      <Coffee className="w-3.5 h-3.5 text-orange-700" />
                      <span>Total Porsi Menu</span>
                    </div>
                    <div className="text-base sm:text-xl font-black text-orange-800 mt-1">
                      {totalItemsSold} <span className="text-xs font-semibold text-gray-500">Item</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Menu Terjual Hari Ini</div>
                  </div>

                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-bold text-blue-900 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-blue-700" />
                      <span>Total Penjualan</span>
                    </div>
                    <div className="text-base sm:text-xl font-black text-blue-900 mt-1">
                      {formatRp(netSales)}
                    </div>
                    <div className="text-[10px] text-blue-700 font-semibold mt-0.5">Penerimaan Kasir</div>
                  </div>

                  <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3">
                    <div className="text-[10px] uppercase font-bold text-emerald-950 flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Struk Selesai</span>
                    </div>
                    <div className="text-base sm:text-xl font-black text-emerald-900 mt-1">
                      {validTransactions.length} <span className="text-xs font-semibold text-emerald-700">Struk</span>
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Transaksi Valid</div>
                  </div>
                </div>

                {/* Tabel Menu Terjual Kasir (Simpel, Jelas, Tanpa HPP) */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-bold text-[#3E2723] flex items-center justify-between">
                    <span>☕ Rincian Menu Terjual Hari Ini ({soldProductsSummary.length} Produk):</span>
                    <span className="text-[11px] text-gray-500 font-normal">Total {totalItemsSold} Item Terjual</span>
                  </div>
                  {soldProductsSummary.length > 0 ? (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold border-b border-gray-200">
                          <tr>
                            <th className="p-2 text-center w-8">No</th>
                            <th className="p-2 text-left">Nama Menu</th>
                            <th className="p-2 text-left hidden sm:table-cell">Kategori</th>
                            <th className="p-2 text-center">Jumlah Terjual</th>
                            <th className="p-2 text-right">Total Penjualan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {soldProductsSummary.map((item, idx) => (
                            <tr key={`${item.productId}-${item.cupSize || idx}`} className="hover:bg-amber-50/30">
                              <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                              <td className="p-2 font-bold text-slate-900">
                                <span>{item.productName}</span>
                                {item.cupSize && (
                                  <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold">
                                    Cup {item.cupSize}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 hidden sm:table-cell text-gray-600">{item.category}</td>
                              <td className="p-2 text-center font-black text-amber-900">
                                <span className="bg-amber-100/70 px-2 py-0.5 rounded-md">
                                  {item.quantity} {item.cupSize ? 'Cup' : 'Porsi'}
                                </span>
                              </td>
                              <td className="p-2 text-right font-bold text-slate-900">
                                {formatRp(item.totalSales)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-amber-50 font-black border-t border-amber-200 text-[#2B1713]">
                          <tr>
                            <td colSpan={3} className="p-2.5 text-right uppercase">Total Penjualan Menu:</td>
                            <td className="p-2.5 text-center text-amber-900">{totalItemsSold} Item</td>
                            <td className="p-2.5 text-right">{formatRp(netSales)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500 italic">
                      Belum ada transaksi menu tercatat hari ini
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEKSI 2: PENCATATAN KAS KELUAR & MASUK KASIR */}
            {(activeTab === 'semua' || activeTab === 'kas') && (
              <div className="space-y-3 pt-2">
                <h3 className="font-black text-sm text-[#2B1713] uppercase flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span>2. Pencatatan Kas Keluar & Masuk Kasir (Cash Flow Harian)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kas Masuk Table */}
                  <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-950 border-b border-emerald-200 pb-1.5">
                      <span className="flex items-center gap-1"><ArrowDownRight className="w-4 h-4 text-emerald-600" /> Kas Masuk Harian</span>
                      <span>{formatRp(totalCashIn + nonCashSales)}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-gray-700">
                        <span>Modal Awal Kasir (Shift Float)</span>
                        <span className="font-bold">{formatRp(startCashTotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>Penjualan Kasir Tunai (Cash)</span>
                        <span className="font-bold text-emerald-700">+{formatRp(cashSales)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>QRIS Masuk</span>
                        <span className="font-semibold">{formatRp(qrisSales)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>Merchant Delivery / Debit</span>
                        <span className="font-semibold">{formatRp(merchantDeliverySales + debitSales)}</span>
                      </div>
                    </div>
                    <div className="pt-1 border-t border-emerald-200 flex justify-between font-bold text-xs text-emerald-950">
                      <span>Total Tunai Masuk Fisik</span>
                      <span>{formatRp(totalCashIn)}</span>
                    </div>
                  </div>

                  {/* Kas Keluar Table */}
                  <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-950 border-b border-rose-200 pb-1.5">
                      <span className="flex items-center gap-1"><ArrowUpRight className="w-4 h-4 text-rose-600" /> Kas Keluar Harian</span>
                      <span>-{formatRp(totalCashOut)}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      {filteredExpenses.length > 0 ? (
                        filteredExpenses.map((exp) => (
                          <div key={exp.id} className="flex justify-between text-gray-700">
                            <span className="truncate max-w-[200px]">{exp.description || exp.category}</span>
                            <span className="font-bold text-rose-700">-{formatRp(exp.amount)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-500 italic py-2 text-center">Tidak ada pengeluaran kas tercatat hari ini</div>
                      )}
                    </div>
                    <div className="pt-1 border-t border-rose-200 flex justify-between font-bold text-xs text-rose-950">
                      <span>Total Kas Keluar</span>
                      <span>-{formatRp(totalExpenses)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Kas di Laci Kasir */}
                <div className="bg-[#FAF3DD] border border-amber-300 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div>
                    <span className="font-bold text-[#3E2723]">Posisi Saldo Kas Fisik di Laci: </span>
                    <span className="text-gray-600">
                      (Modal Awal {formatRp(startCashTotal)} + Tunai Masuk {formatRp(cashSales)} - Pengeluaran {formatRp(totalExpenses)})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-[#3E2723]">{formatRp(expectedCashInDrawer)}</span>
                    {cashDifferenceTotal !== 0 && (
                      <div className={`text-[10px] font-bold ${cashDifferenceTotal < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Selisih Kas Tutup Shift: {formatRp(cashDifferenceTotal)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SEKSI 3: REKAPITULASI PEMAKAIAN JUMLAH CUP & TARGET HARIAN OVERHEAD OPERASIONAL */}
            {(activeTab === 'semua' || activeTab === 'cup') && (
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-black text-sm text-[#2B1713] uppercase flex items-center gap-1.5">
                    <CupSoda className="w-4 h-4 text-amber-700" />
                    <span>3. Rekapitulasi Pemakaian Cup &amp; Target Harian Overhead Operasional</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                        cupAnalytics.isTargetAchieved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {cupAnalytics.isTargetAchieved
                        ? `🟢 TARGET TERCAPAI (${cupAnalytics.targetProgressPct}%)`
                        : `🟡 PROGRES ${cupAnalytics.targetProgressPct}% (SISA ${cupAnalytics.remainingCupsToTarget} CUP)`}
                    </span>
                  </div>
                </div>

                {/* Target Overhead Progress Card (Khusus Admin) */}
                {isAdmin ? (
                  <>
                    <div className="bg-white border-2 border-amber-400/80 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                        <div>
                          <div className="text-xs font-black text-[#2B1713] uppercase tracking-wide flex items-center gap-1.5">
                            <Target className="w-4 h-4 text-amber-700" />
                            <span>Pencapaian Target Penjualan Cup Harian</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Khusus Admin
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-600 mt-0.5">
                            Berdasarkan target bulanan kedai ({cupAnalytics.monthlyTargetCup.toLocaleString('id-ID')} cup/bln) dibagi 30 hari operasional
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-2xl font-black text-[#3E2723]">
                            {cupAnalytics.totalCupsUsed}{' '}
                            <span className="text-sm font-semibold text-gray-500">/ {cupAnalytics.dailyTargetCup} Cup</span>
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                          <span>Progres Hari Ini:</span>
                          <span className={cupAnalytics.isTargetAchieved ? 'text-emerald-700' : 'text-amber-800'}>
                            {cupAnalytics.targetProgressPct}% ({cupAnalytics.totalCupsUsed} dari {cupAnalytics.dailyTargetCup} Cup)
                          </span>
                        </div>
                        <div className="w-full h-3.5 bg-amber-100 rounded-full overflow-hidden p-0.5 border border-amber-300">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              cupAnalytics.isTargetAchieved
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : cupAnalytics.targetProgressPct >= 75
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                : 'bg-gradient-to-r from-amber-400 to-rose-400'
                            }`}
                            style={{ width: `${Math.min(cupAnalytics.targetProgressPct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10.5px] text-gray-500 font-medium">
                          <span>0 Cup</span>
                          <span>Target BEP: {cupAnalytics.dailyTargetCup} Cup/hari</span>
                          <span>
                            {cupAnalytics.isTargetAchieved
                              ? `Surplus +${cupAnalytics.totalCupsUsed - cupAnalytics.dailyTargetCup} Cup`
                              : `Kurang ${cupAnalytics.remainingCupsToTarget} Cup`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Scorecards Metrik Overhead */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3">
                        <div className="text-[10px] uppercase font-bold text-amber-900 flex items-center gap-1">
                          <CupSoda className="w-3.5 h-3.5 text-amber-700" />
                          <span>Realisasi Cup</span>
                        </div>
                        <div className="text-base sm:text-xl font-black text-slate-900 mt-1">
                          {cupAnalytics.totalCupsUsed} <span className="text-xs font-semibold text-gray-600">Cup</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Kemasan Terpakai ({formatRp(cupAnalytics.totalCupsCost)})
                        </div>
                      </div>

                      <div className="bg-orange-50/80 border border-orange-200 rounded-xl p-3">
                        <div className="text-[10px] uppercase font-bold text-orange-900 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-orange-700" />
                          <span>Target Harian</span>
                        </div>
                        <div className="text-base sm:text-xl font-black text-orange-800 mt-1">
                          {cupAnalytics.dailyTargetCup} <span className="text-xs font-semibold text-gray-600">Cup/hari</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Target {cupAnalytics.monthlyTargetCup.toLocaleString('id-ID')} Cup/bln
                        </div>
                      </div>

                      <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3">
                        <div className="text-[10px] uppercase font-bold text-blue-900 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-blue-700" />
                          <span>Overhead / Cup</span>
                        </div>
                        <div className="text-base sm:text-xl font-black text-blue-900 mt-1">
                          {formatRp(cupAnalytics.overheadPerCup)}
                        </div>
                        <div className="text-[10px] text-blue-700 mt-0.5">
                          Alokasi Biaya Tetap / Cup
                        </div>
                      </div>

                      <div
                        className={`border rounded-xl p-3 ${
                          cupAnalytics.isTargetAchieved
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                            : 'bg-amber-50/80 border-amber-300 text-amber-950'
                        }`}
                      >
                        <div className="text-[10px] uppercase font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Overhead Terkumpul</span>
                        </div>
                        <div className="text-base sm:text-xl font-black mt-1">
                          {formatRp(cupAnalytics.recoveredOverheadToday)}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          Target Harian: {formatRp(cupAnalytics.dailyOverheadExpense)}
                        </div>
                      </div>
                    </div>

                    {/* Kotak Keterangan & Info Analisis Bisnis */}
                    <div className="bg-[#FAF3DD]/80 border border-amber-300 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-[#2B1713]">
                        <Info className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Keterangan &amp; Informasi Beban Operasional (Overhead) per Cup:</span>
                      </div>
                      <div className="text-gray-700 space-y-1 pl-5 list-disc text-[11.5px] leading-relaxed">
                        <p>
                          • <strong>Beban Operasional Toko (Overhead Bulanan):</strong> Kedai memiliki alokasi beban tetap sebesar{' '}
                          <strong>{formatRp(cupAnalytics.monthlyOverheadExpense)} / bulan</strong> (sewa ruko/tempat, gaji karyawan tetap, listrik, air, internet, biaya perawatan mesin, dan operasional rutin).
                        </p>
                        <p>
                          • <strong>Formula Beban per Cup:</strong> Beban bulanan dibagi target penjualan bulanan ({formatRp(cupAnalytics.monthlyOverheadExpense)} ÷ {cupAnalytics.monthlyTargetCup.toLocaleString('id-ID')} cup) = <strong>{formatRp(cupAnalytics.overheadPerCup)} / cup</strong>.
                        </p>
                        <p>
                          • <strong>Target Titik Impas Harian:</strong> Untuk menutup beban operasional harian <strong>{formatRp(cupAnalytics.dailyOverheadExpense)} / hari</strong>, kedai harus menjual minimal <strong>{cupAnalytics.dailyTargetCup} cup/hari</strong>.
                        </p>
                        <p>
                          • <strong>Status Realisasi:</strong> Hari ini telah terjual <strong>{cupAnalytics.totalCupsUsed} cup</strong> ({cupAnalytics.targetProgressPct}%). Nilai overhead yang berhasil ditutup sebesar <strong>{formatRp(cupAnalytics.recoveredOverheadToday)}</strong>{' '}
                          {cupAnalytics.isTargetAchieved ? (
                            <span className="text-emerald-700 font-bold">
                              (Target operasional hari ini TERCAPAI dengan surplus {cupAnalytics.totalCupsUsed - cupAnalytics.dailyTargetCup} cup!).
                            </span>
                          ) : (
                            <span className="text-amber-800 font-bold">
                              (Masih kurang {cupAnalytics.remainingCupsToTarget} cup lagi untuk mengamankan biaya operasional harian penuh).
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Tampilan Kasir: Ringkasan Jumlah Cup Terpakai Tanpa Angka Finansial Overhead */
                  <div className="bg-amber-50/60 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#3E2723] text-amber-300 flex items-center justify-center shrink-0">
                        <CupSoda className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#2B1713]">
                          Total Pemakaian Cup Minuman Hari Ini
                        </div>
                        <div className="text-[11px] text-gray-600">
                          Total fisik kemasan cup terpakai dalam transaksi kasir
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xl font-black text-[#3E2723]">
                        {cupAnalytics.totalCupsUsed} <span className="text-xs font-semibold text-gray-500">Cup</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Kartu Rincian 4 Ukuran Cup */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#3E2723]">
                    📦 Rincian Pemakaian 4 Ukuran Cup &amp; Sisa Stok Kemasan:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {cupAnalytics.breakdown.map((item) => (
                      <div
                        key={item.size}
                        className="bg-white border border-amber-200 rounded-xl p-2.5 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-[#3E2723]">Cup {item.size}</span>
                          <span
                            className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold ${
                              item.currentStock <= 0
                                ? 'bg-rose-100 text-rose-800'
                                : item.isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.currentStock <= 0 ? 'Habis' : item.isLowStock ? 'Menipis' : 'Aman'}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <div className="text-sm font-black text-[#2B1713]">
                            {item.quantityUsed} <span className="text-[11px] font-normal text-gray-500">pcs terpakai</span>
                          </div>
                          <div className="text-[10px] text-gray-500 flex justify-between mt-0.5">
                            <span>Sisa Stok:</span>
                            <span className="font-bold text-slate-800">{item.currentStock.toLocaleString('id-ID')} pcs</span>
                          </div>
                          {isAdmin && (
                            <div className="text-[10px] text-gray-500 flex justify-between">
                              <span>Biaya HPP Cup:</span>
                              <span className="font-semibold text-slate-700">{formatRp(item.totalCost)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Log Minuman yang Menggunakan Cup */}
                {cupAnalytics.drinkDetails.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-xs font-bold text-[#3E2723]">
                      ☕ Menu Minuman Terjual yang Menggunakan Cup Hari Ini ({cupAnalytics.drinkDetails.length} Transaksi):
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs bg-white">
                      {cupAnalytics.drinkDetails.map((drink) => (
                        <div key={drink.id} className="p-2 flex items-center justify-between gap-2 hover:bg-gray-50">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{drink.productName}</span>
                              <span className="text-[10px] text-gray-500 font-normal">({drink.cupSize})</span>
                            </div>
                            <div className="text-[10px] text-gray-500">{drink.invoiceNo} • {drink.time}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md">
                              {drink.quantity} Cup
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SEKSI 4: PENCATATAN KELUAR MASUK BAHAN BAKU (KHUSUS ADMIN) */}
            {(activeTab === 'semua' || activeTab === 'bahan_baku') && isAdmin && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-[#2B1713] uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-700" />
                    <span>4. Pemakaian &amp; Pencatatan Keluar Masuk Bahan Baku</span>
                  </h3>
                  <span className="text-xs text-gray-500">
                    Total Biaya Bahan Terpakai: <strong className="text-slate-900">{formatRp(totalRawMaterialCostUsed)}</strong>
                  </span>
                </div>

                {ingredientUsageMap.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-2 text-left">Nama Bahan Baku</th>
                          <th className="p-2 text-left hidden sm:table-cell">Kategori</th>
                          <th className="p-2 text-right">Terpakai (Keluar)</th>
                          <th className="p-2 text-right hidden sm:table-cell">Biaya / Satuan</th>
                          <th className="p-2 text-right">Total Biaya (HPP)</th>
                          <th className="p-2 text-right">Sisa Stok</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ingredientUsageMap.map((ing) => (
                          <tr key={ing.ingredientId} className={ing.isLowStock ? 'bg-amber-50/50' : ''}>
                            <td className="p-2 font-bold text-slate-900 flex items-center gap-1.5">
                              {ing.isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                              <span>{ing.name}</span>
                            </td>
                            <td className="p-2 hidden sm:table-cell text-gray-600">{ing.category}</td>
                            <td className="p-2 text-right font-black text-amber-900">
                              {Number(ing.quantityUsed.toFixed(2))} {ing.unit}
                            </td>
                            <td className="p-2 text-right hidden sm:table-cell text-gray-500">{formatRp(ing.unitCost)}</td>
                            <td className="p-2 text-right font-bold text-slate-900">{formatRp(ing.totalCost)}</td>
                            <td className="p-2 text-right font-semibold">
                              <span className={ing.currentStock <= 0 ? 'text-rose-600 font-bold' : ing.isLowStock ? 'text-amber-600 font-bold' : 'text-emerald-700'}>
                                {ing.currentStock} {ing.unit}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500 italic">
                    Belum ada bahan baku yang terpotong hari ini atau resep menu belum terhubung.
                  </div>
                )}

                {/* Rincian Bahan Masuk (Restock / Pembelian Hari Ini) */}
                {filteredPurchases.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-xs font-bold text-[#3E2723]">📦 Pembelian / Restock Bahan Baku Masuk Hari Ini:</div>
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-2.5 text-xs space-y-1">
                      {filteredPurchases.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-emerald-950">
                          <span>{p.ingredientName} ({p.quantity} unit) • Supplier: {p.supplierName}</span>
                          <span className="font-bold">{formatRp(p.totalCost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SEKSI 4: KETERANGAN SEMUA AKTIVITAS DARI APLIKASI (TROBEL & AUDIT) */}
            {(activeTab === 'semua' || activeTab === 'aktivitas') && (
              <div className="space-y-3 pt-2">
                <h3 className="font-black text-sm text-[#2B1713] uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>5. Keterangan Semua Aktivitas Dari Aplikasi &amp; Laporan Kendala (Trobel)</span>
                </h3>

                {/* Trouble & Warning Alerts */}
                {troubleLogs.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-rose-900">⚠️ Peringatan Kendala (Trobel) Terdeteksi ({troubleLogs.length}):</div>
                    <div className="space-y-1.5">
                      {troubleLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                            log.type === 'critical'
                              ? 'bg-rose-50 border-rose-300 text-rose-950'
                              : 'bg-amber-50 border-amber-300 text-amber-950'
                          }`}
                        >
                          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${log.type === 'critical' ? 'text-rose-600' : 'text-amber-600'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold flex items-center justify-between">
                              <span>{log.title}</span>
                              <span className="text-[10px] text-gray-500 font-normal">{log.time}</span>
                            </div>
                            <p className="text-[11px] text-gray-700 mt-0.5">{log.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tidak ada kendala / trobel sistem terdeteksi pada tanggal ini. Seluruh stok dan transaksi beroperasi lancar.</span>
                  </div>
                )}

                {/* Log Shift Kasir */}
                {filteredShifts.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-bold text-[#3E2723]">🕒 Catatan Shift Kasir yang Bertugas:</div>
                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs bg-gray-50/50">
                      {filteredShifts.map((s) => (
                        <div key={s.id} className="p-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-bold text-slate-900">{s.cashierName}</span>
                            <span className="text-gray-500 text-[11px] ml-2">
                              Buka: {formatDateTime(s.startTime)} {s.endTime ? `| Tutup: ${formatDateTime(s.endTime)}` : '(Shift Aktif)'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-600 text-[11px]">Modal: {formatRp(s.startCash)} | Tunai Masuk: {formatRp(s.totalSalesCash)}</span>
                            {s.difference !== undefined && (
                              <span className={`ml-2 font-bold ${s.difference < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                Selisih: {formatRp(s.difference)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keterangan Status Sistem POS & Operasional (Simpel & Jelas) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Keterangan Sistem POS &amp; Validasi Operasional Toko:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Sinkronisasi Database</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        Tersinkronisasi Online
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Validasi Transaksi</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">
                        {validTransactions.length} Struk Terverifikasi
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Integritas Data</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">
                        Aman &amp; Tanpa Selisih Rusak
                      </span>
                    </div>
                  </div>
                </div>

                {/* Log Riwayat Struk Transaksi Hari Ini */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-bold text-[#3E2723]">🧾 Keterangan Transaksi & Pemakaian Menu Terjual:</div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs">
                    {menuUsageLogs.length > 0 ? (
                      menuUsageLogs.map((log) => (
                        <div key={log.id} className="p-2 flex items-center justify-between gap-2 hover:bg-gray-50">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{log.invoiceNo}</span>
                              <span className="text-[10px] text-gray-500 font-normal">({log.time})</span>
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-mono">
                                {log.paymentMethod}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-600 truncate mt-0.5">{log.itemsSummary}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-black text-slate-900">{formatRp(log.total)}</div>
                            {isAdmin && <div className="text-[10px] text-gray-400">HPP: {formatRp(log.cogs)}</div>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500 italic">Belum ada transaksi penjualan pada tanggal ini</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Kolom Tanda Tangan Resmi Cetak PDF */}
            <div className="pt-8 border-t border-gray-300 grid grid-cols-2 gap-8 text-xs text-center text-gray-700">
              <div>
                <div className="font-medium">Kasir Bertugas,</div>
                <div className="h-16 flex items-end justify-center">
                  <span className="border-b border-gray-400 w-36 inline-block"></span>
                </div>
                <div className="font-bold text-slate-900 mt-1">
                  ({currentUser?.name || validTransactions[0]?.cashierName || user?.name || 'Kasir Su-Qur'})
                </div>
              </div>

              <div>
                <div className="font-medium">Mengetahui / Owner,</div>
                <div className="h-16 flex items-end justify-center">
                  <span className="border-b border-gray-400 w-36 inline-block"></span>
                </div>
                <div className="font-bold text-slate-900 mt-1">
                  ({settings.storeName || 'Pimpinan Kedai'})
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#2B1713] text-[#FAF3DD] px-3.5 sm:px-6 py-3 border-t border-[#5D4037] flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#D7CCC8]">
            {isAdmin ? (
              <>
                Total Omzet: <strong className="text-amber-300">{formatRp(netSales)}</strong> | Laba Bersih:{' '}
                <strong className={isProfitable ? 'text-emerald-400' : 'text-rose-400'}>{formatRp(netProfit)}</strong>
              </>
            ) : (
              <>
                Total Penjualan Kasir: <strong className="text-amber-300">{formatRp(netSales)}</strong> | Realisasi Cup:{' '}
                <strong className="text-amber-300">{cupAnalytics.totalCupsUsed} Cup ({cupAnalytics.targetProgressPct}%)</strong>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPDF}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1F1412] font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF Rekap</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
