import React, { useState, useMemo } from 'react';
import { FixedAsset, Outlet, User } from '../../types';
import { formatRp, formatDate } from '../../utils/formatters';
import {
  Wrench,
  Armchair,
  Hammer,
  Package,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Calendar,
  DollarSign,
  Tag,
  Store,
  Info,
  Check,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Bell,
  Clock,
  CheckCheck,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FixedAssetsTabProps {
  fixedAssets: FixedAsset[];
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  currentUser: User;
  onAddAsset: (asset: FixedAsset, autoRecordCashLedger?: boolean) => void;
  onUpdateAsset?: (asset: FixedAsset) => void;
  onDeleteAsset: (id: string) => void;
}

export function getMaintenanceStatus(asset: FixedAsset) {
  if (!asset.maintenanceReminderEnabled || !asset.nextMaintenanceDate) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(asset.nextMaintenanceDate);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'OVERDUE' as const,
      label: `Terlambat ${Math.abs(diffDays)} Hari`,
      diffDays,
      color: 'bg-rose-100 text-rose-800 border-rose-300',
      badgeBg: 'bg-rose-500 text-white',
      isDueSoon: true,
    };
  }
  if (diffDays === 0) {
    return {
      status: 'TODAY' as const,
      label: 'Jatuh Tempo Hari Ini',
      diffDays,
      color: 'bg-amber-100 text-amber-900 border-amber-300',
      badgeBg: 'bg-amber-500 text-white',
      isDueSoon: true,
    };
  }
  if (diffDays <= 3) {
    return {
      status: 'SOON' as const,
      label: `${diffDays} Hari Lagi`,
      diffDays,
      color: 'bg-amber-100 text-amber-900 border-amber-300',
      badgeBg: 'bg-amber-500 text-white',
      isDueSoon: true,
    };
  }
  if (diffDays <= 7) {
    return {
      status: 'UPCOMING' as const,
      label: `${diffDays} Hari Lagi`,
      diffDays,
      color: 'bg-blue-100 text-blue-900 border-blue-300',
      badgeBg: 'bg-blue-500 text-white',
      isDueSoon: false,
    };
  }
  return {
    status: 'NORMAL' as const,
    label: `${diffDays} Hari Lagi`,
    diffDays,
    color: 'bg-stone-100 text-stone-700 border-stone-200',
    badgeBg: 'bg-stone-500 text-white',
    isDueSoon: false,
  };
}

export const categoryMeta: Record<
  FixedAsset['category'],
  { label: string; icon: React.FC<{ className?: string }>; color: string; badgeBg: string; border: string }
> = {
  EQUIPMENT: {
    label: 'Mesin & Peralatan',
    icon: Wrench,
    color: 'text-amber-800',
    badgeBg: 'bg-amber-100/90 text-amber-900',
    border: 'border-amber-300',
  },
  FURNITURE: {
    label: 'Furnitur & Meja',
    icon: Armchair,
    color: 'text-blue-800',
    badgeBg: 'bg-blue-100/90 text-blue-900',
    border: 'border-blue-300',
  },
  RENOVATION: {
    label: 'Renovasi & Sipil',
    icon: Hammer,
    color: 'text-purple-800',
    badgeBg: 'bg-purple-100/90 text-purple-900',
    border: 'border-purple-300',
  },
  OTHER: {
    label: 'Aset Lainnya',
    icon: Package,
    color: 'text-emerald-800',
    badgeBg: 'bg-emerald-100/90 text-emerald-900',
    border: 'border-emerald-300',
  },
};

const assetPresets = [
  {
    name: 'Digital Coffee Grinder',
    category: 'EQUIPMENT' as const,
    price: 4500000,
    supplier: 'PT Barista Solusi Prima',
    maintenanceReminder: true,
    maintenanceFreq: 30,
    maintenanceNotes: 'Pembersihan burr set & kalibrasi mikro zero point',
  },
  {
    name: 'Cup Sealer Manual Heavy Duty',
    category: 'EQUIPMENT' as const,
    price: 1250000,
    supplier: 'Toko Mesin Kemasan',
    maintenanceReminder: true,
    maintenanceFreq: 90,
    maintenanceNotes: 'Pelumasan bearing gear & pembersihan pemanas cutter',
  },
  {
    name: 'Set Bar Stainless 304 & Double Sink',
    category: 'EQUIPMENT' as const,
    price: 8500000,
    supplier: 'CV Stainless Kitchen Pro',
    maintenanceReminder: false,
    maintenanceFreq: 180,
    maintenanceNotes: '',
  },
  {
    name: 'Mesin Espresso Komersial 2 Group',
    category: 'EQUIPMENT' as const,
    price: 28500000,
    supplier: 'PT Espresso Jaya Perkasa',
    maintenanceReminder: true,
    maintenanceFreq: 60,
    maintenanceNotes: 'Descaling boiler rutin & ganti seal karet group head',
  },
  {
    name: 'Showcase Under-counter Chiller',
    category: 'EQUIPMENT' as const,
    price: 5800000,
    supplier: 'PT Pendingin Usaha',
    maintenanceReminder: true,
    maintenanceFreq: 90,
    maintenanceNotes: 'Pembersihan kondensor & pengecekan suhu refrigeran',
  },
  {
    name: 'Set Meja Kursi Kayu Cafe (4 Set)',
    category: 'FURNITURE' as const,
    price: 4200000,
    supplier: 'Jepara Wood Craft',
    maintenanceReminder: false,
    maintenanceFreq: 180,
    maintenanceNotes: '',
  },
  {
    name: 'Renovasi Interior & Neon Sign Bar',
    category: 'RENOVATION' as const,
    price: 7500000,
    supplier: 'CV Citra Interior',
    maintenanceReminder: false,
    maintenanceFreq: 365,
    maintenanceNotes: '',
  },
  {
    name: 'Tablet POS Stand & Printer Thermal',
    category: 'EQUIPMENT' as const,
    price: 2200000,
    supplier: 'Toko Hardware POS',
    maintenanceReminder: true,
    maintenanceFreq: 60,
    maintenanceNotes: 'Pembersihan head printer thermal & cek konektivitas',
  },
];

export const FixedAssetsTab: React.FC<FixedAssetsTabProps> = ({
  fixedAssets,
  outlets,
  activeOutlet,
  currentUser,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);

  // Form State
  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState<FixedAsset['category']>('EQUIPMENT');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState<number>(4500000);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : '')
  );
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [autoRecordCash, setAutoRecordCash] = useState<boolean>(true);

  // Maintenance Reminder Form State
  const [maintenanceReminderEnabled, setMaintenanceReminderEnabled] = useState<boolean>(false);
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState<string>('');
  const [maintenanceFrequencyDays, setMaintenanceFrequencyDays] = useState<number>(60);
  const [maintenanceNotes, setMaintenanceNotes] = useState<string>('');

  // Filters
  const isKasir = currentUser.role === 'kasir';
  const defaultFilterOutlet = isKasir
    ? activeOutlet?.id || currentUser.assignedOutletId || currentUser.outletId || (outlets.length > 0 ? outlets[0].id : 'ALL')
    : 'ALL';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterOutletId, setFilterOutletId] = useState<string>(defaultFilterOutlet);
  const [filterMaintenance, setFilterMaintenance] = useState<'ALL' | 'DUE_SOON' | 'ENABLED'>('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'price_desc' | 'price_asc' | 'name_asc' | 'maintenance_soon'>('date_desc');

  // Helper to calculate default next date based on frequency
  const calculateDefaultNextDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const handleOpenAddModal = () => {
    setEditingAsset(null);
    setAssetName('');
    setCategory('EQUIPMENT');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchasePrice(4500000);
    setSelectedOutletId(activeOutlet?.id || (outlets.length > 0 ? outlets[0].id : ''));
    setSupplier('');
    setNotes('');
    setAutoRecordCash(true);
    // Maintenance defaults
    setMaintenanceReminderEnabled(false);
    setMaintenanceFrequencyDays(60);
    setNextMaintenanceDate(calculateDefaultNextDate(60));
    setMaintenanceNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setAssetName(asset.assetName);
    setCategory(asset.category);
    setPurchaseDate(asset.purchaseDate);
    setPurchasePrice(asset.purchasePrice);
    setSelectedOutletId(asset.outletId);
    setSupplier(asset.supplier || '');
    setNotes(asset.notes || '');
    setAutoRecordCash(false); // don't re-create cash ledger entry on edit
    // Maintenance fields
    setMaintenanceReminderEnabled(asset.maintenanceReminderEnabled || false);
    setNextMaintenanceDate(asset.nextMaintenanceDate || calculateDefaultNextDate(asset.maintenanceFrequencyDays || 60));
    setMaintenanceFrequencyDays(asset.maintenanceFrequencyDays || 60);
    setMaintenanceNotes(asset.maintenanceNotes || '');
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: (typeof assetPresets)[0]) => {
    setAssetName(preset.name);
    setCategory(preset.category);
    setPurchasePrice(preset.price);
    setSupplier(preset.supplier);
    if (preset.maintenanceReminder) {
      setMaintenanceReminderEnabled(true);
      setMaintenanceFrequencyDays(preset.maintenanceFreq);
      setNextMaintenanceDate(calculateDefaultNextDate(preset.maintenanceFreq));
      setMaintenanceNotes(preset.maintenanceNotes);
    }
  };

  const handleMarkServiced = (asset: FixedAsset) => {
    if (!onUpdateAsset) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const freq = asset.maintenanceFrequencyDays || 60;
    const nextD = new Date();
    nextD.setDate(nextD.getDate() + freq);
    const nextStr = nextD.toISOString().split('T')[0];

    const updated: FixedAsset = {
      ...asset,
      lastMaintenanceDate: todayStr,
      nextMaintenanceDate: nextStr,
    };
    onUpdateAsset(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim() || purchasePrice <= 0) {
      alert('Mohon masukkan nama aset dan harga perolehan yang valid.');
      return;
    }

    const targetOutlet = outlets.find((o) => o.id === selectedOutletId) || activeOutlet;

    if (editingAsset && onUpdateAsset) {
      const updated: FixedAsset = {
        ...editingAsset,
        assetName: assetName.trim(),
        category,
        purchaseDate,
        purchasePrice: Number(purchasePrice),
        outletId: targetOutlet?.id || 'outlet-default',
        outletName: targetOutlet?.name || 'Cabang Aktif',
        supplier: supplier.trim() || undefined,
        notes: notes.trim() || undefined,
        maintenanceReminderEnabled: !!maintenanceReminderEnabled,
        nextMaintenanceDate: maintenanceReminderEnabled ? nextMaintenanceDate : undefined,
        maintenanceFrequencyDays: maintenanceReminderEnabled ? Number(maintenanceFrequencyDays) : undefined,
        maintenanceNotes: maintenanceReminderEnabled && maintenanceNotes.trim() ? maintenanceNotes.trim() : undefined,
      };
      onUpdateAsset(updated);
    } else {
      const newAsset: FixedAsset = {
        id: 'asset-' + Date.now(),
        assetName: assetName.trim(),
        category,
        purchaseDate,
        purchasePrice: Number(purchasePrice),
        outletId: targetOutlet?.id || 'outlet-default',
        outletName: targetOutlet?.name || 'Cabang Aktif',
        supplier: supplier.trim() || undefined,
        notes: notes.trim() || undefined,
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
        maintenanceReminderEnabled: !!maintenanceReminderEnabled,
        nextMaintenanceDate: maintenanceReminderEnabled ? nextMaintenanceDate : undefined,
        maintenanceFrequencyDays: maintenanceReminderEnabled ? Number(maintenanceFrequencyDays) : undefined,
        maintenanceNotes: maintenanceReminderEnabled && maintenanceNotes.trim() ? maintenanceNotes.trim() : undefined,
      };
      onAddAsset(newAsset, autoRecordCash);
    }

    setIsModalOpen(false);
  };

  // Filtered & Sorted Assets
  const filteredAssets = useMemo(() => {
    return fixedAssets
      .filter((asset) => {
        // Outlet filter
        if (filterOutletId !== 'ALL') {
          if (asset.outletId && asset.outletId !== filterOutletId) return false;
        }
        // Category filter
        if (filterCategory !== 'ALL' && asset.category !== filterCategory) return false;

        // Maintenance filter
        if (filterMaintenance === 'DUE_SOON') {
          const status = getMaintenanceStatus(asset);
          if (!status || !status.isDueSoon) return false;
        } else if (filterMaintenance === 'ENABLED') {
          if (!asset.maintenanceReminderEnabled) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = asset.assetName.toLowerCase().includes(q);
          const matchSup = asset.supplier?.toLowerCase().includes(q) || false;
          const matchNote = asset.notes?.toLowerCase().includes(q) || false;
          const matchOutlet = asset.outletName?.toLowerCase().includes(q) || false;
          const matchMaint = asset.maintenanceNotes?.toLowerCase().includes(q) || false;
          if (!matchName && !matchSup && !matchNote && !matchOutlet && !matchMaint) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'maintenance_soon') {
          const dateA = a.nextMaintenanceDate || '9999-12-31';
          const dateB = b.nextMaintenanceDate || '9999-12-31';
          return dateA.localeCompare(dateB);
        }
        if (sortBy === 'date_desc') return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        if (sortBy === 'price_desc') return b.purchasePrice - a.purchasePrice;
        if (sortBy === 'price_asc') return a.purchasePrice - b.purchasePrice;
        if (sortBy === 'name_asc') return a.assetName.localeCompare(b.assetName);
        return 0;
      });
  }, [fixedAssets, filterOutletId, filterCategory, filterMaintenance, searchQuery, sortBy]);

  // Overall Financial Calculations (Scoped by outlet filter)
  const scopedAssets = useMemo(() => {
    if (filterOutletId === 'ALL') return fixedAssets;
    return fixedAssets.filter((a) => !a.outletId || a.outletId === filterOutletId);
  }, [fixedAssets, filterOutletId]);

  const totalAssetValue = scopedAssets.reduce((acc, a) => acc + a.purchasePrice, 0);
  const equipmentValue = scopedAssets.filter((a) => a.category === 'EQUIPMENT').reduce((acc, a) => acc + a.purchasePrice, 0);
  const furnitureValue = scopedAssets.filter((a) => a.category === 'FURNITURE').reduce((acc, a) => acc + a.purchasePrice, 0);
  const renovationValue = scopedAssets.filter((a) => a.category === 'RENOVATION').reduce((acc, a) => acc + a.purchasePrice, 0);
  const otherValue = scopedAssets.filter((a) => a.category === 'OTHER').reduce((acc, a) => acc + a.purchasePrice, 0);

  // Count maintenance alerts
  const assetsDueSoonCount = scopedAssets.filter((a) => {
    const status = getMaintenanceStatus(a);
    return status && status.isDueSoon;
  }).length;

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredAssets.length === 0) {
      alert('Tidak ada data aset untuk diekspor.');
      return;
    }
    const headers = ['ID', 'Nama Aset', 'Kategori', 'Tanggal Beli', 'Harga Perolehan (Rp)', 'Cabang', 'Supplier', 'Catatan'];
    const rows = filteredAssets.map((a) => [
      a.id,
      `"${a.assetName.replace(/"/g, '""')}"`,
      categoryMeta[a.category]?.label || a.category,
      a.purchaseDate,
      a.purchasePrice,
      `"${(a.outletName || a.outletId).replace(/"/g, '""')}"`,
      `"${(a.supplier || '-').replace(/"/g, '""')}"`,
      `"${(a.notes || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suqur_aset_tetap_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#FAF3DD]/90 rounded-3xl p-5 sm:p-6 border border-[#E6D5C3] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[#3E2723] text-amber-300 flex items-center justify-center shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-black text-[#2B1713]">
                Aset & Peralatan Toko (CAPEX)
              </h2>
              <p className="text-xs text-[#5D4037]">
                Manajemen Aset Tetap, Inventarisasi Mesin, Furnitur & Investasi Modal Usaha Non-Bahan Baku
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-2xl bg-white hover:bg-stone-50 text-[#3E2723] font-bold text-xs transition-all border border-[#D7CCC8] flex items-center gap-1.5 shadow-xs"
            title="Download CSV Rekapitulasi Aset Tetap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-2xl bg-[#3E2723] hover:bg-[#5D4037] text-white font-bold text-xs transition-all flex items-center gap-2 shadow-md hover:scale-102"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Tambah Aset Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Total Valuation & Category Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Nilai Aset */}
        <div className="bg-white p-5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#8D7B68]">
              Total Nilai Aset Tetap
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-900 flex items-center justify-center border border-amber-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-serif font-black text-[#2B1713] tracking-tight">
              {formatRp(totalAssetValue)}
            </div>
            <div className="text-[11px] text-[#8D7B68] font-medium mt-1 flex items-center gap-1">
              <span>{scopedAssets.length} unit aset terdaftar</span>
              {filterOutletId !== 'ALL' && <span className="text-amber-800 font-bold">• Cabang Ini</span>}
            </div>
          </div>
        </div>

        {/* Card 2: Mesin & Peralatan */}
        <div className="bg-white p-5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#8D7B68]">
              Mesin & Peralatan (Equipment)
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-serif font-black text-amber-900 tracking-tight">
              {formatRp(equipmentValue)}
            </div>
            <div className="text-[11px] text-[#8D7B68] font-medium mt-1">
              Grinder, Mesin Kopi, Sealer, Bar Stainless
            </div>
          </div>
        </div>

        {/* Card 3: Furnitur & Meja */}
        <div className="bg-white p-5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#8D7B68]">
              Furnitur & Meja Kursi
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-200">
              <Armchair className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-serif font-black text-blue-950 tracking-tight">
              {formatRp(furnitureValue)}
            </div>
            <div className="text-[11px] text-[#8D7B68] font-medium mt-1">
              Meja Cafe, Kursi Pelanggan, Rak Display
            </div>
          </div>
        </div>

        {/* Card 4: Renovasi & Lainnya */}
        <div className="bg-white p-5 rounded-2xl border border-[#D7CCC8]/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#8D7B68]">
              Renovasi & Lainnya
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center border border-purple-200">
              <Hammer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-serif font-black text-purple-950 tracking-tight">
              {formatRp(renovationValue + otherValue)}
            </div>
            <div className="text-[11px] text-[#8D7B68] font-medium mt-1">
              Sipil Toko, Neon Sign, Instalasi Listrik
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#D7CCC8]/60 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8D7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari aset (misal: Grinder, Cup Sealer, Bar Stainless, Descaling, Supplier)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-medium text-[#2B1713] placeholder-[#8D7B68] focus:bg-white focus:border-[#3E2723] focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-bold text-[#3E2723] focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">Semua Kategori Aset</option>
            <option value="EQUIPMENT">Mesin & Peralatan (EQUIPMENT)</option>
            <option value="FURNITURE">Furnitur & Meja (FURNITURE)</option>
            <option value="RENOVATION">Renovasi & Sipil (RENOVATION)</option>
            <option value="OTHER">Lain-lain (OTHER)</option>
          </select>

          {/* Maintenance Filter */}
          <select
            value={filterMaintenance}
            onChange={(e) => setFilterMaintenance(e.target.value as any)}
            className="px-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-bold text-[#3E2723] focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">Semua Status Servis</option>
            <option value="DUE_SOON">⚠️ Perlu Servis Segera ({assetsDueSoonCount})</option>
            <option value="ENABLED">🔔 Aset Berjadwal Perawatan</option>
          </select>

          {/* Outlet Filter (Admin only, Cashier locked) */}
          {!isKasir ? (
            <select
              value={filterOutletId}
              onChange={(e) => setFilterOutletId(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-bold text-[#3E2723] focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">🏢 Semua Cabang ({outlets.length} Outlet)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  📍 {o.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 bg-stone-100 rounded-xl text-xs font-bold text-[#5D4037] border border-stone-200 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-800" />
              <span>{activeOutlet?.name || 'Cabang Kasir'}</span>
            </div>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-bold text-[#3E2723] focus:bg-white focus:outline-hidden"
          >
            <option value="date_desc">Tanggal Beli Terbaru</option>
            <option value="maintenance_soon">Jadwal Servis Terdekat</option>
            <option value="price_desc">Harga Tertinggi</option>
            <option value="price_asc">Harga Terendah</option>
            <option value="name_asc">Nama A-Z</option>
          </select>
        </div>
      </div>

      {/* Asset List Content */}
      <div className="bg-white rounded-3xl border border-[#D7CCC8]/60 shadow-xs overflow-hidden">
        {filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-[#8D7B68] space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto border border-amber-200">
              <Wrench className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#2B1713]">Belum Ada Aset Tetap Terdaftar</h3>
            <p className="text-xs max-w-md mx-auto">
              Catat peralatan kedai seperti Digital Grinder, Cup Sealer, Mesin Kopi, dan Meja Bar untuk memisahkan pencatatan modal tetap (CAPEX) dengan belanja bahan baku (OPEX).
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-[#3E2723] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#5D4037] transition-all"
              >
                + Tambah Aset Pertama
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/80 border-b border-[#D7CCC8]/60 text-[11px] font-black uppercase tracking-wider text-[#5D4037]">
                  <th className="py-3.5 px-4">Nama Aset & Peralatan</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Tanggal Beli</th>
                  <th className="py-3.5 px-4">Cabang Penempatan</th>
                  <th className="py-3.5 px-4">Supplier / Vendor</th>
                  <th className="py-3.5 px-4 text-right">Harga Perolehan</th>
                  <th className="py-3.5 px-4">Jadwal Perawatan (SOP)</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7CCC8]/40 text-xs">
                {filteredAssets.map((asset) => {
                  const meta = categoryMeta[asset.category] || categoryMeta.OTHER;
                  const Icon = meta.icon;
                  const maintStatus = getMaintenanceStatus(asset);

                  return (
                    <tr key={asset.id} className="hover:bg-stone-50/60 transition-colors group">
                      {/* Nama Aset */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#2B1713] text-sm flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${meta.badgeBg} flex items-center justify-center shrink-0 border ${meta.border}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div>{asset.assetName}</div>
                            {asset.notes && (
                              <div className="text-[11px] text-[#8D7B68] font-normal line-clamp-1 mt-0.5">
                                {asset.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kategori Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.badgeBg} border ${meta.border}`}>
                          <Icon className="w-3 h-3" />
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      {/* Tanggal Beli */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#5D4037] font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#8D7B68]" />
                          <span>{formatDate(asset.purchaseDate)}</span>
                        </div>
                      </td>

                      {/* Cabang */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-stone-100 text-[#3E2723] text-[11px] font-semibold border border-stone-200">
                          <Building2 className="w-3 h-3 text-amber-800" />
                          <span>{asset.outletName || asset.outletId}</span>
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="py-3.5 px-4 text-[#5D4037]">
                        {asset.supplier ? (
                          <span className="font-medium text-[#2B1713]">{asset.supplier}</span>
                        ) : (
                          <span className="text-stone-400 italic">-</span>
                        )}
                      </td>

                      {/* Harga Perolehan */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-mono font-black text-[#2B1713] text-sm">
                          {formatRp(asset.purchasePrice)}
                        </div>
                        <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                          CAPEX
                        </div>
                      </td>

                      {/* Jadwal Perawatan SOP */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        {asset.maintenanceReminderEnabled && asset.nextMaintenanceDate && maintStatus ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${maintStatus.color}`}>
                                {maintStatus.isDueSoon ? (
                                  <AlertTriangle className="w-3 h-3 text-rose-600 animate-pulse shrink-0" />
                                ) : (
                                  <Clock className="w-3 h-3 text-[#5D4037] shrink-0" />
                                )}
                                <span>{maintStatus.label}</span>
                              </span>
                              <span className="text-[11px] font-mono text-[#5D4037]">
                                ({formatDate(asset.nextMaintenanceDate)})
                              </span>
                            </div>

                            {asset.maintenanceNotes && (
                              <div className="text-[11px] text-[#5D4037] line-clamp-1 italic">
                                🔧 {asset.maintenanceNotes}
                              </div>
                            )}

                            {/* Tombol Selesaikan Servis */}
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleMarkServiced(asset)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-[#5D4037] text-[10px] font-bold border border-stone-200 transition-colors"
                                title="Klik jika servis berkala hari ini telah selesai dilakukan (akan menjadwalkan periode berikutnya)"
                              >
                                <CheckCheck className="w-3 h-3 text-emerald-600" />
                                <span>Servis Selesai Hari Ini</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">Tidak dijadwalkan</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(asset)}
                            className="p-1.5 rounded-lg text-[#5D4037] hover:text-[#2B1713] hover:bg-stone-100 transition-colors"
                            title="Edit Aset"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Hapus aset "${asset.assetName}"? Data transaksi Buku Kas yang telah tercatat tidak akan terhapus otomatis demi keamanan pembukuan.`)) {
                                onDeleteAsset(asset.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                            title="Hapus Aset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Input / Edit Aset Tetap */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#D7CCC8] relative max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#D7CCC8]/60 pb-3.5 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#3E2723] text-amber-300 flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#2B1713]">
                      {editingAsset ? 'Edit Aset Tetap' : 'Tambah Aset & Peralatan Baru'}
                    </h3>
                    <p className="text-[11px] text-[#8D7B68]">
                      Pencatatan Pengeluaran Modal (CAPEX), Inventaris & Jadwal Perawatan
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Badges (Only on New Asset) */}
              {!editingAsset && (
                <div className="mb-4 bg-[#FAF3DD]/60 p-3 rounded-2xl border border-[#E6D5C3]">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5D4037] mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Preset Cepat Peralatan Kedai Su-Qur:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {assetPresets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-[#D7CCC8] text-[#3E2723] hover:bg-[#3E2723] hover:text-white font-medium transition-all shadow-2xs"
                      >
                        + {p.name} ({formatRp(p.price)})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                {/* Nama Aset */}
                <div>
                  <label className="block text-xs font-bold text-[#2B1713] mb-1">
                    Nama Peralatan / Aset <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Digital Coffee Grinder, Cup Sealer Manual, Set Bar Stainless"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-medium text-[#2B1713] focus:bg-white focus:border-[#3E2723] focus:outline-hidden"
                  />
                </div>

                {/* Kategori & Tanggal Beli Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kategori */}
                  <div>
                    <label className="block text-xs font-bold text-[#2B1713] mb-1">
                      Kategori Aset <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as FixedAsset['category'])}
                      className="w-full px-3 py-2.5 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-bold text-[#2B1713] focus:bg-white focus:outline-hidden"
                    >
                      <option value="EQUIPMENT">Mesin & Peralatan (EQUIPMENT)</option>
                      <option value="FURNITURE">Furnitur & Meja Kursi (FURNITURE)</option>
                      <option value="RENOVATION">Renovasi & Sipil (RENOVATION)</option>
                      <option value="OTHER">Aset Lainnya (OTHER)</option>
                    </select>
                  </div>

                  {/* Tanggal Beli */}
                  <div>
                    <label className="block text-xs font-bold text-[#2B1713] mb-1">
                      Tanggal Perolehan <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-mono font-medium text-[#2B1713] focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Harga Perolehan & Cabang Penempatan Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Harga Perolehan */}
                  <div>
                    <label className="block text-xs font-bold text-[#2B1713] mb-1">
                      Harga Perolehan (Rp) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1000}
                      step={1000}
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-mono font-bold text-[#2B1713] focus:bg-white focus:outline-hidden"
                    />
                    <span className="text-[10px] text-amber-800 font-bold mt-1 block">
                      {formatRp(purchasePrice)}
                    </span>
                  </div>

                  {/* Cabang Penempatan */}
                  <div>
                    <label className="block text-xs font-bold text-[#2B1713] mb-1">
                      Cabang Penempatan <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={selectedOutletId}
                      onChange={(e) => setSelectedOutletId(e.target.value)}
                      disabled={isKasir}
                      className="w-full px-3 py-2.5 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-bold text-[#2B1713] focus:bg-white focus:outline-hidden disabled:bg-stone-200"
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          📍 {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Supplier / Vendor */}
                <div>
                  <label className="block text-xs font-bold text-[#2B1713] mb-1">
                    Nama Supplier / Vendor / Toko (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: PT Barista Solusi Prima, Toko Mesin Kemasan"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-medium text-[#2B1713] focus:bg-white focus:border-[#3E2723] focus:outline-hidden"
                  />
                </div>

                {/* Catatan / Garansi */}
                <div>
                  <label className="block text-xs font-bold text-[#2B1713] mb-1">
                    Catatan / Spesifikasi / Garansi (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Garansi servis 1 tahun, daya 250 Watt, no seri mesin SN88219"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-[#D7CCC8] rounded-xl text-xs font-medium text-[#2B1713] focus:bg-white focus:border-[#3E2723] focus:outline-hidden resize-none"
                  />
                </div>

                {/* Section: Pengingat Perawatan Berkala (Maintenance Reminder) */}
                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/90 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintenanceReminderEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setMaintenanceReminderEnabled(checked);
                        if (checked && !nextMaintenanceDate) {
                          setNextMaintenanceDate(calculateDefaultNextDate(maintenanceFrequencyDays || 60));
                        }
                      }}
                      className="w-4 h-4 mt-0.5 text-amber-800 rounded-md border-amber-300 focus:ring-amber-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-800" />
                        <span className="text-xs font-bold text-[#2B1713]">
                          Aktifkan Pengingat Perawatan Berkala (Maintenance Reminder)
                        </span>
                      </div>
                      <span className="text-[11px] text-[#5D4037] leading-relaxed block mt-0.5">
                        Sistem akan memunculkan notifikasi alert di <strong>Dashboard Admin</strong> saat tanggal servis mendekati hari ini (H-3) untuk mencegah mesin rusak mendadak.
                      </span>
                    </div>
                  </label>

                  {maintenanceReminderEnabled && (
                    <div className="pt-2.5 border-t border-amber-200/80 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Periode / Frekuensi Perawatan */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#2B1713] mb-1">
                            Frekuensi Servis Berkala
                          </label>
                          <select
                            value={maintenanceFrequencyDays}
                            onChange={(e) => {
                              const days = Number(e.target.value);
                              setMaintenanceFrequencyDays(days);
                              setNextMaintenanceDate(calculateDefaultNextDate(days));
                            }}
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-[#2B1713] focus:outline-hidden"
                          >
                            <option value={15}>Setiap 15 Hari (2 Minggu Sekali)</option>
                            <option value={30}>Setiap 30 Hari (1 Bulan Sekali)</option>
                            <option value={60}>Setiap 60 Hari (2 Bulan Sekali)</option>
                            <option value={90}>Setiap 90 Hari (3 Bulan Sekali)</option>
                            <option value={180}>Setiap 180 Hari (6 Bulan Sekali)</option>
                            <option value={365}>Setiap 365 Hari (1 Tahun Sekali)</option>
                          </select>
                        </div>

                        {/* Tanggal Perawatan Berikutnya */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#2B1713] mb-1">
                            Tanggal Servis Berikutnya <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="date"
                            required={maintenanceReminderEnabled}
                            value={nextMaintenanceDate}
                            onChange={(e) => setNextMaintenanceDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-[#2B1713] focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Catatan / SOP Perawatan */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#2B1713] mb-1">
                          Catatan SOP Servis / Perawatan
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Descaling boiler, bersihkan burr grinder, ganti filter air & seal"
                          value={maintenanceNotes}
                          onChange={(e) => setMaintenanceNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium text-[#2B1713] focus:outline-hidden"
                        />
                        {/* Quick SOP suggestions */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className="text-[10px] text-amber-800 font-semibold">Saran SOP:</span>
                          {[
                            'Descaling & pembersihan group head',
                            'Kalibrasi burr set grinder',
                            'Pelumasan bearing cutter sealer',
                            'Pembersihan kondensor pendingin',
                          ].map((sop, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setMaintenanceNotes(sop)}
                              className="text-[10px] px-2 py-0.5 bg-amber-100/80 hover:bg-amber-200 text-amber-900 rounded-md transition-colors"
                            >
                              + {sop}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pemisahan Buku Kas (CAPEX vs OPEX Checkbox) */}
                {!editingAsset && (
                  <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-1.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRecordCash}
                        onChange={(e) => setAutoRecordCash(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#3E2723] rounded-md border-stone-300 focus:ring-stone-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-[#2B1713] block">
                          Catat Transaksi di Buku Kas sebagai Pengeluaran Modal (CAPEX)
                        </span>
                        <span className="text-[11px] text-[#5D4037] leading-relaxed block mt-0.5">
                          Sesuai standar akuntansi, pembelian aset dicatat sebagai <strong>Pengeluaran Modal (CAPEX) / Pembelian Aset</strong> dan tidak akan memotong laba kotor/beban bahan baku (OPEX).
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D7CCC8]/60">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#5D4037] hover:bg-stone-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#5D4037] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>{editingAsset ? 'Simpan Perubahan' : 'Simpan Aset & Catat'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
