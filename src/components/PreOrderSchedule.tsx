import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Store,
  Truck,
  UtensilsCrossed,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  DollarSign,
  Printer,
  FileText,
  Trash2,
  Plus,
  ArrowRight,
  Sparkles,
  MapPin,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Building2,
  Layers,
  CheckCheck,
  XCircle,
  ShoppingBag,
  CreditCard,
  QrCode,
  Banknote,
  Send,
  Coffee,
  Copy,
  Share2,
  Globe,
  Download,
} from 'lucide-react';
import {
  PreOrder,
  PreOrderStatus,
  PreOrderType,
  User as UserType,
  StoreSettings,
  Product,
  CartItem,
  PaymentMethod,
  Outlet,
} from '../types';
import { formatRp, formatDateTime } from '../utils/formatters';
import { StorageService } from '../services/storage';
import { printReceiptThermal } from '../services/thermalPrinterService';
import { CreatePreOrderModal } from './POS/CreatePreOrderModal';
import { POQrGenerator } from './POQrGenerator';

interface PreOrderScheduleProps {
  user: UserType;
  settings: StoreSettings;
  products?: Product[];
  activeOutlet?: Outlet | null;
  outlets?: Outlet[];
}

export const PreOrderSchedule: React.FC<PreOrderScheduleProps> = ({
  user,
  settings,
  products = [],
  activeOutlet: propActiveOutlet,
  outlets: propOutlets,
}) => {
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'upcoming' | 'completed'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const outlets = propOutlets && propOutlets.length > 0 ? propOutlets : StorageService.getOutlets();
  const currentActiveOutlet = propActiveOutlet || StorageService.getActiveOutlet();
  const isKasir = user.role === 'kasir' || user.role !== 'admin';
  const cashierOutletId =
    user.assignedOutletId ||
    user.outletId ||
    currentActiveOutlet?.id ||
    (outlets.length > 0 ? outlets[0].id : 'outlet-lagoa');
  const cashierOutlet = outlets.find((o) => o.id === cashierOutletId) || currentActiveOutlet || outlets[0];

  const [selectedOutletId, setSelectedOutletId] = useState<string>(() => (isKasir ? cashierOutletId : 'ALL'));

  // Keep selectedOutletId locked to cashier branch if kasir role
  useEffect(() => {
    if (isKasir) {
      setSelectedOutletId(cashierOutletId);
    }
  }, [isKasir, cashierOutletId]);

  const effectiveOutletId = isKasir ? cashierOutletId : selectedOutletId;

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isPOQrModalOpen, setIsPOQrModalOpen] = useState<boolean>(false);
  const [settlementPO, setSettlementPO] = useState<PreOrder | null>(null);
  const [ticketPO, setTicketPO] = useState<PreOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCopiedLink, setIsCopiedLink] = useState<boolean>(false);

  // Settlement Form State
  const [settleMethod, setSettleMethod] = useState<'cash' | 'qris' | 'transfer' | 'debit'>('cash');
  const [settleCashAmount, setSettleCashAmount] = useState<number>(0);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Dynamic Public Customer PO Form URL (automatically targets cashier's branch when in kasir mode)
  const publicPOUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://su-qur.app?page=po-order';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const outletParam = effectiveOutletId !== 'ALL' ? `&outlet=${encodeURIComponent(effectiveOutletId)}` : '';
    return `${origin}${pathname}?page=po-order${outletParam}`;
  }, [effectiveOutletId]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicPOUrl).then(() => {
        setIsCopiedLink(true);
        showToast('Tautan Form Pre-Order Publik berhasil disalin ke clipboard!');
        setTimeout(() => setIsCopiedLink(false), 3000);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = publicPOUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsCopiedLink(true);
      showToast('Tautan Form Pre-Order Publik berhasil disalin!');
      setTimeout(() => setIsCopiedLink(false), 3000);
    }
  };

  // Tomorrow date string
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

  // Load Data
  const loadData = () => {
    const list = StorageService.getPreOrders();
    setPreOrders((prev) => {
      if (prev.length === list.length && JSON.stringify(prev) === JSON.stringify(list)) {
        return prev;
      }
      return list;
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Metrics calculation - strictly isolated to cashier's outlet when in kasir role
  const metrics = useMemo(() => {
    const baseList = preOrders.filter((p) => {
      if (isKasir) {
        return p.outletId === cashierOutletId;
      }
      if (selectedOutletId !== 'ALL') {
        return p.outletId === selectedOutletId;
      }
      return true;
    });

    const totalScheduled = baseList.filter((p) => p.orderStatus === 'SCHEDULED').length;
    const todayOrders = baseList.filter((p) => p.scheduledDate === todayStr && p.orderStatus !== 'CANCELLED').length;
    const inPrep = baseList.filter((p) => p.orderStatus === 'IN_PREPARATION').length;
    const ready = baseList.filter((p) => p.orderStatus === 'READY').length;
    const totalReceivable = baseList
      .filter((p) => p.orderStatus !== 'COMPLETED' && p.orderStatus !== 'CANCELLED')
      .reduce((sum, p) => sum + (p.remainingBalance || 0), 0);

    return { totalScheduled, todayOrders, inPrep, ready, totalReceivable };
  }, [preOrders, todayStr, isKasir, cashierOutletId, selectedOutletId]);

  // Filtered list - strictly isolated to cashier's branch when in kasir role
  const filteredPreOrders = useMemo(() => {
    return preOrders.filter((po) => {
      // Outlet filter (strictly enforce cashier outlet if kasir)
      if (isKasir) {
        if (po.outletId !== cashierOutletId) return false;
      } else if (selectedOutletId !== 'ALL' && po.outletId !== selectedOutletId) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = po.customerName.toLowerCase().includes(q);
        const matchPhone = po.customerPhone.includes(q);
        const matchPO = (po.poNumber || '').toLowerCase().includes(q);
        const matchItem = po.items.some((it) => it.product.name.toLowerCase().includes(q));
        if (!matchName && !matchPhone && !matchPO && !matchItem) return false;
      }

      // Type filter
      if (typeFilter !== 'ALL' && po.orderType !== typeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && po.orderStatus !== statusFilter) {
        return false;
      }

      // Date quick filter
      if (dateFilter === 'today' && po.scheduledDate !== todayStr) return false;
      if (dateFilter === 'tomorrow' && po.scheduledDate !== tomorrowStr) return false;
      if (dateFilter === 'upcoming' && po.scheduledDate < todayStr) return false;
      if (dateFilter === 'completed' && po.orderStatus !== 'COMPLETED') return false;

      return true;
    });
  }, [preOrders, searchQuery, isKasir, cashierOutletId, selectedOutletId, typeFilter, statusFilter, dateFilter, todayStr, tomorrowStr]);

  // Handlers for Status Transitions
  const handleStartPrep = (po: PreOrder) => {
    StorageService.updatePreOrderStatus(po.id, 'IN_PREPARATION');
    loadData();
    showToast(`Pesanan ${po.poNumber || po.customerName} mulai diproses dapur!`);
  };

  const handleMarkReady = (po: PreOrder) => {
    StorageService.updatePreOrderStatus(po.id, 'READY');
    loadData();
    showToast(`Pesanan ${po.poNumber || po.customerName} SIAP diambil / diantar!`);
  };

  const handleOpenSettlement = (po: PreOrder) => {
    setSettlementPO(po);
    setSettleMethod('cash');
    setSettleCashAmount(po.remainingBalance);
    setSettleError(null);
  };

  const handleConfirmSettlement = () => {
    if (!settlementPO) return;
    setIsSettling(true);
    setSettleError(null);

    try {
      if (settleMethod === 'cash' && settleCashAmount < settlementPO.remainingBalance) {
        setSettleError('Nominal tunai yang diterima kurang dari sisa tagihan!');
        setIsSettling(false);
        return;
      }

      const result = StorageService.fulfillAndCompletePreOrder(
        settlementPO.id,
        settleMethod,
        settleMethod === 'cash' ? settleCashAmount : settlementPO.remainingBalance,
        { id: user.id, name: user.name }
      );

      if (!result.success) {
        setSettleError(result.error || 'Gagal memproses pelunasan');
        setIsSettling(false);
        return;
      }

      loadData();
      setSettlementPO(null);
      showToast(`Pelunasan berhasil! Stok bahan telah dikurangi & dicatat di Buku Kas.`);
    } catch (err: any) {
      console.error(err);
      setSettleError(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSettling(false);
    }
  };

  const handleCancelPO = (po: PreOrder) => {
    if (window.confirm(`Apakah Anda yakin ingin membatalkan Pre-Order ${po.poNumber || po.customerName}?`)) {
      StorageService.updatePreOrderStatus(po.id, 'CANCELLED');
      loadData();
      showToast(`Pre-Order ${po.poNumber || po.customerName} telah dibatalkan.`);
    }
  };

  const handleDeletePO = (po: PreOrder) => {
    if (window.confirm(`Hapus permanen data Pre-Order ${po.poNumber || po.customerName}?`)) {
      StorageService.deletePreOrder(po.id);
      loadData();
      showToast(`Pre-Order telah dihapus.`);
    }
  };

  // WhatsApp helper
  const handleOpenWhatsApp = (po: PreOrder) => {
    let phone = po.customerPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }
    const msg = encodeURIComponent(
      `Halo Kak ${po.customerName}, kami dari Kedai Su-Qur. Mengenai Pre-Order / Reservasi Anda (#${po.poNumber || po.id}) untuk tanggal ${po.scheduledDate} jam ${po.scheduledTime}. Status pesanan Anda saat ini: ${po.orderStatus}. Ada yang bisa kami bantu?`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  // Format Helper
  const getStatusBadge = (status: PreOrderStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            <span>Terjadwal</span>
          </span>
        );
      case 'IN_PREPARATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300 animate-pulse">
            <Play className="w-3 h-3 text-blue-700" />
            <span>Dapur Memasak</span>
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>Siap Diambil / Diantar</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-300">
            <CheckCheck className="w-3 h-3 text-stone-600" />
            <span>Selesai & Lunas</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-700" />
            <span>Dibatalkan</span>
          </span>
        );
    }
  };

  const getOrderTypeBadge = (type: PreOrderType) => {
    switch (type) {
      case 'PICKUP':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <Store className="w-3 h-3 text-amber-700" />
            <span>Self-Pickup</span>
          </span>
        );
      case 'DELIVERY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
            <Truck className="w-3 h-3 text-purple-700" />
            <span>Delivery / Katering</span>
          </span>
        );
      case 'DINE_IN_RESERVATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
            <UtensilsCrossed className="w-3 h-3 text-emerald-700" />
            <span>Reservasi Meja</span>
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-[#2B1713]">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 bg-[#3E2723] text-amber-100 px-4 py-3 rounded-2xl shadow-xl border border-amber-400/40 flex items-center gap-2.5 text-xs font-bold"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-[#3E2723] rounded-3xl p-5 sm:p-6 text-[#FDFBF7] shadow-xl border border-[#5D4037] relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-xl sm:text-2xl text-amber-100">
                  Pre-Order (PO) & Jadwal Reservasi
                </h1>
                <span className="text-[10px] bg-amber-400 text-[#2B1713] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  Slot Waktu
                </span>
                {isKasir && cashierOutlet && (
                  <span className="text-[10px] bg-amber-900/80 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Store className="w-3 h-3 text-amber-300" />
                    <span>{cashierOutlet.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-amber-200/80 mt-1 max-w-2xl">
                {isKasir
                  ? `Khusus memproses dan menyelesaikan jadwal PO untuk outlet ${cashierOutlet?.name || 'kasir'}.`
                  : 'Kelola jadwal katering, pesanan partai besar, reservasi meja makan, dan koordinasi dapur seluruh cabang kedai Su-Qur.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsPOQrModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/30 to-amber-600/30 hover:from-amber-500/40 hover:to-amber-600/40 text-amber-100 border-2 border-amber-400 font-bold text-xs shadow-lg transition-all flex items-center gap-2 ring-2 ring-amber-400/30 active:scale-95 cursor-pointer"
              title="Bagikan Tautan & QR Code Form Pre-Order Pelanggan"
            >
              <QrCode className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Share Link & Scan QR PO</span>
              <span className="bg-amber-400 text-[#2B1713] text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
                Publik
              </span>
            </button>

            <button
              onClick={loadData}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-100 border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#2B1713] font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buat PO Manual</span>
            </button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Prominent Quick-Access Card: Customer PO Online Link & QR Code Banner */}
      <div className="bg-gradient-to-br from-[#FAF3DD] via-[#FDFBF7] to-[#F5EBE0] rounded-3xl p-4 sm:p-5 border-2 border-[#D4A373] shadow-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-900 border border-amber-400/60 flex items-center justify-center font-black shrink-0 shadow-inner">
              <Globe className="w-6 h-6 text-amber-800" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-black text-sm sm:text-base text-[#2B1713]">
                  Tautan & QR Code Form Pre-Order Pelanggan
                </h2>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Online & Realtime Sync
                </span>
              </div>
              <p className="text-xs text-[#795548] mt-0.5 max-w-xl">
                Bagikan tautan ini ke pelanggan atau pasang cetakan QR Code di meja & kasir. Pesanan PO otomatis terkirim dan tercatat di jadwal ini.
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center bg-white rounded-xl border border-[#D4A373] px-2.5 py-1.5 shadow-2xs">
              <input
                type="text"
                readOnly
                value={publicPOUrl}
                className="text-xs font-mono text-[#5D4037] bg-transparent outline-none w-48 sm:w-60 truncate select-all"
                title="Tautan Form Pre-Order Pelanggan"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                  isCopiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-2xs'
                }`}
                title="Salin Tautan Form PO"
              >
                {isCopiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPOQrModalOpen(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-amber-200 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Buka Generator QR & Cetak Standee Meja"
              >
                <QrCode className="w-4 h-4 text-amber-300" />
                <span>Buka QR & Cetak</span>
              </button>

              <a
                href={publicPOUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-white hover:bg-amber-50 text-[#3E2723] border border-[#D4A373] font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
                title="Buka Halaman Form PO Pelanggan di Tab Baru"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-800" />
                <span className="hidden sm:inline">Pratinjau</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-2xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
            Jadwal Hari Ini
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-[#3E2723]">{metrics.todayOrders}</span>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              {todayStr}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-2xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
            Total Terjadwal
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-800">{metrics.totalScheduled}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-2xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
            Dapur Memasak
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-700">{metrics.inPrep}</span>
            <Play className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-2xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
            Siap Diambil/Kirim
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{metrics.ready}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
            Sisa Piutang PO
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-rose-700">
              {formatRp(metrics.totalReceivable)}
            </span>
            <DollarSign className="w-4 h-4 text-rose-600" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor PO, nama pemesan, no telp, atau nama menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-amber-600 font-medium"
            />
          </div>

          {/* Quick Date Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'Semua Jadwal' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'tomorrow', label: 'Besok' },
              { id: 'upcoming', label: 'Mendatang' },
              { id: 'completed', label: 'Riwayat Selesai' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  dateFilter === tab.id
                    ? 'bg-[#3E2723] text-amber-200 shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Second row filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2 border-t border-stone-100 text-xs">
          {/* Status Filter */}
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Status Progres:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="SCHEDULED">Terjadwal (Belum Mulai)</option>
              <option value="IN_PREPARATION">Sedang Dibuat (Dapur)</option>
              <option value="READY">Siap Diambil / Diantar</option>
              <option value="COMPLETED">Selesai & Lunas</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Tipe Pesanan:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="PICKUP">Ambil Sendiri (Pickup)</option>
              <option value="DELIVERY">Delivery / Katering</option>
              <option value="DINE_IN_RESERVATION">Reservasi Meja</option>
            </select>
          </div>

          {/* Outlet Filter */}
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">
              Cabang Kedai:
            </span>
            {isKasir ? (
              <div
                title="Akun kasir hanya menampilkan jadwal & pesanan untuk outlet ini agar tidak salah penyelesaian dengan kasir lain."
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-[#2B1713] shadow-2xs"
              >
                <Store className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">{cashierOutlet?.name || 'Outlet Aktif'}</span>
                <span className="ml-auto text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black tracking-tight shrink-0 border border-amber-300/80">
                  Outlet Kasir
                </span>
              </div>
            ) : (
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 focus:bg-white cursor-pointer"
              >
                <option value="ALL">Semua Cabang ({outlets.length})</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Count Badge */}
          <div className="flex items-end">
            <div className="w-full py-1.5 px-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold text-center truncate">
              Menampilkan {filteredPreOrders.length} Pesanan
            </div>
          </div>
        </div>
      </div>

      {/* Orders Grid / Timeline Cards */}
      {filteredPreOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-stone-300 space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-stone-700">Tidak ada jadwal Pre-Order ditemukan</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Belum ada pesanan dengan filter yang dipilih. Buat pesanan pre-order atau reservasi baru sekarang.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-amber-100 font-bold text-xs shadow-sm transition-colors inline-flex items-center gap-2 mt-2"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>+ Buat Pre-Order Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {filteredPreOrders.map((po) => {
            const isToday = po.scheduledDate === todayStr;
            const isOverdue = po.scheduledDate < todayStr && po.orderStatus !== 'COMPLETED' && po.orderStatus !== 'CANCELLED';

            return (
              <motion.div
                key={po.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-3xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                  isToday
                    ? 'border-amber-400 ring-2 ring-amber-400/20'
                    : isOverdue
                    ? 'border-rose-300 bg-rose-50/20'
                    : 'border-[#E6D5C3] hover:border-amber-400'
                }`}
              >
                {/* Card Top Header */}
                <div className="p-4 sm:p-5 border-b border-stone-100 bg-stone-50/60 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-stone-200 text-stone-800 px-2 py-0.5 rounded-md">
                        {po.poNumber || po.id}
                      </span>
                      {getOrderTypeBadge(po.orderType)}
                      {getStatusBadge(po.orderStatus)}
                    </div>

                    {/* Schedule Time Badge */}
                    <div className="flex items-center gap-2 pt-1">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold ${
                          isToday
                            ? 'bg-amber-500 text-white shadow-xs'
                            : isOverdue
                            ? 'bg-rose-600 text-white'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{po.scheduledDate}</span>
                        <span className="opacity-60">•</span>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{po.scheduledTime} WIB</span>
                      </div>
                      {isToday && (
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                          HARI INI
                        </span>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp button */}
                  <button
                    onClick={() => handleOpenWhatsApp(po)}
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors flex items-center gap-1 text-[11px] font-bold shrink-0"
                    title="Hubungi via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-3.5 flex-1">
                  {/* Customer details */}
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <span className="text-stone-400 text-[10px] font-bold uppercase block">Pemesan:</span>
                      <span className="font-bold text-sm text-[#2B1713]">{po.customerName}</span>
                      <span className="font-mono text-stone-500 block text-[11px]">{po.customerPhone}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-stone-400 text-[10px] font-bold uppercase block">Cabang:</span>
                      <span className="font-semibold text-xs text-stone-700">{po.outletName || 'Cabang Utama'}</span>
                    </div>
                  </div>

                  {/* Conditional Details: Table or Address */}
                  {po.tableNumber && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs flex items-center gap-2 text-emerald-900">
                      <UtensilsCrossed className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <span className="font-bold">Slot Meja: </span>
                        <span>{po.tableNumber}</span>
                      </div>
                    </div>
                  )}

                  {po.deliveryAddress && (
                    <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs flex items-start gap-2 text-purple-900">
                      <MapPin className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Alamat Antar: </span>
                        <span>{po.deliveryAddress}</span>
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wider pb-1 border-b border-stone-200">
                      <span>Daftar Menu Pesanan</span>
                      <span>{po.items.reduce((s, i) => s + i.quantity, 0)} Item</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      {po.items.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 py-0.5">
                          <div className="flex-1">
                            <span className="font-bold text-[#2B1713]">{item.quantity}x {item.product.name}</span>
                            {item.selectedCup && (
                              <span className="text-[11px] text-stone-500 ml-1">({item.selectedCup})</span>
                            )}
                            {item.selectedIce && (
                              <span className="text-[10px] text-amber-700 ml-1">[{item.selectedIce}]</span>
                            )}
                            {item.notes && (
                              <p className="text-[10px] text-stone-500 italic mt-0.5 pl-3 border-l-2 border-amber-300">
                                "{item.notes}"
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-stone-700 font-semibold shrink-0">
                            {formatRp(item.totalPrice)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {po.notes && (
                      <div className="pt-2 border-t border-stone-200 text-[11px] text-amber-900 bg-amber-50/60 p-2 rounded-xl">
                        <span className="font-bold">Catatan PO: </span>
                        <span>{po.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="p-3 bg-[#FAF3DD]/60 rounded-2xl border border-amber-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-600 font-medium">Total Nilai Pesanan:</span>
                      <span className="font-bold font-mono text-[#3E2723]">{formatRp(po.totalAmount)}</span>
                    </div>

                    <div className="flex items-center justify-between text-emerald-800">
                      <span>Uang Muka (DP) Terbayar:</span>
                      <span className="font-bold font-mono">
                        {formatRp(po.depositAmount || 0)} {po.dpPaymentMethod ? `(${po.dpPaymentMethod})` : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-sm">
                      <span className="font-bold text-[#2B1713]">Sisa Pelunasan:</span>
                      <span
                        className={`font-bold font-mono ${
                          (po.remainingBalance || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {(po.remainingBalance || 0) > 0 ? formatRp(po.remainingBalance) : 'LUNAS (100%)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* Print and secondary options */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTicketPO(po)}
                      className="p-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold transition-colors flex items-center gap-1"
                      title="Cetak Tiket Dapur / Struk PO"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cetak</span>
                    </button>

                    {po.orderStatus !== 'COMPLETED' && po.orderStatus !== 'CANCELLED' && (
                      <button
                        onClick={() => handleCancelPO(po)}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                        title="Batalkan Pesanan"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(po.orderStatus === 'COMPLETED' || po.orderStatus === 'CANCELLED') && (
                      <button
                        onClick={() => handleDeletePO(po)}
                        className="p-2 rounded-xl bg-white hover:bg-stone-200 text-stone-400 hover:text-stone-700 border border-stone-200 text-xs transition-colors"
                        title="Hapus Data"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Primary Workflow Actions */}
                  <div className="flex items-center gap-2">
                    {po.orderStatus === 'SCHEDULED' && (
                      <button
                        onClick={() => handleStartPrep(po)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Mulai Buat</span>
                      </button>
                    )}

                    {po.orderStatus === 'IN_PREPARATION' && (
                      <button
                        onClick={() => handleMarkReady(po)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Siap Diambil / Diantar</span>
                      </button>
                    )}

                    {po.orderStatus !== 'COMPLETED' && po.orderStatus !== 'CANCELLED' && (
                      <button
                        onClick={() => handleOpenSettlement(po)}
                        className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-amber-100 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pelunasan & Selesai</span>
                      </button>
                    )}

                    {po.orderStatus === 'COMPLETED' && (
                      <span className="text-xs font-bold text-stone-500 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Selesai</span>
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Settlement & Completion Modal */}
      <AnimatePresence>
        {settlementPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FDFBF7] rounded-3xl w-full max-w-lg border border-[#E6D5C3] shadow-2xl overflow-hidden"
            >
              <div className="bg-[#3E2723] text-amber-100 p-5 flex items-center justify-between border-b border-[#5D4037]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-[#2B1713] flex items-center justify-center font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-amber-100">
                      Pelunasan & Penyelesaian Pesanan
                    </h3>
                    <p className="text-xs text-amber-200/80">
                      {settlementPO.poNumber || settlementPO.id} • {settlementPO.customerName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettlementPO(null)}
                  className="p-1.5 rounded-lg text-stone-300 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4 text-[#2B1713]">
                {settleError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{settleError}</span>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#E6D5C3] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 font-medium">Total Nilai Pesanan:</span>
                    <span className="font-bold font-mono text-[#3E2723]">{formatRp(settlementPO.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="font-medium">DP Yang Sudah Diterima:</span>
                    <span className="font-bold font-mono">{formatRp(settlementPO.depositAmount || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-sm">
                    <span className="font-bold text-[#3E2723]">Sisa Yang Harus Dibayar:</span>
                    <span className="font-bold font-mono text-base text-rose-700">
                      {formatRp(settlementPO.remainingBalance)}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                {settlementPO.remainingBalance > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#8D7B68]">
                      Metode Pelunasan:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'cash', label: 'Tunai (Cash)', icon: Banknote },
                        { id: 'qris', label: 'QRIS', icon: QrCode },
                        { id: 'transfer', label: 'Transfer Bank', icon: CreditCard },
                      ].map((m) => {
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSettleMethod(m.id as any)}
                            className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                              settleMethod === m.id
                                ? 'bg-[#3E2723] text-amber-200 border-[#3E2723] shadow-xs'
                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-bold">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {settleMethod === 'cash' && (
                      <div className="pt-1 space-y-2">
                        <label className="block text-xs font-semibold text-stone-600">
                          Nominal Tunai Diterima (Rp):
                        </label>
                        <input
                          type="number"
                          min={settlementPO.remainingBalance}
                          step={5000}
                          value={settleCashAmount}
                          onChange={(e) => setSettleCashAmount(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-amber-600"
                        />
                        {settleCashAmount > settlementPO.remainingBalance && (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-900 font-bold font-mono">
                            <span>Kembalian:</span>
                            <span>{formatRp(settleCashAmount - settlementPO.remainingBalance)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold text-center">
                    Pesanan ini sudah lunas 100% sebelumnya. Siap diselesaikan!
                  </div>
                )}

                {/* Auto Actions Info */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-[#5D4037] space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Aksi Otomatis Sistem Su-Qur:</span>
                  </div>
                  <p>• Stok bahan baku resep dikurangi otomatis dari inventory cabang.</p>
                  <p>• Pelunasan dicatat ke Buku Kas (Kas Masuk Outlet) & Riwayat Transaksi.</p>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSettlementPO(null)}
                    disabled={isSettling}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSettlement}
                    disabled={isSettling}
                    className="px-5 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-amber-100 text-xs font-bold transition-all shadow-md flex items-center gap-2"
                  >
                    <Check className="w-4 h-4 text-amber-400" />
                    <span>{isSettling ? 'Memproses...' : 'Konfirmasi & Selesaikan'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket & Receipt Print Modal */}
      <AnimatePresence>
        {ticketPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md border border-[#E6D5C3] shadow-2xl overflow-hidden text-[#2B1713]"
            >
              <div className="p-4 bg-[#3E2723] text-amber-100 flex items-center justify-between">
                <h4 className="font-serif font-bold text-sm">Tiket Surat Pesanan PO & Dapur</h4>
                <button onClick={() => setTicketPO(null)} className="text-stone-300 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-mono bg-stone-50 border-b border-stone-200">
                <div className="text-center pb-2 border-b border-dashed border-stone-300">
                  <h3 className="font-bold text-base font-serif">KEDAI SU-QUR</h3>
                  <p className="text-[10px] text-stone-500">Kopi Susu Kurma Nusantara</p>
                  <p className="text-[10px] text-stone-500 font-bold mt-1">
                    SURAT PRE-ORDER & RESERVASI #{ticketPO.poNumber || ticketPO.id}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Pemesan:</span>
                    <span className="font-bold">{ticketPO.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Telepon:</span>
                    <span>{ticketPO.customerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jadwal:</span>
                    <span className="font-bold">{ticketPO.scheduledDate} {ticketPO.scheduledTime} WIB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Layanan:</span>
                    <span className="font-bold">{ticketPO.orderType}</span>
                  </div>
                  {ticketPO.tableNumber && (
                    <div className="flex justify-between">
                      <span>Meja:</span>
                      <span className="font-bold">{ticketPO.tableNumber}</span>
                    </div>
                  )}
                  {ticketPO.deliveryAddress && (
                    <div>
                      <span>Alamat:</span>
                      <p className="text-[11px] font-sans font-medium text-stone-700 mt-0.5">
                        {ticketPO.deliveryAddress}
                      </p>
                    </div>
                  )}
                </div>

                <div className="py-2 border-t border-b border-dashed border-stone-300 space-y-1.5">
                  <div className="font-bold">RINCIAN PESANAN:</div>
                  {ticketPO.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{it.quantity}x {it.product.name}</span>
                      <span>{formatRp(it.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-bold">{formatRp(ticketPO.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>DP Masuk:</span>
                    <span className="font-bold">{formatRp(ticketPO.depositAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-rose-700">
                    <span>Sisa Pelunasan:</span>
                    <span>{formatRp(ticketPO.remainingBalance)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white flex items-center justify-end gap-2">
                <button
                  onClick={() => setTicketPO(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-amber-100 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Cetak Browser / Thermal</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Pre-Order Modal */}
      <CreatePreOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        cart={
          products.length > 0
            ? [
                {
                  product: products[0],
                  quantity: 5,
                  selectedCup: '16oz',
                  selectedIce: 'Pakai Es',
                  unitPrice: products[0].price,
                  totalPrice: products[0].price * 5,
                  cogsTotal: (products[0].cogs || 0) * 5,
                },
              ]
            : []
        }
        subtotal={products.length > 0 ? products[0].price * 5 : 100000}
        user={user}
        settings={settings}
        onSuccess={(saved) => {
          loadData();
          showToast(`Pre-Order ${saved.poNumber || saved.customerName} berhasil dibuat!`);
        }}
      />

      {/* Share Link & Scan QR PO Modal */}
      <POQrGenerator
        isOpen={isPOQrModalOpen}
        onClose={() => setIsPOQrModalOpen(false)}
        isModal={true}
        outlets={outlets}
        currentOutlet={cashierOutlet}
        settings={settings}
        user={user}
        isKasir={isKasir}
      />
    </div>
  );
};
