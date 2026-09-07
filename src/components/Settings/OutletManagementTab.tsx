import React, { useState } from 'react';
import { Outlet, StoreSettings } from '../../types';
import { StorageService } from '../../services/storage';
import { syncTransactionToGoogleSheet } from '../../services/googleSheetService';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Radio,
  CheckCircle2,
  Trash2,
  Edit3,
  Globe,
  Sparkles,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Store,
  QrCode,
  Printer,
} from 'lucide-react';
import { QRCodeGeneratorModal } from '../QR/QRCodeGeneratorModal';

interface OutletManagementTabProps {
  settings: StoreSettings;
  onSaveSettings: (settings: StoreSettings) => void;
  onOutletChanged?: () => void;
}

export const OutletManagementTab: React.FC<OutletManagementTabProps> = ({
  settings,
  onSaveSettings,
  onOutletChanged,
}) => {
  const [outlets, setOutlets] = useState<Outlet[]>(() => StorageService.getOutlets());
  const [activeOutletId, setActiveOutletId] = useState<string>(() => StorageService.getActiveOutletId());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Notification / Test Webhook state
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testingOutletId, setTestingOutletId] = useState<string | null>(null);

  // QR Code Generator State
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedQRGenOutlet, setSelectedQRGenOutlet] = useState<Outlet | undefined>(undefined);

  const refreshList = () => {
    const list = StorageService.getOutlets();
    setOutlets(list);
    setActiveOutletId(StorageService.getActiveOutletId());
    if (onOutletChanged) onOutletChanged();
  };

  const handleOpenAdd = () => {
    setEditingOutlet(null);
    setFormName('');
    setFormAddress('');
    setFormPhone('');
    setFormWebhookUrl(settings.googleSheetWebhookUrl || '');
    setFormIsDefault(outlets.length === 0);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setFormName(outlet.name);
    setFormAddress(outlet.address || '');
    setFormPhone(outlet.phone || '');
    setFormWebhookUrl(outlet.webhookUrl || settings.googleSheetWebhookUrl || '');
    setFormIsDefault(Boolean(outlet.isDefault));
    setFormIsActive(outlet.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setNotice({ type: 'error', message: 'Nama cabang tidak boleh kosong.' });
      return;
    }

    const trimmedName = formName.trim();
    const trimmedAddress = formAddress.trim();
    const trimmedPhone = formPhone.trim();
    const trimmedWebhook = formWebhookUrl.trim();

    let updatedList = [...outlets];

    if (editingOutlet) {
      // Update
      const updated: Outlet = {
        ...editingOutlet,
        name: trimmedName,
        address: trimmedAddress,
        phone: trimmedPhone,
        webhookUrl: trimmedWebhook,
        isDefault: formIsDefault,
        isActive: formIsActive,
      };

      if (formIsDefault) {
        updatedList = updatedList.map((o) => ({ ...o, isDefault: o.id === editingOutlet.id }));
      }
      updatedList = updatedList.map((o) => (o.id === editingOutlet.id ? updated : o));
      StorageService.saveOutlets(updatedList);
      setNotice({ type: 'success', message: `Data cabang "${trimmedName}" berhasil diperbarui.` });
    } else {
      // Create new
      const newId = `outlet-${Date.now().toString(36)}`;
      const newOutlet: Outlet = {
        id: newId,
        name: trimmedName,
        address: trimmedAddress,
        phone: trimmedPhone,
        webhookUrl: trimmedWebhook,
        isDefault: formIsDefault || outlets.length === 0,
        isActive: formIsActive,
        createdAt: new Date().toISOString(),
      };

      if (newOutlet.isDefault) {
        updatedList = updatedList.map((o) => ({ ...o, isDefault: false }));
      }
      updatedList.push(newOutlet);
      StorageService.saveOutlets(updatedList);
      setNotice({ type: 'success', message: `Cabang baru "${trimmedName}" berhasil ditambahkan!` });
    }

    setIsModalOpen(false);
    refreshList();
    setTimeout(() => setNotice(null), 4000);
  };

  const handleDeleteOutlet = (outlet: Outlet) => {
    if (outlets.length <= 1) {
      setNotice({ type: 'error', message: 'Sistem harus memiliki minimal 1 cabang/outlet terdaftar.' });
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus data cabang "${outlet.name}"?`)) {
      StorageService.deleteOutlet(outlet.id);
      if (activeOutletId === outlet.id) {
        const remaining = StorageService.getOutlets();
        if (remaining.length > 0) {
          StorageService.setActiveOutletId(remaining[0].id);
        }
      }
      refreshList();
      setNotice({ type: 'success', message: `Cabang "${outlet.name}" telah dihapus.` });
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleSetActive = (outletId: string) => {
    StorageService.setActiveOutletId(outletId);
    setActiveOutletId(outletId);
    refreshList();
    const target = outlets.find((o) => o.id === outletId);
    setNotice({ type: 'success', message: `Cabang aktif berhasil diubah ke: ${target?.name}` });
    setTimeout(() => setNotice(null), 3500);
  };

  const handleTestWebhook = async (outlet: Outlet) => {
    const targetUrl = outlet.webhookUrl || settings.googleSheetWebhookUrl;
    if (!targetUrl) {
      setNotice({
        type: 'error',
        message: 'URL Webhook Google Sheets belum diatur untuk cabang ini.',
      });
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    setTestingOutletId(outlet.id);
    const testData = {
      action: 'TEST_CONNECTION',
      outlet_id: outlet.id,
      outlet_name: outlet.name,
      outletId: outlet.id,
      outletName: outlet.name,
      invoice_no: `TEST-${outlet.id.slice(-4).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      cashier_name: 'Admin Multi-Outlet',
      customer_name: 'Uji Integrasi Webhook',
      payment_method: 'qris',
      total: 25000,
      total_cogs: 8000,
      gross_profit: 17000,
      items_summary: '1x Test Kopi Susu Aren',
    };

    const res = await syncTransactionToGoogleSheet(targetUrl, testData);
    setTestingOutletId(null);
    if (res.success) {
      setNotice({
        type: 'success',
        message: `✅ Sinyal Webhook ke Google Sheets untuk cabang "${outlet.name}" berhasil terkirim!`,
      });
    } else {
      setNotice({
        type: 'error',
        message: `⚠️ Gagal kirim webhook: ${res.error?.message || 'Pastikan URL Apps Script di-deploy dengan akses Anyone'}`,
      });
    }
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-3xl border border-[#E6D5C3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif italic font-bold text-xl text-[#3E2723] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#8D6E63]" />
            Manajemen Multi-Outlet / Cabang Terintegrasi
          </h3>
          <p className="text-xs text-[#8D6E63] mt-1">
            Kelola data cabang cafe, alamat, nomor telepon, dan URL Webhook Google Sheet khusus untuk tiap lokasi outlet.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#2B1713] text-[#FAF3DD] font-bold text-xs transition-all flex items-center gap-2 shadow-md shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Cabang Baru</span>
        </button>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Outlets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {outlets.map((outlet) => {
          const isActive = outlet.id === activeOutletId;
          const isTesting = testingOutletId === outlet.id;

          return (
            <div
              key={outlet.id}
              className={`p-5 rounded-3xl border transition-all relative flex flex-col justify-between ${
                isActive
                  ? 'bg-amber-50/70 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                  : 'bg-white border-[#E6D5C3] hover:border-[#8D6E63] shadow-xs'
              }`}
            >
              <div>
                {/* Header Card */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                        isActive
                          ? 'bg-[#3E2723] text-amber-200 shadow-sm'
                          : 'bg-[#F5EBE0] text-[#5D4037]'
                      }`}
                    >
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-[#3E2723] text-base leading-tight">
                          {outlet.name}
                        </h4>
                        {outlet.isDefault && (
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold border border-amber-300">
                            Pusat
                          </span>
                        )}
                        {outlet.isActive === false ? (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 border border-stone-300">
                            Nonaktif
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Aktif
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Aktif di POS
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#8D6E63] font-mono">ID: {outlet.id}</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-[#5D4037] my-4 pt-3 border-t border-[#E6D5C3]/70">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span className="text-gray-700 leading-relaxed">
                      {outlet.address || 'Alamat cabang belum diisi'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="text-gray-700 font-mono">
                      {outlet.phone || 'Nomor telepon belum diisi'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <Globe className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1 truncate">
                      <span className="text-gray-500 text-[10px] block">Webhook Google Sheets:</span>
                      <span className="text-gray-800 font-mono text-[11px] truncate block">
                        {outlet.webhookUrl || settings.googleSheetWebhookUrl || 'Default Toko / Belum Diisi'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="pt-3 border-t border-[#E6D5C3] flex flex-wrap items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1.5">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(outlet.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#3E2723] hover:bg-[#2B1713] text-[#FAF3DD] text-xs font-bold transition-all shadow-xs"
                      title="Jadikan cabang ini sebagai cabang aktif saat kasir bertransaksi"
                    >
                      Pilih Cabang Ini
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedQRGenOutlet(outlet);
                      setIsQRModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                    title="Buat & Cetak QR Meja Self-Order untuk Cabang Ini"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-800" />
                    <span>QR Meja</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestWebhook(outlet)}
                    disabled={isTesting}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-[#D4A373] text-[#5D4037] hover:bg-amber-50 text-xs font-bold transition-all flex items-center gap-1"
                    title="Uji coba kirim dummy data transaksi ke Google Sheets Apps Script"
                  >
                    <Radio className={`w-3 h-3 text-amber-700 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Menguji...' : 'Test Webhook'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(outlet)}
                    className="p-1.5 rounded-lg bg-white border border-[#E6D5C3] text-gray-700 hover:bg-[#F5EBE0] hover:text-[#3E2723] transition-colors"
                    title="Edit Cabang"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {outlets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOutlet(outlet)}
                      className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus Cabang"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add / Edit Outlet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FAF3DD] w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-[#D4A373] text-[#3E2723] relative">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3 mb-4">
              <h3 className="font-serif italic font-bold text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#8D6E63]" />
                {editingOutlet ? 'Edit Data Cabang / Outlet' : 'Tambah Cabang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#E6D5C3] text-[#8D6E63]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Nama Cabang / Outlet <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Kedai Kopi Wahid - Cabang Lagoa"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4A373] bg-white text-[#3E2723] font-medium focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Alamat Lengkap Cabang</label>
                <textarea
                  rows={2}
                  placeholder="misal: Jl. Lagoa Terusan No. 12, Koja, Jakarta Utara"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D4A373] bg-white text-[#3E2723] font-medium focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">No. Telepon / WhatsApp Cabang</label>
                <input
                  type="text"
                  placeholder="misal: 0812-9988-1001"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4A373] bg-white text-[#3E2723] font-medium focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1 flex items-center justify-between">
                  <span>URL Webhook Google Sheets (Opsional)</span>
                  <span className="text-[10px] text-gray-500">Apps Script /exec URL</span>
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={formWebhookUrl}
                  onChange={(e) => setFormWebhookUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4A373] bg-white text-[#3E2723] font-mono text-[11px] focus:ring-2 focus:ring-[#3E2723] outline-hidden"
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Jika dikosongkan, cabang ini akan menggunakan URL Webhook utama toko.
                </p>
              </div>

              <div className="pt-2 border-t border-[#E6D5C3] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3E2723] focus:ring-[#3E2723]"
                  />
                  <span className="font-bold text-gray-800">Status Cabang Aktif (Dapat dipilih di Kasir)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3E2723] focus:ring-[#3E2723]"
                  />
                  <span className="font-bold text-gray-800">Jadikan sebagai Cabang Utama (Default)</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E6D5C3]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#D4A373] text-gray-700 font-bold hover:bg-[#F5EBE0]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold hover:bg-[#2B1713] shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Cabang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Generator Modal */}
      <QRCodeGeneratorModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        outlets={outlets}
        currentOutlet={selectedQRGenOutlet || outlets.find((o) => o.id === activeOutletId) || outlets[0]}
        settings={settings}
      />
    </div>
  );
};
