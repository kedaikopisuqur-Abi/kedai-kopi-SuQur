import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Phone,
  Store,
  MapPin,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageCircle,
  Coffee,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Send,
  CreditCard,
  QrCode,
  Info,
  Check,
  Search,
  Filter,
} from 'lucide-react';
import {
  Product,
  CartItem,
  ProductVariant,
  Outlet,
  StoreSettings,
  PreOrder,
  PreOrderType,
} from '../types';
import { formatRp, formatDate } from '../utils/formatters';
import { StorageService } from '../services/storage';

interface CustomerPOPageProps {
  initialOutletId?: string;
  onExitToPOS?: () => void;
}

export const CustomerPOPage: React.FC<CustomerPOPageProps> = ({
  initialOutletId,
  onExitToPOS,
}) => {
  // Outlet & Settings resolution
  const [outlets, setOutlets] = useState<Outlet[]>(() => StorageService.getOutlets());
  const [settings, setSettings] = useState<StoreSettings>(() => StorageService.getSettings());
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());

  // URL query params
  const [selectedOutletId, setSelectedOutletId] = useState<string>(() => {
    if (initialOutletId) return initialOutletId;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('outlet') || p.get('outletId') || StorageService.getActiveOutletId();
    }
    return StorageService.getActiveOutletId();
  });

  const activeOutlet = useMemo(() => {
    const found = outlets.find((o) => o.id === selectedOutletId);
    return found || outlets[0] || {
      id: 'outlet-main',
      name: 'Kedai Kopi Wahid Su-Qur',
      address: 'Jl. Lagoa Terusan No. 12, Koja, Jakarta Utara',
      phone: '0812-9988-1001',
      isDefault: true,
      isActive: true,
    };
  }, [outlets, selectedOutletId]);

  // Form State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [orderType, setOrderType] = useState<PreOrderType>('PICKUP');

  // Today & Tomorrow date calculation
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [scheduledDate, setScheduledDate] = useState<string>(tomorrowStr);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Menu Selection & Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [itemNote, setItemNote] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  // DP (Uang Muka) Selection
  const [dpOption, setDpOption] = useState<'NONE' | '50_PERCENT' | 'FULL'>('50_PERCENT');

  // Form submission states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedPO, setSubmittedPO] = useState<PreOrder | null>(null);

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.isAvailable !== false && p.category) {
        set.add(p.category);
      }
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Filtered available products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isAvailable === false) return false;
      if (selectedCategory !== 'Semua' && p.category !== selectedCategory) return false;
      if (menuSearchQuery.trim()) {
        const q = menuSearchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const matchCat = (p.category || '').toLowerCase().includes(q);
        return matchName || matchDesc || matchCat;
      }
      return true;
    });
  }, [products, selectedCategory, menuSearchQuery]);

  // Cart Totals
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const depositAmount = useMemo(() => {
    if (dpOption === 'NONE') return 0;
    if (dpOption === '50_PERCENT') return Math.round(totalAmount * 0.5);
    return totalAmount; // FULL
  }, [totalAmount, dpOption]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, totalAmount - depositAmount);
  }, [totalAmount, depositAmount]);

  // Add product to cart handlers
  const handleOpenCustomize = (product: Product) => {
    setCustomizingProduct(product);
    setSelectedVariant(product.variants && product.variants.length > 0 ? product.variants[0] : null);
    setItemNote('');
    setItemQuantity(1);
  };

  const handleConfirmAddToCart = () => {
    if (!customizingProduct) return;

    const unitPrice = selectedVariant
      ? customizingProduct.price + selectedVariant.priceAdjustment
      : customizingProduct.price;

    const cogsUnit = (customizingProduct.cogs || 0) + (selectedVariant?.cogsAdjustment || 0);

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (it) =>
          it.product.id === customizingProduct.id &&
          it.selectedVariant?.id === selectedVariant?.id &&
          (it.notes || '') === itemNote.trim()
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + itemQuantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          totalPrice: newQty * existing.unitPrice,
          cogsTotal: newQty * cogsUnit,
        };
        return updated;
      } else {
        const newItem: CartItem = {
          product: customizingProduct,
          selectedVariant: selectedVariant || undefined,
          quantity: itemQuantity,
          unitPrice,
          totalPrice: unitPrice * itemQuantity,
          cogsTotal: cogsUnit * itemQuantity,
          notes: itemNote.trim() || undefined,
        };
        return [...prev, newItem];
      }
    });

    setCustomizingProduct(null);
  };

  const handleQuickAdd = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      handleOpenCustomize(product);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.product.id === product.id && !it.selectedVariant && !it.notes
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + 1;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          totalPrice: newQty * existing.unitPrice,
          cogsTotal: newQty * (product.cogs || 0),
        };
        return updated;
      } else {
        const newItem: CartItem = {
          product,
          quantity: 1,
          unitPrice: product.price,
          totalPrice: product.price,
          cogsTotal: product.cogs || 0,
        };
        return [...prev, newItem];
      }
    });
  };

  const handleUpdateCartQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        const cogsUnit = item.cogsTotal / item.quantity;
        updated[index] = {
          ...item,
          quantity: newQty,
          totalPrice: newQty * item.unitPrice,
          cogsTotal: newQty * cogsUnit,
        };
      }
      return updated;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Pre-Order Form
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Form Validations
    if (!customerName.trim()) {
      setFormError('Silakan masukkan nama lengkap pemesan.');
      return;
    }

    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 9) {
      setFormError('Nomor WhatsApp tidak valid (minimal 9 digit).');
      return;
    }

    if (!scheduledDate) {
      setFormError('Silakan pilih tanggal pengambilan / acara.');
      return;
    }

    if (scheduledDate < todayStr) {
      setFormError('Tanggal pengambilan tidak boleh di masa lampau.');
      return;
    }

    if (!scheduledTime) {
      setFormError('Silakan tentukan jam pengambilan.');
      return;
    }

    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      setFormError('Silakan isi alamat lengkap pengiriman pesanan.');
      return;
    }

    if (cart.length === 0) {
      setFormError('Silakan pilih minimal 1 item menu untuk Pre-Order.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate PO Number
      const datePart = scheduledDate.replace(/-/g, '').slice(2);
      const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
      const poNumber = `PO-${datePart}-${randomSuffix}`;

      const newPreOrder: PreOrder = {
        id: `po-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        poNumber,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        outletId: activeOutlet.id,
        outletName: activeOutlet.name,
        orderType,
        scheduledDate,
        scheduledTime,
        items: cart,
        totalAmount,
        depositAmount,
        remainingBalance,
        paymentStatus: depositAmount >= totalAmount ? 'PAID' : depositAmount > 0 ? 'PARTIAL_DP' : 'UNPAID',
        orderStatus: 'SCHEDULED',
        deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        tableNumber: orderType === 'DINE_IN_RESERVATION' ? tableNumber.trim() || 'Reservasi Meja' : undefined,
        notes: notes.trim() || undefined,
        dpPaymentMethod: depositAmount > 0 ? 'TRANSFER' : 'CASH',
        createdAt: new Date().toISOString(),
        createdBy: 'Pelanggan (Form PO Publik)',
      };

      // Save to storage
      const saved = StorageService.savePreOrder(newPreOrder, false);

      // Dispatch event for real-time notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('realtime_preorder_pushed', { detail: saved }));
        window.dispatchEvent(new CustomEvent('realtime_qr_order_pushed', { detail: saved }));
      }

      setSubmittedPO(saved);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Submit Pre-Order error:', err);
      setFormError(err?.message || 'Gagal menyimpan pesanan. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp confirmation builder
  const handleOpenWhatsAppConfirmation = (po: PreOrder) => {
    let storePhone = (settings.phone || settings.storePhone || activeOutlet.phone || '081299881001').replace(/[^0-9]/g, '');
    if (storePhone.startsWith('0')) {
      storePhone = '62' + storePhone.substring(1);
    }

    const itemsSummary = po.items
      .map(
        (it) =>
          `• ${it.quantity}x ${it.product.name}${it.selectedVariant ? ` (${it.selectedVariant.name})` : ''} = ${formatRp(it.totalPrice)}`
      )
      .join('%0A');

    const typeLabel =
      po.orderType === 'PICKUP' ? 'Ambil di Kedai (Pick-up)' :
      po.orderType === 'DELIVERY' ? 'Antar Alamat (Delivery)' : 'Reservasi Meja (Dine-in)';

    const text =
      `*KONFIRMASI PRE-ORDER KEDAI SU-QUR*%0A%0A` +
      `*No. Pesanan:* ${po.poNumber}%0A` +
      `*Nama Pemesan:* ${po.customerName}%0A` +
      `*No. WhatsApp:* ${po.customerPhone}%0A` +
      `*Cabang Outlet:* ${po.outletName}%0A` +
      `*Tipe Pesanan:* ${typeLabel}%0A` +
      `*Jadwal:* ${formatDate(po.scheduledDate)} pukul ${po.scheduledTime} WIB%0A` +
      (po.deliveryAddress ? `*Alamat Kirim:* ${po.deliveryAddress}%0A` : '') +
      (po.tableNumber ? `*Meja/Tamu:* ${po.tableNumber}%0A` : '') +
      `%0A*Rincian Menu:*%0A${itemsSummary}%0A%0A` +
      `*Total Biaya:* ${formatRp(po.totalAmount)}%0A` +
      `*Uang Muka (DP):* ${formatRp(po.depositAmount)}%0A` +
      `*Sisa Pelunasan:* ${formatRp(po.remainingBalance)}%0A` +
      (po.notes ? `*Catatan Khusus:* ${po.notes}%0A%0A` : '%0A') +
      `Halo Admin Kedai Su-Qur, saya telah mengisi Form PO online di atas. Mohon bantu konfirmasi dan proses pesanan saya. Terima kasih! 🙏`;

    window.open(`https://wa.me/${storePhone}?text=${text}`, '_blank');
  };

  const handleResetForm = () => {
    setSubmittedPO(null);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setDeliveryAddress('');
    setTableNumber('');
    setScheduledDate(tomorrowStr);
    setScheduledTime('10:00');
    setDpOption('50_PERCENT');
    setFormError(null);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2B1713] flex flex-col font-sans selection:bg-[#D4A373] selection:text-[#1F1412]">
      {/* Top Navigation / Brand Header */}
      <header className="sticky top-0 z-30 bg-[#3E2723] text-[#FDFBF7] shadow-md border-b border-[#5D4037] px-4 py-3.5 sm:py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-black shadow-inner shrink-0">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-base sm:text-lg text-amber-100 leading-tight">
                  {settings.storeName || 'Kedai Kopi Wahid Su-Qur'}
                </h1>
                <span className="text-[10px] bg-amber-400 text-[#2B1713] px-2 py-0.5 rounded-full font-black uppercase tracking-wider hidden sm:inline-block">
                  Form PO Publik
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80 flex items-center gap-1.5 mt-0.5">
                <Store className="w-3 h-3 text-amber-400" />
                <span>{activeOutlet.name}</span>
                <span className="text-amber-500">•</span>
                <span className="truncate max-w-[200px] sm:max-w-none">{activeOutlet.address}</span>
              </p>
            </div>
          </div>

          {onExitToPOS && (
            <button
              onClick={onExitToPOS}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kasir POS</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-28">
        {/* SUCCESS CONFIRMATION SCREEN */}
        {submittedPO ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-emerald-400/50 space-y-6 text-center"
          >
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center border-2 border-emerald-300 shadow-sm animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block">
                Pre-Order Berhasil Diterima
              </span>
              <h2 className="font-serif font-black text-2xl sm:text-3xl text-[#2B1713]">
                Terima Kasih, Kak {submittedPO.customerName}!
              </h2>
              <p className="text-xs sm:text-sm text-[#5D4037] max-w-lg mx-auto">
                Pesanan Pre-Order Anda telah tercatat otomatis di sistem dapur Kedai Su-Qur dengan nomor registrasi di bawah.
              </p>
            </div>

            {/* PO Summary Card */}
            <div className="bg-[#FAF3DD] rounded-2xl p-5 border border-[#D4A373] text-left space-y-3.5 max-w-md mx-auto shadow-xs">
              <div className="flex items-center justify-between border-b border-[#D4A373]/50 pb-2.5">
                <span className="text-xs font-bold text-[#5D4037]">Nomor Pre-Order</span>
                <span className="font-mono font-black text-base sm:text-lg text-[#3E2723] bg-white px-2.5 py-0.5 rounded-lg border border-[#D4A373]">
                  {submittedPO.poNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-[#795548] block">Jadwal Pengambilan:</span>
                  <span className="font-bold text-[#2B1713]">
                    {formatDate(submittedPO.scheduledDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#795548] block">Jam Pengambilan:</span>
                  <span className="font-bold text-[#2B1713]">{submittedPO.scheduledTime} WIB</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#795548] block">Tipe Pemesanan:</span>
                  <span className="font-bold text-[#2B1713]">
                    {submittedPO.orderType === 'PICKUP'
                      ? 'Ambil Sendiri (Pick-up)'
                      : submittedPO.orderType === 'DELIVERY'
                      ? 'Delivery'
                      : 'Reservasi Meja'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#795548] block">Cabang Outlet:</span>
                  <span className="font-bold text-[#2B1713]">{submittedPO.outletName}</span>
                </div>
              </div>

              {submittedPO.deliveryAddress && (
                <div className="text-xs bg-white/70 p-2.5 rounded-xl border border-[#D4A373]/40">
                  <span className="text-[10px] font-bold text-[#795548] uppercase block">Alamat Kirim:</span>
                  <span className="font-medium text-[#2B1713]">{submittedPO.deliveryAddress}</span>
                </div>
              )}

              {/* Items List */}
              <div className="border-t border-[#D4A373]/50 pt-2.5 space-y-1.5">
                <span className="text-xs font-bold text-[#5D4037] block">Menu Dipesan:</span>
                {submittedPO.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-[#3E2723]">
                    <span>
                      {item.quantity}x {item.product.name}
                      {item.selectedVariant && (
                        <span className="text-[11px] text-[#795548]"> ({item.selectedVariant.name})</span>
                      )}
                    </span>
                    <span className="font-semibold">{formatRp(item.totalPrice || item.subtotal || 0)}</span>
                  </div>
                ))}
              </div>

              {/* Total Calculation */}
              <div className="border-t border-[#D4A373] pt-2.5 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-sm text-[#2B1713]">
                  <span>Total Tagihan</span>
                  <span>{formatRp(submittedPO.totalAmount)}</span>
                </div>
                {submittedPO.depositAmount > 0 && (
                  <>
                    <div className="flex justify-between text-emerald-800">
                      <span>Uang Muka (DP Disepakati)</span>
                      <span>{formatRp(submittedPO.depositAmount)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Sisa Pelunasan Saat Ambil</span>
                      <span>{formatRp(submittedPO.remainingBalance)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="max-w-md mx-auto space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handleOpenWhatsAppConfirmation(submittedPO)}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 fill-white" />
                <span>Konfirmasi via WhatsApp Kedai</span>
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                className="w-full py-3 px-4 rounded-2xl bg-[#EBE3D5] hover:bg-[#D4A373]/40 text-[#3E2723] font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Pesanan Pre-Order Baru</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* PRE-ORDER FORM */
          <form onSubmit={handleSubmitPO} className="space-y-6">
            {/* Intro Hero Card */}
            <div className="bg-[#3E2723] text-[#FDFBF7] rounded-3xl p-5 sm:p-6 shadow-xl border border-[#5D4037] relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Katering, Acara & Pesanan Terjadwal</span>
                </div>
                <h2 className="font-serif font-black text-xl sm:text-2xl text-amber-100">
                  Formulir Pre-Order & Reservasi Jadwal
                </h2>
                <p className="text-xs sm:text-sm text-amber-200/80 max-w-xl leading-relaxed">
                  Pesan menu kopi, minuman, dan camilan favorit Anda terlebih dahulu untuk diambil sesuai jam keinginan Anda atau diantar ke lokasi acara.
                </p>
              </div>
              <div className="absolute right-[-20px] top-[-20px] w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Form Error Banner */}
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3 shadow-xs"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </motion.div>
            )}

            {/* STEP 1: INFORMASI PEMESAN */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#E6D5C3] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#E6D5C3]/60 pb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-300">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#2B1713]">Data Diri Pemesan</h3>
                  <p className="text-[11px] text-[#795548]">Untuk konfirmasi pesanan dan penerimaan notifikasi</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1.5">
                    Nama Lengkap Pemesan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#A1887F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Contoh: Bpk. Hendra Wijaya"
                      className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] text-[#2B1713] rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1.5">
                    Nomor WhatsApp Aktif <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#A1887F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] text-[#2B1713] rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Outlet Selector (if multiple) */}
              {outlets.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1.5">
                    Pilih Cabang Outlet Kedai
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {outlets.map((out) => (
                      <button
                        key={out.id}
                        type="button"
                        onClick={() => setSelectedOutletId(out.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                          selectedOutletId === out.id
                            ? 'bg-[#FAF3DD] border-amber-600 ring-2 ring-amber-400/40 shadow-xs'
                            : 'bg-white border-[#E6D5C3] hover:border-[#D4A373]'
                        }`}
                      >
                        <Store className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#2B1713]">{out.name}</div>
                          <div className="text-[10px] text-[#795548] truncate">{out.address}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* STEP 2: JENIS PESANAN & JADWAL */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#E6D5C3] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#E6D5C3]/60 pb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-300">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#2B1713]">Tipe & Jadwal Pengambilan</h3>
                  <p className="text-[11px] text-[#795548]">Pilih cara pengambilan dan tentukan tanggal & waktu</p>
                </div>
              </div>

              {/* Order Type Selection */}
              <div>
                <label className="block text-xs font-bold text-[#5D4037] mb-2">
                  Tipe Pemesanan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      type: 'PICKUP' as PreOrderType,
                      label: 'Pick-up / Ambil Sendiri',
                      desc: 'Ambil di kasir outlet kedai',
                      icon: ShoppingBag,
                    },
                    {
                      type: 'DELIVERY' as PreOrderType,
                      label: 'Delivery / Kirim',
                      desc: 'Diantar kurir ke alamat Anda',
                      icon: Truck,
                    },
                    {
                      type: 'DINE_IN_RESERVATION' as PreOrderType,
                      label: 'Reservasi Meja',
                      desc: 'Makan/minum di tempat',
                      icon: UtensilsCrossed,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isSelected = orderType === tab.type;
                    return (
                      <button
                        key={tab.type}
                        type="button"
                        onClick={() => setOrderType(tab.type)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#FAF3DD] border-amber-600 ring-2 ring-amber-400/40 shadow-xs'
                            : 'bg-white border-[#E6D5C3] hover:border-[#D4A373]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-amber-700' : 'text-[#795548]'}`} />
                          {isSelected && <Check className="w-4 h-4 text-amber-700" />}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-[#2B1713] block">{tab.label}</span>
                          <span className="text-[10px] text-[#795548] leading-tight block">{tab.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1.5">
                    Tanggal Pengambilan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[#A1887F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] text-[#2B1713] rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5D4037] mb-1.5">
                    Jam Pengambilan / Acara <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-[#A1887F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] text-[#2B1713] rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Conditional: Delivery Address */}
              {orderType === 'DELIVERY' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1.5 pt-1"
                >
                  <label className="block text-xs font-bold text-[#5D4037]">
                    Alamat Lengkap Pengiriman <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-[#A1887F] absolute left-3.5 top-3" />
                    <textarea
                      required
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Masukkan nama jalan, nomor rumah/gedung, patokan, RT/RW..."
                      className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] text-[#2B1713] rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-600 focus:bg-white transition-all resize-none"
                    />
                  </div>
                </motion.div>
              )}

              {/* Conditional: Dine-in Table / Guest Request */}
              {orderType === 'DINE_IN_RESERVATION' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1.5 pt-1"
                >
                  <label className="block text-xs font-bold text-[#5D4037]">
                    Nomor Meja / Request Kapasitas Tamu
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Contoh: Meja Area Outdoor / 6 Orang"
                    className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] text-[#2B1713] rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                  />
                </motion.div>
              )}
            </section>

            {/* STEP 3: PILIH MENU & PRODUK */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#E6D5C3] space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-[#E6D5C3]/60 pb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-300">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#2B1713]">Pilih Menu & Jumlah Pesanan</h3>
                    <p className="text-[11px] text-[#795548]">Pilih item kopi, makanan, dan camilan untuk Pre-Order</p>
                  </div>
                </div>

                {cart.length > 0 && (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-1 rounded-full">
                    {cart.reduce((s, it) => s + it.quantity, 0)} Item Terpilih ({formatRp(totalAmount)})
                  </span>
                )}
              </div>

              {/* Search & Category Pills */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#A1887F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={menuSearchQuery}
                    onChange={(e) => setMenuSearchQuery(e.target.value)}
                    placeholder="Cari menu kopi, matcha, pastry..."
                    className="w-full bg-[#FAF3DD]/30 border border-[#D4A373] text-[#2B1713] rounded-2xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-amber-600 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                        selectedCategory === cat
                          ? 'bg-[#3E2723] text-amber-200 shadow-xs'
                          : 'bg-[#FAF3DD]/60 hover:bg-[#FAF3DD] text-[#5D4037] border border-[#D4A373]/60'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredProducts.map((product) => {
                  const cartItemsForProduct = cart.filter((it) => it.product.id === product.id);
                  const totalQtyInCart = cartItemsForProduct.reduce((s, it) => s + it.quantity, 0);

                  return (
                    <div
                      key={product.id}
                      className="p-3 rounded-2xl border border-[#E6D5C3] bg-[#FAF3DD]/20 hover:bg-white hover:border-[#D4A373] transition-all flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-[#2B1713] truncate">{product.name}</h4>
                        <p className="text-[11px] text-[#795548] line-clamp-1">{product.description || product.category}</p>
                        <div className="font-mono font-bold text-xs text-amber-900 mt-1">
                          {formatRp(product.price)}
                          {product.variants && product.variants.length > 0 && (
                            <span className="text-[10px] text-stone-500 font-normal"> (+varian)</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {product.variants && product.variants.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCustomize(product)}
                            className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs border border-amber-300 transition-colors flex items-center gap-1"
                          >
                            <span>Pilih</span>
                            {totalQtyInCart > 0 && (
                              <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                                {totalQtyInCart}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            {totalQtyInCart > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = cart.findIndex((it) => it.product.id === product.id);
                                    if (idx >= 0) handleUpdateCartQty(idx, -1);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-[#3E2723] flex items-center justify-center font-bold"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-bold text-xs px-1.5">{totalQtyInCart}</span>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(product)}
                              className="w-7 h-7 rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center font-bold shadow-2xs"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Cart Summary Table */}
              {cart.length > 0 ? (
                <div className="mt-4 bg-[#FAF3DD] rounded-2xl p-4 border border-[#D4A373] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#5D4037] border-b border-[#D4A373]/60 pb-2">
                    <span>Ringkasan Menu Dipesan</span>
                    <span>Subtotal</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#2B1713]">
                            {item.product.name}
                            {item.selectedVariant && (
                              <span className="text-[11px] text-amber-800 font-normal">
                                {' '}
                                ({item.selectedVariant.name})
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <div className="text-[10px] text-[#795548] italic">Note: {item.notes}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(idx, -1)}
                              className="w-6 h-6 rounded-md bg-white border border-[#D4A373] text-[#3E2723] flex items-center justify-center font-bold"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-xs w-5 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(idx, 1)}
                              className="w-6 h-6 rounded-md bg-white border border-[#D4A373] text-[#3E2723] flex items-center justify-center font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <span className="font-mono font-bold text-xs text-[#2B1713] w-20 text-right">
                            {formatRp(item.totalPrice)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(idx)}
                            className="text-stone-400 hover:text-rose-600 p-1"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[#D4A373] pt-2.5 flex items-center justify-between text-xs sm:text-sm font-black text-[#2B1713]">
                    <span>Total Estimasi Menu</span>
                    <span className="font-mono text-base text-amber-900">{formatRp(totalAmount)}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#FAF3DD]/30 border border-dashed border-[#D4A373] text-center text-xs text-[#795548]">
                  Belum ada menu yang dipilih. Klik tombol (+) pada menu di atas untuk menambahkan.
                </div>
              )}
            </section>

            {/* STEP 4: CATATAN & PEMBAYARAN DP */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#E6D5C3] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#E6D5C3]/60 pb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-300">
                  4
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#2B1713]">Catatan Khusus & Opsi Uang Muka (DP)</h3>
                  <p className="text-[11px] text-[#795548]">Permintaan khusus barista dan skema pembayaran DP</p>
                </div>
              </div>

              {/* Special Notes */}
              <div>
                <label className="block text-xs font-bold text-[#5D4037] mb-1.5">
                  Catatan Tambahan untuk Dapur / Barista (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Mohon kemasan dipisah es batunya, disiapkan tepat jam 10:00 untuk rapat..."
                  className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] text-[#2B1713] rounded-2xl p-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-600 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* DP Selection */}
              <div>
                <label className="block text-xs font-bold text-[#5D4037] mb-2">
                  Opsi Pembayaran Uang Muka (DP)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: '50_PERCENT' as const,
                      label: 'DP 50% (Rekomendasi)',
                      desc: `${formatRp(Math.round(totalAmount * 0.5))}`,
                    },
                    {
                      id: 'FULL' as const,
                      label: 'Lunas 100%',
                      desc: `${formatRp(totalAmount)}`,
                    },
                    {
                      id: 'NONE' as const,
                      label: 'Bayar di Kasir (0%)',
                      desc: 'Pelunasan saat ambil',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDpOption(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        dpOption === opt.id
                          ? 'bg-[#FAF3DD] border-amber-600 ring-2 ring-amber-400/40 shadow-xs'
                          : 'bg-white border-[#E6D5C3] hover:border-[#D4A373]'
                      }`}
                    >
                      <span className="font-bold text-xs text-[#2B1713] block">{opt.label}</span>
                      <span className="font-mono text-[11px] text-amber-900 font-bold block">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Account Info for DP */}
              {dpOption !== 'NONE' && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-[#5D4037] space-y-1.5">
                  <div className="font-bold text-[#3E2723] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-700" />
                    <span>Petunjuk Transfer DP:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Setelah menekan tombol kirim pesanan, bukti transfer DP dapat dikirimkan langsung melalui WhatsApp konfirmasi ke admin Kedai Su-Qur.
                  </p>
                </div>
              )}
            </section>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-4 px-6 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:bg-stone-300 text-white font-black text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses Pre-Order...</span>
                  </div>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Kirim Pesanan Pre-Order ({formatRp(totalAmount)})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* CUSTOMIZE PRODUCT MODAL */}
      <AnimatePresence>
        {customizingProduct && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white text-[#2B1713] rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-[#D4A373] max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-[#2B1713]">{customizingProduct.name}</h3>
                  <p className="text-xs text-[#795548]">{customizingProduct.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizingProduct(null)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>

              {/* Variant Selector */}
              {customizingProduct.variants && customizingProduct.variants.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#5D4037]">Pilih Varian</label>
                  <div className="space-y-1.5">
                    {customizingProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                          selectedVariant?.id === v.id
                            ? 'bg-[#FAF3DD] border-amber-600 ring-1 ring-amber-500 font-bold'
                            : 'bg-white border-[#E6D5C3] hover:bg-[#FAF3DD]/30'
                        }`}
                      >
                        <span>{v.name}</span>
                        <span className="font-mono">
                          {formatRp(customizingProduct.price + v.priceAdjustment)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Item Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#5D4037]">Catatan Menu (Opsional)</label>
                <input
                  type="text"
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  placeholder="Misal: Less sweet, no ice, extra cup..."
                  className="w-full bg-[#FAF3DD]/40 border border-[#D4A373] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-[#5D4037]">Jumlah Porsi</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setItemQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-xl bg-stone-200 hover:bg-stone-300 font-bold text-xs flex items-center justify-center"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-sm w-6 text-center">{itemQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setItemQuantity((q) => q + 1)}
                    className="w-8 h-8 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConfirmAddToCart}
                  className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  Tambahkan ke Pre-Order (
                  {formatRp(
                    ((selectedVariant
                      ? customizingProduct.price + selectedVariant.priceAdjustment
                      : customizingProduct.price) *
                      itemQuantity)
                  )}
                  )
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
