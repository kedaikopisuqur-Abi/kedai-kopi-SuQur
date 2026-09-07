export type UserRole = 'admin' | 'kasir';

export type NavTab =
  | 'dashboard'
  | 'pos'
  | 'pre_order'
  | 'inventory'
  | 'expenses'
  | 'cash_debt'
  | 'payroll'
  | 'reports'
  | 'settings';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  avatar?: string;
  assignedOutletId?: string;
  outletId?: string;
  outletName?: string;
  outletIds?: string[]; // Daftar ID cabang penugasan kasir (jika kosong/['ALL'] = semua cabang)
}

export type BranchType = 'CENTRAL' | 'OUTLET';

export interface Outlet {
  id: string;
  name: string;
  code?: string; // e.g. 'PUSAT', 'LAGOA', 'KOJA', 'KBY'
  type?: BranchType; // 'CENTRAL' (Pusat / Hub) | 'OUTLET' (Cabang / Spoke)
  address?: string;
  phone?: string;
  isActive?: boolean;
  isDefault?: boolean;
  isMaster?: boolean;
  isMain?: boolean;
  webhookUrl?: string; // URL Webhook Google Sheet khusus cabang (opsional)
  createdAt?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string; // e.g., 'gram', 'ml', 'pcs'
  costPerUnit: number; // cost per unit in IDR
  currentStock: number;
  minStock: number;
  category: string; // e.g., 'Biji Kopi', 'Susu & Diary', 'Sirup & Gula', 'Kemasan'
  outletId?: string;
  outletName?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // e.g., 'gram', 'ml', 'pcs'
  costPerUnit: number; // cost per unit in IDR
  currentStock: number;
  minStock: number;
  category: string; // e.g., 'Biji Kopi', 'Susu & Diary', 'Sirup & Gula', 'Kemasan'
  outletId?: string;
  outletName?: string;
}

// Skema Stok Bahan Baku per Cabang (Branch Inventory)
export interface BranchInventoryItem {
  id: string; // e.g. 'b-inv-outlet-lagoa-ing-1'
  outletId: string;
  outletName?: string;
  outletType?: 'CENTRAL' | 'OUTLET';
  ingredientId: string;
  ingredientName: string;
  unit: string; // 'gram', 'ml', 'pcs', 'porsi'
  costPerUnit: number;
  currentStock: number;
  minStock: number;
  category?: string;
  lastUpdated?: string;
  updatedAt?: string;
}

// Alur Suplai & Transfer Stok (Pusat ke Outlet)
export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface TransferItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity?: number;
  amount?: number;
  costPerUnit?: number;
  totalCost?: number;
}

export type StockTransferItem = TransferItem & {
  amount: number;
  costPerUnit: number;
};

export interface StockTransfer {
  id: string;
  transferNo?: string; // e.g. TRF-20260824-001
  transferNumber: string; // e.g. SJ-20260824-001
  sourceOutletId?: string;
  sourceOutletName?: string;
  fromOutletId: string;
  fromOutletName: string;
  targetOutletId?: string;
  targetOutletName?: string;
  toOutletId: string;
  toOutletName: string;
  date?: string;
  items: StockTransferItem[];
  status: TransferStatus;
  notes?: string;
  driverName?: string;
  vehicleNumber?: string;
  totalEstimatedValue?: number;
  sentBy?: string;
  sentAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface RecipeItem {
  ingredientId: string;
  amount: number; // amount of ingredient used per product
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. '14oz', '16oz', '18oz', '22oz'
  priceAdjustment: number; // +Rp
  price?: number; // Optional alias for backward compatibility
  cogsAdjustment?: number; // +Rp HPP adjustment
}

export interface Product {
  id: string;
  name: string;
  category: 'Kopi Espresso' | 'Manual Brew' | 'Non-Kopi' | 'Pastry & Snack' | 'Makanan Utama';
  price: number;
  cogs: number; // HPP Total (Raw Material + Packaging + Overhead)
  rawMaterialCost?: number; // Biaya Bahan Baku + Kemasan (Cup/Sablon/Sedotan)
  overheadCost?: number; // Alokasi Biaya Overhead per porsi (Listrik, Air, Perawatan Alat, Biaya Pekerja)
  image: string;
  description?: string;
  isAvailable: boolean;
  recipe: RecipeItem[]; // Recipe of raw materials & packaging
  variants?: ProductVariant[];
  cupOptions?: ('14oz' | '16oz' | '18oz' | '22oz')[];
  hasIceOption?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: ProductVariant;
  variant?: string | ProductVariant; // Optional alias
  selectedCup?: string; // '14oz' | '16oz' | '18oz' | '22oz'
  selectedIce?: string; // 'Pakai Es' | 'Tanpa Es'
  notes?: string;
  unitPrice: number;
  customPrice?: number; // Optional alias
  totalPrice: number;
  subtotal?: number; // Optional alias
  cogsTotal: number;
}

export type PaymentMethod =
  | 'cash'
  | 'qris'
  | 'debit'
  | 'gopay_shopee'
  | 'shopeefood'
  | 'gofood'
  | 'grabfood'
  | 'shopeefood_merchant'
  | 'non_cash_merchant';

export type OrderType = 'dine_in' | 'take_away' | 'online_delivery' | 'shopeefood_merchant';
export type OnlinePlatform = 'ShopeeFood' | 'GoFood' | 'GrabFood' | 'Maxim' | 'Lainnya';

export interface DraftOrder {
  id: string;
  draftNo?: string;
  customerName: string;
  customerPhone?: string;
  tableNumber?: string;
  items: CartItem[];
  createdAt: string; // ISO string
  updatedAt?: string;
  outletId: string;
  outletName?: string;
  cashierId?: string;
  cashierName?: string;
  orderType?: OrderType;
  discountType?: 'percent' | 'nominal';
  discountValue?: number;
  notes?: string;
  subtotal: number;
  total: number;
  status: 'DRAFT' | 'PAID' | 'CANCELLED';
}

export interface TransactionItem {
  productId: string;
  productName: string;
  variantName?: string;
  selectedCup?: string;
  selectedIce?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  cogsUnitPrice: number;
  cogsTotal: number;
  notes?: string;
}

export interface Transaction {
  id: string;
  invoiceNo: string; // e.g., SQ-20260805-001
  queueNo?: string; // e.g., SQ0001, SQ0002 (resets daily)
  timestamp: string; // ISO string
  outletId?: string;
  outletName?: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  tableNo?: string;
  orderType?: OrderType;
  onlinePlatform?: OnlinePlatform;
  onlineOrderNo?: string; // Nomor Pesanan ShopeeFood / GoFood (e.g. GF-8821, SF-1092)
  driverName?: string; // Nama Driver / No Plat Ojol
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  totalCogs: number; // total HPP
  grossProfit: number; // total - totalCogs
  paymentMethod: PaymentMethod;
  cashAmountPaid?: number;
  changeAmount?: number;
  status: 'completed' | 'voided';
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  contactPerson: string;
  itemsSupplied: string[]; // ingredient names or categories
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string;
  supplierName: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
  outletId?: string;
  outletName?: string;
}

export interface Expense {
  id: string;
  expenseNo: string;
  date: string;
  category:
    | 'Sewa Tempat'
    | 'Listrik & Air'
    | 'Gaji Karyawan'
    | 'Pemasaran & Iklan'
    | 'Pemeliharaan Alat'
    | 'Belanja Bahan Baku'
    | 'Lain-lain';
  description: string;
  note?: string; // Optional alias for description
  amount: number;
  recordedBy: string;
  outletId?: string;
  outletName?: string;
  // Raw Material Inventory Linkage
  ingredientId?: string;
  ingredientName?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  autoUpdateStock?: boolean;
}

export interface Shift {
  id: string;
  outletId?: string;
  outletName?: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  startCash: number;
  expectedEndCash?: number;
  actualEndCash?: number;
  difference?: number;
  totalSalesCash: number;
  totalSalesNonCash: number;
  totalSalesMerchant?: number; // Piutang Merchant / Non-Tunai ShopeeFood/GoFood/GrabFood
  totalTransactionsCount: number;
  status: 'open' | 'closed';
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  storeTagline?: string; // Optional alias
  storeAddress?: string; // Optional alias
  storePhone?: string; // Optional alias
  activeOutletId?: string;
  outlets?: Outlet[];
  logoUrl?: string;
  receiptLogoSize?: 'small' | 'medium' | 'large' | 'none';
  receiptHeader: string;
  receiptFooter: string;
  printerPaperSize: '58mm' | '80mm';
  printerConnectionType?: 'bluetooth' | 'usb' | 'network' | 'system';
  printerNetworkIp?: string;
  printerNetworkPort?: number;
  printerDeviceName?: string;
  autoOpenCashDrawer?: boolean;
  cashDrawerPulsePin?: 'pin2' | 'pin5' | 'both';
  autoPrintReceipt?: boolean;
  taxPercentage: number; // e.g. 0 or 11
  // Global Operational & Overhead HPP Settings
  monthlyOperationalExpense?: number; // Total Biaya Operasional Bulanan (Listrik, Air, Perawatan Alat, Biaya Pekerja/Gaji, Sewa, dll.)
  monthlyTargetSalesCup?: number; // Target Sales Cup / Porsi per Bulan (Overhead/Cup = Operasional / Target)
  qrisNmid: string;
  qrisMerchantName: string;
  qrisImageUrl?: string;
  googleSheetWebhookUrl?: string;
  publicOrderUrl?: string; // Custom domain / public URL for customer QR orders
  qrSelfOrderEnabled?: boolean;
  autoPrintQROrders?: boolean;
  allowCashierInventoryAccess?: boolean; // Izin hak akses kasir ke modul stok & resep (diatur oleh admin)
  qrOrderSoundAlertEnabled?: boolean; // Notifikasi suara bel ketika ada pesanan QR masuk
  themeMode?: 'light' | 'dark' | 'system'; // Preferensi Tema Layar Kasir (Light / Dark mode)
  wifiName?: string;
  wifiPassword?: string;
  // WhatsApp Gateway & Webhook Settings
  waGatewayProvider?: 'fonnte' | 'wablas' | 'twilio' | 'generic';
  waApiToken?: string;
  waWebhookSecret?: string;
  waAuthorizedPhones?: string; // Comma or newline separated list of authorized numbers
  waAutoReplyEnabled?: boolean;
  waDefaultOutletId?: string;
}

export interface WAWebhookLog {
  id: string;
  timestamp: string;
  sender: string;
  senderName?: string;
  rawMessage: string;
  parsedAmount?: number;
  parsedDescription?: string;
  outletName?: string;
  status: 'SUCCESS' | 'IGNORED' | 'ERROR';
  responseMessage?: string;
  error?: string;
}

export type QROrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type QROrderPaymentStatus = 'unpaid' | 'paid_qris' | 'paid_cash';

export interface QROrderItem {
  productId: string;
  productName: string;
  variantName?: string;
  selectedCup?: string;
  selectedIce?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  cogsUnitPrice: number;
  cogsTotal: number;
  notes?: string;
}

export interface QROrder {
  id: string;
  orderNo: string; // e.g., QR-20260822-001
  queueNo?: string; // e.g., SQ-QR01
  timestamp: string; // ISO string
  outletId: string;
  outletName: string;
  tableNo: string; // e.g., "Meja 01", "Meja 05", "Outdoor 2", "Takeaway"
  customerName: string;
  customerPhone?: string;
  items: QROrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  totalCogs: number;
  paymentMethod: 'cash_at_cashier' | 'qris';
  paymentStatus: QROrderPaymentStatus;
  status: QROrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  processedByCashierId?: string;
  processedByCashierName?: string;
}

export interface StockOpname {
  id: string;
  date: string;
  outletId?: string;
  outletName?: string;
  ingredientId: string;
  ingredientName: string;
  systemStock: number;
  actualStock: number;
  difference: number;
  reason: 'Kerusakan' | 'Kedaluwarsa' | 'Selisih Hitung' | 'Terbuang/Spill' | 'Lainnya';
  adjustedBy: string;
}

export interface CashLedger {
  id: string;
  date: string;
  type: 'IN' | 'OUT'; // Kas Masuk / Kas Keluar
  category: string; // e.g. 'Penjualan', 'Modal', 'Operasional', 'Belanja Bahan Baku', 'Pelunasan Piutang', 'Pembayaran Hutang', 'Lain-lain'
  amount: number;
  description: string;
  outletId: string;
  outletName?: string;
  createdBy: string;
  paymentMethod?: 'CASH' | 'TRANSFER' | 'QRIS' | 'OTHER';
  referenceId?: string;
  createdAt?: string;
  // Raw Material Inventory Linkage
  ingredientId?: string;
  ingredientName?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  autoUpdateStock?: boolean;
}

export interface CapitalRecord {
  id: string;
  date: string;
  amount: number;
  source: string; // e.g. 'Modal Pribadi Pemilik', 'Investor / Mitra', 'Pinjaman Usaha', 'Laba Ditahan'
  note: string;
  outletId: string;
  outletName?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface DebtPayment {
  id: string;
  date: string;
  amount: number;
  paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS';
  notes?: string;
  recordedBy: string;
}

export interface DebtRecord {
  id: string;
  type: 'DEBT_SUPPLIER' | 'RECEIVABLE_CUSTOMER'; // Hutang ke Supplier / Piutang Bon Pelanggan
  entityName: string; // Nama Supplier atau Nama Pelanggan
  phone?: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string;
  outletId: string;
  outletName?: string;
  historyPayment: DebtPayment[];
  createdAt?: string;
  createdBy?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhone?: string;
  employeeRole?: string;
  outletId: string;
  outletName?: string;
  period: string; // e.g., "Agustus 2026", "2026-08"
  baseSalary: number; // Gaji Pokok
  allowances: number; // Tunjangan (Makan, Transport, Jabatan)
  bonuses: number; // Bonus / Insentif Lembur & Target
  deductions: number; // Potongan (Kasbon / Keterlambatan / Pinjaman)
  netSalary: number; // Take Home Pay (baseSalary + allowances + bonuses - deductions)
  paymentDate: string; // YYYY-MM-DD
  status: 'DRAFT' | 'PAID';
  paymentMethod?: 'CASH' | 'TRANSFER' | 'QRIS' | 'OTHER';
  notes?: string;
  cashRecordId?: string; // ID entri Kas Keluar yang terhubung di Buku Kas
  createdAt?: string;
  paidAt?: string;
  paidBy?: string;
}

export interface FixedAsset {
  id: string;
  assetName: string;
  category: 'EQUIPMENT' | 'FURNITURE' | 'RENOVATION' | 'OTHER';
  purchaseDate: string; // YYYY-MM-DD
  purchasePrice: number;
  outletId: string;
  outletName?: string;
  supplier?: string;
  notes?: string;
  cashRecordId?: string; // ID entri Kas Keluar yang terhubung di Buku Kas (Pengeluaran Modal CAPEX)
  createdAt?: string;
  createdBy?: string;
  // Perawatan Berkala (Maintenance Reminder)
  maintenanceReminderEnabled?: boolean;
  nextMaintenanceDate?: string; // YYYY-MM-DD
  maintenanceFrequencyDays?: number; // 30, 60, 90, 180, 365
  maintenanceNotes?: string;
  lastMaintenanceDate?: string;
}

export type PreOrderType = 'PICKUP' | 'DELIVERY' | 'DINE_IN_RESERVATION';
export type PreOrderPaymentStatus = 'UNPAID' | 'PARTIAL_DP' | 'PAID';
export type PreOrderStatus = 'SCHEDULED' | 'IN_PREPARATION' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface PreOrder {
  id: string;
  poNumber?: string; // e.g. PO-20260828-001
  customerName: string;
  customerPhone: string;
  outletId: string;
  outletName?: string;
  orderType: PreOrderType;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  items: CartItem[];
  totalAmount: number;
  depositAmount: number; // Uang Muka (DP)
  remainingBalance: number; // Sisa Pelunasan (totalAmount - depositAmount)
  paymentStatus: PreOrderPaymentStatus;
  orderStatus: PreOrderStatus;
  tableNumber?: string;
  deliveryAddress?: string;
  notes?: string;
  dpPaymentMethod?: PaymentMethod | 'CASH' | 'QRIS' | 'TRANSFER' | string;
  finalPaymentMethod?: PaymentMethod | 'CASH' | 'QRIS' | 'TRANSFER' | string;
  dpCashRecordId?: string;
  finalCashRecordId?: string;
  transactionId?: string; // Reference to completed Transaction
  invoiceNo?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  cashierId?: string;
  cashierName?: string;
  createdBy?: string;
}



