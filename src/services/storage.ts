import {
  Product,
  Ingredient,
  Transaction,
  Supplier,
  Expense,
  Shift,
  User,
  StoreSettings,
  StockOpname,
  PurchaseOrder,
  Outlet,
  CashLedger,
  CapitalRecord,
  DebtRecord,
  DebtPayment,
  PaymentMethod,
  PayrollRecord,
  QROrder,
  QROrderStatus,
  QROrderPaymentStatus,
  BranchInventoryItem,
  StockTransfer,
  DraftOrder,
  FixedAsset,
  PreOrder,
  PreOrderStatus,
  PreOrderType,
  PreOrderPaymentStatus,
} from '../types';
import {
  initialProducts,
  initialIngredients,
  initialTransactions,
  initialSuppliers,
  initialExpenses,
  initialUsers,
  initialStoreSettings,
  initialOutlets,
  initialCashLedgers,
  initialCapitalRecords,
  initialDebtRecords,
  initialPayrollRecords,
  initialBranchInventory,
  initialStockTransfers,
  initialFixedAssets,
  initialPreOrders,
} from '../data/initialData';
import { appendSingleTransactionToSheets } from './googleSheetsService';
import { syncTransactionToGoogleSheet } from './googleSheetService';
import {
  db,
  doc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  commitBatchDocs,
  waitForFirestorePendingWrites,
  isFirestoreQuotaExceeded,
  setQuotaExceeded,
  enableFirestoreNetwork,
  disableFirestoreNetwork,
  testConnection,
} from '../lib/firebase';
import {
  idbGet,
  idbSet,
  idbDel,
  idbGetAllKeys,
  migrateLocalStorageToIndexedDB,
  getIndexedDBStatus,
} from './idbStorage';
import { AutoBackupService } from './autoBackupService';
import { panggilBackgroundSync } from './backgroundSyncService';

const KEYS = {
  SETTINGS: 'suqur_pos_settings',
  USERS: 'suqur_pos_users',
  PRODUCTS: 'suqur_pos_products',
  INGREDIENTS: 'suqur_pos_ingredients',
  BRANCH_INVENTORY: 'suqur_pos_branch_inventory',
  STOCK_TRANSFERS: 'suqur_pos_stock_transfers',
  TRANSACTIONS: 'suqur_pos_transactions',
  SUPPLIERS: 'suqur_pos_suppliers',
  PURCHASES: 'suqur_pos_purchases',
  EXPENSES: 'suqur_pos_expenses',
  SHIFTS: 'suqur_pos_shifts',
  ACTIVE_SHIFT: 'suqur_pos_active_shift',
  STOCK_OPNAMES: 'suqur_pos_stock_opnames',
  CURRENT_USER: 'suqur_pos_current_user',
  OFFLINE_MODE: 'suqur_pos_offline_mode',
  CART_DRAFT: 'suqur_pos_cart_draft',
  PENDING_OFFLINE_TXS: 'suqur_pos_pending_offline_txs',
  OUTLETS: 'suqur_pos_outlets',
  ACTIVE_OUTLET_ID: 'suqur_pos_active_outlet_id',
  CASH_LEDGERS: 'suqur_pos_cash_ledgers',
  CAPITAL_RECORDS: 'suqur_pos_capital_records',
  DEBT_RECORDS: 'suqur_pos_debt_records',
  PAYROLL_RECORDS: 'suqur_pos_payroll_records',
  QR_ORDERS: 'suqur_pos_qr_orders',
  DRAFT_ORDERS: 'suqur_pos_draft_orders',
  FIXED_ASSETS: 'suqur_pos_fixed_assets',
  PRE_ORDERS: 'suqur_pos_pre_orders',
};

// In-memory cache for ultra-fast synchronous UI reads
const memoryCache: Record<string, any> = {};

// Helper to get item from cache or localStorage (fallback)
function getItem<T>(key: string, fallback: T): T {
  if (memoryCache[key] !== undefined && memoryCache[key] !== null) {
    return memoryCache[key] as T;
  }
  try {
    const data = localStorage.getItem(key);
    if (data !== null) {
      try {
        const parsed = JSON.parse(data);
        memoryCache[key] = parsed;
        return parsed;
      } catch {
        // Handle plain string values in localStorage
        memoryCache[key] = data as unknown as T;
        return data as unknown as T;
      }
    }
  } catch (e) {
    console.error(`Error reading key ${key}`, e);
  }
  memoryCache[key] = fallback;
  return fallback;
}

/**
 * Automatically cleans and reclaims LocalStorage quota when capacity is tight.
 * IndexedDB and memoryCache retain 100% full fidelity data.
 */
export function reclaimLocalStorageSpace(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // 1. Strip full payloads from auto-backup history in LocalStorage
    const backupKey = 'suqur_pos_autobackup_history';
    const rawBackup = localStorage.getItem(backupKey);
    if (rawBackup) {
      try {
        const parsed = JSON.parse(rawBackup);
        if (Array.isArray(parsed)) {
          const metaOnly = parsed.slice(-5).map((item: any) => ({
            ...item,
            data: undefined,
          }));
          localStorage.setItem(backupKey, JSON.stringify(metaOnly));
        }
      } catch {
        localStorage.removeItem(backupKey);
      }
    }

    // 2. Clean out any base64 wallpaper in sq_theme_custom_config
    const themeKey = 'sq_theme_custom_config';
    const rawTheme = localStorage.getItem(themeKey);
    if (rawTheme && rawTheme.includes('data:image')) {
      try {
        const parsed = JSON.parse(rawTheme);
        if (parsed?.bgConfig?.url?.startsWith('data:image')) {
          idbSet('sq_custom_bg_image', parsed.bgConfig.url).catch(() => {});
          parsed.bgConfig.url = '__IDB__';
          localStorage.setItem(themeKey, JSON.stringify(parsed));
        }
      } catch {
        // ignore
      }
    }

    // 3. Trim local copy of large transactions array to latest 30 in LocalStorage
    const txKey = KEYS.TRANSACTIONS;
    const rawTx = localStorage.getItem(txKey);
    if (rawTx && rawTx.length > 25000) {
      try {
        const parsed = JSON.parse(rawTx);
        if (Array.isArray(parsed) && parsed.length > 30) {
          localStorage.setItem(txKey, JSON.stringify(parsed.slice(-30)));
        }
      } catch {
        // ignore
      }
    }

    // 4. Trim other large archival collections from LocalStorage
    const collectionsToTrim = [
      KEYS.DRAFT_ORDERS,
      KEYS.CASH_LEDGERS,
      KEYS.EXPENSES,
      KEYS.PURCHASES,
      KEYS.STOCK_OPNAMES,
      KEYS.STOCK_TRANSFERS,
      KEYS.PAYROLL_RECORDS,
    ];

    for (const k of collectionsToTrim) {
      const raw = localStorage.getItem(k);
      if (raw && raw.length > 15000) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 20) {
            localStorage.setItem(k, JSON.stringify(parsed.slice(-20)));
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    // Silent fail safe
  }
}

// Write through to memoryCache, LocalStorage, and IndexedDB with debounced persistence
const idbWriteTimers = new Map<string, any>();

function setItem<T>(key: string, value: T): void {
  memoryCache[key] = value;

  // 1. Debounced/Coalesced asynchronous write to IndexedDB to avoid I/O bottlenecks during rapid cashier operations
  if (idbWriteTimers.has(key)) {
    clearTimeout(idbWriteTimers.get(key));
  }

  const timer = setTimeout(() => {
    idbWriteTimers.delete(key);
    idbSet(key, value).catch(() => {});
  }, 40);
  idbWriteTimers.set(key, timer);

  // 2. Persist to LocalStorage as secondary fast-boot cache
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e: any) {
    const isQuotaError =
      e?.name === 'QuotaExceededError' ||
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e?.code === 22 ||
      e?.code === 1014 ||
      (e?.message && (e.message.includes('quota') || e.message.includes('Quota')));

    if (isQuotaError) {
      // Reclaim space from non-essential caches in LocalStorage and retry
      reclaimLocalStorageSpace();
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (retryErr) {
        // If still exceeds quota, store a compact subset in LocalStorage
        try {
          if (Array.isArray(value)) {
            const compact = value.slice(-20);
            localStorage.setItem(key, JSON.stringify(compact));
          }
        } catch {
          // Data is already safely stored in IndexedDB and memoryCache
        }
      }
    }
  }
}

function shouldSyncToCloud(): boolean {
  return !StorageService.isOfflineMode() && !isFirestoreQuotaExceeded();
}

let isFirestoreInitialized = false;

const recentlyCreatedLocallyTxIds = new Set<string>();
let isTxInitialSnapshot = true;
const knownTxIds = new Set<string>();

export const StorageService = {
  // Initialize IndexedDB Storage & Auto-Migration from LocalStorage
  initIndexedDBStorage: async (): Promise<void> => {
    try {
      // 1. Perform automatic migration from LocalStorage to IndexedDB
      await migrateLocalStorageToIndexedDB();

      // Proactively clean up bloated LocalStorage data
      reclaimLocalStorageSpace();

      // 2. Hydrate in-memory cache with all keys stored in IndexedDB
      const keys = await idbGetAllKeys();
      for (const key of keys) {
        const value = await idbGet(key);
        if (value !== null && value !== undefined) {
          memoryCache[key] = value;
          // Keep localStorage in sync if missing (keep arrays compact to avoid blowing quota)
          if (!localStorage.getItem(key)) {
            try {
              if (Array.isArray(value) && value.length > 30) {
                localStorage.setItem(key, JSON.stringify(value.slice(-30)));
              } else {
                localStorage.setItem(key, JSON.stringify(value));
              }
            } catch (e) {
              // quota ignored safely
            }
          }
        }
      }

      // 3. Check for periodic scheduled auto-backups
      await AutoBackupService.checkIntervalBackup();
    } catch (err) {
      console.error('[StorageService] Error initializing IndexedDB storage:', err);
    }
  },

  getIndexedDBStatus: () => getIndexedDBStatus(),

  runMigrationToIndexedDB: () => migrateLocalStorageToIndexedDB(),

  // Initialize default data locally & Firestore
  initSeedData: () => {
    if (!localStorage.getItem(KEYS.PRODUCTS)) {
      setItem(KEYS.PRODUCTS, initialProducts);
    }
    if (!localStorage.getItem(KEYS.INGREDIENTS)) {
      setItem(KEYS.INGREDIENTS, initialIngredients);
    }
    if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
      setItem(KEYS.TRANSACTIONS, initialTransactions);
    }
    if (!localStorage.getItem(KEYS.SUPPLIERS)) {
      setItem(KEYS.SUPPLIERS, initialSuppliers);
    }
    if (!localStorage.getItem(KEYS.EXPENSES)) {
      setItem(KEYS.EXPENSES, initialExpenses);
    }
    if (!localStorage.getItem(KEYS.USERS)) {
      setItem(KEYS.USERS, initialUsers);
    }
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      setItem(KEYS.SETTINGS, initialStoreSettings);
    }
    if (typeof window !== 'undefined' && !localStorage.getItem('storeName')) {
      localStorage.setItem('storeName', initialStoreSettings.storeName);
    }
    if (!localStorage.getItem(KEYS.PAYROLL_RECORDS)) {
      setItem(KEYS.PAYROLL_RECORDS, initialPayrollRecords);
    }
    if (!localStorage.getItem(KEYS.CURRENT_USER)) {
      setItem(KEYS.CURRENT_USER, initialUsers[0]);
    }
  },

  // Offline / Online Real-Time Mode Toggle
  isOfflineMode: (): boolean => getItem(KEYS.OFFLINE_MODE, false),
  setOfflineMode: async (offline: boolean) => {
    setItem(KEYS.OFFLINE_MODE, offline);
    if (offline) {
      await disableFirestoreNetwork();
    } else {
      await enableFirestoreNetwork();
      StorageService.syncLocalToFirestore().catch(() => {});
    }
  },
  syncAllLocalCollectionsToCloud: async () => {
    if (isFirestoreQuotaExceeded()) return;
    try {
      const products = StorageService.getProducts();
      products.forEach((p) => {
        setDoc(doc(db, 'products', p.id), p);
      });

      const ingredients = StorageService.getIngredients();
      ingredients.forEach((ing) => {
        setDoc(doc(db, 'ingredients', ing.id), ing);
      });

      const txs = StorageService.getTransactions();
      txs.forEach((tx) => {
        setDoc(doc(db, 'transactions', tx.id), tx);
      });

      const expenses = StorageService.getExpenses();
      expenses.forEach((e) => setDoc(doc(db, 'expenses', e.id), e));

      const suppliers = StorageService.getSuppliers();
      suppliers.forEach((s) => setDoc(doc(db, 'suppliers', s.id), s));

      const purchases = StorageService.getPurchases();
      purchases.forEach((p) => setDoc(doc(db, 'purchases', p.id), p));

      const settings = StorageService.getSettings();
      setDoc(doc(db, 'settings', 'store'), settings);
    } catch (e) {
      console.warn('Sync local data to Firestore notice:', e);
    }
  },

  // Setup Firestore Real-time Listeners
  initFirestoreSync: (onDataChange?: () => void) => {
    if (isFirestoreInitialized) return;
    isFirestoreInitialized = true;

    const unsubscribers: (() => void)[] = [];

    // Debounce callback to prevent cascading re-renders across multiple snapshot arrivals
    let notifyDebounceTimer: any = null;
    const debouncedDataChange = () => {
      if (!onDataChange) return;
      if (notifyDebounceTimer) clearTimeout(notifyDebounceTimer);
      notifyDebounceTimer = setTimeout(() => {
        try {
          onDataChange();
        } catch (e) {}
      }, 120);
    };

    const handleSnapError = (err: any) => {
      console.debug('Firestore listener notice:', err?.message || err);
    };

    // 1. Settings Listener
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', 'store'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as StoreSettings;
            setItem(KEYS.SETTINGS, data);
            debouncedDataChange();
          }
        },
        handleSnapError
      )
    );

    // 2. Users Listener
    unsubscribers.push(
      onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          if (!snapshot.empty) {
            const users: User[] = [];
            snapshot.forEach((d) => users.push(d.data() as User));
            setItem(KEYS.USERS, users);
            debouncedDataChange();
          }
        },
        handleSnapError
      )
    );

    // 3. Products Listeners (support both 'products' and 'produk' collections)
    const handleProductsSnapshot = (snapshot: any) => {
      if (!snapshot.empty) {
        const fetchedProducts: Product[] = [];
        snapshot.forEach((d: any) => {
          const raw = d.data();
          if (raw) {
            const p: Product = {
              id: raw.id || d.id,
              name: raw.name || raw.nama || 'Menu',
              category: raw.category || raw.kategori || 'Kopi Espresso',
              price: raw.price ?? raw.harga ?? 0,
              cogs: raw.cogs ?? raw.hpp ?? 0,
              image: raw.image || raw.gambar || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80',
              description: raw.description || raw.deskripsi || '',
              isAvailable: raw.isAvailable ?? raw.tersedia ?? true,
              recipe: raw.recipe || raw.resep || [],
              variants: raw.variants || raw.varian || [],
            };
            fetchedProducts.push(p);
          }
        });

        if (fetchedProducts.length > 0) {
          const existing = getItem<Product[]>(KEYS.PRODUCTS, initialProducts);
          const map = new Map<string, Product>();
          existing.forEach((item) => map.set(item.id, item));
          fetchedProducts.forEach((item) => map.set(item.id, item));
          const merged = Array.from(map.values());
          setItem(KEYS.PRODUCTS, merged);
          debouncedDataChange();
        }
      }
    };

    unsubscribers.push(onSnapshot(collection(db, 'products'), handleProductsSnapshot, handleSnapError));

    // 4. Ingredients Listener (support both 'ingredients' and 'bahan')
    const handleIngredientsSnapshot = (snapshot: any) => {
      if (!snapshot.empty) {
        const list: Ingredient[] = [];
        snapshot.forEach((d: any) => {
          const raw = d.data();
          if (raw) {
            list.push({
              id: raw.id || d.id,
              name: raw.name || raw.nama || 'Bahan',
              unit: raw.unit || raw.satuan || 'pcs',
              costPerUnit: raw.costPerUnit ?? raw.biayaSatuan ?? 0,
              currentStock: raw.currentStock ?? raw.stok ?? 0,
              minStock: raw.minStock ?? raw.minStok ?? 0,
              category: raw.category || raw.kategori || 'Lainnya',
            });
          }
        });
        if (list.length > 0) {
          const existing = getItem<Ingredient[]>(KEYS.INGREDIENTS, initialIngredients);
          const map = new Map<string, Ingredient>();
          existing.forEach((i) => map.set(i.id, i));
          list.forEach((i) => map.set(i.id, i));
          setItem(KEYS.INGREDIENTS, Array.from(map.values()));
          debouncedDataChange();
        }
      }
    };

    unsubscribers.push(onSnapshot(collection(db, 'ingredients'), handleIngredientsSnapshot, handleSnapError));

    // 5. Transactions Listener (support both 'transactions' and 'transaksi')
    const handleTransactionsSnapshot = (snapshot: any) => {
      const remotePushedTxs: Transaction[] = [];

      snapshot.docChanges().forEach((change: any) => {
        const raw = change.doc.data();
        if (change.type === 'added' && raw && raw.id) {
          if (!isTxInitialSnapshot && !knownTxIds.has(raw.id) && !recentlyCreatedLocallyTxIds.has(raw.id)) {
            remotePushedTxs.push(raw as Transaction);
          }
          knownTxIds.add(raw.id);
        }
      });

      if (!snapshot.empty) {
        const list: Transaction[] = [];
        snapshot.forEach((d: any) => {
          const raw = d.data();
          if (raw) {
            list.push(raw as Transaction);
            knownTxIds.add(raw.id || d.id);
          }
        });

        isTxInitialSnapshot = false;

        if (list.length > 0) {
          const existing = getItem<Transaction[]>(KEYS.TRANSACTIONS, initialTransactions);
          const map = new Map<string, Transaction>();
          existing.forEach((t) => map.set(t.id, t));
          list.forEach((t) => map.set(t.id, t));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setItem(KEYS.TRANSACTIONS, merged);
          debouncedDataChange();

          // Dispatch event for any newly pushed transaction from remote HP
          remotePushedTxs.forEach((pushedTx) => {
            window.dispatchEvent(
              new CustomEvent('realtime_transaction_pushed', {
                detail: pushedTx,
              })
            );
          });
        }
      } else {
        isTxInitialSnapshot = false;
      }
    };

    try {
      unsubscribers.push(onSnapshot(query(collection(db, 'transactions'), limit(120)), handleTransactionsSnapshot, handleSnapError));
    } catch (e) {
      unsubscribers.push(onSnapshot(collection(db, 'transactions'), handleTransactionsSnapshot, handleSnapError));
    }

    // 6. Expenses Listener (limit 100)
    try {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'expenses'), limit(100)),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: Expense[] = [];
              snapshot.forEach((d) => list.push(d.data() as Expense));
              const existing = getItem<Expense[]>(KEYS.EXPENSES, initialExpenses);
              const map = new Map<string, Expense>();
              existing.forEach((e) => map.set(e.id, e));
              list.forEach((e) => map.set(e.id, e));
              setItem(KEYS.EXPENSES, Array.from(map.values()));
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    } catch (e) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'expenses'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: Expense[] = [];
              snapshot.forEach((d) => list.push(d.data() as Expense));
              setItem(KEYS.EXPENSES, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    }

    // 7. Suppliers Listener
    unsubscribers.push(
      onSnapshot(
        collection(db, 'suppliers'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Supplier[] = [];
            snapshot.forEach((d) => list.push(d.data() as Supplier));
            setItem(KEYS.SUPPLIERS, list);
            debouncedDataChange();
          }
        },
        handleSnapError
      )
    );

    // 8. Shifts Listener (limit 50)
    try {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'shifts'), limit(50)),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: Shift[] = [];
              snapshot.forEach((d) => list.push(d.data() as Shift));
              setItem(KEYS.SHIFTS, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    } catch (e) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'shifts'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: Shift[] = [];
              snapshot.forEach((d) => list.push(d.data() as Shift));
              setItem(KEYS.SHIFTS, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    }

    // 9. Active Shift Listener
    unsubscribers.push(
      onSnapshot(
        doc(db, 'activeShift', 'current'),
        (docSnap) => {
          if (docSnap.exists()) {
            const active = docSnap.data() as Shift;
            setItem(KEYS.ACTIVE_SHIFT, active.status === 'open' ? active : null);
            debouncedDataChange();
          }
        },
        handleSnapError
      )
    );

    // 10. Purchases & Stock Opnames Listeners (limit 100 / 50)
    try {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'purchases'), limit(100)),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: PurchaseOrder[] = [];
              snapshot.forEach((d) => list.push(d.data() as PurchaseOrder));
              const existing = getItem<PurchaseOrder[]>(KEYS.PURCHASES, []);
              const map = new Map<string, PurchaseOrder>();
              existing.forEach((p) => map.set(p.id, p));
              list.forEach((p) => map.set(p.id, p));
              setItem(KEYS.PURCHASES, Array.from(map.values()));
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    } catch (e) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'purchases'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: PurchaseOrder[] = [];
              snapshot.forEach((d) => list.push(d.data() as PurchaseOrder));
              setItem(KEYS.PURCHASES, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    }

    try {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'stockOpnames'), limit(50)),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: StockOpname[] = [];
              snapshot.forEach((d) => list.push(d.data() as StockOpname));
              const existing = getItem<StockOpname[]>(KEYS.STOCK_OPNAMES, []);
              const map = new Map<string, StockOpname>();
              existing.forEach((o) => map.set(o.id, o));
              list.forEach((o) => map.set(o.id, o));
              setItem(KEYS.STOCK_OPNAMES, Array.from(map.values()));
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    } catch (e) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'stockOpnames'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: StockOpname[] = [];
              snapshot.forEach((d) => list.push(d.data() as StockOpname));
              setItem(KEYS.STOCK_OPNAMES, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    }

    // 10b. Branch Inventory & Stock Transfers Listeners
    unsubscribers.push(
      onSnapshot(
        collection(db, 'branch_inventory'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: BranchInventoryItem[] = [];
            snapshot.forEach((d) => list.push(d.data() as BranchInventoryItem));
            setItem(KEYS.BRANCH_INVENTORY, list);
            debouncedDataChange();
          }
        },
        handleSnapError
      )
    );

    try {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'stock_transfers'), limit(50)),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: StockTransfer[] = [];
              snapshot.forEach((d) => list.push(d.data() as StockTransfer));
              const existing = getItem<StockTransfer[]>(KEYS.STOCK_TRANSFERS, initialStockTransfers);
              const map = new Map<string, StockTransfer>();
              existing.forEach((t) => map.set(t.id, t));
              list.forEach((t) => map.set(t.id, t));
              setItem(KEYS.STOCK_TRANSFERS, Array.from(map.values()));
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    } catch (e) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'stock_transfers'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: StockTransfer[] = [];
              snapshot.forEach((d) => list.push(d.data() as StockTransfer));
              setItem(KEYS.STOCK_TRANSFERS, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    }

    // 11. Realtime QR Self-Orders Listener (limit 100)
    const handleQROrdersSnapshot = (snapshot: any) => {
      if (!snapshot.empty) {
        const fetchedOrders: QROrder[] = [];
        snapshot.forEach((d: any) => {
          const raw = d.data();
          if (raw && raw.id) {
            fetchedOrders.push(raw as QROrder);
          }
        });

        if (fetchedOrders.length > 0) {
          const existing = getItem<QROrder[]>(KEYS.QR_ORDERS, []);
          const existingMap = new Map<string, QROrder>();
          existing.forEach((o) => existingMap.set(o.id, o));

          // Check if any new pending order arrived
          let newlyArrivedPendingOrder: QROrder | null = null;
          fetchedOrders.forEach((o) => {
            const prev = existingMap.get(o.id);
            if (!prev && o.status === 'pending') {
              newlyArrivedPendingOrder = o;
            }
            existingMap.set(o.id, o);
          });

          const merged = Array.from(existingMap.values()).sort(
            (a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime()
          );
          setItem(KEYS.QR_ORDERS, merged);

          if (newlyArrivedPendingOrder && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('realtime_qr_order_pushed', { detail: newlyArrivedPendingOrder }));
          }

          debouncedDataChange();
        }
      }
    };

    try {
      unsubscribers.push(onSnapshot(query(collection(db, 'qr_orders'), limit(100)), handleQROrdersSnapshot, handleSnapError));
    } catch (e) {
      unsubscribers.push(onSnapshot(collection(db, 'qr_orders'), handleQROrdersSnapshot, handleSnapError));
    }

    // 12. Realtime Draft Orders Listener (limit 100)
    try {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'draft_orders'), limit(100)),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: DraftOrder[] = [];
              snapshot.forEach((d) => {
                const data = d.data() as DraftOrder;
                if (data && data.id) list.push(data);
              });
              setItem(KEYS.DRAFT_ORDERS, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    } catch (e) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'draft_orders'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: DraftOrder[] = [];
              snapshot.forEach((d) => {
                const data = d.data() as DraftOrder;
                if (data && data.id) list.push(data);
              });
              setItem(KEYS.DRAFT_ORDERS, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    }

    // 13. Realtime Pre-Orders & Reservation Listener (limit 100)
    try {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'pre_orders'), limit(100)),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: PreOrder[] = [];
              snapshot.forEach((d) => {
                const data = d.data() as PreOrder;
                if (data && data.id) list.push(data);
              });
              setItem(KEYS.PRE_ORDERS, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    } catch (e) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'pre_orders'),
          (snapshot) => {
            if (!snapshot.empty) {
              const list: PreOrder[] = [];
              snapshot.forEach((d) => {
                const data = d.data() as PreOrder;
                if (data && data.id) list.push(data);
              });
              setItem(KEYS.PRE_ORDERS, list);
              debouncedDataChange();
            }
          },
          handleSnapError
        )
      );
    }

    // Return cleanup unsubscription function
    return () => {
      if (notifyDebounceTimer) clearTimeout(notifyDebounceTimer);
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (e) {}
      });
      isFirestoreInitialized = false;
    };
  },

  // Settings
  getSettings: (): StoreSettings => {
    const s = getItem<StoreSettings>(KEYS.SETTINGS, initialStoreSettings);
    if (typeof window !== 'undefined') {
      const storedStoreName = localStorage.getItem('storeName');
      if (storedStoreName && storedStoreName.trim()) {
        s.storeName = storedStoreName.trim();
      }
    }
    return s;
  },
  saveSettings: (settings: StoreSettings) => {
    if (typeof window !== 'undefined' && settings.storeName) {
      localStorage.setItem('storeName', settings.storeName.trim());
    }
    setItem(KEYS.SETTINGS, settings);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'settings', 'store'), settings);
    }
  },

  // Outlets (Multi-Branch Management)
  getOutlets: (): Outlet[] => {
    const list = getItem<Outlet[]>(KEYS.OUTLETS, initialOutlets);
    if (!list || list.length === 0) {
      setItem(KEYS.OUTLETS, initialOutlets);
      return initialOutlets;
    }
    // If Kelapa Gading or other default outlets are missing in stored list, merge them seamlessly
    if (list.length < 3 && !list.some((o) => o.id === 'outlet-kelapa-gading')) {
      const merged = [...list];
      initialOutlets.forEach((def) => {
        if (!merged.some((m) => m.id === def.id)) {
          merged.push(def);
        }
      });
      setItem(KEYS.OUTLETS, merged);
      return merged;
    }
    return list;
  },
  saveOutlets: (outlets: Outlet[]) => {
    setItem(KEYS.OUTLETS, outlets);
    if (shouldSyncToCloud()) {
      outlets.forEach((o) => setDoc(doc(db, 'outlets', o.id), o));
    }
    // Also update settings.outlets
    const currentSettings = StorageService.getSettings();
    StorageService.saveSettings({ ...currentSettings, outlets });
  },
  addOutlet: (outlet: Outlet) => {
    const list = StorageService.getOutlets();
    list.push(outlet);
    StorageService.saveOutlets(list);
  },
  updateOutlet: (updated: Outlet) => {
    const list = StorageService.getOutlets().map((o) => (o.id === updated.id ? updated : o));
    StorageService.saveOutlets(list);
  },
  deleteOutlet: (id: string) => {
    const list = StorageService.getOutlets().filter((o) => o.id !== id);
    StorageService.saveOutlets(list);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'outlets', id));
    }
  },
  getActiveOutletId: (): string => {
    let active = '';
    if (typeof window !== 'undefined') {
      active = localStorage.getItem('currentOutletId') || localStorage.getItem('suqur_pos_active_outlet_id') || '';
    }
    if (!active) {
      active = getItem<string>(KEYS.ACTIVE_OUTLET_ID, '');
    }
    if (active) return active;
    const outlets = StorageService.getOutlets();
    const def = outlets.find((o) => o.isDefault) || outlets[0];
    const id = def ? def.id : 'outlet-lagoa';
    StorageService.setActiveOutletId(id);
    return id;
  },
  setActiveOutletId: (id: string) => {
    setItem(KEYS.ACTIVE_OUTLET_ID, id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentOutletId', id);
      localStorage.setItem('suqur_pos_active_outlet_id', id);
    }
  },
  getActiveOutlet: (): Outlet => {
    const outlets = StorageService.getOutlets();
    const activeId = StorageService.getActiveOutletId();
    const found = outlets.find((o) => o.id === activeId);
    if (found) return found;
    return outlets[0] || initialOutlets[0];
  },

  // Users
  getUsers: (): User[] => {
    const list = getItem<User[]>(KEYS.USERS, initialUsers);
    if (!list || list.length === 0) {
      setItem(KEYS.USERS, initialUsers);
      return initialUsers;
    }
    // If some default initial users are missing or don't have outlet assignments, merge seamlessly
    if (list.length < 4 && !list.some((u) => u.id === 'u-3' || u.id === 'u-4')) {
      const merged = [...list];
      initialUsers.forEach((def) => {
        if (!merged.some((m) => m.id === def.id)) {
          merged.push(def);
        }
      });
      setItem(KEYS.USERS, merged);
      return merged;
    }
    return list;
  },
  saveUsers: (users: User[]) => {
    setItem(KEYS.USERS, users);
    if (shouldSyncToCloud()) {
      users.forEach((u) => setDoc(doc(db, 'users', u.id), u));
    }
  },
  getCurrentUser: (): User => getItem(KEYS.CURRENT_USER, initialUsers[0]),
  setCurrentUser: (user: User) => setItem(KEYS.CURRENT_USER, user),
  updateUser: (updatedUser: User) => {
    const users = StorageService.getUsers().map((u) => (u.id === updatedUser.id ? updatedUser : u));
    StorageService.saveUsers(users);
    const curr = StorageService.getCurrentUser();
    if (curr.id === updatedUser.id) {
      StorageService.setCurrentUser(updatedUser);
    }
  },

  // Products
  getProducts: (): Product[] => getItem(KEYS.PRODUCTS, initialProducts),
  saveProducts: (products: Product[]) => {
    setItem(KEYS.PRODUCTS, products);
    if (shouldSyncToCloud()) {
      products.forEach((p) => {
        setDoc(doc(db, 'products', p.id), p);
      });
    }
  },
  addProduct: (product: Product) => {
    const products = StorageService.getProducts();
    products.unshift(product);
    setItem(KEYS.PRODUCTS, products);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'products', product.id), product);
    }
  },
  updateProduct: (product: Product) => {
    const products = StorageService.getProducts().map((p) => (p.id === product.id ? product : p));
    setItem(KEYS.PRODUCTS, products);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'products', product.id), product);
    }
  },
  deleteProduct: (id: string) => {
    const products = StorageService.getProducts().filter((p) => p.id !== id);
    setItem(KEYS.PRODUCTS, products);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'products', id));
    }
  },

  // Ingredients (Raw Materials)
  getIngredients: (): Ingredient[] => getItem(KEYS.INGREDIENTS, initialIngredients),
  saveIngredients: (ingredients: Ingredient[]) => {
    setItem(KEYS.INGREDIENTS, ingredients);
    if (shouldSyncToCloud()) {
      ingredients.forEach((ing) => {
        setDoc(doc(db, 'ingredients', ing.id), ing);
      });
    }
  },
  addIngredient: (ingredient: Ingredient) => {
    const ingredients = StorageService.getIngredients();
    ingredients.unshift(ingredient);
    setItem(KEYS.INGREDIENTS, ingredients);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'ingredients', ingredient.id), ingredient);
    }
  },
  updateIngredient: (ingredient: Ingredient) => {
    const ingredients = StorageService.getIngredients().map((i) => (i.id === ingredient.id ? ingredient : i));
    setItem(KEYS.INGREDIENTS, ingredients);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'ingredients', ingredient.id), ingredient);
    }
  },
  deleteIngredient: (id: string) => {
    const ingredients = StorageService.getIngredients().filter((i) => i.id !== id);
    setItem(KEYS.INGREDIENTS, ingredients);
    // Also cleanup branch inventory for this ingredient
    const branchInv = StorageService.getBranchInventory().filter((bi) => bi.ingredientId !== id);
    StorageService.saveBranchInventory(branchInv);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'ingredients', id));
    }
  },

  // ==========================================
  // MANAJEMEN MULTI-CABANG & STOK BAHAN BAKU (HUB & SPOKE)
  // ==========================================
  getBranchInventory: (filterOutletId?: string): BranchInventoryItem[] => {
    let list = getItem<BranchInventoryItem[]>(KEYS.BRANCH_INVENTORY, initialBranchInventory);
    if (!list || list.length === 0) {
      list = initialBranchInventory;
      setItem(KEYS.BRANCH_INVENTORY, list);
    }

    // Auto-reconcile with master ingredients & outlets so every branch has inventory records
    const masterIngredients = StorageService.getIngredients();
    const outlets = StorageService.getOutlets();
    let hasNewItems = false;
    const reconciled = [...list];

    outlets.forEach((out) => {
      masterIngredients.forEach((ing) => {
        const exists = reconciled.some((bi) => bi.outletId === out.id && bi.ingredientId === ing.id);
        if (!exists) {
          hasNewItems = true;
          // Allocate initial proportional stock based on outlet type
          const isCentral = out.type === 'CENTRAL' || out.id === 'outlet-pusat';
          const stockVal = isCentral ? ing.currentStock : Math.max(0, Math.round(ing.currentStock * 0.15));
          const minStockVal = isCentral ? ing.minStock : Math.max(10, Math.round(ing.minStock * 0.2));

          reconciled.push({
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

    if (hasNewItems) {
      setItem(KEYS.BRANCH_INVENTORY, reconciled);
      list = reconciled;
    }

    if (filterOutletId && filterOutletId !== 'ALL') {
      return list.filter((bi) => bi.outletId === filterOutletId);
    }
    return list;
  },

  saveBranchInventory: (items: BranchInventoryItem[]) => {
    setItem(KEYS.BRANCH_INVENTORY, items);
    if (shouldSyncToCloud()) {
      items.forEach((item) => {
        setDoc(doc(db, 'branch_inventory', item.id), item).catch(console.error);
      });
    }
  },

  getBranchStock: (outletId: string, ingredientId: string): number => {
    const list = StorageService.getBranchInventory();
    const item = list.find((bi) => bi.outletId === outletId && bi.ingredientId === ingredientId);
    return item ? item.currentStock : 0;
  },

  updateBranchStock: (outletId: string, ingredientId: string, deltaQty: number) => {
    const list = StorageService.getBranchInventory();
    const idx = list.findIndex((bi) => bi.outletId === outletId && bi.ingredientId === ingredientId);
    if (idx !== -1) {
      list[idx].currentStock = Math.max(0, list[idx].currentStock + deltaQty);
      list[idx].lastUpdated = new Date().toISOString();
      StorageService.saveBranchInventory(list);
    }
  },

  setBranchStock: (outletId: string, ingredientId: string, exactStock: number) => {
    const list = StorageService.getBranchInventory();
    const idx = list.findIndex((bi) => bi.outletId === outletId && bi.ingredientId === ingredientId);
    if (idx !== -1) {
      list[idx].currentStock = exactStock;
      list[idx].lastUpdated = new Date().toISOString();
      StorageService.saveBranchInventory(list);
    }
  },

  // ==========================================
  // ALUR SUPLAI & TRANSFER STOK (PUSAT KE OUTLET)
  // ==========================================
  getStockTransfers: (filterOutletId?: string): StockTransfer[] => {
    const list = getItem<StockTransfer[]>(KEYS.STOCK_TRANSFERS, initialStockTransfers);
    if (filterOutletId && filterOutletId !== 'ALL') {
      return list.filter((t) => t.sourceOutletId === filterOutletId || t.targetOutletId === filterOutletId);
    }
    return list;
  },

  saveStockTransfers: (transfers: StockTransfer[]) => {
    setItem(KEYS.STOCK_TRANSFERS, transfers);
    if (shouldSyncToCloud()) {
      transfers.forEach((t) => {
        setDoc(doc(db, 'stock_transfers', t.id), t).catch(console.error);
      });
    }
  },

  createStockTransfer: (transfer: StockTransfer): { success: boolean; message: string; transfer?: StockTransfer } => {
    const allTransfers = StorageService.getStockTransfers();
    const branchInv = StorageService.getBranchInventory();
    const sourceOutletName = transfer.sourceOutletName || 'Pusat Hub';
    const targetOutletName = transfer.targetOutletName || 'Outlet Cabang';

    // 1. Validasi kecukupan stok di Cabang Pengirim (Pusat / Hub)
    for (const item of transfer.items) {
      const invItem = branchInv.find((bi) => bi.outletId === transfer.sourceOutletId && bi.ingredientId === item.ingredientId);
      if (!invItem || invItem.currentStock < item.quantity) {
        const available = invItem ? invItem.currentStock : 0;
        return {
          success: false,
          message: `Stok ${item.ingredientName} di ${sourceOutletName} tidak mencukupi! (Tersedia: ${available} ${item.unit}, Diminta: ${item.quantity} ${item.unit})`,
        };
      }
    }

    // 2. Potong stok dari Cabang Pengirim (Pusat)
    transfer.items.forEach((item) => {
      const idx = branchInv.findIndex((bi) => bi.outletId === transfer.sourceOutletId && bi.ingredientId === item.ingredientId);
      if (idx !== -1) {
        branchInv[idx].currentStock = Math.max(0, branchInv[idx].currentStock - item.quantity);
        branchInv[idx].lastUpdated = new Date().toISOString();
      }
    });
    StorageService.saveBranchInventory(branchInv);

    // 3. Simpan Surat Jalan Transfer Baru (Status IN_TRANSIT)
    const newTransfer: StockTransfer = {
      ...transfer,
      status: 'IN_TRANSIT',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    allTransfers.unshift(newTransfer);
    StorageService.saveStockTransfers(allTransfers);

    return {
      success: true,
      message: `Surat Jalan ${newTransfer.transferNo} berhasil dibuat dan dikirim ke ${targetOutletName}!`,
      transfer: newTransfer,
    };
  },

  receiveStockTransfer: (transferId: string, receiverName: string): { success: boolean; message: string; transfer?: StockTransfer } => {
    const allTransfers = StorageService.getStockTransfers();
    const transferIndex = allTransfers.findIndex((t) => t.id === transferId);
    if (transferIndex === -1) {
      return { success: false, message: 'Data transfer stok tidak ditemukan!' };
    }

    const trf = allTransfers[transferIndex];
    if (trf.status !== 'IN_TRANSIT') {
      return { success: false, message: `Transfer ini sudah berstatus ${trf.status}!` };
    }

    // 1. Tambah stok ke Outlet Cabang Penerima
    const branchInv = StorageService.getBranchInventory();
    trf.items.forEach((item) => {
      let invIdx = branchInv.findIndex((bi) => bi.outletId === trf.targetOutletId && bi.ingredientId === item.ingredientId);
      if (invIdx !== -1) {
        branchInv[invIdx].currentStock += item.quantity;
        branchInv[invIdx].lastUpdated = new Date().toISOString();
      } else {
        // Create branch inventory record if not present
        branchInv.push({
          id: `bi-${trf.targetOutletId}-${item.ingredientId}`,
          outletId: trf.targetOutletId,
          outletName: trf.targetOutletName,
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName,
          unit: item.unit,
          costPerUnit: item.costPerUnit || 0,
          currentStock: item.quantity,
          minStock: 10,
          category: 'Bahan Baku Suplai',
          lastUpdated: new Date().toISOString(),
        });
      }
    });
    StorageService.saveBranchInventory(branchInv);

    // 2. Perbarui status transfer menjadi RECEIVED
    trf.status = 'RECEIVED';
    trf.receivedBy = receiverName;
    trf.receivedAt = new Date().toISOString();
    allTransfers[transferIndex] = trf;
    StorageService.saveStockTransfers(allTransfers);

    return {
      success: true,
      message: `Konfirmasi berhasil! Stok telah masuk ke inventori ${trf.targetOutletName}.`,
      transfer: trf,
    };
  },

  cancelStockTransfer: (transferId: string, cancelerName: string): { success: boolean; message: string } => {
    const allTransfers = StorageService.getStockTransfers();
    const transferIndex = allTransfers.findIndex((t) => t.id === transferId);
    if (transferIndex === -1) {
      return { success: false, message: 'Data transfer tidak ditemukan!' };
    }

    const trf = allTransfers[transferIndex];
    if (trf.status === 'RECEIVED') {
      return { success: false, message: 'Transfer yang sudah diterima tidak dapat dibatalkan!' };
    }

    // Kembalikan stok ke Cabang Pengirim (Pusat) jika sebelumnya IN_TRANSIT
    if (trf.status === 'IN_TRANSIT') {
      const branchInv = StorageService.getBranchInventory();
      trf.items.forEach((item) => {
        const idx = branchInv.findIndex((bi) => bi.outletId === trf.sourceOutletId && bi.ingredientId === item.ingredientId);
        if (idx !== -1) {
          branchInv[idx].currentStock += item.quantity;
          branchInv[idx].lastUpdated = new Date().toISOString();
        }
      });
      StorageService.saveBranchInventory(branchInv);
    }

    trf.status = 'CANCELLED';
    trf.notes = `${trf.notes ? trf.notes + ' | ' : ''}Dibatalkan oleh ${cancelerName} pada ${new Date().toLocaleString('id-ID')}`;
    allTransfers[transferIndex] = trf;
    StorageService.saveStockTransfers(allTransfers);

    return { success: true, message: 'Pengiriman stok berhasil dibatalkan dan stok dikembalikan ke Pusat.' };
  },

  // Transactions & Stock deduction (Defaults to lightweight today/active shift data for fast mobile performance)
  getTransactions: (onlyTodayOrActiveShift: boolean = false): Transaction[] => {
    const all = getItem<Transaction[]>(KEYS.TRANSACTIONS, initialTransactions);
    if (!onlyTodayOrActiveShift) return all;

    const activeShift = StorageService.getActiveShift();
    if (activeShift && activeShift.startTime) {
      const shiftStart = new Date(activeShift.startTime).getTime();
      return all.filter((t) => t.timestamp && new Date(t.timestamp).getTime() >= shiftStart);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    return all.filter((t) => t.timestamp && t.timestamp.startsWith(todayStr));
  },
  // Daily Queue Number (Starts at SQ0001 every day)
  getNextQueueNumber: (targetDateIso?: string): string => {
    const targetDate = targetDateIso ? new Date(targetDateIso) : new Date();
    const todayStr = targetDate.toLocaleDateString('en-CA'); // YYYY-MM-DD local format
    const allTxs = getItem<Transaction[]>(KEYS.TRANSACTIONS, initialTransactions);
    
    // Filter transactions created on this local date
    const todayTxs = allTxs.filter((t) => {
      if (!t.timestamp) return false;
      const tDateStr = new Date(t.timestamp).toLocaleDateString('en-CA');
      return tDateStr === todayStr;
    });

    let maxSeq = 0;
    todayTxs.forEach((t) => {
      if (t.queueNo) {
        const match = t.queueNo.match(/^SQ(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });

    const nextSeq = Math.max(maxSeq + 1, todayTxs.length + 1);
    return `SQ${String(nextSeq).padStart(4, '0')}`;
  },

  getLatestQueueInfo: (): { latestQueueNo: string | null; todayTotalOrders: number; latestTimestamp?: string } => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const allTxs = getItem<Transaction[]>(KEYS.TRANSACTIONS, initialTransactions);
    
    const todayTxs = allTxs.filter((t) => {
      if (!t.timestamp) return false;
      const tDateStr = new Date(t.timestamp).toLocaleDateString('en-CA');
      return tDateStr === todayStr;
    });

    if (todayTxs.length === 0) {
      return { latestQueueNo: null, todayTotalOrders: 0 };
    }

    const sorted = [...todayTxs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const latestTx = sorted[0];

    return {
      latestQueueNo: latestTx.queueNo || null,
      todayTotalOrders: todayTxs.length,
      latestTimestamp: latestTx.timestamp,
    };
  },

  getTodayTransactions: (): Transaction[] => StorageService.getTransactions(true),
  getAllTransactionsHistory: (): Transaction[] => getItem(KEYS.TRANSACTIONS, initialTransactions),
  saveTransactions: (txs: Transaction[]) => setItem(KEYS.TRANSACTIONS, txs),
  deleteTransaction: (id: string) => {
    const txs = StorageService.getTransactions().filter((t) => t.id !== id);
    setItem(KEYS.TRANSACTIONS, txs);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'transactions', id));
    }
  },

  createTransaction: (tx: Transaction): { success: boolean; warnings: string[]; transaction: Transaction } => {
    recentlyCreatedLocallyTxIds.add(tx.id);
    if (recentlyCreatedLocallyTxIds.size > 100) {
      const first = recentlyCreatedLocallyTxIds.values().next().value;
      if (first) recentlyCreatedLocallyTxIds.delete(first);
    }

    // Auto-assign queueNo if not present
    if (!tx.queueNo) {
      tx.queueNo = StorageService.getNextQueueNumber(tx.timestamp);
    }

    // Attach active outlet information if not specified
    const activeOutlet = StorageService.getActiveOutlet();
    if (!tx.outletId) {
      tx.outletId = activeOutlet.id;
    }
    if (!tx.outletName) {
      tx.outletName = activeOutlet.name;
    }

    const txs = StorageService.getTransactions();
    txs.unshift(tx);
    setItem(KEYS.TRANSACTIONS, txs);

    // Save transaction to Firestore online database
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'transactions', tx.id), tx).catch(() => {
        const pendingList = getItem<string[]>(KEYS.PENDING_OFFLINE_TXS, []);
        if (!pendingList.includes(tx.id)) {
          pendingList.push(tx.id);
          setItem(KEYS.PENDING_OFFLINE_TXS, pendingList);
        }
      });
    } else {
      // Record in pending offline transaction list
      const pendingList = getItem<string[]>(KEYS.PENDING_OFFLINE_TXS, []);
      if (!pendingList.includes(tx.id)) {
        pendingList.push(tx.id);
        setItem(KEYS.PENDING_OFFLINE_TXS, pendingList);
      }
      // Trigger background sync for offline order processing
      panggilBackgroundSync().catch(() => {});
    }

    // Auto export transaction row to owner's Google Sheets if OAuth token is active
    appendSingleTransactionToSheets(tx).catch((e) =>
      console.warn('Google Sheets auto-export background sync error:', e)
    );

    // Auto sync to Google Sheets Webhook (Apps Script)
    try {
      const googleSheetWebhookUrl =
        activeOutlet.webhookUrl ||
        (typeof window !== 'undefined' ? localStorage.getItem('google_sheet_webhook_url') : null) ||
        StorageService.getSettings()?.googleSheetWebhookUrl;
      if (googleSheetWebhookUrl) {
        syncTransactionToGoogleSheet(googleSheetWebhookUrl, tx).catch((err) =>
          console.warn('[GoogleSheetWebhook] Error syncing transaction:', err)
        );
      }
    } catch (e) {
      console.warn('[GoogleSheetWebhook] Failed to process webhook sync:', e);
    }

    // Auto deduct ingredients based on recipes (Multi-Branch & Hub-Spoke Inventory)
    const products = StorageService.getProducts();
    const ingredients = StorageService.getIngredients();
    const branchInv = StorageService.getBranchInventory();
    const txOutletId = tx.outletId || activeOutlet.id || 'outlet-lagoa';
    const txOutletName = tx.outletName || activeOutlet.name || 'Outlet';
    const warnings: string[] = [];
    const modifiedIngIds = new Set<string>();

    tx.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && prod.recipe) {
        prod.recipe.forEach((recipeItem) => {
          const deductAmount = recipeItem.amount * item.quantity;

          // 1. Deduct from Branch Specific Inventory
          let bIdx = branchInv.findIndex((bi) => bi.outletId === txOutletId && bi.ingredientId === recipeItem.ingredientId);
          if (bIdx !== -1) {
            branchInv[bIdx].currentStock = Math.max(0, branchInv[bIdx].currentStock - deductAmount);
            branchInv[bIdx].lastUpdated = new Date().toISOString();
            if (branchInv[bIdx].currentStock <= branchInv[bIdx].minStock) {
              warnings.push(`[${txOutletName}] Stok ${branchInv[bIdx].ingredientName} menipis: sisa ${branchInv[bIdx].currentStock} ${branchInv[bIdx].unit}!`);
            }
          }

          // 2. Deduct from Master Ingredients (Global Buffer)
          const ingIndex = ingredients.findIndex((i) => i.id === recipeItem.ingredientId);
          if (ingIndex !== -1) {
            ingredients[ingIndex].currentStock -= deductAmount;
            modifiedIngIds.add(ingredients[ingIndex].id);
            if (ingredients[ingIndex].currentStock <= ingredients[ingIndex].minStock && !warnings.some((w) => w.includes(ingredients[ingIndex].name))) {
              warnings.push(`[Pusat/Global] Stok ${ingredients[ingIndex].name} sisa ${ingredients[ingIndex].currentStock} ${ingredients[ingIndex].unit}!`);
            }
          }
        });
      }
    });

    StorageService.saveBranchInventory(branchInv);
    setItem(KEYS.INGREDIENTS, ingredients);
    if (shouldSyncToCloud()) {
      ingredients.forEach((ing) => {
        if (modifiedIngIds.has(ing.id)) {
          setDoc(doc(db, 'ingredients', ing.id), ing);
        }
      });
    }

    // Auto-Backup JSON trigger after transaction
    try {
      const cfg = AutoBackupService.getConfig();
      if (cfg.enabled && cfg.triggerOnTransaction) {
        AutoBackupService.performBackup('transaction');
      }
    } catch (err) {
      console.warn('[AutoBackup] Transaction trigger error:', err);
    }

    return { success: true, warnings, transaction: tx };
  },

  // Suppliers & Purchase Orders
  getSuppliers: (): Supplier[] => getItem(KEYS.SUPPLIERS, initialSuppliers),
  saveSuppliers: (suppliers: Supplier[]) => {
    setItem(KEYS.SUPPLIERS, suppliers);
    if (shouldSyncToCloud()) {
      suppliers.forEach((s) => setDoc(doc(db, 'suppliers', s.id), s));
    }
  },
  deleteSupplier: (id: string) => {
    const suppliers = StorageService.getSuppliers().filter((s) => s.id !== id);
    setItem(KEYS.SUPPLIERS, suppliers);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'suppliers', id));
    }
  },

  getPurchases: (): PurchaseOrder[] => getItem(KEYS.PURCHASES, []),
  savePurchases: (purchases: PurchaseOrder[]) => {
    setItem(KEYS.PURCHASES, purchases);
    if (shouldSyncToCloud()) {
      purchases.forEach((p) => setDoc(doc(db, 'purchases', p.id), p).catch(console.error));
    }
  },
  addPurchase: (purchase: PurchaseOrder) => {
    const purchases = StorageService.getPurchases();
    purchases.unshift(purchase);
    setItem(KEYS.PURCHASES, purchases);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'purchases', purchase.id), purchase);
    }

    // Add stock to target ingredient
    const ingredients = StorageService.getIngredients();
    const target = ingredients.find((i) => i.id === purchase.ingredientId);
    if (target) {
      target.currentStock += purchase.quantity;
      target.costPerUnit = Math.round((target.costPerUnit + purchase.unitCost) / 2);
      StorageService.saveIngredients(ingredients);
    }
  },
  deletePurchase: (id: string) => {
    const purchases = StorageService.getPurchases().filter((p) => p.id !== id);
    setItem(KEYS.PURCHASES, purchases);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'purchases', id));
    }
  },

  // Operational Expenses
  getExpenses: (): Expense[] => getItem(KEYS.EXPENSES, initialExpenses),
  saveExpenses: (expenses: Expense[]) => {
    setItem(KEYS.EXPENSES, expenses);
    if (shouldSyncToCloud()) {
      expenses.forEach((e) => setDoc(doc(db, 'expenses', e.id), e).catch(console.error));
    }
  },
  addExpense: (expense: Expense) => {
    const expenses = StorageService.getExpenses();
    expenses.unshift(expense);
    setItem(KEYS.EXPENSES, expenses);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'expenses', expense.id), expense);
    }
  },
  deleteExpense: (id: string) => {
    const expenses = StorageService.getExpenses().filter((e) => e.id !== id);
    setItem(KEYS.EXPENSES, expenses);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'expenses', id));
    }
  },

  // Stock Opnames
  getStockOpnames: (): StockOpname[] => getItem(KEYS.STOCK_OPNAMES, []),
  saveStockOpnames: (opnames: StockOpname[]) => {
    setItem(KEYS.STOCK_OPNAMES, opnames);
    if (shouldSyncToCloud()) {
      opnames.forEach((o) => setDoc(doc(db, 'stockOpnames', o.id), o).catch(console.error));
    }
  },
  addStockOpname: (opname: StockOpname) => {
    const list = StorageService.getStockOpnames();
    list.unshift(opname);
    setItem(KEYS.STOCK_OPNAMES, list);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'stockOpnames', opname.id), opname);
    }

    // Update ingredient stock (branch & master)
    if (opname.outletId) {
      StorageService.setBranchStock(opname.outletId, opname.ingredientId, opname.actualStock);
    }
    const ingredients = StorageService.getIngredients();
    const target = ingredients.find((i) => i.id === opname.ingredientId);
    if (target) {
      target.currentStock = opname.actualStock;
      StorageService.saveIngredients(ingredients);
    }
  },
  deleteStockOpname: (id: string) => {
    const list = StorageService.getStockOpnames().filter((s) => s.id !== id);
    setItem(KEYS.STOCK_OPNAMES, list);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'stockOpnames', id));
    }
  },

  // Buku Kas (Cash Ledger)
  getCashLedgers: (): CashLedger[] => getItem(KEYS.CASH_LEDGERS, initialCashLedgers),
  saveCashLedgers: (ledgers: CashLedger[]) => {
    setItem(KEYS.CASH_LEDGERS, ledgers);
    if (shouldSyncToCloud()) {
      ledgers.forEach((l) => setDoc(doc(db, 'cashLedgers', l.id), l).catch(console.error));
    }
  },
  addCashLedger: (ledger: CashLedger) => {
    const list = StorageService.getCashLedgers();
    list.unshift(ledger);
    setItem(KEYS.CASH_LEDGERS, list);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'cashLedgers', ledger.id), ledger).catch(console.error);
    }
  },
  deleteCashLedger: (id: string) => {
    const list = StorageService.getCashLedgers().filter((l) => l.id !== id);
    setItem(KEYS.CASH_LEDGERS, list);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'cashLedgers', id)).catch(console.error);
    }
  },

  // Pencatatan Modal (Capital Records)
  getCapitalRecords: (): CapitalRecord[] => getItem(KEYS.CAPITAL_RECORDS, initialCapitalRecords),
  saveCapitalRecords: (records: CapitalRecord[]) => {
    setItem(KEYS.CAPITAL_RECORDS, records);
    if (shouldSyncToCloud()) {
      records.forEach((r) => setDoc(doc(db, 'capitalRecords', r.id), r).catch(console.error));
    }
  },
  addCapitalRecord: (record: CapitalRecord, autoAddToCashLedger: boolean = true) => {
    const list = StorageService.getCapitalRecords();
    list.unshift(record);
    setItem(KEYS.CAPITAL_RECORDS, list);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'capitalRecords', record.id), record).catch(console.error);
    }

    // Optionally auto-record to Cash Ledger as Kas Masuk
    if (autoAddToCashLedger) {
      const cashEntry: CashLedger = {
        id: 'cl-cap-' + Date.now(),
        date: record.date || new Date().toISOString().split('T')[0],
        type: 'IN',
        category: 'Modal Usaha',
        amount: record.amount,
        description: `Setoran Modal: ${record.source} (${record.note || 'Tanpa catatan'})`,
        outletId: record.outletId,
        outletName: record.outletName,
        createdBy: record.createdBy || 'Admin',
        paymentMethod: 'CASH',
        referenceId: record.id,
        createdAt: new Date().toISOString(),
      };
      StorageService.addCashLedger(cashEntry);
    }
  },
  deleteCapitalRecord: (id: string) => {
    const list = StorageService.getCapitalRecords().filter((r) => r.id !== id);
    setItem(KEYS.CAPITAL_RECORDS, list);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'capitalRecords', id)).catch(console.error);
    }
  },

  // Manajemen Aset Tetap & Peralatan Toko (Fixed Assets & CAPEX)
  getFixedAssets: (outletId?: string): FixedAsset[] => {
    const list = getItem<FixedAsset[]>(KEYS.FIXED_ASSETS, initialFixedAssets);
    if (!outletId || outletId === 'ALL') return list;
    return list.filter((a) => a.outletId === outletId);
  },
  saveFixedAssets: (assets: FixedAsset[]) => {
    setItem(KEYS.FIXED_ASSETS, assets);
    if (shouldSyncToCloud()) {
      assets.forEach((a) => {
        setDoc(doc(db, 'fixedAssets', a.id), a).catch(console.error);
      });
    }
  },
  addFixedAsset: (asset: FixedAsset, autoRecordCashLedger: boolean = true): FixedAsset => {
    let finalAsset = { ...asset };

    // Auto-record to Cash Ledger as Pengeluaran Modal (CAPEX)
    if (autoRecordCashLedger && !finalAsset.cashRecordId) {
      const cashEntryId = 'cl-capex-' + Date.now();
      finalAsset.cashRecordId = cashEntryId;

      const categoryLabelMap: Record<string, string> = {
        EQUIPMENT: 'Mesin & Peralatan',
        FURNITURE: 'Furnitur & Interior',
        RENOVATION: 'Renovasi & Bangunan',
        OTHER: 'Aset Tetap Lainnya',
      };

      const cashEntry: CashLedger = {
        id: cashEntryId,
        date: finalAsset.purchaseDate || new Date().toISOString().split('T')[0],
        type: 'OUT',
        category: 'Pengeluaran Modal (CAPEX) / Pembelian Aset',
        amount: finalAsset.purchasePrice,
        description: `Pembelian Aset Tetap: ${finalAsset.assetName} [${categoryLabelMap[finalAsset.category] || finalAsset.category}]${finalAsset.supplier ? ' - Supplier: ' + finalAsset.supplier : ''}`,
        outletId: finalAsset.outletId,
        outletName: finalAsset.outletName,
        createdBy: finalAsset.createdBy || 'Admin',
        paymentMethod: 'CASH',
        referenceId: finalAsset.id,
        createdAt: new Date().toISOString(),
      };
      StorageService.addCashLedger(cashEntry);
    }

    const list = StorageService.getFixedAssets();
    const updated = [finalAsset, ...list.filter((a) => a.id !== finalAsset.id)];
    setItem(KEYS.FIXED_ASSETS, updated);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'fixedAssets', finalAsset.id), finalAsset).catch(console.error);
    }

    return finalAsset;
  },
  updateFixedAsset: (asset: FixedAsset): FixedAsset => {
    const list = StorageService.getFixedAssets();
    const updated = list.map((a) => (a.id === asset.id ? asset : a));
    setItem(KEYS.FIXED_ASSETS, updated);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'fixedAssets', asset.id), asset).catch(console.error);
    }

    return asset;
  },
  deleteFixedAsset: (id: string) => {
    const list = StorageService.getFixedAssets().filter((a) => a.id !== id);
    setItem(KEYS.FIXED_ASSETS, list);

    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'fixedAssets', id)).catch(console.error);
    }
  },

  // Hutang & Piutang (Debt & Receivables)
  getDebtRecords: (): DebtRecord[] => getItem(KEYS.DEBT_RECORDS, initialDebtRecords),
  saveDebtRecords: (records: DebtRecord[]) => {
    setItem(KEYS.DEBT_RECORDS, records);
    if (shouldSyncToCloud()) {
      records.forEach((r) => setDoc(doc(db, 'debtRecords', r.id), r).catch(console.error));
    }
  },
  addDebtRecord: (record: DebtRecord) => {
    const list = StorageService.getDebtRecords();
    list.unshift(record);
    setItem(KEYS.DEBT_RECORDS, list);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'debtRecords', record.id), record).catch(console.error);
    }
  },
  updateDebtRecord: (record: DebtRecord) => {
    const list = StorageService.getDebtRecords().map((r) => (r.id === record.id ? record : r));
    setItem(KEYS.DEBT_RECORDS, list);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'debtRecords', record.id), record).catch(console.error);
    }
  },
  deleteDebtRecord: (id: string) => {
    const list = StorageService.getDebtRecords().filter((r) => r.id !== id);
    setItem(KEYS.DEBT_RECORDS, list);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'debtRecords', id)).catch(console.error);
    }
  },
  addDebtPayment: (
    debtId: string,
    payment: DebtPayment,
    autoRecordCashLedger: boolean = true
  ): DebtRecord | null => {
    const records = StorageService.getDebtRecords();
    const target = records.find((r) => r.id === debtId);
    if (!target) return null;

    const newPaymentHistory = [...(target.historyPayment || []), payment];
    const newRemaining = Math.max(0, target.remainingAmount - payment.amount);
    const newStatus: 'UNPAID' | 'PARTIAL' | 'PAID' =
      newRemaining <= 0 ? 'PAID' : 'PARTIAL';

    const updated: DebtRecord = {
      ...target,
      remainingAmount: newRemaining,
      status: newStatus,
      historyPayment: newPaymentHistory,
    };

    StorageService.updateDebtRecord(updated);

    // Auto record into Cash Ledger
    if (autoRecordCashLedger) {
      const isSupplierDebt = target.type === 'DEBT_SUPPLIER';
      const cashEntry: CashLedger = {
        id: 'cl-debtpay-' + Date.now(),
        date: payment.date || new Date().toISOString().split('T')[0],
        type: isSupplierDebt ? 'OUT' : 'IN', // Bayar hutang = Kas Keluar; Terima piutang = Kas Masuk
        category: isSupplierDebt ? 'Pembayaran Hutang Supplier' : 'Pelunasan Piutang Pelanggan',
        amount: payment.amount,
        description: `${isSupplierDebt ? 'Bayar Hutang' : 'Terima Piutang'} - ${target.entityName} (${payment.notes || payment.paymentMethod})`,
        outletId: target.outletId,
        outletName: target.outletName,
        createdBy: payment.recordedBy || 'Admin',
        paymentMethod: payment.paymentMethod === 'TRANSFER' ? 'TRANSFER' : payment.paymentMethod === 'QRIS' ? 'QRIS' : 'CASH',
        referenceId: target.id,
        createdAt: new Date().toISOString(),
      };
      StorageService.addCashLedger(cashEntry);
    }

    return updated;
  },

  // Penggajian Karyawan (Payroll & Slip Gaji)
  getPayrollRecords: (outletId?: string): PayrollRecord[] => {
    const list = getItem<PayrollRecord[]>(KEYS.PAYROLL_RECORDS, initialPayrollRecords);
    if (!outletId || outletId === 'ALL') return list;
    return list.filter((p) => p.outletId === outletId);
  },
  savePayrollRecords: (records: PayrollRecord[]) => {
    setItem(KEYS.PAYROLL_RECORDS, records);
    if (shouldSyncToCloud()) {
      records.forEach((r) => {
        setDoc(doc(db, 'payrollRecords', r.id), r).catch(console.error);
      });
    }
  },
  addPayrollRecord: (record: PayrollRecord, autoRecordCashLedger: boolean = true): PayrollRecord => {
    let finalRecord = { ...record };
    // If created directly as PAID, record to Cash Ledger automatically
    if (finalRecord.status === 'PAID' && autoRecordCashLedger && !finalRecord.cashRecordId) {
      const cashEntryId = 'cl-pay-' + Date.now();
      finalRecord.cashRecordId = cashEntryId;
      finalRecord.paidAt = finalRecord.paidAt || new Date().toISOString();

      const cashEntry: CashLedger = {
        id: cashEntryId,
        date: finalRecord.paymentDate || new Date().toISOString().split('T')[0],
        type: 'OUT',
        category: 'Pengeluaran Operasional - Gaji Karyawan',
        amount: finalRecord.netSalary,
        description: `Gaji Karyawan: ${finalRecord.employeeName} (${finalRecord.period}) - THP: Rp ${Math.round(finalRecord.netSalary).toLocaleString('id-ID')}`,
        outletId: finalRecord.outletId,
        outletName: finalRecord.outletName,
        createdBy: finalRecord.paidBy || 'Admin',
        paymentMethod: finalRecord.paymentMethod || 'TRANSFER',
        referenceId: finalRecord.id,
        createdAt: new Date().toISOString(),
      };
      StorageService.addCashLedger(cashEntry);
    }

    const list = StorageService.getPayrollRecords();
    const updatedList = [finalRecord, ...list.filter((p) => p.id !== finalRecord.id)];
    setItem(KEYS.PAYROLL_RECORDS, updatedList);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'payrollRecords', finalRecord.id), finalRecord).catch(console.error);
    }

    return finalRecord;
  },
  updatePayrollRecord: (record: PayrollRecord, autoRecordCashLedger: boolean = true): PayrollRecord => {
    let finalRecord = { ...record };
    const list = StorageService.getPayrollRecords();
    const prev = list.find((p) => p.id === finalRecord.id);

    // If status transitioned from DRAFT to PAID and cash ledger entry not yet created
    if (finalRecord.status === 'PAID' && prev?.status !== 'PAID' && autoRecordCashLedger && !finalRecord.cashRecordId) {
      const cashEntryId = 'cl-pay-' + Date.now();
      finalRecord.cashRecordId = cashEntryId;
      finalRecord.paidAt = finalRecord.paidAt || new Date().toISOString();

      const cashEntry: CashLedger = {
        id: cashEntryId,
        date: finalRecord.paymentDate || new Date().toISOString().split('T')[0],
        type: 'OUT',
        category: 'Pengeluaran Operasional - Gaji Karyawan',
        amount: finalRecord.netSalary,
        description: `Gaji Karyawan: ${finalRecord.employeeName} (${finalRecord.period}) - THP: Rp ${Math.round(finalRecord.netSalary).toLocaleString('id-ID')}`,
        outletId: finalRecord.outletId,
        outletName: finalRecord.outletName,
        createdBy: finalRecord.paidBy || 'Admin',
        paymentMethod: finalRecord.paymentMethod || 'TRANSFER',
        referenceId: finalRecord.id,
        createdAt: new Date().toISOString(),
      };
      StorageService.addCashLedger(cashEntry);
    }

    const updatedList = list.map((p) => (p.id === finalRecord.id ? finalRecord : p));
    setItem(KEYS.PAYROLL_RECORDS, updatedList);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'payrollRecords', finalRecord.id), finalRecord).catch(console.error);
    }

    return finalRecord;
  },
  deletePayrollRecord: (id: string) => {
    const list = StorageService.getPayrollRecords();
    const target = list.find((p) => p.id === id);
    if (target?.cashRecordId) {
      // Clean up linked cash ledger entry if deleted
      StorageService.deleteCashLedger(target.cashRecordId);
    }

    const updatedList = list.filter((p) => p.id !== id);
    setItem(KEYS.PAYROLL_RECORDS, updatedList);

    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'payrollRecords', id)).catch(console.error);
    }
  },
  markPayrollPaid: (
    payrollId: string,
    paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS' | 'OTHER' = 'TRANSFER',
    paidBy: string = 'Admin',
    autoRecordCashLedger: boolean = true
  ): PayrollRecord | null => {
    const list = StorageService.getPayrollRecords();
    const target = list.find((p) => p.id === payrollId);
    if (!target) return null;

    const cashEntryId = target.cashRecordId || 'cl-pay-' + Date.now();
    const nowIso = new Date().toISOString();

    const updated: PayrollRecord = {
      ...target,
      status: 'PAID',
      paymentMethod,
      paidBy,
      paidAt: nowIso,
      paymentDate: target.paymentDate || nowIso.split('T')[0],
      cashRecordId: cashEntryId,
    };

    if (autoRecordCashLedger) {
      const cashEntry: CashLedger = {
        id: cashEntryId,
        date: updated.paymentDate,
        type: 'OUT',
        category: 'Pengeluaran Operasional - Gaji Karyawan',
        amount: updated.netSalary,
        description: `Gaji Karyawan: ${updated.employeeName} (${updated.period}) - THP: Rp ${Math.round(updated.netSalary).toLocaleString('id-ID')}`,
        outletId: updated.outletId,
        outletName: updated.outletName,
        createdBy: paidBy,
        paymentMethod: paymentMethod,
        referenceId: updated.id,
        createdAt: nowIso,
      };
      StorageService.addCashLedger(cashEntry);
    }

    return StorageService.updatePayrollRecord(updated, false);
  },

  // Shift Management
  getActiveShift: (): Shift | null => getItem(KEYS.ACTIVE_SHIFT, null),
  getShifts: (): Shift[] => getItem(KEYS.SHIFTS, []),
  deleteShift: (id: string) => {
    const shifts = StorageService.getShifts().filter((s) => s.id !== id);
    setItem(KEYS.SHIFTS, shifts);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'shifts', id));
    }
  },
  startShift: (cashierId: string, cashierName: string, startCash: number): Shift => {
    const newShift: Shift = {
      id: 'shift-' + Date.now(),
      cashierId,
      cashierName,
      startTime: new Date().toISOString(),
      startCash,
      totalSalesCash: 0,
      totalSalesNonCash: 0,
      totalTransactionsCount: 0,
      status: 'open',
    };
    setItem(KEYS.ACTIVE_SHIFT, newShift);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'activeShift', 'current'), newShift);
    }

    const shifts = getItem<Shift[]>(KEYS.SHIFTS, []);
    shifts.unshift(newShift);
    setItem(KEYS.SHIFTS, shifts);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'shifts', newShift.id), newShift);
    }

    return newShift;
  },

  endShift: (actualEndCash: number): Shift | null => {
    const activeShift = StorageService.getActiveShift();
    if (!activeShift) return null;

    const txs = StorageService.getTransactions().filter(
      (t) => t.cashierId === activeShift.cashierId && new Date(t.timestamp) >= new Date(activeShift.startTime)
    );

    let cashSales = 0;
    let nonCashSales = 0;
    let merchantSales = 0;
    txs.forEach((t) => {
      if (t.paymentMethod === 'cash') {
        cashSales += t.total;
      } else if (
        t.paymentMethod === 'shopeefood' ||
        t.paymentMethod === 'gofood' ||
        t.paymentMethod === 'grabfood' ||
        t.paymentMethod === 'shopeefood_merchant' ||
        t.paymentMethod === 'non_cash_merchant' ||
        t.orderType === 'online_delivery' ||
        t.orderType === 'shopeefood_merchant'
      ) {
        merchantSales += t.total;
      } else {
        nonCashSales += t.total;
      }
    });

    const expectedEndCash = activeShift.startCash + cashSales;
    const diff = actualEndCash - expectedEndCash;

    const closedShift: Shift = {
      ...activeShift,
      endTime: new Date().toISOString(),
      actualEndCash,
      expectedEndCash,
      difference: diff,
      totalSalesCash: cashSales,
      totalSalesNonCash: nonCashSales,
      totalSalesMerchant: merchantSales,
      totalTransactionsCount: txs.length,
      status: 'closed',
    };

    setItem(KEYS.ACTIVE_SHIFT, null);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'activeShift', 'current'), { status: 'closed' });
    }

    const shifts = getItem<Shift[]>(KEYS.SHIFTS, []).map((s) => (s.id === closedShift.id ? closedShift : s));
    setItem(KEYS.SHIFTS, shifts);
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'shifts', closedShift.id), closedShift);
    }

    // Auto-Backup JSON trigger after shift close
    try {
      const cfg = AutoBackupService.getConfig();
      if (cfg.enabled && cfg.triggerOnShiftClose) {
        AutoBackupService.performBackup('shift_close');
      }
    } catch (err) {
      console.warn('[AutoBackup] Shift close trigger error:', err);
    }

    return closedShift;
  },

  // Full Backup & Restore JSON
  exportBackupJSON: () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      app: 'Su-Qur POS',
      settings: StorageService.getSettings(),
      users: StorageService.getUsers(),
      products: StorageService.getProducts(),
      ingredients: StorageService.getIngredients(),
      branchInventory: StorageService.getBranchInventory(),
      stockTransfers: StorageService.getStockTransfers(),
      transactions: StorageService.getTransactions(),
      suppliers: StorageService.getSuppliers(),
      purchases: StorageService.getPurchases(),
      expenses: StorageService.getExpenses(),
      stockOpnames: StorageService.getStockOpnames(),
      shifts: StorageService.getShifts(),
      cashLedgers: StorageService.getCashLedgers(),
      capitalRecords: StorageService.getCapitalRecords(),
      debtRecords: StorageService.getDebtRecords(),
      payrollRecords: StorageService.getPayrollRecords(),
      fixedAssets: StorageService.getFixedAssets(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `suqur_pos_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    return backupData;
  },

  restoreBackupJSON: (jsonInput: string | any, mode: 'replace' | 'merge' = 'replace'): boolean => {
    try {
      const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      if (data && typeof data === 'object') {
        let restoredCount = 0;
        if (data.settings) { StorageService.saveSettings(data.settings); restoredCount++; }
        if (data.outlets && Array.isArray(data.outlets)) {
          if (mode === 'merge') {
            const current = StorageService.getOutlets();
            const map = new Map(current.map((o) => [o.id, o]));
            data.outlets.forEach((o: Outlet) => map.set(o.id, o));
            StorageService.saveOutlets(Array.from(map.values()));
          } else {
            StorageService.saveOutlets(data.outlets);
          }
          restoredCount++;
        }
        if (data.users && Array.isArray(data.users)) {
          if (mode === 'merge') {
            const current = StorageService.getUsers();
            const map = new Map(current.map((u) => [u.id, u]));
            data.users.forEach((u: User) => map.set(u.id, u));
            StorageService.saveUsers(Array.from(map.values()));
          } else {
            StorageService.saveUsers(data.users);
          }
          restoredCount++;
        }
        if (data.products && Array.isArray(data.products)) {
          if (mode === 'merge') {
            const current = StorageService.getProducts();
            const map = new Map(current.map((p) => [p.id, p]));
            data.products.forEach((p: Product) => map.set(p.id, p));
            StorageService.saveProducts(Array.from(map.values()));
          } else {
            StorageService.saveProducts(data.products);
          }
          restoredCount++;
        }
        if (data.ingredients && Array.isArray(data.ingredients)) {
          if (mode === 'merge') {
            const current = StorageService.getIngredients();
            const map = new Map(current.map((i) => [i.id, i]));
            data.ingredients.forEach((i: Ingredient) => map.set(i.id, i));
            StorageService.saveIngredients(Array.from(map.values()));
          } else {
            StorageService.saveIngredients(data.ingredients);
          }
          restoredCount++;
        }
        if (data.branchInventory && Array.isArray(data.branchInventory)) {
          StorageService.saveBranchInventory(data.branchInventory);
          restoredCount++;
        }
        if (data.stockTransfers && Array.isArray(data.stockTransfers)) {
          StorageService.saveStockTransfers(data.stockTransfers);
          restoredCount++;
        }
        if (data.transactions && Array.isArray(data.transactions)) {
          let list = data.transactions;
          if (mode === 'merge') {
            const current = StorageService.getTransactions();
            const map = new Map(current.map((t) => [t.id, t]));
            data.transactions.forEach((t: Transaction) => map.set(t.id, t));
            list = Array.from(map.values());
          }
          setItem(KEYS.TRANSACTIONS, list);
          restoredCount++;
          if (shouldSyncToCloud()) {
            list.forEach((tx: Transaction) => setDoc(doc(db, 'transactions', tx.id), tx).catch(console.error));
          }
        }
        if (data.suppliers && Array.isArray(data.suppliers)) {
          if (mode === 'merge') {
            const current = StorageService.getSuppliers();
            const map = new Map(current.map((s) => [s.id, s]));
            data.suppliers.forEach((s: Supplier) => map.set(s.id, s));
            StorageService.saveSuppliers(Array.from(map.values()));
          } else {
            StorageService.saveSuppliers(data.suppliers);
          }
          restoredCount++;
        }
        if (data.expenses && Array.isArray(data.expenses)) {
          let list = data.expenses;
          if (mode === 'merge') {
            const current = StorageService.getExpenses();
            const map = new Map(current.map((e) => [e.id, e]));
            data.expenses.forEach((e: Expense) => map.set(e.id, e));
            list = Array.from(map.values());
          }
          setItem(KEYS.EXPENSES, list);
          restoredCount++;
          if (shouldSyncToCloud()) {
            list.forEach((e: Expense) => setDoc(doc(db, 'expenses', e.id), e).catch(console.error));
          }
        }
        if (data.purchases && Array.isArray(data.purchases)) {
          let list = data.purchases;
          if (mode === 'merge') {
            const current = StorageService.getPurchases();
            const map = new Map(current.map((p) => [p.id, p]));
            data.purchases.forEach((p: PurchaseOrder) => map.set(p.id, p));
            list = Array.from(map.values());
          }
          setItem(KEYS.PURCHASES, list);
          restoredCount++;
          if (shouldSyncToCloud()) {
            list.forEach((p: PurchaseOrder) => setDoc(doc(db, 'purchases', p.id), p).catch(console.error));
          }
        }
        if (data.stockOpnames && Array.isArray(data.stockOpnames)) {
          setItem(KEYS.STOCK_OPNAMES, data.stockOpnames);
          restoredCount++;
          if (shouldSyncToCloud()) {
            data.stockOpnames.forEach((s: StockOpname) => setDoc(doc(db, 'stockOpnames', s.id), s).catch(console.error));
          }
        }
        if (data.shifts && Array.isArray(data.shifts)) {
          setItem(KEYS.SHIFTS, data.shifts);
          restoredCount++;
          if (shouldSyncToCloud()) {
            data.shifts.forEach((s: Shift) => setDoc(doc(db, 'shifts', s.id), s).catch(console.error));
          }
        }
        if (data.cashLedgers && Array.isArray(data.cashLedgers)) {
          let list = data.cashLedgers;
          if (mode === 'merge') {
            const current = StorageService.getCashLedgers();
            const map = new Map(current.map((c) => [c.id, c]));
            data.cashLedgers.forEach((c: CashLedger) => map.set(c.id, c));
            list = Array.from(map.values());
          }
          StorageService.saveCashLedgers(list);
          restoredCount++;
        }
        if (data.capitalRecords && Array.isArray(data.capitalRecords)) {
          StorageService.saveCapitalRecords(data.capitalRecords);
          restoredCount++;
        }
        if (data.debtRecords && Array.isArray(data.debtRecords)) {
          StorageService.saveDebtRecords(data.debtRecords);
          restoredCount++;
        }
        if (data.payrollRecords && Array.isArray(data.payrollRecords)) {
          StorageService.savePayrollRecords(data.payrollRecords);
          restoredCount++;
        }
        if (data.qrOrders && Array.isArray(data.qrOrders)) {
          StorageService.saveQROrders(data.qrOrders);
          restoredCount++;
        }
        if (data.fixedAssets && Array.isArray(data.fixedAssets)) {
          let list = data.fixedAssets;
          if (mode === 'merge') {
            const current = StorageService.getFixedAssets();
            const map = new Map(current.map((a) => [a.id, a]));
            data.fixedAssets.forEach((a: FixedAsset) => map.set(a.id, a));
            list = Array.from(map.values());
          }
          StorageService.saveFixedAssets(list);
          restoredCount++;
        }
        return restoredCount > 0;
      }
      return false;
    } catch (e) {
      console.error('Failed to restore backup JSON', e);
      return false;
    }
  },

  resetToDefault: () => {
    localStorage.clear();
    Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
    setItem(KEYS.PRODUCTS, initialProducts);
    setItem(KEYS.INGREDIENTS, initialIngredients);
    setItem(KEYS.BRANCH_INVENTORY, initialBranchInventory);
    setItem(KEYS.STOCK_TRANSFERS, initialStockTransfers);
    setItem(KEYS.TRANSACTIONS, initialTransactions);
    setItem(KEYS.SUPPLIERS, initialSuppliers);
    setItem(KEYS.EXPENSES, initialExpenses);
    setItem(KEYS.USERS, initialUsers);
    setItem(KEYS.SETTINGS, initialStoreSettings);
    setItem(KEYS.CURRENT_USER, initialUsers[0]);
    setItem(KEYS.SHIFTS, []);
    setItem(KEYS.PURCHASES, []);
    setItem(KEYS.STOCK_OPNAMES, []);
    setItem(KEYS.CASH_LEDGERS, initialCashLedgers);
    setItem(KEYS.CAPITAL_RECORDS, initialCapitalRecords);
    setItem(KEYS.DEBT_RECORDS, initialDebtRecords);
    setItem(KEYS.PAYROLL_RECORDS, initialPayrollRecords);
    setItem(KEYS.FIXED_ASSETS, initialFixedAssets);
    setItem(KEYS.PRE_ORDERS, initialPreOrders);
  },

  // Clear modules to empty arrays so users can input fresh data
  clearInventoryAndRecipes: () => {
    setItem(KEYS.PRODUCTS, []);
    setItem(KEYS.INGREDIENTS, []);
    setItem(KEYS.BRANCH_INVENTORY, []);
    setItem(KEYS.STOCK_TRANSFERS, []);
    setItem(KEYS.STOCK_OPNAMES, []);
  },

  clearOperationalData: () => {
    setItem(KEYS.EXPENSES, []);
    setItem(KEYS.PURCHASES, []);
    setItem(KEYS.SUPPLIERS, []);
  },

  clearReportsAndTransactions: () => {
    setItem(KEYS.TRANSACTIONS, []);
    setItem(KEYS.SHIFTS, []);
    setItem(KEYS.ACTIVE_SHIFT, null);
  },

  clearOperationalAndReports: () => {
    StorageService.clearOperationalData();
    StorageService.clearReportsAndTransactions();
  },

  clearAllDataEmpty: () => {
    StorageService.clearInventoryAndRecipes();
    StorageService.clearOperationalData();
    StorageService.clearReportsAndTransactions();
  },

  // Cart Draft Management
  getCartDraft: (): any[] => getItem(KEYS.CART_DRAFT, []),
  saveCartDraft: (cart: any[]) => setItem(KEYS.CART_DRAFT, cart),
  clearCartDraft: () => {
    delete memoryCache[KEYS.CART_DRAFT];
    try {
      localStorage.removeItem(KEYS.CART_DRAFT);
      idbDel(KEYS.CART_DRAFT).catch(() => {});
    } catch (e) {}
  },

  // Pending Offline Transactions Management
  getPendingOfflineTxs: (): string[] => {
    const list = getItem<string[]>(KEYS.PENDING_OFFLINE_TXS, []);
    return Array.isArray(list) ? list : [];
  },
  getPendingOfflineCount: (): number => {
    const list = StorageService.getPendingOfflineTxs();
    // Validate against stored transactions to eliminate phantom/orphaned IDs
    const allTxs = StorageService.getTransactions(false);
    const validCount = list.filter((id) => allTxs.some((t) => t.id === id)).length;
    return validCount;
  },
  clearPendingOfflineTxs: () => {
    setItem(KEYS.PENDING_OFFLINE_TXS, []);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sq_pending_sync_updated', { detail: { count: 0 } }));
    }
  },

  syncLocalToFirestore: async (): Promise<{ success: boolean; syncedCount: number; error?: string }> => {
    if (isFirestoreQuotaExceeded()) {
      return { success: true, syncedCount: 0, error: 'Database berjalan dalam mode offline lokal aman.' };
    }
    try {
      await enableFirestoreNetwork();
      const allTxs = StorageService.getTransactions(false);
      const pendingIds = StorageService.getPendingOfflineTxs();
      
      if (!Array.isArray(pendingIds) || pendingIds.length === 0) {
        StorageService.clearPendingOfflineTxs();
        return { success: true, syncedCount: 0 };
      }

      // Filter existing transactions matching pending IDs
      const txsToSync = allTxs.filter((t) => pendingIds.includes(t.id));
      
      let syncedCount = 0;
      const failedIds: string[] = [];

      for (const tx of txsToSync) {
        try {
          if (db) {
            await setDoc(doc(db, 'transactions', tx.id), tx);
          }
          syncedCount++;
        } catch (err) {
          failedIds.push(tx.id);
        }
      }

      // Only retain IDs that genuinely failed to upload; orphaned/missing IDs are purged
      setItem(KEYS.PENDING_OFFLINE_TXS, failedIds);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sq_pending_sync_updated', { detail: { count: failedIds.length } }));
      }

      return { success: true, syncedCount };
    } catch (err: any) {
      // In case of global error, still sanitize queue against non-existent transactions
      const allTxs = StorageService.getTransactions(false);
      const pendingIds = StorageService.getPendingOfflineTxs();
      const cleaned = pendingIds.filter((id) => allTxs.some((t) => t.id === id));
      setItem(KEYS.PENDING_OFFLINE_TXS, cleaned);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sq_pending_sync_updated', { detail: { count: cleaned.length } }));
      }
      return { success: false, syncedCount: 0, error: err?.message || 'Gagal tersambung ke server.' };
    }
  },

  reconnectFirestore: async (): Promise<{ isConnected: boolean; syncedCount: number; message: string }> => {
    try {
      await enableFirestoreNetwork();
      const isConnected = await testConnection(2500);
      const syncRes = await StorageService.syncLocalToFirestore();
      return {
        isConnected,
        syncedCount: syncRes.syncedCount,
        message: isConnected
          ? syncRes.syncedCount > 0
            ? `Berhasil tersambung & menyinkronkan ${syncRes.syncedCount} transaksi offline!`
            : 'Terhubung ke Cloud Firestore: Real-Time Aktif.'
          : 'Berjalan dalam mode Offline-First Lokal (Aman).',
      };
    } catch (err: any) {
      return {
        isConnected: false,
        syncedCount: 0,
        message: err?.message || 'Gagal menginisialisasi jaringan.',
      };
    }
  },

  // Session & Storage Cleansing
  cleanseSessionAndLocalCache: () => {
    StorageService.clearCartDraft();
    delete memoryCache[KEYS.CURRENT_USER];
    try {
      sessionStorage.clear();
    } catch (e) {}
  },

  // Auto-Sync On Logout
  performLogoutSyncAndCleansing: async (): Promise<{
    success: boolean;
    message: string;
    syncedTxs: number;
    error?: string;
  }> => {
    let syncedTxs = 0;
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (isOnline && !isFirestoreQuotaExceeded()) {
        const syncWork = async () => {
          // 1. Re-enable network with short race guard
          try {
            await Promise.race([
              enableFirestoreNetwork(),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800))
            ]);
          } catch (e) {}

          // 2. Sync pending offline transactions
          try {
            const txSyncRes = await Promise.race([
              StorageService.syncLocalToFirestore(),
              new Promise<{ success: boolean; syncedCount: number }>((resolve) =>
                setTimeout(() => resolve({ success: true, syncedCount: 0 }), 1500)
              )
            ]);
            if (txSyncRes && typeof txSyncRes.syncedCount === 'number') {
              syncedTxs = txSyncRes.syncedCount;
            }
          } catch (e) {}

          // 3. Fast non-blocking core store batch
          try {
            const settings = StorageService.getSettings();
            const activeShift = StorageService.getActiveShift();
            const batchItems: Array<{ ref: any; data: any }> = [
              { ref: doc(db, 'settings', 'store'), data: settings }
            ];
            if (activeShift) {
              batchItems.push({ ref: doc(db, 'activeShift', 'current'), data: activeShift });
            }

            await Promise.race([
              commitBatchDocs(batchItems, 50),
              new Promise<void>((resolve) => setTimeout(resolve, 1000))
            ]);
          } catch (batchErr) {
            console.debug('[Logout Auto-Sync Non-blocking]:', batchErr);
          }
        };

        // Enforce hard 2.5-second total timeout ceiling so user is never stuck
        await Promise.race([
          syncWork(),
          new Promise<void>((resolve) => setTimeout(resolve, 2500))
        ]);
      }

      // 4. Cleanse session and local user cache safely
      StorageService.cleanseSessionAndLocalCache();

      return {
        success: true,
        message:
          syncedTxs > 0
            ? `Berhasil menyinkronkan ${syncedTxs} transaksi & mengamankan sesi!`
            : 'Seluruh data transaksi & stok tersimpan aman. Sesi berhasil dibersihkan.',
        syncedTxs,
      };
    } catch (err: any) {
      console.warn('⚠️ [Logout Auto-Sync]:', err);
      // Cleanse session anyway so user is never locked in an un-logoutable state
      StorageService.cleanseSessionAndLocalCache();
      return {
        success: true,
        message: 'Data sesi tersimpan aman di database lokal perangkat.',
        syncedTxs: 0,
      };
    }
  },

  // QR Code & Self-Ordering Customer Orders
  getQROrders: (outletId?: string): QROrder[] => {
    const list = getItem<QROrder[]>(KEYS.QR_ORDERS, []);
    if (!outletId || outletId === 'ALL') return list;
    return list.filter((o) => o.outletId === outletId);
  },
  getPendingQROrders: (outletId?: string): QROrder[] => {
    const list = StorageService.getQROrders(outletId);
    return list.filter((o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing');
  },
  saveQROrders: (orders: QROrder[]) => {
    setItem(KEYS.QR_ORDERS, orders);
    if (shouldSyncToCloud()) {
      orders.forEach((o) => {
        setDoc(doc(db, 'qr_orders', o.id), o).catch((err) => {
          console.debug('QR order sync note:', err?.message || err);
        });
      });
    }
  },
  addQROrder: (order: QROrder): { success: boolean; order: QROrder } => {
    const list = StorageService.getQROrders();
    // Prepend new order
    const updated = [order, ...list.filter((o) => o.id !== order.id)];
    setItem(KEYS.QR_ORDERS, updated);

    // Save to Firestore so cashier instantly receives it
    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'qr_orders', order.id), order).catch((err) => {
        console.debug('QR add sync note:', err?.message || err);
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime_qr_order_pushed', { detail: order }));
    }

    return { success: true, order };
  },
  updateQROrderStatus: (
    orderId: string,
    status: QROrderStatus,
    paymentStatus?: QROrderPaymentStatus,
    cashierUser?: User
  ): QROrder | null => {
    const list = StorageService.getQROrders();
    const target = list.find((o) => o.id === orderId);
    if (!target) return null;

    const updated: QROrder = {
      ...target,
      status,
      ...(paymentStatus ? { paymentStatus } : {}),
      updatedAt: new Date().toISOString(),
      ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
      ...(cashierUser
        ? {
            processedByCashierId: cashierUser.id,
            processedByCashierName: cashierUser.name,
          }
        : {}),
    };

    const updatedList = list.map((o) => (o.id === orderId ? updated : o));
    setItem(KEYS.QR_ORDERS, updatedList);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'qr_orders', orderId), updated).catch((err) => {
        console.debug('QR update sync note:', err?.message || err);
      });
    }

    return updated;
  },
  deleteQROrder: (orderId: string) => {
    const list = StorageService.getQROrders().filter((o) => o.id !== orderId);
    setItem(KEYS.QR_ORDERS, list);
    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'qr_orders', orderId)).catch((err) => {
        console.debug('QR delete sync note:', err?.message || err);
      });
    }
  },
  settleQROrder: (
    orderId: string,
    cashierUser: User,
    paymentMethodOverride?: PaymentMethod,
    cashGiven?: number
  ): { success: boolean; transaction?: Transaction; warnings: string[] } => {
    const list = StorageService.getQROrders();
    const qrOrder = list.find((o) => o.id === orderId);
    if (!qrOrder) {
      return { success: false, warnings: ['Pesanan QR tidak ditemukan'] };
    }

    // Determine final payment method
    const finalMethod: PaymentMethod =
      paymentMethodOverride || (qrOrder.paymentMethod === 'qris' ? 'qris' : 'cash');
    const cashAmountPaid = finalMethod === 'cash' ? (cashGiven !== undefined ? cashGiven : qrOrder.total) : qrOrder.total;
    const changeAmount = finalMethod === 'cash' && cashAmountPaid > qrOrder.total ? cashAmountPaid - qrOrder.total : 0;

    // Convert QROrder items to TransactionItem format
    const txItems = qrOrder.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName,
      selectedCup: item.selectedCup,
      selectedIce: item.selectedIce,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      cogsUnitPrice: item.cogsUnitPrice,
      cogsTotal: item.cogsTotal,
      notes: item.notes,
    }));

    // Create full Transaction
    const newTx: Transaction = {
      id: 'tx-qr-' + Date.now(),
      invoiceNo: `SQ-QR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
      queueNo: qrOrder.queueNo || StorageService.getNextQueueNumber(),
      timestamp: new Date().toISOString(),
      outletId: qrOrder.outletId,
      outletName: qrOrder.outletName,
      cashierId: cashierUser.id,
      cashierName: cashierUser.name,
      customerName: qrOrder.customerName,
      customerPhone: qrOrder.customerPhone,
      tableNo: qrOrder.tableNo,
      orderType: 'dine_in',
      items: txItems,
      subtotal: qrOrder.subtotal,
      discount: qrOrder.discount,
      tax: qrOrder.tax,
      total: qrOrder.total,
      totalCogs: qrOrder.totalCogs,
      grossProfit: qrOrder.total - qrOrder.totalCogs,
      paymentMethod: finalMethod,
      cashAmountPaid,
      changeAmount,
      status: 'completed',
    };

    // 1. Process Transaction (deducts ingredient stock according to recipe & creates transaction history)
    const txResult = StorageService.createTransaction(newTx);

    // 2. Auto Record to Cash Ledger (Kas Masuk Outlet)
    const cashLedgerEntry: CashLedger = {
      id: 'cl-qr-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: 'IN',
      category: 'Penjualan QR Meja',
      amount: newTx.total,
      description: `Penjualan QR (${qrOrder.tableNo} - ${qrOrder.customerName}) No: ${newTx.invoiceNo}`,
      outletId: qrOrder.outletId,
      outletName: qrOrder.outletName,
      createdBy: cashierUser.name,
      paymentMethod: finalMethod === 'cash' ? 'CASH' : finalMethod === 'qris' ? 'QRIS' : 'OTHER',
      referenceId: newTx.id,
      createdAt: new Date().toISOString(),
    };
    StorageService.addCashLedger(cashLedgerEntry);

    // 3. Mark QROrder as completed
    StorageService.updateQROrderStatus(
      orderId,
      'completed',
      finalMethod === 'qris' ? 'paid_qris' : 'paid_cash',
      cashierUser
    );

    return {
      success: true,
      transaction: txResult.transaction || newTx,
      warnings: txResult.warnings || [],
    };
  },

  // Hold Bill & Draft Orders Management (Multi-Order)
  getDraftOrders: (outletId?: string): DraftOrder[] => {
    const list = getItem<DraftOrder[]>(KEYS.DRAFT_ORDERS, []);
    const filtered = outletId ? list.filter((d) => !d.outletId || d.outletId === outletId) : list;
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  saveDraftOrder: (draft: DraftOrder): DraftOrder => {
    const list = getItem<DraftOrder[]>(KEYS.DRAFT_ORDERS, []);
    const existingIndex = list.findIndex((d) => d.id === draft.id);
    let updatedList: DraftOrder[];

    const finalDraft: DraftOrder = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      updatedList = [...list];
      updatedList[existingIndex] = finalDraft;
    } else {
      updatedList = [finalDraft, ...list];
    }

    setItem(KEYS.DRAFT_ORDERS, updatedList);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'draft_orders', finalDraft.id), finalDraft).catch((err) =>
        console.warn('[StorageService] Cloud sync draft order error:', err)
      );
    }

    return finalDraft;
  },

  deleteDraftOrder: (draftId: string) => {
    const list = getItem<DraftOrder[]>(KEYS.DRAFT_ORDERS, []);
    const updated = list.filter((d) => d.id !== draftId);
    setItem(KEYS.DRAFT_ORDERS, updated);

    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'draft_orders', draftId)).catch((err) =>
        console.warn('[StorageService] Cloud delete draft order error:', err)
      );
    }
  },

  updateDraftOrderStatus: (draftId: string, status: 'DRAFT' | 'PAID' | 'CANCELLED') => {
    const list = getItem<DraftOrder[]>(KEYS.DRAFT_ORDERS, []);
    const draft = list.find((d) => d.id === draftId);
    if (!draft) return;

    if (status === 'PAID' || status === 'CANCELLED') {
      // Remove from active draft orders or mark as finished
      const updated = list.filter((d) => d.id !== draftId);
      setItem(KEYS.DRAFT_ORDERS, updated);
      if (shouldSyncToCloud()) {
        deleteDoc(doc(db, 'draft_orders', draftId)).catch(console.error);
      }
    } else {
      draft.status = status;
      draft.updatedAt = new Date().toISOString();
      setItem(KEYS.DRAFT_ORDERS, [...list]);
      if (shouldSyncToCloud()) {
        setDoc(doc(db, 'draft_orders', draftId), draft).catch(console.error);
      }
    }
  },

  // =========================================================================
  // PRE-ORDER (PO) & RESERVASI SLOT WAKTU MANAGEMENT
  // =========================================================================
  getPreOrders: (outletId?: string): PreOrder[] => {
    const list = getItem<PreOrder[]>(KEYS.PRE_ORDERS, initialPreOrders);
    const filtered = outletId ? list.filter((p) => !p.outletId || p.outletId === outletId) : list;
    return filtered.sort((a, b) => {
      // Sort by scheduledDate then scheduledTime ascending
      const dateA = `${a.scheduledDate} ${a.scheduledTime || '00:00'}`;
      const dateB = `${b.scheduledDate} ${b.scheduledTime || '00:00'}`;
      return dateA.localeCompare(dateB);
    });
  },

  savePreOrder: (preOrder: PreOrder, recordCashDP: boolean = true): PreOrder => {
    const list = getItem<PreOrder[]>(KEYS.PRE_ORDERS, initialPreOrders);
    const existingIndex = list.findIndex((p) => p.id === preOrder.id);
    const outlets = StorageService.getOutlets();
    const activeOutlet = outlets.find((o) => o.id === preOrder.outletId) || outlets[0] || { id: 'outlet-lagoa', name: 'Cabang Utama Lagoa' };

    const finalPO: PreOrder = {
      ...preOrder,
      outletName: preOrder.outletName || activeOutlet.name,
      remainingBalance: Math.max(0, preOrder.totalAmount - (preOrder.depositAmount || 0)),
      paymentStatus:
        (preOrder.depositAmount || 0) >= preOrder.totalAmount
          ? 'PAID'
          : (preOrder.depositAmount || 0) > 0
          ? 'PARTIAL_DP'
          : 'UNPAID',
      updatedAt: new Date().toISOString(),
    };

    // Auto record DP into Cash Ledger (Kas Masuk Outlet) if checked and not recorded yet
    if (recordCashDP && finalPO.depositAmount > 0 && !finalPO.dpCashRecordId) {
      const cashEntryId = 'cl-po-dp-' + Date.now();
      const cashEntry: CashLedger = {
        id: cashEntryId,
        date: finalPO.createdAt ? finalPO.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        type: 'IN',
        category: 'Uang Muka (DP) Pre-Order',
        amount: finalPO.depositAmount,
        description: `Penerimaan DP ${finalPO.orderType} (${finalPO.poNumber || finalPO.id} - ${finalPO.customerName})`,
        outletId: finalPO.outletId || activeOutlet.id,
        outletName: finalPO.outletName || activeOutlet.name,
        createdBy: finalPO.cashierName || finalPO.createdBy || 'Kasir',
        paymentMethod:
          finalPO.dpPaymentMethod === 'CASH' || finalPO.dpPaymentMethod === 'cash'
            ? 'CASH'
            : finalPO.dpPaymentMethod === 'QRIS' || finalPO.dpPaymentMethod === 'qris'
            ? 'QRIS'
            : 'TRANSFER',
        referenceId: finalPO.id,
        createdAt: new Date().toISOString(),
      };
      finalPO.dpCashRecordId = cashEntryId;
      StorageService.addCashLedger(cashEntry);
    }

    let updatedList: PreOrder[];
    if (existingIndex >= 0) {
      updatedList = [...list];
      updatedList[existingIndex] = finalPO;
    } else {
      updatedList = [finalPO, ...list];
    }

    setItem(KEYS.PRE_ORDERS, updatedList);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'pre_orders', finalPO.id), finalPO).catch((err) =>
        console.warn('[StorageService] Cloud sync PreOrder error:', err)
      );
    }

    return finalPO;
  },

  updatePreOrderStatus: (id: string, status: PreOrderStatus) => {
    const list = getItem<PreOrder[]>(KEYS.PRE_ORDERS, initialPreOrders);
    const target = list.find((p) => p.id === id);
    if (!target) return;

    target.orderStatus = status;
    target.updatedAt = new Date().toISOString();
    if (status === 'COMPLETED') {
      target.completedAt = new Date().toISOString();
    }

    setItem(KEYS.PRE_ORDERS, [...list]);

    if (shouldSyncToCloud()) {
      setDoc(doc(db, 'pre_orders', id), target).catch(console.error);
    }
  },

  fulfillAndCompletePreOrder: (
    id: string,
    finalPaymentMethod: string = 'cash',
    cashAmountPaid?: number,
    cashierUser?: { id: string; name: string }
  ): { success: boolean; transaction?: Transaction; warnings: string[]; error?: string } => {
    const preOrders = StorageService.getPreOrders();
    const po = preOrders.find((p) => p.id === id);
    if (!po) {
      return { success: false, warnings: [], error: 'Pre-Order tidak ditemukan.' };
    }

    const outlets = StorageService.getOutlets();
    const activeOutlet = outlets.find((o) => o.id === po.outletId) || outlets[0] || { id: 'outlet-lagoa', name: 'Cabang Utama Lagoa' };
    const user = cashierUser || { id: 'cashier-1', name: 'Kasir' };

    const subtotal = po.totalAmount;
    const totalCogs = po.items.reduce((sum, item) => sum + (item.cogsTotal || ((item.product?.cogs || 0) * item.quantity)), 0);
    const amountToCollect = po.remainingBalance;

    const mappedPaymentMethod: PaymentMethod =
      finalPaymentMethod === 'qris'
        ? 'qris'
        : finalPaymentMethod === 'debit'
        ? 'debit'
        : 'cash';

    // Map to regular Transaction
    const newTx: Transaction = {
      id: 'tx-po-' + Date.now(),
      invoiceNo: 'INV-' + (po.poNumber || ('PO-' + Date.now().toString().slice(-6))),
      queueNo: 'PO' + Date.now().toString().slice(-4),
      timestamp: new Date().toISOString(),
      outletId: po.outletId || activeOutlet.id,
      outletName: po.outletName || activeOutlet.name,
      cashierId: user.id,
      cashierName: user.name,
      customerName: po.customerName,
      customerPhone: po.customerPhone,
      tableNo: po.tableNumber,
      orderType: po.orderType === 'DINE_IN_RESERVATION' ? 'dine_in' : po.orderType === 'DELIVERY' ? 'online_delivery' : 'take_away',
      items: po.items.map((it) => ({
        productId: it.product.id,
        productName: it.product.name,
        variantName: it.selectedVariant?.name,
        selectedCup: it.selectedCup,
        selectedIce: it.selectedIce,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        cogsUnitPrice: it.product.cogs || 0,
        cogsTotal: it.cogsTotal || (it.product.cogs * it.quantity),
        notes: it.notes,
      })),
      subtotal: subtotal,
      discount: 0,
      tax: 0,
      total: subtotal,
      totalCogs: totalCogs,
      grossProfit: subtotal - totalCogs,
      paymentMethod: mappedPaymentMethod,
      cashAmountPaid: cashAmountPaid || (mappedPaymentMethod === 'cash' ? amountToCollect : undefined),
      changeAmount: cashAmountPaid && cashAmountPaid > amountToCollect ? cashAmountPaid - amountToCollect : 0,
      status: 'completed',
    };

    // 1. Process Transaction (deducts ingredient stock according to recipe & creates transaction record)
    const txResult = StorageService.createTransaction(newTx);

    // 2. Auto Record to Cash Ledger (Kas Masuk Outlet Pelunasan)
    let finalCashId = '';
    if (amountToCollect > 0) {
      finalCashId = 'cl-po-final-' + Date.now();
      const cashLedgerEntry: CashLedger = {
        id: finalCashId,
        date: new Date().toISOString().split('T')[0],
        type: 'IN',
        category: 'Pelunasan Pre-Order',
        amount: amountToCollect,
        description: `Pelunasan ${po.orderType} (${po.poNumber || po.id} - ${po.customerName}) No: ${newTx.invoiceNo}`,
        outletId: po.outletId || activeOutlet.id,
        outletName: po.outletName || activeOutlet.name,
        createdBy: user.name,
        paymentMethod: finalPaymentMethod === 'cash' ? 'CASH' : finalPaymentMethod === 'qris' ? 'QRIS' : 'TRANSFER',
        referenceId: newTx.id,
        createdAt: new Date().toISOString(),
      };
      StorageService.addCashLedger(cashLedgerEntry);
    }

    // 3. Mark PreOrder as COMPLETED & PAID
    po.orderStatus = 'COMPLETED';
    po.paymentStatus = 'PAID';
    po.remainingBalance = 0;
    po.finalPaymentMethod = finalPaymentMethod;
    po.finalCashRecordId = finalCashId;
    po.transactionId = newTx.id;
    po.invoiceNo = newTx.invoiceNo;
    po.completedAt = new Date().toISOString();
    po.updatedAt = new Date().toISOString();

    StorageService.savePreOrder(po, false);

    return {
      success: true,
      transaction: txResult.transaction || newTx,
      warnings: txResult.warnings || [],
    };
  },

  deletePreOrder: (id: string) => {
    const list = getItem<PreOrder[]>(KEYS.PRE_ORDERS, initialPreOrders);
    const updated = list.filter((p) => p.id !== id);
    setItem(KEYS.PRE_ORDERS, updated);

    if (shouldSyncToCloud()) {
      deleteDoc(doc(db, 'pre_orders', id)).catch((err) =>
        console.warn('[StorageService] Cloud delete PreOrder error:', err)
      );
    }
  },
};
