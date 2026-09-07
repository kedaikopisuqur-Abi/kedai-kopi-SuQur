import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Product,
  CartItem,
  ProductVariant,
  Outlet,
  StoreSettings,
  QROrder,
  QROrderItem,
} from '../../types';
import { formatRp } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Clock,
  QrCode,
  Store,
  MapPin,
  Phone,
  Wifi,
  Sparkles,
  Coffee,
  Utensils,
  Cookie,
  Grid,
  X,
  Send,
  CreditCard,
  Banknote,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  Flame,
  Check,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface CustomerMenuScreenProps {
  outletId?: string;
  tableParam?: string;
  onExitToPOS?: () => void;
}

export const CustomerMenuScreen: React.FC<CustomerMenuScreenProps> = ({
  outletId: initialOutletId,
  tableParam: initialTableParam,
  onExitToPOS,
}) => {
  // Read params from URL or props
  const [outletId, setOutletId] = useState<string>(() => {
    if (initialOutletId) return initialOutletId;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('outletId') || StorageService.getActiveOutletId();
    }
    return StorageService.getActiveOutletId();
  });

  const [tableNo, setTableNo] = useState<string>(() => {
    if (initialTableParam) return initialTableParam;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('table') || 'Meja 01';
    }
    return 'Meja 01';
  });

  const [outlets, setOutlets] = useState<Outlet[]>(() => StorageService.getOutlets());
  const [settings, setSettings] = useState<StoreSettings>(() => StorageService.getSettings());
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());

  // Active Outlet resolution
  const currentOutlet = useMemo(() => {
    const found = outlets.find((o) => o.id === outletId);
    return found || outlets[0] || {
      id: 'outlet-main',
      name: 'Kedai Kopi Wahid',
      address: 'Jl. Lagoa Terusan No. 12, Koja, Jakarta Utara',
      phone: '0812-9988-1001',
      isDefault: true,
      isActive: true,
    };
  }, [outlets, outletId]);

  // Menu Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State (Customer Local Cart)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Customer Checkout Form
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<'cash_at_cashier' | 'qris'>('cash_at_cashier');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active Submitted Order Tracking
  const [activeSubmittedOrder, setActiveSubmittedOrder] = useState<QROrder | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('last_customer_qr_order');
        if (saved) {
          const parsed = JSON.parse(saved) as QROrder;
          // Check if order is recent (less than 6 hours old)
          const orderTime = new Date(parsed.createdAt || parsed.timestamp).getTime();
          if (Date.now() - orderTime < 6 * 3600 * 1000) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return null;
  });

  // Modal Customization Product
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVariant, setModalVariant] = useState<ProductVariant | undefined>(undefined);
  const [modalCup, setModalCup] = useState<'14oz' | '16oz' | '18oz' | '22oz'>('16oz');
  const [modalIce, setModalIce] = useState<'Pakai Es' | 'Tanpa Es'>('Pakai Es');
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalNotes, setModalNotes] = useState<string>('');

  // Auto reload products and track submitted order status in real-time
  useEffect(() => {
    const handleStorageChange = () => {
      const freshProducts = StorageService.getProducts();
      setProducts((prev) => (prev.length === freshProducts.length ? prev : freshProducts));

      const freshOutlets = StorageService.getOutlets();
      setOutlets((prev) => (prev.length === freshOutlets.length ? prev : freshOutlets));

      const freshSettings = StorageService.getSettings();
      setSettings((prev) => (prev.storeName === freshSettings.storeName && prev.publicOrderUrl === freshSettings.publicOrderUrl ? prev : freshSettings));

      // If customer has an active submitted order, update status from storage
      if (activeSubmittedOrder) {
        const allQrs = StorageService.getQROrders();
        const found = allQrs.find((o) => o.id === activeSubmittedOrder.id);
        if (found && (found.status !== activeSubmittedOrder.status || found.paymentStatus !== activeSubmittedOrder.paymentStatus)) {
          setActiveSubmittedOrder(found);
          localStorage.setItem('last_customer_qr_order', JSON.stringify(found));
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('realtime_qr_order_pushed', handleStorageChange);
    const interval = setInterval(handleStorageChange, 10000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('realtime_qr_order_pushed', handleStorageChange);
      clearInterval(interval);
    };
  }, [activeSubmittedOrder]);

  // Categories helper
  const isDrinkCategory = (cat: string) => {
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
  };

  const isFoodCategory = (cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      (c.includes('makanan') ||
        c.includes('main') ||
        c.includes('meal') ||
        c.includes('rice') ||
        c.includes('burger') ||
        c.includes('dapur')) &&
      !c.includes('snack') &&
      !c.includes('pastry')
    );
  };

  const isSnackCategory = (cat: string) => {
    const c = (cat || '').toLowerCase();
    return (
      c.includes('snack') ||
      c.includes('pastry') ||
      c.includes('roti') ||
      c.includes('dessert') ||
      c.includes('cemilan') ||
      c.includes('kue')
    );
  };

  const categories = useMemo(() => {
    const base = [
      { id: 'Semua', label: 'Semua Menu', icon: Grid },
      { id: 'Minuman', label: 'Minuman & Kopi', icon: Coffee },
      { id: 'Makanan', label: 'Makanan Utama', icon: Utensils },
      { id: 'Snack', label: 'Snack & Pastry', icon: Cookie },
    ];
    return base;
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Must be available
      if (p.isAvailable === false) return false;

      // Category match
      let matchCat = true;
      if (selectedCategory === 'Minuman') matchCat = isDrinkCategory(p.category);
      else if (selectedCategory === 'Makanan') matchCat = isFoodCategory(p.category);
      else if (selectedCategory === 'Snack') matchCat = isSnackCategory(p.category);
      else if (selectedCategory !== 'Semua') matchCat = p.category === selectedCategory;

      // Search match
      let matchSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        matchSearch =
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q));
      }

      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Open Product Customization Modal
  const handleOpenProductModal = (product: Product) => {
    setSelectedProduct(product);
    setModalVariant(product.variants && product.variants.length > 0 ? product.variants[0] : undefined);
    setModalCup('16oz');
    setModalIce('Pakai Es');
    setModalQty(1);
    setModalNotes('');
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!selectedProduct) return;

    let basePrice = selectedProduct.price;
    let variantName = undefined;

    if (modalVariant) {
      basePrice = modalVariant.price || (selectedProduct.price + (modalVariant.priceAdjustment || 0));
      variantName = modalVariant.name;
    }

    // Price modifier for cup size
    let cupPriceMod = 0;
    if (modalCup === '18oz') cupPriceMod = 2000;
    if (modalCup === '22oz') cupPriceMod = 4000;

    const unitPrice = basePrice + cupPriceMod;
    const isDrink = isDrinkCategory(selectedProduct.category);

    const newItem: CartItem = {
      product: selectedProduct,
      selectedVariant: modalVariant,
      variant: modalVariant,
      selectedCup: isDrink ? modalCup : undefined,
      selectedIce: isDrink ? modalIce : undefined,
      quantity: modalQty,
      notes: modalNotes.trim() || undefined,
      unitPrice: unitPrice,
      customPrice: unitPrice,
      totalPrice: unitPrice * modalQty,
      subtotal: unitPrice * modalQty,
      cogsTotal: (selectedProduct.cogs || 0) * modalQty,
    };

    setCart((prev) => {
      // Find matching item in cart
      const existingIdx = prev.findIndex(
        (it) =>
          it.product.id === newItem.product.id &&
          it.selectedVariant?.name === newItem.selectedVariant?.name &&
          it.selectedCup === newItem.selectedCup &&
          it.selectedIce === newItem.selectedIce &&
          (it.notes || '') === (newItem.notes || '')
      );

      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += newItem.quantity;
        return updated;
      }
      return [...prev, newItem];
    });

    setSelectedProduct(null);
  };

  // Cart Qty Modifiers
  const updateCartQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      updated[idx].quantity = newQty;
      return updated;
    });
  };

  const removeCartItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  // Cart Totals
  const cartTotals = useMemo(() => {
    const totalItems = cart.reduce((sum, it) => sum + it.quantity, 0);
    const subtotal = cart.reduce((sum, it) => {
      const variantObj = typeof it.variant === 'object' ? it.variant : it.selectedVariant;
      const variantPrice = variantObj?.price || (variantObj?.priceAdjustment ? it.product.price + variantObj.priceAdjustment : undefined);
      const price = it.customPrice ?? it.unitPrice ?? variantPrice ?? it.product.price;
      return sum + price * it.quantity;
    }, 0);
    const tax = settings.taxPercentage > 0 ? Math.round(subtotal * (settings.taxPercentage / 100)) : 0;
    const total = subtotal + tax;

    return { totalItems, subtotal, tax, total };
  }, [cart, settings.taxPercentage]);

  // Submit Order to POS & Cloud Database
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!customerName.trim()) {
      alert('Mohon masukkan Nama Anda untuk konfirmasi pesanan.');
      return;
    }

    if (!tableNo.trim()) {
      alert('Mohon masukkan Nomor Meja Anda.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build QROrderItem list
      const qrItems: QROrderItem[] = cart.map((it) => {
        const variantObj = typeof it.variant === 'object' ? it.variant : it.selectedVariant;
        const variantPrice = variantObj?.price || (variantObj?.priceAdjustment ? it.product.price + variantObj.priceAdjustment : undefined);
        const unitPrice = it.customPrice ?? it.unitPrice ?? variantPrice ?? it.product.price;
        const cogsUnit = it.product.cogs || 0;
        const variantName = variantObj?.name || (typeof it.variant === 'string' ? it.variant : undefined);
        return {
          productId: it.product.id,
          productName: it.product.name,
          variantName,
          selectedCup: it.selectedCup,
          selectedIce: it.selectedIce,
          quantity: it.quantity,
          unitPrice,
          totalPrice: unitPrice * it.quantity,
          cogsUnitPrice: cogsUnit,
          cogsTotal: cogsUnit * it.quantity,
          notes: it.notes,
        };
      });

      const totalCogs = qrItems.reduce((sum, it) => sum + it.cogsTotal, 0);
      const queueNo = `SQ-QR${String(Date.now()).slice(-3)}`;
      const orderNo = `QR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;

      const newQROrder: QROrder = {
        id: 'qr-ord-' + Date.now(),
        orderNo,
        queueNo,
        timestamp: new Date().toISOString(),
        outletId: currentOutlet.id,
        outletName: currentOutlet.name,
        tableNo: tableNo.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        items: qrItems,
        subtotal: cartTotals.subtotal,
        tax: cartTotals.tax,
        discount: 0,
        total: cartTotals.total,
        totalCogs,
        paymentMethod: paymentOption,
        paymentStatus: 'unpaid',
        status: 'pending',
        notes: customerNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      // Add order to StorageService (writes to local memory + synced to Firestore)
      StorageService.addQROrder(newQROrder);

      // Save order state locally so customer can track progress
      setActiveSubmittedOrder(newQROrder);
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_customer_qr_order', JSON.stringify(newQROrder));
      }

      // Reset cart
      setCart([]);
      setIsCartOpen(false);
      setIsSubmitting(false);
    } catch (err: any) {
      console.error('Error submitting customer QR order:', err);
      alert('Gagal mengirim pesanan. Silakan periksa koneksi internet Anda atau hubungi kasir.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2B1713] font-sans antialiased pb-24 selection:bg-amber-200">
      {/* Top Banner / Outlet Header */}
      <header className="sticky top-0 z-30 bg-[#2B1713] text-[#FAF3DD] shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold text-lg shrink-0">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif italic font-extrabold text-base sm:text-lg leading-tight text-[#FAF3DD]">
                  {currentOutlet.name}
                </h1>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30 hidden xs:inline-block">
                  Self-Order Bebas Login
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#D7CCC8]">
                <span className="flex items-center gap-1 font-bold text-amber-300">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  {tableNo || 'Meja 01'}
                </span>
                <span>•</span>
                <span className="truncate max-w-[150px] sm:max-w-[240px]">
                  {currentOutlet.address || 'Self-Order Online'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions: Track Order & Back to POS (if staff) */}
          <div className="flex items-center gap-2">
            {activeSubmittedOrder && (
              <button
                type="button"
                onClick={() => {}}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 animate-pulse"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pesanan Aktif:</span>
                <span>#{activeSubmittedOrder.queueNo || activeSubmittedOrder.orderNo.slice(-4)}</span>
              </button>
            )}

            {onExitToPOS && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tutup menu pelanggan dan kembali ke layar kasir?')) {
                    onExitToPOS();
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF3DD] text-[11px] font-bold transition-all border border-white/20 flex items-center gap-1 cursor-pointer"
                title="Kembali ke Mode Kasir / POS Toko"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Layar Kasir</span>
              </button>
            )}
          </div>
        </div>

        {/* Wifi Info Bar if available */}
        {(settings.wifiName || settings.wifiPassword) && (
          <div className="bg-[#3E2723] px-4 py-1.5 border-t border-[#4E342E] text-[11px] text-[#E6D5C3] flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-amber-400" />
              <span>WiFi: <b>{settings.wifiName || currentOutlet.name}</b></span>
              {settings.wifiPassword && (
                <span>| Password: <b className="font-mono text-amber-300">{settings.wifiPassword}</b></span>
              )}
            </div>
            <span className="text-[10px] text-amber-200/80 hidden sm:inline">Order via QR Code Bebas Antre</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        {/* Active Order Live Tracker Banner (If customer placed an order) */}
        {activeSubmittedOrder && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 border-2 border-amber-400 rounded-3xl p-5 shadow-md">
            <div className="flex items-start justify-between gap-3 border-b border-amber-200 pb-3 mb-3">
              <div>
                <div className="text-[11px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                  Status Pesanan Anda #{activeSubmittedOrder.queueNo || activeSubmittedOrder.orderNo.slice(-4)}
                </div>
                <div className="text-xs text-stone-600 mt-0.5">
                  {activeSubmittedOrder.tableNo} • An. <b>{activeSubmittedOrder.customerName}</b>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 shadow-xs ${
                  activeSubmittedOrder.status === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : activeSubmittedOrder.status === 'preparing' || activeSubmittedOrder.status === 'accepted'
                    ? 'bg-amber-600 text-white animate-pulse'
                    : 'bg-stone-800 text-amber-300'
                }`}
              >
                {activeSubmittedOrder.status === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Siap / Selesai
                  </>
                ) : activeSubmittedOrder.status === 'preparing' || activeSubmittedOrder.status === 'accepted' ? (
                  <>
                    <Clock className="w-3.5 h-3.5" /> Sedang Disiapkan
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Menunggu Konfirmasi
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-stone-500 text-[11px]">Item Pesanan:</div>
                <div className="font-semibold text-stone-800">
                  {activeSubmittedOrder.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                </div>
              </div>
              <div className="space-y-1 sm:text-right">
                <div className="text-stone-500 text-[11px]">Total Tagihan:</div>
                <div className="font-black text-sm text-[#3E2723]">
                  {formatRp(activeSubmittedOrder.total)}
                  <span className="text-[11px] font-normal text-stone-600 ml-1.5">
                    ({activeSubmittedOrder.paymentMethod === 'qris' ? 'QRIS' : 'Bayar di Kasir'})
                  </span>
                </div>
              </div>
            </div>

            {/* QRIS payment details if customer chose QRIS */}
            {activeSubmittedOrder.paymentMethod === 'qris' && activeSubmittedOrder.paymentStatus === 'unpaid' && (
              <div className="mt-3 pt-3 border-t border-amber-200/80 bg-white/80 p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-white p-2 rounded-xl border border-stone-200 shadow-xs shrink-0">
                  {settings.qrisImageUrl ? (
                    <img
                      src={settings.qrisImageUrl}
                      alt="QRIS Toko"
                      className="w-28 h-28 object-contain"
                    />
                  ) : (
                    <div className="w-28 h-28 bg-stone-100 flex flex-col items-center justify-center text-center p-2 rounded-lg text-[10px] text-stone-500">
                      <QrCode className="w-8 h-8 text-stone-700 mb-1" />
                      QRIS {settings.qrisMerchantName || currentOutlet.name}
                    </div>
                  )}
                </div>
                <div className="text-xs space-y-1 text-center sm:text-left">
                  <div className="font-bold text-[#3E2723]">Scan QRIS untuk Pembayaran Langsung</div>
                  <div className="text-stone-600 text-[11px]">
                    NMID: <b className="font-mono">{settings.qrisNmid || 'ID1020038829101'}</b>
                  </div>
                  <div className="text-stone-600 text-[11px]">
                    Merchant: <b>{settings.qrisMerchantName || currentOutlet.name}</b>
                  </div>
                  <p className="text-[10px] text-emerald-800 font-semibold mt-1">
                    Setelah pembayaran berhasil, kasir akan segera memproses dan mengantarkan pesanan Anda.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-stone-500">
              <span>Pesanan otomatis diperbarui secara real-time.</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tutup pelacakan pesanan ini dan buat pesanan baru?')) {
                    setActiveSubmittedOrder(null);
                    localStorage.removeItem('last_customer_qr_order');
                  }
                }}
                className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
              >
                Pesan Menu Tambahan
              </button>
            </div>
          </div>
        )}

        {/* Search Bar & Table Indicator */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E6D5C3] shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Cari kopi, makanan, snack, minuman favorit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-[#FAF8F5] text-xs font-medium text-stone-900 focus:ring-2 focus:ring-[#3E2723] outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <span className="text-xs text-stone-500 font-medium">Nomor Meja:</span>
            <input
              type="text"
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
              placeholder="Meja 01"
              className="w-24 px-2.5 py-1.5 text-xs font-bold text-center rounded-lg border border-amber-300 bg-amber-50 text-amber-950 focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-xs ${
                  isSelected
                    ? 'bg-[#3E2723] text-[#FAF3DD] shadow-md scale-[1.02]'
                    : 'bg-white text-stone-700 border border-[#E6D5C3] hover:bg-stone-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-[#8D6E63]'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Product Grid Catalog */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif italic font-bold text-lg text-[#3E2723]">
              {selectedCategory === 'Semua' ? 'Daftar Pilihan Menu' : selectedCategory}
            </h2>
            <span className="text-xs text-stone-500">{filteredProducts.length} menu tersedia</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-[#E6D5C3] text-center space-y-3">
              <Coffee className="w-12 h-12 text-stone-300 mx-auto" />
              <div className="font-bold text-stone-700 text-sm">Tidak ada menu yang sesuai</div>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Coba gunakan kata kunci pencarian lain atau pilih kategori menu di atas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredProducts.map((product) => {
                const isDrink = isDrinkCategory(product.category);
                const hasVariants = product.variants && product.variants.length > 0;

                return (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => handleOpenProductModal(product)}
                    className="bg-white rounded-3xl border border-[#E6D5C3] overflow-hidden shadow-xs hover:shadow-md hover:border-[#8D6E63] transition-all cursor-pointer flex flex-col justify-between group relative"
                  >
                    <div>
                      {/* Product Image */}
                      <div className="aspect-4/3 relative overflow-hidden bg-stone-100">
                        <img
                          src={product.image || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80'}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Category badge */}
                        <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {product.category}
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="p-3.5 space-y-1">
                        <h3 className="font-bold text-[#3E2723] text-xs sm:text-sm line-clamp-1 group-hover:text-amber-800 transition-colors">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price & Add Button */}
                    <div className="p-3.5 pt-0 flex items-center justify-between gap-2 mt-2">
                      <div>
                        <span className="text-[10px] text-stone-400 block font-medium">Mulai dari</span>
                        <span className="font-extrabold text-[#3E2723] text-xs sm:text-sm">
                          {formatRp(product.price)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProductModal(product);
                        }}
                        className="w-8 h-8 rounded-xl bg-[#3E2723] group-hover:bg-[#2B1713] text-[#FAF3DD] flex items-center justify-center shadow-xs transition-all shrink-0"
                        title="Pilih dan Tambah ke Pesanan"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !isCartOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto"
        >
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-[#2B1713] text-[#FAF3DD] p-4 rounded-2xl shadow-2xl border-2 border-amber-400/50 flex items-center justify-between gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-[#2B1713] flex items-center justify-center font-black text-sm relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#2B1713]">
                  {cartTotals.totalItems}
                </span>
              </div>
              <div className="text-left">
                <div className="text-[11px] text-[#D7CCC8]">{cartTotals.totalItems} item pesanan</div>
                <div className="text-sm font-black text-amber-300">{formatRp(cartTotals.total)}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-200">
              <span>Lihat Pesanan</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </motion.div>
      )}

      {/* Product Customization Bottom Sheet / Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="bg-[#FAF3DD] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border-t-2 sm:border-2 border-[#D4A373] text-[#3E2723] max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#E6D5C3] pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src={selectedProduct.image || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80'}
                  alt={selectedProduct.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-2xl object-cover border border-[#E6D5C3] shadow-xs"
                />
                <div>
                  <h3 className="font-serif italic font-bold text-base text-[#3E2723] leading-tight">
                    {selectedProduct.name}
                  </h3>
                  <div className="text-xs font-bold text-amber-900 mt-0.5">
                    {formatRp(
                      ((modalVariant?.price || (modalVariant ? selectedProduct.price + modalVariant.priceAdjustment : selectedProduct.price))) +
                        (modalCup === '18oz' ? 2000 : modalCup === '22oz' ? 4000 : 0)
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-xl bg-white/70 hover:bg-[#E6D5C3] text-[#8D6E63]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customization Options Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
              {/* Variants if any */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="bg-white p-3.5 rounded-2xl border border-[#E6D5C3]">
                  <label className="block font-bold text-gray-800 mb-2">Pilihan Varian Rasa / Tipe:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProduct.variants.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => setModalVariant(v)}
                        className={`p-2.5 rounded-xl text-left font-bold transition-all border ${
                          modalVariant?.name === v.name
                            ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723] shadow-xs'
                            : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <div className="text-xs">{v.name}</div>
                        <div className="text-[11px] opacity-80">{formatRp(v.price || (selectedProduct.price + v.priceAdjustment))}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cup Size & Ice Preference for drinks */}
              {isDrinkCategory(selectedProduct.category) && (
                <div className="bg-white p-3.5 rounded-2xl border border-[#E6D5C3] space-y-3">
                  <div>
                    <label className="block font-bold text-gray-800 mb-1.5">Ukuran Cup (Volume):</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['14oz', '16oz', '18oz', '22oz'] as const).map((cup) => (
                        <button
                          key={cup}
                          type="button"
                          onClick={() => setModalCup(cup)}
                          className={`py-2 rounded-xl text-center font-bold text-xs transition-all border ${
                            modalCup === cup
                              ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <div>{cup}</div>
                          <div className="text-[9px] opacity-70">
                            {cup === '18oz' ? '+2rb' : cup === '22oz' ? '+4rb' : 'Reguler'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1.5">Preferensi Suhu / Es:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Pakai Es', 'Tanpa Es'] as const).map((ice) => (
                        <button
                          key={ice}
                          type="button"
                          onClick={() => setModalIce(ice)}
                          className={`py-2 rounded-xl text-center font-bold text-xs transition-all border ${
                            modalIce === ice
                              ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {ice}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes for Kitchen / Barista */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#E6D5C3]">
                <label className="block font-bold text-gray-800 mb-1">
                  Catatan Khusus (misal: Less Sugar, Ekstra Manis, Pisah Sambal):
                </label>
                <input
                  type="text"
                  placeholder="Ketik catatan tambahan di sini..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-xs font-medium focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                />
              </div>

              {/* Quantity Counter */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#E6D5C3] flex items-center justify-between">
                <span className="font-bold text-gray-800">Jumlah Pesanan:</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModalQty((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-black text-sm text-[#3E2723]">{modalQty}</span>
                  <button
                    type="button"
                    onClick={() => setModalQty((prev) => prev + 1)}
                    className="w-8 h-8 rounded-xl bg-[#3E2723] hover:bg-[#2B1713] text-[#FAF3DD] flex items-center justify-center font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action */}
            <div className="pt-3 mt-3 border-t border-[#E6D5C3] shrink-0">
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full py-3 px-4 rounded-2xl bg-[#3E2723] hover:bg-[#2B1713] text-[#FAF3DD] font-black text-xs transition-all shadow-md flex items-center justify-between"
              >
                <span>Tambah ke Keranjang</span>
                <span className="text-amber-300 font-extrabold">
                  {formatRp(
                    (((modalVariant?.price || (modalVariant ? selectedProduct.price + modalVariant.priceAdjustment : selectedProduct.price))) +
                      (modalCup === '18oz' ? 2000 : modalCup === '22oz' ? 4000 : 0)) *
                      modalQty
                  )}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cart Drawer / Checkout Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="bg-[#FAF3DD] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border-t-2 sm:border-2 border-[#D4A373] text-[#3E2723] max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#3E2723] text-amber-300 flex items-center justify-center font-black text-sm">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif italic font-bold text-base text-[#3E2723]">
                    Keranjang Pesanan Anda
                  </h3>
                  <div className="text-[11px] text-stone-500">
                    {currentOutlet.name} • {tableNo || 'Meja 01'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-xl bg-white/70 hover:bg-[#E6D5C3] text-[#8D6E63]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
              <div className="space-y-2">
                {cart.map((item, idx) => {
                  const variantObj = typeof item.variant === 'object' ? item.variant : item.selectedVariant;
                  const variantPrice = variantObj?.price || (variantObj?.priceAdjustment ? item.product.price + variantObj.priceAdjustment : undefined);
                  const price = item.customPrice ?? item.unitPrice ?? variantPrice ?? item.product.price;
                  const variantLabel = variantObj?.name || (typeof item.variant === 'string' ? item.variant : undefined);
                  return (
                    <div
                      key={idx}
                      className="bg-white p-3 rounded-2xl border border-[#E6D5C3] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#3E2723] text-xs truncate">
                          {item.product.name}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                          {variantLabel && <span className="text-amber-900 font-semibold">{variantLabel}</span>}
                          {item.selectedCup && <span>• Cup {item.selectedCup}</span>}
                          {item.selectedIce && <span>• {item.selectedIce}</span>}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-amber-800 italic bg-amber-50 px-2 py-0.5 rounded mt-1 inline-block">
                            "{item.notes}"
                          </div>
                        )}
                        <div className="font-bold text-[#3E2723] text-xs mt-1">
                          {formatRp(price * item.quantity)}
                        </div>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(idx, -1)}
                          className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center font-black text-xs">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(idx, 1)}
                          className="w-7 h-7 rounded-lg bg-[#3E2723] text-white flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Customer Info Form */}
              <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-3 pt-2">
                <div className="bg-white p-3.5 rounded-2xl border border-[#E6D5C3] space-y-3">
                  <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5 border-b border-stone-100 pb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    Informasi Pemesan:
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Nama Lengkap / Panggilan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Kak Budi / Cindy"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-xs font-bold focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">
                        Nomor Meja <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={tableNo}
                        onChange={(e) => setTableNo(e.target.value)}
                        placeholder="Meja 01"
                        className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-xs font-bold focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">No. WhatsApp (Opsional)</label>
                      <input
                        type="text"
                        placeholder="0812-xxxx-xxxx"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-xs font-medium focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">Catatan Tambahan untuk Kasir:</label>
                    <input
                      type="text"
                      placeholder="misal: Tolong antar sedotan ekstra"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D4A373] bg-[#FAF8F5] text-xs font-medium focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                    />
                  </div>
                </div>

                {/* Payment Option Selection */}
                <div className="bg-white p-3.5 rounded-2xl border border-[#E6D5C3] space-y-2">
                  <label className="block font-bold text-gray-800 mb-1">Opsi Pembayaran:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentOption('cash_at_cashier')}
                      className={`p-3 rounded-xl text-left font-bold transition-all border flex flex-col justify-between ${
                        paymentOption === 'cash_at_cashier'
                          ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723] shadow-xs'
                          : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs mb-1">
                        <Banknote className="w-4 h-4 text-amber-300" />
                        <span>Bayar di Kasir</span>
                      </div>
                      <div className="text-[10px] opacity-80">Tunai / Kartu saat pesanan siap</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentOption('qris')}
                      className={`p-3 rounded-xl text-left font-bold transition-all border flex flex-col justify-between ${
                        paymentOption === 'qris'
                          ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723] shadow-xs'
                          : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs mb-1">
                        <QrCode className="w-4 h-4 text-amber-300" />
                        <span>QRIS Instan</span>
                      </div>
                      <div className="text-[10px] opacity-80">Scan langsung dari HP</div>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Bill Summary & Submit Button */}
            <div className="pt-3 mt-3 border-t border-[#E6D5C3] shrink-0 space-y-2.5">
              <div className="space-y-1 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal ({cartTotals.totalItems} item):</span>
                  <span className="font-bold text-stone-800">{formatRp(cartTotals.subtotal)}</span>
                </div>
                {cartTotals.tax > 0 && (
                  <div className="flex justify-between">
                    <span>PB1 / Pajak ({settings.taxPercentage}%):</span>
                    <span className="font-bold text-stone-800">{formatRp(cartTotals.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-[#3E2723] pt-1 border-t border-stone-200">
                  <span>Total Pembayaran:</span>
                  <span className="text-amber-900">{formatRp(cartTotals.total)}</span>
                </div>
              </div>

              <button
                type="submit"
                form="order-form"
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#3E2723] hover:bg-[#2B1713] disabled:bg-stone-400 text-[#FAF3DD] font-black text-xs transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-amber-300" />
                <span>{isSubmitting ? 'Mengirim Pesanan...' : 'KIRIM PESANAN KE KASIR & DAPUR'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
