import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CartItem, DraftOrder, OrderType, User } from '../../types';
import { formatRp } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import {
  Bookmark,
  X,
  User as UserIcon,
  MapPin,
  FileText,
  ShoppingBag,
  Utensils,
  Bike,
  CheckCircle2,
  Clock,
  Phone,
} from 'lucide-react';

interface HoldBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  currentCustomerName: string;
  currentTableNo: string;
  currentDiscountType: 'percent' | 'nominal';
  currentDiscountValue: number;
  subtotal: number;
  grandTotal: number;
  currentUser: User;
  currentOutletName?: string;
  onHoldSuccess: (draft: DraftOrder) => void;
}

const TABLE_PRESETS = [
  'Meja 1',
  'Meja 2',
  'Meja 3',
  'Meja 4',
  'Meja 5',
  'Meja 6',
  'Area Bar',
  'Lantai 2',
  'Outdoor',
  'Takeaway',
];

export const HoldBillModal: React.FC<HoldBillModalProps> = ({
  isOpen,
  onClose,
  cart,
  currentCustomerName,
  currentTableNo,
  currentDiscountType,
  currentDiscountValue,
  subtotal,
  grandTotal,
  currentUser,
  currentOutletName,
  onHoldSuccess,
}) => {
  const [customerName, setCustomerName] = useState<string>(currentCustomerName || '');
  const [tableNumber, setTableNumber] = useState<string>(currentTableNo || '');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with props whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomerName(currentCustomerName || '');
      setTableNumber(currentTableNo || '');
      setCustomerPhone('');
      setNotes('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, currentCustomerName, currentTableNo]);

  if (!isOpen) return null;

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSaveDraft = () => {
    if (cart.length === 0) {
      setErrorMsg('Keranjang belanja kosong.');
      return;
    }

    const finalCustomer = customerName.trim() || (tableNumber ? `Tamu ${tableNumber}` : `Pelanggan #${Date.now().toString().slice(-4)}`);
    const outletId = currentUser.outletId || 'outlet-1';
    const draftId = `draft-${Date.now()}`;
    const draftNo = `#DF-${String(Date.now()).slice(-4)}`;

    setIsSubmitting(true);

    try {
      const newDraft: DraftOrder = {
        id: draftId,
        draftNo,
        customerName: finalCustomer,
        customerPhone: customerPhone.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        items: [...cart],
        createdAt: new Date().toISOString(),
        outletId,
        outletName: currentOutletName || (currentUser.role === 'admin' ? 'Pusat & Cabang' : 'Outlet Utama'),
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        orderType,
        discountType: currentDiscountType,
        discountValue: currentDiscountValue,
        notes: notes.trim() || undefined,
        subtotal,
        total: grandTotal,
        status: 'DRAFT',
      };

      StorageService.saveDraftOrder(newDraft);
      onHoldSuccess(newDraft);
      onClose();
    } catch (err: any) {
      console.error('Failed to save draft order:', err);
      setErrorMsg('Gagal menyimpan draf pesanan. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-[32px] max-w-lg w-full p-6 shadow-2xl border border-[#EBE3D5] space-y-5 my-auto overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EBE3D5] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shadow-xs">
              <Bookmark className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#3E2723]">
                Simpan Draf Pesanan (Hold Bill)
              </h3>
              <p className="text-[11px] text-[#8D7B68]">
                Tahan pesanan sementara & lanjutkan melayani antrean berikutnya
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8D7B68] hover:text-[#3E2723] p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-800 text-xs font-bold p-3 rounded-2xl border border-red-200">
            {errorMsg}
          </div>
        )}

        {/* Form Body */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Order Type Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1.5">
              Tipe Pesanan
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dine_in', label: 'Dine-In', icon: Utensils, sub: 'Makan Sini' },
                { id: 'take_away', label: 'Takeaway', icon: ShoppingBag, sub: 'Bawa Pulang' },
                { id: 'online_delivery', label: 'Online Ojol', icon: Bike, sub: 'Kurir / Ojol' },
              ].map((t) => {
                const isSelected = orderType === t.id;
                const IconComp = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOrderType(t.id as OrderType)}
                    className={`py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-[#3E2723] text-white border-[#3E2723] shadow-xs'
                        : 'bg-[#F9F6F2] text-[#5D4037] border-[#D7CCC8] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 ${isSelected ? 'text-amber-300' : 'text-[#8D7B68]'}`} />
                    <span>{t.label}</span>
                    <span className={`text-[9px] font-normal ${isSelected ? 'text-white/80' : 'text-[#8D7B68]'}`}>
                      {t.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Name & Table Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1">
                Nama Pelanggan <span className="text-amber-800">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8D7B68]" />
                <input
                  type="text"
                  placeholder="cth: Kak Rian / Meja 03"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-[#D7CCC8] bg-[#F9F6F2] text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1">
                Nomor Meja (Opsional)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8D7B68]" />
                <input
                  type="text"
                  placeholder="cth: Meja 4 / Bar 02"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-[#D7CCC8] bg-[#F9F6F2] text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
                />
              </div>
            </div>
          </div>

          {/* Quick Table Presets */}
          <div>
            <span className="text-[10px] font-bold text-[#8D7B68] block mb-1.5">
              Pilihan Cepat Nomor Meja / Lokasi:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TABLE_PRESETS.map((preset) => {
                const isSelected = tableNumber === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setTableNumber(preset);
                      if (!customerName) {
                        setCustomerName(`Tamu ${preset}`);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                      isSelected
                        ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                        : 'bg-[#F9F6F2] text-[#5D4037] border-[#D7CCC8] hover:bg-[#EBE3D5]'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phone Number (Optional) */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1">
              No. WhatsApp / Telepon (Opsional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8D7B68]" />
              <input
                type="tel"
                placeholder="cth: 081234567890"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-[#D7CCC8] bg-[#F9F6F2] text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
              />
            </div>
          </div>

          {/* Special Notes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8D7B68] block mb-1">
              Catatan Khusus Draf (Opsional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3.5 top-3 text-[#8D7B68]" />
              <textarea
                rows={2}
                placeholder="cth: Tunggu teman datang, baru disajikan. Meja luar pojok."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 rounded-2xl border border-[#D7CCC8] bg-[#F9F6F2] text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
              />
            </div>
          </div>

          {/* Cart Summary Card */}
          <div className="bg-[#FAF3DD]/50 rounded-2xl p-3.5 border border-[#EBE3D5] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#3E2723]">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-[#8D7B68]" />
                Ringkasan {totalItemCount} Item
              </span>
              <span className="text-amber-900">{formatRp(grandTotal)}</span>
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-[#5D4037] pr-1">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 border-b border-[#EBE3D5]/60 last:border-0">
                  <div className="truncate flex-1 pr-2">
                    <span className="font-bold text-[#3E2723]">{item.quantity}x </span>
                    <span>{item.product.name}</span>
                    {item.selectedCup && <span className="text-[#8D7B68] text-[10px]"> ({item.selectedCup})</span>}
                    {item.selectedIce && <span className="text-cyan-700 text-[10px]"> • {item.selectedIce}</span>}
                  </div>
                  <span className="font-semibold">{formatRp(item.totalPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#EBE3D5] pt-3 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8D7B68] block">Total Ditahan</span>
            <div className="text-lg font-serif font-black text-[#3E2723]">{formatRp(grandTotal)}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-[#F2EFE9] hover:bg-[#EBE3D5] text-[#5D4037] font-bold text-xs transition-all"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={isSubmitting || cart.length === 0}
              onClick={handleSaveDraft}
              className="px-5 py-3 rounded-2xl bg-[#3E2723] hover:bg-[#5D4037] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Bookmark className="w-4 h-4 text-amber-300" />
              <span>Simpan Draf / Hold</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
