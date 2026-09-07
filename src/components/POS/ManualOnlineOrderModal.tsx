import React, { useState, useMemo } from 'react';
import { Product, ProductVariant, Transaction, User, StoreSettings, Ingredient, OnlinePlatform } from '../../types';
import { formatRp } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  Sparkles,
  ShoppingBag,
  Bike,
  CheckCircle,
  AlertCircle,
  Coffee,
  Utensils,
  Cookie,
  Grid,
} from 'lucide-react';

interface ManualOnlineOrderModalProps {
  products: Product[];
  ingredients: Ingredient[];
  user: User;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onCompleteOnlineOrder: (tx: Transaction) => void;
}

interface OnlineOrderItem {
  product: Product;
  quantity: number;
  selectedVariant?: ProductVariant;
  selectedCup?: '14oz' | '16oz' | '18oz' | '22oz';
  selectedIce?: 'Pakai Es' | 'Tanpa Es';
  notes?: string;
  unitPrice: number;
  totalPrice: number;
  cogsTotal: number;
}

export const ManualOnlineOrderModal: React.FC<ManualOnlineOrderModalProps> = ({
  products,
  ingredients,
  user,
  settings,
  isOpen,
  onClose,
  onCompleteOnlineOrder,
}) => {
  if (!isOpen) return null;

  // Platform selection
  const [selectedPlatform, setSelectedPlatform] = useState<OnlinePlatform>('ShopeeFood');
  const [onlineOrderNo, setOnlineOrderNo] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Discount / Promotion from app
  const [merchantDiscount, setMerchantDiscount] = useState<number>(0);

  // Cart for online order
  const [items, setItems] = useState<OnlineOrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Active item customization modal (if product has cup or variants)
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [customCup, setCustomCup] = useState<'14oz' | '16oz' | '18oz' | '22oz'>('16oz');
  const [customIce, setCustomIce] = useState<'Pakai Es' | 'Tanpa Es'>('Pakai Es');
  const [customVariant, setCustomVariant] = useState<ProductVariant | undefined>(undefined);
  const [customNotes, setCustomNotes] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available Categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category)));
    return ['Semua', ...cats];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch && p.isAvailable;
    });
  }, [products, selectedCategory, searchQuery]);

  // Add product to online items
  const handleQuickAdd = (product: Product) => {
    const isDrink =
      product.category.toLowerCase().includes('kopi') ||
      product.category.toLowerCase().includes('minuman') ||
      product.category.toLowerCase().includes('brew');

    const hasOptions = (product.variants && product.variants.length > 0) || (product.cupOptions && product.cupOptions.length > 0) || isDrink;

    if (hasOptions) {
      setCustomizingProduct(product);
      setCustomCup((product.cupOptions?.[0] as any) || '16oz');
      setCustomIce(product.hasIceOption ? 'Pakai Es' : 'Tanpa Es');
      setCustomVariant(product.variants?.[0] || undefined);
      setCustomNotes('');
      return;
    }

    // Direct add
    commitAddItem(product, undefined, undefined, undefined, '');
  };

  const commitAddItem = (
    product: Product,
    variant?: ProductVariant,
    cup?: '14oz' | '16oz' | '18oz' | '22oz',
    ice?: 'Pakai Es' | 'Tanpa Es',
    notes?: string
  ) => {
    let finalUnitPrice = product.price;
    if (variant) {
      finalUnitPrice += variant.priceAdjustment;
    }
    if (cup === '18oz') finalUnitPrice += 2000;
    if (cup === '22oz') finalUnitPrice += 4000;

    const cogsUnit = product.cogs + (variant?.cogsAdjustment || 0);

    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) =>
          it.product.id === product.id &&
          it.selectedVariant?.id === variant?.id &&
          it.selectedCup === cup &&
          it.selectedIce === ice &&
          (it.notes || '') === (notes || '')
      );

      if (existingIdx !== -1) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          totalPrice: newQty * item.unitPrice,
          cogsTotal: newQty * cogsUnit,
        };
        return updated;
      }

      return [
        ...prev,
        {
          product,
          quantity: 1,
          selectedVariant: variant,
          selectedCup: cup,
          selectedIce: ice,
          notes,
          unitPrice: finalUnitPrice,
          totalPrice: finalUnitPrice,
          cogsTotal: cogsUnit,
        },
      ];
    });

    setCustomizingProduct(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, idx) => idx !== index);
      }
      const cogsUnit = item.product.cogs + (item.selectedVariant?.cogsAdjustment || 0);
      updated[index] = {
        ...item,
        quantity: newQty,
        totalPrice: newQty * item.unitPrice,
        cogsTotal: newQty * cogsUnit,
      };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + it.totalPrice, 0);
  const totalCogs = items.reduce((acc, it) => acc + it.cogsTotal, 0);
  const discountAmount = Math.max(0, Math.min(subtotal, merchantDiscount));
  const netTotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = settings.taxPercentage > 0 ? Math.round(netTotal * (settings.taxPercentage / 100)) : 0;
  const grandTotal = netTotal + taxAmount;
  const grossProfit = netTotal - totalCogs;

  // Process and Submit
  const handleSaveAndProcess = () => {
    if (items.length === 0) {
      setErrorMessage('Pilih minimal satu menu untuk pesanan online.');
      return;
    }

    const cleanOrderNo = onlineOrderNo.trim() || `${selectedPlatform === 'ShopeeFood' ? 'SF' : selectedPlatform === 'GoFood' ? 'GF' : 'GRB'}-${Math.floor(1000 + Math.random() * 9000)}`;

    const nowIso = new Date().toISOString();
    const invoiceNo = `ONL-${nowIso.split('T')[0].replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const paymentMethodMap: Record<OnlinePlatform, 'shopeefood' | 'gofood' | 'grabfood' | 'gopay_shopee'> = {
      ShopeeFood: 'shopeefood',
      GoFood: 'gofood',
      GrabFood: 'grabfood',
      Maxim: 'gopay_shopee',
      Lainnya: 'gopay_shopee',
    };

    const activeOutlet = StorageService.getActiveOutlet();

    const newTx: Transaction = {
      id: 'tx-online-' + Date.now(),
      invoiceNo,
      timestamp: nowIso,
      outletId: activeOutlet?.id,
      outletName: activeOutlet?.name,
      cashierId: user.id,
      cashierName: user.name,
      customerName: customerName.trim() || `Pelanggan ${selectedPlatform}`,
      customerPhone: '',
      tableNo: `Pesanan Online (${selectedPlatform})`,
      orderType: 'online_delivery',
      onlinePlatform: selectedPlatform,
      onlineOrderNo: cleanOrderNo,
      driverName: driverName.trim() || undefined,
      items: items.map((it) => ({
        productId: it.product.id,
        productName: it.product.name,
        ...(it.selectedVariant?.name ? { variantName: it.selectedVariant.name } : {}),
        ...(it.selectedCup ? { selectedCup: it.selectedCup } : {}),
        ...(it.selectedIce ? { selectedIce: it.selectedIce } : {}),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        cogsUnitPrice: it.product.cogs + (it.selectedVariant?.cogsAdjustment || 0),
        cogsTotal: it.cogsTotal,
        ...(it.notes ? { notes: it.notes } : {}),
      })),
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: grandTotal,
      totalCogs,
      grossProfit,
      paymentMethod: paymentMethodMap[selectedPlatform] || 'shopeefood',
      cashAmountPaid: grandTotal,
      changeAmount: 0,
      status: 'completed',
    };

    onCompleteOnlineOrder(newTx);
    onClose();
  };

  const getPlatformColors = (platform: OnlinePlatform) => {
    switch (platform) {
      case 'ShopeeFood':
        return {
          active: 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20',
          badge: 'bg-orange-100 text-orange-800 border-orange-300',
          icon: 'text-orange-500',
          name: 'ShopeeFood Merchant',
        };
      case 'GoFood':
        return {
          active: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20',
          badge: 'bg-red-100 text-red-800 border-red-300',
          icon: 'text-red-600',
          name: 'GoBiz (GoFood)',
        };
      case 'GrabFood':
        return {
          active: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: 'text-emerald-600',
          name: 'GrabFood Merchant',
        };
      default:
        return {
          active: 'bg-[#3E2723] text-white border-[#3E2723] shadow-md',
          badge: 'bg-[#F2EFE9] text-[#3E2723] border-[#D7CCC8]',
          icon: 'text-[#3E2723]',
          name: 'Pesanan Online Lainnya',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] rounded-[32px] max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#EBE3D5] overflow-hidden">
        {/* Header Modal */}
        <div className="bg-[#3E2723] text-[#FDFBF7] p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/20 rounded-2xl border border-orange-400/30 text-orange-400">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg sm:text-xl text-[#FDFBF7]">
                  Pencatatan Pesanan Online (Manual Entry)
                </h3>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  GoBiz & ShopeeFood
                </span>
              </div>
              <p className="text-xs text-[#D7CCC8]">
                Input order dari aplikasi mitra ojol agar stok bahan & laporan non-tunai sinkron otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#D7CCC8] hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Platform Selector, Order Details & Item Selection */}
          <div className="lg:col-span-7 space-y-4">
            {/* Step 1: Platform Selection */}
            <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8D7B68] block">
                1. Pilih Aplikasi Mitra Online
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['ShopeeFood', 'GoFood', 'GrabFood', 'Lainnya'] as OnlinePlatform[]).map((platform) => {
                  const isSelected = selectedPlatform === platform;
                  const colors = getPlatformColors(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setSelectedPlatform(platform)}
                      className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? colors.active
                          : 'bg-[#FAF8F5] text-[#3E2723] border-[#EBE3D5] hover:bg-[#F2EFE9]'
                      }`}
                    >
                      <span className="text-base">
                        {platform === 'ShopeeFood' ? '🧡' : platform === 'GoFood' ? '💚' : platform === 'GrabFood' ? '🟢' : '🌐'}
                      </span>
                      <span>{platform}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Order Metadata */}
            <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8D7B68] block">
                2. Detail Pesanan dari Aplikasi {selectedPlatform}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#5D4037] block mb-1">
                    No. Pesanan / Order ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`cth: ${selectedPlatform === 'ShopeeFood' ? 'SF-10928' : selectedPlatform === 'GoFood' ? 'GF-8841' : 'ORD-123'}`}
                    value={onlineOrderNo}
                    onChange={(e) => setOnlineOrderNo(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D7CCC8] bg-[#FAF8F5] text-xs font-bold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5D4037] block mb-1">
                    Nama Pemesan di App
                  </label>
                  <input
                    type="text"
                    placeholder="cth: Kak Rina / Budi"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D7CCC8] bg-[#FAF8F5] text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5D4037] block mb-1">
                    Nama Driver / Plat Nomor (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="cth: Pak Joko - B 4567 SQ"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D7CCC8] bg-[#FAF8F5] text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5D4037] block mb-1">
                    Diskon/Potongan Promo Merchant (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="cth: 5000"
                    value={merchantDiscount || ''}
                    onChange={(e) => setMerchantDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D7CCC8] bg-[#FAF8F5] text-xs font-bold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Product Picker */}
            <div className="bg-white p-4 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#8D7B68]">
                  3. Pilih Menu Pesanan
                </label>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#D7CCC8] text-xs bg-[#FAF8F5] focus:outline-none focus:border-[#8D7B68]"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#3E2723] text-white'
                        : 'bg-[#F2EFE9] text-[#5D4037] hover:bg-[#EBE3D5]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleQuickAdd(product)}
                    className="p-2.5 rounded-2xl border border-[#EBE3D5] bg-[#FAF8F5] hover:bg-[#F2EFE9] text-left transition-all hover:border-[#8D7B68] flex flex-col justify-between group"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#3E2723] line-clamp-1 group-hover:text-[#8D7B68]">
                        {product.name}
                      </div>
                      <div className="text-[10px] text-[#8D7B68] line-clamp-1">{product.category}</div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#EBE3D5]">
                      <span className="font-black text-xs text-[#3E2723]">{formatRp(product.price)}</span>
                      <span className="w-5 h-5 rounded-full bg-[#3E2723] text-white flex items-center justify-center text-xs font-bold">
                        +
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Checkout Trigger */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-white p-4 sm:p-5 rounded-2xl border border-[#EBE3D5] shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-[#EBE3D5] pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[#3E2723]" />
                  <h4 className="font-serif font-bold text-base text-[#3E2723]">Rincian Pesanan</h4>
                </div>
                <span className="text-xs bg-[#F2EFE9] text-[#3E2723] px-2.5 py-1 rounded-full font-bold">
                  {items.reduce((acc, it) => acc + it.quantity, 0)} Item
                </span>
              </div>

              {errorMessage && (
                <div className="mt-3 bg-red-50 text-red-800 p-2.5 rounded-xl border border-red-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              {/* Items List */}
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="text-center py-10 text-[#8D7B68]">
                    <Bike className="w-10 h-10 mx-auto text-[#D7CCC8] mb-2 opacity-60" />
                    <p className="text-xs font-bold">Belum ada menu yang dipilih</p>
                    <p className="text-[10px] text-[#A1887F] mt-0.5">
                      Klik produk pada daftar di sebelah kiri untuk memasukkan pesanan
                    </p>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-[#EBE3D5] bg-[#FAF8F5] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#3E2723] truncate">{item.product.name}</div>
                        <div className="text-[10px] text-[#8D7B68] flex gap-1 flex-wrap">
                          {item.selectedCup && <span>Cup {item.selectedCup}</span>}
                          {item.selectedIce && <span>• {item.selectedIce}</span>}
                          {item.selectedVariant && <span>• {item.selectedVariant.name}</span>}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] italic text-amber-800 truncate">* {item.notes}</div>
                        )}
                        <div className="text-[11px] font-black text-[#5D4037] mt-0.5">
                          {formatRp(item.totalPrice)}
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 rounded-xl border border-[#D7CCC8]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(idx, -1)}
                          className="w-5 h-5 rounded-lg bg-[#F2EFE9] text-[#3E2723] hover:bg-[#EBE3D5] flex items-center justify-center font-bold text-xs"
                        >
                          -
                        </button>
                        <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(idx, 1)}
                          className="w-5 h-5 rounded-lg bg-[#3E2723] text-white hover:bg-[#5D4037] flex items-center justify-center font-bold text-xs"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="ml-1 text-red-500 hover:text-red-700 p-1"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Price Calculations & Checkout Actions */}
            <div className="border-t border-[#EBE3D5] pt-3 space-y-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-[#8D7B68]">
                  <span>Subtotal Item:</span>
                  <span className="font-bold text-[#3E2723]">{formatRp(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Diskon Promo:</span>
                    <span>-{formatRp(discountAmount)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-[#8D7B68]">
                    <span>PPN ({settings.taxPercentage}%):</span>
                    <span>{formatRp(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-serif font-black text-[#3E2723] pt-1.5 border-t border-[#EBE3D5]">
                  <span>Total Tagihan:</span>
                  <span className="text-[#3E2723]">{formatRp(grandTotal)}</span>
                </div>
                {user?.role === 'admin' && (
                  <div className="flex justify-between text-[11px] text-[#8D7B68] bg-[#F2EFE9] px-2.5 py-1 rounded-xl mt-1">
                    <span>Modal HPP Bahan: {formatRp(totalCogs)}</span>
                    <span className="font-bold text-emerald-800">Laba Kotor: {formatRp(grossProfit)}</span>
                  </div>
                )}
              </div>

              {/* Settlement Notice */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-[11px] leading-tight flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Metode: Settlement {selectedPlatform} (Non-Tunai)</strong>
                  <p className="text-[10px] text-amber-800 mt-0.5">
                    Stok bahan baku otomatis terpotong & fisik uang kas di laci kasir tetap aman tidak berkurang.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleSaveAndProcess}
                  disabled={items.length === 0}
                  className="w-full py-3.5 rounded-2xl bg-[#3E2723] hover:bg-[#5D4037] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Simpan & Cetak Struk Pesanan {selectedPlatform}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Customization Sub-Modal (Cup / Variant / Ice / Notes) */}
        {customizingProduct && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-[28px] max-w-sm w-full p-5 shadow-2xl border border-[#EBE3D5] space-y-4">
              <div className="flex items-center justify-between border-b border-[#EBE3D5] pb-2">
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#3E2723]">{customizingProduct.name}</h4>
                  <p className="text-[11px] text-[#8D7B68]">{formatRp(customizingProduct.price)}</p>
                </div>
                <button onClick={() => setCustomizingProduct(null)} className="text-[#8D7B68] hover:text-[#3E2723]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cup Options */}
              {customizingProduct.cupOptions && customizingProduct.cupOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1.5">
                    Ukuran Cup
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {customizingProduct.cupOptions.map((cup) => (
                      <button
                        key={cup}
                        type="button"
                        onClick={() => setCustomCup(cup)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          customCup === cup
                            ? 'bg-[#3E2723] text-white border-[#3E2723]'
                            : 'bg-[#FAF8F5] text-[#3E2723] border-[#EBE3D5]'
                        }`}
                      >
                        {cup}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ice Options */}
              {customizingProduct.hasIceOption && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1.5">
                    Opsi Es Batu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Pakai Es', 'Tanpa Es'].map((ice) => (
                      <button
                        key={ice}
                        type="button"
                        onClick={() => setCustomIce(ice as any)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          customIce === ice
                            ? 'bg-cyan-800 text-white border-cyan-800'
                            : 'bg-[#FAF8F5] text-[#3E2723] border-[#EBE3D5]'
                        }`}
                      >
                        {ice}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1">
                  Catatan Menu (cth: Less Sugar)
                </label>
                <input
                  type="text"
                  placeholder="Catatan khusus dari aplikasi..."
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7CCC8] bg-[#FAF8F5] text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  commitAddItem(
                    customizingProduct,
                    customVariant,
                    customCup,
                    customIce,
                    customNotes
                  )
                }
                className="w-full py-3 rounded-xl bg-[#3E2723] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#5D4037]"
              >
                + Tambahkan ke Pesanan Online
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
