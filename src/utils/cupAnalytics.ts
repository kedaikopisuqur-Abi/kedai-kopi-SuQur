import { Transaction, Ingredient, Product, StoreSettings } from '../types';
import { formatRp, calculateOverheadPerCup } from './formatters';

export interface CupUsageSummary {
  size: string; // '14oz' | '16oz' | '18oz' | '22oz' | string
  label: string;
  volumeInfo: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
  ingredientId?: string;
  ingredientName?: string;
}

export interface DrinkCupDetail {
  id: string;
  productName: string;
  cupSize: string;
  quantity: number;
  totalPrice: number;
  time: string;
  invoiceNo: string;
}

export interface DailyCupTargetAnalytics {
  totalCupsUsed: number;
  totalCupsCost: number;
  breakdown: CupUsageSummary[];
  mostPopular: CupUsageSummary | null;
  anyCupLowStock: boolean;
  drinkDetails: DrinkCupDetail[];

  // Target Harian dari Overhead Operasional
  monthlyTargetCup: number;
  dailyTargetCup: number;
  monthlyOverheadExpense: number;
  dailyOverheadExpense: number;
  overheadPerCup: number;

  // Realisasi & Evaluasi Target
  recoveredOverheadToday: number;
  targetProgressPct: number;
  remainingCupsToTarget: number;
  isTargetAchieved: boolean;
  performanceStatus: 'danger' | 'warning' | 'good' | 'excellent';
  statusMessage: string;
  infoExplanation: string;
}

/**
 * Deteksi apakah sebuah item transaksi merupakan minuman atau menggunakan cup
 */
export function checkIsDrinkOrCup(prod?: Product, item?: any, ingredients: Ingredient[] = []): boolean {
  if (item?.selectedCup) return true;
  if (item?.selectedIce) return true;
  if (item?.variantName && (item.variantName.includes('oz') || item.variantName.toLowerCase().includes('cup'))) return true;
  if (!prod) return true;
  if (prod.cupOptions && prod.cupOptions.length > 0) return true;
  if (prod.hasIceOption) return true;
  const cat = (prod.category || '').toLowerCase();
  if (['kopi', 'coffee', 'non-kopi', 'non-coffee', 'tea', 'teh', 'signature', 'beverage', 'minuman', 'cold brew', 'latte', 'drink'].some((k) => cat.includes(k))) return true;
  const n = prod.name.toLowerCase();
  if (['kopi', 'coffee', 'espresso', 'latte', 'cappuccino', 'tea', 'teh', 'matcha', 'chocolate', 'cokelat', 'susu', 'milk', 'shake', 'juice', 'jus', 'kurma drink', 'boba'].some((k) => n.includes(k))) return true;
  if (prod.recipe?.some((r) => {
    const ing = ingredients.find((i) => i.id === r.ingredientId);
    return ing && (ing.name.toLowerCase().includes('cup') || ing.id.includes('cup') || ing.id === 'ing-8');
  })) return true;
  return false;
}

/**
 * Deteksi ukuran cup dari item transaksi atau resep produk
 */
export function getCupSizeFromItem(item: any, prod?: Product, ingredients: Ingredient[] = []): string {
  if (item?.selectedCup) {
    const s = String(item.selectedCup).trim().toLowerCase();
    if (s.includes('14')) return '14oz';
    if (s.includes('18')) return '18oz';
    if (s.includes('22')) return '22oz';
    return '16oz';
  }
  if (item?.variantName) {
    const v = String(item.variantName).toLowerCase();
    if (v.includes('14oz') || v.includes('14 oz') || v.includes('small')) return '14oz';
    if (v.includes('18oz') || v.includes('18 oz') || v.includes('large')) return '18oz';
    if (v.includes('22oz') || v.includes('22 oz') || v.includes('jumbo')) return '22oz';
    if (v.includes('16oz') || v.includes('16 oz') || v.includes('medium')) return '16oz';
  }
  if (prod?.recipe) {
    for (const r of prod.recipe) {
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      if (ing && (ing.name.toLowerCase().includes('cup') || ing.id.includes('cup') || ing.id === 'ing-8')) {
        const n = ing.name.toLowerCase();
        if (n.includes('14') || ing.id === 'ing-cup-14') return '14oz';
        if (n.includes('18') || ing.id === 'ing-cup-18') return '18oz';
        if (n.includes('22') || ing.id === 'ing-cup-22') return '22oz';
        return '16oz';
      }
    }
  }
  return '16oz'; // Default ukuran reguler standard Su-Qur
}

/**
 * Hitung seluruh analitik pemakaian cup dan perbandingannya dengan target harian overhead operasional
 */
export function calculateCupUsageAndTargetAnalytics(
  transactions: Transaction[],
  ingredients: Ingredient[],
  products: Product[],
  settings?: StoreSettings
): DailyCupTargetAnalytics {
  const standardSizes: { size: string; label: string; volumeInfo: string; defaultIngId: string; defaultCost: number }[] = [
    { size: '14oz', label: 'Cup 14oz (Small)', volumeInfo: '±390ml - Es Kopi Sedang', defaultIngId: 'ing-cup-14', defaultCost: 500 },
    { size: '16oz', label: 'Cup 16oz (Medium / Reguler)', volumeInfo: '±470ml - Ukuran Standar Su-Qur', defaultIngId: 'ing-8', defaultCost: 650 },
    { size: '18oz', label: 'Cup 18oz (Large)', volumeInfo: '±530ml - Porsi Besar', defaultIngId: 'ing-cup-18', defaultCost: 750 },
    { size: '22oz', label: 'Cup 22oz (Jumbo)', volumeInfo: '±650ml - Porsi Ekstra Jumbo', defaultIngId: 'ing-cup-22', defaultCost: 900 },
  ];

  const cupMap = new Map<string, CupUsageSummary>();

  const findCupIng = (size: string, defaultId: string) => {
    return (
      ingredients.find((ing) => ing.id === defaultId) ||
      ingredients.find((ing) => {
        const n = ing.name.toLowerCase();
        const target = size.toLowerCase();
        return (n.includes(target) || n.includes(`${target} `)) && (n.includes('cup') || ing.category?.toLowerCase() === 'kemasan');
      })
    );
  };

  standardSizes.forEach((std) => {
    const matchedIng = findCupIng(std.size, std.defaultIngId);
    cupMap.set(std.size, {
      size: std.size,
      label: std.label,
      volumeInfo: std.volumeInfo,
      quantityUsed: 0,
      unitCost: matchedIng?.costPerUnit || std.defaultCost,
      totalCost: 0,
      currentStock: matchedIng?.currentStock ?? 3000,
      minStock: matchedIng?.minStock ?? 500,
      isLowStock: (matchedIng?.currentStock ?? 3000) <= (matchedIng?.minStock ?? 500),
      ingredientId: matchedIng?.id || std.defaultIngId,
      ingredientName: matchedIng?.name || `Cup Plastic ${std.size}`,
    });
  });

  const drinkDetails: DrinkCupDetail[] = [];

  transactions.forEach((tx) => {
    if (tx.status === 'voided') return;
    tx.items?.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (checkIsDrinkOrCup(prod, item, ingredients)) {
        const size = getCupSizeFromItem(item, prod, ingredients);
        const qty = item.quantity || 1;

        let cupData = cupMap.get(size);
        if (!cupData) {
          const matchedIng = findCupIng(size, 'ing-8');
          cupData = {
            size,
            label: `Cup ${size}`,
            volumeInfo: 'Gelas Minuman',
            quantityUsed: 0,
            unitCost: matchedIng?.costPerUnit || 650,
            totalCost: 0,
            currentStock: matchedIng?.currentStock ?? 1000,
            minStock: matchedIng?.minStock ?? 200,
            isLowStock: (matchedIng?.currentStock ?? 1000) <= (matchedIng?.minStock ?? 200),
            ingredientId: matchedIng?.id,
            ingredientName: matchedIng?.name || `Cup Plastic ${size}`,
          };
          cupMap.set(size, cupData);
        }

        cupData.quantityUsed += qty;
        cupData.totalCost += cupData.unitCost * qty;

        drinkDetails.push({
          id: `${tx.id}-${item.productId}-${size}`,
          productName: item.productName,
          cupSize: size,
          quantity: qty,
          totalPrice: item.totalPrice,
          time: tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
          invoiceNo: tx.invoiceNo,
        });
      }
    });
  });

  const breakdown = Array.from(cupMap.values());
  const totalCupsUsed = breakdown.reduce((sum, c) => sum + c.quantityUsed, 0);
  const totalCupsCost = breakdown.reduce((sum, c) => sum + c.totalCost, 0);
  const mostPopular = [...breakdown].sort((a, b) => b.quantityUsed - a.quantityUsed)[0] || null;
  const anyCupLowStock = breakdown.some((c) => c.isLowStock);

  // Target Harian dari Overhead Operasional
  const monthlyTargetCup = settings?.monthlyTargetSalesCup && settings.monthlyTargetSalesCup > 0 ? settings.monthlyTargetSalesCup : 3000;
  const monthlyOverheadExpense = settings?.monthlyOperationalExpense && settings.monthlyOperationalExpense > 0 ? settings.monthlyOperationalExpense : 12000000;
  const dailyTargetCup = Math.max(1, Math.round(monthlyTargetCup / 30));
  const dailyOverheadExpense = Math.round(monthlyOverheadExpense / 30);
  const overheadPerCup = calculateOverheadPerCup(monthlyOverheadExpense, monthlyTargetCup) || 4000;

  const recoveredOverheadToday = totalCupsUsed * overheadPerCup;
  const targetProgressPct = Math.round((totalCupsUsed / dailyTargetCup) * 100);
  const remainingCupsToTarget = Math.max(0, dailyTargetCup - totalCupsUsed);
  const isTargetAchieved = totalCupsUsed >= dailyTargetCup;

  let performanceStatus: 'danger' | 'warning' | 'good' | 'excellent' = 'danger';
  let statusMessage = '';

  if (isTargetAchieved) {
    performanceStatus = 'excellent';
    const surplus = totalCupsUsed - dailyTargetCup;
    statusMessage = surplus > 0 
      ? `🎉 Target harian terlampaui (+${surplus} cup surplus)! Biaya overhead operasional hari ini tertutup 100%.`
      : `🎉 Target harian pas tercapai! Biaya operasional tetap hari ini telah tertutup penuh (${formatRp(recoveredOverheadToday)}).`;
  } else if (targetProgressPct >= 75) {
    performanceStatus = 'good';
    statusMessage = `⚡ Sedikit lagi! Sisa ${remainingCupsToTarget} cup lagi untuk menutup penuh target overhead harian Rp ${formatRp(dailyOverheadExpense)}.`;
  } else if (targetProgressPct >= 40) {
    performanceStatus = 'warning';
    statusMessage = `⏳ Tercapai ${totalCupsUsed} dari ${dailyTargetCup} cup (${targetProgressPct}%). Nilai pemulihan overhead saat ini ${formatRp(recoveredOverheadToday)}.`;
  } else {
    performanceStatus = 'danger';
    statusMessage = `⚠️ Realisasi ${totalCupsUsed} cup (${targetProgressPct}% dari target ${dailyTargetCup} cup/hari). Butuh ${remainingCupsToTarget} cup lagi agar biaya tetap tidak defisit.`;
  }

  const infoExplanation = `Target harian ${dailyTargetCup} cup dihitung dari target bulanan ${monthlyTargetCup.toLocaleString('id-ID')} cup/bulan dibagi 30 hari. Berdasarkan total anggaran biaya tetap operasional Rp ${formatRp(monthlyOverheadExpense)}/bulan (sewa, gaji, listrik, air, dan pemeliharaan alat), setiap cup yang terjual mengalokasikan Rp ${formatRp(overheadPerCup)} untuk menutup biaya operasional harian sebesar Rp ${formatRp(dailyOverheadExpense)}.`;

  return {
    totalCupsUsed,
    totalCupsCost,
    breakdown,
    mostPopular: mostPopular && mostPopular.quantityUsed > 0 ? mostPopular : null,
    anyCupLowStock,
    drinkDetails,
    monthlyTargetCup,
    dailyTargetCup,
    monthlyOverheadExpense,
    dailyOverheadExpense,
    overheadPerCup,
    recoveredOverheadToday,
    targetProgressPct,
    remainingCupsToTarget,
    isTargetAchieved,
    performanceStatus,
    statusMessage,
    infoExplanation,
  };
}
