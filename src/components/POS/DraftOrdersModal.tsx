import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DraftOrder, OrderType, StoreSettings, User, Transaction } from '../../types';
import { formatRp, formatThermalReceipt } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { printReceiptThermal } from '../../services/thermalPrinterService';
import {
  Bookmark,
  X,
  Search,
  Utensils,
  ShoppingBag,
  Bike,
  Clock,
  MapPin,
  User as UserIcon,
  Trash2,
  Edit3,
  CreditCard,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Phone,
  FileText,
} from 'lucide-react';

interface DraftOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  settings: StoreSettings;
  outletId?: string;
  onLoadDraftToCart: (draft: DraftOrder) => void;
  onPayDraftDirect: (draft: DraftOrder) => void;
}

export const DraftOrdersModal: React.FC<DraftOrdersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  settings,
  outletId,
  onLoadDraftToCart,
  onPayDraftDirect,
}) => {
  const [drafts, setDrafts] = useState<DraftOrder[]>(() =>
    StorageService.getDraftOrders(currentUser.role === 'kasir' ? currentUser.outletId : outletId)
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dine_in' | 'take_away' | 'online_delivery'>('all');
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const refreshDrafts = () => {
    const list = StorageService.getDraftOrders(
      currentUser.role === 'kasir' ? currentUser.outletId : outletId
    );
    setDrafts((prev) => {
      if (prev.length === list.length && JSON.stringify(prev) === JSON.stringify(list)) {
        return prev;
      }
      return list;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshDrafts();
    const interval = setInterval(refreshDrafts, 6000);
    return () => clearInterval(interval);
  }, [isOpen, currentUser, outletId]);

  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      if (d.status !== 'DRAFT') return false;
      if (typeFilter !== 'all' && d.orderType !== typeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.customerName.toLowerCase().includes(q) ||
        (d.tableNumber && d.tableNumber.toLowerCase().includes(q)) ||
        (d.draftNo && d.draftNo.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        d.items.some((it) => it.product.name.toLowerCase().includes(q))
      );
    });
  }, [drafts, typeFilter, searchQuery]);

  if (!isOpen) return null;

  const handleDeleteDraft = (draftId: string) => {
    StorageService.deleteDraftOrder(draftId);
    setDeletingId(null);
    refreshDrafts();
    setActionFeedback({ text: 'Draf pesanan berhasil dihapus.', type: 'info' });
    setTimeout(() => setActionFeedback(null), 2500);
  };

  const handlePrintPreBill = async (draft: DraftOrder) => {
    // Generate a temporary preview transaction for thermal printing
    const tempTx: Transaction = {
      id: draft.id,
      invoiceNo: `PRE-BILL ${draft.draftNo || draft.id.slice(-4)}`,
      timestamp: draft.createdAt,
      outletId: draft.outletId,
      outletName: draft.outletName || settings.storeName,
      cashierId: draft.cashierId || currentUser.id,
      cashierName: draft.cashierName || currentUser.name,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      tableNo: draft.tableNumber,
      orderType: draft.orderType || 'dine_in',
      items: draft.items.map((it) => ({
        productId: it.product.id,
        productName: it.product.name,
        variantName: it.selectedVariant?.name,
        selectedCup: it.selectedCup,
        selectedIce: it.selectedIce,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        cogsUnitPrice: it.product.cogs,
        cogsTotal: it.cogsTotal,
        notes: it.notes,
      })),
      subtotal: draft.subtotal,
      discount: draft.discountValue
        ? draft.discountType === 'percent'
          ? (draft.subtotal * draft.discountValue) / 100
          : draft.discountValue
        : 0,
      tax: 0,
      total: draft.total,
      totalCogs: 0,
      grossProfit: 0,
      paymentMethod: 'cash',
      status: 'completed',
    };

    try {
      const receiptText = formatThermalReceipt(tempTx, settings);
      await printReceiptThermal(receiptText, settings, { kickCashDrawer: false });
      setActionFeedback({ text: 'Slip tagihan sementara berhasil dicetak!', type: 'success' });
      setTimeout(() => setActionFeedback(null), 2500);
    } catch (e) {
      console.warn('Pre-bill print error:', e);
    }
  };

  const formatElapsedTime = (isoDate: string) => {
    const elapsedSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (elapsedSec < 60) return 'Baru saja';
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin} mnt lalu`;
    const elapsedHours = Math.floor(elapsedMin / 60);
    return `${elapsedHours} jam lalu`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-[32px] max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#EBE3D5] overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EBE3D5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3E2723] text-amber-300 flex items-center justify-center font-bold shadow-xs">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg text-[#3E2723]">
                  Draf Pesanan & Multi-Order (Hold Bill)
                </h3>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full">
                  {drafts.filter((d) => d.status === 'DRAFT').length} Aktif
                </span>
              </div>
              <p className="text-[11px] text-[#8D7B68]">
                Daftar pesanan yang sedang ditahan untuk dilanjutkan pembayaran atau diedit menunya
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8D7B68] hover:text-[#3E2723] p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Notice / Toast */}
        <AnimatePresence>
          {actionFeedback && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`px-5 py-2 text-xs font-bold flex items-center gap-2 ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-b border-amber-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{actionFeedback.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Channel Filter Bar */}
        <div className="p-4 border-b border-[#EBE3D5] bg-[#FDFBF7] space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8D7B68]" />
              <input
                type="text"
                placeholder="Cari nama pelanggan, nomor meja, atau menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#D7CCC8] bg-white text-xs font-semibold text-[#3E2723] focus:outline-none focus:border-[#8D7B68]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D7B68] hover:text-[#3E2723]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1 bg-[#F2EFE9] p-1 rounded-xl border border-[#D7CCC8] shrink-0 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'Semua Draf' },
                { id: 'dine_in', label: '🍽️ Dine-In' },
                { id: 'take_away', label: '🛍️ Takeaway' },
                { id: 'online_delivery', label: '🛵 Online' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTypeFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    typeFilter === f.id
                      ? 'bg-[#3E2723] text-white shadow-xs'
                      : 'text-[#5D4037] hover:bg-white/60'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Draft Orders List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#FAF6F0]/40">
          {filteredDrafts.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-3xl border border-dashed border-[#D7CCC8] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 mx-auto flex items-center justify-center">
                <Bookmark className="w-6 h-6" />
              </div>
              <h4 className="font-serif font-bold text-base text-[#3E2723]">
                Tidak Ada Draf Pesanan Aktif
              </h4>
              <p className="text-xs text-[#8D7B68] max-w-sm mx-auto leading-relaxed">
                Saat kasir sedang menyusun menu di keranjang dan pelanggan ingin menambah menu nanti, tekan tombol <strong>'Simpan Draf (Hold Bill)'</strong> di layar kasir untuk menahan pesanan.
              </p>
            </div>
          ) : (
            filteredDrafts.map((draft) => {
              const isExpanded = expandedDraftId === draft.id;
              const totalItems = draft.items.reduce((sum, it) => sum + it.quantity, 0);

              return (
                <div
                  key={draft.id}
                  className="bg-white rounded-2xl border border-[#EBE3D5] shadow-xs hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Card Main Header */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F2EFE9]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-[#3E2723] text-amber-300 px-2 py-0.5 rounded-lg">
                          {draft.draftNo || `#${draft.id.slice(-4)}`}
                        </span>
                        <h4 className="font-serif font-bold text-sm sm:text-base text-[#3E2723]">
                          {draft.customerName}
                        </h4>
                        {draft.tableNumber && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-700" />
                            {draft.tableNumber}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F2EFE9] text-[#5D4037] flex items-center gap-1">
                          {draft.orderType === 'take_away' ? '🛍️ Takeaway' : draft.orderType === 'online_delivery' ? '🛵 Online Ojol' : '🍽️ Dine-In'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#8D7B68]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#8D7B68]" />
                          {formatElapsedTime(draft.createdAt)} ({new Date(draft.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
                        </span>
                        {draft.customerPhone && (
                          <span className="flex items-center gap-1 text-[#5D4037]">
                            <Phone className="w-3 h-3" />
                            {draft.customerPhone}
                          </span>
                        )}
                        <span>• Kasir: {draft.cashierName || 'Kasir'}</span>
                      </div>
                    </div>

                    {/* Total Bill & Expand Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2EFE9]">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-bold text-[#8D7B68] block">Total Tagihan ({totalItems} Item)</span>
                        <span className="text-base font-serif font-black text-amber-900">
                          {formatRp(draft.total)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedDraftId(isExpanded ? null : draft.id)}
                        className="p-1.5 text-[#8D7B68] hover:text-[#3E2723] rounded-xl hover:bg-[#F2EFE9] transition-colors"
                        title={isExpanded ? 'Sembunyikan Rincian' : 'Lihat Rincian'}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Items List (Always visible or expanded) */}
                  <div className={`px-4 py-3 bg-[#FAF6F0]/30 border-b border-[#F2EFE9] text-xs space-y-1.5 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
                    <div className="font-bold text-[11px] text-[#8D7B68] uppercase tracking-wider mb-1">
                      Menu yang dipesan:
                    </div>
                    {draft.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs text-[#3E2723]">
                        <div className="flex-1 pr-2">
                          <span className="font-bold">{item.quantity}x</span> {item.product.name}
                          {item.selectedCup && (
                            <span className="text-[#8D7B68] text-[11px]"> ({item.selectedCup})</span>
                          )}
                          {item.selectedIce && (
                            <span className="text-cyan-800 text-[11px]"> • {item.selectedIce}</span>
                          )}
                          {item.selectedVariant && (
                            <span className="text-[#8D7B68] text-[11px]"> [{item.selectedVariant.name}]</span>
                          )}
                          {item.notes && (
                            <div className="text-[10px] text-amber-900 italic pl-4">
                              "{item.notes}"
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-[#5D4037]">
                          {formatRp(item.totalPrice)}
                        </span>
                      </div>
                    ))}

                    {draft.notes && (
                      <div className="mt-2 text-[11px] bg-amber-50 text-amber-900 p-2 rounded-xl border border-amber-200 flex items-start gap-1.5">
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700" />
                        <span><strong>Catatan:</strong> {draft.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-3 bg-white flex items-center justify-between gap-2 flex-wrap">
                    {/* Delete Confirmation or Trigger */}
                    {deletingId === draft.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-700 font-bold">Hapus draf ini?</span>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDeletingId(draft.id)}
                          className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                          title="Hapus / Batalkan Draf"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintPreBill(draft)}
                          className="px-3 py-2 rounded-xl bg-[#F2EFE9] hover:bg-[#EBE3D5] text-[#5D4037] font-bold text-xs flex items-center gap-1.5 transition-all"
                          title="Cetak Struk Tagihan Sementara (Pre-Bill)"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#795548]" />
                          <span className="hidden sm:inline">Cetak Pre-Bill</span>
                        </button>
                      </div>
                    )}

                    {/* Main Actions: Edit in Cart or Pay Directly */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadDraftToCart(draft);
                          onClose();
                        }}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-amber-50 text-[#3E2723] border border-[#D4A373] font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-800" />
                        <span>Buka / Tambah Menu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onPayDraftDirect(draft);
                          onClose();
                        }}
                        className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-amber-300" />
                        <span>Bayar Sekarang</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EBE3D5] bg-white flex items-center justify-between shrink-0">
          <span className="text-xs text-[#8D7B68]">
            Menampilkan <strong>{filteredDrafts.length}</strong> dari <strong>{drafts.length}</strong> draf pesanan
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-[#3E2723] hover:bg-[#5D4037] text-white font-bold text-xs transition-all shadow-xs"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
};
