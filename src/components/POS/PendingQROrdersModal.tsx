import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QROrder, QROrderStatus, StoreSettings, User, Transaction } from '../../types';
import { formatRp, formatKitchenTicketThermal } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { printReceiptThermal } from '../../services/thermalPrinterService';
import {
  QrCode,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Sparkles,
  Banknote,
  Utensils,
  Trash2,
  User as UserIcon,
  Phone,
  MapPin,
  Check,
  AlertCircle,
  RefreshCw,
  Send,
  Coffee,
} from 'lucide-react';

interface PendingQROrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  settings: StoreSettings;
  outletId?: string;
  onOrderSettled?: (tx: Transaction) => void;
  onOpenReceiptModal?: (tx: Transaction) => void;
}

export const PendingQROrdersModal: React.FC<PendingQROrdersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  settings,
  outletId,
  onOrderSettled,
  onOpenReceiptModal,
}) => {
  const [orders, setOrders] = useState<QROrder[]>(() =>
    StorageService.getQROrders(currentUser.role === 'kasir' ? currentUser.outletId : outletId)
  );
  const [activeFilter, setActiveFilter] = useState<'pending' | 'preparing' | 'completed' | 'all'>('pending');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Settle Modal State (Cash vs QRIS payment settlement)
  const [settlingOrder, setSettlingOrder] = useState<QROrder | null>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<'cash' | 'qris'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');

  const refreshOrders = () => {
    const list = StorageService.getQROrders(
      currentUser.role === 'kasir' ? currentUser.outletId : outletId
    );
    setOrders((prev) => {
      if (prev.length === list.length && JSON.stringify(prev) === JSON.stringify(list)) {
        return prev;
      }
      return list;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshOrders();
    const handleQrPush = () => refreshOrders();
    window.addEventListener('realtime_qr_order_pushed', handleQrPush);
    const interval = setInterval(refreshOrders, 6000);
    return () => {
      window.removeEventListener('realtime_qr_order_pushed', handleQrPush);
      clearInterval(interval);
    };
  }, [isOpen, currentUser, outletId]);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'pending') return o.status === 'pending';
    if (activeFilter === 'preparing') return o.status === 'accepted' || o.status === 'preparing';
    if (activeFilter === 'completed') return o.status === 'completed';
    return true;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const preparingCount = orders.filter((o) => o.status === 'accepted' || o.status === 'preparing').length;

  // Auto-Print Kitchen Ticket & Update status to Preparing
  const handleConfirmAndPrintKitchen = async (order: QROrder) => {
    setProcessingOrderId(order.id);

    try {
      // 1. Update status to preparing
      StorageService.updateQROrderStatus(order.id, 'preparing', undefined, currentUser);
      refreshOrders();

      // 2. Format and print kitchen thermal ticket
      const outletInfo = {
        name: order.outletName,
        address: '',
        phone: '',
      };

      const dummyTxForTicket: Transaction = {
        id: order.id,
        invoiceNo: order.orderNo,
        queueNo: order.queueNo,
        timestamp: order.timestamp,
        outletId: order.outletId,
        outletName: order.outletName,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        customerName: order.customerName,
        tableNo: order.tableNo,
        orderType: 'dine_in',
        items: order.items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          variantName: it.variantName,
          selectedCup: it.selectedCup,
          selectedIce: it.selectedIce,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          cogsUnitPrice: it.cogsUnitPrice,
          cogsTotal: it.cogsTotal,
          notes: it.notes,
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        tax: order.tax,
        total: order.total,
        totalCogs: order.totalCogs,
        grossProfit: order.total - order.totalCogs,
        paymentMethod: order.paymentMethod === 'qris' ? 'qris' : 'cash',
        status: 'completed',
      };

      const kitchenTicketText = formatKitchenTicketThermal(dummyTxForTicket, settings);
      printReceiptThermal(kitchenTicketText, settings, { kickCashDrawer: false }).catch(() => {});

      setActionNotice({
        type: 'success',
        message: `Pesanan ${order.tableNo} (${order.customerName}) dikonfirmasi & Tiket Dapur telah dicetak!`,
      });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e: any) {
      console.warn('Kitchen ticket print notice:', e);
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Open Settle Order Modal
  const handleOpenSettle = (order: QROrder) => {
    setSettlingOrder(order);
    setSettlePaymentMethod(order.paymentMethod === 'qris' ? 'qris' : 'cash');
    setCashReceived(String(order.total));
  };

  // Settle Order into Official Transaction & Cash Ledger
  const handleConfirmSettle = () => {
    if (!settlingOrder) return;
    const cashNum = parseInt(cashReceived) || settlingOrder.total;

    const result = StorageService.settleQROrder(
      settlingOrder.id,
      currentUser,
      settlePaymentMethod,
      cashNum
    );

    if (result.success && result.transaction) {
      refreshOrders();
      setSettlingOrder(null);
      if (onOrderSettled) onOrderSettled(result.transaction);

      setActionNotice({
        type: 'success',
        message: `✅ Pesanan ${settlingOrder.tableNo} berhasil diselesaikan! Stok otomatis dipotong & Kas Masuk tercatat.`,
      });

      if (onOpenReceiptModal) {
        onOpenReceiptModal(result.transaction);
      }
    } else {
      alert('Gagal menyelesaikan pesanan: ' + (result.warnings.join(', ') || 'Unknown error'));
    }
    setTimeout(() => setActionNotice(null), 4500);
  };

  // Cancel order
  const handleCancelOrder = (order: QROrder) => {
    if (confirm(`Apakah Anda yakin ingin membatalkan pesanan dari ${order.tableNo} (${order.customerName})?`)) {
      StorageService.updateQROrderStatus(order.id, 'cancelled', undefined, currentUser);
      refreshOrders();
      setActionNotice({
        type: 'error',
        message: `Pesanan ${order.tableNo} dibatalkan.`,
      });
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FAF3DD] w-full max-w-4xl max-h-[92vh] rounded-3xl p-6 shadow-2xl border-2 border-[#D4A373] text-[#3E2723] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#3E2723] text-amber-300 flex items-center justify-center shadow-md relative">
              <QrCode className="w-6 h-6" />
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#FAF3DD] animate-bounce">
                  {pendingCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-serif italic font-bold text-xl text-[#3E2723] flex items-center gap-2">
                Daftar Pesanan QR & Self-Order Masuk
              </h2>
              <p className="text-xs text-[#8D6E63]">
                Kelola pesanan pelanggan dari meja secara real-time, konfirmasi ke dapur, dan terima pembayaran.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshOrders}
              className="p-2 rounded-xl bg-white border border-[#D4A373] text-[#5D4037] hover:bg-amber-50"
              title="Segarkan Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/70 hover:bg-[#E6D5C3] text-[#8D6E63]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div
            className={`p-3.5 mb-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 pb-3 mb-2 border-b border-[#E6D5C3] overflow-x-auto shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === 'pending'
                ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E6D5C3]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Menunggu Konfirmasi</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('preparing')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === 'preparing'
                ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E6D5C3]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Sedang Disiapkan Dapur</span>
            {preparingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black">
                {preparingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === 'completed'
                ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E6D5C3]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Pesanan Selesai</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === 'all'
                ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#E6D5C3]'
            }`}
          >
            <span>Semua Riwayat</span>
          </button>
        </div>

        {/* Order List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-xs">
          {filteredOrders.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-[#E6D5C3] text-center space-y-3 my-4">
              <Coffee className="w-12 h-12 text-stone-300 mx-auto" />
              <div className="font-bold text-stone-700 text-sm">Tidak ada pesanan QR di kategori ini</div>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Pesanan yang dikirim oleh pelanggan melalui scan QR meja akan otomatis muncul di sini secara langsung.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isPending = order.status === 'pending';
              const isPreparing = order.status === 'accepted' || order.status === 'preparing';
              const isCompleted = order.status === 'completed';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border p-4.5 transition-all shadow-xs flex flex-col justify-between gap-3 ${
                    isPending
                      ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/40'
                      : isPreparing
                      ? 'border-blue-300 bg-blue-50/20'
                      : 'border-[#E6D5C3]'
                  }`}
                >
                  {/* Top Card Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#3E2723] text-amber-200 px-3 py-1 rounded-xl font-black text-sm tracking-wide">
                        {order.tableNo}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">
                            {order.customerName}
                          </span>
                          {order.customerPhone && (
                            <span className="text-[11px] text-stone-500 font-mono">
                              ({order.customerPhone})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          ID: {order.orderNo} • Antrean: <b>{order.queueNo || '-'}</b> • {new Date(order.createdAt || order.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Payment method badge */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          order.paymentMethod === 'qris'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                      >
                        {order.paymentMethod === 'qris' ? (
                          <>
                            <QrCode className="w-3 h-3" /> QRIS Instan
                          </>
                        ) : (
                          <>
                            <Banknote className="w-3 h-3" /> Bayar di Kasir
                          </>
                        )}
                      </span>

                      {/* Order status badge */}
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isPreparing
                            ? 'bg-amber-600 text-white animate-pulse'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {isCompleted ? 'Selesai' : isPreparing ? 'Dapur / Bar' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 text-xs py-1">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-stone-900">{it.quantity}x </span>
                          <span className="font-semibold text-stone-800">{it.productName}</span>
                          {(it.variantName || it.selectedCup || it.selectedIce) && (
                            <span className="text-[11px] text-stone-500 ml-1">
                              ({[it.variantName, it.selectedCup, it.selectedIce].filter(Boolean).join(', ')})
                            </span>
                          )}
                          {it.notes && (
                            <span className="text-[10px] text-amber-800 italic block bg-amber-50 px-2 py-0.5 rounded mt-0.5">
                              Catatan: {it.notes}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-stone-900 shrink-0">
                          {formatRp(it.totalPrice)}
                        </span>
                      </div>
                    ))}

                    {order.notes && (
                      <div className="mt-2 p-2 bg-stone-50 rounded-xl text-[11px] text-stone-600 border border-stone-200">
                        <b>Catatan Pelanggan:</b> {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions & Total */}
                  <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 text-xs">Total Pembayaran:</span>
                      <span className="font-black text-sm text-[#3E2723]">
                        {formatRp(order.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleConfirmAndPrintKitchen(order)}
                          disabled={processingOrderId === order.id}
                          className="py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Konfirmasi & Cetak Dapur</span>
                        </button>
                      )}

                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleOpenSettle(order)}
                          className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Selesaikan & Bayar (Kas Masuk)</span>
                        </button>
                      )}

                      {isCompleted && (
                        <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Transaksi Selesai
                        </span>
                      )}

                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(order)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                          title="Batalkan Pesanan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 mt-3 border-t border-[#E6D5C3] flex items-center justify-between text-[11px] text-[#8D6E63] shrink-0">
          <span>
            Cabang: <b>{currentUser?.outletName || 'Semua Cabang'}</b>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold transition-all"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Settle Order Modal */}
      {settlingOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF3DD] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-[#D4A373] text-[#3E2723] space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <h3 className="font-serif italic font-bold text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Pelunasan & Kas Masuk - {settlingOrder.tableNo}
              </h3>
              <button
                type="button"
                onClick={() => setSettlingOrder(null)}
                className="p-1 rounded-lg hover:bg-[#E6D5C3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-[#E6D5C3] space-y-1.5">
              <div className="flex justify-between font-bold">
                <span>Pemesan:</span>
                <span>{settlingOrder.customerName}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total Tagihan:</span>
                <span className="text-base text-emerald-700">{formatRp(settlingOrder.total)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block font-bold text-gray-800 mb-1.5">Metode Pembayaran Akhir:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('cash')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                    settlePaymentMethod === 'cash'
                      ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                      : 'bg-white text-stone-700 border-stone-200'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Uang Tunai / Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('qris')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                    settlePaymentMethod === 'qris'
                      ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                      : 'bg-white text-stone-700 border-stone-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>QRIS</span>
                </button>
              </div>
            </div>

            {settlePaymentMethod === 'cash' && (
              <div>
                <label className="block font-bold text-gray-800 mb-1">Uang Diterima dari Pelanggan:</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4A373] bg-white font-black text-sm focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                />
                <div className="flex justify-between mt-1 text-[11px] font-bold text-stone-600">
                  <span>Kembalian:</span>
                  <span className="text-amber-900">
                    {formatRp(Math.max(0, (parseInt(cashReceived) || 0) - settlingOrder.total))}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#E6D5C3] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettlingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-200 text-stone-800 font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Transaksi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
