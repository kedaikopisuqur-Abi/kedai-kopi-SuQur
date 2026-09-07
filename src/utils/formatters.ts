import { Ingredient, RecipeItem, Transaction, StoreSettings, Shift, PaymentMethod, PayrollRecord } from '../types';
import html2canvas from 'html2canvas';

// Pre-instantiated Intl formatters for high performance rendering without GC churn
const idNumberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

const idDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const idDateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const idTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatRp(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rp 0';
  return 'Rp ' + idNumberFormatter.format(Math.round(amount));
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return idDateFormatter.format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return idDateTimeFormatter.format(d);
  } catch {
    return dateString;
  }
}

// Helper format waktu lokal WIB
export const formatWaktuLokal = (isoString: string): string => {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '-';
    return idTimeFormatter.format(date) + ' WIB';
  } catch {
    return '-';
  }
};

export function getPaymentMethodLabel(method: PaymentMethod | string): string {
  switch (method) {
    case 'cash':
      return 'Tunai (Cash)';
    case 'qris':
      return 'QRIS';
    case 'debit':
      return 'Kartu / EDC Debit';
    case 'shopeefood':
      return 'ShopeeFood';
    case 'gofood':
      return 'GoFood (GoBiz)';
    case 'grabfood':
      return 'GrabFood';
    case 'gopay_shopee':
      return 'E-Wallet';
    default:
      return (method || 'Lainnya').toUpperCase();
  }
}

/**
 * Calculates Overhead cost per cup/portion from monthly operational expense and monthly sales target
 * Formula: Overhead per Cup = Total Biaya Operasional Bulanan / Target Sales Cup
 * Variabel Overhead mencakup: Listrik, Air, Perawatan Alat, Biaya Pekerja/Gaji Karyawan, Sewa Tempat, dll.
 */
export function calculateOverheadPerCup(monthlyOperationalExpense?: number, monthlyTargetSalesCup?: number): number {
  const expense = Number(monthlyOperationalExpense) || 0;
  const target = Number(monthlyTargetSalesCup) || 0;
  if (expense <= 0 || target <= 0) return 0;
  return Math.round(expense / target);
}

/**
 * Calculates raw material and packaging costs from recipe items
 * Variabel 1: Biaya Bahan Baku + Kemasan (Cup/Sablon/Sedotan/Tutup/Botol)
 */
export function calculateRawMaterialCost(recipe: RecipeItem[], ingredients: Ingredient[]): number {
  if (!recipe || recipe.length === 0) return 0;

  return recipe.reduce((total, item) => {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing) return total;
    return total + (Number(ing.costPerUnit) || 0) * (Number(item.amount) || 0);
  }, 0);
}

/**
 * Calculates detailed HPP (Harga Pokok Penjualan / COGS) breakdown integrating:
 * 1. Biaya Bahan Baku + Kemasan (Cup/Sablon/Sedotan)
 * 2. Alokasi Biaya Overhead per porsi (Listrik, Air, Perawatan Alat, Biaya Pekerja)
 * 3. Total HPP = Biaya Bahan & Kemasan + Biaya Overhead
 */
export function calculateProductCogsBreakdown(
  recipe: RecipeItem[],
  ingredients: Ingredient[],
  overheadCostPerCup: number = 0
): {
  rawMaterialCost: number;
  overheadCost: number;
  totalCogs: number;
} {
  const rawMaterialCost = Math.round(calculateRawMaterialCost(recipe, ingredients));
  const overheadCost = Math.max(0, Math.round(Number(overheadCostPerCup) || 0));
  const totalCogs = rawMaterialCost + overheadCost;

  return {
    rawMaterialCost,
    overheadCost,
    totalCogs,
  };
}

/**
 * Calculates HPP (Harga Pokok Penjualan / COGS) for a product based on its recipe and ingredient costs,
 * plus optional overhead allocation per portion.
 */
export function calculateProductCogs(
  recipe: RecipeItem[],
  ingredients: Ingredient[],
  overheadCostPerCup: number = 0
): number {
  const raw = calculateRawMaterialCost(recipe, ingredients);
  const overhead = Math.max(0, Number(overheadCostPerCup) || 0);
  return Math.round(raw + overhead);
}

/**
 * Calculates Gross Profit (Rp), Gross Profit Margin (%), and Profitability Health Status real-time
 * Formula:
 * - Gross Profit (Rp) = Harga Jual - Total HPP
 * - Gross Profit (%) = (Gross Profit / Harga Jual) * 100%
 */
export function calculateGrossProfitMargin(sellingPrice: number, totalCogs: number): {
  grossProfitRp: number;
  grossProfitPercent: number;
  status: 'healthy' | 'moderate' | 'low' | 'loss';
  statusLabel: string;
  badgeColor: string;
} {
  const price = Number(sellingPrice) || 0;
  const cogs = Number(totalCogs) || 0;
  const grossProfitRp = price - cogs;
  const grossProfitPercent = price > 0 ? (grossProfitRp / price) * 100 : 0;
  const roundedPercent = Math.round(grossProfitPercent * 10) / 10;

  if (grossProfitRp < 0) {
    return {
      grossProfitRp,
      grossProfitPercent: roundedPercent,
      status: 'loss',
      statusLabel: 'RUGI / Defisit',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    };
  }

  if (grossProfitPercent < 30) {
    return {
      grossProfitRp,
      grossProfitPercent: roundedPercent,
      status: 'low',
      statusLabel: 'Margin Tipis (< 30%)',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }

  if (grossProfitPercent < 55) {
    return {
      grossProfitRp,
      grossProfitPercent: roundedPercent,
      status: 'moderate',
      statusLabel: 'Margin Standar (30-55%)',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    };
  }

  return {
    grossProfitRp,
    grossProfitPercent: roundedPercent,
    status: 'healthy',
    statusLabel: 'Margin Sangat Sehat (> 55%)',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  };
}

/**
 * Downloads data as CSV file for Excel compatibility
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper to resolve Outlet Name, Address, and Phone Number from transaction/shift and settings
 */
export function resolveOutletInfo(
  entity: { outletId?: string; outletName?: string } | undefined,
  settings: StoreSettings
): { name: string; address: string; phone: string } {
  const outlets = settings.outlets || [];
  let foundOutlet = entity?.outletId ? outlets.find((o) => o.id === entity.outletId) : null;
  
  if (!foundOutlet && entity?.outletName) {
    foundOutlet = outlets.find((o) => o.name.toLowerCase() === entity.outletName?.toLowerCase()) || null;
  }

  if (!foundOutlet && outlets.length > 0) {
    foundOutlet = outlets.find((o) => o.isDefault) || outlets[0];
  }

  const name = entity?.outletName || foundOutlet?.name || (outlets[0]?.name) || 'Cabang Utama';
  const address = foundOutlet?.address || settings.address || 'Alamat Cabang';
  const phone = foundOutlet?.phone || settings.phone || '-';

  return { name, address, phone };
}

/**
 * Generates formatted text layout for 58mm or 80mm thermal printers
 */
export function formatThermalReceipt(tx: Transaction, settings: StoreSettings): string {
  if (!tx) return '';
  const items = Array.isArray(tx.items) ? tx.items : [];
  const lineLength = settings.printerPaperSize === '58mm' ? 32 : 42;
  const divider = '-'.repeat(lineLength);
  const doubleDivider = '='.repeat(lineLength);

  const centerText = (str: string) => {
    if (!str) return '';
    if (str.length >= lineLength) return str.substring(0, lineLength);
    const pad = Math.floor((lineLength - str.length) / 2);
    return ' '.repeat(pad) + str;
  };

  const justifyText = (left: string, right: string) => {
    left = left || '';
    right = right || '';
    const spaceNeeded = lineLength - left.length - right.length;
    if (spaceNeeded <= 0) return left.substring(0, lineLength - right.length - 1) + ' ' + right;
    return left + ' '.repeat(spaceNeeded) + right;
  };

  const outletInfo = resolveOutletInfo(tx, settings);

  let lines: string[] = [];
  lines.push(centerText(settings.storeName.toUpperCase()));
  if (outletInfo.name) {
    lines.push(centerText(outletInfo.name.toUpperCase()));
  }
  if (settings.tagline) lines.push(centerText(settings.tagline));
  if (outletInfo.address) lines.push(centerText(outletInfo.address));
  if (outletInfo.phone && outletInfo.phone !== '-') lines.push(centerText(`Telp/WA: ${outletInfo.phone}`));
  lines.push(doubleDivider);

  // Prominent Queue Number
  if (tx.queueNo) {
    lines.push(centerText('NO. ANTRIAN'));
    lines.push(centerText(`[ ${tx.queueNo} ]`));
    lines.push(divider);
  }

  const isOnlineOrder =
    tx.orderType === 'online_delivery' ||
    tx.onlinePlatform ||
    ['shopeefood', 'gofood', 'grabfood'].includes(tx.paymentMethod);

  if (isOnlineOrder) {
    const platformName = tx.onlinePlatform || (tx.paymentMethod === 'shopeefood' ? 'ShopeeFood' : tx.paymentMethod === 'gofood' ? 'GoFood' : tx.paymentMethod === 'grabfood' ? 'GrabFood' : 'PESANAN ONLINE');
    lines.push(centerText(`*** PESANAN ONLINE (${platformName.toUpperCase()}) ***`));
    if (tx.onlineOrderNo) lines.push(justifyText('No. Order App:', tx.onlineOrderNo));
    if (tx.driverName) lines.push(justifyText('Driver/Ojol:', tx.driverName));
    lines.push(divider);
  }

  lines.push(justifyText(`No: ${tx.invoiceNo || '-'}`, formatDateTime(tx.timestamp || new Date().toISOString()).split(',')[1] || ''));
  lines.push(justifyText(`Kasir: ${tx.cashierName || 'Kasir'}`, `Tgl: ${formatDate(tx.timestamp || new Date().toISOString())}`));
  if (tx.customerName) lines.push(justifyText(`Pelanggan: ${tx.customerName}`, tx.tableNo ? `Meja: ${tx.tableNo}` : ''));
  lines.push(divider);

  items.forEach((item) => {
    let itemTitle = item.productName;
    const details: string[] = [];
    if (item.selectedCup) details.push(`Cup ${item.selectedCup}`);
    if (item.selectedIce) details.push(item.selectedIce);
    if (item.variantName && !details.some((d) => item.variantName?.includes(d))) {
      details.push(item.variantName);
    }
    if (details.length > 0) {
      itemTitle += ` (${details.join(', ')})`;
    }

    lines.push(itemTitle);
    const qtyPrice = `${item.quantity} x ${formatRp(item.unitPrice)}`;
    const totalStr = formatRp(item.totalPrice);
    lines.push(justifyText(`  ${qtyPrice}`, totalStr));
    if (item.notes) {
      lines.push(`  * Note: ${item.notes}`);
    }
  });

  lines.push(divider);
  lines.push(justifyText('Subtotal:', formatRp(tx.subtotal || 0)));
  if (tx.discount && tx.discount > 0) lines.push(justifyText('Diskon:', `-${formatRp(tx.discount)}`));
  if (tx.tax && tx.tax > 0) lines.push(justifyText(`PPN (${settings.taxPercentage}%):`, formatRp(tx.tax)));
  lines.push(doubleDivider);
  lines.push(justifyText('TOTAL:', formatRp(tx.total || 0)));

  const payLabel = getPaymentMethodLabel(tx.paymentMethod || 'cash');
  lines.push(justifyText(`Bayar (${payLabel}):`, formatRp(tx.cashAmountPaid || tx.total || 0)));
  if (tx.changeAmount && tx.changeAmount > 0) {
    lines.push(justifyText('Kembali:', formatRp(tx.changeAmount)));
  }
  lines.push(divider);

  if (settings.receiptHeader) {
    settings.receiptHeader.split('\n').forEach((l) => lines.push(centerText(l)));
  }
  if (settings.receiptFooter) {
    settings.receiptFooter.split('\n').forEach((l) => lines.push(centerText(l)));
  }

  return lines.join('\n');
}

/**
 * Generates formatted Kitchen / Barista Order Ticket (KOT) for Chef & Barista
 */
export function formatKitchenTicketThermal(tx: Transaction, settings: StoreSettings): string {
  if (!tx) return '';
  const items = Array.isArray(tx.items) ? tx.items : [];
  const lineLength = settings.printerPaperSize === '58mm' ? 32 : 42;
  const divider = '-'.repeat(lineLength);
  const doubleDivider = '='.repeat(lineLength);

  const centerText = (str: string) => {
    if (!str) return '';
    if (str.length >= lineLength) return str.substring(0, lineLength);
    const pad = Math.floor((lineLength - str.length) / 2);
    return ' '.repeat(pad) + str;
  };

  const justifyText = (left: string, right: string) => {
    left = left || '';
    right = right || '';
    const spaceNeeded = lineLength - left.length - right.length;
    if (spaceNeeded <= 0) return left.substring(0, lineLength - right.length - 1) + ' ' + right;
    return left + ' '.repeat(spaceNeeded) + right;
  };

  const outletInfo = resolveOutletInfo(tx, settings);

  let lines: string[] = [];
  lines.push(centerText(settings.storeName.toUpperCase()));
  if (outletInfo.name) {
    lines.push(centerText(outletInfo.name.toUpperCase()));
  }
  lines.push(doubleDivider);
  lines.push(centerText('*** TIKET DAPUR / BARISTA ***'));
  lines.push(doubleDivider);

  // Big Prominent Queue Number
  if (tx.queueNo) {
    lines.push(centerText('NO. ANTRIAN PESANAN'));
    lines.push(centerText(`>>> [ ${tx.queueNo} ] <<<`));
    lines.push(doubleDivider);
  }

  // Order Context
  const isOnlineOrder =
    tx.orderType === 'online_delivery' ||
    tx.onlinePlatform ||
    ['shopeefood', 'gofood', 'grabfood'].includes(tx.paymentMethod);

  let orderTypeLabel = 'DINE IN';
  if (isOnlineOrder) {
    const plat = tx.onlinePlatform || (tx.paymentMethod === 'shopeefood' ? 'ShopeeFood' : tx.paymentMethod === 'gofood' ? 'GoFood' : 'Online');
    orderTypeLabel = `ONLINE (${plat})`;
  } else if (tx.orderType === 'take_away' || (tx.orderType as any) === 'takeaway') {
    orderTypeLabel = 'TAKE AWAY / BUNGKUS';
  }

  lines.push(justifyText('Tipe Order:', orderTypeLabel));
  if (tx.tableNo) lines.push(justifyText('Meja / Lokasi:', tx.tableNo));
  if (tx.onlineOrderNo) lines.push(justifyText('No. Order App:', tx.onlineOrderNo));
  if (tx.driverName) lines.push(justifyText('Driver/Ojol:', tx.driverName));
  lines.push(justifyText('Waktu Order:', formatDateTime(tx.timestamp || new Date().toISOString())));
  lines.push(justifyText('No. Faktur:', tx.invoiceNo || '-'));
  lines.push(justifyText('Kasir:', tx.cashierName || 'Kasir'));
  if (tx.customerName) lines.push(justifyText('Pelanggan:', tx.customerName));
  lines.push(divider);

  lines.push(centerText('--- DAFTAR MENU DIPESAN ---'));
  lines.push(divider);

  let totalItemsCount = 0;
  items.forEach((item, idx) => {
    totalItemsCount += item.quantity;
    lines.push(`[ ${item.quantity}x ] ${item.productName.toUpperCase()}`);
    
    if (item.variantName) {
      lines.push(`  • Varian: ${item.variantName}`);
    }
    if (item.selectedCup) {
      lines.push(`  • Cup: ${item.selectedCup}`);
    }
    if (item.selectedIce) {
      lines.push(`  • Es: ${item.selectedIce}`);
    }
    if (item.notes) {
      lines.push(`  ⚠️ CATATAN: ${item.notes}`);
    }
    if (idx < items.length - 1) {
      lines.push('');
    }
  });

  lines.push(divider);
  lines.push(justifyText('TOTAL POS PORSINYA:', `${totalItemsCount} Porsi / Item`));
  lines.push(doubleDivider);
  lines.push(centerText(`Waktu Cetak: ${new Date().toLocaleTimeString('id-ID')} WIB`));
  lines.push(centerText('SEGERA SIAPKAN & SERAHKAN KASIR'));
  lines.push(doubleDivider);

  return lines.join('\n');
}

/**
 * Generates formatted text layout for cashier shift summary on 58mm or 80mm thermal printers
 */
export function formatThermalShiftSummary(shift: Shift, settings: StoreSettings): string {
  const lineLength = settings.printerPaperSize === '58mm' ? 32 : 42;
  const divider = '-'.repeat(lineLength);
  const doubleDivider = '='.repeat(lineLength);

  const centerText = (str: string) => {
    if (str.length >= lineLength) return str.substring(0, lineLength);
    const pad = Math.floor((lineLength - str.length) / 2);
    return ' '.repeat(pad) + str;
  };

  const justifyText = (left: string, right: string) => {
    const spaceNeeded = lineLength - left.length - right.length;
    if (spaceNeeded <= 0) return left.substring(0, lineLength - right.length - 1) + ' ' + right;
    return left + ' '.repeat(spaceNeeded) + right;
  };

  const outletInfo = resolveOutletInfo(shift as any, settings);

  let lines: string[] = [];
  lines.push(centerText(settings.storeName.toUpperCase()));
  if (outletInfo.name) {
    lines.push(centerText(outletInfo.name.toUpperCase()));
  }
  if (settings.tagline) lines.push(centerText(settings.tagline));
  if (outletInfo.address) lines.push(centerText(outletInfo.address));
  if (outletInfo.phone && outletInfo.phone !== '-') lines.push(centerText(`Telp/WA: ${outletInfo.phone}`));
  lines.push(doubleDivider);
  lines.push(centerText('*** REKAP SHIFT KASIR ***'));
  lines.push(doubleDivider);

  lines.push(justifyText('Kasir:', shift.cashierName));
  lines.push(justifyText('Status:', shift.status === 'open' ? 'SHIFT AKTIF' : 'SHIFT DITUTUP'));
  lines.push(justifyText('Waktu Buka:', formatDateTime(shift.startTime)));
  lines.push(justifyText('Waktu Tutup:', shift.endTime ? formatDateTime(shift.endTime) : 'BERJALAN'));
  lines.push(divider);

  lines.push(justifyText('Modal Awal Laci:', formatRp(shift.startCash)));
  lines.push(justifyText('Penjualan Tunai:', formatRp(shift.totalSalesCash)));
  lines.push(justifyText('Penjualan Non-Tunai:', formatRp(shift.totalSalesNonCash)));
  lines.push(divider);

  const totalOmzet = shift.totalSalesCash + shift.totalSalesNonCash;
  lines.push(justifyText('TOTAL OMZET SHIFT:', formatRp(totalOmzet)));
  lines.push(justifyText('Total Transaksi:', `${shift.totalTransactionsCount} Order`));
  lines.push(divider);

  const expected = shift.expectedEndCash ?? (shift.startCash + shift.totalSalesCash);
  const actual = shift.actualEndCash ?? expected;
  const diff = shift.difference ?? (actual - expected);

  lines.push(justifyText('Ekspektasi Kas Laci:', formatRp(expected)));
  lines.push(justifyText('Uang Fisik Laci:', formatRp(actual)));

  let diffStr = 'PAS (Rp 0)';
  if (diff > 0) diffStr = `+${formatRp(diff)} (SURPLUS)`;
  if (diff < 0) diffStr = `${formatRp(diff)} (MINUS)`;

  lines.push(justifyText('Selisih Kas:', diffStr));
  lines.push(doubleDivider);

  lines.push('');
  lines.push(centerText('Tanda Tangan Kasir:'));
  lines.push('');
  lines.push('');
  lines.push(centerText('( .................... )'));
  lines.push(centerText(shift.cashierName));
  lines.push('');
  lines.push(centerText('Diserahkan Kepada Admin:'));
  lines.push('');
  lines.push('');
  lines.push(centerText('( .................... )'));
  lines.push(centerText('Supervisi / Admin'));
  lines.push(doubleDivider);
  lines.push(centerText('BUKTI FISIK SETORAN SHIFT'));
  lines.push(centerText(`Dicetak: ${formatDateTime(new Date().toISOString())}`));

  return lines.join('\n');
}

/**
 * Sanitizes a phone number string into Indonesian international format (e.g. 62812345678)
 */
export function sanitizePhoneForWA(phone?: string): string {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, ''); // Keep digits only
  if (!clean) return '';
  if (clean.startsWith('0')) {
    clean = '62' + clean.substring(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  if (clean.length < 8) return '';
  return clean;
}

/**
 * Builds structured text message for WhatsApp transaction receipt
 */
export function buildReceiptWhatsAppText(tx: Transaction, settings: StoreSettings): string {
  if (!tx) return '';
  const items = Array.isArray(tx.items) ? tx.items : [];
  const lineLength = 32;
  const divider = '─'.repeat(lineLength);
  const outletInfo = resolveOutletInfo(tx, settings);

  let msg = `🧾 *STRUK PEMBAYARAN*\n`;
  msg += `*${settings.storeName.toUpperCase()}*\n`;
  if (outletInfo.name) msg += `📍 *${outletInfo.name.toUpperCase()}*\n`;
  if (settings.tagline) msg += `_${settings.tagline}_\n`;
  if (outletInfo.address) msg += `🏠 ${outletInfo.address}\n`;
  if (outletInfo.phone && outletInfo.phone !== '-') msg += `📞 Telp/WA: ${outletInfo.phone}\n`;
  msg += `${divider}\n`;

  if (tx.queueNo) {
    msg += `🔢 *NO. ANTRIAN : ${tx.queueNo}*\n`;
    msg += `${divider}\n`;
  }

  const isOnlineOrder =
    tx.orderType === 'online_delivery' ||
    tx.onlinePlatform ||
    ['shopeefood', 'gofood', 'grabfood'].includes(tx.paymentMethod);

  if (isOnlineOrder) {
    const platformName = tx.onlinePlatform || (tx.paymentMethod === 'shopeefood' ? 'ShopeeFood' : tx.paymentMethod === 'gofood' ? 'GoFood' : tx.paymentMethod === 'grabfood' ? 'GrabFood' : 'PESANAN ONLINE');
    msg += `🛵 *PESANAN ONLINE (${platformName.toUpperCase()})*\n`;
    if (tx.onlineOrderNo) msg += `• No. Order App : *${tx.onlineOrderNo}*\n`;
    if (tx.driverName) msg += `• Driver/Ojol   : *${tx.driverName}*\n`;
  }

  msg += `• No. Faktur : *${tx.invoiceNo || '-'}*\n`;
  msg += `• Tanggal    : ${formatDateTime(tx.timestamp || new Date().toISOString())}\n`;
  msg += `• Kasir      : ${tx.cashierName || 'Kasir'}\n`;
  msg += `• Pelanggan  : *${tx.customerName || 'Pelanggan Walk-in'}*\n`;
  if (tx.tableNo) msg += `• Meja/Order : ${tx.tableNo}\n`;
  msg += `${divider}\n`;
  msg += `*RINCIAN PESANAN:*\n`;

  items.forEach((item, idx) => {
    let itemTitle = `${idx + 1}. *${item.productName}*`;
    const details: string[] = [];
    if (item.selectedCup) details.push(`Cup ${item.selectedCup}`);
    if (item.selectedIce) details.push(item.selectedIce);
    if (item.variantName && !details.some((d) => item.variantName?.includes(d))) {
      details.push(item.variantName);
    }
    if (details.length > 0) {
      itemTitle += ` (${details.join(', ')})`;
    }
    msg += `${itemTitle}\n`;
    msg += `   ${item.quantity} x ${formatRp(item.unitPrice)} = *${formatRp(item.totalPrice)}*\n`;
    if (item.notes) {
      msg += `   _Catatan: ${item.notes}_\n`;
    }
  });

  msg += `${divider}\n`;
  msg += `• Subtotal    : ${formatRp(tx.subtotal || 0)}\n`;
  if (tx.discount && tx.discount > 0) msg += `• Diskon      : -${formatRp(tx.discount)}\n`;
  if (tx.tax && tx.tax > 0) msg += `• PPN (${settings.taxPercentage}%) : ${formatRp(tx.tax)}\n`;
  msg += `*• TOTAL BAYAR : ${formatRp(tx.total || 0)}*\n`;

  const payLabel = getPaymentMethodLabel(tx.paymentMethod || 'cash');
  msg += `• Metode      : ${payLabel}\n`;
  if (tx.paymentMethod === 'cash') {
    msg += `• Bayar Tunai : ${formatRp(tx.cashAmountPaid || tx.total || 0)}\n`;
    if (tx.changeAmount && tx.changeAmount > 0) {
      msg += `• Kembalian   : ${formatRp(tx.changeAmount)}\n`;
    }
  }

  msg += `${divider}\n`;
  if (settings.receiptFooter) {
    msg += `${settings.receiptFooter}\n`;
  } else {
    msg += `Terima kasih atas kunjungan Anda!\n`;
  }

  return msg;
}

/**
 * Builds structured text message for Kitchen / Barista Order Ticket (KOT) on WhatsApp
 */
export function buildKitchenTicketWhatsAppText(tx: Transaction, settings: StoreSettings): string {
  if (!tx) return '';
  const items = Array.isArray(tx.items) ? tx.items : [];
  const lineLength = 32;
  const divider = '─'.repeat(lineLength);
  const outletInfo = resolveOutletInfo(tx, settings);

  let msg = `👨‍🍳 *TIKET PESANAN DAPUR & BARISTA*\n`;
  msg += `*${settings.storeName.toUpperCase()}*\n`;
  if (outletInfo.name) msg += `📍 *${outletInfo.name.toUpperCase()}*\n`;
  msg += `${divider}\n`;

  if (tx.queueNo) {
    msg += `🔢 *NO. ANTRIAN : ${tx.queueNo}*\n`;
    msg += `${divider}\n`;
  }

  const isOnlineOrder =
    tx.orderType === 'online_delivery' ||
    tx.onlinePlatform ||
    ['shopeefood', 'gofood', 'grabfood'].includes(tx.paymentMethod);

  let orderTypeLabel = 'DINE IN';
  if (isOnlineOrder) {
    const plat = tx.onlinePlatform || (tx.paymentMethod === 'shopeefood' ? 'ShopeeFood' : tx.paymentMethod === 'gofood' ? 'GoFood' : 'Online');
    orderTypeLabel = `🛵 ONLINE (${plat})`;
  } else if (tx.orderType === 'take_away' || (tx.orderType as any) === 'takeaway') {
    orderTypeLabel = '🛍️ TAKE AWAY';
  }

  msg += `• Tipe Order : *${orderTypeLabel}*\n`;
  if (tx.tableNo) msg += `• Meja/Lokasi: *${tx.tableNo}*\n`;
  if (tx.onlineOrderNo) msg += `• Order App  : *${tx.onlineOrderNo}*\n`;
  if (tx.driverName) msg += `• Driver     : *${tx.driverName}*\n`;
  msg += `• Waktu      : ${formatDateTime(tx.timestamp || new Date().toISOString())}\n`;
  msg += `• No. Faktur : ${tx.invoiceNo || '-'}\n`;
  msg += `• Pelanggan  : *${tx.customerName || '-'}*\n`;
  msg += `• Kasir      : ${tx.cashierName || 'Kasir'}\n`;
  msg += `${divider}\n`;
  msg += `📋 *MENU YANG HARUS DISIAPKAN:*\n\n`;

  let totalQty = 0;
  items.forEach((item, idx) => {
    totalQty += item.quantity;
    msg += `${idx + 1}. *[ ${item.quantity}x ] ${item.productName.toUpperCase()}*\n`;
    if (item.variantName) msg += `   • Varian: ${item.variantName}\n`;
    if (item.selectedCup) msg += `   • Cup: ${item.selectedCup}\n`;
    if (item.selectedIce) msg += `   • Es: ${item.selectedIce}\n`;
    if (item.notes) msg += `   ⚠️ _Catatan: ${item.notes}_\n`;
    msg += `\n`;
  });

  msg += `${divider}\n`;
  msg += `*Total Porsi : ${totalQty} Item*\n`;
  if (outletInfo.address) msg += `🏠 ${outletInfo.address}\n`;
  if (outletInfo.phone && outletInfo.phone !== '-') msg += `📞 Telp/WA: ${outletInfo.phone}\n`;
  msg += `Status: Siapkan segera & serahkan ke meja / kasir.`;

  return msg;
}

/**
 * Builds structured text message for cashier shift summary on WhatsApp
 */
export function buildShiftWhatsAppText(shift: Shift, settings: StoreSettings): string {
  const lineLength = 32;
  const divider = '─'.repeat(lineLength);
  const outletInfo = resolveOutletInfo(shift as any, settings);

  let msg = `📊 *REKAP LAPORAN SHIFT KASIR*\n`;
  msg += `*${settings.storeName.toUpperCase()}*\n`;
  if (outletInfo.name) msg += `📍 *${outletInfo.name.toUpperCase()}*\n`;
  if (outletInfo.address) msg += `🏠 ${outletInfo.address}\n`;
  if (outletInfo.phone && outletInfo.phone !== '-') msg += `📞 Telp/WA: ${outletInfo.phone}\n`;
  msg += `${divider}\n`;
  msg += `• Kasir       : *${shift.cashierName}*\n`;
  msg += `• Status      : ${shift.status === 'open' ? '🟢 SHIFT MASIH AKTIF' : '🔴 SHIFT DITUTUP'}\n`;
  msg += `• Waktu Buka  : ${formatDateTime(shift.startTime)}\n`;
  msg += `• Waktu Tutup : ${shift.endTime ? formatDateTime(shift.endTime) : 'Sedang Berjalan'}\n`;
  msg += `${divider}\n`;
  msg += `• Modal Awal Laci   : ${formatRp(shift.startCash)}\n`;
  msg += `• Penjualan Tunai   : ${formatRp(shift.totalSalesCash)}\n`;
  msg += `• Penjualan QRIS/Non: ${formatRp(shift.totalSalesNonCash)}\n`;
  const totalOmzet = shift.totalSalesCash + shift.totalSalesNonCash;
  msg += `*• TOTAL OMZET SHIFT : ${formatRp(totalOmzet)}*\n`;
  msg += `• Total Transaksi   : ${shift.totalTransactionsCount} Transaksi\n`;
  msg += `${divider}\n`;

  const expected = shift.expectedEndCash ?? (shift.startCash + shift.totalSalesCash);
  const actual = shift.actualEndCash ?? expected;
  const diff = shift.difference ?? (actual - expected);

  msg += `• Ekspektasi Kas Laci : ${formatRp(expected)}\n`;
  msg += `• Uang Fisik Laci     : ${formatRp(actual)}\n`;

  let diffStr = 'PAS (Rp 0)';
  if (diff > 0) diffStr = `SURPLUS +${formatRp(diff)}`;
  if (diff < 0) diffStr = `MINUS ${formatRp(diff)}`;
  msg += `• Selisih Kas         : *${diffStr}*\n`;
  msg += `${divider}\n`;
  msg += `Dicetak & Dikirim: ${formatDateTime(new Date().toISOString())}`;

  return msg;
}

/**
 * Safely and directly opens WhatsApp on Mobile Phone or Desktop Web with target number and message
 */
export function openWhatsApp(phone: string | undefined, text: string, preOpenedWindow?: Window | null) {
  const cleanPhone = sanitizePhoneForWA(phone);
  const encodedText = encodeURIComponent(text);

  // Preferred direct link for mobile and web
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');

  if (preOpenedWindow && !preOpenedWindow.closed) {
    try {
      preOpenedWindow.location.href = waUrl;
      return;
    } catch (err) {
      console.warn('Failed setting preOpenedWindow href:', err);
    }
  }

  // On Mobile: direct window.location or anchor click triggers the WhatsApp native app intent immediately
  try {
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = isMobile ? '_self' : '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 100);
  } catch (err) {
    console.warn('Fallback direct navigation to WhatsApp:', err);
    window.location.href = waUrl;
  }
}

/**
 * Directly downloads and saves a canvas element as an image file (JPG/PNG) into device storage/memory
 */
export async function downloadCanvasImageToDevice(
  canvas: HTMLCanvasElement,
  fileName: string
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // 1. Try Blob download (standard for mobile browser & downloads manager)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Fallback to data URL
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = fileName;
              document.body.appendChild(link);
              link.click();
              setTimeout(() => {
                if (document.body.contains(link)) document.body.removeChild(link);
                resolve(true);
              }, 100);
            } catch (e) {
              console.error('DataURL download failed:', e);
              resolve(false);
            }
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();

          setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
            resolve(true);
          }, 300);
        },
        'image/jpeg',
        0.95
      );
    } catch (err) {
      console.error('downloadCanvasImageToDevice error:', err);
      resolve(false);
    }
  });
}

/**
 * Shares or downloads a captured receipt image (JPG) and sends message to WhatsApp
 */
export async function shareOrDownloadReceiptImage({
  canvas,
  fileName,
  phone,
  text,
  preOpenedWindow,
}: {
  canvas: HTMLCanvasElement;
  fileName: string;
  phone?: string;
  text: string;
  preOpenedWindow?: Window | null;
}): Promise<void> {
  return new Promise<void>((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          const image = canvas.toDataURL('image/jpeg', 0.95);
          const link = document.createElement('a');
          link.href = image;
          link.download = fileName;
          link.click();
          openWhatsApp(phone, text, preOpenedWindow);
          resolve();
          return;
        }

        const file = new File([blob], fileName, { type: 'image/jpeg' });

        // If Native Web Share with files is supported on Mobile Android/iOS
        if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
          if (preOpenedWindow && !preOpenedWindow.closed) {
            try {
              preOpenedWindow.close();
            } catch (_) {}
          }
          try {
            await navigator.share({
              files: [file],
              title: fileName.replace(/\.[^/.]+$/, ''),
              text: text,
            });
            resolve();
            return;
          } catch (shareError: any) {
            if (shareError.name === 'AbortError') {
              resolve();
              return;
            }
            console.warn('Native share failed, falling back to download:', shareError);
          }
        }

        // Fallback: Download file to device storage & open WhatsApp chat
        await downloadCanvasImageToDevice(canvas, fileName);
        openWhatsApp(phone, text, preOpenedWindow);
        resolve();
      },
      'image/jpeg',
      0.95
    );
  });
}

/**
 * Safely captures an HTML element into an HTMLCanvasElement using html2canvas,
 * handling modern CSS color functions (like oklch, lab, lch) that html2canvas cannot parse natively.
 */
export async function captureElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  return await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc) => {
      // 1. Clean all <style> elements containing oklch/lab/lch color functions
      const styleElements = clonedDoc.querySelectorAll('style');
      styleElements.forEach((style) => {
        if (style.textContent) {
          style.textContent = style.textContent
            .replace(/oklch\([^\)]+\)/gi, 'rgba(128, 128, 128, 0.2)')
            .replace(/lab\([^\)]+\)/gi, 'rgba(128, 128, 128, 0.2)')
            .replace(/lch\([^\)]+\)/gi, 'rgba(128, 128, 128, 0.2)');
        }
      });

      // 2. Clean inline styles on elements in clonedDoc
      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style && htmlEl.style.cssText) {
          if (
            htmlEl.style.cssText.includes('oklch') ||
            htmlEl.style.cssText.includes('lab') ||
            htmlEl.style.cssText.includes('lch')
          ) {
            htmlEl.style.cssText = htmlEl.style.cssText
              .replace(/oklch\([^\)]+\)/gi, 'rgba(128, 128, 128, 0.2)')
              .replace(/lab\([^\)]+\)/gi, 'rgba(128, 128, 128, 0.2)')
              .replace(/lch\([^\)]+\)/gi, 'rgba(128, 128, 128, 0.2)');
          }
        }
      });
    },
  });
}

/**
 * Exports HTML element to a downloadable PNG file
 */
export async function exportElementToPng(element: HTMLElement, fileName: string = 'export.png'): Promise<void> {
  const canvas = await captureElementToCanvas(element);
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Combines array of paragraph objects or strings into a single concatenated string
 */
export function combineParagraphs(paragraphs?: Array<{ text: string } | string>): string {
  if (!paragraphs || !paragraphs.length) return '';
  return paragraphs
    .map((p) => (typeof p === 'string' ? p : p?.text || ''))
    .join('');
}

/**
 * Converts numbers into Indonesian words for formal salary slips
 */
export function numberToWordsIndonesian(n: number): string {
  if (isNaN(n) || n === 0) return 'Nol Rupiah';
  const angka = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  
  function terbilang(x: number): string {
    x = Math.floor(Math.abs(x));
    if (x < 12) return ' ' + angka[x];
    if (x < 20) return terbilang(x - 10) + ' Belas';
    if (x < 100) return terbilang(Math.floor(x / 10)) + ' Puluh' + terbilang(x % 10);
    if (x < 200) return ' Seratus' + terbilang(x - 100);
    if (x < 1000) return terbilang(Math.floor(x / 100)) + ' Ratus' + terbilang(x % 100);
    if (x < 2000) return ' Seribu' + terbilang(x - 1000);
    if (x < 1000000) return terbilang(Math.floor(x / 1000)) + ' Ribu' + terbilang(x % 1000);
    if (x < 1000000000) return terbilang(Math.floor(x / 1000000)) + ' Juta' + terbilang(x % 1000000);
    if (x < 1000000000000) return terbilang(Math.floor(x / 1000000000)) + ' Milyar' + terbilang(x % 1000000000);
    return terbilang(Math.floor(x / 1000000000000)) + ' Triliun' + terbilang(x % 1000000000000);
  }

  return (terbilang(n).trim() + ' Rupiah').replace(/\s+/g, ' ');
}

/**
 * Generates formatted thermal slip for payroll (58mm / 80mm ESC/POS)
 */
export function formatPayrollSlipThermal(record: PayrollRecord, settings: StoreSettings): string {
  if (!record) return '';
  const lineLength = settings?.printerPaperSize === '58mm' ? 32 : 42;
  const divider = '-'.repeat(lineLength);
  const doubleDivider = '='.repeat(lineLength);

  const centerText = (str: string) => {
    if (!str) return '';
    if (str.length >= lineLength) return str.substring(0, lineLength);
    const pad = Math.floor((lineLength - str.length) / 2);
    return ' '.repeat(pad) + str;
  };

  const justifyText = (left: string, right: string) => {
    left = left || '';
    right = right || '';
    const spaceNeeded = lineLength - left.length - right.length;
    if (spaceNeeded <= 0) return left.substring(0, lineLength - right.length - 1) + ' ' + right;
    return left + ' '.repeat(spaceNeeded) + right;
  };

  let lines: string[] = [];
  lines.push(centerText(settings?.storeName?.toUpperCase() || 'SU-QUR POS'));
  if (record.outletName) {
    lines.push(centerText(record.outletName.toUpperCase()));
  }
  lines.push(doubleDivider);
  lines.push(centerText('*** SLIP GAJI KARYAWAN ***'));
  lines.push(centerText(`PERIODE: ${record.period.toUpperCase()}`));
  lines.push(doubleDivider);

  lines.push(justifyText('No. Slip:', record.id));
  lines.push(justifyText('Nama Karyawan:', record.employeeName));
  if (record.employeeRole) lines.push(justifyText('Jabatan / Posisi:', record.employeeRole));
  if (record.employeePhone) lines.push(justifyText('No. WhatsApp:', record.employeePhone));
  lines.push(justifyText('Tgl Pembayaran:', formatDate(record.paymentDate || new Date().toISOString())));
  lines.push(justifyText('Metode Bayar:', record.paymentMethod || 'TRANSFER'));
  lines.push(justifyText('Status:', record.status === 'PAID' ? 'LUNAS (DIBAYARKAN)' : 'DRAFT (MENUNGGU)'));
  lines.push(divider);

  lines.push(centerText('--- RINCIAN PENGHASILAN ---'));
  lines.push(justifyText('1. Gaji Pokok:', formatRp(record.baseSalary)));
  if (record.allowances > 0) {
    lines.push(justifyText('2. Tunjangan:', `+${formatRp(record.allowances)}`));
  }
  if (record.bonuses > 0) {
    lines.push(justifyText('3. Bonus & Lembur:', `+${formatRp(record.bonuses)}`));
  }
  const totalEarnings = record.baseSalary + (record.allowances || 0) + (record.bonuses || 0);
  lines.push(justifyText('Total Pendapatan Bruto:', formatRp(totalEarnings)));
  lines.push(divider);

  lines.push(centerText('--- POTONGAN / KASBON ---'));
  if (record.deductions > 0) {
    lines.push(justifyText('Potongan / Kasbon:', `-${formatRp(record.deductions)}`));
  } else {
    lines.push(justifyText('Potongan:', 'Rp 0'));
  }
  lines.push(doubleDivider);

  lines.push(justifyText('GAJI BERSIH (THP):', formatRp(record.netSalary)));
  lines.push(doubleDivider);

  if (record.notes) {
    lines.push(`Catatan: ${record.notes}`);
    lines.push(divider);
  }

  lines.push(centerText('Terima kasih atas kerja keras & dedikasi Anda!'));
  lines.push(centerText(`Dicetak: ${formatDateTime(new Date().toISOString())}`));
  lines.push('\n\n\n');

  return lines.join('\n');
}

/**
 * Formats WhatsApp text message for sending Salary Slip directly to employee
 */
export function formatPayrollSlipWhatsAppMessage(record: PayrollRecord, settings: StoreSettings): string {
  const store = settings?.storeName || 'Su-Qur POS Coffee & Kitchen';
  const totalIncome = record.baseSalary + (record.allowances || 0) + (record.bonuses || 0);
  
  return `🧾 *SLIP GAJI KARYAWAN - ${store.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━
👤 *Nama*: ${record.employeeName}
💼 *Jabatan*: ${record.employeeRole || 'Staff'}
🏢 *Cabang*: ${record.outletName || 'Cabang Utama'}
📅 *Periode*: ${record.period}
🗓️ *Tgl Pembayaran*: ${formatDate(record.paymentDate)}
💳 *Metode*: ${record.paymentMethod || 'TRANSFER'}
📌 *Status*: ${record.status === 'PAID' ? '✅ DIBAYARKAN (LUNAS)' : '⏳ DRAFT'}

💰 *RINCIAN PENGHASILAN:*
• Gaji Pokok: ${formatRp(record.baseSalary)}
• Tunjangan: ${formatRp(record.allowances)}
• Bonus / Insentif: ${formatRp(record.bonuses)}
-------------------------------------
• *Total Pendapatan Bruto*: ${formatRp(totalIncome)}

✂️ *POTONGAN:*
• Kasbon / Potongan: -${formatRp(record.deductions)}
━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL GAJI BERSIH (TAKE HOME PAY):*
👉 *${formatRp(record.netSalary)}*
_(${numberToWordsIndonesian(record.netSalary)})_
━━━━━━━━━━━━━━━━━━━━━
${record.notes ? `📝 *Catatan:* ${record.notes}\n` : ''}
Terima kasih atas dedikasi dan kerja samanya! 🙏
_${store}_`;
}



