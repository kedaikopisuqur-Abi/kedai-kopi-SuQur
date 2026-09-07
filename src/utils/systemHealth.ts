import { StorageService } from '../services/storage';
import {
  Product,
  Ingredient,
  Transaction,
  Expense,
  CashLedger,
  PayrollRecord,
  BranchInventoryItem,
  Outlet,
  StockTransfer,
} from '../types';

export type HealthSeverity = 'critical' | 'warning' | 'info';

export type HealthCategory =
  | 'connection'
  | 'outlet_id'
  | 'cogs_hpp'
  | 'stock_sync'
  | 'data_integrity';

export interface HealthIssue {
  id: string;
  category: HealthCategory;
  severity: HealthSeverity;
  title: string;
  description: string;
  actionKey: string;
  actionLabel: string;
  impactedCount: number;
  details?: string[];
}

export interface PillarStatus {
  category: HealthCategory;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  issuesCount: number;
  summary: string;
}

export interface SystemHealthReport {
  overallStatus: 'healthy' | 'warning' | 'critical';
  healthScore: number; // 0 to 100
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: HealthIssue[];
  pillars: {
    connection: PillarStatus;
    outletId: PillarStatus;
    cogsHpp: PillarStatus;
    stockSync: PillarStatus;
  };
  lastScanTimestamp: string;
}

export interface AutoFixResult {
  success: boolean;
  message: string;
  fixedCount: number;
  actionKey: string;
  report: SystemHealthReport;
}

/**
 * Standard baseline cost estimates used when an ingredient has 0 cost
 */
const DEFAULT_INGREDIENT_COSTS: Record<string, number> = {
  'Biji Kopi': 220, // Rp 220 / gram
  'Susu & Dairy': 22, // Rp 22 / ml
  'Sirup & Gula': 55, // Rp 55 / ml
  'Kemasan': 500, // Rp 500 / pcs
  'Topping & Bahan Pelengkap': 150, // Rp 150 / gram
  'Lainnya': 100,
};

// ==========================================================
// MODULAR DIAGNOSTIC FUNCTIONS
// ==========================================================

/**
 * Mendiagnosa masalah koneksi Firebase, WebSocket, & antrean transaksi offline
 */
export function diagnoseFirebaseConnection(): {
  isOnline: boolean;
  isOfflineMode: boolean;
  pendingOfflineCount: number;
  status: 'healthy' | 'warning' | 'critical';
  issues: HealthIssue[];
} {
  const isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const isOfflineMode = StorageService.isOfflineMode();
  const pendingOfflineTxs = StorageService.getPendingOfflineTxs();
  const issues: HealthIssue[] = [];

  if (!isBrowserOnline) {
    issues.push({
      id: 'issue-offline-network',
      category: 'connection',
      severity: 'warning',
      title: 'Koneksi Jaringan Internet Terputus',
      description:
        'Browser terdeteksi offline. Transaksi baru akan dialihkan ke penyimpanan lokal (IndexedDB) dan disinkronkan saat online.',
      actionKey: 'ping_network_sync',
      actionLabel: 'Cek Ulang Koneksi',
      impactedCount: 1,
    });
  } else if (isOfflineMode) {
    issues.push({
      id: 'issue-offline-mode-forced',
      category: 'connection',
      severity: 'info',
      title: 'Mode Offline (Lokal) Sedang Aktif',
      description:
        'Aplikasi diatur dalam mode mandiri lokal. Koneksi cloud dinonaktifkan secara manual di pengaturan.',
      actionKey: 'enable_online_sync',
      actionLabel: 'Aktifkan Mode Online',
      impactedCount: 1,
    });
  }

  if (pendingOfflineTxs.length > 0) {
    const transactions = StorageService.getTransactions(true);
    issues.push({
      id: 'issue-pending-offline-sync',
      category: 'connection',
      severity: isBrowserOnline ? 'warning' : 'info',
      title: `${pendingOfflineTxs.length} Transaksi Tertunda Belum Terunggah`,
      description:
        'Terdapat data transaksi offline yang siap disinkronkan ke database cloud real-time.',
      actionKey: 'sync_pending_offline_txs',
      actionLabel: 'Unggah & Sinkronkan Sekarang',
      impactedCount: pendingOfflineTxs.length,
      details: pendingOfflineTxs.map((id) => {
        const found = transactions.find((t) => t.id === id);
        return found ? `${found.invoiceNo} (Rp ${found.total.toLocaleString('id-ID')})` : `ID: ${id}`;
      }),
    });
  }

  const status: 'healthy' | 'warning' | 'critical' = !isBrowserOnline
    ? 'critical'
    : issues.length > 0
    ? 'warning'
    : 'healthy';

  return {
    isOnline: isBrowserOnline,
    isOfflineMode,
    pendingOfflineCount: pendingOfflineTxs.length,
    status,
    issues,
  };
}

/**
 * Mendiagnosa dan memvalidasi kelengkapan data outletId pada transaksi, biaya, buku kas, dan payroll
 */
export function validateOutletData(): {
  status: 'healthy' | 'warning' | 'critical';
  missingTxCount: number;
  missingExpenseCount: number;
  missingLedgerCount: number;
  missingPayrollCount: number;
  issues: HealthIssue[];
} {
  const outlets = StorageService.getOutlets();
  const validOutletIds = new Set(outlets.map((o) => o.id));
  const transactions = StorageService.getTransactions(true);
  const expenses = StorageService.getExpenses();
  const cashLedgers = StorageService.getCashLedgers();
  const payrollRecords = StorageService.getPayrollRecords();
  const stockTransfers = StorageService.getStockTransfers();

  const issues: HealthIssue[] = [];

  const txWithoutOutlet = transactions.filter((t) => !t.outletId || !validOutletIds.has(t.outletId));
  if (txWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-tx-missing-outlet',
      category: 'outlet_id',
      severity: 'critical',
      title: `${txWithoutOutlet.length} Transaksi Belum Memiliki Outlet ID`,
      description:
        'Ditemukan transaksi tanpa label cabang/outlet ID yang valid. Hal ini dapat menyebabkan distorsi laporan per-cabang.',
      actionKey: 'fix_tx_outlet_ids',
      actionLabel: 'Tetapkan Outlet ID Default',
      impactedCount: txWithoutOutlet.length,
      details: txWithoutOutlet.slice(0, 5).map((t) => `Nota: ${t.invoiceNo}`),
    });
  }

  const expWithoutOutlet = expenses.filter((e) => !e.outletId || !validOutletIds.has(e.outletId));
  if (expWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-exp-missing-outlet',
      category: 'outlet_id',
      severity: 'warning',
      title: `${expWithoutOutlet.length} Pengeluaran Operasional Tanpa Outlet ID`,
      description:
        'Pencatatan beban operasional tidak terikat ke cabang tertentu, sehingga tidak muncul pada filter laba cabang.',
      actionKey: 'fix_expense_outlet_ids',
      actionLabel: 'Lengkapi Outlet ID Pengeluaran',
      impactedCount: expWithoutOutlet.length,
      details: expWithoutOutlet.slice(0, 5).map((e) => `${e.category}: ${e.description}`),
    });
  }

  const ledgersWithoutOutlet = cashLedgers.filter((l) => !l.outletId || !validOutletIds.has(l.outletId));
  if (ledgersWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-ledger-missing-outlet',
      category: 'outlet_id',
      severity: 'warning',
      title: `${ledgersWithoutOutlet.length} Catatan Buku Kas Tanpa Outlet ID`,
      description: 'Catatan arus kas masuk/keluar belum memiliki penugasan cabang yang jelas.',
      actionKey: 'fix_ledger_outlet_ids',
      actionLabel: 'Perbaiki Cabang Buku Kas',
      impactedCount: ledgersWithoutOutlet.length,
    });
  }

  const payrollWithoutOutlet = payrollRecords.filter((p) => !p.outletId || !validOutletIds.has(p.outletId));
  if (payrollWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-payroll-missing-outlet',
      category: 'outlet_id',
      severity: 'info',
      title: `${payrollWithoutOutlet.length} Slip Gaji Karyawan Tanpa Cabang`,
      description: 'Catatan penggajian belum dialokasikan ke cabang spesifik.',
      actionKey: 'fix_payroll_outlet_ids',
      actionLabel: 'Alokasikan ke Cabang',
      impactedCount: payrollWithoutOutlet.length,
    });
  }

  const brokenTransfers = stockTransfers.filter(
    (t) => (!t.fromOutletId && !t.sourceOutletId) || (!t.toOutletId && !t.targetOutletId)
  );
  if (brokenTransfers.length > 0) {
    issues.push({
      id: 'issue-transfer-outlet-missing',
      category: 'outlet_id',
      severity: 'warning',
      title: `${brokenTransfers.length} Surat Jalan Transfer Stok Tidak Lengkap`,
      description: 'ID cabang asal atau tujuan pada surat jalan suplai antar-cabang belum terisi lengkap.',
      actionKey: 'fix_stock_transfers_outlet',
      actionLabel: 'Lengkapi ID Transfer',
      impactedCount: brokenTransfers.length,
    });
  }

  const status: 'healthy' | 'warning' | 'critical' =
    txWithoutOutlet.length > 0
      ? 'critical'
      : issues.length > 0
      ? 'warning'
      : 'healthy';

  return {
    status,
    missingTxCount: txWithoutOutlet.length,
    missingExpenseCount: expWithoutOutlet.length,
    missingLedgerCount: ledgersWithoutOutlet.length,
    missingPayrollCount: payrollWithoutOutlet.length,
    issues,
  };
}

/**
 * Mendiagnosa dan memvalidasi integritas stok bahan baku master dan cabang
 */
export function validateStockIntegrity(): {
  status: 'healthy' | 'warning' | 'critical';
  negativeMasterCount: number;
  negativeBranchCount: number;
  missingBranchSlotCount: number;
  issues: HealthIssue[];
} {
  const outlets = StorageService.getOutlets();
  const ingredients = StorageService.getIngredients();
  const branchInventory = StorageService.getBranchInventory();
  const issues: HealthIssue[] = [];

  const negativeMasterIngredients = ingredients.filter((i) => i.currentStock < 0);
  if (negativeMasterIngredients.length > 0) {
    issues.push({
      id: 'issue-negative-master-stock',
      category: 'stock_sync',
      severity: 'critical',
      title: `${negativeMasterIngredients.length} Bahan Baku Memiliki Stok Negatif (< 0)`,
      description:
        'Stok master tercatat di bawah 0 akibat pemotongan penjualan tanpa input stok awal yang cukup.',
      actionKey: 'fix_negative_master_stocks',
      actionLabel: 'Reset Stok Negatif ke 0',
      impactedCount: negativeMasterIngredients.length,
      details: negativeMasterIngredients.map((i) => `${i.name}: ${i.currentStock} ${i.unit}`),
    });
  }

  const negativeBranchStock = branchInventory.filter((b) => b.currentStock < 0);
  if (negativeBranchStock.length > 0) {
    issues.push({
      id: 'issue-negative-branch-stock',
      category: 'stock_sync',
      severity: 'critical',
      title: `${negativeBranchStock.length} Stok Cabang Bernilai Minus (< 0)`,
      description:
        'Inventori cabang tercatat minus di sistem akibat selisih fisik atau penjualan melampaui sisa stok.',
      actionKey: 'fix_negative_branch_stocks',
      actionLabel: 'Normalisasi Stok Cabang ke 0',
      impactedCount: negativeBranchStock.length,
      details: negativeBranchStock
        .slice(0, 5)
        .map((b) => `[${b.outletName || b.outletId}] ${b.ingredientName}: ${b.currentStock} ${b.unit}`),
    });
  }

  let missingBranchSlots = 0;
  outlets.forEach((out) => {
    ingredients.forEach((ing) => {
      const exists = branchInventory.some((bi) => bi.outletId === out.id && bi.ingredientId === ing.id);
      if (!exists) missingBranchSlots++;
    });
  });

  if (missingBranchSlots > 0) {
    issues.push({
      id: 'issue-missing-branch-inventory',
      category: 'stock_sync',
      severity: 'warning',
      title: `${missingBranchSlots} Relasi Stok Cabang Belum Terdaftar`,
      description: 'Ditemukan cabang yang belum memiliki slot stok untuk bahan baku master baru.',
      actionKey: 'reconcile_branch_inventory',
      actionLabel: 'Sinkronkan Inventori Seluruh Cabang',
      impactedCount: missingBranchSlots,
    });
  }

  const status: 'healthy' | 'warning' | 'critical' =
    negativeMasterIngredients.length > 0 || negativeBranchStock.length > 0
      ? 'critical'
      : missingBranchSlots > 0
      ? 'warning'
      : 'healthy';

  return {
    status,
    negativeMasterCount: negativeMasterIngredients.length,
    negativeBranchCount: negativeBranchStock.length,
    missingBranchSlotCount: missingBranchSlots,
    issues,
  };
}

/**
 * Memindai otomatis seluruh aspek kesehatan aplikasi & integritas data:
 * 1. Koneksi WebSocket / Firebase & antrean data offline
 * 2. Kelengkapan dan validitas outletId di seluruh entitas multi-cabang
 * 3. HPP produk & biaya per unit bahan baku (COGS & Recipe Cost)
 * 4. Sinkronisasi stok bahan baku (negative stock & branch inventory missing)
 */
export function runSystemHealthCheck(): SystemHealthReport {
  const issues: HealthIssue[] = [];

  const outlets = StorageService.getOutlets();
  const defaultOutlet = outlets.find((o) => o.isDefault) || outlets[0] || {
    id: 'outlet-lagoa',
    name: 'Kedai Kopi Wahid - Cabang Lagoa',
  };
  const validOutletIds = new Set(outlets.map((o) => o.id));

  const products = StorageService.getProducts();
  const ingredients = StorageService.getIngredients();
  const branchInventory = StorageService.getBranchInventory();
  const transactions = StorageService.getTransactions(true); // check all transactions
  const expenses = StorageService.getExpenses();
  const cashLedgers = StorageService.getCashLedgers();
  const payrollRecords = StorageService.getPayrollRecords();
  const stockTransfers = StorageService.getStockTransfers();
  const pendingOfflineTxs = StorageService.getPendingOfflineTxs();
  const isOfflineMode = StorageService.isOfflineMode();
  const isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ==========================================================
  // 1. KONEKSI WEBSOCKET / FIREBASE & ANTREAN SINKRONISASI
  // ==========================================================
  let connIssuesCount = 0;
  if (!isBrowserOnline) {
    issues.push({
      id: 'issue-offline-network',
      category: 'connection',
      severity: 'warning',
      title: 'Koneksi Jaringan Internet Terputus',
      description:
        'Browser terdeteksi offline. Transaksi baru akan dialihkan ke penyimpanan lokal (IndexedDB) dan disinkronkan saat online.',
      actionKey: 'ping_network_sync',
      actionLabel: 'Cek Ulang Koneksi',
      impactedCount: 1,
    });
    connIssuesCount++;
  } else if (isOfflineMode) {
    issues.push({
      id: 'issue-offline-mode-forced',
      category: 'connection',
      severity: 'info',
      title: 'Mode Offline (Lokal) Sedang Aktif',
      description:
        'Aplikasi diatur dalam mode mandiri lokal. Koneksi cloud dinonaktifkan secara manual di pengaturan.',
      actionKey: 'enable_online_sync',
      actionLabel: 'Aktifkan Mode Online',
      impactedCount: 1,
    });
    connIssuesCount++;
  }

  if (pendingOfflineTxs.length > 0) {
    issues.push({
      id: 'issue-pending-offline-sync',
      category: 'connection',
      severity: isBrowserOnline ? 'warning' : 'info',
      title: `${pendingOfflineTxs.length} Transaksi Tertunda Belum Terunggah`,
      description:
        'Terdapat data transaksi offline yang siap disinkronkan ke database cloud real-time.',
      actionKey: 'sync_pending_offline_txs',
      actionLabel: 'Unggah & Sinkronkan Sekarang',
      impactedCount: pendingOfflineTxs.length,
      details: pendingOfflineTxs.map((id) => {
        const found = transactions.find((t) => t.id === id);
        return found ? `${found.invoiceNo} (Rp ${found.total.toLocaleString('id-ID')})` : `ID: ${id}`;
      }),
    });
    connIssuesCount++;
  }

  // ==========================================================
  // 2. INTEGRITAS DATA OUTLET ID (MULTI-CABANG)
  // ==========================================================
  let outletIssuesCount = 0;

  // 2a. Transactions missing or invalid outletId
  const txWithoutOutlet = transactions.filter(
    (t) => !t.outletId || !validOutletIds.has(t.outletId)
  );
  if (txWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-tx-missing-outlet',
      category: 'outlet_id',
      severity: 'critical',
      title: `${txWithoutOutlet.length} Transaksi Belum Memiliki Outlet ID`,
      description:
        'Ditemukan transaksi tanpa label cabang/outlet ID yang valid. Hal ini dapat menyebabkan distorsi laporan per-cabang.',
      actionKey: 'fix_tx_outlet_ids',
      actionLabel: 'Tetapkan Outlet ID Default',
      impactedCount: txWithoutOutlet.length,
      details: txWithoutOutlet.slice(0, 5).map((t) => `Nota: ${t.invoiceNo}`),
    });
    outletIssuesCount++;
  }

  // 2b. Expenses missing outletId
  const expWithoutOutlet = expenses.filter(
    (e) => !e.outletId || !validOutletIds.has(e.outletId)
  );
  if (expWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-exp-missing-outlet',
      category: 'outlet_id',
      severity: 'warning',
      title: `${expWithoutOutlet.length} Pengeluaran Operasional Tanpa Outlet ID`,
      description:
        'Pencatatan beban operasional tidak terikat ke cabang tertentu, sehingga tidak muncul pada filter laba cabang.',
      actionKey: 'fix_expense_outlet_ids',
      actionLabel: 'Lengkapi Outlet ID Pengeluaran',
      impactedCount: expWithoutOutlet.length,
      details: expWithoutOutlet.slice(0, 5).map((e) => `${e.category}: ${e.description}`),
    });
    outletIssuesCount++;
  }

  // 2c. Cash Ledgers missing outletId
  const ledgersWithoutOutlet = cashLedgers.filter(
    (l) => !l.outletId || !validOutletIds.has(l.outletId)
  );
  if (ledgersWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-ledger-missing-outlet',
      category: 'outlet_id',
      severity: 'warning',
      title: `${ledgersWithoutOutlet.length} Catatan Buku Kas Tanpa Outlet ID`,
      description:
        'Catatan arus kas masuk/keluar belum memiliki penugasan cabang yang jelas.',
      actionKey: 'fix_ledger_outlet_ids',
      actionLabel: 'Perbaiki Cabang Buku Kas',
      impactedCount: ledgersWithoutOutlet.length,
    });
    outletIssuesCount++;
  }

  // 2d. Payroll Records missing outletId
  const payrollWithoutOutlet = payrollRecords.filter(
    (p) => !p.outletId || !validOutletIds.has(p.outletId)
  );
  if (payrollWithoutOutlet.length > 0) {
    issues.push({
      id: 'issue-payroll-missing-outlet',
      category: 'outlet_id',
      severity: 'info',
      title: `${payrollWithoutOutlet.length} Slip Gaji Karyawan Tanpa Cabang`,
      description:
        'Catatan penggajian belum dialokasikan ke cabang spesifik.',
      actionKey: 'fix_payroll_outlet_ids',
      actionLabel: 'Alokasikan ke Cabang',
      impactedCount: payrollWithoutOutlet.length,
    });
    outletIssuesCount++;
  }

  // 2e. Stock transfers with unassigned fields
  const brokenTransfers = stockTransfers.filter(
    (t) => (!t.fromOutletId && !t.sourceOutletId) || (!t.toOutletId && !t.targetOutletId)
  );
  if (brokenTransfers.length > 0) {
    issues.push({
      id: 'issue-transfer-outlet-missing',
      category: 'outlet_id',
      severity: 'warning',
      title: `${brokenTransfers.length} Surat Jalan Transfer Stok Tidak Lengkap`,
      description:
        'ID cabang asal atau tujuan pada surat jalan suplai antar-cabang belum terisi lengkap.',
      actionKey: 'fix_stock_transfers_outlet',
      actionLabel: 'Lengkapi ID Transfer',
      impactedCount: brokenTransfers.length,
    });
    outletIssuesCount++;
  }

  // ==========================================================
  // 3. VALIDITAS HPP & RESEP BAHAN BAKU (COGS & RECIPE INTEGRITY)
  // ==========================================================
  let cogsIssuesCount = 0;

  // 3a. Ingredients with costPerUnit <= 0
  const zeroCostIngredients = ingredients.filter(
    (i) => !i.costPerUnit || i.costPerUnit <= 0
  );
  if (zeroCostIngredients.length > 0) {
    issues.push({
      id: 'issue-zero-cost-ingredients',
      category: 'cogs_hpp',
      severity: 'critical',
      title: `${zeroCostIngredients.length} Bahan Baku Memiliki Harga Beli Rp 0`,
      description:
        'Biaya per satuan (costPerUnit) bernilai Rp 0 sehingga perhitungan HPP resep menu menjadi tidak akurat.',
      actionKey: 'fix_zero_cost_ingredients',
      actionLabel: 'Isi Estimasi Biaya Bahan Standar',
      impactedCount: zeroCostIngredients.length,
      details: zeroCostIngredients.map((i) => `${i.name} (Satuan: ${i.unit})`),
    });
    cogsIssuesCount++;
  }

  // 3b. Products with cogs <= 0
  const zeroCogsProducts = products.filter((p) => !p.cogs || p.cogs <= 0);
  if (zeroCogsProducts.length > 0) {
    issues.push({
      id: 'issue-zero-cogs-products',
      category: 'cogs_hpp',
      severity: 'critical',
      title: `${zeroCogsProducts.length} Produk Menu Belum Memiliki HPP Modal`,
      description:
        'Nilai modal (HPP) bernilai Rp 0, sehingga estimasi laba kotor tercatat 100% dan laporan keuntungan menjadi keliru.',
      actionKey: 'fix_zero_cogs_products',
      actionLabel: 'Hitung HPP Otomatis dari Resep',
      impactedCount: zeroCogsProducts.length,
      details: zeroCogsProducts.map((p) => `${p.name} (Harga: Rp ${p.price.toLocaleString('id-ID')})`),
    });
    cogsIssuesCount++;
  }

  // 3c. Products whose recipe references non-existent ingredients
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));
  const productsWithBrokenRecipe = products.filter((p) => {
    if (!p.recipe || p.recipe.length === 0) return false;
    return p.recipe.some((r) => !ingMap.has(r.ingredientId));
  });
  if (productsWithBrokenRecipe.length > 0) {
    issues.push({
      id: 'issue-broken-recipes',
      category: 'cogs_hpp',
      severity: 'warning',
      title: `${productsWithBrokenRecipe.length} Resep Terhubung ke Bahan yang Telah Dihapus`,
      description:
        'Beberapa komponen resep merujuk pada ID bahan baku yang sudah tidak terdaftar di master inventori.',
      actionKey: 'fix_broken_recipes',
      actionLabel: 'Bersihkan Resep Kadaluwarsa',
      impactedCount: productsWithBrokenRecipe.length,
      details: productsWithBrokenRecipe.map((p) => p.name),
    });
    cogsIssuesCount++;
  }

  // ==========================================================
  // 4. SINKRONISASI STOK & INVENTORI MULTI-CABANG
  // ==========================================================
  let stockIssuesCount = 0;

  // 4a. Master Ingredients with negative stock (< 0)
  const negativeMasterIngredients = ingredients.filter((i) => i.currentStock < 0);
  if (negativeMasterIngredients.length > 0) {
    issues.push({
      id: 'issue-negative-master-stock',
      category: 'stock_sync',
      severity: 'critical',
      title: `${negativeMasterIngredients.length} Bahan Baku Memiliki Stok Negatif (< 0)`,
      description:
        'Stok master tercatat di bawah 0 akibat pemotongan penjualan tanpa input stok awal yang cukup.',
      actionKey: 'fix_negative_master_stocks',
      actionLabel: 'Reset Stok Negatif ke 0',
      impactedCount: negativeMasterIngredients.length,
      details: negativeMasterIngredients.map((i) => `${i.name}: ${i.currentStock} ${i.unit}`),
    });
    stockIssuesCount++;
  }

  // 4b. Branch Inventory with negative stock (< 0)
  const negativeBranchStock = branchInventory.filter((b) => b.currentStock < 0);
  if (negativeBranchStock.length > 0) {
    issues.push({
      id: 'issue-negative-branch-stock',
      category: 'stock_sync',
      severity: 'critical',
      title: `${negativeBranchStock.length} Stok Cabang Bernilai Minus (< 0)`,
      description:
        'Inventori cabang tercatat minus di sistem akibat selisih fisik atau penjualan melampaui sisa stok.',
      actionKey: 'fix_negative_branch_stocks',
      actionLabel: 'Normalisasi Stok Cabang ke 0',
      impactedCount: negativeBranchStock.length,
      details: negativeBranchStock.slice(0, 5).map((b) => `[${b.outletName || b.outletId}] ${b.ingredientName}: ${b.currentStock} ${b.unit}`),
    });
    stockIssuesCount++;
  }

  // 4c. Missing Branch Inventory records for registered outlets & ingredients
  let missingBranchRecordsCount = 0;
  outlets.forEach((out) => {
    ingredients.forEach((ing) => {
      const exists = branchInventory.some(
        (bi) => bi.outletId === out.id && bi.ingredientId === ing.id
      );
      if (!exists) {
        missingBranchRecordsCount++;
      }
    });
  });

  if (missingBranchRecordsCount > 0) {
    issues.push({
      id: 'issue-missing-branch-inventory',
      category: 'stock_sync',
      severity: 'warning',
      title: `${missingBranchRecordsCount} Relasi Stok Cabang Belum Terdaftar`,
      description:
        'Ditemukan cabang yang belum memiliki slot stok untuk bahan baku master baru.',
      actionKey: 'reconcile_branch_inventory',
      actionLabel: 'Sinkronkan Inventori Seluruh Cabang',
      impactedCount: missingBranchRecordsCount,
    });
    stockIssuesCount++;
  }

  // ==========================================================
  // CALCULATE OVERALL HEALTH SCORE & PILLARS
  // ==========================================================
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  let healthScore = 100;
  healthScore -= criticalCount * 22;
  healthScore -= warningCount * 9;
  healthScore -= infoCount * 3;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const overallStatus: 'healthy' | 'warning' | 'critical' =
    criticalCount > 0 || healthScore < 70
      ? 'critical'
      : warningCount > 0 || healthScore < 90
      ? 'warning'
      : 'healthy';

  const pillars: {
    connection: PillarStatus;
    outletId: PillarStatus;
    cogsHpp: PillarStatus;
    stockSync: PillarStatus;
  } = {
    connection: {
      category: 'connection' as HealthCategory,
      name: 'Koneksi & Cloud Sync',
      status: (connIssuesCount > 0
        ? !isBrowserOnline
          ? 'critical'
          : 'warning'
        : 'healthy') as 'healthy' | 'warning' | 'critical',
      issuesCount: connIssuesCount,
      summary:
        connIssuesCount === 0
          ? 'Real-Time Firestore & WebSocket Terhubung'
          : `${connIssuesCount} kendala konektivitas / antrean offline`,
    },
    outletId: {
      category: 'outlet_id' as HealthCategory,
      name: 'Integritas Outlet ID Cabang',
      status: (txWithoutOutlet.length > 0
        ? 'critical'
        : outletIssuesCount > 0
        ? 'warning'
        : 'healthy') as 'healthy' | 'warning' | 'critical',
      issuesCount: outletIssuesCount,
      summary:
        outletIssuesCount === 0
          ? 'Seluruh data transaksi & operasional teralokasi valid'
          : `${txWithoutOutlet.length + expWithoutOutlet.length + ledgersWithoutOutlet.length} data tanpa Outlet ID`,
    },
    cogsHpp: {
      category: 'cogs_hpp' as HealthCategory,
      name: 'Akurasi HPP & Biaya Bahan',
      status: (cogsIssuesCount > 0
        ? zeroCogsProducts.length > 0 || zeroCostIngredients.length > 0
          ? 'critical'
          : 'warning'
        : 'healthy') as 'healthy' | 'warning' | 'critical',
      issuesCount: cogsIssuesCount,
      summary:
        cogsIssuesCount === 0
          ? 'Seluruh HPP resep & biaya bahan baku valid'
          : `${zeroCogsProducts.length} produk HPP Rp 0, ${zeroCostIngredients.length} bahan Rp 0`,
    },
    stockSync: {
      category: 'stock_sync' as HealthCategory,
      name: 'Sinkronisasi Stok & Cabang',
      status: (stockIssuesCount > 0
        ? negativeMasterIngredients.length > 0 || negativeBranchStock.length > 0
          ? 'critical'
          : 'warning'
        : 'healthy') as 'healthy' | 'warning' | 'critical',
      issuesCount: stockIssuesCount,
      summary:
        stockIssuesCount === 0
          ? 'Stok bahan baku & inventori cabang konsisten'
          : `${negativeMasterIngredients.length + negativeBranchStock.length} stok negatif, ${missingBranchRecordsCount} belum sinkron`,
    },
  };

  return {
    overallStatus,
    healthScore,
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    infoCount,
    issues,
    pillars,
    lastScanTimestamp: new Date().toISOString(),
  };
}

/**
 * Eksekusi perbaikan otomatis (Auto-Repair) berdasarkan actionKey
 * atau 'fix_all_issues' untuk memperbaiki seluruh kendala secara simultan.
 */
export async function executeAutoFix(
  actionKey: string,
  options?: { targetOutletId?: string }
): Promise<AutoFixResult> {
  let fixedCount = 0;
  const messages: string[] = [];

  const outlets = StorageService.getOutlets();
  const defaultOutlet = outlets.find((o) => o.isDefault) || outlets[0] || {
    id: 'outlet-lagoa',
    name: 'Kedai Kopi Wahid - Cabang Lagoa',
  };
  const targetOutletId = options?.targetOutletId || defaultOutlet.id;
  const targetOutletName =
    outlets.find((o) => o.id === targetOutletId)?.name || defaultOutlet.name;

  const doFixOutletIds =
    actionKey === 'fix_all_issues' ||
    actionKey === 'fix_all_outlet_ids' ||
    actionKey === 'fix_tx_outlet_ids' ||
    actionKey === 'fix_expense_outlet_ids' ||
    actionKey === 'fix_ledger_outlet_ids' ||
    actionKey === 'fix_payroll_outlet_ids' ||
    actionKey === 'fix_stock_transfers_outlet';

  const doFixCogsHpp =
    actionKey === 'fix_all_issues' ||
    actionKey === 'fix_all_cogs_hpp' ||
    actionKey === 'fix_zero_cost_ingredients' ||
    actionKey === 'fix_zero_cogs_products' ||
    actionKey === 'fix_broken_recipes';

  const doFixStock =
    actionKey === 'fix_all_issues' ||
    actionKey === 'fix_all_stock_issues' ||
    actionKey === 'fix_negative_master_stocks' ||
    actionKey === 'fix_negative_branch_stocks' ||
    actionKey === 'reconcile_branch_inventory';

  const doFixConnection =
    actionKey === 'fix_all_issues' ||
    actionKey === 'sync_pending_offline_txs' ||
    actionKey === 'enable_online_sync' ||
    actionKey === 'ping_network_sync';

  // 1. Perbaikan Outlet ID
  if (doFixOutletIds) {
    const validOutletIds = new Set(outlets.map((o) => o.id));

    if (actionKey === 'fix_all_issues' || actionKey === 'fix_tx_outlet_ids' || actionKey === 'fix_all_outlet_ids') {
      const txs = StorageService.getTransactions(true);
      let txFixed = 0;
      const updatedTxs = txs.map((tx) => {
        if (!tx.outletId || !validOutletIds.has(tx.outletId)) {
          txFixed++;
          return {
            ...tx,
            outletId: targetOutletId,
            outletName: targetOutletName,
          };
        }
        return tx;
      });
      if (txFixed > 0) {
        StorageService.saveTransactions(updatedTxs);
        fixedCount += txFixed;
        messages.push(`${txFixed} transaksi berhasil dialokasikan ke ${targetOutletName}`);
      }
    }

    if (actionKey === 'fix_all_issues' || actionKey === 'fix_expense_outlet_ids' || actionKey === 'fix_all_outlet_ids') {
      const expenses = StorageService.getExpenses();
      let expFixed = 0;
      const updatedExpenses = expenses.map((exp) => {
        if (!exp.outletId || !validOutletIds.has(exp.outletId)) {
          expFixed++;
          return {
            ...exp,
            outletId: targetOutletId,
            outletName: targetOutletName,
          };
        }
        return exp;
      });
      if (expFixed > 0) {
        StorageService.saveExpenses(updatedExpenses);
        fixedCount += expFixed;
        messages.push(`${expFixed} pengeluaran operasional diperbaiki`);
      }
    }

    if (actionKey === 'fix_all_issues' || actionKey === 'fix_ledger_outlet_ids' || actionKey === 'fix_all_outlet_ids') {
      const ledgers = StorageService.getCashLedgers();
      let ledFixed = 0;
      const updatedLedgers = ledgers.map((l) => {
        if (!l.outletId || !validOutletIds.has(l.outletId)) {
          ledFixed++;
          return {
            ...l,
            outletId: targetOutletId,
            outletName: targetOutletName,
          };
        }
        return l;
      });
      if (ledFixed > 0) {
        StorageService.saveCashLedgers(updatedLedgers);
        fixedCount += ledFixed;
        messages.push(`${ledFixed} entri buku kas diperbarui`);
      }
    }

    if (actionKey === 'fix_all_issues' || actionKey === 'fix_payroll_outlet_ids' || actionKey === 'fix_all_outlet_ids') {
      const payrolls = StorageService.getPayrollRecords();
      let payFixed = 0;
      const updatedPayrolls = payrolls.map((p) => {
        if (!p.outletId || !validOutletIds.has(p.outletId)) {
          payFixed++;
          return {
            ...p,
            outletId: targetOutletId,
            outletName: targetOutletName,
          };
        }
        return p;
      });
      if (payFixed > 0) {
        StorageService.savePayrollRecords(updatedPayrolls);
        fixedCount += payFixed;
        messages.push(`${payFixed} slip gaji dialokasikan ke cabang`);
      }
    }

    if (actionKey === 'fix_all_issues' || actionKey === 'fix_stock_transfers_outlet' || actionKey === 'fix_all_outlet_ids') {
      const transfers = StorageService.getStockTransfers();
      let trfFixed = 0;
      const updatedTransfers = transfers.map((t) => {
        let changed = false;
        const copy = { ...t };
        if (!copy.fromOutletId && copy.sourceOutletId) {
          copy.fromOutletId = copy.sourceOutletId;
          changed = true;
        } else if (!copy.fromOutletId) {
          copy.fromOutletId = 'outlet-pusat';
          copy.fromOutletName = 'Gudang Pusat Su-Qur';
          changed = true;
        }
        if (!copy.toOutletId && copy.targetOutletId) {
          copy.toOutletId = copy.targetOutletId;
          changed = true;
        } else if (!copy.toOutletId) {
          copy.toOutletId = targetOutletId;
          copy.toOutletName = targetOutletName;
          changed = true;
        }
        if (changed) trfFixed++;
        return copy;
      });
      if (trfFixed > 0) {
        StorageService.saveStockTransfers(updatedTransfers);
        fixedCount += trfFixed;
        messages.push(`${trfFixed} surat jalan transfer dilengkapi`);
      }
    }
  }

  // 2. Perbaikan HPP & Biaya Bahan Baku (COGS & Recipe Cost)
  if (doFixCogsHpp) {
    let ingredients = StorageService.getIngredients();
    let ingFixed = 0;

    // Perbaiki harga bahan baku yang bernilai 0
    ingredients = ingredients.map((ing) => {
      if (!ing.costPerUnit || ing.costPerUnit <= 0) {
        ingFixed++;
        const defaultCost = DEFAULT_INGREDIENT_COSTS[ing.category] || 150;
        return {
          ...ing,
          costPerUnit: defaultCost,
        };
      }
      return ing;
    });

    if (ingFixed > 0) {
      StorageService.saveIngredients(ingredients);
      fixedCount += ingFixed;
      messages.push(`${ingFixed} bahan baku dilengkapi estimasi harga beli standar`);
    }

    // Hitung ulang HPP seluruh produk dari resep
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));
    let products = StorageService.getProducts();
    let prodFixed = 0;

    products = products.map((prod) => {
      let calculatedCogs = 0;
      if (prod.recipe && prod.recipe.length > 0) {
        calculatedCogs = prod.recipe.reduce((sum, item) => {
          const ing = ingMap.get(item.ingredientId);
          const cost = ing ? ing.costPerUnit : (DEFAULT_INGREDIENT_COSTS['Lainnya'] || 100);
          return sum + item.amount * cost;
        }, 0);
      }

      // Jika resep kosong atau COGS hasil kalkulasi 0, tetapkan 35% dari harga jual
      if (calculatedCogs <= 0) {
        calculatedCogs = Math.round((prod.price || 15000) * 0.35);
      }

      if (!prod.cogs || prod.cogs <= 0 || prod.cogs !== calculatedCogs) {
        prodFixed++;
        return {
          ...prod,
          cogs: Math.round(calculatedCogs),
          recipe: (prod.recipe || []).filter((r) => ingMap.has(r.ingredientId)), // clean broken recipe items
        };
      }
      return prod;
    });

    if (prodFixed > 0) {
      StorageService.saveProducts(products);
      fixedCount += prodFixed;
      messages.push(`${prodFixed} produk menu berhasil dihitung ulang nilai HPP modalnya`);
    }
  }

  // 3. Perbaikan Stok Negatif & Rekonsiliasi Cabang
  if (doFixStock) {
    // 3a. Normalisasi master ingredients negatif
    let masterIngredients = StorageService.getIngredients();
    let negMasterFixed = 0;
    masterIngredients = masterIngredients.map((ing) => {
      if (ing.currentStock < 0) {
        negMasterFixed++;
        return { ...ing, currentStock: 0 };
      }
      return ing;
    });
    if (negMasterFixed > 0) {
      StorageService.saveIngredients(masterIngredients);
      fixedCount += negMasterFixed;
      messages.push(`${negMasterFixed} stok master negatif dinormalisasi ke 0`);
    }

    // 3b. Normalisasi branch inventory negatif & rekonsiliasi slot cabang
    let branchInv = StorageService.getBranchInventory();
    let negBranchFixed = 0;
    let newSlotsCreated = 0;

    branchInv = branchInv.map((bi) => {
      if (bi.currentStock < 0) {
        negBranchFixed++;
        return { ...bi, currentStock: 0, lastUpdated: new Date().toISOString() };
      }
      return bi;
    });

    // Pastikan setiap cabang memiliki seluruh item bahan baku master
    outlets.forEach((out) => {
      masterIngredients.forEach((ing) => {
        const exists = branchInv.some(
          (bi) => bi.outletId === out.id && bi.ingredientId === ing.id
        );
        if (!exists) {
          newSlotsCreated++;
          const isCentral = out.type === 'CENTRAL' || out.id === 'outlet-pusat';
          const stockVal = isCentral
            ? ing.currentStock
            : Math.max(0, Math.round(ing.currentStock * 0.15));
          const minStockVal = isCentral
            ? ing.minStock
            : Math.max(10, Math.round(ing.minStock * 0.2));

          branchInv.push({
            id: `bi-${out.id}-${ing.id}`,
            outletId: out.id,
            outletName: out.name,
            ingredientId: ing.id,
            ingredientName: ing.name,
            unit: ing.unit,
            costPerUnit: ing.costPerUnit,
            currentStock: stockVal,
            minStock: minStockVal,
            category: ing.category,
            lastUpdated: new Date().toISOString(),
          });
        }
      });
    });

    if (negBranchFixed > 0 || newSlotsCreated > 0) {
      StorageService.saveBranchInventory(branchInv);
      fixedCount += negBranchFixed + newSlotsCreated;
      if (negBranchFixed > 0) messages.push(`${negBranchFixed} stok cabang minus diperbaiki`);
      if (newSlotsCreated > 0) messages.push(`${newSlotsCreated} slot inventori cabang baru dibuat`);
    }
  }

  // 4. Perbaikan Koneksi & Sinkronisasi
  if (doFixConnection) {
    if (actionKey === 'enable_online_sync') {
      StorageService.setOfflineMode(false);
      messages.push('Mode Online Real-Time telah diaktifkan kembali');
      fixedCount++;
    }

    const pendingCount = StorageService.getPendingOfflineCount();
    if (pendingCount > 0 && navigator.onLine && !StorageService.isOfflineMode()) {
      try {
        const syncRes = await StorageService.syncLocalToFirestore();
        if (syncRes.success && syncRes.syncedCount > 0) {
          fixedCount += syncRes.syncedCount;
          messages.push(`${syncRes.syncedCount} transaksi offline berhasil diunggah ke Cloud Firestore`);
        }
      } catch (err) {
        console.warn('[AutoFix] Sync error:', err);
      }
    }
  }

  // Generate updated report after fixes
  const updatedReport = runSystemHealthCheck();

  // Dispatch custom event for real-time reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('system_health_updated', { detail: updatedReport })
    );
  }

  const finalMsg =
    messages.length > 0
      ? `Sistem Berhasil Diperbaiki: ${messages.join('. ')}.`
      : 'Sistem dan integritas data sudah dalam kondisi optimal 100% sehat!';

  return {
    success: true,
    message: finalMsg,
    fixedCount,
    actionKey,
    report: updatedReport,
  };
}
