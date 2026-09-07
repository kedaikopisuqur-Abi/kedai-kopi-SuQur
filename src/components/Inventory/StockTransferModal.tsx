import React, { useState } from 'react';
import { StockTransfer, StockTransferItem, Outlet, Ingredient, BranchInventoryItem, User } from '../../types';
import { formatRp } from '../../utils/formatters';
import { Truck, Plus, Trash2, X, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlets: Outlet[];
  ingredients: Ingredient[];
  branchInventory: BranchInventoryItem[];
  user: User;
  activeOutlet: Outlet;
  onCreateTransfer: (transfer: StockTransfer) => { success: boolean; message: string; transfer?: StockTransfer };
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  outlets,
  ingredients,
  branchInventory,
  user,
  activeOutlet,
  onCreateTransfer,
}) => {
  const centralOutlet = outlets.find((o) => o.type === 'CENTRAL') || outlets[0];
  const outletList = outlets.filter((o) => o.type === 'OUTLET');

  const [fromOutletId, setFromOutletId] = useState<string>(centralOutlet?.id || 'outlet-pusat');
  const [toOutletId, setToOutletId] = useState<string>(outletList[0]?.id || 'outlet-lagoa');
  const [driverName, setDriverName] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<StockTransferItem[]>([]);

  // Item selector state
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(ingredients[0]?.id || '');
  const [transferAmount, setTransferAmount] = useState<number>(10);

  if (!isOpen) return null;

  const sourceOutlet = outlets.find((o) => o.id === fromOutletId);
  const targetOutlet = outlets.find((o) => o.id === toOutletId);

  // Get available stock in source branch for the selected ingredient
  const getSourceStock = (ingId: string): number => {
    const found = branchInventory.find((b) => b.outletId === fromOutletId && b.ingredientId === ingId);
    if (found) return found.currentStock;
    const ing = ingredients.find((i) => i.id === ingId);
    return ing ? ing.currentStock : 0;
  };

  const handleAddItem = () => {
    if (!selectedIngredientId || transferAmount <= 0) {
      alert('Pilih bahan baku dan masukkan jumlah kirim lebih dari 0.');
      return;
    }

    const available = getSourceStock(selectedIngredientId);
    const existingInList = items.find((i) => i.ingredientId === selectedIngredientId);
    const totalRequired = (existingInList ? existingInList.amount : 0) + transferAmount;

    if (totalRequired > available) {
      alert(`Stok tidak mencukupi di ${sourceOutlet?.name || 'Cabang Asal'}! Tersedia: ${available}, Dibutuhkan: ${totalRequired}`);
      return;
    }

    const ing = ingredients.find((i) => i.id === selectedIngredientId);
    if (!ing) return;

    if (existingInList) {
      setItems(
        items.map((i) =>
          i.ingredientId === selectedIngredientId
            ? { ...i, amount: i.amount + transferAmount, totalCost: (i.amount + transferAmount) * i.costPerUnit }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          ingredientId: ing.id,
          ingredientName: ing.name,
          amount: transferAmount,
          unit: ing.unit,
          costPerUnit: ing.costPerUnit,
          totalCost: transferAmount * ing.costPerUnit,
        },
      ]);
    }

    setTransferAmount(10);
  };

  const handleRemoveItem = (ingId: string) => {
    setItems(items.filter((i) => i.ingredientId !== ingId));
  };

  const handleUpdateItemAmount = (ingId: string, newAmount: number) => {
    if (newAmount <= 0) {
      handleRemoveItem(ingId);
      return;
    }
    const available = getSourceStock(ingId);
    if (newAmount > available) {
      alert(`Stok tidak mencukupi! Tersedia hanya ${available}`);
      return;
    }
    setItems(
      items.map((i) =>
        i.ingredientId === ingId
          ? { ...i, amount: newAmount, totalCost: newAmount * i.costPerUnit }
          : i
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromOutletId === toOutletId) {
      alert('Cabang Asal dan Cabang Tujuan tidak boleh sama!');
      return;
    }
    if (items.length === 0) {
      alert('Tambahkan minimal satu bahan baku yang akan dikirim.');
      return;
    }

    const transferNumber = `SJ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const totalEstimatedValue = items.reduce((sum, i) => sum + (i.totalCost || 0), 0);

    const newTransfer: StockTransfer = {
      id: 'st-' + Date.now(),
      transferNumber,
      fromOutletId,
      fromOutletName: sourceOutlet?.name || 'Gudang Pusat',
      toOutletId,
      toOutletName: targetOutlet?.name || 'Cabang Outlet',
      status: 'IN_TRANSIT',
      items,
      notes: notes.trim(),
      driverName: driverName.trim(),
      vehicleNumber: vehicleNumber.trim(),
      totalEstimatedValue,
      createdAt: new Date().toISOString(),
      createdBy: user.name || 'Admin Pusat',
    };

    const res = onCreateTransfer(newTransfer);
    if (res.success) {
      alert(`Surat Jalan ${transferNumber} berhasil dibuat dan stok cabang asal telah dipotong!`);
      onClose();
    } else {
      alert(res.message || 'Gagal membuat transfer stok.');
    }
  };

  const currentIng = ingredients.find((i) => i.id === selectedIngredientId) || ingredients[0];
  const currentAvailable = currentIng ? getSourceStock(currentIng.id) : 0;
  const totalValue = items.reduce((sum, i) => sum + (i.totalCost || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#E6D5C3] space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3E2723] text-[#FAF3DD] flex items-center justify-center shadow-sm">
              <Truck className="w-5 h-5 text-[#D4A373]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#2B1713]">
                Buat Surat Jalan Suplai (Hub & Spoke)
              </h3>
              <p className="text-xs text-[#8D6E63]">
                Pengiriman stok bahan baku dari Pusat ke Outlet cabang
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Branch Source & Destination Selector */}
          <div className="bg-[#FAF3DD]/40 p-4 rounded-2xl border border-[#E6D5C3] grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="font-bold text-[#3E2723] block mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span> Cabang Pengirim (Asal / Hub)
              </label>
              <select
                value={fromOutletId}
                onChange={(e) => setFromOutletId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-white text-[#2B1713] font-bold focus:outline-none focus:border-[#D4A373]"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.type === 'CENTRAL' ? '(Pusat / Hub)' : '(Outlet)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-[#3E2723] block mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Cabang Penerima (Tujuan)
              </label>
              <select
                value={toOutletId}
                onChange={(e) => setToOutletId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-white text-[#2B1713] font-bold focus:outline-none focus:border-[#D4A373]"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.id === fromOutletId}>
                    {o.name} {o.type === 'CENTRAL' ? '(Pusat / Hub)' : '(Outlet)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delivery & Logistics Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">Nama Driver / Kurir Pengantar</label>
              <input
                type="text"
                placeholder="cth: Pak Budi / Kurir Internal"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] focus:outline-none focus:border-[#D4A373]"
              />
            </div>
            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">No. Polisi Kendaraan / Ekspedisi</label>
              <input
                type="text"
                placeholder="cth: B 1234 SQQ"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] focus:outline-none focus:border-[#D4A373]"
              />
            </div>
          </div>

          {/* Add Ingredient Section */}
          <div className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#E6D5C3] space-y-3">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-2">
              <h4 className="font-bold text-xs text-[#3E2723] flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#D4A373]" /> Pilih Bahan Baku yang Dikirim
              </h4>
              <span className="text-[11px] text-[#8D6E63]">
                Stok Tersedia di {sourceOutlet?.name || 'Asal'}: <strong className="text-[#3E2723]">{currentAvailable} {currentIng?.unit}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-7">
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-white font-medium focus:outline-none"
                >
                  {ingredients.map((ing) => {
                    const st = getSourceStock(ing.id);
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (Stok: {st} {ing.unit}) - {formatRp(ing.costPerUnit)}/{ing.unit}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="sm:col-span-3 flex items-center gap-1">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-white font-bold text-center focus:outline-none"
                />
                <span className="text-gray-500 font-semibold text-[11px] shrink-0">{currentIng?.unit}</span>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold transition-all shadow-xs"
                >
                  + Tambah
                </button>
              </div>
            </div>

            {/* Item List Table */}
            {items.length > 0 ? (
              <div className="border border-[#E6D5C3] rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF3DD]/60 text-[#3E2723] font-bold border-b border-[#E6D5C3]">
                    <tr>
                      <th className="py-2 px-3">Bahan Baku</th>
                      <th className="py-2 px-3 text-center">Jumlah Kirim</th>
                      <th className="py-2 px-3 text-right">Nilai Estimasi</th>
                      <th className="py-2 px-3 text-center w-10">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6D5C3]">
                    {items.map((item) => (
                      <tr key={item.ingredientId} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-semibold text-[#2B1713]">
                          {item.ingredientName}
                          <span className="block text-[10px] text-gray-400 font-normal">
                            @{formatRp(item.costPerUnit)} / {item.unit}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={item.amount}
                              onChange={(e) => handleUpdateItemAmount(item.ingredientId, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-0.5 rounded-lg border border-[#E6D5C3] text-center font-bold"
                            />
                            <span className="text-gray-500 text-[10px]">{item.unit}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#8D6E63]">
                          {formatRp(item.totalCost || 0)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.ingredientId)}
                            className="text-red-500 hover:text-red-700 p-1 rounded"
                            title="Hapus dari daftar kirim"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 bg-white rounded-xl border border-dashed border-[#E6D5C3]">
                Belum ada bahan baku yang dimasukkan ke surat jalan ini.
              </div>
            )}

            {/* Total value footer */}
            {items.length > 0 && (
              <div className="flex justify-between items-center bg-[#FAF3DD]/80 p-3 rounded-xl font-bold">
                <span className="text-[#3E2723]">Total Nilai Barang Kiriman:</span>
                <span className="text-sm text-[#2B1713]">{formatRp(totalValue)}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="font-semibold text-[#8D6E63] block mb-1">Catatan / Instruksi Pengiriman (Opsional)</label>
            <input
              type="text"
              placeholder="cth: Pengiriman rutin suplai mingguan, jaga suhu susu"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] focus:outline-none focus:border-[#D4A373]"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6D5C3]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E6D5C3] text-gray-600 font-bold hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={items.length === 0}
              className="px-6 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:bg-gray-300 text-[#FAF3DD] font-bold shadow-md transition-all flex items-center gap-2"
            >
              <Truck className="w-4 h-4 text-[#D4A373]" /> Terbitkan Surat Jalan & Kirim Suplai
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
