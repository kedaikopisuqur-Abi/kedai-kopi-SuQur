import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Coffee,
  Receipt,
  Layers,
  Wrench,
  Bookmark,
  CalendarClock,
  ArrowRight,
  Sparkles,
  CornerDownLeft,
  Store,
  Clock,
  User as UserIcon,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import {
  GlobalSearchEngine,
  GlobalSearchResult,
  SearchCategory,
} from '../utils/globalSearch';
import { User, StoreSettings, NavTab } from '../types';
import { formatRp } from '../utils/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  settings: StoreSettings;
  outletId?: string;
  onNavigateTab?: (tab: NavTab) => void;
  onOpenReceiptModal?: (tx: any) => void;
  onSelectProductToCart?: (product: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  settings,
  outletId,
  onNavigateTab,
  onOpenReceiptModal,
  onSelectProductToCart,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setSelectedIndex(0);
    } else {
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [isOpen]);

  // Execute global search
  const allResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return GlobalSearchEngine.searchAll(searchQuery, {
      outletId,
      categoryFilter: 'all',
      maxResultsPerCategory: 15,
      isAdmin: currentUser.role === 'admin',
    });
  }, [searchQuery, outletId, currentUser.role]);

  // Filter by category pill
  const filteredResults = useMemo(() => {
    if (selectedCategory === 'all') return allResults;
    return allResults.filter((item) => item.category === selectedCategory);
  }, [allResults, selectedCategory]);

  // Count items per category for filter pills
  const categoryCounts = useMemo(() => {
    const counts: Record<SearchCategory, number> = {
      all: allResults.length,
      product: 0,
      transaction: 0,
      ingredient: 0,
      fixed_asset: 0,
      draft_order: 0,
      pre_order: 0,
    };
    for (const res of allResults) {
      if (counts[res.category] !== undefined) {
        counts[res.category]++;
      }
    }
    return counts;
  }, [allResults]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults, selectedCategory]);

  // Handle keyboard navigation (Arrow Up, Arrow Down, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredResults.length > 0 ? (prev + 1) % filteredResults.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredResults.length > 0 ? (prev - 1 + filteredResults.length) % filteredResults.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults.length > 0 && filteredResults[selectedIndex]) {
        handleSelectResult(filteredResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Action dispatcher when result is chosen
  const handleSelectResult = (item: GlobalSearchResult) => {
    onClose();

    switch (item.category) {
      case 'product':
        if (onSelectProductToCart) {
          onSelectProductToCart(item.rawItem);
        }
        if (onNavigateTab) {
          onNavigateTab('pos');
        }
        break;

      case 'transaction':
        if (onOpenReceiptModal) {
          onOpenReceiptModal(item.rawItem);
        } else if (onNavigateTab) {
          onNavigateTab('reports');
        }
        break;

      case 'ingredient':
        if (onNavigateTab) {
          onNavigateTab('inventory');
        }
        break;

      case 'fixed_asset':
        if (onNavigateTab) {
          onNavigateTab('cash_debt');
        }
        break;

      case 'draft_order':
        if (onNavigateTab) {
          onNavigateTab('pos');
        }
        break;

      case 'pre_order':
        if (onNavigateTab) {
          onNavigateTab('pre_order');
        }
        break;

      default:
        if (onNavigateTab) {
          onNavigateTab(item.targetTab);
        }
        break;
    }
  };

  const getCategoryIcon = (category: GlobalSearchResult['category']) => {
    switch (category) {
      case 'product':
        return <Coffee className="w-4 h-4 text-amber-500" />;
      case 'transaction':
        return <Receipt className="w-4 h-4 text-emerald-500" />;
      case 'ingredient':
        return <Layers className="w-4 h-4 text-blue-500" />;
      case 'fixed_asset':
        return <Wrench className="w-4 h-4 text-purple-500" />;
      case 'draft_order':
        return <Bookmark className="w-4 h-4 text-indigo-500" />;
      case 'pre_order':
        return <CalendarClock className="w-4 h-4 text-rose-500" />;
      default:
        return <Tag className="w-4 h-4 text-amber-500" />;
    }
  };

  const getCategoryBadgeClass = (category: GlobalSearchResult['category']) => {
    switch (category) {
      case 'product':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'transaction':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'ingredient':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'fixed_asset':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'draft_order':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'pre_order':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-stone-100 text-stone-900 border-stone-300';
    }
  };

  // Helper highlight function for matching query
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-300/80 text-[#2B1713] font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-16 px-3 sm:px-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Background click listener */}
      <div className="fixed inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-3xl bg-[#FAF3DD] text-[#2B1713] rounded-3xl shadow-2xl border-2 border-[#D4A373] overflow-hidden flex flex-col max-h-[85vh] z-10"
      >
        {/* Top Search Header Bar */}
        <div className="p-3.5 sm:p-4 bg-[#3E2723] text-[#FAF3DD] border-b border-[#5D4037] flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
            <Search className="w-5 h-5" />
          </div>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cari menu, nota transaksi, bahan baku, aset, draf, atau PO..."
              className="w-full bg-[#2B1713] text-[#FAF3DD] placeholder-[#A1887F] text-sm sm:text-base font-medium px-4 py-2.5 rounded-2xl border border-[#5D4037] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 transition-all pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1887F] hover:text-white p-1 rounded-lg"
                title="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 border border-amber-500/30 transition-colors shrink-0"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills (Horizontal Scroll) */}
        <div className="px-3.5 sm:px-4 py-2.5 bg-[#EBE3D5]/70 border-b border-[#D4A373]/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-[#5D4037] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Tag className="w-3 h-3" /> Filter:
          </span>

          {[
            { id: 'all' as SearchCategory, label: 'Semua', icon: Sparkles },
            { id: 'product' as SearchCategory, label: 'Menu / Produk', icon: Coffee },
            { id: 'transaction' as SearchCategory, label: 'Transaksi', icon: Receipt },
            { id: 'ingredient' as SearchCategory, label: 'Stok Bahan', icon: Layers },
            { id: 'fixed_asset' as SearchCategory, label: 'Aset Toko', icon: Wrench },
            { id: 'draft_order' as SearchCategory, label: 'Hold Bill', icon: Bookmark },
            { id: 'pre_order' as SearchCategory, label: 'Pre-Order', icon: CalendarClock },
          ].map((tab) => {
            const count = categoryCounts[tab.id];
            const isActive = selectedCategory === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-2xs ${
                  isActive
                    ? 'bg-[#3E2723] text-amber-200 ring-2 ring-amber-400/40 shadow-xs'
                    : 'bg-white hover:bg-[#FAF3DD] text-[#5D4037] border border-[#D4A373]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-[#795548]'}`} />
                <span>{tab.label}</span>
                {searchQuery.trim() !== '' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive ? 'bg-amber-400 text-[#2B1713]' : 'bg-[#D4A373]/30 text-[#3E2723]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Results Container */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 max-h-[55vh]"
        >
          {/* Empty Search Prompt */}
          {!searchQuery.trim() && (
            <div className="py-8 px-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-[#EBE3D5] text-[#795548] mx-auto flex items-center justify-center shadow-inner border border-[#D4A373]/40">
                <Search className="w-7 h-7 text-amber-700" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-base text-[#3E2723]">Pencarian Global Terpadu</h4>
                <p className="text-xs text-[#795548] max-w-md mx-auto leading-relaxed">
                  Ketik kata kunci untuk memindai seluruh data menu, struk nota, inventori bahan, aset peralatan, draf pesanan, hingga jadwal pre-order.
                </p>
              </div>

              {/* Quick suggestion chips */}
              <div className="pt-2">
                <div className="text-[11px] font-bold text-[#8D6E63] uppercase tracking-wider mb-2">
                  Saran Pencarian Cepat:
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
                  {['Kopi Susu', 'SQ-', 'Biji Kopi', 'Espresso Machine', 'Meja', 'PO-'].map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => {
                        setSearchQuery(keyword);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1 bg-white hover:bg-amber-100 text-[#3E2723] text-xs font-semibold rounded-xl border border-[#D4A373] transition-colors shadow-2xs"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* No Results Found */}
          {searchQuery.trim() !== '' && filteredResults.length === 0 && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center border border-amber-300">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[#3E2723]">Tidak ada data yang cocok</h4>
                <p className="text-xs text-[#795548]">
                  Tidak ditemukan hasil untuk "<span className="font-semibold text-[#2B1713]">{searchQuery}</span>"
                  {selectedCategory !== 'all' && ' pada filter kategori ini'}.
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="text-xs font-bold text-amber-800 hover:underline inline-flex items-center gap-1"
                >
                  Reset filter ke "Semua Kategori" <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Result Items List */}
          {filteredResults.map((item, index) => {
            const isSelected = index === selectedIndex;

            return (
              <div
                key={item.id}
                data-index={index}
                onClick={() => handleSelectResult(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                  isSelected
                    ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-400/40 translate-x-0.5'
                    : 'bg-white/80 hover:bg-white border-[#EBE3D5] shadow-2xs hover:border-[#D4A373]'
                }`}
              >
                {/* Category Icon Badge */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${getCategoryBadgeClass(
                    item.category
                  )} shadow-2xs mt-0.5`}
                >
                  {getCategoryIcon(item.category)}
                </div>

                {/* Content Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${getCategoryBadgeClass(
                          item.category
                        )}`}
                      >
                        {item.categoryLabel}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#2B1713] truncate">
                        {renderHighlightedText(item.title, searchQuery)}
                      </h4>
                    </div>

                    {/* Metadata Pill */}
                    {item.metadata.price !== undefined && (
                      <span className="font-mono font-bold text-xs sm:text-sm text-[#3E2723] shrink-0 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        {formatRp(item.metadata.price)}
                      </span>
                    )}
                    {item.metadata.totalAmount !== undefined && (
                      <span className="font-mono font-bold text-xs sm:text-sm text-emerald-800 shrink-0 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {formatRp(item.metadata.totalAmount)}
                      </span>
                    )}
                    {item.metadata.stock !== undefined && (
                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border shrink-0 ${
                          item.metadata.isCritical
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        {item.metadata.stock} {item.metadata.unit}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#5D4037] font-medium leading-tight line-clamp-1">
                    {renderHighlightedText(item.subtitle, searchQuery)}
                  </p>

                  {item.description && (
                    <p className="text-[11px] text-[#795548] line-clamp-1 italic">
                      {renderHighlightedText(item.description, searchQuery)}
                    </p>
                  )}

                  {/* Extra metadata tags (outlet, customer, status) */}
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap text-[10px] text-[#8D6E63]">
                    {item.metadata.outletName && (
                      <span className="flex items-center gap-1 bg-[#EBE3D5]/60 px-1.5 py-0.5 rounded font-medium">
                        <Store className="w-2.5 h-2.5 text-amber-700" />
                        {item.metadata.outletName}
                      </span>
                    )}
                    {item.metadata.status && (
                      <span className="bg-stone-200/80 text-stone-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        {item.metadata.status}
                      </span>
                    )}
                    {item.metadata.date && (
                      <span className="flex items-center gap-1 text-stone-500 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {item.metadata.date.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Arrow / Action hint */}
                <div className="shrink-0 self-center hidden sm:flex items-center pl-1 text-[#A1887F]">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-amber-600 text-white' : 'bg-[#EBE3D5]/50 text-[#795548]'
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer with Keyboard Navigation Hints */}
        <div className="p-3 bg-[#EBE3D5] text-[#5D4037] border-t border-[#D4A373]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D4A373] rounded font-mono text-[10px] shadow-2xs font-bold text-[#2B1713]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D4A373] rounded font-mono text-[10px] shadow-2xs font-bold text-[#2B1713]">
                ↓
              </kbd>
              <span>Navigasi</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D4A373] rounded font-mono text-[10px] shadow-2xs font-bold text-[#2B1713] flex items-center gap-0.5">
                <CornerDownLeft className="w-2.5 h-2.5" /> Enter
              </kbd>
              <span>Buka Menu / Detail</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D4A373] rounded font-mono text-[10px] shadow-2xs font-bold text-[#2B1713]">
                ESC
              </kbd>
              <span>Tutup</span>
            </span>
          </div>

          <div className="text-[10px] text-[#795548] font-bold">
            {filteredResults.length} hasil ditemukan
          </div>
        </div>
      </motion.div>
    </div>
  );
};
