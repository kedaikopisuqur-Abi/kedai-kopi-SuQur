import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QROrder, StoreSettings, User, Transaction } from '../../types';
import { formatRp, formatKitchenTicketThermal } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { printReceiptThermal } from '../../services/thermalPrinterService';
import { playOrderNotificationBell } from '../../utils/audio';
import {
  Bell,
  CheckCircle2,
  Printer,
  X,
  User as UserIcon,
  Phone,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Volume2,
  DollarSign,
  Coffee,
  Check,
} from 'lucide-react';

interface IncomingQROrderAlertModalProps {
  order: QROrder | null;
  settings: StoreSettings;
  currentUser: User;
  onClose: () => void;
  onOpenQROrdersModal: () => void;
  onOrderSettled?: (tx: Transaction) => void;
}

export const IncomingQROrderAlertModal: React.FC<IncomingQROrderAlertModalProps> = ({
  order,
  settings,
  currentUser,
  onClose,
  onOpenQROrdersModal,
  onOrderSettled,
}) => {
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isAccepted, setIsAccepted] = React.useState(false);

  if (!order) return null;

  const totalItemsCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

  const handleAcceptAndPrint = async () => {
    setIsPrinting(true);
    try {
      // 1. Update status to 'preparing'
      StorageService.updateQROrderStatus(order.id, 'preparing', undefined, currentUser);
      setIsAccepted(true);

      // 2. Prepare dummy transaction for kitchen thermal printing
      const dummyTx: Transaction = {
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
        discount: order.discount || 0,
        tax: order.tax || 0,
        total: order.total,
        totalCogs: order.totalCogs,
        grossProfit: order.total - order.totalCogs,
        paymentMethod: order.paymentMethod === 'qris' ? 'qris' : 'cash',
        status: 'completed',
      };

      // 3. Print Kitchen Thermal Ticket
      const receiptText = formatKitchenTicketThermal(dummyTx, settings);
      await printReceiptThermal(receiptText, settings);

      setTimeout(() => {
        onClose();
        onOpenQROrdersModal();
      }, 700);
    } catch (e) {
      console.error('Failed to print order:', e);
      onClose();
      onOpenQROrdersModal();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-lg bg-[#FAF3DD] rounded-3xl border-2 border-[#D4A373] shadow-2xl overflow-hidden text-[#2B1713]"
        >
          {/* Header Banner with Vibrating Bell */}
          <div className="bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#2B1713] p-5 text-[#FAF3DD] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md animate-bounce">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-[#1F1412] px-2 py-0.5 rounded-full shadow-xs">
                      Self-Order Barcode
                    </span>
                    <span className="text-[11px] text-[#D4A373] font-semibold">
                      {order.outletName || 'Cabang POS'}
                    </span>
                  </div>
                  <h3 className="text-lg font-serif font-black text-white mt-0.5">
                    Pesanan Baru Masuk!
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => playOrderNotificationBell()}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 transition-colors"
                  title="Bunyikan Ulang Bel Pesanan"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Tutup Jendela"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-4">
            {/* Table & Customer Highlights Box */}
            <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#8D6E63]">Lokasi / Meja:</span>
                <div className="text-base font-black text-[#3E2723] flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-xl bg-[#FAF3DD] border border-[#D4A373] text-[#3E2723]">
                    {order.tableNo}
                  </span>
                  {order.queueNo && (
                    <span className="text-xs font-mono font-bold text-[#8D6E63]">
                      ({order.queueNo})
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-[10px] uppercase font-bold text-[#8D6E63]">Nama Pelanggan:</span>
                <div className="text-sm font-bold text-[#2B1713] truncate flex items-center justify-end gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-[#8D6E63] shrink-0" />
                  <span>{order.customerName}</span>
                </div>
                {order.customerPhone && (
                  <div className="text-[10px] text-[#8D6E63] font-mono truncate flex items-center justify-end gap-1">
                    <Phone className="w-3 h-3 text-[#8D6E63]" />
                    <span>{order.customerPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items List */}
            <div className="bg-white rounded-2xl border border-[#E6D5C3] p-4 space-y-2.5 shadow-xs max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold text-[#8D6E63] border-b border-[#F5EBE0] pb-1.5">
                <span>Daftar Menu ({totalItemsCount} Item)</span>
                <span>No: #{order.orderNo}</span>
              </div>

              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#2B1713]">
                        <span className="inline-block w-5 text-[#3E2723] font-black">{item.quantity}x</span>
                        {item.productName}
                      </div>
                      <div className="text-[11px] text-[#8D6E63] pl-5 space-x-1.5">
                        {item.variantName && <span className="bg-[#FAF3DD] px-1.5 py-0.5 rounded text-[10px]">{item.variantName}</span>}
                        {item.selectedCup && <span className="bg-[#FAF3DD] px-1.5 py-0.5 rounded text-[10px]">{item.selectedCup}</span>}
                        {item.selectedIce && <span className="bg-[#FAF3DD] px-1.5 py-0.5 rounded text-[10px]">{item.selectedIce}</span>}
                        {item.notes && <span className="text-amber-800 italic">"{item.notes}"</span>}
                      </div>
                    </div>
                    <span className="font-bold text-[#3E2723] font-mono shrink-0">
                      {formatRp(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary & Status */}
            <div className="flex items-center justify-between bg-[#FAF3DD] border border-[#E6D5C3] p-3.5 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold text-[#8D6E63] uppercase block">Metode Pembayaran:</span>
                <span className="text-xs font-black text-[#3E2723] flex items-center gap-1 mt-0.5">
                  {order.paymentMethod === 'qris' ? '📱 QRIS (Digital)' : '💵 Bayar Tunai di Kasir'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-[#8D6E63] uppercase block">Total Pesanan:</span>
                <span className="text-base font-serif font-black text-[#3E2723]">
                  {formatRp(order.total)}
                </span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleAcceptAndPrint}
                disabled={isPrinting || isAccepted}
                className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isAccepted ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Diterima & Dicetak!</span>
                  </>
                ) : isPrinting ? (
                  <>
                    <Printer className="w-4 h-4 animate-spin" />
                    <span>Mencetak Tiket Dapur...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-amber-200" />
                    <span>Terima & Cetak Dapur</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQROrdersModal();
                }}
                className="py-3 px-4 rounded-2xl bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Layers className="w-4 h-4 text-amber-300" />
                <span>Buka Daftar Pesanan QR</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
