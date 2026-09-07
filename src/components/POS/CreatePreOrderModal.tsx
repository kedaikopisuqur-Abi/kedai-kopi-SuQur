import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Store,
  Truck,
  UtensilsCrossed,
  X,
  CheckCircle2,
  AlertCircle,
  Banknote,
  QrCode,
  ArrowRight,
  Sparkles,
  MapPin,
  FileText,
  DollarSign,
  Coffee,
} from 'lucide-react';
import { CartItem, PreOrder, PreOrderType, User as UserType, StoreSettings } from '../../types';
import { formatRp } from '../../utils/formatters';
import { StorageService } from '../../services/storage';

interface CreatePreOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  user: UserType;
  settings: StoreSettings;
  onSuccess: (preOrder: PreOrder) => void;
}

export const CreatePreOrderModal: React.FC<CreatePreOrderModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  user,
  settings,
  onSuccess,
}) => {
  // Get active outlet
  const outlets = StorageService.getOutlets();
  const activeOutletId =
    user.assignedOutletId ||
    user.outletId ||
    settings.activeOutletId ||
    (outlets.length > 0 ? outlets[0].id : 'outlet-lagoa');

  // Form State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [selectedOutletId, setSelectedOutletId] = useState<string>(activeOutletId);
  const [orderType, setOrderType] = useState<PreOrderType>('PICKUP');

  // Today and default time
  const todayStr = new Date().toISOString().split('T')[0];
  const [scheduledDate, setScheduledDate] = useState<string>(todayStr);
  const [scheduledTime, setScheduledTime] = useState<string>('14:00');

  const [tableNumber, setTableNumber] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // DP State
  const [dpPreset, setDpPreset] = useState<'0' | '30' | '50' | '100' | 'custom'>('50');
  const [depositAmount, setDepositAmount] = useState<number>(Math.round(subtotal * 0.5));
  const [dpPaymentMethod, setDpPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('QRIS');
  const [recordCashDP, setRecordCashDP] = useState<boolean>(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Handle Preset DP changes
  const handleSelectPreset = (preset: '0' | '30' | '50' | '100' | 'custom') => {
    setDpPreset(preset);
    if (preset === '0') {
      setDepositAmount(0);
    } else if (preset === '30') {
      setDepositAmount(Math.round(subtotal * 0.3));
    } else if (preset === '50') {
      setDepositAmount(Math.round(subtotal * 0.5));
    } else if (preset === '100') {
      setDepositAmount(subtotal);
    }
  };

  const handleCustomDpChange = (val: number) => {
    setDpPreset('custom');
    setDepositAmount(Math.max(0, Math.min(subtotal, val)));
  };

  const remainingBalance = Math.max(0, subtotal - depositAmount);

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim()) {
      setErrorMsg('Nama pelanggan wajib diisi!');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMsg('Nomor WhatsApp / telepon pelanggan wajib diisi untuk konfirmasi PO!');
      return;
    }

    if (!scheduledDate) {
      setErrorMsg('Tanggal jadwal pengambilan wajib dipilih!');
      return;
    }

    if (!scheduledTime) {
      setErrorMsg('Jam jadwal pengambilan wajib dipilih!');
      return;
    }

    if (cart.length === 0) {
      setErrorMsg('Keranjang pesanan masih kosong. Pilih produk terlebih dahulu!');
      return;
    }

    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      setErrorMsg('Alamat pengantaran wajib diisi untuk tipe pesanan Delivery!');
      return;
    }

    if (orderType === 'DINE_IN_RESERVATION' && !tableNumber.trim()) {
      setErrorMsg('Nomor / area meja wajib diisi untuk reservasi Dine-In!');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) || outlets[0];
      const now = new Date();
      const datePrefix = scheduledDate.replace(/-/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const poNumber = `PO-${datePrefix}-${randomSuffix}`;

      const newPreOrder: PreOrder = {
        id: `po-${Date.now()}-${randomSuffix}`,
        poNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        outletId: selectedOutlet?.id || activeOutletId,
        outletName: selectedOutlet?.name || 'Cabang Utama',
        orderType,
        scheduledDate,
        scheduledTime,
        items: cart,
        totalAmount: subtotal,
        depositAmount,
        remainingBalance,
        paymentStatus: depositAmount >= subtotal ? 'PAID' : depositAmount > 0 ? 'PARTIAL_DP' : 'UNPAID',
        orderStatus: 'SCHEDULED',
        tableNumber: orderType === 'DINE_IN_RESERVATION' ? tableNumber.trim() : undefined,
        deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        notes: notes.trim() || undefined,
        dpPaymentMethod: depositAmount > 0 ? dpPaymentMethod : undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: user.name,
        cashierName: user.name,
        cashierId: user.id,
      };

      const saved = StorageService.savePreOrder(newPreOrder, recordCashDP && depositAmount > 0);
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to create pre-order:', err);
      setErrorMsg(err?.message || 'Gagal menyimpan Pre-Order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#FDFBF7] rounded-3xl w-full max-w-2xl border border-[#E6D5C3] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Modal Header */}
          <div className="bg-[#3E2723] text-[#FDFBF7] p-5 sm:px-6 flex items-center justify-between border-b border-[#5D4037] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-amber-100 flex items-center gap-2">
                  <span>Buat Pre-Order & Reservasi Slot</span>
                  <span className="text-[10px] bg-amber-400 text-[#2B1713] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Jadwal Kasir
                  </span>
                </h3>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Atur tanggal, jam ambil/antar, DP pesanan, dan slot meja untuk pelanggan
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-[#2B1713]">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Order Type Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8D7B68] mb-2">
                1. Tipe Pesanan & Slot Layanan
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setOrderType('PICKUP')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    orderType === 'PICKUP'
                      ? 'bg-[#3E2723] text-amber-200 border-[#3E2723] shadow-md ring-2 ring-amber-400/50'
                      : 'bg-white text-[#5D4037] border-[#E6D5C3] hover:border-amber-400'
                  }`}
                >
                  <Store className="w-5 h-5" />
                  <span className="text-xs font-bold">Ambil di Kedai</span>
                  <span className="text-[10px] opacity-75">Self-Pickup</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('DELIVERY')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    orderType === 'DELIVERY'
                      ? 'bg-[#3E2723] text-amber-200 border-[#3E2723] shadow-md ring-2 ring-amber-400/50'
                      : 'bg-white text-[#5D4037] border-[#E6D5C3] hover:border-amber-400'
                  }`}
                >
                  <Truck className="w-5 h-5" />
                  <span className="text-xs font-bold">Pengantaran</span>
                  <span className="text-[10px] opacity-75">Delivery / Katering</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('DINE_IN_RESERVATION')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    orderType === 'DINE_IN_RESERVATION'
                      ? 'bg-[#3E2723] text-amber-200 border-[#3E2723] shadow-md ring-2 ring-amber-400/50'
                      : 'bg-white text-[#5D4037] border-[#E6D5C3] hover:border-amber-400'
                  }`}
                >
                  <UtensilsCrossed className="w-5 h-5" />
                  <span className="text-xs font-bold">Reservasi Meja</span>
                  <span className="text-[10px] opacity-75">Dine-In Booking</span>
                </button>
              </div>
            </div>

            {/* Step 2: Customer Info */}
            <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] space-y-3 shadow-2xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8D7B68]">
                2. Data Pemesan
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#5D4037] block mb-1">
                    Nama Pelanggan / Kontak *
                  </span>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ibu Ratna (Kantor OJK)"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[#5D4037] block mb-1">
                    No. WhatsApp / Telepon *
                  </span>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="081234567890"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Conditional Field: Table Reservation */}
              {orderType === 'DINE_IN_RESERVATION' && (
                <div className="pt-2 border-t border-stone-100">
                  <span className="text-[11px] font-semibold text-[#5D4037] block mb-1">
                    Nomor Meja / Area Reservasi *
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Meja 04 & 05 (Kapasitas 8 Orang, AC Indoor)"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-medium"
                  />
                </div>
              )}

              {/* Conditional Field: Delivery Address */}
              {orderType === 'DELIVERY' && (
                <div className="pt-2 border-t border-stone-100">
                  <span className="text-[11px] font-semibold text-[#5D4037] block mb-1">
                    Alamat Lengkap Pengantaran *
                  </span>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <textarea
                      required
                      rows={2}
                      placeholder="e.g. Jl. Mangga Dua No. 12, Gedung Wisma Lantai 3 (Ruang Meeting Serbaguna)"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Date, Time & Outlet Picker */}
            <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] space-y-3 shadow-2xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8D7B68]">
                3. Jadwal Slot Waktu & Cabang
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#5D4037] block mb-1">
                    Tanggal Jadwal *
                  </span>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[#5D4037] block mb-1">
                    Jam Pengambilan / Siap *
                  </span>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[#5D4037] block mb-1">
                    Cabang Penempatan
                  </span>
                  <select
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(e.target.value)}
                    disabled={user.role === 'kasir' || user.role !== 'admin'}
                    className="w-full px-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-medium disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Time Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Pintasan Jam:</span>
                {['10:00', '12:00', '14:00', '16:00', '18:00', '19:30'].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setScheduledTime(time)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono border transition-colors ${
                      scheduledTime === time
                        ? 'bg-amber-600 text-white border-amber-600 font-bold'
                        : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Items & DP Calculation */}
            <div className="bg-[#FAF3DD] p-4 rounded-2xl border border-[#E6D5C3] space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#8D7B68] flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-amber-700" />
                  <span>4. Rincian Pesanan & Uang Muka (DP)</span>
                </label>
                <span className="text-xs font-mono font-bold text-[#3E2723]">
                  {cart.length} Jenis Produk ({cart.reduce((s, i) => s + i.quantity, 0)} Item)
                </span>
              </div>

              {/* Compact Cart Preview */}
              <div className="max-h-32 overflow-y-auto divide-y divide-amber-200/60 bg-white/70 rounded-xl p-2.5 border border-amber-200/80 text-xs">
                {cart.map((item, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                    <div className="flex-1 truncate">
                      <span className="font-bold text-[#2B1713]">{item.product.name}</span>
                      <span className="text-[11px] text-stone-500 ml-1.5">
                        x{item.quantity} {item.selectedCup ? `(${item.selectedCup})` : ''}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-[#5D4037] shrink-0">
                      {formatRp(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financial Calculation */}
              <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-stone-600">Total Nilai Pesanan:</span>
                  <span className="font-bold font-mono text-base text-[#3E2723]">
                    {formatRp(subtotal)}
                  </span>
                </div>

                {/* DP Preset Buttons */}
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block mb-1.5">
                    Pilihan Uang Muka (DP):
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: '0', label: 'Tanpa DP (0%)' },
                      { id: '30', label: 'DP 30%' },
                      { id: '50', label: 'DP 50%' },
                      { id: '100', label: 'Lunas (100%)' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => handleSelectPreset(btn.id as any)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                          dpPreset === btn.id
                            ? 'bg-[#3E2723] text-amber-200 border-[#3E2723] shadow-xs'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DP Custom Input & Remaining Balance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] font-semibold text-stone-600 block mb-1">
                      Nominal DP yang Diterima (Rp):
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      step={5000}
                      value={depositAmount}
                      onChange={(e) => handleCustomDpChange(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-amber-900 focus:bg-white focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-stone-600 block mb-1">
                      Sisa Tagihan Pelunasan:
                    </span>
                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-mono font-bold text-rose-800 flex items-center justify-between">
                      <span>Sisa:</span>
                      <span className="text-sm">{formatRp(remainingBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* DP Payment Method (if DP > 0) */}
                {depositAmount > 0 && (
                  <div className="pt-2 border-t border-stone-100 space-y-2">
                    <span className="text-[11px] font-semibold text-stone-600 block">
                      Metode Pembayaran DP:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDpPaymentMethod('QRIS')}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                          dpPaymentMethod === 'QRIS'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QRIS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDpPaymentMethod('TRANSFER')}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                          dpPaymentMethod === 'TRANSFER'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Transfer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDpPaymentMethod('CASH')}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                          dpPaymentMethod === 'CASH'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Tunai (Kas)</span>
                      </button>
                    </div>

                    <label className="flex items-center gap-2 pt-1 text-xs text-[#5D4037] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recordCashDP}
                        onChange={(e) => setRecordCashDP(e.target.checked)}
                        className="rounded text-amber-800 focus:ring-amber-600"
                      />
                      <span>Otomatis catat DP ini sebagai Kas Masuk di Buku Kas Cabang</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Step 5: Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8D7B68] mb-1.5">
                5. Catatan Khusus & Request Dapur
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Minta nota rangkap 2, kemasan box kardus katering, pisahkan es batu"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#D7CCC8] rounded-xl text-xs focus:outline-none focus:border-amber-600 font-medium"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[#E6D5C3] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-[#D7CCC8] bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-amber-100 text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Jadwalkan PO'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
