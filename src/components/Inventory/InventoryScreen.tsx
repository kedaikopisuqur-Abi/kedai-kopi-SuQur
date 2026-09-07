import React, { useState, useRef } from 'react';
import {
  Product,
  ProductVariant,
  Ingredient,
  RecipeItem,
  StockOpname,
  User,
  Outlet,
  BranchInventoryItem,
  StockTransfer,
  StoreSettings,
  FixedAsset,
} from '../../types';
import {
  formatRp,
  calculateProductCogs,
  calculateRawMaterialCost,
  calculateOverheadPerCup,
  calculateProductCogsBreakdown,
  calculateGrossProfitMargin,
  exportToCSV,
} from '../../utils/formatters';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Search,
  BookOpen,
  ClipboardList,
  Lock,
  ShieldAlert,
  Eye,
  Upload,
  Download,
  Truck,
  Building2,
  Store,
  ArrowRight,
  Clock,
  CheckCircle2,
  Printer,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Wrench,
  Calculator,
  TrendingUp,
  Coins,
  PieChart,
  Zap,
  Package,
} from 'lucide-react';
import { StockTransferModal } from './StockTransferModal';
import { SuratJalanModal } from './SuratJalanModal';
import { FixedAssetsTab } from '../CashDebt/FixedAssetsTab';

interface InventoryScreenProps {
  products: Product[];
  ingredients: Ingredient[];
  stockOpnames: StockOpname[];
  user: User;
  fixedAssets?: FixedAsset[];
  outlets?: Outlet[];
  activeOutlet?: Outlet;
  branchInventory?: BranchInventoryItem[];
  stockTransfers?: StockTransfer[];
  settings?: StoreSettings;
  onSaveProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onSaveIngredient: (ing: Ingredient) => void;
  onDeleteIngredient: (id: string) => void;
  onAddStockOpname: (opname: StockOpname) => void;
  onDeleteStockOpname?: (id: string) => void;
  onResetData?: () => void;
  onCreateStockTransfer?: (transfer: StockTransfer) => { success: boolean; message: string; transfer?: StockTransfer };
  onReceiveStockTransfer?: (transferId: string, receiverName: string) => { success: boolean; message: string };
  onCancelStockTransfer?: (transferId: string, cancelerName: string) => { success: boolean; message: string };
  onSaveBranchInventory?: (items: BranchInventoryItem[]) => void;
  onAddFixedAsset?: (asset: FixedAsset, autoRecordCashLedger?: boolean) => void;
  onUpdateFixedAsset?: (asset: FixedAsset) => void;
  onDeleteFixedAsset?: (id: string) => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  products,
  ingredients,
  stockOpnames,
  user,
  outlets = [
    { id: 'outlet-pusat', name: 'Pusat - Gudang & Dapur Utama', address: 'Jl. Pegangsaan Dua No. 88, Jakarta Utara', phone: '0812-9988-7766', type: 'CENTRAL', isMaster: true },
    { id: 'outlet-lagoa', name: 'Cabang Lagoa (Outlet 1)', address: 'Jl. Lagoa Terusan No. 12, Koja, Jakarta Utara', phone: '0812-1111-2222', type: 'OUTLET', isMaster: false },
    { id: 'outlet-koja', name: 'Cabang Koja (Outlet 2)', address: 'Jl. Kramat Jaya No. 45, Koja, Jakarta Utara', phone: '0812-3333-4444', type: 'OUTLET', isMaster: false },
    { id: 'outlet-kelapagading', name: 'Cabang Kelapa Gading (Outlet 3)', address: 'Boulevard Raya Blok QA 1 No. 5, Kelapa Gading', phone: '0812-5555-6666', type: 'OUTLET', isMaster: false },
  ],
  activeOutlet = outlets[0],
  branchInventory = [],
  stockTransfers = [],
  fixedAssets = [],
  settings = { storeName: 'Kedai Su-Qur', address: 'Jakarta', tagline: 'Authentic Signature Coffee', phone: '' } as unknown as StoreSettings,
  onSaveProduct,
  onDeleteProduct,
  onSaveIngredient,
  onDeleteIngredient,
  onAddStockOpname,
  onDeleteStockOpname,
  onResetData,
  onCreateStockTransfer,
  onReceiveStockTransfer,
  onCancelStockTransfer,
  onSaveBranchInventory,
  onAddFixedAsset,
  onUpdateFixedAsset,
  onDeleteFixedAsset,
}) => {
  const isAdmin = user?.role === 'admin';
  const currentOverheadPerCup = calculateOverheadPerCup(
    settings?.monthlyOperationalExpense,
    settings?.monthlyTargetSalesCup
  );
  const [activeTab, setActiveTab] = useState<'products' | 'branch_inventory' | 'transfers' | 'opname' | 'fixed_assets'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  // Product Recipe Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState<Product['category']>('Kopi Espresso');
  const [productPrice, setProductPrice] = useState<number>(20000);
  const [productImage, setProductImage] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productRecipe, setProductRecipe] = useState<RecipeItem[]>([]);
  const [productCupOptions, setProductCupOptions] = useState<('14oz' | '16oz' | '18oz' | '22oz')[]>(['14oz', '16oz', '18oz', '22oz']);
  const [productHasIce, setProductHasIce] = useState<boolean>(true);
  const [productVariantsState, setProductVariantsState] = useState<ProductVariant[]>([]);

  // Modals for Transfers and Surat Jalan
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [viewingSuratJalan, setViewingSuratJalan] = useState<StockTransfer | null>(null);

  // Ingredient Modal State
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('gram');
  const [ingCost, setIngCost] = useState<number>(100);
  const [ingStock, setIngStock] = useState<number>(1000);
  const [ingMinStock, setIngMinStock] = useState<number>(200);
  const [ingCategory, setIngCategory] = useState('Biji Kopi');

  // Stock Opname Modal State
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameOutletId, setOpnameOutletId] = useState<string>(activeOutlet?.id || 'outlet-lagoa');
  const [opnameIngId, setOpnameIngId] = useState('');
  const [actualStock, setActualStock] = useState<number>(0);
  const [opnameReason, setOpnameReason] = useState<StockOpname['reason']>('Selisih Hitung');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Filtered lists
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const filteredBranchInventory = branchInventory.filter((bi) => {
    const matchesBranch = selectedBranchFilter === 'ALL' || bi.outletId === selectedBranchFilter;
    const matchesSearch = bi.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) || bi.outletName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  const filteredTransfers = stockTransfers.filter((st) => {
    const matchesSearch =
      st.transferNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.fromOutletName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.toOutletName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.driverName && st.driverName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const filteredOpnames = stockOpnames.filter((op) => {
    const matchesBranch = selectedBranchFilter === 'ALL' || !op.outletId || op.outletId === selectedBranchFilter;
    const matchesSearch = op.ingredientName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  // Calculate Metrics for Branch Stock
  const totalBranchItems = filteredBranchInventory.length;
  const lowStockBranchItems = filteredBranchInventory.filter((bi) => bi.currentStock <= bi.minStock).length;
  const totalEstimatedAssetValue = filteredBranchInventory.reduce((sum, bi) => sum + bi.currentStock * (bi.costPerUnit || 0), 0);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (activeTab === 'branch_inventory') {
      const headers = isAdmin
        ? ['ID Cabang', 'Nama Cabang', 'Tipe Cabang', 'Bahan Baku', 'Stok Saat Ini', 'Satuan', 'Min Stok', 'HPP per Satuan', 'Total Nilai Stok']
        : ['ID Cabang', 'Nama Cabang', 'Tipe Cabang', 'Bahan Baku', 'Stok Saat Ini', 'Satuan', 'Min Stok'];
      const rows = filteredBranchInventory.map((bi) => {
        const row = [
          bi.outletId,
          bi.outletName,
          bi.outletType,
          bi.ingredientName,
          bi.currentStock,
          bi.unit,
          bi.minStock,
        ];
        if (isAdmin) {
          row.push(bi.costPerUnit || 0, bi.currentStock * (bi.costPerUnit || 0));
        }
        return row;
      });
      exportToCSV('stok_multi_cabang', headers, rows);
    } else if (activeTab === 'transfers') {
      const headers = isAdmin
        ? ['No Surat Jalan', 'Tanggal', 'Dari Cabang', 'Ke Cabang', 'Status', 'Driver', 'No Kendaraan', 'Total Nilai (Rp)', 'Dibuat Oleh']
        : ['No Surat Jalan', 'Tanggal', 'Dari Cabang', 'Ke Cabang', 'Status', 'Driver', 'No Kendaraan', 'Dibuat Oleh'];
      const rows = stockTransfers.map((st) => {
        const row = [
          st.transferNumber,
          new Date(st.createdAt).toLocaleString('id-ID'),
          st.fromOutletName,
          st.toOutletName,
          st.status,
          st.driverName || '-',
          st.vehicleNumber || '-',
        ];
        if (isAdmin) {
          row.push(String(st.totalEstimatedValue || 0));
        }
        row.push(st.createdBy);
        return row;
      });
      exportToCSV('riwayat_transfer_suplai', headers, rows);
    } else if (activeTab === 'products') {
      const headers = isAdmin
        ? ['ID', 'Nama Menu', 'Kategori', 'Harga Jual (Rp)', 'HPP Bahan & Kemasan (Rp)', 'Overhead/Cup (Rp)', 'Total HPP (Rp)', 'Gross Profit (Rp)', 'Gross Margin (%)', 'Deskripsi']
        : ['ID', 'Nama Menu', 'Kategori', 'Harga Jual (Rp)', 'Deskripsi'];
      const rows = products.map((prod) => {
        const rawCost = calculateRawMaterialCost(prod.recipe || [], ingredients);
        const overhead = currentOverheadPerCup;
        const totalCogs = rawCost + overhead;
        const marginRp = prod.price - totalCogs;
        const marginPct = prod.price > 0 ? Math.round((marginRp / prod.price) * 1000) / 10 : 0;
        if (isAdmin) {
          return [
            prod.id,
            prod.name,
            prod.category,
            prod.price,
            rawCost,
            overhead,
            totalCogs,
            marginRp,
            `${marginPct}%`,
            prod.description || '',
          ];
        }
        return [
          prod.id,
          prod.name,
          prod.category,
          prod.price,
          prod.description || '',
        ];
      });
      exportToCSV('menu_dan_resep_pusat', headers, rows);
    } else {
      const headers = ['Tanggal', 'Cabang', 'Bahan Baku', 'Stok Sistem', 'Stok Fisik', 'Selisih', 'Alasan Audit', 'Petugas'];
      const rows = stockOpnames.map((op) => [
        new Date(op.date).toLocaleString('id-ID'),
        op.outletName || 'Semua Cabang',
        op.ingredientName,
        op.systemStock,
        op.actualStock,
        op.difference,
        op.reason || '-',
        op.adjustedBy,
      ]);
      exportToCSV('laporan_stock_opname', headers, rows);
    }
  };

  // Open Product Modal
  const handleOpenProductModal = (prod?: Product) => {
    if (prod) {
      setEditingProduct(prod);
      setProductName(prod.name);
      setProductCategory(prod.category);
      setProductPrice(prod.price);
      setProductImage(prod.image);
      setProductDesc(prod.description || '');
      setProductRecipe(prod.recipe || []);
      const defaultCups: ('14oz' | '16oz' | '18oz' | '22oz')[] = ['14oz', '16oz', '18oz', '22oz'];
      const isFood = prod.category === 'Pastry & Snack' || prod.category === 'Makanan Utama';
      setProductCupOptions(prod.cupOptions || (isFood ? [] : defaultCups));
      setProductHasIce(prod.hasIceOption ?? !isFood);
      setProductVariantsState(prod.variants || []);
    } else {
      setEditingProduct(null);
      setProductName('');
      setProductCategory('Kopi Espresso');
      setProductPrice(22000);
      setProductImage('https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80');
      setProductDesc('');
      setProductRecipe([]);
      setProductCupOptions(['14oz', '16oz', '18oz', '22oz']);
      setProductHasIce(true);
      setProductVariantsState([
        { id: 'v-14', name: '14oz (Small)', priceAdjustment: -1000, cogsAdjustment: -100 },
        { id: 'v-16', name: '16oz (Medium)', priceAdjustment: 0, cogsAdjustment: 0 },
        { id: 'v-18', name: '18oz (Large)', priceAdjustment: 1000, cogsAdjustment: 100 },
        { id: 'v-22', name: '22oz (Jumbo)', priceAdjustment: 2000, cogsAdjustment: 200 },
      ]);
    }
    setIsProductModalOpen(true);
  };

  const handleToggleCupOption = (cup: '14oz' | '16oz' | '18oz' | '22oz') => {
    let updatedCups: ('14oz' | '16oz' | '18oz' | '22oz')[];
    if (productCupOptions.includes(cup)) {
      updatedCups = productCupOptions.filter((c) => c !== cup);
    } else {
      updatedCups = [...productCupOptions, cup];
    }
    setProductCupOptions(updatedCups);

    const defaultAdjustments: Record<string, { price: number; cogs: number; label: string }> = {
      '14oz': { price: -1000, cogs: -100, label: '14oz (Small)' },
      '16oz': { price: 0, cogs: 0, label: '16oz (Medium)' },
      '18oz': { price: 1000, cogs: 100, label: '18oz (Large)' },
      '22oz': { price: 2000, cogs: 200, label: '22oz (Jumbo)' },
    };

    const newVariants: ProductVariant[] = updatedCups.map((c) => {
      const existing = productVariantsState.find((v) => v.name.includes(c));
      if (existing) return existing;
      const def = defaultAdjustments[c] || { price: 0, cogs: 0, label: `${c}` };
      return {
        id: `v-${c.toLowerCase()}`,
        name: def.label,
        priceAdjustment: def.price,
        cogsAdjustment: def.cogs,
      };
    });

    setProductVariantsState(newVariants);
  };

  const handleToggleIceOption = (enabled: boolean) => {
    setProductHasIce(enabled);
  };

  const handleSaveProductForm = () => {
    if (!productName.trim()) return;
    const rawCost = calculateRawMaterialCost(productRecipe, ingredients);
    const overhead = currentOverheadPerCup;
    const totalCogs = rawCost + overhead;

    const newProd: Product = {
      id: editingProduct ? editingProduct.id : 'prod-' + Date.now(),
      name: productName.trim(),
      category: productCategory,
      price: productPrice,
      cogs: totalCogs,
      rawMaterialCost: rawCost,
      overheadCost: overhead,
      image: productImage.trim() || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=80',
      description: productDesc.trim(),
      isAvailable: true,
      recipe: productRecipe,
      variants: productVariantsState,
      cupOptions: productCupOptions,
      hasIceOption: productHasIce,
    };

    onSaveProduct(newProd);
    setIsProductModalOpen(false);
  };

  // Recipe helpers
  const handleAddRecipeItem = (ingredientId: string) => {
    if (productRecipe.some((r) => r.ingredientId === ingredientId)) return;
    setProductRecipe([...productRecipe, { ingredientId, amount: 1 }]);
  };

  const handleUpdateRecipeAmount = (ingredientId: string, amount: number) => {
    setProductRecipe(
      productRecipe.map((r) => (r.ingredientId === ingredientId ? { ...r, amount: Math.max(0, amount) } : r))
    );
  };

  const handleRemoveRecipeItem = (ingredientId: string) => {
    setProductRecipe(productRecipe.filter((r) => r.ingredientId !== ingredientId));
  };

  // Open Ingredient Modal
  const handleOpenIngredientModal = (ing?: Ingredient) => {
    if (ing) {
      setEditingIngredient(ing);
      setIngName(ing.name);
      setIngUnit(ing.unit);
      setIngCost(ing.costPerUnit);
      setIngStock(ing.currentStock);
      setIngMinStock(ing.minStock);
      setIngCategory(ing.category);
    } else {
      setEditingIngredient(null);
      setIngName('');
      setIngUnit('gram');
      setIngCost(150);
      setIngStock(1000);
      setIngMinStock(200);
      setIngCategory('Biji Kopi');
    }
    setIsIngredientModalOpen(true);
  };

  const handleSaveIngredientForm = () => {
    if (!ingName.trim()) return;
    const newIng: Ingredient = {
      id: editingIngredient ? editingIngredient.id : 'ing-' + Date.now(),
      name: ingName.trim(),
      unit: ingUnit.trim(),
      costPerUnit: ingCost,
      currentStock: ingStock,
      minStock: ingMinStock,
      category: ingCategory,
    };
    onSaveIngredient(newIng);
    setIsIngredientModalOpen(false);
  };

  // Handle Stock Opname
  const handleOpenOpnameModal = (preselectedBranch?: string, preselectedIngId?: string) => {
    const targetBranch = preselectedBranch || activeOutlet?.id || outlets[0]?.id;
    setOpnameOutletId(targetBranch);

    const ingId = preselectedIngId || ingredients[0]?.id || '';
    setOpnameIngId(ingId);

    // Find current stock in branch
    const foundBranchStock = branchInventory.find((b) => b.outletId === targetBranch && b.ingredientId === ingId);
    if (foundBranchStock) {
      setActualStock(foundBranchStock.currentStock);
    } else {
      const targetIng = ingredients.find((i) => i.id === ingId);
      setActualStock(targetIng?.currentStock || 0);
    }

    setIsOpnameModalOpen(true);
  };

  const handleSaveOpname = () => {
    const targetIng = ingredients.find((i) => i.id === opnameIngId);
    if (!targetIng) return;

    const targetBranch = outlets.find((o) => o.id === opnameOutletId);
    const branchRecord = branchInventory.find((b) => b.outletId === opnameOutletId && b.ingredientId === opnameIngId);
    const sysStock = branchRecord ? branchRecord.currentStock : targetIng.currentStock;
    const diff = actualStock - sysStock;

    const opname: StockOpname = {
      id: 'opname-' + Date.now(),
      date: new Date().toISOString(),
      ingredientId: targetIng.id,
      ingredientName: targetIng.name,
      systemStock: sysStock,
      actualStock,
      difference: diff,
      reason: opnameReason,
      adjustedBy: user.name,
      outletId: opnameOutletId,
      outletName: targetBranch?.name || 'Cabang',
    };

    onAddStockOpname(opname);
    setIsOpnameModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Notice Banner for Kasir Read-Only Mode */}
      {!isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-300 text-[#3E2723] p-4 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                Mode Akses Kasir & Outlet ({activeOutlet?.name || 'Cabang Aktif'})
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Anda dapat memantau ketersediaan stok outlet Anda, mengonfirmasi penerimaan kiriman surat jalan dari Pusat, dan melihat komposisi resep. Penambahan resep master hanya diizinkan untuk <strong>Admin Pusat</strong>.
              </p>
            </div>
          </div>
          <span className="bg-amber-200/60 text-amber-900 text-[10px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 border border-amber-300">
            Akses Terbatas
          </span>
        </div>
      )}

      {/* Header Banner & Subnav */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#3E2723] to-[#2B1713] p-5 rounded-3xl text-[#F5EBE0] shadow-xl border border-[#4E342E]">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#D4A373] text-[#1F1412] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
              Hub & Spoke Architecture
            </span>
            <span className="text-xs text-[#FAF3DD]/80 font-medium">
              Multi-Branch Kedai Su-Qur
            </span>
          </div>
          <h2 className="text-xl font-black text-[#FAF3DD] flex items-center gap-2 mt-1">
            <Layers className="w-5 h-5 text-[#D4A373]" /> Manajemen Resep & Stok Multi-Cabang
          </h2>
          <p className="text-xs text-[#D4A373] mt-0.5">
            Pusat kendali resep BOM, stok cabang (Pusat & Outlet), dan transfer suplai antar outlet
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#1F1412] p-1.5 rounded-2xl border border-[#4E342E]">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'products' ? 'bg-[#D4A373] text-[#1F1412] shadow-md' : 'text-gray-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Resep BOM Pusat
          </button>
          <button
            onClick={() => setActiveTab('branch_inventory')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'branch_inventory' ? 'bg-[#D4A373] text-[#1F1412] shadow-md' : 'text-gray-300 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Stok per Cabang
            {lowStockBranchItems > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'transfers' ? 'bg-[#D4A373] text-[#1F1412] shadow-md' : 'text-gray-300 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" /> Suplai & Surat Jalan
            {stockTransfers.filter((t) => t.status === 'IN_TRANSIT').length > 0 && (
              <span className="bg-amber-400 text-amber-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {stockTransfers.filter((t) => t.status === 'IN_TRANSIT').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('opname')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'opname' ? 'bg-[#D4A373] text-[#1F1412] shadow-md' : 'text-gray-300 hover:text-white'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" /> Revisi / Opname
          </button>
          <button
            onClick={() => setActiveTab('fixed_assets')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'fixed_assets' ? 'bg-[#D4A373] text-[#1F1412] shadow-md' : 'text-gray-300 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" /> Aset & Peralatan
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'fixed_assets' ? 'bg-[#3E2723] text-amber-300' : 'bg-stone-800 text-amber-200'
              }`}
            >
              {fixedAssets.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari menu, bahan, cabang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6D5C3] bg-[#FDFBF7] text-xs text-[#2B1713] focus:outline-none focus:border-[#D4A373]"
            />
          </div>

          {/* Branch Filter Selector for Multi-Branch and Opname */}
          {(activeTab === 'branch_inventory' || activeTab === 'opname') && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#8D6E63] shrink-0">Filter Cabang:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E6D5C3] bg-[#FDFBF7] text-xs font-bold text-[#2B1713] focus:outline-none focus:border-[#D4A373]"
              >
                <option value="ALL">Semua Cabang (Pusat & Outlet)</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.type === 'CENTRAL' ? '(Pusat / Hub)' : '(Outlet)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
            title="Ekspor Data ke File Excel (CSV)"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Ekspor CSV
          </button>

          {/* Context Actions per tab */}
          {activeTab === 'products' && (
            isAdmin ? (
              <button
                onClick={() => handleOpenProductModal()}
                className="px-4 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4 text-[#D4A373]" /> Tambah Menu & Resep Pusat
              </button>
            ) : (
              <div className="px-3.5 py-2 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs border border-gray-200 flex items-center gap-1.5 cursor-not-allowed">
                <Lock className="w-3.5 h-3.5 text-gray-400" /> Resep Pusat (Khusus Admin)
              </div>
            )
          )}

          {activeTab === 'branch_inventory' && (
            <>
              {isAdmin && (
                <button
                  onClick={() => handleOpenIngredientModal()}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-amber-700" /> Tambah Master Bahan Baku
                </button>
              )}
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Truck className="w-4 h-4 text-[#D4A373]" /> Kirim Suplai dari Pusat
              </button>
            </>
          )}

          {activeTab === 'transfers' && (
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Truck className="w-4 h-4 text-[#D4A373]" /> Buat Surat Jalan Suplai Baru
            </button>
          )}

          {activeTab === 'opname' && (
            <button
              onClick={() => handleOpenOpnameModal(selectedBranchFilter !== 'ALL' ? selectedBranchFilter : activeOutlet?.id)}
              className="px-4 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <ClipboardList className="w-4 h-4 text-[#D4A373]" /> Buat Audit Stock Opname
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: Katalog & Resep BOM Pusat */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-[#FAF3DD]/60 border border-[#E6D5C3] p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3E2723] text-[#D4A373] flex items-center justify-center font-black">
                BOM
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#2B1713]">
                  Standard Resep Terpusat (Hub Formula)
                </h3>
                <p className="text-xs text-[#8D6E63]">
                  Setiap perubahan resep di Pusat secara otomatis menjadi standar pemotongan stok bahan baku di seluruh cabang saat transaksi POS terjadi.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block bg-[#3E2723] text-[#FAF3DD] text-[10px] font-bold px-3 py-1 rounded-full">
              {products.length} Menu Terdaftar
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((prod) => {
              const rawCost = calculateRawMaterialCost(prod.recipe || [], ingredients);
              const overhead = currentOverheadPerCup;
              const totalCogs = rawCost + overhead;
              const profitAnalysis = calculateGrossProfitMargin(prod.price, totalCogs);

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-[#E6D5C3] overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-24 xs:h-28 sm:h-36 bg-[#F5EBE0]">
                      <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute top-2 left-2 bg-[#3E2723]/90 text-[#FAF3DD] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {prod.category}
                      </div>
                      {isAdmin && (
                        <div className="absolute bottom-2 right-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border shadow-xs ${profitAnalysis.badgeColor}`}>
                            {profitAnalysis.grossProfitPercent}% Margin
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-[#2B1713]">{prod.name}</h4>
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenProductModal(prod)}
                            className="text-[#8D6E63] hover:text-[#3E2723] p-1 rounded-lg hover:bg-[#FAF3DD] transition-colors"
                            title="Edit Resep & Menu"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 line-clamp-2">{prod.description || 'Tidak ada deskripsi'}</p>

                      {/* HPP vs Selling Price breakdown (2 Variabel: Bahan+Kemasan & Overhead) */}
                      <div className="bg-[#FDFBF7] p-3 rounded-xl border border-[#E6D5C3] space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-medium">Harga Jual Menu:</span>
                          <span className="font-extrabold text-[#3E2723]">{formatRp(prod.price)}</span>
                        </div>
                        {isAdmin && (
                          <>
                            <div className="flex justify-between text-[#8D6E63] text-[11px]">
                              <span>1. Bahan Baku &amp; Kemasan:</span>
                              <span className="font-semibold">{formatRp(rawCost)}</span>
                            </div>
                            <div className="flex justify-between text-[#8D6E63] text-[11px]">
                              <span>2. Alokasi Overhead/Cup:</span>
                              <span className="font-semibold">{formatRp(overhead)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-[#2B1713] border-t border-dashed border-[#E6D5C3] pt-1">
                              <span>Total HPP (1 + 2):</span>
                              <span className="text-[#3E2723]">{formatRp(totalCogs)}</span>
                            </div>
                            <div className="flex justify-between border-t border-[#E6D5C3] pt-1 text-emerald-800 font-bold">
                              <span>Gross Profit:</span>
                              <span>
                                {formatRp(profitAnalysis.grossProfitRp)} ({profitAnalysis.grossProfitPercent}%)
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Resep Ingredient preview tags (Admin Only for recipe secrecy) */}
                      {isAdmin && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8D6E63]">
                            Komposisi Resep ({prod.recipe?.length || 0} Bahan):
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {prod.recipe && prod.recipe.length > 0 ? (
                              prod.recipe.map((r, i) => {
                                const ing = ingredients.find((item) => item.id === r.ingredientId);
                                return (
                                  <span
                                    key={i}
                                    className="bg-[#F5EBE0] text-[#3E2723] text-[10px] px-2 py-0.5 rounded-md border border-[#E6D5C3]"
                                  >
                                    {ing ? `${ing.name} (${r.amount} ${ing.unit})` : `Bahan (${r.amount})`}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-red-500 italic">Belum ada takaran resep</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="p-3 bg-[#FAF3DD]/30 border-t border-[#E6D5C3] flex items-center justify-between text-xs">
                      <button
                        onClick={() => handleOpenProductModal(prod)}
                        className="text-xs font-bold text-[#3E2723] hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-[#D4A373]" /> Ubah Resep / Takaran
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Hapus menu "${prod.name}"?`)) {
                            onDeleteProduct(prod.id);
                          }
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-800"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Stok per Cabang (Multi-Branch Inventory) */}
      {activeTab === 'branch_inventory' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#8D6E63] font-bold block uppercase">Total Item Bahan</span>
                <span className="text-xl font-black text-[#2B1713]">{totalBranchItems} Item Terdaftar</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#FAF3DD] flex items-center justify-center text-[#3E2723]">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-amber-700 font-bold block uppercase">Stok Menipis / Kritis</span>
                <span className={`text-xl font-black ${lowStockBranchItems > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {lowStockBranchItems} Bahan Perlu Restok
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {isAdmin ? (
              <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-700 font-bold block uppercase">Estimasi Nilai Aset Stok</span>
                  <span className="text-xl font-black text-[#2B1713]">{formatRp(totalEstimatedAssetValue)}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Store className="w-5 h-5" />
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-2xl border border-[#E6D5C3] shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-blue-700 font-bold block uppercase">Status Gudang</span>
                  <span className="text-xl font-black text-[#2B1713]">Siap Operasional</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                  <Store className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>

          {/* Branch Inventory Table */}
          <div className="bg-white rounded-3xl border border-[#E6D5C3] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF3DD] text-[#3E2723] font-black border-b border-[#E6D5C3]">
                  <tr>
                    <th className="py-3 px-4">Bahan Baku</th>
                    <th className="py-3 px-4">Cabang</th>
                    <th className="py-3 px-4 text-center">Stok Fisik Saat Ini</th>
                    <th className="py-3 px-4 text-center">Batas Min. Alert</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Nilai Aset Stok</th>}
                    <th className="py-3 px-4 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D5C3]">
                  {filteredBranchInventory.map((bi) => {
                    const isLow = bi.currentStock <= bi.minStock;
                    const isOut = bi.currentStock <= 0;
                    const assetVal = bi.currentStock * (bi.costPerUnit || 0);

                    return (
                      <tr key={bi.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#2B1713]">
                          {bi.ingredientName}
                          {isAdmin && (
                            <span className="block text-[10px] text-[#8D6E63] font-normal">
                              HPP: {formatRp(bi.costPerUnit || 0)} / {bi.unit}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#3E2723] block">{bi.outletName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full inline-block mt-0.5 ${
                            bi.outletType === 'CENTRAL' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {bi.outletType === 'CENTRAL' ? 'Pusat / Hub' : 'Outlet'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-extrabold text-sm text-[#2B1713]">
                          {bi.currentStock} <span className="font-normal text-gray-500 text-xs">{bi.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600 font-medium">
                          {bi.minStock} {bi.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isOut ? (
                            <span className="bg-red-100 text-red-800 border border-red-300 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <X className="w-3 h-3" /> Stok Habis
                            </span>
                          ) : isLow ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Menipis
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Aman
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right font-bold text-[#8D6E63] font-mono">
                            {formatRp(assetVal)}
                          </td>
                        )}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenOpnameModal(bi.outletId, bi.ingredientId)}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#3E2723] font-bold text-[11px] transition-colors"
                              title="Revisi / Adjust Stok Fisik"
                            >
                              Adjust
                            </button>
                            {bi.outletType === 'OUTLET' && (
                              <button
                                onClick={() => setIsTransferModalOpen(true)}
                                className="px-2.5 py-1 rounded-lg bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold text-[11px] transition-colors"
                                title="Kirim Suplai dari Pusat"
                              >
                                Kirim
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Suplai & Surat Jalan (Stock Transfers) */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="bg-[#FAF3DD]/60 border border-[#E6D5C3] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3E2723] text-[#D4A373] flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#2B1713]">
                  Logistik & Distribusi Suplai Hub-Spoke
                </h3>
                <p className="text-xs text-[#8D6E63]">
                  Pusat menerbitkan surat jalan pengiriman suplai. Stok outlet otomatis bertambah saat outlet menekan 'Konfirmasi Terima Barang'.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#D4A373]" /> Buat Surat Jalan Baru
            </button>
          </div>

          {/* Transfers List */}
          <div className="space-y-3">
            {filteredTransfers.length > 0 ? (
              filteredTransfers.map((transfer) => {
                const isTransit = transfer.status === 'IN_TRANSIT';
                const isReceived = transfer.status === 'RECEIVED';
                const isCancelled = transfer.status === 'CANCELLED';

                return (
                  <div
                    key={transfer.id}
                    className={`bg-white p-5 rounded-3xl border transition-all shadow-xs ${
                      isTransit ? 'border-amber-300 bg-amber-50/10' : 'border-[#E6D5C3]'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Transfer Header & Info */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-sm text-[#3E2723]">
                            {transfer.transferNumber}
                          </span>
                          {isTransit && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-700" /> Sedang Dikirim
                            </span>
                          )}
                          {isReceived && (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Diterima Outlet
                            </span>
                          )}
                          {isCancelled && (
                            <span className="bg-red-100 text-red-900 border border-red-300 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                              Dibatalkan
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <div className="flex items-center gap-1 font-bold text-[#3E2723]">
                            <span>{transfer.fromOutletName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#D4A373]" />
                            <span className="text-emerald-800 font-extrabold">{transfer.toOutletName}</span>
                          </div>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">
                            {new Date(transfer.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          {transfer.driverName && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-600 font-medium">Driver: <strong>{transfer.driverName}</strong> ({transfer.vehicleNumber || 'Kendaraan Logistik'})</span>
                            </>
                          )}
                        </div>

                        {/* Items preview tag */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {transfer.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="bg-[#FAF3DD] text-[#3E2723] text-[10px] font-semibold px-2 py-0.5 rounded-md border border-[#E6D5C3]"
                            >
                              {it.ingredientName}: <strong>{it.amount} {it.unit}</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        <button
                          onClick={() => setViewingSuratJalan(transfer)}
                          className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#3E2723] font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#8D6E63]" /> Surat Jalan
                        </button>

                        {isTransit && (
                          <>
                            {onReceiveStockTransfer && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Konfirmasi penerimaan barang untuk ${transfer.toOutletName}? Stok fisik outlet akan bertambah otomatis.`)) {
                                    const res = onReceiveStockTransfer(transfer.id, user.name || 'Kasir Outlet');
                                    if (res.success) {
                                      alert(res.message);
                                    } else {
                                      alert(res.message);
                                    }
                                  }
                                }}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Konfirmasi Terima Barang
                              </button>
                            )}

                            {isAdmin && onCancelStockTransfer && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Batalkan pengiriman surat jalan ini? Stok bahan baku akan dikembalikan ke Pusat.')) {
                                    const res = onCancelStockTransfer(transfer.id, user.name || 'Admin');
                                    alert(res.message);
                                  }
                                }}
                                className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                              >
                                Batalkan
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-[#E6D5C3] text-gray-500 text-xs">
                Belum ada data pengiriman suplai antar cabang. Tekan "Buat Surat Jalan Suplai Baru" untuk memulai distribusi bahan baku.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Revisi / Stock Opname */}
      {activeTab === 'opname' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-[#E6D5C3] overflow-hidden shadow-xs">
            <div className="p-4 bg-[#FAF3DD] border-b border-[#E6D5C3] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#2B1713]">
                  Histori Revisi & Audit Stock Opname Cabang
                </h3>
                <p className="text-xs text-[#8D6E63]">
                  Catatan audit fisik berkala untuk mencegah kebocoran bahan baku dan menghitung selisih sistem
                </p>
              </div>
              <button
                onClick={() => handleOpenOpnameModal(selectedBranchFilter !== 'ALL' ? selectedBranchFilter : activeOutlet?.id)}
                className="px-3.5 py-1.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] shadow-sm flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-[#D4A373]" /> Form Opname
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF3DD]/40 text-[#3E2723] font-bold border-b border-[#E6D5C3]">
                  <tr>
                    <th className="py-2.5 px-4">Waktu Audit</th>
                    <th className="py-2.5 px-4">Cabang</th>
                    <th className="py-2.5 px-4">Bahan Baku</th>
                    <th className="py-2.5 px-4 text-center">Stok Sistem</th>
                    <th className="py-2.5 px-4 text-center">Stok Fisik Riil</th>
                    <th className="py-2.5 px-4 text-center">Selisih</th>
                    <th className="py-2.5 px-4">Alasan Penyesuaian</th>
                    <th className="py-2.5 px-4">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D5C3]">
                  {filteredOpnames.map((op) => {
                    const isDeficit = op.difference < 0;
                    const isSurplus = op.difference > 0;

                    return (
                      <tr key={op.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-4 text-gray-500 font-mono">
                          {new Date(op.date).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[#3E2723]">
                          {op.outletName || 'Cabang'}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[#2B1713]">
                          {op.ingredientName}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono">
                          {op.systemStock}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-[#3E2723]">
                          {op.actualStock}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] ${
                              isDeficit
                                ? 'bg-red-100 text-red-800'
                                : isSurplus
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {op.difference > 0 ? `+${op.difference}` : op.difference}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-gray-700">
                          {op.reason || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-gray-600 font-medium">
                          {op.adjustedBy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Aset & Peralatan Toko (Fixed Assets & CAPEX) */}
      {activeTab === 'fixed_assets' && (
        <div className="space-y-4">
          <FixedAssetsTab
            fixedAssets={fixedAssets}
            outlets={outlets}
            activeOutlet={activeOutlet}
            currentUser={user}
            onAddAsset={onAddFixedAsset || (() => {})}
            onUpdateAsset={onUpdateFixedAsset}
            onDeleteAsset={onDeleteFixedAsset || (() => {})}
          />
        </div>
      )}

      {/* Modal Buat Transfer Stok */}
      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        outlets={outlets}
        ingredients={ingredients}
        branchInventory={branchInventory}
        user={user}
        activeOutlet={activeOutlet}
        onCreateTransfer={onCreateStockTransfer || (() => ({ success: false, message: 'Fungsi transfer tidak tersedia.' }))}
      />

      {/* Modal Surat Jalan Print Sheet */}
      <SuratJalanModal
        transfer={viewingSuratJalan}
        settings={settings}
        onClose={() => setViewingSuratJalan(null)}
        onReceive={(id) => {
          if (onReceiveStockTransfer) {
            const res = onReceiveStockTransfer(id, user.name || 'Kasir Outlet');
            alert(res.message);
            setViewingSuratJalan(null);
          }
        }}
        onCancel={(id) => {
          if (onCancelStockTransfer) {
            const res = onCancelStockTransfer(id, user.name || 'Admin');
            alert(res.message);
            setViewingSuratJalan(null);
          }
        }}
        canManage={isAdmin}
      />

      {/* Modal Edit / Tambah Menu & Resep Pusat */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E6D5C3] space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#2B1713]">
                  {editingProduct ? 'Edit Resep & Menu Pusat' : 'Tambah Menu & Resep Baru'}
                </h3>
                <span className="text-[10px] text-[#8D6E63] font-medium">
                  Formula HPP BOM Terpusat (Hub Formula)
                </span>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#3E2723] block mb-1">Nama Produk / Menu</label>
                <input
                  type="text"
                  placeholder="cth: Kopi Susu Kurma Signature"
                  value={productName}
                  disabled={!isAdmin}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#D4A373]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#3E2723] block mb-1">Kategori</label>
                  <select
                    value={productCategory}
                    disabled={!isAdmin}
                    onChange={(e) => setProductCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs bg-white focus:outline-none focus:border-[#D4A373]"
                  >
                    <option value="Kopi Espresso">Kopi Espresso</option>
                    <option value="Manual Brew">Manual Brew</option>
                    <option value="Non Coffee">Non Coffee</option>
                    <option value="Signature Drink">Signature Drink</option>
                    <option value="Pastry & Snack">Pastry & Snack</option>
                    <option value="Makanan Utama">Makanan Utama</option>
                    <option value="Menu Paket">Menu Paket</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#3E2723] block mb-1">Harga Jual Normal (Rp)</label>
                  <input
                    type="number"
                    value={productPrice}
                    disabled={!isAdmin}
                    onChange={(e) => setProductPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none focus:border-[#D4A373]"
                  />
                </div>
              </div>

              {/* Recipe Builder Section */}
              <div className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#E6D5C3] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E6D5C3] pb-2 gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-[#3E2723] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#D4A373]" /> Komposisi Resep Bahan Baku &amp; Kemasan
                    </h4>
                    <p className="text-[10px] text-gray-500">
                      Takaran bahan baku &amp; kemasan (cup, sablon, sedotan) yang otomatis terpotong saat transaksi
                    </p>
                  </div>
                  <div className="text-right bg-[#FAF3DD] px-2.5 py-1 rounded-lg border border-[#E6D5C3] self-start sm:self-auto">
                    <span className="text-[10px] text-[#8D6E63] font-bold block">Bahan + Kemasan:</span>
                    <span className="text-xs font-black text-[#2B1713]">
                      {formatRp(calculateRawMaterialCost(productRecipe, ingredients))}
                    </span>
                  </div>
                </div>

                {/* Add Ingredient Selector (Admin only) */}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <select
                      id="recipe-ing-select"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-[#E6D5C3] text-xs bg-white"
                    >
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({formatRp(ing.costPerUnit)} / {ing.unit}) - {ing.category}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const sel = (document.getElementById('recipe-ing-select') as HTMLSelectElement)?.value;
                        if (sel) handleAddRecipeItem(sel);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#3E2723] text-white font-semibold text-xs hover:bg-[#4E342E]"
                    >
                      + Tambah Bahan
                    </button>
                  </div>
                )}

                {/* Added Recipe Items List */}
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {productRecipe.length === 0 ? (
                    <p className="text-center py-4 text-xs text-gray-400 italic">
                      Belum ada komposisi resep bahan/kemasan yang ditambahkan
                    </p>
                  ) : (
                    productRecipe.map((item) => {
                      const ing = ingredients.find((i) => i.id === item.ingredientId);
                      if (!ing) return null;
                      const itemCost = ing.costPerUnit * item.amount;
                      return (
                        <div
                          key={item.ingredientId}
                          className="bg-white p-2.5 rounded-xl border border-[#E6D5C3] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#2B1713]">{ing.name}</div>
                            <span className="text-[10px] text-[#8D6E63]">{ing.category} • @{formatRp(ing.costPerUnit)}/{ing.unit}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.amount}
                              disabled={!isAdmin}
                              onChange={(e) => handleUpdateRecipeAmount(item.ingredientId, parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-0.5 rounded-lg border border-[#E6D5C3] font-bold text-center text-xs disabled:bg-gray-100"
                            />
                            <span className="text-gray-500 text-[10px]">{ing.unit}</span>
                            <span className="font-bold text-[#3E2723] w-20 text-right">{formatRp(itemCost)}</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRecipeItem(item.ingredientId)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* REAL-TIME HPP & GROSS PROFIT MARGIN CALCULATOR CARD */}
              {(() => {
                const rawCost = calculateRawMaterialCost(productRecipe, ingredients);
                const overhead = currentOverheadPerCup;
                const totalHpp = rawCost + overhead;
                const profitData = calculateGrossProfitMargin(productPrice, totalHpp);

                return (
                  <div className="bg-gradient-to-br from-[#FAF3DD]/90 to-[#F5EBE0] p-4 rounded-2xl border-2 border-amber-600/30 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-2">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-[#3E2723]" />
                        <span className="font-extrabold text-xs text-[#2B1713] uppercase tracking-wide">
                          Analisis Real-Time HPP &amp; Margin Keuntungan (Gross Profit)
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border shadow-xs ${profitData.badgeColor}`}>
                        {profitData.statusLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {/* Variabel 1 */}
                      <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3]">
                        <span className="text-[10px] text-[#8D6E63] font-bold block uppercase">
                          1. Bahan &amp; Kemasan
                        </span>
                        <span className="font-bold text-[#2B1713] text-sm">{formatRp(rawCost)}</span>
                        <span className="text-[9px] text-gray-500 block mt-0.5">BOM Resep Menu</span>
                      </div>

                      {/* Variabel 2 */}
                      <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3]">
                        <span className="text-[10px] text-[#8D6E63] font-bold block uppercase">
                          2. Overhead / Cup
                        </span>
                        <span className="font-bold text-[#2B1713] text-sm">{formatRp(overhead)}</span>
                        <span className="text-[9px] text-gray-500 block mt-0.5">Listrik, Air, Gaji, dll</span>
                      </div>

                      {/* Total HPP */}
                      <div className="bg-[#3E2723] text-[#FAF3DD] p-2.5 rounded-xl shadow-xs">
                        <span className="text-[10px] text-amber-300 font-bold block uppercase">
                          Total HPP (1 + 2)
                        </span>
                        <span className="font-black text-white text-sm">{formatRp(totalHpp)}</span>
                        <span className="text-[9px] text-amber-200 block mt-0.5">Biaya Pokok / Porsi</span>
                      </div>

                      {/* Gross Profit % */}
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-300">
                        <span className="text-[10px] text-emerald-800 font-bold block uppercase">
                          Gross Margin (%)
                        </span>
                        <span className={`font-black text-sm ${profitData.grossProfitRp >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {profitData.grossProfitPercent}%
                        </span>
                        <span className="text-[9px] text-emerald-800 font-bold block mt-0.5">
                          Laba: {formatRp(profitData.grossProfitRp)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#8D6E63] flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-[#E6D5C3]/60">
                      <span>
                        💡 Rumus: <strong>HPP = (Bahan Baku + Kemasan) + Overhead ({formatRp(overhead)}/cup)</strong>
                      </span>
                      <span>
                        Harga Jual: <strong className="text-[#3E2723]">{formatRp(productPrice)}</strong> ➜ Margin: <strong className="text-emerald-700">{profitData.grossProfitPercent}%</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Cup Options */}
              <div className="bg-[#FAF3DD]/40 p-3 rounded-2xl border border-[#E6D5C3] space-y-2">
                <label className="font-bold text-xs text-[#3E2723] block">Pilihan Ukuran Cup</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['14oz', '16oz', '18oz', '22oz'] as const).map((cup) => {
                    const isChecked = productCupOptions.includes(cup);
                    return (
                      <label
                        key={cup}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer ${
                          isChecked ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]' : 'bg-white text-[#3E2723] border-[#E6D5C3]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isAdmin}
                          onChange={() => handleToggleCupOption(cup)}
                          className="accent-[#D4A373]"
                        />
                        <span>Cup {cup}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {isAdmin ? (
              <button
                onClick={handleSaveProductForm}
                className="w-full py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-colors"
              >
                Simpan Resep & Menu Pusat
              </button>
            ) : (
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-xs"
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Bahan Baku */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E6D5C3] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <h3 className="font-bold text-base text-[#2B1713]">
                {editingIngredient ? 'Edit Master Bahan Baku' : 'Tambah Master Bahan Baku Baru'}
              </h3>
              <button onClick={() => setIsIngredientModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Nama Bahan Baku</label>
                <input
                  type="text"
                  placeholder="cth: Sirup Kurma Al-Barakah"
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#D4A373]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[#8D6E63] block mb-1">Satuan (Unit)</label>
                  <input
                    type="text"
                    placeholder="gram, ml, pcs"
                    value={ingUnit}
                    onChange={(e) => setIngUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#D4A373]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#8D6E63] block mb-1">HPP per Satuan (Rp)</label>
                  <input
                    type="number"
                    value={ingCost}
                    onChange={(e) => setIngCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none focus:border-[#D4A373]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[#8D6E63] block mb-1">Stok Awal Gudang Pusat</label>
                  <input
                    type="number"
                    value={ingStock}
                    onChange={(e) => setIngStock(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none focus:border-[#D4A373]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#8D6E63] block mb-1">Batas Min. Stok Alert</label>
                  <input
                    type="number"
                    value={ingMinStock}
                    onChange={(e) => setIngMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none focus:border-[#D4A373]"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveIngredientForm}
              className="w-full py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-colors"
            >
              Simpan Master Bahan Baku
            </button>
          </div>
        </div>
      )}

      {/* Modal Stock Opname Multi-Cabang */}
      {isOpnameModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E6D5C3] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <h3 className="font-bold text-base text-[#2B1713]">Form Audit Stock Opname</h3>
              <button onClick={() => setIsOpnameModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Pilih Cabang yang Diaudit</label>
                <select
                  value={opnameOutletId}
                  onChange={(e) => {
                    const newBranch = e.target.value;
                    setOpnameOutletId(newBranch);
                    const foundBranchStock = branchInventory.find((b) => b.outletId === newBranch && b.ingredientId === opnameIngId);
                    if (foundBranchStock) {
                      setActualStock(foundBranchStock.currentStock);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs font-bold text-[#2B1713] bg-white focus:outline-none"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.type === 'CENTRAL' ? '(Pusat / Hub)' : '(Outlet)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Pilih Bahan Baku</label>
                <select
                  value={opnameIngId}
                  onChange={(e) => {
                    const newIngId = e.target.value;
                    setOpnameIngId(newIngId);
                    const found = branchInventory.find((b) => b.outletId === opnameOutletId && b.ingredientId === newIngId);
                    if (found) {
                      setActualStock(found.currentStock);
                    } else {
                      const ing = ingredients.find((i) => i.id === newIngId);
                      if (ing) setActualStock(ing.currentStock);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs bg-white focus:outline-none"
                >
                  {ingredients.map((ing) => {
                    const branchRec = branchInventory.find((b) => b.outletId === opnameOutletId && b.ingredientId === ing.id);
                    const st = branchRec ? branchRec.currentStock : ing.currentStock;
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (Stok Sistem: {st} {ing.unit})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Jumlah Stok Fisik Riil Terhitung</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={actualStock}
                  onChange={(e) => setActualStock(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-base text-[#2B1713] focus:outline-none focus:border-[#D4A373]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Alasan Penyesuaian Audit</label>
                <select
                  value={opnameReason}
                  onChange={(e) => setOpnameReason(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs bg-white focus:outline-none"
                >
                  <option value="Selisih Hitung">Selisih Hitung Rutin</option>
                  <option value="Kerusakan">Kerusakan / Tumpah</option>
                  <option value="Kedaluwarsa">Kedaluwarsa (Expired)</option>
                  <option value="Terbuang/Spill">Terbuang / Spill Barista</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveOpname}
              className="w-full py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-colors"
            >
              Simpan & Perbarui Stok Cabang
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
