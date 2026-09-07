import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Zap, Printer, X, Radio, CheckCircle2, ArrowRight } from 'lucide-react';
import { User, StoreSettings, Product, Ingredient, Transaction, Supplier, PurchaseOrder, Expense, StockOpname, Shift, Outlet, CashLedger, CapitalRecord, DebtRecord, DebtPayment, BranchInventoryItem, StockTransfer, FixedAsset } from './types';
import { StorageService } from './services/storage';
import { syncTransactionToGoogleSheet } from './services/googleSheetService';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { POSScreen } from './components/POS/POSScreen';
import { PreOrderSchedule } from './components/PreOrderSchedule';
import { ThermalReceiptModal } from './components/POS/ThermalReceiptModal';
import { QRISModal } from './components/POS/QRISModal';
import { InventoryScreen } from './components/Inventory/InventoryScreen';
import { SupplierScreen } from './components/Suppliers/SupplierScreen';
import { ExpenseScreen } from './components/Expenses/ExpenseScreen';
import { CashDebtScreen } from './components/CashDebt/CashDebtScreen';
import { ReportScreen } from './components/Reports/ReportScreen';
import { PayrollScreen } from './components/Payroll/PayrollScreen';
import { SettingsScreen } from './components/Settings/SettingsScreen';
import { ShiftModal } from './components/ShiftModal';
import { LoginScreen } from './components/LoginScreen';
import { UserProfileModal } from './components/UserProfileModal';
import { LogoutSyncModal } from './components/LogoutSyncModal';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { CustomerMenuScreen } from './components/CustomerOrder/CustomerMenuScreen';
import { CustomerPOPage } from './components/CustomerPOPage';
import { AutoLockModal } from './components/AutoLockModal';
import { IncomingQROrderAlertModal } from './components/POS/IncomingQROrderAlertModal';
import { FloatingWidget } from './components/FloatingWidget';
import { NotificationService } from './services/notificationService';
import { playOrderNotificationBell } from './utils/audio';
import { PWAInstallBanner } from './components/PWA/PWAInstallBanner';
import { InstallAppModal } from './components/PWA/InstallAppModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { DailyRecapModal } from './components/Reports/DailyRecapModal';
import { FirestoreQuotaAlertToast } from './components/FirestoreQuotaAlertToast';
import { useTheme } from './context/ThemeContext';

export default function App() {
  const { preset, presetDetails, bgConfig, isDarkMode } = useTheme();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check if opened with customer QR order URL params (Bebas Login)
  const [isCustomerMode, setIsCustomerMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return (
      p.get('mode') === 'order' ||
      p.get('mode') === 'menu' ||
      p.get('mode') === 'selforder' ||
      p.get('mode') === 'self-order' ||
      p.get('mode') === 'customer' ||
      p.get('view') === 'menu' ||
      p.get('view') === 'order' ||
      p.get('view') === 'selforder' ||
      p.get('page') === 'menu' ||
      p.get('page') === 'order' ||
      p.get('page') === 'selforder' ||
      Boolean(p.get('table')) ||
      Boolean(p.get('meja')) ||
      path === '/menu' ||
      path.startsWith('/menu') ||
      path === '/order' ||
      path.startsWith('/order') ||
      path === '/selforder' ||
      path.startsWith('/selforder') ||
      path === '/self-order' ||
      path.startsWith('/self-order') ||
      path === '/pesan' ||
      path.startsWith('/pesan') ||
      hash === '#menu' ||
      hash.startsWith('#menu') ||
      hash === '#order' ||
      hash.startsWith('#order') ||
      hash === '#selforder' ||
      hash.startsWith('#selforder') ||
      hash === '#pesan'
    );
  });

  // Watch for history popstate / hash changes to update customer mode
  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window === 'undefined') return;
      const p = new URLSearchParams(window.location.search);
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const isMenu =
        p.get('mode') === 'order' ||
        p.get('mode') === 'menu' ||
        p.get('mode') === 'selforder' ||
        p.get('mode') === 'self-order' ||
        p.get('mode') === 'customer' ||
        p.get('view') === 'menu' ||
        p.get('view') === 'order' ||
        p.get('view') === 'selforder' ||
        p.get('page') === 'menu' ||
        p.get('page') === 'order' ||
        p.get('page') === 'selforder' ||
        Boolean(p.get('table')) ||
        Boolean(p.get('meja')) ||
        path === '/menu' ||
        path.startsWith('/menu') ||
        path === '/order' ||
        path.startsWith('/order') ||
        path === '/selforder' ||
        path.startsWith('/selforder') ||
        path === '/self-order' ||
        path.startsWith('/self-order') ||
        path === '/pesan' ||
        path.startsWith('/pesan') ||
        hash === '#menu' ||
        hash.startsWith('#menu') ||
        hash === '#order' ||
        hash.startsWith('#order') ||
        hash === '#selforder' ||
        hash.startsWith('#selforder') ||
        hash === '#pesan';
      setIsCustomerMode(isMenu);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Check if opened with customer Pre-Order (PO) URL params or route
  const [isCustomerPOMode, setIsCustomerPOMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    const hash = window.location.hash;
    return (
      p.get('page') === 'po-order' ||
      p.get('mode') === 'po' ||
      p.get('mode') === 'preorder' ||
      p.get('view') === 'po-order' ||
      path === '/po-order' ||
      path.startsWith('/po-order') ||
      hash === '#po-order' ||
      hash.startsWith('#po-order')
    );
  });

  // App State
  const [user, setUser] = useState<User>(StorageService.getCurrentUser());
  const [users, setUsers] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>(() => StorageService.getOutlets());
  const [activeOutlet, setActiveOutlet] = useState<Outlet>(() => StorageService.getActiveOutlet());
  const [settings, setSettings] = useState<StoreSettings>(StorageService.getSettings());
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [branchInventory, setBranchInventory] = useState<BranchInventoryItem[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [cashLedgers, setCashLedgers] = useState<CashLedger[]>([]);
  const [capitalRecords, setCapitalRecords] = useState<CapitalRecord[]>([]);
  const [debtRecords, setDebtRecords] = useState<DebtRecord[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [opsSubTab, setOpsSubTab] = useState<'expenses' | 'suppliers'>('expenses');
  const [isMobilePreview, setIsMobilePreview] = useState<boolean>(false);
  const [receiptModalTx, setReceiptModalTx] = useState<Transaction | null>(null);
  const [qrisModalTx, setQrisModalTx] = useState<Transaction | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [editingProfileUser, setEditingProfileUser] = useState<User | null>(null);
  const [realtimePushedTx, setRealtimePushedTx] = useState<Transaction | null>(null);
  const [incomingQROrder, setIncomingQROrder] = useState<any | null>(null);
  const [isLogoutSyncOpen, setIsLogoutSyncOpen] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState<boolean>(false);
  const [isDailyRecapOpen, setIsDailyRecapOpen] = useState<boolean>(false);

  // Focus Mode & PIN Auto-Lock States
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sq_focus_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(false);

  // Inactivity Auto-Lock Timer (3 Minutes = 180,000 ms)
  useEffect(() => {
    if (!isAuthenticated || isScreenLocked) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsScreenLocked(true);
      }, 3 * 60 * 1000); // 3 minutes
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isAuthenticated, isScreenLocked]);

  const handleToggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sq_focus_mode', String(next));
      } catch (e) {}
      if (next && activeTab !== 'pos') {
        setActiveTab('pos');
      }
      return next;
    });
  };

  // Ensure non-admin users cannot stay on admin-only or restricted tabs
  useEffect(() => {
    if (user.role !== 'admin') {
      if (activeTab === 'payroll' || activeTab === 'settings') {
        setActiveTab('dashboard');
      }
      // If cashier is on inventory tab but admin disabled inventory access
      if (activeTab === 'inventory' && !settings.allowCashierInventoryAccess) {
        setActiveTab('pos');
      }
    }
  }, [user.role, activeTab, settings.allowCashierInventoryAccess]);

  const handleManualSync = async () => {
    const result = await StorageService.syncLocalToFirestore();
    refreshState();
    return result;
  };

  // Play gentle notification sound chime when a remote transaction is pushed
  const playRealtimeChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      // Browser audio restriction ignored
    }
  };

  // Initialize Data, IndexedDB Engine & Firestore Realtime Database Sync
  useEffect(() => {
    StorageService.initSeedData();
    refreshState();
    setIsLoaded(true);

    // Asynchronously initialize IndexedDB, migrate LocalStorage & hydrate cache
    StorageService.initIndexedDBStorage().then(() => {
      refreshState();
    });

    // Subscribe to online Firestore real-time database updates
    const unsubscribeFirestore = StorageService.initFirestoreSync(() => {
      refreshState();
    });

    // Handle real-time transaction push notifications from remote devices (HP Kasir 1 -> Kasir 2 / Owner)
    const handleRemoteTxPush = (e: any) => {
      if (e.detail) {
        setRealtimePushedTx(e.detail);
        refreshState();
        playRealtimeChime();
      }
    };

    // Handle incoming QR Self-Order from customer table barcode & WA Orders
    const handleQROrderPushed = (e: any) => {
      if (e.detail) {
        const order = e.detail;
        const currentActiveOutlet = StorageService.getActiveOutlet();
        // Trigger alert if order belongs to current outlet or no outlet set
        if (!order.outletId || !currentActiveOutlet?.id || order.outletId === currentActiveOutlet.id) {
          setIncomingQROrder(order);
          const currentSettings = StorageService.getSettings();
          if (currentSettings.qrOrderSoundAlertEnabled !== false) {
            playOrderNotificationBell();
          }

          // Trigger native Push / Background Notification to mobile/desktop
          NotificationService.notifyIncomingOrder({
            id: order.id,
            orderNo: order.orderNo,
            tableNo: order.tableNo,
            customerName: order.customerName,
            total: order.total,
            itemsCount: order.items?.length || 0,
            orderType: 'qr_order',
          });
        }
        refreshState();
      }
    };

    // Handle Service Worker notification click routing
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_OPEN_ORDER') {
        setActiveTab('pos');
      } else if (event.data?.type === 'BACKGROUND_SYNC_COMPLETED') {
        refreshState();
      }
    };

    const handleCustomNotifClick = (e: any) => {
      if (e.detail) {
        setActiveTab('pos');
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Shortcut Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
        return;
      }

      // Shortcut '/' when not focusing an input or textarea
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    const handlePendingSyncEvent = (e: any) => {
      const count = typeof e?.detail?.count === 'number'
        ? e.detail.count
        : StorageService.getPendingOfflineCount();
      setPendingSyncCount(count);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('realtime_transaction_pushed', handleRemoteTxPush);
    window.addEventListener('realtime_qr_order_pushed', handleQROrderPushed);
    window.addEventListener('realtime_notification_clicked', handleCustomNotifClick);
    window.addEventListener('sq_pending_sync_updated', handlePendingSyncEvent);
    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('realtime_transaction_pushed', handleRemoteTxPush);
      window.removeEventListener('realtime_qr_order_pushed', handleQROrderPushed);
      window.removeEventListener('realtime_notification_clicked', handleCustomNotifClick);
      window.removeEventListener('sq_pending_sync_updated', handlePendingSyncEvent);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  const refreshState = useCallback((loadFullReports: boolean = false) => {
    setUser(StorageService.getCurrentUser());
    setUsers(StorageService.getUsers());
    setOutlets(StorageService.getOutlets());
    setActiveOutlet(StorageService.getActiveOutlet());
    setSettings(StorageService.getSettings());
    setProducts(StorageService.getProducts());
    setIngredients(StorageService.getIngredients());
    setBranchInventory(StorageService.getBranchInventory());
    setStockTransfers(StorageService.getStockTransfers());
    // Load lightweight today/active shift transactions by default; full history when viewing reports
    setTransactions(StorageService.getTransactions(!loadFullReports && activeTab !== 'reports'));
    setSuppliers(StorageService.getSuppliers());
    setPurchases(StorageService.getPurchases());
    setExpenses(StorageService.getExpenses());
    setStockOpnames(StorageService.getStockOpnames());
    setActiveShift(StorageService.getActiveShift());
    setCashLedgers(StorageService.getCashLedgers());
    setCapitalRecords(StorageService.getCapitalRecords());
    setDebtRecords(StorageService.getDebtRecords());
    setFixedAssets(StorageService.getFixedAssets());
    setPendingSyncCount(StorageService.getPendingOfflineCount());
  }, [activeTab]);

  // Handlers for Cash Ledger, Capital, and Debt
  const handleAddCashLedger = useCallback((ledger: CashLedger) => {
    StorageService.addCashLedger(ledger);
    setCashLedgers(StorageService.getCashLedgers());
    // Also refresh inventory state in case of auto stock updates
    setIngredients(StorageService.getIngredients());
    setBranchInventory(StorageService.getBranchInventory());
    setStockOpnames(StorageService.getStockOpnames());
    setPurchases(StorageService.getPurchases());
  }, []);

  const handleDeleteCashLedger = useCallback((id: string) => {
    StorageService.deleteCashLedger(id);
    setCashLedgers(StorageService.getCashLedgers());
  }, []);

  const handleAddCapitalRecord = useCallback((record: CapitalRecord, autoAddToCashLedger?: boolean) => {
    StorageService.addCapitalRecord(record, autoAddToCashLedger);
    setCapitalRecords(StorageService.getCapitalRecords());
    setCashLedgers(StorageService.getCashLedgers());
  }, []);

  const handleDeleteCapitalRecord = useCallback((id: string) => {
    StorageService.deleteCapitalRecord(id);
    setCapitalRecords(StorageService.getCapitalRecords());
  }, []);

  const handleAddDebtRecord = useCallback((record: DebtRecord) => {
    StorageService.addDebtRecord(record);
    setDebtRecords(StorageService.getDebtRecords());
  }, []);

  const handleAddDebtPayment = useCallback((
    debtId: string,
    payment: DebtPayment,
    autoRecordCashLedger?: boolean
  ) => {
    StorageService.addDebtPayment(debtId, payment, autoRecordCashLedger);
    setDebtRecords(StorageService.getDebtRecords());
    setCashLedgers(StorageService.getCashLedgers());
  }, []);

  const handleDeleteDebtRecord = useCallback((id: string) => {
    StorageService.deleteDebtRecord(id);
    setDebtRecords(StorageService.getDebtRecords());
  }, []);

  // Handlers for Fixed Assets & CAPEX
  const handleAddFixedAsset = useCallback((asset: FixedAsset, autoRecordCashLedger?: boolean) => {
    StorageService.addFixedAsset(asset, autoRecordCashLedger);
    setFixedAssets(StorageService.getFixedAssets());
    setCashLedgers(StorageService.getCashLedgers());
  }, []);

  const handleUpdateFixedAsset = useCallback((asset: FixedAsset) => {
    StorageService.updateFixedAsset(asset);
    setFixedAssets(StorageService.getFixedAssets());
  }, []);

  const handleDeleteFixedAsset = useCallback((id: string) => {
    StorageService.deleteFixedAsset(id);
    setFixedAssets(StorageService.getFixedAssets());
  }, []);

  // Handlers for Storage operations
  const handleSwitchOutlet = useCallback((outletId: string) => {
    StorageService.setActiveOutletId(outletId);
    setOutlets(StorageService.getOutlets());
    setActiveOutlet(StorageService.getActiveOutlet());
  }, []);

  const handleSwitchUser = useCallback((newUser: User) => {
    if (user.role === 'kasir' && newUser.id !== user.id) {
      alert(`Akses Terkunci! Akun Kasir (${user.name}) tidak diizinkan berganti ke akun Admin atau Kasir lainnya. Silakan Logout terlebih dahulu.`);
      return;
    }
    if (user.role === 'admin' && newUser.role === 'kasir') {
      alert(`Akses Terbatas: Admin hanya memiliki akses melihat status Kasir (${newUser.name}), dan tidak dapat beralih ke akun Kasir.`);
      return;
    }
    StorageService.setCurrentUser(newUser);
    setUser(newUser);
  }, [user]);

  const handleSaveSettings = useCallback((newSettings: StoreSettings) => {
    StorageService.saveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  const handleSaveProduct = useCallback((product: Product) => {
    const exists = StorageService.getProducts().some((p) => p.id === product.id);
    if (exists) {
      StorageService.updateProduct(product);
    } else {
      StorageService.addProduct(product);
    }
    setProducts(StorageService.getProducts());
  }, []);

  const handleDeleteProduct = useCallback((id: string) => {
    StorageService.deleteProduct(id);
    setProducts(StorageService.getProducts());
  }, []);

  const handleSaveIngredient = useCallback((ingredient: Ingredient) => {
    const exists = StorageService.getIngredients().some((i) => i.id === ingredient.id);
    if (exists) {
      StorageService.updateIngredient(ingredient);
    } else {
      StorageService.addIngredient(ingredient);
    }
    setIngredients(StorageService.getIngredients());
  }, []);

  const handleDeleteIngredient = useCallback((id: string) => {
    StorageService.deleteIngredient(id);
    setIngredients(StorageService.getIngredients());
  }, []);

  const handleCompleteTransaction = useCallback((tx: Transaction) => {
    // 1. Simpan ke Database Lokal (IndexedDB / LocalStorage & Firestore)
    const res = StorageService.createTransaction(tx);
    const finalTx = res?.transaction || tx;
    setTransactions(StorageService.getTransactions());
    setIngredients(StorageService.getIngredients());

    // Otomatis tampilkan dialog cetak nota / tiket thermal setelah transaksi berhasil
    if (finalTx.paymentMethod !== 'qris') {
      setReceiptModalTx(finalTx);
    }

    // 2. Baca URL Webhook dari Pengaturan/LocalStorage
    const googleSheetWebhookUrl =
      typeof window !== 'undefined'
        ? localStorage.getItem('google_sheet_webhook_url') || settings?.googleSheetWebhookUrl
        : undefined;

    // 3. Kirim Otomatis ke Google Sheet (Background Process)
    if (googleSheetWebhookUrl) {
      syncTransactionToGoogleSheet(googleSheetWebhookUrl, finalTx).catch((err) =>
        console.warn('Gagal sinkronkan ke Google Sheets:', err)
      );
    }

    return res;
  }, [settings?.googleSheetWebhookUrl]);

  const handleAddPurchase = useCallback((po: PurchaseOrder) => {
    StorageService.addPurchase(po);
    setPurchases(StorageService.getPurchases());
    setIngredients(StorageService.getIngredients());
  }, []);

  const handleSaveSupplier = useCallback((supplier: Supplier) => {
    setSuppliers((prev) => {
      const updated = [supplier, ...prev];
      StorageService.saveSuppliers(updated);
      return updated;
    });
  }, []);

  const handleAddExpense = useCallback((exp: Expense) => {
    StorageService.addExpense(exp);
    setExpenses(StorageService.getExpenses());
    // Also refresh inventory state in case of auto stock updates
    setIngredients(StorageService.getIngredients());
    setBranchInventory(StorageService.getBranchInventory());
    setStockOpnames(StorageService.getStockOpnames());
    setPurchases(StorageService.getPurchases());
  }, []);

  const handleDeleteExpense = useCallback((id: string) => {
    StorageService.deleteExpense(id);
    setExpenses(StorageService.getExpenses());
  }, []);

  const handleAddStockOpname = useCallback((opname: StockOpname) => {
    StorageService.addStockOpname(opname);
    setStockOpnames(StorageService.getStockOpnames());
    setIngredients(StorageService.getIngredients());
    setBranchInventory(StorageService.getBranchInventory());
  }, []);

  const handleCreateStockTransfer = useCallback((transfer: StockTransfer) => {
    const res = StorageService.createStockTransfer(transfer);
    setStockTransfers(StorageService.getStockTransfers());
    setBranchInventory(StorageService.getBranchInventory());
    setIngredients(StorageService.getIngredients());
    return res;
  }, []);

  const handleReceiveStockTransfer = useCallback((transferId: string, receiverName: string) => {
    const res = StorageService.receiveStockTransfer(transferId, receiverName);
    setStockTransfers(StorageService.getStockTransfers());
    setBranchInventory(StorageService.getBranchInventory());
    setIngredients(StorageService.getIngredients());
    return res;
  }, []);

  const handleCancelStockTransfer = useCallback((transferId: string, cancelerName: string) => {
    const res = StorageService.cancelStockTransfer(transferId, cancelerName);
    setStockTransfers(StorageService.getStockTransfers());
    setBranchInventory(StorageService.getBranchInventory());
    setIngredients(StorageService.getIngredients());
    return res;
  }, []);

  const handleSaveBranchInventory = useCallback((items: BranchInventoryItem[]) => {
    StorageService.saveBranchInventory(items);
    setBranchInventory(StorageService.getBranchInventory());
  }, []);

  const handleDeleteStockOpname = useCallback((id: string) => {
    StorageService.deleteStockOpname(id);
    setStockOpnames(StorageService.getStockOpnames());
  }, []);

  const handleDeleteTransaction = useCallback((id: string) => {
    StorageService.deleteTransaction(id);
    setTransactions(StorageService.getTransactions());
  }, []);

  const handleDeleteShift = useCallback((id: string) => {
    StorageService.deleteShift(id);
  }, []);

  const handleDeleteSupplier = useCallback((id: string) => {
    StorageService.deleteSupplier(id);
    setSuppliers(StorageService.getSuppliers());
  }, []);

  const handleDeletePurchase = useCallback((id: string) => {
    StorageService.deletePurchase(id);
    setPurchases(StorageService.getPurchases());
  }, []);

  const handleResetInventoryAndRecipes = useCallback(() => {
    StorageService.clearInventoryAndRecipes();
    refreshState();
  }, [refreshState]);

  const handleResetOperationalData = useCallback(() => {
    StorageService.clearOperationalData();
    refreshState();
  }, [refreshState]);

  const handleResetReportsAndTransactions = useCallback(() => {
    StorageService.clearReportsAndTransactions();
    refreshState();
  }, [refreshState]);

  const handleResetOperationalAndReports = useCallback(() => {
    StorageService.clearOperationalAndReports();
    refreshState();
  }, [refreshState]);

  const handleResetAllDataEmpty = useCallback(() => {
    StorageService.clearAllDataEmpty();
    refreshState();
  }, [refreshState]);

  const handleSaveUsers = useCallback((updatedUsers: User[]) => {
    StorageService.saveUsers(updatedUsers);
    setUsers(updatedUsers);

    // If current logged-in user details were edited, update state
    const updatedCurrent = updatedUsers.find((u) => u.id === user.id);
    if (updatedCurrent) {
      StorageService.setCurrentUser(updatedCurrent);
      setUser(updatedCurrent);
    }
  }, [user.id]);

  const handleSaveUserProfile = useCallback((updatedUser: User) => {
    StorageService.updateUser(updatedUser);
    setUsers(StorageService.getUsers());
    setUser(StorageService.getCurrentUser());
  }, []);

  const handleStartShift = useCallback((startCash: number) => {
    const shift = StorageService.startShift(user.id, user.name, startCash);
    setActiveShift(shift);
  }, [user.id, user.name]);

  const handleEndShift = useCallback((actualCash: number): Shift | null => {
    const closed = StorageService.endShift(actualCash);
    setActiveShift(null);
    return closed;
  }, []);

  const handleLoginSuccess = useCallback((loggedInUser: User, selectedOutletId?: string) => {
    if (selectedOutletId) {
      StorageService.setActiveOutletId(selectedOutletId);
      const updatedOutlets = StorageService.getOutlets();
      setOutlets(updatedOutlets);
      const matched = updatedOutlets.find((o) => o.id === selectedOutletId) || updatedOutlets[0];
      if (matched) {
        setActiveOutlet(matched);
      }
    }
    StorageService.setCurrentUser(loggedInUser);
    setUser(loggedInUser);
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    setIsLogoutSyncOpen(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#2B1713] flex items-center justify-center text-[#FAF3DD]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#D4A373] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-bold text-sm">Memuat Su-Qur POS...</p>
        </div>
      </div>
    );
  }

  // Render Customer Self-Order / Digital Menu if in customer mode
  if (isCustomerMode) {
    return (
      <CustomerMenuScreen
        onExitToPOS={() => {
          setIsCustomerMode(false);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('mode');
            url.searchParams.delete('table');
            window.history.replaceState({}, '', url.pathname);
          } catch {}
        }}
      />
    );
  }

  // Render Customer Public Pre-Order (PO) Page if in customer PO mode
  if (isCustomerPOMode) {
    return (
      <CustomerPOPage
        onExitToPOS={() => {
          setIsCustomerPOMode(false);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('page');
            url.searchParams.delete('mode');
            url.searchParams.delete('view');
            url.searchParams.delete('outlet');
            window.history.replaceState({}, '', url.pathname);
          } catch {}
        }}
      />
    );
  }

  // Render Login Screen if not authenticated when opening the app / publish link
  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen
          users={users}
          settings={settings}
          outlets={outlets}
          currentOutletId={activeOutlet?.id}
          onLoginSuccess={handleLoginSuccess}
          onOpenCustomerOrder={() => {
            setIsCustomerMode(true);
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('mode', 'order');
              window.history.replaceState({}, '', url.toString());
            } catch {}
          }}
          onOpenCustomerPO={() => {
            setIsCustomerPOMode(true);
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('page', 'po-order');
              window.history.replaceState({}, '', url.toString());
            } catch {}
          }}
          onOpenInstallApp={() => setIsInstallModalOpen(true)}
        />
        <InstallAppModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col font-sans antialiased relative selection:bg-[#D4A373] selection:text-[#1F1412] ${isDarkMode ? 'bg-[#09090B] text-[#FAF3DD]' : 'bg-[#FDFBF7] text-[#2B1713]'}`}>
      {/* Dynamic Background Image / Wallpaper Layer */}
      {bgConfig.url && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-300"
          style={{
            backgroundImage: `url(${bgConfig.url})`,
            filter: `blur(${bgConfig.blur}px)`,
            transform: bgConfig.blur > 0 ? 'scale(1.04)' : 'none',
          }}
        />
      )}

      {/* Dynamic Overlay Tint to ensure text, charts and buttons remain highly readable */}
      {bgConfig.url && (
        <div
          className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-300"
          style={{
            backgroundColor: isDarkMode ? '#09090B' : presetDetails.bgLight,
            opacity: bgConfig.opacity / 100,
          }}
        />
      )}

      {/* Fixed Sticky Header & Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-[#3E2723] shadow-md w-full relative">
        <Header
          user={user}
          settings={settings}
          activeShift={activeShift}
          users={users}
          outlets={outlets}
          activeOutlet={activeOutlet}
          onSwitchOutlet={handleSwitchOutlet}
          onSwitchUser={handleSwitchUser}
          onLogout={handleLogout}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
          isMobilePreview={isMobilePreview}
          onToggleMobilePreview={() => setIsMobilePreview(!isMobilePreview)}
          onOpenEditProfile={(u) => setEditingProfileUser(u || user)}
          pendingSyncCount={pendingSyncCount}
          onManualSync={handleManualSync}
          ingredients={ingredients}
          isFocusMode={isFocusMode}
          onToggleFocusMode={handleToggleFocusMode}
          onLockScreen={() => setIsScreenLocked(true)}
          onNavigateTab={setActiveTab}
          onOpenInstallApp={() => setIsInstallModalOpen(true)}
          onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
          onOpenDailyRecap={() => setIsDailyRecapOpen(true)}
        />

        {/* Primary Navigation */}
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          userRole={user.role}
          isFocusMode={isFocusMode}
          allowCashierInventoryAccess={settings.allowCashierInventoryAccess}
        />
      </div>

      {/* Main Content Workspace area with padding-bottom for mobile navigation */}
      <main className={`container-fluid-responsive flex-1 w-full max-w-[90rem] relative z-10 ${isMobilePreview ? 'py-4 sm:py-6 px-1.5 sm:px-2 pb-28 md:pb-8 flex justify-center items-start bg-[#1F1412]/90 overflow-x-hidden' : 'p-2.5 sm:p-5 md:p-6 pb-28 md:pb-8 w-full mx-auto overflow-x-hidden'}`}>
        {/* Mobile View Simulator Frame option */}
        <div className={isMobilePreview ? 'w-full max-w-[26rem] bg-[#FDFBF7] rounded-3xl shadow-2xl border-4 sm:border-8 border-[#3E2723] overflow-y-auto max-h-[calc(100dvh-8.75rem)] min-h-[40rem] p-2.5 sm:p-3.5 transition-all' : 'w-full max-w-full'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (activeTab === 'expenses' ? opsSubTab : '')}
              initial={{ opacity: 0, y: 12, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.995 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  transactions={transactions}
                  ingredients={ingredients}
                  expenses={expenses}
                  products={products}
                  user={user}
                  activeShift={activeShift}
                  users={users}
                  outlets={outlets}
                  activeOutlet={activeOutlet}
                  cashLedgers={cashLedgers}
                  capitalRecords={capitalRecords}
                  debtRecords={debtRecords}
                  fixedAssets={fixedAssets}
                  branchInventory={branchInventory}
                  onSwitchOutlet={(outletId) => {
                    StorageService.setActiveOutletId(outletId);
                    refreshState();
                  }}
                  pendingSyncCount={pendingSyncCount}
                  onManualSync={handleManualSync}
                  onOpenReceipt={(tx) => setReceiptModalTx(tx)}
                  onNavigateTab={setActiveTab}
                  settings={settings}
                  onOpenDailyRecap={() => setIsDailyRecapOpen(true)}
                />
              )}

              {activeTab === 'pos' && (
                <POSScreen
                  products={products}
                  ingredients={ingredients}
                  user={user}
                  settings={settings}
                  onCompleteTransaction={handleCompleteTransaction}
                  onOpenReceipt={(tx) => setReceiptModalTx(tx)}
                  onOpenQRIS={(tx) => setQrisModalTx(tx)}
                  isFocusMode={isFocusMode}
                />
              )}

              {activeTab === 'pre_order' && (
                <PreOrderSchedule
                  user={user}
                  settings={settings}
                  products={products}
                  activeOutlet={activeOutlet}
                  outlets={outlets}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryScreen
                  products={products}
                  ingredients={ingredients}
                  stockOpnames={stockOpnames}
                  user={user}
                  outlets={outlets}
                  activeOutlet={activeOutlet}
                  branchInventory={branchInventory}
                  stockTransfers={stockTransfers}
                  fixedAssets={fixedAssets}
                  settings={settings}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onSaveIngredient={handleSaveIngredient}
                  onDeleteIngredient={handleDeleteIngredient}
                  onAddStockOpname={handleAddStockOpname}
                  onDeleteStockOpname={handleDeleteStockOpname}
                  onResetData={handleResetInventoryAndRecipes}
                  onCreateStockTransfer={handleCreateStockTransfer}
                  onReceiveStockTransfer={handleReceiveStockTransfer}
                  onCancelStockTransfer={handleCancelStockTransfer}
                  onSaveBranchInventory={handleSaveBranchInventory}
                  onAddFixedAsset={handleAddFixedAsset}
                  onUpdateFixedAsset={handleUpdateFixedAsset}
                  onDeleteFixedAsset={handleDeleteFixedAsset}
                />
              )}

              {activeTab === 'expenses' && (
                <div className="space-y-4">
                  <div className="flex justify-center sm:justify-start">
                    <div className="bg-[#E6D5C3] p-1 rounded-xl flex items-center gap-1 text-xs">
                      <button
                        onClick={() => setOpsSubTab('expenses')}
                        className={`px-4 py-1.5 rounded-lg font-bold transition-all ${
                          opsSubTab === 'expenses' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs' : 'text-[#3E2723] hover:text-black'
                        }`}
                      >
                        Pengeluaran Operasional
                      </button>
                      <button
                        onClick={() => setOpsSubTab('suppliers')}
                        className={`px-4 py-1.5 rounded-lg font-bold transition-all ${
                          opsSubTab === 'suppliers' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs' : 'text-[#3E2723] hover:text-black'
                        }`}
                      >
                        Restok & Supplier
                      </button>
                    </div>
                  </div>

                  {opsSubTab === 'expenses' ? (
                    <ExpenseScreen
                      expenses={expenses}
                      user={user}
                      ingredients={ingredients}
                      outlets={outlets}
                      activeOutlet={activeOutlet}
                      onAddExpense={handleAddExpense}
                      onDeleteExpense={handleDeleteExpense}
                      onResetData={handleResetOperationalData}
                    />
                  ) : (
                    <SupplierScreen
                      suppliers={suppliers}
                      ingredients={ingredients}
                      purchases={purchases}
                      user={user}
                      onSaveSupplier={handleSaveSupplier}
                      onAddPurchase={handleAddPurchase}
                      onDeleteSupplier={handleDeleteSupplier}
                      onDeletePurchase={handleDeletePurchase}
                    />
                  )}
                </div>
              )}

              {activeTab === 'cash_debt' && (
                <CashDebtScreen
                  cashLedgers={cashLedgers}
                  capitalRecords={capitalRecords}
                  debtRecords={debtRecords}
                  fixedAssets={fixedAssets}
                  outlets={outlets}
                  activeOutlet={activeOutlet}
                  currentUser={user}
                  ingredients={ingredients}
                  onAddCashLedger={handleAddCashLedger}
                  onDeleteCashLedger={handleDeleteCashLedger}
                  onAddCapitalRecord={handleAddCapitalRecord}
                  onDeleteCapitalRecord={handleDeleteCapitalRecord}
                  onAddDebtRecord={handleAddDebtRecord}
                  onAddDebtPayment={handleAddDebtPayment}
                  onDeleteDebtRecord={handleDeleteDebtRecord}
                  onAddFixedAsset={handleAddFixedAsset}
                  onUpdateFixedAsset={handleUpdateFixedAsset}
                  onDeleteFixedAsset={handleDeleteFixedAsset}
                />
              )}

              {activeTab === 'payroll' && user.role === 'admin' && (
                <PayrollScreen
                  settings={settings}
                  users={users}
                  outlets={outlets}
                  currentOutletId={activeOutlet.id}
                  currentUser={user}
                  onNotification={(msg, type) => {
                    // Update cash ledgers in state if modified
                    setCashLedgers(StorageService.getCashLedgers());
                  }}
                />
              )}

              {activeTab === 'reports' && (
                <ReportScreen
                  transactions={transactions}
                  expenses={expenses}
                  settings={settings}
                  user={user}
                  outlets={outlets}
                  activeOutlet={activeOutlet}
                  onOpenReceipt={(tx) => setReceiptModalTx(tx)}
                  onDeleteTransaction={handleDeleteTransaction}
                  onDeleteShift={handleDeleteShift}
                  onDeleteExpense={handleDeleteExpense}
                  onResetData={handleResetReportsAndTransactions}
                  onResetOperationalAndReports={handleResetOperationalAndReports}
                  onRestoreBackup={(jsonStr) => {
                    const ok = StorageService.restoreBackupJSON(jsonStr);
                    if (ok) refreshState();
                    return ok;
                  }}
                />
              )}

              {activeTab === 'settings' && user.role === 'admin' && (
                <SettingsScreen
                  settings={settings}
                  users={users}
                  currentUser={user}
                  outlets={outlets}
                  onSaveSettings={handleSaveSettings}
                  onSaveUsers={handleSaveUsers}
                  onExportBackup={StorageService.exportBackupJSON}
                  onRestoreBackup={StorageService.restoreBackupJSON}
                  onResetDefault={StorageService.resetToDefault}
                  onResetInventory={handleResetInventoryAndRecipes}
                  onResetOperational={handleResetOperationalData}
                  onResetReports={handleResetReportsAndTransactions}
                  onResetOperationalAndReports={handleResetOperationalAndReports}
                  onResetAllEmpty={handleResetAllDataEmpty}
                  onOutletsChange={() => {
                    setOutlets(StorageService.getOutlets());
                    setActiveOutlet(StorageService.getActiveOutlet());
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Real-time Push Notification Toast Banner (HP Kasir 1 -> Kasir 2 / Pemilik) */}
      <AnimatePresence>
        {realtimePushedTx && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className="fixed top-4 right-4 z-50 max-w-md w-full p-4 bg-[#2B1713] text-[#FAF3DD] border-2 border-emerald-500 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#5D4037] pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/60 flex items-center justify-center shrink-0 text-emerald-400 relative">
                  <Bell className="w-5 h-5 animate-bounce" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase text-emerald-300 tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Transaksi Online Real-time Diterima!
                  </div>
                  <div className="text-[10px] text-[#D7CCC8]">Push Notification WebSocket / SSE Sync</div>
                </div>
              </div>
              <button
                onClick={() => setRealtimePushedTx(null)}
                className="text-[#D7CCC8] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#FAF3DD] font-bold">
                <span className="text-[#D7CCC8]">No. Order:</span>
                <span className="bg-[#4E342E] px-2 py-0.5 rounded text-[11px] font-mono text-amber-300">
                  #{realtimePushedTx.id.slice(-8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#D7CCC8]">Total Pembayaran:</span>
                <span className="text-sm font-black text-emerald-400">
                  Rp {realtimePushedTx.total.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#E6D5C3]">
                <span>Kasir Input: <b>{realtimePushedTx.cashierName || 'Kasir'}</b></span>
                <span>Metode: <b className="uppercase text-amber-300">{realtimePushedTx.paymentMethod}</b></span>
              </div>

              {realtimePushedTx.items && realtimePushedTx.items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#4E342E]/70 text-[11px] text-[#D7CCC8]">
                  <span className="font-semibold text-[#E6D5C3]">Item pesanan: </span>
                  {realtimePushedTx.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                </div>
              )}
            </div>

            <div className="mt-4 pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  setReceiptModalTx(realtimePushedTx);
                  setRealtimePushedTx(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Struk / Detail
              </button>
              <button
                onClick={() => {
                  setActiveTab('reports');
                  setRealtimePushedTx(null);
                }}
                className="py-2 px-3 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 font-bold text-xs transition-all border border-[#795548] flex items-center justify-center gap-1"
              >
                Buka Laporan <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thermal Receipt Print Modal */}
      {receiptModalTx && (
        <ThermalReceiptModal tx={receiptModalTx} settings={settings} currentUser={user} onClose={() => setReceiptModalTx(null)} />
      )}

      {/* QRIS Simulator Modal */}
      {qrisModalTx && (
        <QRISModal
          tx={qrisModalTx}
          settings={settings}
          onClose={() => setQrisModalTx(null)}
          onPaymentSuccess={() => {
            const tx = qrisModalTx;
            setQrisModalTx(null);
            setReceiptModalTx(tx);
          }}
        />
      )}

      {/* Buka/Tutup Kasir Shift Modal */}
      {isShiftModalOpen && (
        <ShiftModal
          user={user}
          activeShift={activeShift}
          settings={settings}
          onStartShift={handleStartShift}
          onEndShift={handleEndShift}
          onClose={() => setIsShiftModalOpen(false)}
        />
      )}

      {/* User Profile / Photo Upload Modal */}
      {editingProfileUser && (
        <UserProfileModal
          user={editingProfileUser}
          isOpen={!!editingProfileUser}
          onClose={() => setEditingProfileUser(null)}
          onSaveUser={handleSaveUserProfile}
        />
      )}

      {/* Auto-Sync & Cleansing On Logout Modal */}
      <LogoutSyncModal
        isOpen={isLogoutSyncOpen}
        user={user}
        onCancelLogout={() => setIsLogoutSyncOpen(false)}
        onConfirmLogoutAnyway={() => {
          StorageService.cleanseSessionAndLocalCache();
          setIsLogoutSyncOpen(false);
          setIsAuthenticated(false);
          refreshState();
        }}
        onSyncAndLogoutSuccess={() => {
          setIsLogoutSyncOpen(false);
          setIsAuthenticated(false);
          refreshState();
        }}
      />

      {/* Cashier Screen Auto-Lock / Manual PIN Lock Modal */}
      {isScreenLocked && (
        <AutoLockModal
          user={user}
          settings={settings}
          activeOutlet={activeOutlet}
          onUnlock={() => setIsScreenLocked(false)}
          onLogout={handleLogout}
        />
      )}

      {/* Rekap Harian Pencatatan Keluar Masuk Harian & Cetak PDF */}
      {isDailyRecapOpen && (
        <DailyRecapModal
          isOpen={isDailyRecapOpen}
          onClose={() => setIsDailyRecapOpen(false)}
          transactions={transactions}
          expenses={expenses}
          ingredients={ingredients}
          settings={settings}
          activeShift={activeShift}
          outlets={outlets}
          activeOutlet={activeOutlet}
          user={user}
        />
      )}

      {/* Incoming Self-Order QR Barcode Order Notification Window */}
      {incomingQROrder && (
        <IncomingQROrderAlertModal
          order={incomingQROrder}
          settings={settings}
          currentUser={user}
          onClose={() => setIncomingQROrder(null)}
          onOpenQROrdersModal={() => {
            setIncomingQROrder(null);
            setActiveTab('pos');
          }}
          onOrderSettled={(tx) => {
            setIncomingQROrder(null);
            setReceiptModalTx(tx);
            refreshState();
          }}
        />
      )}

      {/* Floating Overlay Bubble Widget (Quick Kasir, Status Cabang & Background Service) */}
      {!isCustomerMode && (
        <FloatingWidget
          user={user}
          activeOutlet={activeOutlet}
          outlets={outlets}
          activeShift={activeShift}
          settings={settings}
          pendingSyncCount={pendingSyncCount}
          isFocusMode={isFocusMode}
          onNavigateTab={setActiveTab}
          onSwitchOutlet={handleSwitchOutlet}
          onToggleFocusMode={handleToggleFocusMode}
          onLockScreen={() => setIsScreenLocked(true)}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
          onManualSync={handleManualSync}
          onOpenLastReceipt={() => {
            if (transactions.length > 0) {
              setReceiptModalTx(transactions[0]);
            }
          }}
          incomingOrdersCount={incomingQROrder ? 1 : 0}
        />
      )}

      {/* PWA Direct Browser Install Banner / iOS Guide */}
      <PWAInstallBanner />

      {/* Install App Modal (APK / PWA / Standalone Fullscreen) */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Universal Global Search Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        currentUser={user}
        settings={settings}
        outletId={activeOutlet?.id}
        onNavigateTab={setActiveTab}
        onOpenReceiptModal={(tx) => setReceiptModalTx(tx)}
      />

      {/* Critical Firestore Daily Quota Alert Toast (< 10%) */}
      {!isCustomerMode && !isCustomerPOMode && (
        <FirestoreQuotaAlertToast
          onNavigateToDashboard={() => setActiveTab('dashboard')}
          onEnableOfflineMode={() => {
            // Trigger refresh so UI reflects offline status
            refreshState();
          }}
        />
      )}
    </div>
  );
}
