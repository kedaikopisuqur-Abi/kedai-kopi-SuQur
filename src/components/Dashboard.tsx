import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Transaction,
  Ingredient,
  Expense,
  Product,
  User,
  Shift,
  Outlet,
  CashLedger,
  CapitalRecord,
  DebtRecord,
  FixedAsset,
  BranchInventoryItem,
  StoreSettings,
} from '../types';
import { formatRp, formatDate, formatWaktuLokal } from '../utils/formatters';
import { StorageService } from '../services/storage';
import { OfflineSyncBanner } from './OfflineSyncBanner';
import { SummaryCards } from './Dashboard/SummaryCards';
import { DailyCupOverheadCard } from './Dashboard/DailyCupOverheadCard';
import { calculateCupUsageAndTargetAnalytics } from '../utils/cupAnalytics';
import { SystemHealthWidget } from './Dashboard/SystemHealthWidget';
import { FirestoreQuotaWidget } from './Dashboard/FirestoreQuotaWidget';
import {
  TrendingUp,
  Receipt,
  Coffee,
  Printer,
  ChevronRight,
  BarChart3,
  Filter,
  Percent,
  UserCheck,
  Clock,
  XCircle,
  HelpCircle,
  X,
  MessageCircle,
  BookOpen,
  ChefHat,
  Activity,
  Building2,
  Store,
  Wallet,
  Landmark,
  Lock,
  MapPin,
  Coins,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  Wrench,
  Boxes,
  Bell,
  ChevronDown,
  ChevronUp,
  CalendarClock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  ingredients: Ingredient[];
  expenses: Expense[];
  products: Product[];
  user?: User;
  activeShift?: Shift | null;
  users?: User[];
  outlets?: Outlet[];
  activeOutlet?: Outlet;
  cashLedgers?: CashLedger[];
  capitalRecords?: CapitalRecord[];
  debtRecords?: DebtRecord[];
  fixedAssets?: FixedAsset[];
  branchInventory?: BranchInventoryItem[];
  onSwitchOutlet?: (outletId: string) => void;
  pendingSyncCount?: number;
  onManualSync?: () => void;
  onOpenReceipt: (tx: Transaction) => void;
  onNavigateTab: (tab: any) => void;
  settings?: StoreSettings;
  onOpenDailyRecap?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  ingredients,
  expenses,
  products,
  user,
  activeShift,
  users = [],
  outlets = [],
  activeOutlet,
  cashLedgers = [],
  capitalRecords = [],
  debtRecords = [],
  fixedAssets = [],
  branchInventory = [],
  onSwitchOutlet,
  pendingSyncCount = 0,
  onManualSync = () => {},
  onOpenReceipt,
  onNavigateTab,
  settings,
  onOpenDailyRecap,
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [hppCategory, setHppCategory] = useState<string>('Semua');
  const [hppSort, setHppSort] = useState<'margin' | 'price' | 'cogs'>('margin');
  const [weeklyChartMode, setWeeklyChartMode] = useState<'omzetLaba' | 'txVolume' | 'itemsSold'>('omzetLaba');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMaintenanceAlertExpanded, setIsMaintenanceAlertExpanded] = useState(true);

  const isAdmin = user?.role === 'admin';

  // Active outlet fallback
  const fallbackOutletId = useMemo(
    () => activeOutlet?.id || user?.assignedOutletId || user?.outletId || (outlets.length > 0 ? outlets[0].id : ''),
    [activeOutlet?.id, user?.assignedOutletId, user?.outletId, outlets]
  );

  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(() => {
    if (isAdmin) {
      return activeOutlet?.id || fallbackOutletId || 'all';
    }
    return fallbackOutletId;
  });

  const effectiveOutletId = isAdmin ? selectedOutletFilter : fallbackOutletId;
  const isConsolidated = effectiveOutletId === 'all';

  const currentOutletObj = useMemo(
    () =>
      outlets.find((o) => o.id === effectiveOutletId) ||
      activeOutlet ||
      outlets[0] || {
        id: 'outlet-lagoa',
        name: 'Cabang Utama',
        address: 'Jl. Lagoa Koja No. 12',
      },
    [outlets, effectiveOutletId, activeOutlet]
  );

  const handleOutletSelectionChange = useCallback(
    (newOutletId: string) => {
      setSelectedOutletFilter(newOutletId);
      if (newOutletId !== 'all' && onSwitchOutlet) {
        onSwitchOutlet(newOutletId);
      }
    },
    [onSwitchOutlet]
  );

  // Category matchers
  const isDrinkCategory = useCallback((cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      c.includes('kopi') ||
      c.includes('minuman') ||
      c.includes('brew') ||
      c.includes('drink') ||
      c.includes('tea') ||
      c.includes('latte')
    );
  }, []);

  const isFoodCategory = useCallback((cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      (c.includes('makanan') || c.includes('main') || c.includes('rice') || c.includes('burger')) &&
      !c.includes('snack') &&
      !c.includes('pastry')
    );
  }, []);

  const isSnackCategory = useCallback((cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      c.includes('snack') ||
      c.includes('pastry') ||
      c.includes('roti') ||
      c.includes('dessert') ||
      c.includes('cemilan')
    );
  }, []);

  // Filtered transactions strictly by outlet with useMemo
  const outletScopedTxs = useMemo(
    () =>
      transactions.filter((tx) => {
        if (tx.status === 'voided') return false;
        if (!isConsolidated && tx.outletId && tx.outletId !== effectiveOutletId) {
          return false;
        }
        return true;
      }),
    [transactions, isConsolidated, effectiveOutletId]
  );

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => now.toISOString().split('T')[0], [now]);

  // Filter by time period
  const filteredTxs = useMemo(() => {
    return outletScopedTxs.filter((tx) => {
      const txDate = new Date(tx.timestamp);
      if (period === 'today') {
        return tx.timestamp.startsWith(todayStr);
      } else if (period === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return txDate >= sevenDaysAgo;
      } else {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      }
    });
  }, [outletScopedTxs, period, todayStr, now]);

  const totalOmzet = useMemo(() => filteredTxs.reduce((acc, t) => acc + t.total, 0), [filteredTxs]);
  const totalHpp = useMemo(() => filteredTxs.reduce((acc, t) => acc + t.totalCogs, 0), [filteredTxs]);
  const grossProfit = useMemo(() => totalOmzet - totalHpp, [totalOmzet, totalHpp]);

  // Filter expenses strictly by outlet & period with useMemo
  const outletScopedExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        if (!isConsolidated && e.outletId && e.outletId !== effectiveOutletId) {
          return false;
        }
        return true;
      }),
    [expenses, isConsolidated, effectiveOutletId]
  );

  const totalExpenses = useMemo(() => {
    return outletScopedExpenses.reduce((acc, e) => {
      const eDate = new Date(e.date);
      if (period === 'today' && e.date === todayStr) return acc + e.amount;
      if (period === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        if (eDate >= sevenDaysAgo) return acc + e.amount;
      }
      if (period === 'month' && eDate.getMonth() === now.getMonth()) return acc + e.amount;
      return acc;
    }, 0);
  }, [outletScopedExpenses, period, todayStr, now]);

  const netProfit = useMemo(() => grossProfit - totalExpenses, [grossProfit, totalExpenses]);

  // Filter Buku Kas (Cash Ledger)
  const outletScopedCashLedger = useMemo(
    () =>
      cashLedgers.filter((cl) => {
        if (!isConsolidated && cl.outletId && cl.outletId !== effectiveOutletId) {
          return false;
        }
        return true;
      }),
    [cashLedgers, isConsolidated, effectiveOutletId]
  );

  const totalCashIn = useMemo(
    () => outletScopedCashLedger.filter((cl) => cl.type === 'IN').reduce((acc, cl) => acc + cl.amount, 0),
    [outletScopedCashLedger]
  );

  const totalCashOut = useMemo(
    () => outletScopedCashLedger.filter((cl) => cl.type === 'OUT').reduce((acc, cl) => acc + cl.amount, 0),
    [outletScopedCashLedger]
  );

  const netCashBalance = useMemo(() => totalCashIn - totalCashOut, [totalCashIn, totalCashOut]);

  // Filter Modal Usaha (Capital Records)
  const outletScopedCapital = useMemo(
    () =>
      capitalRecords.filter((cap) => {
        if (!isConsolidated && cap.outletId && cap.outletId !== effectiveOutletId) {
          return false;
        }
        return true;
      }),
    [capitalRecords, isConsolidated, effectiveOutletId]
  );

  const totalCapitalRecorded = useMemo(
    () => outletScopedCapital.reduce((acc, cap) => acc + cap.amount, 0),
    [outletScopedCapital]
  );

  // Filter Hutang & Piutang (Debt Records)
  const outletScopedDebt = useMemo(
    () =>
      debtRecords.filter((d) => {
        if (!isConsolidated && d.outletId && d.outletId !== effectiveOutletId) {
          return false;
        }
        return true;
      }),
    [debtRecords, isConsolidated, effectiveOutletId]
  );

  const supplierDebts = useMemo(() => outletScopedDebt.filter((d) => d.type === 'DEBT_SUPPLIER'), [outletScopedDebt]);
  const customerReceivables = useMemo(() => outletScopedDebt.filter((d) => d.type === 'RECEIVABLE_CUSTOMER'), [outletScopedDebt]);

  const totalSupplierDebtRemaining = useMemo(
    () => supplierDebts.reduce((acc, d) => acc + d.remainingAmount, 0),
    [supplierDebts]
  );
  const totalCustomerReceivableRemaining = useMemo(
    () => customerReceivables.reduce((acc, d) => acc + d.remainingAmount, 0),
    [customerReceivables]
  );

  const supplierDebtsUnpaidCount = useMemo(
    () => supplierDebts.filter((d) => d.status !== 'PAID').length,
    [supplierDebts]
  );
  const customerReceivablesUnpaidCount = useMemo(
    () => customerReceivables.filter((d) => d.status !== 'PAID').length,
    [customerReceivables]
  );

  const overdueDebtsCount = useMemo(
    () =>
      outletScopedDebt.filter((d) => {
        if (d.status === 'PAID' || !d.dueDate) return false;
        return new Date(d.dueDate) < new Date(todayStr);
      }).length,
    [outletScopedDebt, todayStr]
  );

  // Filter Ingredients & Raw Materials
  const outletScopedIngredients = useMemo(
    () =>
      ingredients.filter((ing) => {
        if (!isConsolidated && ing.outletId && ing.outletId !== effectiveOutletId) {
          return false;
        }
        return true;
      }),
    [ingredients, isConsolidated, effectiveOutletId]
  );

  const lowStockIngredients = useMemo(
    () => outletScopedIngredients.filter((i) => i.currentStock <= i.minStock),
    [outletScopedIngredients]
  );

  const effectiveSettings = useMemo(() => settings || StorageService.getSettings(), [settings]);

  // Analisis Pemakaian Jumlah Cup & Target Harian dari Overhead Operasional
  const cupAnalytics = useMemo(() => {
    const todayScopedTxs = outletScopedTxs.filter((tx) => tx.timestamp.startsWith(todayStr));
    return calculateCupUsageAndTargetAnalytics(
      todayScopedTxs,
      outletScopedIngredients,
      products,
      effectiveSettings
    );
  }, [outletScopedTxs, todayStr, outletScopedIngredients, products, effectiveSettings]);

  // Scoped Fixed Assets
  const outletScopedFixedAssets = useMemo(
    () =>
      fixedAssets.filter((a) => {
        if (!isConsolidated && a.outletId && a.outletId !== effectiveOutletId) {
          return false;
        }
        return true;
      }),
    [fixedAssets, isConsolidated, effectiveOutletId]
  );

  const totalFixedAssetsValue = useMemo(
    () => outletScopedFixedAssets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0),
    [outletScopedFixedAssets]
  );
  const fixedAssetsCount = outletScopedFixedAssets.length;

  const fixedAssetsByCategory = useMemo(
    () => ({
      EQUIPMENT: outletScopedFixedAssets.filter((a) => a.category === 'EQUIPMENT').reduce((sum, a) => sum + a.purchasePrice, 0),
      FURNITURE: outletScopedFixedAssets.filter((a) => a.category === 'FURNITURE').reduce((sum, a) => sum + a.purchasePrice, 0),
      RENOVATION: outletScopedFixedAssets.filter((a) => a.category === 'RENOVATION').reduce((sum, a) => sum + a.purchasePrice, 0),
      OTHER: outletScopedFixedAssets.filter((a) => a.category === 'OTHER').reduce((sum, a) => sum + a.purchasePrice, 0),
    }),
    [outletScopedFixedAssets]
  );

  // Maintenance alert assets
  const maintenanceAlertAssets = useMemo(
    () =>
      outletScopedFixedAssets
        .filter((a) => {
          if (!a.maintenanceReminderEnabled || !a.nextMaintenanceDate) return false;
          const target = new Date(a.nextMaintenanceDate);
          target.setHours(0, 0, 0, 0);
          const curr = new Date(todayStr);
          curr.setHours(0, 0, 0, 0);
          const diffDays = Math.round((target.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 3;
        })
        .map((a) => {
          const target = new Date(a.nextMaintenanceDate!);
          target.setHours(0, 0, 0, 0);
          const curr = new Date(todayStr);
          curr.setHours(0, 0, 0, 0);
          const diffDays = Math.round((target.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));

          let statusLabel = '';
          let statusColor = '';
          let urgency: 'danger' | 'warning' | 'today' = 'warning';

          if (diffDays < 0) {
            statusLabel = `Terlambat ${Math.abs(diffDays)} Hari`;
            statusColor = 'bg-rose-100 text-rose-800 border-rose-200';
            urgency = 'danger';
          } else if (diffDays === 0) {
            statusLabel = 'Jadwal Hari Ini';
            statusColor = 'bg-amber-100 text-amber-800 border-amber-300';
            urgency = 'today';
          } else if (diffDays === 1) {
            statusLabel = 'Besok (1 Hari Lagi)';
            statusColor = 'bg-amber-100 text-amber-800 border-amber-300';
            urgency = 'warning';
          } else {
            statusLabel = `${diffDays} Hari Lagi`;
            statusColor = 'bg-slate-100 text-slate-700 border-slate-200';
            urgency = 'warning';
          }

          return {
            ...a,
            diffDays,
            statusLabel,
            statusColor,
            urgency,
          };
        })
        .sort((a, b) => a.diffDays - b.diffDays),
    [outletScopedFixedAssets, todayStr]
  );

  // Pre-Orders for current outlet & today
  const todayPreOrders = useMemo(() => {
    try {
      const list = StorageService.getPreOrders(effectiveOutletId);
      return list.filter((p) => p.scheduledDate === todayStr && p.orderStatus !== 'CANCELLED');
    } catch {
      return [];
    }
  }, [effectiveOutletId, todayStr]);

  const activeTodayPreOrdersCount = useMemo(
    () => todayPreOrders.filter((p) => p.orderStatus !== 'COMPLETED').length,
    [todayPreOrders]
  );

  // Raw Material Working Capital
  const totalRawMaterialWorkingCapital = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      if (isConsolidated) {
        const branchItems = branchInventory.filter((b) => b.ingredientId === ing.id);
        const totalStock = branchItems.length > 0
          ? branchItems.reduce((bSum, b) => bSum + b.currentStock, 0)
          : ing.currentStock;
        return sum + Math.max(0, totalStock) * ing.costPerUnit;
      } else {
        const branchItem = branchInventory.find((b) => b.outletId === effectiveOutletId && b.ingredientId === ing.id);
        const stock = branchItem ? branchItem.currentStock : (ing.outletId === effectiveOutletId || !ing.outletId ? ing.currentStock : 0);
        return sum + Math.max(0, stock) * ing.costPerUnit;
      }
    }, 0);
  }, [ingredients, isConsolidated, branchInventory, effectiveOutletId]);

  const totalModalUsahaValuation = useMemo(
    () => totalFixedAssetsValue + totalRawMaterialWorkingCapital,
    [totalFixedAssetsValue, totalRawMaterialWorkingCapital]
  );

  // Products & HPP Analysis Memoized
  const hppVsPriceData = useMemo(() => {
    return products
      .filter((p) => {
        if (hppCategory === 'Semua') return true;
        if (hppCategory === 'Minuman') return isDrinkCategory(p.category);
        if (hppCategory === 'Makanan') return isFoodCategory(p.category);
        if (hppCategory === 'Snack') return isSnackCategory(p.category);
        return p.category === hppCategory;
      })
      .map((p) => {
        const profit = Math.max(0, p.price - p.cogs);
        const marginPct = p.price > 0 ? Math.round((profit / p.price) * 100) : 0;
        return {
          id: p.id,
          name: p.name,
          shortName: p.name.length > 14 ? p.name.substring(0, 13) + '…' : p.name,
          category: p.category,
          price: p.price,
          cogs: p.cogs,
          profit,
          marginPct,
        };
      })
      .sort((a, b) => {
        if (hppSort === 'margin') return b.marginPct - a.marginPct;
        if (hppSort === 'price') return b.price - a.price;
        if (hppSort === 'cogs') return b.cogs - a.cogs;
        return 0;
      });
  }, [products, hppCategory, hppSort, isDrinkCategory, isFoodCategory, isSnackCategory]);

  const avgMargin = useMemo(
    () => (hppVsPriceData.length > 0 ? Math.round(hppVsPriceData.reduce((acc, p) => acc + p.marginPct, 0) / hppVsPriceData.length) : 0),
    [hppVsPriceData]
  );

  const topMarginItem = useMemo(
    () => (hppVsPriceData.length > 0 ? [...hppVsPriceData].sort((a, b) => b.marginPct - a.marginPct)[0] : null),
    [hppVsPriceData]
  );

  // Daily Chart Data Memoized
  const chartData = useMemo(() => {
    const chartMap: {
      [key: string]: {
        dateKey: string;
        displayLabel: string;
        fullDateLabel: string;
        dayName: string;
        omzet: number;
        laba: number;
        hpp: number;
        txCount: number;
        itemsSold: number;
      };
    } = {};

    const daysOfWeekIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const shortDaysIndo = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNumStr = String(d.getDate()).padStart(2, '0');
      const isoDateStr = `${year}-${month}-${dayNumStr}`;
      const dayName = daysOfWeekIndo[d.getDay()];
      const shortDay = shortDaysIndo[d.getDay()];
      const monthShort = d.toLocaleDateString('id-ID', { month: 'short' });

      chartMap[isoDateStr] = {
        dateKey: isoDateStr,
        displayLabel: `${shortDay}, ${d.getDate()} ${monthShort}`,
        fullDateLabel: `${dayName}, ${d.getDate()} ${monthShort} ${year}`,
        dayName,
        omzet: 0,
        laba: 0,
        hpp: 0,
        txCount: 0,
        itemsSold: 0,
      };
    }

    outletScopedTxs.forEach((tx) => {
      const dateStr = tx.timestamp.split('T')[0];
      if (chartMap[dateStr]) {
        chartMap[dateStr].omzet += tx.total;
        chartMap[dateStr].hpp += tx.totalCogs;
        chartMap[dateStr].laba += tx.grossProfit;
        chartMap[dateStr].txCount += 1;
        const itemsInTx = tx.items ? tx.items.reduce((sum, it) => sum + it.quantity, 0) : 0;
        chartMap[dateStr].itemsSold += itemsInTx;
      }
    });

    return Object.values(chartMap);
  }, [outletScopedTxs]);

  const weeklyTotalOmzet = useMemo(() => chartData.reduce((acc, c) => acc + c.omzet, 0), [chartData]);
  const weeklyAvgDailyOmzet = useMemo(() => Math.round(weeklyTotalOmzet / 7), [weeklyTotalOmzet]);
  const weeklyTotalTx = useMemo(() => chartData.reduce((acc, c) => acc + c.txCount, 0), [chartData]);
  const weeklyAvgOrderValue = useMemo(
    () => (weeklyTotalTx > 0 ? Math.round(weeklyTotalOmzet / weeklyTotalTx) : 0),
    [weeklyTotalOmzet, weeklyTotalTx]
  );
  const peakDay = useMemo(() => [...chartData].sort((a, b) => b.omzet - a.omzet)[0], [chartData]);

  // Sales by Category & Product
  const { categorySalesWithPct, productSalesList, totalMenuSalesSum } = useMemo(() => {
    const categorySalesMap: { [cat: string]: number } = {};
    const productSalesMap: {
      [prodId: string]: { name: string; category: string; totalSales: number; quantity: number };
    } = {};
    let totalMenuSales = 0;

    filteredTxs.forEach((tx) => {
      tx.items.forEach((item) => {
        totalMenuSales += item.totalPrice;
        const prod = products.find((p) => p.id === item.productId);
        const cat = prod?.category || 'Lainnya';
        categorySalesMap[cat] = (categorySalesMap[cat] || 0) + item.totalPrice;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.productName || prod?.name || 'Produk',
            category: cat,
            totalSales: 0,
            quantity: 0,
          };
        }
        productSalesMap[item.productId].totalSales += item.totalPrice;
        productSalesMap[item.productId].quantity += item.quantity;
      });
    });

    const categoryPieData = Object.entries(categorySalesMap).map(([name, value]) => ({
      name,
      value,
    }));
    const totalCatSales = categoryPieData.reduce((acc, c) => acc + c.value, 0);
    const catSalesWithPct = categoryPieData.map((c) => ({
      ...c,
      percentage: totalCatSales > 0 ? parseFloat(((c.value / totalCatSales) * 100).toFixed(1)) : 0,
    }));

    const prodSalesList = Object.values(productSalesMap)
      .map((item) => ({
        ...item,
        percentage: totalMenuSales > 0 ? parseFloat(((item.totalSales / totalMenuSales) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    return {
      categorySalesWithPct: catSalesWithPct,
      productSalesList: prodSalesList,
      totalMenuSalesSum: totalMenuSales,
    };
  }, [filteredTxs, products]);

  const PIE_COLORS = ['#0f172a', '#d97706', '#059669', '#64748b', '#b45309', '#0284c7', '#e11d48'];

  // Queue info
  const todayTxsWithQueue = useMemo(
    () =>
      outletScopedTxs
        .filter((t) => t.timestamp.startsWith(todayStr) && t.queueNo)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [outletScopedTxs, todayStr]
  );
  const latestTodayTx = todayTxsWithQueue[0];
  const displayQueueNo = latestTodayTx?.queueNo || 'SQ0000';
  const totalQueueToday = todayTxsWithQueue.length;

  const isShiftActiveForOutlet =
    activeShift &&
    (!activeShift.outletId || isConsolidated || activeShift.outletId === effectiveOutletId);

  return (
    <div className="space-y-6 pb-20 md:pb-6 text-slate-800">
      {/* Offline Sync Banner */}
      <OfflineSyncBanner pendingCount={pendingSyncCount} onManualSync={onManualSync} />

      {/* Modern Minimalist Header Card (Slate & Amber) */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-slate-900 px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-2xs border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left Column: Title & Branch Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  {isConsolidated
                    ? 'Dasbor Semua Cabang'
                    : `Dasbor: ${currentOutletObj?.name || 'Cabang Aktif'}`}
                </h1>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  {isConsolidated ? (
                    <>
                      <Building2 className="w-3 h-3" />
                      <span>Konsolidasi ({outlets.length})</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span>{currentOutletObj?.name}</span>
                    </>
                  )}
                </div>
                {isAdmin ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-amber-200 text-[10px] font-bold border border-slate-700">
                    Admin Pusat
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                    <Lock className="w-2.5 h-2.5 text-emerald-400" />
                    Kasir Cabang
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {isConsolidated
                  ? `Menggabungkan data operasional ${outlets.length} cabang Su-Qur POS.`
                  : `📍 ${currentOutletObj?.address || 'Lokasi Outlet'}`}
              </p>
            </div>
          </div>

          {/* Right Column: Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin ? (
              <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={selectedOutletFilter}
                  onChange={(e) => handleOutletSelectionChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">
                    Semua Cabang ({outlets.length})
                  </option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id} className="bg-slate-900 text-white">
                      {o.name} {o.id === activeOutlet?.id ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span className="text-xs font-bold text-white">{currentOutletObj?.name}</span>
              </div>
            )}

            {/* Guide Button */}
            <button
              onClick={() => setIsGuideOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              title="Petunjuk & Panduan Sistem"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Panduan</span>
            </button>

            {/* Period Selector Tabs */}
            <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setPeriod('today')}
                className={`px-2 py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  period === 'today' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setPeriod('week')}
                className={`px-2 py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  period === 'week' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Hari
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={`px-2 py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  period === 'month' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bulan Ini
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Maintenance Notification Alert (Admin Only) */}
      {isAdmin && maintenanceAlertAssets.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-slate-900 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                  Jadwal Servis Aset ({maintenanceAlertAssets.length} Peralatan)
                </h3>
                <p className="text-[10.5px] text-slate-600">Perlu perawatan rutin SOP berkala.</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMaintenanceAlertExpanded(!isMaintenanceAlertExpanded)}
                className="px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>{isMaintenanceAlertExpanded ? 'Ciutkan' : 'Lihat'}</span>
                {isMaintenanceAlertExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('cash_debt')}
                className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Wrench className="w-3 h-3 text-amber-400" />
                <span>Buku Aset</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isMaintenanceAlertExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1"
              >
                {maintenanceAlertAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-white rounded-lg p-2.5 border border-amber-200 shadow-2xs space-y-1"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{asset.assetName}</h4>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${asset.statusColor}`}>
                        {asset.statusLabel}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-slate-500 font-medium">
                      Jadwal: {formatDate(asset.nextMaintenanceDate!)} • {asset.outletName || asset.outletId}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Live Queue & Outlet Monitoring */}
      <div className="bg-white rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-mono font-bold text-base shrink-0">
            #
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
                Antrian Kasir:
              </span>
              <span className="text-base sm:text-lg font-mono font-black text-slate-900">{displayQueueNo}</span>
              {latestTodayTx && (
                <span className="text-xs text-slate-500 font-medium truncate max-w-[150px]">
                  ({latestTodayTx.customerName || 'Pelanggan'})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
          <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-[10px] text-slate-500 font-bold">
              Selesai Hari Ini: <span className="text-slate-900 font-black">{totalQueueToday}</span>
            </span>
          </div>

          <button
            onClick={() => onNavigateTab('pre_order')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTodayPreOrdersCount > 0
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CalendarClock className="w-3 h-3" />
            <span>Pre-Order</span>
            {activeTodayPreOrdersCount > 0 && (
              <span className="bg-white text-amber-800 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {activeTodayPreOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigateTab('pos')}
            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <ChefHat className="w-3 h-3 text-amber-400" />
            <span>Buka Kasir</span>
          </button>
        </div>
      </div>

      {/* Cashier Shift Status (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isShiftActiveForOutlet
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs text-slate-900">Shift Kasir: {currentOutletObj?.name}</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${
                    isShiftActiveForOutlet ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isShiftActiveForOutlet ? 'Shift Aktif' : 'Shift Non-Aktif'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Kasir: {activeShift?.cashierName || users.find((u) => u.role === 'kasir')?.name || 'Siti (Kasir)'}
              </p>
            </div>
          </div>

          {isShiftActiveForOutlet && activeShift && (
            <div className="flex items-center gap-3 text-xs">
              <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Buka Shift</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-600" /> {formatWaktuLokal(activeShift.startTime)}
                </span>
              </div>
              <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Modal Awal</span>
                <span className="font-bold text-slate-800">{formatRp(activeShift.startCash)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Health Widget (Khusus Admin) */}
      {isAdmin && (
        <SystemHealthWidget activeOutletId={currentOutletObj?.id} onRefreshData={onManualSync} />
      )}

      {/* Real-time Operational API Quota Indicator (Khusus Admin) */}
      {isAdmin && <FirestoreQuotaWidget />}

      {/* Target Pemakaian Cup Harian dari Overhead Operasional Card (Khusus Admin Saja) */}
      {isAdmin && (
        <DailyCupOverheadCard
          analytics={cupAnalytics}
          onOpenDailyRecap={onOpenDailyRecap}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* Summary Cards */}
      <SummaryCards
        transactions={outletScopedTxs}
        filteredTxs={filteredTxs}
        expenses={outletScopedExpenses}
        products={products}
        ingredients={outletScopedIngredients}
        user={user}
        period={period}
        onNavigateTab={onNavigateTab}
      />

      {/* Capital Structure & Business Valuation (Admin Only) */}
      {isAdmin && (
        <div className="bg-slate-900 rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-2xs border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-sm font-bold text-white tracking-tight">
                    Total Modal Usaha
                  </h2>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9.5px] font-bold uppercase">
                    Valuasi
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    • {isConsolidated ? 'Semua Cabang' : currentOutletObj?.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
              <button
                onClick={() => onNavigateTab('cash_debt')}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <Wrench className="w-3 h-3" />
                <span>Aset Tetap</span>
              </button>
              <button
                onClick={() => onNavigateTab('inventory')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Boxes className="w-3 h-3 text-amber-400" />
                <span>Stok Bahan</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Total Capitalization */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Modal Usaha</div>
              <div className="text-lg sm:text-xl font-black text-amber-400">{formatRp(totalModalUsahaValuation)}</div>
              <div className="text-[10.5px] text-slate-400 pt-1 border-t border-slate-700/50 flex justify-between">
                <span>Setoran Masuk:</span>
                <span className="font-bold text-white">{formatRp(totalCapitalRecorded)}</span>
              </div>
            </div>

            {/* Fixed Assets */}
            <div
              onClick={() => onNavigateTab('cash_debt')}
              className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 p-3 rounded-xl border border-slate-700 transition-all space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Nilai Aset Tetap</span>
                <span className="text-[9.5px] bg-slate-700 text-amber-300 px-1 py-0.2 rounded font-bold">
                  {fixedAssetsCount} Item
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white">{formatRp(totalFixedAssetsValue)}</div>
              <div className="text-[10.5px] text-amber-300 pt-1 border-t border-slate-700/50 flex justify-between">
                <span>Rasio Modal:</span>
                <span className="font-bold">
                  {totalModalUsahaValuation > 0
                    ? `${Math.round((totalFixedAssetsValue / totalModalUsahaValuation) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>

            {/* Raw Material Inventory */}
            <div
              onClick={() => onNavigateTab('inventory')}
              className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 p-3 rounded-xl border border-slate-700 transition-all space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Modal Kerja Stok</span>
                <span className="text-[9.5px] bg-slate-700 text-emerald-300 px-1 py-0.2 rounded font-bold">
                  {ingredients.length} Bahan
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white">{formatRp(totalRawMaterialWorkingCapital)}</div>
              <div className="text-[10.5px] text-emerald-300 pt-1 border-t border-slate-700/50 flex justify-between">
                <span>Rasio Modal:</span>
                <span className="font-bold">
                  {totalModalUsahaValuation > 0
                    ? `${Math.round((totalRawMaterialWorkingCapital / totalModalUsahaValuation) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Ledger & Debt Summary */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-slate-600" />
            <span>Buku Kas & Hutang ({currentOutletObj?.name})</span>
          </h2>
          <button
            onClick={() => onNavigateTab('cash_debt')}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <span>Kelola Kas & Hutang</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Net Cash Balance */}
          <div
            onClick={() => onNavigateTab('cash_debt')}
            className="cursor-pointer bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all space-y-1"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Saldo Kas Bersih</span>
              <Landmark className="w-3 h-3 text-slate-500" />
            </div>
            <div className={`text-base sm:text-lg font-black ${netCashBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {formatRp(netCashBalance)}
            </div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
              <span>Masuk: {formatRp(totalCashIn)}</span>
              <span>Keluar: {formatRp(totalCashOut)}</span>
            </div>
          </div>

          {/* Card 2: Modal Records */}
          <div
            onClick={() => onNavigateTab('cash_debt')}
            className="cursor-pointer bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all space-y-1"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Total Modal Masuk</span>
              <Coins className="w-3 h-3 text-slate-500" />
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900">{formatRp(totalCapitalRecorded)}</div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
              <span>{outletScopedCapital.length} Rekaman</span>
              <span className="text-emerald-700 font-semibold">Tercatat Aktif</span>
            </div>
          </div>

          {/* Card 3: Supplier Debt */}
          <div
            onClick={() => onNavigateTab('cash_debt')}
            className="cursor-pointer bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all space-y-1"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Hutang Supplier</span>
              <CreditCard className="w-3 h-3 text-slate-500" />
            </div>
            <div className={`text-base sm:text-lg font-black ${totalSupplierDebtRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatRp(totalSupplierDebtRemaining)}
            </div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
              <span>{supplierDebtsUnpaidCount} Faktur</span>
              <span className={overdueDebtsCount > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}>
                {overdueDebtsCount > 0 ? `${overdueDebtsCount} Terlambat` : 'Aman'}
              </span>
            </div>
          </div>

          {/* Card 4: Customer Receivables */}
          <div
            onClick={() => onNavigateTab('cash_debt')}
            className="cursor-pointer bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all space-y-1"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Piutang Bon Pelanggan</span>
              <Receipt className="w-3 h-3 text-slate-500" />
            </div>
            <div className="text-base sm:text-lg font-black text-amber-700">{formatRp(totalCustomerReceivableRemaining)}</div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
              <span>{customerReceivablesUnpaidCount} Pelanggan</span>
              <span className="text-slate-700 font-semibold">Penagihan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Trend Chart & Stock Alert / Category Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Trend Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-700" />
                  <span>Tren Penjualan 7 Hari</span>
                </h3>
                <p className="text-[10.5px] text-slate-500 font-medium">Performa omzet & laba kotor harian</p>
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                <button
                  onClick={() => setWeeklyChartMode('omzetLaba')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    weeklyChartMode === 'omzetLaba' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Omzet & Laba
                </button>
                <button
                  onClick={() => setWeeklyChartMode('txVolume')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    weeklyChartMode === 'txVolume' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Transaksi
                </button>
                <button
                  onClick={() => setWeeklyChartMode('itemsSold')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    weeklyChartMode === 'itemsSold' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Porsi
                </button>
              </div>
            </div>

            {/* Quick KPI Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Total Omzet (7hr)</span>
                <span className="text-xs font-black text-slate-900">{formatRp(weeklyTotalOmzet)}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Rata-rata/Hari</span>
                <span className="text-xs font-black text-slate-900">{formatRp(weeklyAvgDailyOmzet)}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Hari Puncak</span>
                <span className="text-xs font-black text-emerald-700 truncate block">
                  {peakDay && peakDay.omzet > 0 ? peakDay.dayName : '-'}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Rata-rata/Nota</span>
                <span className="text-xs font-black text-slate-900">{formatRp(weeklyAvgOrderValue)}</span>
              </div>
            </div>
          </div>

          {/* Chart View */}
          <div className="h-48 sm:h-52 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              {weeklyChartMode === 'omzetLaba' ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOmzet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLaba" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="displayLabel" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1">
                            <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                              {d.fullDateLabel}
                            </p>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Omzet:</span>
                              <span className="font-bold text-amber-400">{formatRp(d.omzet)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Laba:</span>
                              <span className="font-bold text-emerald-400">{formatRp(d.laba)}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800">
                              <span>Volume:</span>
                              <span>{d.txCount} Transaksi ({d.itemsSold} Porsi)</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="omzet"
                    name="Omzet"
                    stroke="#0f172a"
                    fillOpacity={1}
                    fill="url(#colorOmzet)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="laba"
                    name="Laba Kotor"
                    stroke="#d97706"
                    fillOpacity={1}
                    fill="url(#colorLaba)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : weeklyChartMode === 'txVolume' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="displayLabel" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                  <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-0.5">
                            <p className="font-bold text-slate-200">{d.fullDateLabel}</p>
                            <p className="text-amber-400 font-bold">{d.txCount} Transaksi</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="txCount" name="Transaksi" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="displayLabel" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                  <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-0.5">
                            <p className="font-bold text-slate-200">{d.fullDateLabel}</p>
                            <p className="text-amber-400 font-bold">{d.itemsSold} Porsi Terjual</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="itemsSold" name="Porsi" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side Column: Low Stock & Category Breakdown */}
        <div className="space-y-3">
          {/* Low Stock Warning Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Stok Kritis ({currentOutletObj?.name})</span>
              </h3>
              <button
                onClick={() => onNavigateTab('inventory')}
                className="text-[10px] text-amber-700 font-bold hover:underline"
              >
                Kelola
              </button>
            </div>

            {lowStockIngredients.length === 0 ? (
              <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 font-medium">
                Semua stok bahan baku aman.
              </div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                {lowStockIngredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-[11px] truncate">{ing.name}</p>
                      <p className="text-[9.5px] text-slate-400">Min: {ing.minStock} {ing.unit}</p>
                    </div>
                    <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[9.5px] font-black rounded shrink-0">
                      {ing.currentStock} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category Sales Distribution */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-900">Distribusi Menu</h3>
              <span className="text-[9.5px] font-bold text-slate-500">Total: {formatRp(totalMenuSalesSum)}</span>
            </div>

            {categorySalesWithPct.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">Belum ada transaksi</div>
            ) : (
              <div className="space-y-2">
                <div className="h-28 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySalesWithPct}
                        cx="50%"
                        cy="50%"
                        innerRadius={24}
                        outerRadius={44}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categorySalesWithPct.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${formatRp(Number(val))} (${item.payload.percentage}%)`,
                          'Penjualan',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap gap-1">
                  {categorySalesWithPct.map((cat, idx) => (
                    <div
                      key={cat.name}
                      className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded text-[9.5px] border border-slate-200"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="font-bold text-slate-700">{cat.name}:</span>
                      <span className="text-slate-500">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HPP vs Price Analysis (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-slate-700" />
                <span>Analisis HPP vs Harga Jual Per Menu</span>
              </h3>
              <p className="text-[10.5px] text-slate-500 font-medium">Modal bahan vs harga jual & profit margin</p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                {['Semua', 'Minuman', 'Makanan', 'Snack'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setHppCategory(cat)}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      hppCategory === cat ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 text-[11px]">
                <Filter className="w-3 h-3 text-slate-400" />
                <select
                  value={hppSort}
                  onChange={(e) => setHppSort(e.target.value as any)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-[11px]"
                >
                  <option value="margin">Margin %</option>
                  <option value="price">Harga Jual</option>
                  <option value="cogs">HPP Modal</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[9.5px] font-bold uppercase text-slate-400">Rata-rata Margin</span>
                <div className="text-base sm:text-lg font-black text-slate-900">{avgMargin}%</div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700">
                <Percent className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9.5px] font-bold uppercase text-slate-400">Margin Tertinggi</span>
                <div className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                  {topMarginItem ? topMarginItem.name : '-'}
                </div>
                {topMarginItem && (
                  <div className="text-[9.5px] font-bold text-emerald-700">{topMarginItem.marginPct}% Margin</div>
                )}
              </div>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[9.5px] font-bold uppercase text-slate-400">Total Menu</span>
                <div className="text-base sm:text-lg font-black text-slate-900">{hppVsPriceData.length} Menu</div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700">
                <Coffee className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div className="h-48 sm:h-52 w-full pt-1">
            {hppVsPriceData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Tidak ada data menu
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hppVsPriceData} margin={{ top: 10, right: 10, left: 0, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="shortName" stroke="#94a3b8" fontSize={9.5} fontWeight="bold" angle={-15} textAnchor="end" />
                  <YAxis stroke="#94a3b8" fontSize={9.5} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1">
                            <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{d.name}</p>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Harga:</span>
                              <span className="font-bold text-emerald-400">{formatRp(d.price)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">HPP:</span>
                              <span className="font-bold text-amber-400">{formatRp(d.cogs)}</span>
                            </div>
                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Margin:</span>
                              <span className="font-bold text-emerald-400">{d.marginPct}% ({formatRp(d.profit)})</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '6px', fontSize: '10.5px', fontWeight: 'bold' }}
                    formatter={(value) => <span className="text-slate-700 font-bold mx-1">{value}</span>}
                  />
                  <Bar dataKey="price" name="Harga Jual" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="cogs" name="HPP Modal" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions List */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900">Transaksi Terakhir ({currentOutletObj?.name})</h3>
            <p className="text-[10.5px] text-slate-500 font-medium">Transaksi kasir terbaru di cabang ini</p>
          </div>
          <button
            onClick={() => onNavigateTab('reports')}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer"
          >
            Laporan Lengkap <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[9.5px] tracking-wider">
              <tr>
                <th className="py-2 px-2.5 rounded-l-lg">Antrian</th>
                <th className="py-2 px-2.5">Faktur</th>
                <th className="py-2 px-2.5">Waktu</th>
                <th className="py-2 px-2.5">Kasir</th>
                <th className="py-2 px-2.5">Pelanggan</th>
                <th className="py-2 px-2.5">Metode</th>
                <th className="py-2 px-2.5">Total</th>
                <th className="py-2 px-2.5 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-slate-400 text-xs">
                    Belum ada transaksi tercatat pada periode ini.
                  </td>
                </tr>
              ) : (
                filteredTxs.slice(0, 5).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2.5 font-mono font-bold text-amber-700">
                      {tx.queueNo || '-'}
                    </td>
                    <td className="py-2 px-2.5 font-bold text-slate-900">{tx.invoiceNo}</td>
                    <td className="py-2 px-2.5 text-slate-500 text-[11px]">{formatDate(tx.timestamp)}</td>
                    <td className="py-2 px-2.5 text-slate-600">{tx.cashierName}</td>
                    <td className="py-2 px-2.5 text-slate-800 font-medium">{tx.customerName || '-'}</td>
                    <td className="py-2 px-2.5">
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded uppercase text-[9.5px] font-bold">
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-black text-slate-900">{formatRp(tx.total)}</td>
                    <td className="py-2 px-2.5 text-right">
                      <button
                        onClick={() => onOpenReceipt(tx)}
                        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md border border-slate-200 transition-all cursor-pointer"
                      >
                        <Printer className="w-2.5 h-2.5" /> Struk
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guide Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl flex flex-col text-slate-800">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Panduan Cepat Kasir</h3>
              </div>
              <button onClick={() => setIsGuideOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs leading-relaxed">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Printer className="w-4 h-4 text-amber-600" />
                  <span>1. Pencetakan Struk Thermal</span>
                </div>
                <p className="text-slate-600 pl-5">
                  Pastikan printer Bluetooth/USB tersambung. Pilih ukuran 58mm atau 80mm di menu Pengaturan.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  <span>2. Pencatatan Kas & Hutang</span>
                </div>
                <p className="text-slate-600 pl-5">
                  Catat mutasi kas harian, hutang supplier, dan piutang bon pelanggan langsung per cabang aktif.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>3. Kirim Struk via WhatsApp</span>
                </div>
                <p className="text-slate-600 pl-5">
                  Kirim struk digital atau rekap transaksi harian ke nomor WhatsApp pelanggan atau owner.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsGuideOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
