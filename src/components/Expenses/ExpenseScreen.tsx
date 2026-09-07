import React, { useState, useMemo } from 'react';
import { Expense, User, Ingredient, Outlet } from '../../types';
import { formatRp, formatDate } from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { InventoryService } from '../../services/inventoryService';
import {
  Receipt,
  Plus,
  Trash2,
  X,
  PieChart,
  Calendar,
  AlertCircle,
  Package,
  Sparkles,
} from 'lucide-react';

interface ExpenseScreenProps {
  expenses: Expense[];
  user: User;
  ingredients?: Ingredient[];
  outlets?: Outlet[];
  activeOutlet?: Outlet | null;
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onResetData?: () => void;
}

export const ExpenseScreen: React.FC<ExpenseScreenProps> = ({
  expenses,
  user,
  ingredients: passedIngredients,
  outlets,
  activeOutlet,
  onAddExpense,
  onDeleteExpense,
  onResetData,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState<Expense['category']>('Listrik & Air');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(100000);
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Raw Material linkage
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [purchaseQty, setPurchaseQty] = useState<number>(1);
  const [autoUpdateStock, setAutoUpdateStock] = useState<boolean>(true);

  const allIngredients = useMemo(() => {
    return passedIngredients && passedIngredients.length > 0
      ? passedIngredients
      : StorageService.getIngredients();
  }, [passedIngredients]);

  const categories: Expense['category'][] = [
    'Belanja Bahan Baku',
    'Listrik & Air',
    'Gaji Karyawan',
    'Sewa Tempat',
    'Pemasaran & Iklan',
    'Pemeliharaan Alat',
    'Lain-lain',
  ];

  const isBelanjaBahan = category === 'Belanja Bahan Baku';

  const selectedIngredient = useMemo(() => {
    if (!selectedIngredientId) return null;
    return allIngredients.find((i) => i.id === selectedIngredientId) || null;
  }, [selectedIngredientId, allIngredients]);

  const calculatedUnitCost = useMemo(() => {
    if (!purchaseQty || purchaseQty <= 0 || !amount || amount <= 0) return 0;
    return Math.round(amount / purchaseQty);
  }, [amount, purchaseQty]);

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

  const handleCategoryChange = (newCat: Expense['category']) => {
    setCategory(newCat);
    if (newCat === 'Belanja Bahan Baku' && allIngredients.length > 0 && !selectedIngredientId) {
      setSelectedIngredientId(allIngredients[0].id);
      if (!description) {
        setDescription(`Belanja ${allIngredients[0].name}`);
      }
    }
  };

  const handleIngredientChange = (ingId: string) => {
    setSelectedIngredientId(ingId);
    const ing = allIngredients.find((i) => i.id === ingId);
    if (ing) {
      setDescription(`Belanja ${ing.name} (${purchaseQty} ${ing.unit})`);
    }
  };

  const handleSave = () => {
    if (!description.trim() || amount <= 0) return;

    const expenseNo = `EXP-${expenseDate.replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`;
    const isBelanja = isBelanjaBahan && selectedIngredient;

    const newExpense: Expense = {
      id: 'exp-' + Date.now(),
      expenseNo,
      date: expenseDate,
      category,
      description: description.trim(),
      amount,
      recordedBy: user.name,
      outletId: activeOutlet?.id || 'outlet-pusat',
      outletName: activeOutlet?.name || 'Cabang Aktif',
      ...(isBelanja
        ? {
            ingredientId: selectedIngredient.id,
            ingredientName: selectedIngredient.name,
            quantity: Number(purchaseQty),
            unit: selectedIngredient.unit,
            unitCost: calculatedUnitCost,
            autoUpdateStock,
          }
        : {}),
    };

    // Auto update stock if requested
    if (isBelanja && autoUpdateStock && purchaseQty > 0) {
      InventoryService.processPurchaseFromCashExpense({
        outletId: newExpense.outletId || 'outlet-pusat',
        outletName: newExpense.outletName || 'Cabang Aktif',
        ingredientId: selectedIngredient.id,
        quantity: Number(purchaseQty),
        totalCost: Number(amount),
        recordedBy: user.name,
        date: newExpense.date,
        notes: newExpense.description,
        ledgerId: newExpense.expenseNo,
      });
    }

    onAddExpense(newExpense);
    setIsModalOpen(false);
    setDescription('');
    setAmount(100000);
    setSelectedIngredientId('');
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#3E2723] to-[#2B1713] p-5 rounded-2xl text-[#F5EBE0] shadow-xl border border-[#4E342E]">
        <div>
          <h2 className="text-xl font-bold text-[#FAF3DD] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#D4A373]" /> Pengeluaran Operasional Cafe
          </h2>
          <p className="text-xs text-[#D4A373] mt-0.5">
            Catat beban sewa, tagihan listrik, gaji karyawan & perawatan mesin kopi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {user.role === 'admin' && onResetData && (
            <button
              onClick={() => {
                if (window.confirm('Yakin ingin menghapus? Seluruh data operasional akan dikosongkan untuk di-input baru.')) {
                  onResetData();
                }
              }}
              className="px-3.5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-rose-200 border border-rose-300/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md"
              title="Kosongkan seluruh data operasional"
            >
              <Trash2 className="w-4 h-4 text-rose-300" /> Reset Data Operasional
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#D4A373] text-[#1F1412] font-bold text-xs hover:bg-[#c39262] transition-all flex items-center justify-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" /> Catat Pengeluaran Baru
          </button>
        </div>
      </div>

      {/* Total Stat Box */}
      <div className="bg-[#FAF3DD] p-5 rounded-2xl border border-[#E2D5B8] flex items-center justify-between shadow-xs">
        <div>
          <span className="text-xs font-semibold text-[#8D6E63] uppercase tracking-wider">
            Total Pengeluaran Operasional Terdata
          </span>
          <div className="text-2xl font-black text-[#2B1713] mt-0.5">{formatRp(totalExpenseAmount)}</div>
        </div>
        <div className="p-3 bg-[#3E2723] text-[#D4A373] rounded-2xl">
          <PieChart className="w-6 h-6" />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-[#E6D5C3] p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#2B1713]">Riwayat Catatan Biaya Operasional</h3>
        {expenses.length === 0 ? (
          <div className="text-xs text-gray-400 py-8 text-center">Belum ada catatan pengeluaran operasional</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">No. Pengeluaran</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Kategori Biaya</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4">Dicatat Oleh</th>
                  <th className="py-3 px-4">Nominal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D5C3]">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-amber-50/50">
                    <td className="py-3 px-4 font-bold text-[#3E2723]">{exp.expenseNo}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(exp.date)}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#F5EBE0] text-[#3E2723] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">
                      <div>{exp.description}</div>
                      {exp.ingredientName && (
                        <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                          <Package className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>+{exp.quantity} {exp.unit || ''} {exp.ingredientName}</span>
                          {exp.autoUpdateStock !== false && (
                            <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1 py-0.2 rounded-xs font-semibold">
                              Stok Auto
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{exp.recordedBy}</td>
                    <td className="py-3 px-4 font-black text-[#2B1713]">{formatRp(exp.amount)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm('Yakin ingin menghapus?')) {
                            onDeleteExpense(exp.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                        title="Hapus Pengeluaran"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#E6D5C3] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <h3 className="font-bold text-base text-[#2B1713]">Tambah Pengeluaran Operasional</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Tanggal</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Kategori Pengeluaran</label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Integrasi Bahan Baku jika Belanja Bahan Baku */}
              {isBelanjaBahan && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-amber-950 font-bold text-[11px]">
                    <div className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-amber-700" />
                      <span>Integrasi Stok Bahan Baku</span>
                    </div>
                    <span className="text-[9px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                      Auto-Update
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-amber-900 block mb-0.5">
                      Pilih Item Bahan Baku <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedIngredientId}
                      onChange={(e) => handleIngredientChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:outline-none"
                    >
                      <option value="" disabled>-- Pilih Bahan Baku --</option>
                      {allIngredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          📦 {ing.name} (Stok: {ing.currentStock} {ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-amber-900 block mb-0.5">
                      Jumlah Pembelian (Qty) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={purchaseQty || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPurchaseQty(val);
                          if (selectedIngredient) {
                            setDescription(`Belanja ${selectedIngredient.name} (${val} ${selectedIngredient.unit})`);
                          }
                        }}
                        className="w-full pl-2.5 pr-14 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:outline-none font-bold"
                        placeholder="Qty"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                        {selectedIngredient?.unit || 'satuan'}
                      </span>
                    </div>
                  </div>

                  {selectedIngredient && purchaseQty > 0 && amount > 0 && (
                    <div className="bg-white/90 border border-amber-200 rounded-lg p-2 text-[10px] text-stone-700 space-y-1">
                      <div className="flex justify-between">
                        <span>Harga Beli Satuan:</span>
                        <span className="font-bold">Rp {calculatedUnitCost.toLocaleString('id-ID')} / {selectedIngredient.unit}</span>
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-950 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={autoUpdateStock}
                      onChange={(e) => setAutoUpdateStock(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-amber-800 focus:ring-amber-700 border-amber-300"
                    />
                    <span>Tambah stok fisik & perbarui HPP secara otomatis</span>
                  </label>
                </div>
              )}

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Keterangan Biaya</label>
                <input
                  type="text"
                  placeholder="cth: Tagihan Listrik PLN & token air"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Nominal Biaya (Rp)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-base focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-colors"
            >
              Simpan Pengeluaran
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
