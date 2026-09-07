import React, { useState } from 'react';
import { Supplier, PurchaseOrder, Ingredient, User } from '../../types';
import { formatRp, formatDate } from '../../utils/formatters';
import { Truck, Plus, PackageCheck, Phone, MapPin, X, User as UserIcon, Trash2 } from 'lucide-react';

interface SupplierScreenProps {
  suppliers: Supplier[];
  ingredients: Ingredient[];
  purchases: PurchaseOrder[];
  user: User;
  onSaveSupplier: (supplier: Supplier) => void;
  onAddPurchase: (po: PurchaseOrder) => void;
  onDeleteSupplier?: (id: string) => void;
  onDeletePurchase?: (id: string) => void;
}

export const SupplierScreen: React.FC<SupplierScreenProps> = ({
  suppliers,
  ingredients,
  purchases,
  user,
  onSaveSupplier,
  onAddPurchase,
  onDeleteSupplier,
  onDeletePurchase,
}) => {
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');

  // New PO Modal
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poIngredientId, setPoIngredientId] = useState('');
  const [poQty, setPoQty] = useState<number>(10);
  const [poUnitCost, setPoUnitCost] = useState<number>(180);
  const [poNotes, setPoNotes] = useState('');

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supContact, setSupContact] = useState('');

  const handleCreatePO = () => {
    const sup = suppliers.find((s) => s.id === poSupplierId) || suppliers[0];
    const ing = ingredients.find((i) => i.id === poIngredientId) || ingredients[0];
    if (!ing || !sup) return;

    const poNo = `PO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`;
    const po: PurchaseOrder = {
      id: 'po-' + Date.now(),
      poNo,
      supplierId: sup.id,
      supplierName: sup.name,
      date: new Date().toISOString(),
      ingredientId: ing.id,
      ingredientName: ing.name,
      quantity: poQty,
      unitCost: poUnitCost,
      totalCost: poQty * poUnitCost,
      notes: poNotes,
    };

    onAddPurchase(po);
    setIsPOModalOpen(false);
  };

  const handleCreateSupplier = () => {
    if (!supName.trim()) return;
    const newSup: Supplier = {
      id: 'sup-' + Date.now(),
      name: supName.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      contactPerson: supContact.trim(),
      itemsSupplied: ['Bahan Baku'],
    };
    onSaveSupplier(newSup);
    setIsSupplierModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#3E2723] to-[#2B1713] p-5 rounded-2xl text-[#F5EBE0] shadow-xl border border-[#4E342E]">
        <div>
          <h2 className="text-xl font-bold text-[#FAF3DD] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#D4A373]" /> Pembelian Supplier & Restok Bahan
          </h2>
          <p className="text-xs text-[#D4A373] mt-0.5">
            Catat pembelian pasokan bahan baku dari supplier & update stok otomatis
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#1F1412] p-1 rounded-xl border border-[#4E342E]">
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'purchases' ? 'bg-[#D4A373] text-[#1F1412] shadow-md' : 'text-gray-300 hover:text-white'
            }`}
          >
            Riwayat Restok (PO)
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'suppliers' ? 'bg-[#D4A373] text-[#1F1412] shadow-md' : 'text-gray-300 hover:text-white'
            }`}
          >
            Daftar Supplier
          </button>
        </div>
      </div>

      {/* Action Trigger */}
      <div className="flex justify-end">
        {activeTab === 'purchases' ? (
          <button
            onClick={() => {
              if (suppliers.length > 0) setPoSupplierId(suppliers[0].id);
              if (ingredients.length > 0) {
                setPoIngredientId(ingredients[0].id);
                setPoUnitCost(ingredients[0].costPerUnit);
              }
              setIsPOModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center gap-1.5 shadow-sm"
          >
            <PackageCheck className="w-4 h-4 text-[#D4A373]" /> Catat Pembelian Supplier Restok
          </button>
        ) : (
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#D4A373]" /> Tambah Supplier Baru
          </button>
        )}
      </div>

      {/* TAB 1: Restok History */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-[#E6D5C3] p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[#2B1713]">Daftar Pembelian Supplier (Pemasukan Bahan Baku)</h3>
          {purchases.length === 0 ? (
            <div className="text-xs text-gray-400 py-8 text-center">Belum ada riwayat pembelian restok dari supplier</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5EBE0] text-[#3E2723] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">No. PO</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Bahan Baku</th>
                    <th className="py-3 px-4">Jumlah Diterima</th>
                    <th className="py-3 px-4">Harga Satuan</th>
                    <th className="py-3 px-4">Total Biaya</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D5C3]">
                  {purchases.map((po) => (
                    <tr key={po.id} className="hover:bg-amber-50/50">
                      <td className="py-3 px-4 font-bold text-[#3E2723]">{po.poNo}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDate(po.date)}</td>
                      <td className="py-3 px-4 font-semibold text-gray-800">{po.supplierName}</td>
                      <td className="py-3 px-4 font-bold text-[#2B1713]">{po.ingredientName}</td>
                      <td className="py-3 px-4 font-extrabold text-[#3E2723]">{po.quantity}</td>
                      <td className="py-3 px-4 text-gray-600">{formatRp(po.unitCost)}</td>
                      <td className="py-3 px-4 font-black text-[#2B1713]">{formatRp(po.totalCost)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm(`Yakin ingin menghapus riwayat PO "${po.poNo}" (${po.ingredientName})?`)) {
                              onDeletePurchase?.(po.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Hapus Pembelian PO"
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
      )}

      {/* TAB 2: Suppliers List */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white p-5 rounded-2xl border border-[#E6D5C3] shadow-xs space-y-3 relative group">
              <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5EBE0] text-[#3E2723] font-bold flex items-center justify-center text-lg">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#2B1713]">{s.name}</h4>
                    <p className="text-xs text-[#8D6E63] flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> PIC: {s.contactPerson}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Yakin ingin menghapus supplier "${s.name}"?`)) {
                      onDeleteSupplier?.(s.id);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                  title="Hapus Supplier"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#D4A373]" /> {s.phone}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#D4A373]" /> {s.address}
                </div>
              </div>

              <div className="pt-2 border-t border-[#E6D5C3]">
                <span className="text-[10px] uppercase font-bold text-gray-400">Pasokan Bahan:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.itemsSupplied.map((item, idx) => (
                    <span key={idx} className="bg-[#F5EBE0] text-[#3E2723] text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restok PO Modal */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#E6D5C3] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <h3 className="font-bold text-base text-[#2B1713]">Catat Restok Bahan Baku</h3>
              <button onClick={() => setIsPOModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Pilih Supplier</label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Bahan Baku Dibereli</label>
                <select
                  value={poIngredientId}
                  onChange={(e) => {
                    setPoIngredientId(e.target.value);
                    const found = ingredients.find((i) => i.id === e.target.value);
                    if (found) setPoUnitCost(found.costPerUnit);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[#8D6E63] block mb-1">Jumlah Masuk</label>
                  <input
                    type="number"
                    value={poQty}
                    onChange={(e) => setPoQty(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#8D6E63] block mb-1">Harga Beli Satuan (Rp)</label>
                  <input
                    type="number"
                    value={poUnitCost}
                    onChange={(e) => setPoUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-[#F5EBE0] p-3 rounded-xl flex justify-between items-center">
                <span className="font-semibold text-gray-700">Total Pembelian:</span>
                <span className="font-black text-[#2B1713] text-base">{formatRp(poQty * poUnitCost)}</span>
              </div>
            </div>

            <button
              onClick={handleCreatePO}
              className="w-full py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-colors"
            >
              Simpan & Tambah Stok
            </button>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#E6D5C3] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <h3 className="font-bold text-base text-[#2B1713]">Tambah Supplier Baru</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Nama Perusahaan / Supplier</label>
                <input
                  type="text"
                  placeholder="cth: PT Roastery Kopi Nusantara"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Nama Contact Person (PIC)</label>
                <input
                  type="text"
                  placeholder="cth: Pak Budi Roaster"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">No. WhatsApp / Telepon</label>
                <input
                  type="text"
                  placeholder="0812..."
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Alamat</label>
                <input
                  type="text"
                  placeholder="Alamat kantor / gudang supplier"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleCreateSupplier}
              className="w-full py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-colors"
            >
              Simpan Supplier
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
