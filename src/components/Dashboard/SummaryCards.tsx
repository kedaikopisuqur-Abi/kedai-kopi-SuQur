import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Ingredient, Expense, Product, User } from '../../types';
import { formatRp } from '../../utils/formatters';
import {
  ShoppingBag,
  ArrowUpRight,
  Coffee,
  DollarSign,
  CreditCard,
  QrCode,
  Wallet,
  TrendingUp,
  Receipt,
  ChevronDown,
  ChevronUp,
  Layers,
  Store,
  Bike,
} from 'lucide-react';

interface SummaryCardsProps {
  transactions: Transaction[];
  filteredTxs: Transaction[];
  expenses: Expense[];
  products: Product[];
  ingredients: Ingredient[];
  user?: User;
  period: 'today' | 'week' | 'month';
  onNavigateTab: (tab: any) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  filteredTxs,
  expenses,
  products,
  user,
  period,
  onNavigateTab,
}) => {
  const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null);
  const [isJustUpdated, setIsJustUpdated] = useState(false);
  const prevTxCountRef = useRef(filteredTxs.length);
  const prevTotalOmzetRef = useRef(0);

  // Financial Calculations Memoized
  const totalOmzet = useMemo(() => filteredTxs.reduce((acc, t) => acc + t.total, 0), [filteredTxs]);
  const totalHpp = useMemo(() => filteredTxs.reduce((acc, t) => acc + t.totalCogs, 0), [filteredTxs]);
  const grossProfit = useMemo(() => totalOmzet - totalHpp, [totalOmzet, totalHpp]);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => now.toISOString().split('T')[0], [now]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((acc, e) => {
      const eDate = new Date(e.date);
      if (period === 'today' && e.date === todayStr) return acc + e.amount;
      if (period === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        if (eDate >= sevenDaysAgo) return acc + e.amount;
      }
      if (period === 'month' && eDate.getMonth() === now.getMonth()) return acc + e.amount;
      return acc;
    }, 0);
  }, [expenses, period, todayStr, now]);

  const netProfit = useMemo(() => grossProfit - totalExpenses, [grossProfit, totalExpenses]);
  const netMargin = useMemo(
    () => (totalOmzet > 0 ? ((netProfit / totalOmzet) * 100).toFixed(1) : '0'),
    [totalOmzet, netProfit]
  );
  const avgOrderValue = useMemo(
    () => (filteredTxs.length > 0 ? Math.round(totalOmzet / filteredTxs.length) : 0),
    [filteredTxs.length, totalOmzet]
  );

  // Breakdown Calculations Memoized
  const paymentBreakdown = useMemo(() => {
    return filteredTxs.reduce(
      (acc, tx) => {
        const method = (tx.paymentMethod || 'cash') as string;
        if (method === 'cash') acc.cash += tx.total;
        else if (method === 'qris') acc.qris += tx.total;
        else if (method === 'transfer' || method === 'debit') acc.transfer += tx.total;
        else acc.other += tx.total;
        return acc;
      },
      { cash: 0, qris: 0, transfer: 0, other: 0 }
    );
  }, [filteredTxs]);

  const orderTypeBreakdown = useMemo(() => {
    return filteredTxs.reduce(
      (acc, tx) => {
        const type = (tx.orderType || 'dine_in') as string;
        if (type === 'dine_in') acc.dineIn += 1;
        else if (type === 'take_away' || type === 'takeaway') acc.takeaway += 1;
        else if (type === 'online_delivery' || type === 'shopeefood_merchant') acc.online += 1;
        return acc;
      },
      { dineIn: 0, takeaway: 0, online: 0 }
    );
  }, [filteredTxs]);

  // Portions Memoized
  const { totalPortions, drinkPortions, foodPortions, snackPortions } = useMemo(() => {
    let total = 0;
    let drink = 0;
    let food = 0;
    let snack = 0;

    filteredTxs.forEach((tx) => {
      tx.items?.forEach((item) => {
        total += item.quantity;
        const prod = products.find((p) => p.id === item.productId);
        const cat = (prod?.category || '').toLowerCase();
        if (
          cat.includes('kopi') ||
          cat.includes('minuman') ||
          cat.includes('brew') ||
          cat.includes('tea') ||
          cat.includes('drink')
        ) {
          drink += item.quantity;
        } else if (cat.includes('makanan') || cat.includes('rice') || cat.includes('main')) {
          food += item.quantity;
        } else {
          snack += item.quantity;
        }
      });
    });

    return { totalPortions: total, drinkPortions: drink, foodPortions: food, snackPortions: snack };
  }, [filteredTxs, products]);

  // Top expense category
  const expenseCatMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return map;
  }, [expenses]);

  const topExpenseEntry = useMemo(
    () => Object.entries(expenseCatMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0],
    [expenseCatMap]
  );

  // Detect update animations
  useEffect(() => {
    if (filteredTxs.length !== prevTxCountRef.current || totalOmzet !== prevTotalOmzetRef.current) {
      setIsJustUpdated(true);
      const timer = setTimeout(() => setIsJustUpdated(false), 2400);
      prevTxCountRef.current = filteredTxs.length;
      prevTotalOmzetRef.current = totalOmzet;
      return () => clearTimeout(timer);
    }
  }, [filteredTxs.length, totalOmzet]);

  const periodLabel = period === 'today' ? 'Hari Ini' : period === 'week' ? '7 Hari Terakhir' : 'Bulan Ini';

  return (
    <div className="space-y-4">
      {/* Live Transaction Incoming Pulse Toast */}
      <AnimatePresence>
        {isJustUpdated && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-sm text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-amber-400">Data Transaksi Diperbarui</span>
              <span className="text-slate-400 text-[11px]">• Tersinkronisasi otomatis</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-emerald-300 px-2 py-0.5 rounded-md font-bold">
              Live
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 Interactive Financial Stat Cards - Ringkas, Simpel & Jelas Tanpa Terpotong */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* CARD 1: Total Omzet */}
        <div
          onClick={() => setActiveDrilldown(activeDrilldown === 'omzet' ? null : 'omzet')}
          className={`cursor-pointer bg-white p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-xs ${
            activeDrilldown === 'omzet'
              ? 'border-slate-900 ring-2 ring-slate-900/5'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Total Omzet
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                Rata-rata: {formatRp(avgOrderValue)}
              </span>
            </div>
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
              <ShoppingBag className="w-3 h-3" />
            </div>
          </div>

          <div className="my-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight tabular-nums">
              {formatRp(totalOmzet)}
            </h2>
          </div>

          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <div className="flex items-center gap-1 text-slate-600 font-medium">
              <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{filteredTxs.length} Nota</span>
            </div>
            <div className="flex items-center gap-0.5 text-slate-500 font-bold shrink-0">
              <span>Rincian</span>
              {activeDrilldown === 'omzet' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          </div>
        </div>

        {/* CARD 2: Total Laba Bersih (Admin) / Transaksi Selesai (Kasir) */}
        <div
          onClick={() => setActiveDrilldown(activeDrilldown === (user?.role === 'kasir' ? 'orders' : 'profit') ? null : (user?.role === 'kasir' ? 'orders' : 'profit'))}
          className={`cursor-pointer bg-slate-900 p-2.5 sm:p-3 rounded-xl text-white shadow-2xs border transition-all duration-200 flex flex-col justify-between ${
            activeDrilldown === (user?.role === 'kasir' ? 'orders' : 'profit')
              ? 'border-amber-400 ring-2 ring-amber-400/20'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          {user?.role === 'kasir' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Transaksi Selesai
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium block">
                    {filteredTxs.length} Nota Berhasil
                  </span>
                </div>
                <div className="w-6 h-6 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <Receipt className="w-3 h-3" />
                </div>
              </div>

              <div className="my-1">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight tabular-nums">
                  {filteredTxs.length} <span className="text-xs font-normal text-slate-400">Nota</span>
                </h2>
              </div>

              <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-300">
                  Dine: {orderTypeBreakdown.dineIn} • TA: {orderTypeBreakdown.takeaway}
                </span>
                <div className="flex items-center gap-0.5 text-slate-400 font-bold shrink-0">
                  <span>Rincian</span>
                  {activeDrilldown === 'orders' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Total Laba Bersih
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium block">
                    Margin: {netMargin}%
                  </span>
                </div>
                <div className="w-6 h-6 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <TrendingUp className="w-3 h-3" />
                </div>
              </div>

              <div className="my-1">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight tabular-nums">
                  {formatRp(netProfit)}
                </h2>
              </div>

              <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[10.5px]">
                <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                  <span>Kotor: {formatRp(grossProfit)}</span>
                </div>
                <div className="flex items-center gap-0.5 text-slate-400 font-bold shrink-0">
                  <span>Rincian</span>
                  {activeDrilldown === 'profit' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CARD 3: Porsi Terjual (Kasir) / HPP COGS (Admin) */}
        <div
          onClick={() => setActiveDrilldown(activeDrilldown === 'portions' ? null : 'portions')}
          className={`cursor-pointer bg-white p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-xs ${
            activeDrilldown === 'portions'
              ? 'border-slate-900 ring-2 ring-slate-900/5'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          {user?.role === 'kasir' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Menu Terjual
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    {drinkPortions} Minum • {foodPortions} Makan
                  </span>
                </div>
                <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                  <Coffee className="w-3 h-3" />
                </div>
              </div>

              <div className="my-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight tabular-nums">
                  {totalPortions} <span className="text-xs font-normal text-slate-500">Porsi</span>
                </h2>
              </div>

              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500">Camilan: {snackPortions} Porsi</span>
                <div className="flex items-center gap-0.5 text-slate-500 font-bold shrink-0">
                  <span>Detail</span>
                  {activeDrilldown === 'portions' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Modal HPP Bahan
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    HPP: {totalOmzet > 0 ? Math.round((totalHpp / totalOmzet) * 100) : 0}% Omzet
                  </span>
                </div>
                <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                  <Layers className="w-3 h-3" />
                </div>
              </div>

              <div className="my-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight tabular-nums">
                  {formatRp(totalHpp)}
                </h2>
              </div>

              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500">{totalPortions} Porsi Menu</span>
                <div className="flex items-center gap-0.5 text-slate-500 font-bold shrink-0">
                  <span>Detail</span>
                  {activeDrilldown === 'portions' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CARD 4: Biaya Operasional (Admin) / Penerimaan Non-Tunai (Kasir) */}
        <div
          onClick={() => setActiveDrilldown(activeDrilldown === (user?.role === 'kasir' ? 'omzet' : 'expenses') ? null : (user?.role === 'kasir' ? 'omzet' : 'expenses'))}
          className={`cursor-pointer bg-white p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-xs ${
            activeDrilldown === (user?.role === 'kasir' ? 'omzet' : 'expenses')
              ? 'border-slate-900 ring-2 ring-slate-900/5'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          {user?.role === 'kasir' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Penerimaan Non-Tunai
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    QRIS &amp; Transfer
                  </span>
                </div>
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                  <QrCode className="w-3 h-3" />
                </div>
              </div>

              <div className="my-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight tabular-nums">
                  {formatRp(paymentBreakdown.qris + paymentBreakdown.transfer + paymentBreakdown.other)}
                </h2>
              </div>

              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500">
                  Tunai: {formatRp(paymentBreakdown.cash)}
                </span>
                <div className="flex items-center gap-0.5 text-slate-500 font-bold shrink-0">
                  <span>Rincian</span>
                  {activeDrilldown === 'omzet' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Biaya Operasional
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    {expenses.length} Pos Pengeluaran
                  </span>
                </div>
                <div className="w-6 h-6 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-100">
                  <DollarSign className="w-3 h-3" />
                </div>
              </div>

              <div className="my-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight tabular-nums">
                  {formatRp(totalExpenses)}
                </h2>
              </div>

              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500 truncate">
                  {topExpenseEntry ? topExpenseEntry[0] : 'Tidak ada biaya'}
                </span>
                <div className="flex items-center gap-0.5 text-slate-500 font-bold shrink-0">
                  <span>Rincian</span>
                  {activeDrilldown === 'expenses' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Interactive Expandable Drilldown Panel */}
      <AnimatePresence>
        {activeDrilldown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-slate-50 rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs text-slate-800"
          >
            {/* DRILLDOWN 1: Omzet & Metode Pembayaran */}
            {activeDrilldown === 'omzet' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    Rincian Metode Pembayaran & Tipe Pesanan
                  </h3>
                  <button
                    onClick={() => setActiveDrilldown(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-lg bg-white border border-slate-200 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Metode Pembayaran */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Distribusi Pembayaran
                    </span>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between font-medium mb-1 text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-amber-600" /> Tunai (Cash)
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatRp(paymentBreakdown.cash)}{' '}
                            <span className="text-slate-400 text-[10px]">
                              ({totalOmzet > 0 ? Math.round((paymentBreakdown.cash / totalOmzet) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full"
                            style={{
                              width: `${totalOmzet > 0 ? (paymentBreakdown.cash / totalOmzet) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-medium mb-1 text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-emerald-600" /> QRIS
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatRp(paymentBreakdown.qris)}{' '}
                            <span className="text-slate-400 text-[10px]">
                              ({totalOmzet > 0 ? Math.round((paymentBreakdown.qris / totalOmzet) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{
                              width: `${totalOmzet > 0 ? (paymentBreakdown.qris / totalOmzet) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-medium mb-1 text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Transfer / EDC
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatRp(paymentBreakdown.transfer + paymentBreakdown.other)}{' '}
                            <span className="text-slate-400 text-[10px]">
                              ({totalOmzet > 0 ? Math.round(((paymentBreakdown.transfer + paymentBreakdown.other) / totalOmzet) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full"
                            style={{
                              width: `${
                                totalOmzet > 0
                                  ? ((paymentBreakdown.transfer + paymentBreakdown.other) / totalOmzet) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tipe Pesanan */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Tipe Pesanan Pelanggan
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <Store className="w-3.5 h-3.5 text-slate-700 mx-auto mb-1" />
                          <span className="font-bold text-slate-900 block text-sm">{orderTypeBreakdown.dineIn}</span>
                          <span className="text-[10px] text-slate-500">Dine In</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <ShoppingBag className="w-3.5 h-3.5 text-amber-700 mx-auto mb-1" />
                          <span className="font-bold text-slate-900 block text-sm">{orderTypeBreakdown.takeaway}</span>
                          <span className="text-[10px] text-slate-500">Takeaway</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <Bike className="w-3.5 h-3.5 text-emerald-700 mx-auto mb-1" />
                          <span className="font-bold text-slate-900 block text-sm">{orderTypeBreakdown.online}</span>
                          <span className="text-[10px] text-slate-500">Online</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateTab('reports')}
                      className="w-full mt-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>Lihat Riwayat di Laporan</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DRILLDOWN 2: Profit & Margin (Admin Only) */}
            {activeDrilldown === 'profit' && user?.role !== 'kasir' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    Struktur Profitabilitas ({periodLabel})
                  </h3>
                  <button
                    onClick={() => setActiveDrilldown(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-lg bg-white border border-slate-200 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">1. Total Omzet</span>
                    <span className="text-base font-bold text-slate-900 block mt-0.5">{formatRp(totalOmzet)}</span>
                    <span className="text-[10px] text-slate-500">100% Penjualan</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">2. Modal Bahan (HPP)</span>
                    <span className="text-base font-bold text-amber-700 block mt-0.5">- {formatRp(totalHpp)}</span>
                    <span className="text-[10px] text-amber-800 font-semibold">
                      {totalOmzet > 0 ? ((totalHpp / totalOmzet) * 100).toFixed(1) : 0}% Beban Bahan
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">3. Biaya Operasional</span>
                    <span className="text-base font-bold text-rose-700 block mt-0.5">- {formatRp(totalExpenses)}</span>
                    <span className="text-[10px] text-rose-800 font-semibold">
                      {totalOmzet > 0 ? ((totalExpenses / totalOmzet) * 100).toFixed(1) : 0}% Beban Biaya
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl text-white flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Laba Bersih Masuk Kas:</span>
                    <span className="text-lg font-bold text-white">{formatRp(netProfit)}</span>
                  </div>
                  <span className="text-xs text-amber-400 font-bold bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    Margin Bersih: {netMargin}%
                  </span>
                </div>
              </div>
            )}

            {/* DRILLDOWN: Orders Breakdown for Kasir */}
            {activeDrilldown === 'orders' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    Rincian Kategori & Tipe Pesanan ({periodLabel})
                  </h3>
                  <button
                    onClick={() => setActiveDrilldown(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-lg bg-white border border-slate-200 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                      <Store className="w-4 h-4 text-slate-700" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Dine-In</span>
                      <span className="text-base font-bold text-slate-900">{orderTypeBreakdown.dineIn} Transaksi</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                      <ShoppingBag className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Takeaway</span>
                      <span className="text-base font-bold text-slate-900">{orderTypeBreakdown.takeaway} Transaksi</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                      <Bike className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Online Delivery</span>
                      <span className="text-base font-bold text-slate-900">{orderTypeBreakdown.online} Transaksi</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DRILLDOWN 3: Porsi */}
            {activeDrilldown === 'portions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    Rincian Porsi Menu ({periodLabel})
                  </h3>
                  <button
                    onClick={() => setActiveDrilldown(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-lg bg-white border border-slate-200 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                      ☕
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Minuman</span>
                      <span className="text-sm font-bold text-slate-900">{drinkPortions} Porsi</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                      🍽️
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Makanan Utama</span>
                      <span className="text-sm font-bold text-slate-900">{foodPortions} Porsi</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                      🥐
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Snack & Pastry</span>
                      <span className="text-sm font-bold text-slate-900">{snackPortions} Porsi</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DRILLDOWN 4: Biaya Operasional */}
            {activeDrilldown === 'expenses' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    Rincian Biaya Operasional
                  </h3>
                  <button
                    onClick={() => setActiveDrilldown(null)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-lg bg-white border border-slate-200 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Pos Pengeluaran Terbesar
                    </span>
                    <div className="space-y-1 text-xs">
                      {Object.entries(expenseCatMap).length > 0 ? (
                        Object.entries(expenseCatMap)
                          .sort((a, b) => Number(b[1]) - Number(a[1]))
                          .slice(0, 4)
                          .map(([cat, amount]) => (
                            <div key={cat} className="flex justify-between items-center py-0.5 border-b border-slate-100">
                              <span className="font-medium text-slate-700">{cat}</span>
                              <span className="font-bold text-slate-900">{formatRp(Number(amount))}</span>
                            </div>
                          ))
                      ) : (
                        <p className="text-slate-400 text-xs">Belum ada pos pengeluaran tercatat.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Rasio Beban Operasional
                      </span>
                      <p className="text-xs text-slate-600">
                        {totalOmzet > 0
                          ? `Biaya operasional mengambil ${((totalExpenses / totalOmzet) * 100).toFixed(1)}% dari total omzet penjualan.`
                          : 'Belum ada data omzet.'}
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigateTab('expenses')}
                      className="w-full mt-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <DollarSign className="w-3 h-3" />
                      <span>Buka Menu Pengeluaran</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
