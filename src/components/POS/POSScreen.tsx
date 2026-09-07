import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Product,
  CartItem,
  ProductVariant,
  PaymentMethod,
  OrderType,
  Transaction,
  User,
  StoreSettings,
  Ingredient,
} from '../../types';
import { formatRp, formatThermalReceipt } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { openCashDrawer, printReceiptThermal } from '../../services/thermalPrinterService';
import { syncTransactionToGoogleSheet } from '../../services/googleSheetService';
import { playSuccessSound } from '../../utils/audio';
import { buildCustomerSelfOrderUrl } from '../../utils/publicUrlHelper';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  QrCode,
  Banknote,
  CreditCard,
  User as UserIcon,
  Tag,
  Coffee,
  Utensils,
  Cookie,
  Grid,
  List,
  LayoutGrid,
  X,
  Sparkles,
  Flame,
  Check,
  Printer,
  Eye,
  Bike,
  Bookmark,
  CalendarClock,
  AlertCircle,
  DollarSign,
  Smartphone,
} from 'lucide-react';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { ManualOnlineOrderModal } from './ManualOnlineOrderModal';
import { PendingQROrdersModal } from './PendingQROrdersModal';
import { QRCodeGeneratorModal } from '../QR/QRCodeGeneratorModal';
import { QuickTableQRModal } from './QuickTableQRModal';
import { HoldBillModal } from './HoldBillModal';
import { DraftOrdersModal } from './DraftOrdersModal';
import { CreatePreOrderModal } from './CreatePreOrderModal';

interface POSScreenProps {
  products: Product[];
  ingredients: Ingredient[];
  user: User;
  settings: StoreSettings;
  onCompleteTransaction: (tx: Transaction) => { success: boolean; warnings: string[]; transaction?: Transaction };
  onOpenReceipt: (tx: Transaction) => void;
  onOpenQRIS: (tx: Transaction) => void;
  isFocusMode?: boolean;
}

export const POSScreen: React.FC<POSScreenProps> = ({
  products,
  ingredients,
  user,
  settings,
  onCompleteTransaction,
  onOpenReceipt,
  onOpenQRIS,
  isFocusMode = false,
}) => {
  const isAdmin = user?.role === 'admin';

  // State for search and active filters
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [productViewMode, setProductViewMode] = useState<'row' | 'grid'>(() => {
    try {
      return (localStorage.getItem('suqur_pos_product_view') as 'row' | 'grid') || 'row';
    } catch {
      return 'row';
    }
  });

  // Cart state initialized safely from storage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return StorageService.getCartDraft() || [];
    } catch {
      return [];
    }
  });

  const [customerName, setCustomerName] = useState<string>('');
  const [tableNo, setTableNo] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percent' | 'nominal'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Safe sync cart to storage
  useEffect(() => {
    try {
      StorageService.saveCartDraft(cart);
    } catch (err) {
      console.warn('[POSScreen] Error persisting cart draft:', err);
    }
  }, [cart]);

  // Feedback states
  const [lastAddedProdId, setLastAddedProdId] = useState<string | null>(null);
  const [cartPulse, setCartPulse] = useState<boolean>(false);
  const [addToast, setAddToast] = useState<{ name: string; price: number } | null>(null);

  // Variant Modal State
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [selectedCup, setSelectedCup] = useState<'14oz' | '16oz' | '18oz' | '22oz' | undefined>('16oz');
  const [selectedIce, setSelectedIce] = useState<'Pakai Es' | 'Tanpa Es' | undefined>('Pakai Es');
  const [itemNotes, setItemNotes] = useState<string>('');

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutWarning, setCheckoutWarning] = useState<string | null>(null);

  // Online Order States
  const [checkoutOrderType, setCheckoutOrderType] = useState<OrderType>('dine_in');
  const [checkoutOnlinePlatform, setCheckoutOnlinePlatform] = useState<'ShopeeFood' | 'GoFood' | 'GrabFood' | 'Lainnya'>('ShopeeFood');
  const [checkoutOnlineOrderNo, setCheckoutOnlineOrderNo] = useState<string>('');
  const [checkoutDriverName, setCheckoutDriverName] = useState<string>('');

  // Aux Modals
  const [isOnlineOrderModalOpen, setIsOnlineOrderModalOpen] = useState<boolean>(false);
  const [isPendingQRModalOpen, setIsPendingQRModalOpen] = useState<boolean>(false);
  const [isQRGenModalOpen, setIsQRGenModalOpen] = useState<boolean>(false);
  const [isQuickQRModalOpen, setIsQuickQRModalOpen] = useState<boolean>(false);
  const [linkCopiedToast, setLinkCopiedToast] = useState<boolean>(false);
  const [pendingQRCount, setPendingQRCount] = useState<number>(0);
  const [isHoldBillModalOpen, setIsHoldBillModalOpen] = useState<boolean>(false);
  const [isDraftOrdersModalOpen, setIsDraftOrdersModalOpen] = useState<boolean>(false);
  const [activeDraftsCount, setActiveDraftsCount] = useState<number>(0);
  const [activeLoadedDraftId, setActiveLoadedDraftId] = useState<string | null>(null);
  const [isCreatePOModalOpen, setIsCreatePOModalOpen] = useState<boolean>(false);
  const [draftPreviewTx, setDraftPreviewTx] = useState<Transaction | null>(null);

  // Active cashier outlet & default self-order link
  const activeCashierOutlet = useMemo(() => {
    const allOutlets = StorageService.getOutlets();
    if (user.role === 'kasir' && user.outletId) {
      return allOutlets.find((o) => o.id === user.outletId) || allOutlets[0];
    }
    return StorageService.getActiveOutlet() || allOutlets[0];
  }, [user]);

  const defaultSelfOrderUrl = useMemo(() => {
    const outletId = activeCashierOutlet?.id || 'outlet-lagoa';
    return buildCustomerSelfOrderUrl(outletId, 'Meja 01', settings);
  }, [settings, activeCashierOutlet]);

  const handleQuickCopyOrderLink = async () => {
    try {
      await navigator.clipboard.writeText(defaultSelfOrderUrl);
      setLinkCopiedToast(true);
      setTimeout(() => setLinkCopiedToast(false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Real-time draft and QR counters
  useEffect(() => {
    const updateCounters = () => {
      try {
        const outletId = user.role === 'kasir' ? user.outletId : undefined;
        const drafts = StorageService.getDraftOrders(outletId);
        const newDraftsCount = drafts.filter((d) => d.status === 'DRAFT').length;
        setActiveDraftsCount((prev) => (prev !== newDraftsCount ? newDraftsCount : prev));

        const pendingList = StorageService.getPendingQROrders(outletId);
        const newQRCount = pendingList.length;
        setPendingQRCount((prev) => (prev !== newQRCount ? newQRCount : prev));
      } catch (err) {
        console.warn('[POSScreen] Counter update error:', err);
      }
    };

    updateCounters();
    const handleQrPush = () => updateCounters();
    window.addEventListener('realtime_qr_order_pushed', handleQrPush);
    const interval = setInterval(updateCounters, 10000);
    return () => {
      window.removeEventListener('realtime_qr_order_pushed', handleQrPush);
      clearInterval(interval);
    };
  }, [user]);

  // Category identification helpers
  const isDrinkCategory = useCallback((cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      c.includes('kopi') ||
      c.includes('minuman') ||
      c.includes('brew') ||
      c.includes('drink') ||
      c.includes('tea') ||
      c.includes('latte') ||
      c.includes('beverage')
    );
  }, []);

  const isFoodCategory = useCallback((cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      (c.includes('makanan') || c.includes('main') || c.includes('meal') || c.includes('rice') || c.includes('burger') || c.includes('dapur')) &&
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
      c.includes('cemilan') ||
      c.includes('kue')
    );
  }, []);

  const matchesCategory = useCallback(
    (product: Product, selected: string) => {
      if (selected === 'Semua') return true;
      if (selected === 'Minuman') return isDrinkCategory(product.category);
      if (selected === 'Makanan') return isFoodCategory(product.category);
      if (selected === 'Snack') return isSnackCategory(product.category);
      return product.category === selected;
    },
    [isDrinkCategory, isFoodCategory, isSnackCategory]
  );

  // Main Category Tabs
  const mainCategories = useMemo(
    () => [
      { id: 'Semua', label: 'Semua Menu', icon: Grid },
      { id: 'Minuman', label: 'Minuman', icon: Coffee },
      { id: 'Makanan', label: 'Makanan', icon: Utensils },
      { id: 'Snack', label: 'Snack & Pastry', icon: Cookie },
    ],
    []
  );

  // Extract unique specific categories
  const specificCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    for (let i = 0; i < products.length; i++) {
      if (products[i].category) categoriesSet.add(products[i].category);
    }
    return Array.from(categoriesSet).filter(
      (cat) => !['Semua', 'Minuman', 'Makanan', 'Snack'].includes(cat)
    );
  }, [products]);

  // Pre-calculate category counts in single pass O(N)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Semua: products.length,
      Minuman: 0,
      Makanan: 0,
      Snack: 0,
    };

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (isDrinkCategory(p.category)) counts.Minuman++;
      if (isFoodCategory(p.category)) counts.Makanan++;
      if (isSnackCategory(p.category)) counts.Snack++;
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    }
    return counts;
  }, [products, isDrinkCategory, isFoodCategory, isSnackCategory]);

  const getCategoryCount = useCallback(
    (catId: string) => categoryCounts[catId] || 0,
    [categoryCounts]
  );

  // Top Selling Products
  const topSellingProducts = useMemo(() => products.slice(0, 5), [products]);

  // Filtered Products Memoized
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (!matchesCategory(p, selectedCategory)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [products, selectedCategory, searchQuery, matchesCategory]);

  // Add Item to Cart Callback
  const addToCart = useCallback(
    (
      prod: Product,
      variant?: ProductVariant,
      notes?: string,
      cup?: '14oz' | '16oz' | '18oz' | '22oz',
      ice?: 'Pakai Es' | 'Tanpa Es'
    ) => {
      let priceAdjustment = variant ? variant.priceAdjustment : 0;
      if (!variant && cup) {
        if (cup === '14oz') priceAdjustment = -1000;
        else if (cup === '18oz') priceAdjustment = 1000;
        else if (cup === '22oz') priceAdjustment = 2000;
      }

      const unitPrice = prod.price + priceAdjustment;
      const cogsAdjustment = variant?.cogsAdjustment || 0;
      const unitCogs = prod.cogs + cogsAdjustment;
      const finalNotes = notes?.trim() || '';

      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex(
          (c) =>
            c.product.id === prod.id &&
            c.selectedVariant?.id === variant?.id &&
            c.selectedCup === cup &&
            c.selectedIce === ice &&
            c.notes === finalNotes
        );

        if (existingIndex !== -1) {
          const updated = [...prevCart];
          const newQty = updated[existingIndex].quantity + 1;
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: newQty,
            totalPrice: newQty * unitPrice,
            cogsTotal: newQty * unitCogs,
          };
          return updated;
        } else {
          const newItem: CartItem = {
            product: prod,
            quantity: 1,
            selectedVariant: variant,
            selectedCup: cup,
            selectedIce: ice,
            notes: finalNotes,
            unitPrice,
            totalPrice: unitPrice,
            cogsTotal: unitCogs,
          };
          return [...prevCart, newItem];
        }
      });

      // Feedback Toast
      let toastTitle = prod.name;
      if (cup) toastTitle += ` (${cup})`;
      else if (variant) toastTitle += ` (${variant.name})`;

      setLastAddedProdId(prod.id);
      setCartPulse(true);
      setAddToast({ name: toastTitle, price: unitPrice });

      setTimeout(() => setCartPulse(false), 300);
      setTimeout(() => setLastAddedProdId(null), 1000);
      setTimeout(() => setAddToast(null), 1400);

      setVariantProduct(null);
    },
    []
  );

  // Handle Product Card Click
  const handleProductClick = useCallback(
    (prod: Product) => {
      const isDrink = isDrinkCategory(prod.category) || (prod.category !== 'Pastry & Snack' && prod.category !== 'Makanan Utama');
      const hasVariants = prod.variants && prod.variants.length > 0;
      const hasCupOpts = prod.cupOptions && prod.cupOptions.length > 0;
      const hasIceOpt = prod.hasIceOption ?? isDrink;

      if (hasVariants || hasCupOpts || hasIceOpt || isDrink) {
        setVariantProduct(prod);
        const initialCup = prod.cupOptions && prod.cupOptions.length > 0 ? prod.cupOptions[0] : (isDrink ? '16oz' : undefined);
        setSelectedCup(initialCup);
        setSelectedIce(hasIceOpt ? 'Pakai Es' : undefined);

        const initialVariant = prod.variants?.find((v) => initialCup && v.name.includes(initialCup)) || prod.variants?.[0];
        setSelectedVariant(initialVariant);
        setItemNotes('');
      } else {
        addToCart(prod, undefined, '', undefined, undefined);
      }
    },
    [isDrinkCategory, addToCart]
  );

  // Update Cart Quantity
  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = {
          ...updated[index],
          quantity: newQty,
          totalPrice: newQty * updated[index].unitPrice,
          cogsTotal: newQty * updated[index].product.cogs,
        };
      }
      return updated;
    });
  }, []);

  // Financial calculations memoized
  const subtotal = useMemo(() => cart.reduce((acc, c) => acc + c.totalPrice, 0), [cart]);
  const totalCogs = useMemo(() => cart.reduce((acc, c) => acc + c.cogsTotal, 0), [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.round((subtotal * Math.min(100, Math.max(0, discountValue))) / 100);
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const netSellingPrice = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const grossProfit = useMemo(() => netSellingPrice - totalCogs, [netSellingPrice, totalCogs]);
  const grossProfitMargin = useMemo(
    () => (netSellingPrice > 0 ? Math.round((grossProfit / netSellingPrice) * 100) : 0),
    [grossProfit, netSellingPrice]
  );

  const taxAmount = useMemo(
    () => (settings.taxPercentage > 0 ? Math.round(netSellingPrice * (settings.taxPercentage / 100)) : 0),
    [netSellingPrice, settings.taxPercentage]
  );

  const grandTotal = useMemo(() => Math.max(0, netSellingPrice + taxAmount), [netSellingPrice, taxAmount]);
  const cashGivenNum = useMemo(() => parseFloat(cashGiven) || 0, [cashGiven]);
  const changeAmount = useMemo(() => Math.max(0, cashGivenNum - grandTotal), [cashGivenNum, grandTotal]);

  // Draft Print Preview Handler
  const handleOpenDraftPreview = useCallback(() => {
    if (cart.length === 0) return;
    const nowIso = new Date().toISOString();
    const isOnline =
      checkoutOrderType === 'online_delivery' ||
      ['shopeefood', 'gofood', 'grabfood'].includes(paymentMethod);

    const platform =
      paymentMethod === 'shopeefood'
        ? 'ShopeeFood'
        : paymentMethod === 'gofood'
        ? 'GoFood'
        : paymentMethod === 'grabfood'
        ? 'GrabFood'
        : checkoutOnlinePlatform;

    const draftTx: Transaction = {
      id: 'draft-' + Date.now(),
      invoiceNo: `DRAFT-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: nowIso,
      cashierId: user.id,
      cashierName: user.name,
      customerName: customerName.trim() || (isOnline ? `Pelanggan ${platform}` : 'Pelanggan Walk-in'),
      ...(tableNo.trim() ? { tableNo: tableNo.trim() } : {}),
      orderType: isOnline ? 'online_delivery' : checkoutOrderType,
      onlinePlatform: isOnline ? platform : undefined,
      onlineOrderNo: isOnline ? (checkoutOnlineOrderNo.trim() || `${platform === 'ShopeeFood' ? 'SF' : 'GF'}-DRAFT`) : undefined,
      driverName: isOnline && checkoutDriverName.trim() ? checkoutDriverName.trim() : undefined,
      items: cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        ...(c.selectedVariant?.name ? { variantName: c.selectedVariant.name } : {}),
        ...(c.selectedCup ? { selectedCup: c.selectedCup } : {}),
        ...(c.selectedIce ? { selectedIce: c.selectedIce } : {}),
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        totalPrice: c.totalPrice,
        cogsUnitPrice: c.product.cogs,
        cogsTotal: c.cogsTotal,
        ...(c.notes ? { notes: c.notes } : {}),
      })),
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: grandTotal,
      totalCogs,
      grossProfit,
      paymentMethod,
      cashAmountPaid: paymentMethod === 'cash' ? (cashGivenNum || grandTotal) : grandTotal,
      changeAmount: paymentMethod === 'cash' ? changeAmount : 0,
      status: 'completed',
    };
    setDraftPreviewTx(draftTx);
  }, [
    cart,
    checkoutOrderType,
    paymentMethod,
    checkoutOnlinePlatform,
    user,
    customerName,
    tableNo,
    checkoutOnlineOrderNo,
    checkoutDriverName,
    subtotal,
    discountAmount,
    taxAmount,
    grandTotal,
    totalCogs,
    grossProfit,
    cashGivenNum,
    changeAmount,
  ]);

  // Payment Processing Handler
  const handleProcessPayment = useCallback(() => {
    if (cart.length === 0) return;
    if (paymentMethod === 'cash' && cashGivenNum < grandTotal) {
      setCheckoutWarning('Jumlah uang tunai kurang dari total pembayaran!');
      return;
    }

    setIsProcessing(true);
    setCheckoutWarning(null);

    const nowIso = new Date().toISOString();
    const isOnline =
      checkoutOrderType === 'online_delivery' ||
      ['shopeefood', 'gofood', 'grabfood'].includes(paymentMethod);

    const platform =
      paymentMethod === 'shopeefood'
        ? 'ShopeeFood'
        : paymentMethod === 'gofood'
        ? 'GoFood'
        : paymentMethod === 'grabfood'
        ? 'GrabFood'
        : checkoutOnlinePlatform;

    const invoicePrefix = isOnline ? 'ONL' : 'SQ';
    const invoiceNo = `${invoicePrefix}-${nowIso.split('T')[0].replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const activeOutlet = StorageService.getActiveOutlet();

    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      invoiceNo,
      timestamp: nowIso,
      outletId: activeOutlet?.id,
      outletName: activeOutlet?.name,
      cashierId: user.id,
      cashierName: user.name,
      customerName: customerName.trim() || (isOnline ? `Pelanggan ${platform}` : 'Pelanggan Walk-in'),
      ...(tableNo.trim() ? { tableNo: tableNo.trim() } : {}),
      orderType: isOnline ? 'online_delivery' : checkoutOrderType,
      onlinePlatform: isOnline ? platform : undefined,
      onlineOrderNo: isOnline ? (checkoutOnlineOrderNo.trim() || `${platform === 'ShopeeFood' ? 'SF' : 'GF'}-${Math.floor(1000 + Math.random() * 9000)}`) : undefined,
      driverName: isOnline && checkoutDriverName.trim() ? checkoutDriverName.trim() : undefined,
      items: cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        ...(c.selectedVariant?.name ? { variantName: c.selectedVariant.name } : {}),
        ...(c.selectedCup ? { selectedCup: c.selectedCup } : {}),
        ...(c.selectedIce ? { selectedIce: c.selectedIce } : {}),
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        totalPrice: c.totalPrice,
        cogsUnitPrice: c.product.cogs,
        cogsTotal: c.cogsTotal,
        ...(c.notes ? { notes: c.notes } : {}),
      })),
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: grandTotal,
      totalCogs,
      grossProfit,
      paymentMethod,
      cashAmountPaid: paymentMethod === 'cash' ? cashGivenNum : grandTotal,
      changeAmount: paymentMethod === 'cash' ? changeAmount : 0,
      status: 'completed',
    };

    setTimeout(() => {
      const res = onCompleteTransaction(newTx);
      const finalTx = res?.transaction || newTx;
      setIsProcessing(false);
      setIsCheckoutOpen(false);

      if (paymentMethod === 'cash' && settings.autoOpenCashDrawer) {
        openCashDrawer(settings).catch(() => {});
      }

      if (settings.autoPrintReceipt && paymentMethod !== 'qris') {
        const text = formatThermalReceipt(finalTx, settings);
        printReceiptThermal(text, settings, { kickCashDrawer: paymentMethod === 'cash' }).catch(() => {});
      }

      const googleSheetWebhookUrl =
        typeof window !== 'undefined'
          ? localStorage.getItem('google_sheet_webhook_url') || settings?.googleSheetWebhookUrl
          : undefined;
      if (googleSheetWebhookUrl) {
        syncTransactionToGoogleSheet(googleSheetWebhookUrl, finalTx).catch((err) =>
          console.warn('[GoogleSheetWebhook] POSScreen sync error:', err)
        );
      }

      // Reset Cart State
      setCart([]);
      setCustomerName('');
      setTableNo('');
      setDiscountValue(0);
      setDiscountType('percent');
      setCashGiven('');
      setCheckoutOnlineOrderNo('');
      setCheckoutDriverName('');
      setCheckoutOrderType('dine_in');

      if (activeLoadedDraftId) {
        StorageService.deleteDraftOrder(activeLoadedDraftId);
        setActiveLoadedDraftId(null);
      }

      if (paymentMethod === 'qris') {
        onOpenQRIS(finalTx);
      } else {
        playSuccessSound(finalTx.total, `Pembayaran berhasil sebesar ${finalTx.total.toLocaleString('id-ID')} rupiah`);
        onOpenReceipt(finalTx);
      }
    }, 350);
  }, [
    cart,
    paymentMethod,
    cashGivenNum,
    grandTotal,
    checkoutOrderType,
    checkoutOnlinePlatform,
    user,
    customerName,
    tableNo,
    checkoutOnlineOrderNo,
    checkoutDriverName,
    subtotal,
    discountAmount,
    taxAmount,
    totalCogs,
    grossProfit,
    changeAmount,
    onCompleteTransaction,
    settings,
    activeLoadedDraftId,
    onOpenQRIS,
    onOpenReceipt,
  ]);

  return (
    <div className="relative pos-responsive-split flex flex-col lg:flex-row gap-4 sm:gap-5 pb-36 sm:pb-40 lg:pb-8 w-full max-w-full text-slate-800">
      {/* Floating Add Toast Feedback */}
      <AnimatePresence>
        {addToast && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-amber-500/30 flex items-center gap-3"
          >
            <div className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100">{addToast.name}</div>
              <div className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Ditambahkan ({formatRp(addToast.price)})
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Column: Product Catalog, Search & Filters */}
      <div className="pos-catalog-flex flex-1 space-y-3 sm:space-y-4 min-w-0 w-full max-w-full">
        {/* Quick Actions Bar (Adaptive & Responsive across all screens) */}
        <div className="bg-white p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold shrink-0">
                <Coffee className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                <span className="shrink-0">SU-QUR POS</span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md truncate max-w-[130px] sm:max-w-[180px]">
                  {activeCashierOutlet?.name || 'Cabang Utama'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons (Adaptive Grid on Mobile, Flex on Tablet/Desktop) */}
          <div className="grid grid-cols-4 sm:flex sm:items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
            {/* Quick Table QR Button */}
            <button
              type="button"
              onClick={() => setIsQuickQRModalOpen(true)}
              className="px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 font-bold text-[10px] sm:text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap min-w-0"
              title="Tampilkan Barcode QR & Link Meja Pelanggan"
            >
              <QrCode className="w-3 h-3 text-amber-700 shrink-0" />
              <span className="truncate">QR Meja</span>
            </button>

            {/* Table QR Incoming Orders Button */}
            <button
              type="button"
              onClick={() => setIsPendingQRModalOpen(true)}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
                pendingQRCount > 0
                  ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-300 animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Lihat Pesanan Masuk dari QR Meja Pelanggan"
            >
              <Smartphone className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="truncate">QR Masuk</span>
              {pendingQRCount > 0 && (
                <span className="bg-white text-rose-600 px-1 py-0.2 rounded-full text-[9px] font-black shrink-0">
                  {pendingQRCount}
                </span>
              )}
            </button>

            {/* Draft Orders Button */}
            <button
              type="button"
              onClick={() => setIsDraftOrdersModalOpen(true)}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
                activeDraftsCount > 0
                  ? 'bg-amber-600 text-white shadow-2xs ring-2 ring-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Lihat Daftar Draf Pesanan (Hold Bill)"
            >
              <Bookmark className="w-3 h-3 shrink-0" />
              <span className="truncate">Draf</span>
              {activeDraftsCount > 0 && (
                <span className="bg-white text-amber-800 px-1 py-0.2 rounded-full text-[9px] font-black shrink-0">
                  {activeDraftsCount}
                </span>
              )}
            </button>

            {/* Manual Online Ojol Input */}
            <button
              type="button"
              onClick={() => setIsOnlineOrderModalOpen(true)}
              className="px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] sm:text-[11px] flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap min-w-0"
              title="Input Pesanan Ojek Online"
            >
              <Bike className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="truncate">Ojol</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Section */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5 sm:space-y-3">
          {/* Search Input & View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kopi, minuman, snack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-9 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Switcher: Baris (List) vs Kotak (Grid) */}
            <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProductViewMode('row');
                  try {
                    localStorage.setItem('suqur_pos_product_view', 'row');
                  } catch {}
                }}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  productViewMode === 'row'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Baris Ramping (Hemat Ruang)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Baris</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductViewMode('grid');
                  try {
                    localStorage.setItem('suqur_pos_product_view', 'grid');
                  } catch {}
                }}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  productViewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Kotak (Grid)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kotak</span>
              </button>
            </div>
          </div>

          {/* Quick Add Best-Sellers Bar (Compact & Sleek Single-Line) */}
          {topSellingProducts.length > 0 && !searchQuery && (
            <div className="bg-amber-50/40 px-2 sm:px-2.5 py-1.5 rounded-xl border border-amber-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x">
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-900 shrink-0">
                <Flame className="w-3 h-3 text-amber-500" />
                <span className="hidden xs:inline">Terlaris:</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 py-0.5">
                {topSellingProducts.map((p) => {
                  const isAdded = lastAddedProdId === p.id;
                  return (
                    <button
                      key={'quick-' + p.id}
                      onClick={() => handleProductClick(p)}
                      className={`flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg text-left shrink-0 border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                        isAdded
                          ? 'border-emerald-500 ring-1 ring-emerald-400 bg-emerald-50'
                          : 'border-slate-200 hover:border-amber-400 hover:bg-slate-50'
                      }`}
                      title={`Tambah ${p.name}`}
                    >
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="w-4 h-4 rounded object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] font-bold text-slate-800 truncate max-w-[80px] sm:max-w-[100px]">{p.name}</span>
                      <span className="text-[9px] font-bold text-amber-700 shrink-0">{formatRp(p.price)}</span>
                      <Plus className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Primary Category Group Tabs */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
              {mainCategories.map((mainCat) => {
                const Icon = mainCat.icon;
                const count = getCategoryCount(mainCat.id);
                const isActive = selectedCategory === mainCat.id;
                return (
                  <button
                    key={mainCat.id}
                    onClick={() => setSelectedCategory(mainCat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>{mainCat.label}</span>
                    <span
                      className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sub-categories */}
            {specificCategories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 no-scrollbar border-t border-slate-100 touch-pan-x">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                  Sub:
                </span>
                {specificCategories.map((cat) => {
                  const count = getCategoryCount(cat);
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className="text-[9px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Product Cards Container (Tampilan Baris Ramping atau Kotak Kompak) */}
        <div
          className={`grid gap-2 sm:gap-2.5 ${
            productViewMode === 'row'
              ? isFocusMode
                ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
              : isFocusMode
              ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
          }`}
        >
          {filteredProducts.map((prod) => {
            const marginPct = prod.price > 0 ? Math.round(((prod.price - prod.cogs) / prod.price) * 100) : 0;
            const isJustAdded = lastAddedProdId === prod.id;

            if (productViewMode === 'row') {
              return (
                <div
                  key={prod.id}
                  onClick={() => handleProductClick(prod)}
                  className={`group bg-white rounded-xl border cursor-pointer flex items-center justify-between p-1.5 xs:p-2 sm:p-2.5 transition-all duration-150 gap-2 sm:gap-2.5 ${
                    isJustAdded
                      ? 'border-emerald-500 ring-2 ring-emerald-300 shadow-sm bg-emerald-50/25'
                      : 'border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-sm'
                  }`}
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-center gap-2 xs:gap-2.5 sm:gap-3 min-w-0 flex-1">
                    {/* Product Thumbnail (Kecil, simpel & rapi di mode HP) */}
                    <div className="relative w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/90 shadow-2xs">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 select-none"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // Fallback jika gambar gagal dimuat
                          (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300&auto=format&fit=crop&q=80';
                        }}
                      />
                      {isAdmin && (
                        <div className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-amber-300 text-[7px] font-bold text-center py-0.2 leading-none">
                          {marginPct}%
                        </div>
                      )}
                      {isJustAdded && (
                        <div className="absolute inset-0 bg-emerald-600/75 flex items-center justify-center text-white">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[11px] xs:text-xs sm:text-[13px] text-slate-900 truncate group-hover:text-amber-700 leading-snug">
                        {prod.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="font-black text-xs sm:text-[13px] text-slate-900">
                          {formatRp(prod.price)}
                        </span>
                        {isAdmin && (
                          <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-medium truncate">
                            HPP: {formatRp(prod.cogs)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Add Button */}
                  <div
                    className={`w-6 h-6 xs:w-7 xs:h-7 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isJustAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
                    }`}
                  >
                    <Plus className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                  </div>
                </div>
              );
            }

            // Grid Mode (Kompak & hemat ruang di HP)
            return (
              <div
                key={prod.id}
                onClick={() => handleProductClick(prod)}
                className={`group bg-white rounded-xl border cursor-pointer flex flex-col justify-between transition-all duration-150 overflow-hidden ${
                  isJustAdded
                    ? 'border-emerald-500 ring-2 ring-emerald-300 shadow-sm bg-emerald-50/20'
                    : 'border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Product Thumbnail (Diperkecil agar simpel di layar HP) */}
                  <div className="relative w-full h-13 xs:h-15 sm:h-18 bg-slate-100 overflow-hidden">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 select-none"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300&auto=format&fit=crop&q=80';
                      }}
                    />
                    {isAdmin && (
                      <div className="absolute top-1 right-1 bg-slate-900/80 backdrop-blur-xs text-amber-300 text-[8px] font-bold px-1.5 py-0.2 rounded">
                        Margin {marginPct}%
                      </div>
                    )}
                    {isJustAdded && (
                      <div className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center text-white">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center font-bold shadow-md">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="p-1.5 xs:p-2 sm:p-2.5">
                    <div className="font-bold text-[11px] xs:text-xs sm:text-[13px] text-slate-900 line-clamp-1 group-hover:text-amber-700 leading-snug">
                      {prod.name}
                    </div>
                    {isAdmin && (
                      <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-medium mt-0.5 truncate">
                        HPP: {formatRp(prod.cogs)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price & Add Action */}
                <div className="p-1.5 xs:p-2 sm:p-2.5 pt-0 flex items-center justify-between gap-1">
                  <div className="font-black text-[11px] xs:text-xs sm:text-[13px] text-slate-900 truncate">{formatRp(prod.price)}</div>
                  <div
                    className={`w-5 h-5 xs:w-6 xs:h-6 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isJustAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
                    }`}
                  >
                    <Plus className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Order Queue & Cart Sidebar */}
      <div id="cart-summary-section" className="pos-cart-flex w-full lg:w-[33%] xl:w-[28%] lg:min-w-[20rem] lg:max-w-[27rem] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden scroll-mt-20 shrink-0">
        {/* Cart Header */}
        <div
          className={`p-4 text-white flex items-center justify-between rounded-t-2xl transition-colors ${
            cartPulse ? 'bg-slate-800' : 'bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-xs sm:text-sm text-white">Pesanan Aktif ({cart.length})</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => {
                setCart([]);
                setDiscountValue(0);
              }}
              className="text-[10px] font-bold text-rose-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Hapus
            </button>
          )}
        </div>

        {/* Customer & Table Inputs */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              <UserIcon className="w-3 h-3" /> Pelanggan
            </label>
            <input
              type="text"
              placeholder="Nama pelanggan"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              <Coffee className="w-3 h-3" /> Meja
            </label>
            <input
              type="text"
              placeholder="No. Meja"
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[360px] min-h-[200px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <Coffee className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-700">Keranjang Masih Kosong</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Pilih menu di samping untuk memulai transaksi</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map((item, idx) => (
                <motion.div
                  key={item.product.id + (item.selectedVariant?.id || '') + (item.notes || '') + idx}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{item.product.name}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {item.selectedCup && (
                        <span className="text-[9px] bg-slate-900 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                          Cup {item.selectedCup}
                        </span>
                      )}
                      {item.selectedIce && (
                        <span className="text-[9px] bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded font-bold">
                          {item.selectedIce}
                        </span>
                      )}
                      {item.selectedVariant && !item.selectedCup && (
                        <span className="text-slate-600 text-[10px] font-semibold">({item.selectedVariant.name})</span>
                      )}
                    </div>
                    {item.notes && <div className="text-[10px] text-slate-500 italic truncate mt-0.5">* {item.notes}</div>}
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{formatRp(item.unitPrice)}</div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-700"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-bold text-xs text-slate-900">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Calculation Summary & Action Section */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl space-y-2.5">
          {/* Discount Section */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" /> Diskon
              </span>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('percent');
                    setDiscountValue(0);
                  }}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    discountType === 'percent' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('nominal');
                    setDiscountValue(0);
                  }}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    discountType === 'nominal' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Rp
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="0"
                min="0"
                max={discountType === 'percent' ? 100 : subtotal}
                value={discountValue || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setDiscountValue(Math.max(0, val));
                }}
                className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              />
              {discountAmount > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg shrink-0">
                  -{formatRp(discountAmount)}
                </span>
              )}
            </div>

            {/* Quick Discount Presets */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(discountType === 'percent' ? [5, 10, 15, 20] : [5000, 10000, 20000]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDiscountValue(preset)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                    discountValue === preset
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {discountType === 'percent' ? `${preset}%` : `${preset / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Financial Calculation */}
          <div className="space-y-1 text-xs text-slate-600 font-medium bg-white p-2.5 rounded-xl border border-slate-200">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-slate-900">{formatRp(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Diskon</span>
                <span>-{formatRp(discountAmount)}</span>
              </div>
            )}
            {isAdmin && (
              <>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>HPP (Modal)</span>
                  <span>{formatRp(totalCogs)}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100">
                  <span className="font-bold text-slate-700">Estimasi Margin</span>
                  <span className="font-bold text-emerald-700">
                    {grossProfitMargin}% ({formatRp(grossProfit)})
                  </span>
                </div>
              </>
            )}
            {settings.taxPercentage > 0 && (
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span>PPN ({settings.taxPercentage}%)</span>
                <span>{formatRp(taxAmount)}</span>
              </div>
            )}
          </div>

          {/* Grand Total & Actions */}
          <div className="border-t border-slate-200 pt-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Bayar</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 truncate">{formatRp(grandTotal)}</div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap sm:flex-nowrap">
              {/* Hold Bill */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setIsHoldBillModalOpen(true)}
                className="p-2 sm:px-2.5 sm:py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                title="Tahan Draf (Hold Bill)"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>

              {/* Buat PO */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setIsCreatePOModalOpen(true)}
                className="p-2 sm:px-2.5 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                title="Buat Pre-Order (PO)"
              >
                <CalendarClock className="w-3.5 h-3.5" />
              </button>

              {/* Pratinjau */}
              <button
                disabled={cart.length === 0}
                onClick={handleOpenDraftPreview}
                className="p-2 sm:px-2.5 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                title="Pratinjau Struk"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>

              {/* Bayar & Cetak */}
              <button
                disabled={cart.length === 0}
                onClick={() => {
                  setIsCheckoutOpen(true);
                  setCashGiven(grandTotal.toString());
                }}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>Bayar & Cetak</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Sticky Checkout Bar (Visible on mobile/tablet when cart has items) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+62px)] md:bottom-4 left-2.5 right-2.5 z-40 bg-slate-900/95 backdrop-blur-md text-white p-2.5 sm:p-3 rounded-2xl shadow-2xl border border-amber-500/40 flex items-center justify-between gap-2 sm:gap-3 animate-slideUp">
          <div
            onClick={() => {
              const cartEl = document.getElementById('cart-summary-section');
              if (cartEl) {
                cartEl.scrollIntoView({ behavior: 'smooth' });
              } else {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2 sm:gap-2.5 min-w-0 cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-amber-300 transition-colors">
                Total Pesanan ({cart.length} menu)
              </div>
              <div className="text-xs sm:text-sm font-black text-amber-400 truncate">{formatRp(grandTotal)}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenDraftPreview}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Pratinjau Nota"
            >
              <Eye className="w-4 h-4 text-amber-400" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCheckoutOpen(true);
                setCashGiven(grandTotal.toString());
              }}
              className="py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
              <span className="hidden xs:inline">Selesaikan & Cetak</span>
              <span className="xs:hidden">Bayar & Cetak</span>
            </button>
          </div>
        </div>
      )}

      {/* Variant Selection Modal */}
      {variantProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{variantProduct.name}</h3>
                <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                  {variantProduct.category}
                </span>
              </div>
              <button
                onClick={() => setVariantProduct(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cup Size */}
            {((variantProduct.cupOptions && variantProduct.cupOptions.length > 0) ||
              isDrinkCategory(variantProduct.category)) && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold uppercase text-slate-700 block">Pilih Ukuran Cup</label>
                <div className="grid grid-cols-2 gap-2">
                  {(variantProduct.cupOptions && variantProduct.cupOptions.length > 0
                    ? variantProduct.cupOptions
                    : (['14oz', '16oz', '18oz', '22oz'] as const)
                  ).map((cup) => {
                    const isSelected = selectedCup === cup;
                    let adjText = 'Standar (Rp 0)';
                    if (cup === '14oz') adjText = '-Rp 1.000';
                    else if (cup === '18oz') adjText = '+Rp 1.000';
                    else if (cup === '22oz') adjText = '+Rp 2.000';

                    return (
                      <button
                        key={cup}
                        type="button"
                        onClick={() => {
                          setSelectedCup(cup);
                          const matchingVariant = variantProduct.variants?.find((v) => v.name.includes(cup));
                          if (matchingVariant) setSelectedVariant(matchingVariant);
                        }}
                        className={`p-2 rounded-lg border text-xs text-left font-bold transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>Cup {cup}</div>
                        <div className="text-[10px] opacity-75 font-normal">{adjText}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ice Option */}
            {variantProduct.hasIceOption !== false &&
              (isDrinkCategory(variantProduct.category) || variantProduct.hasIceOption) && (
                <div className="bg-cyan-50/50 p-3 rounded-xl border border-cyan-200 space-y-2">
                  <label className="text-xs font-bold uppercase text-cyan-900 block">Pilihan Es Batu</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Pakai Es', label: 'Pakai Es Batu' },
                      { id: 'Tanpa Es', label: 'Tanpa Es' },
                    ].map((ice) => {
                      const isSelected = selectedIce === ice.id;
                      return (
                        <button
                          key={ice.id}
                          type="button"
                          onClick={() => setSelectedIce(ice.id as any)}
                          className={`p-2 rounded-lg border text-xs font-bold transition-all text-center ${
                            isSelected
                              ? 'bg-cyan-800 text-white border-cyan-800 shadow-xs'
                              : 'bg-white text-cyan-950 border-cyan-200 hover:bg-cyan-100/50'
                          }`}
                        >
                          {ice.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Additional Variants */}
            {variantProduct.variants && variantProduct.variants.length > 0 && (
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 block mb-1.5">Varian Lain</label>
                <div className="grid grid-cols-2 gap-2">
                  {variantProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2 rounded-lg border text-xs text-left font-bold transition-all ${
                        selectedVariant?.id === v.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <div>{v.name}</div>
                      <div className="text-[10px] opacity-75">
                        {v.priceAdjustment > 0
                          ? `+${formatRp(v.priceAdjustment)}`
                          : v.priceAdjustment < 0
                          ? formatRp(v.priceAdjustment)
                          : 'Standar'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Catatan Pesanan</label>
              <input
                type="text"
                placeholder="cth: Less Sugar, Extra Shot"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => addToCart(variantProduct, selectedVariant, itemNotes, selectedCup, selectedIce)}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
            >
              + Tambahkan ke Keranjang
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-[#1F1412] text-[#FAF3DD] rounded-2xl sm:rounded-3xl max-w-lg w-full h-[500px] max-h-[94vh] flex flex-col shadow-2xl border border-[#4E342E] overflow-hidden animate-scaleUp">
            {/* Ultra-compact Header */}
            <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-[#4E342E] flex items-center justify-between bg-[#2B1713] shrink-0 text-white">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold shrink-0">
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex items-center gap-2">
                  <h3 className="font-bold text-xs sm:text-sm text-amber-200 tracking-wide truncate">Pembayaran POS</h3>
                  <span className="text-[9px] sm:text-[10px] text-[#D7CCC8] bg-[#3E2723] px-1.5 py-0.5 rounded font-semibold truncate">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} item {customerName ? `• ${customerName}` : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-[#D7CCC8] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1"
                title="Tutup (Batal)"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* TOP BAR: Total Pembayaran, Pratinjau Struk, Buka Laci, dan Tombol Selesaikan Pembayaran Langsung */}
            <div className="px-3 py-2 bg-[#261310] border-b border-[#4E342E] shrink-0 space-y-1.5 shadow-sm">
              {/* Total & Quick Tools */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] text-amber-200/80 font-bold uppercase tracking-wider">TOTAL TAGIHAN</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight leading-none">
                    {formatRp(grandTotal)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenDraftPreview}
                    className="py-1 px-2 rounded-lg bg-[#3E2723] hover:bg-[#4E342E] text-amber-200 font-bold text-[10px] sm:text-xs border border-[#5D4037] transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                    title="Pratinjau Struk Sebelum Pembayaran"
                  >
                    <Eye className="w-3 h-3 text-amber-400" />
                    <span>Pratinjau</span>
                  </button>

                  {paymentMethod === 'cash' && (
                    <button
                      type="button"
                      onClick={() => openCashDrawer(settings).catch(() => {})}
                      className="py-1 px-2 rounded-lg bg-[#3E2723] hover:bg-[#4E342E] text-amber-300 font-bold text-[10px] sm:text-xs border border-[#5D4037] transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                      title="Buka Laci Uang (Cash Drawer)"
                    >
                      <DollarSign className="w-3 h-3 text-amber-400" />
                      <span>Buka Laci</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Prominent Quick Action Button right at top */}
              <button
                type="button"
                disabled={isProcessing || (paymentMethod === 'cash' && cashGivenNum < grandTotal)}
                onClick={handleProcessPayment}
                className="w-full py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {isProcessing ? (
                  <span>Memproses & Menyimpan...</span>
                ) : (
                  <>
                    <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 shrink-0" />
                    <span>Selesaikan & Cetak</span>
                  </>
                )}
              </button>
            </div>

            {/* Scrollable Body for Details (Order Type, Method, Cash Nominal) */}
            <div className="overflow-y-auto min-h-0 px-3 py-2 space-y-2 flex-1 text-xs overscroll-contain no-scrollbar">
              {checkoutWarning && (
                <div className="bg-rose-950/90 text-rose-200 p-2 rounded-xl border border-rose-500/60 text-[11px] font-bold flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>{checkoutWarning}</span>
                </div>
              )}

              {/* Order Channel */}
              <div>
                <label className="text-[9.5px] sm:text-[10px] font-bold uppercase text-amber-300/90 block mb-1">Tipe Pesanan</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'dine_in', label: 'Dine-In', icon: '🍽️' },
                    { id: 'take_away', label: 'Takeaway', icon: '🛍️' },
                    { id: 'online_delivery', label: 'Ojol / Online', icon: '🛵' },
                  ].map((type) => {
                    const isSelected = checkoutOrderType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setCheckoutOrderType(type.id as any);
                          if (type.id === 'online_delivery') {
                            setPaymentMethod('shopeefood');
                            setCheckoutOnlinePlatform('ShopeeFood');
                          }
                        }}
                        className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black ring-2 ring-amber-400/40'
                            : 'bg-[#2B1713] text-[#D7CCC8] border-[#4E342E] hover:bg-[#3E2723] hover:text-white'
                        }`}
                      >
                        <span className="text-xs">{type.icon}</span>
                        <span className="truncate">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="text-[9.5px] sm:text-[10px] font-bold uppercase text-amber-300/90 block mb-1">Metode Bayar</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setCashGiven(grandTotal.toString());
                    }}
                    className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black ring-2 ring-amber-400/40'
                        : 'bg-[#2B1713] text-[#D7CCC8] border-[#4E342E] hover:bg-[#3E2723] hover:text-white'
                    }`}
                  >
                    <Banknote className={`w-3.5 h-3.5 ${paymentMethod === 'cash' ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span>Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qris')}
                    className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'qris'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black ring-2 ring-amber-400/40'
                        : 'bg-[#2B1713] text-[#D7CCC8] border-[#4E342E] hover:bg-[#3E2723] hover:text-white'
                    }`}
                  >
                    <QrCode className={`w-3.5 h-3.5 ${paymentMethod === 'qris' ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span>QRIS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('debit')}
                    className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'debit'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black ring-2 ring-amber-400/40'
                        : 'bg-[#2B1713] text-[#D7CCC8] border-[#4E342E] hover:bg-[#3E2723] hover:text-white'
                    }`}
                  >
                    <CreditCard className={`w-3.5 h-3.5 ${paymentMethod === 'debit' ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span>Transfer/EDC</span>
                  </button>
                </div>
              </div>

              {/* Cash Input & Quick Denominations */}
              {paymentMethod === 'cash' && (
                <div className="space-y-1.5 bg-[#2B1713] p-2 sm:p-2.5 rounded-2xl border border-[#4E342E]">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[9.5px] sm:text-[10px] font-bold uppercase text-[#D7CCC8]">Uang Diterima:</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#D7CCC8] font-bold text-xs">Rp</span>
                      <input
                        type="number"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        placeholder="0"
                        className="w-28 sm:w-32 pl-6 pr-2 py-1 rounded-lg border border-[#5D4037] bg-[#1A0E0C] font-mono font-black text-xs text-amber-300 focus:outline-none focus:border-amber-400 text-right shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => setCashGiven(grandTotal.toString())}
                      className="py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black hover:bg-amber-400 text-center cursor-pointer transition-colors shadow-2xs"
                    >
                      Uang Pas
                    </button>
                    {[20000, 50000, 100000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashGiven(amt.toString())}
                        className="py-1 rounded-lg bg-[#3E2723] border border-[#5D4037] text-[10px] font-bold text-amber-100 hover:bg-[#4E342E] hover:text-white text-center cursor-pointer transition-colors"
                      >
                        {formatRp(amt)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Display */}
                  <div className="flex justify-between items-center pt-1 border-t border-[#4E342E]">
                    <span className="text-[9.5px] sm:text-[10px] text-[#D7CCC8] font-bold uppercase">Kembalian:</span>
                    <span
                      className={`text-xs sm:text-sm font-mono font-black ${
                        changeAmount < 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatRp(Math.max(0, changeAmount))}
                    </span>
                  </div>
                </div>
              )}

              {/* Subtotal & Profit info in compact row */}
              <div className="flex items-center justify-between text-[9.5px] text-[#D7CCC8] px-1 pt-1 pb-1">
                <span>Subtotal: {formatRp(subtotal)}</span>
                {discountAmount > 0 && <span className="text-emerald-400 font-bold">Hemat {formatRp(discountAmount)}</span>}
                {isAdmin ? (
                  <span>Margin: <strong className="text-emerald-400">{grossProfitMargin}%</strong> ({formatRp(grossProfit)})</span>
                ) : (
                  <span>Total Qty: <strong className="text-amber-200">{cart.reduce((a, b) => a + b.quantity, 0)} item</strong></span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auxiliary Modals */}
      {draftPreviewTx && (
        <ThermalReceiptModal
          tx={draftPreviewTx}
          settings={settings}
          currentUser={user}
          isDraftPreview={true}
          onClose={() => setDraftPreviewTx(null)}
        />
      )}

      <ManualOnlineOrderModal
        products={products}
        ingredients={ingredients}
        user={user}
        settings={settings}
        isOpen={isOnlineOrderModalOpen}
        onClose={() => setIsOnlineOrderModalOpen(false)}
        onCompleteOnlineOrder={(tx) => {
          onCompleteTransaction(tx);
          if (settings.autoPrintReceipt) {
            const text = formatThermalReceipt(tx, settings);
            printReceiptThermal(text, settings, { kickCashDrawer: false }).catch(() => {});
          }
          onOpenReceipt(tx);
        }}
      />

      <PendingQROrdersModal
        isOpen={isPendingQRModalOpen}
        onClose={() => setIsPendingQRModalOpen(false)}
        currentUser={user}
        settings={settings}
        outletId={user.role === 'kasir' ? user.outletId : undefined}
        onOrderSettled={(tx) => {
          onCompleteTransaction(tx);
        }}
        onOpenReceiptModal={(tx) => {
          onOpenReceipt(tx);
        }}
      />

      <QRCodeGeneratorModal
        isOpen={isQRGenModalOpen}
        onClose={() => setIsQRGenModalOpen(false)}
        outlets={StorageService.getOutlets()}
        currentOutlet={StorageService.getOutlets().find(
          (o) => o.id === (user.role === 'kasir' ? user.outletId : StorageService.getActiveOutletId())
        )}
        settings={settings}
      />

      <QuickTableQRModal
        isOpen={isQuickQRModalOpen}
        onClose={() => setIsQuickQRModalOpen(false)}
        currentUser={user}
        settings={settings}
        activeOutlet={activeCashierOutlet}
        outlets={StorageService.getOutlets()}
        onOpenFullQRGenerator={() => setIsQRGenModalOpen(true)}
      />

      <HoldBillModal
        isOpen={isHoldBillModalOpen}
        onClose={() => setIsHoldBillModalOpen(false)}
        cart={cart}
        currentCustomerName={customerName}
        currentTableNo={tableNo}
        currentDiscountType={discountType}
        currentDiscountValue={discountValue}
        subtotal={subtotal}
        grandTotal={grandTotal}
        currentUser={user}
        currentOutletName={StorageService.getActiveOutlet()?.name}
        onHoldSuccess={(savedDraft) => {
          setCart([]);
          setCustomerName('');
          setTableNo('');
          setDiscountValue(0);
          setDiscountType('percent');
          setActiveLoadedDraftId(null);
          setAddToast({
            name: `Draf ${savedDraft.customerName} Disimpan`,
            price: savedDraft.total,
          });
          setTimeout(() => setAddToast(null), 2500);
          setActiveDraftsCount((prev) => prev + 1);
        }}
      />

      <DraftOrdersModal
        isOpen={isDraftOrdersModalOpen}
        onClose={() => setIsDraftOrdersModalOpen(false)}
        currentUser={user}
        settings={settings}
        outletId={user.role === 'kasir' ? user.outletId : undefined}
        onLoadDraftToCart={(draft) => {
          setCart(draft.items);
          setCustomerName(draft.customerName || '');
          setTableNo(draft.tableNumber || '');
          if (draft.discountType && draft.discountValue !== undefined) {
            setDiscountType(draft.discountType);
            setDiscountValue(draft.discountValue);
          }
          if (draft.orderType) {
            setCheckoutOrderType(draft.orderType);
          }
          setActiveLoadedDraftId(draft.id);
          setAddToast({
            name: `Draf ${draft.customerName} Dimuat`,
            price: draft.total,
          });
          setTimeout(() => setAddToast(null), 2500);
        }}
        onPayDraftDirect={(draft) => {
          setCart(draft.items);
          setCustomerName(draft.customerName || '');
          setTableNo(draft.tableNumber || '');
          if (draft.discountType && draft.discountValue !== undefined) {
            setDiscountType(draft.discountType);
            setDiscountValue(draft.discountValue);
          }
          if (draft.orderType) {
            setCheckoutOrderType(draft.orderType);
          }
          setActiveLoadedDraftId(draft.id);
          setCashGiven(draft.total.toString());
          setIsCheckoutOpen(true);
        }}
      />

      <CreatePreOrderModal
        isOpen={isCreatePOModalOpen}
        onClose={() => setIsCreatePOModalOpen(false)}
        cart={cart}
        subtotal={grandTotal}
        user={user}
        settings={settings}
        onSuccess={(newPO) => {
          playSuccessSound();
          setCart([]);
          setCustomerName('');
          setTableNo('');
          setDiscountValue(0);
          StorageService.clearCartDraft();
          setAddToast({
            name: `PO ${newPO.poNumber || newPO.customerName} Dibuat`,
            price: newPO.totalAmount,
          });
          setTimeout(() => setAddToast(null), 3000);
        }}
      />
    </div>
  );
};
