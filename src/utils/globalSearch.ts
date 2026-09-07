import { StorageService } from '../services/storage';
import {
  Product,
  Transaction,
  Ingredient,
  FixedAsset,
  DraftOrder,
  PreOrder,
  NavTab,
} from '../types';
import { formatRp, formatDate, formatDateTime, getPaymentMethodLabel } from './formatters';

export type SearchCategory =
  | 'all'
  | 'product'
  | 'transaction'
  | 'ingredient'
  | 'fixed_asset'
  | 'draft_order'
  | 'pre_order';

export interface GlobalSearchResult {
  id: string;
  category: 'product' | 'transaction' | 'ingredient' | 'fixed_asset' | 'draft_order' | 'pre_order';
  categoryLabel: string;
  categoryColor: 'amber' | 'emerald' | 'blue' | 'purple' | 'indigo' | 'rose' | 'stone';
  title: string;
  subtitle: string;
  description?: string;
  matchedFields: string[];
  targetTab: NavTab;
  metadata: {
    price?: number;
    stock?: number;
    unit?: string;
    date?: string;
    status?: string;
    outletName?: string;
    customerName?: string;
    phone?: string;
    tableNumber?: string;
    totalAmount?: number;
    depositAmount?: number;
    remainingBalance?: number;
    isCritical?: boolean;
    itemCount?: number;
  };
  rawItem: Product | Transaction | Ingredient | FixedAsset | DraftOrder | PreOrder;
  score: number;
}

export interface SearchOptions {
  outletId?: string;
  maxResultsPerCategory?: number;
  categoryFilter?: SearchCategory;
  isAdmin?: boolean;
}

export class GlobalSearchEngine {
  /**
   * Search all entities across products, transactions, ingredients, fixed assets, drafts, and pre-orders
   */
  public static searchAll(query: string, options: SearchOptions = {}): GlobalSearchResult[] {
    const rawQuery = (query || '').trim();
    if (!rawQuery) {
      return [];
    }

    const tokens = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const effectiveOutletId = options.outletId && options.outletId !== 'ALL' ? options.outletId : undefined;
    const maxPerCat = options.maxResultsPerCategory || 25;
    const categoryFilter = options.categoryFilter || 'all';
    const isAdmin = options.isAdmin !== false;

    const results: GlobalSearchResult[] = [];

    // Helper: matches all tokens
    const matchAllTokens = (fields: (string | number | undefined | null)[]): { matched: boolean; score: number; matchedFields: string[] } => {
      const stringFields = fields
        .filter((f): f is string | number => f !== undefined && f !== null)
        .map((f) => String(f).toLowerCase());

      let totalScore = 0;
      const matchedFieldNames: string[] = [];

      for (const token of tokens) {
        let tokenFound = false;
        for (let i = 0; i < stringFields.length; i++) {
          const val = stringFields[i];
          if (val === token) {
            tokenFound = true;
            totalScore += 20; // exact match
            matchedFieldNames.push(val);
          } else if (val.startsWith(token)) {
            tokenFound = true;
            totalScore += 12; // prefix match
            matchedFieldNames.push(val);
          } else if (val.includes(token)) {
            tokenFound = true;
            totalScore += 6; // substring match
            matchedFieldNames.push(val);
          }
        }
        if (!tokenFound) {
          return { matched: false, score: 0, matchedFields: [] };
        }
      }

      return { matched: true, score: totalScore, matchedFields: Array.from(new Set(matchedFieldNames)) };
    };

    // 1. PRODUK / MENU
    if (categoryFilter === 'all' || categoryFilter === 'product') {
      try {
        const products = StorageService.getProducts();
        let count = 0;

        for (const p of products) {
          const variantNames = (p.variants || []).map((v) => v.name).join(' ');
          const searchFields = [
            p.name,
            p.category,
            p.description,
            variantNames,
            String(p.price),
            `${p.price / 1000}k`,
          ];

          const match = matchAllTokens(searchFields);
          if (match.matched) {
            results.push({
              id: `prod_${p.id}`,
              category: 'product',
              categoryLabel: 'Menu / Produk',
              categoryColor: 'amber',
              title: p.name,
              subtitle: `${p.category} • ${formatRp(p.price)}`,
              description: p.description || (p.variants && p.variants.length > 0 ? `Varian: ${p.variants.map((v) => v.name).join(', ')}` : undefined),
              matchedFields: match.matchedFields,
              targetTab: 'pos',
              metadata: {
                price: p.price,
                status: p.isAvailable ? 'Tersedia' : 'Kosong',
              },
              rawItem: p,
              score: match.score + 10,
            });
            count++;
            if (count >= maxPerCat) break;
          }
        }
      } catch (err) {
        console.error('Error searching products:', err);
      }
    }

    // 2. RIWAYAT TRANSAKSI / NOTA
    if (categoryFilter === 'all' || categoryFilter === 'transaction') {
      try {
        const txs = StorageService.getTransactions();
        let count = 0;

        for (const tx of txs) {
          // Check outlet filter
          if (effectiveOutletId && tx.outletId && tx.outletId !== 'ALL' && tx.outletId !== effectiveOutletId) {
            continue;
          }

          const itemNames = (tx.items || []).map((i) => `${i.productName} ${i.variantName || ''} ${i.notes || ''}`).join(' ');
          const searchFields = [
            tx.invoiceNo,
            tx.queueNo,
            tx.customerName,
            tx.customerPhone,
            tx.tableNo ? `Meja ${tx.tableNo}` : '',
            tx.onlineOrderNo,
            tx.driverName,
            tx.cashierName,
            getPaymentMethodLabel(tx.paymentMethod),
            tx.paymentMethod,
            itemNames,
            String(tx.total),
            tx.timestamp ? formatDate(tx.timestamp) : '',
          ];

          const match = matchAllTokens(searchFields);
          if (match.matched) {
            const customerStr = tx.customerName ? ` • ${tx.customerName}` : '';
            const tableStr = tx.tableNo ? ` (Meja ${tx.tableNo})` : '';
            const platformStr = tx.onlinePlatform ? ` [${tx.onlinePlatform}]` : '';

            results.push({
              id: `tx_${tx.id}`,
              category: 'transaction',
              categoryLabel: 'Nota / Transaksi',
              categoryColor: 'emerald',
              title: `${tx.invoiceNo}${customerStr}${tableStr}${platformStr}`,
              subtitle: `${formatDate(tx.timestamp)} • ${formatRp(tx.total)} (${getPaymentMethodLabel(tx.paymentMethod)})`,
              description: tx.items && tx.items.length > 0
                ? `${tx.items.length} item: ${tx.items.map((i) => `${i.quantity}x ${i.productName}`).slice(0, 3).join(', ')}${tx.items.length > 3 ? '...' : ''}`
                : undefined,
              matchedFields: match.matchedFields,
              targetTab: 'reports',
              metadata: {
                totalAmount: tx.total,
                date: tx.timestamp,
                customerName: tx.customerName,
                status: tx.status === 'voided' ? 'Dibatalkan (Void)' : 'Selesai',
                outletName: tx.outletName,
                itemCount: tx.items?.length || 0,
              },
              rawItem: tx,
              score: match.score + (tx.invoiceNo.toLowerCase().includes(rawQuery.toLowerCase()) ? 15 : 5),
            });
            count++;
            if (count >= maxPerCat) break;
          }
        }
      } catch (err) {
        console.error('Error searching transactions:', err);
      }
    }

    // 3. STOK BAHAN BAKU & RESEP
    if (categoryFilter === 'all' || categoryFilter === 'ingredient') {
      try {
        const ingredients = StorageService.getIngredients();
        let count = 0;

        for (const ing of ingredients) {
          if (effectiveOutletId && ing.outletId && ing.outletId !== 'ALL' && ing.outletId !== effectiveOutletId) {
            continue;
          }

          const isCritical = ing.currentStock <= (ing.minStock || 0);
          const searchFields = [
            ing.name,
            ing.category,
            ing.unit,
            ing.outletName,
            isCritical ? 'kritis habis restock' : 'aman',
            String(ing.currentStock),
          ];

          const match = matchAllTokens(searchFields);
          if (match.matched) {
            results.push({
              id: `ing_${ing.id}`,
              category: 'ingredient',
              categoryLabel: 'Stok Bahan Baku',
              categoryColor: 'blue',
              title: ing.name,
              subtitle: `Kategori: ${ing.category} • Sisa: ${ing.currentStock.toLocaleString('id-ID')} ${ing.unit} (Min: ${ing.minStock} ${ing.unit})`,
              description: isAdmin
                ? `HPP: ${formatRp(ing.costPerUnit)}/${ing.unit}${isCritical ? ' • ⚠️ PERINGATAN STOK KRITIS' : ''}`
                : isCritical ? '⚠️ PERINGATAN STOK KRITIS' : 'Stok Tersedia',
              matchedFields: match.matchedFields,
              targetTab: 'inventory',
              metadata: {
                stock: ing.currentStock,
                unit: ing.unit,
                price: isAdmin ? ing.costPerUnit : undefined,
                isCritical,
                outletName: ing.outletName,
              },
              rawItem: ing,
              score: match.score + 8,
            });
            count++;
            if (count >= maxPerCat) break;
          }
        }
      } catch (err) {
        console.error('Error searching ingredients:', err);
      }
    }

    // 4. ASET TOKO & PERALATAN (CAPEX)
    if (categoryFilter === 'all' || categoryFilter === 'fixed_asset') {
      try {
        const fixedAssets = StorageService.getFixedAssets(effectiveOutletId);
        let count = 0;

        for (const asset of fixedAssets) {
          const searchFields = [
            asset.assetName,
            asset.category,
            asset.supplier,
            asset.notes,
            asset.maintenanceNotes,
            asset.purchaseDate ? formatDate(asset.purchaseDate) : '',
            isAdmin ? String(asset.purchasePrice) : '',
            asset.outletName,
          ];

          const match = matchAllTokens(searchFields);
          if (match.matched) {
            results.push({
              id: `asset_${asset.id}`,
              category: 'fixed_asset',
              categoryLabel: 'Aset Toko / CAPEX',
              categoryColor: 'purple',
              title: asset.assetName,
              subtitle: isAdmin
                ? `Kategori: ${asset.category} • Beli: ${formatRp(asset.purchasePrice)} (${formatDate(asset.purchaseDate)})`
                : `Kategori: ${asset.category} • Tgl Beli: ${formatDate(asset.purchaseDate)}`,
              description: asset.notes || (asset.maintenanceNotes ? `Catatan Servis: ${asset.maintenanceNotes}` : undefined),
              matchedFields: match.matchedFields,
              targetTab: 'cash_debt',
              metadata: {
                price: isAdmin ? asset.purchasePrice : undefined,
                date: asset.purchaseDate,
                outletName: asset.outletName,
              },
              rawItem: asset,
              score: match.score + 6,
            });
            count++;
            if (count >= maxPerCat) break;
          }
        }
      } catch (err) {
        console.error('Error searching fixed assets:', err);
      }
    }

    // 5. DRAF PESANAN (HOLD BILL)
    if (categoryFilter === 'all' || categoryFilter === 'draft_order') {
      try {
        const draftOrders = StorageService.getDraftOrders(effectiveOutletId);
        let count = 0;

        for (const draft of draftOrders) {
          if (draft.status !== 'DRAFT') continue;

          const itemNames = (draft.items || []).map((i) => i.product.name).join(' ');
          const searchFields = [
            draft.customerName,
            draft.customerPhone,
            draft.draftNo,
            draft.tableNumber ? `Meja ${draft.tableNumber}` : '',
            draft.notes,
            itemNames,
            String(draft.total),
            draft.cashierName,
          ];

          const match = matchAllTokens(searchFields);
          if (match.matched) {
            const tableStr = draft.tableNumber ? ` • Meja ${draft.tableNumber}` : '';
            results.push({
              id: `draft_${draft.id}`,
              category: 'draft_order',
              categoryLabel: 'Hold Bill / Draf',
              categoryColor: 'indigo',
              title: `Draf: ${draft.customerName || 'Pelanggan Tanpa Nama'}${tableStr}`,
              subtitle: `${draft.items.length} Menu • Total: ${formatRp(draft.total)} • Dibuat: ${formatDateTime(draft.createdAt)}`,
              description: draft.items && draft.items.length > 0
                ? `Pesanan: ${draft.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ')}`
                : undefined,
              matchedFields: match.matchedFields,
              targetTab: 'pos',
              metadata: {
                totalAmount: draft.total,
                customerName: draft.customerName,
                tableNumber: draft.tableNumber,
                itemCount: draft.items.length,
                date: draft.createdAt,
              },
              rawItem: draft,
              score: match.score + 7,
            });
            count++;
            if (count >= maxPerCat) break;
          }
        }
      } catch (err) {
        console.error('Error searching draft orders:', err);
      }
    }

    // 6. PRE-ORDER & RESERVASI JADWAL
    if (categoryFilter === 'all' || categoryFilter === 'pre_order') {
      try {
        const preOrders = StorageService.getPreOrders(effectiveOutletId);
        let count = 0;

        for (const po of preOrders) {
          const itemNames = (po.items || []).map((i) => i.product.name).join(' ');
          const searchFields = [
            po.poNumber,
            po.customerName,
            po.customerPhone,
            po.tableNumber ? `Meja ${po.tableNumber}` : '',
            po.deliveryAddress,
            po.notes,
            po.scheduledDate ? formatDate(po.scheduledDate) : '',
            po.scheduledDate,
            po.scheduledTime,
            po.orderType,
            po.orderStatus,
            po.paymentStatus,
            itemNames,
            String(po.totalAmount),
          ];

          const match = matchAllTokens(searchFields);
          if (match.matched) {
            const statusLabel =
              po.orderStatus === 'SCHEDULED' ? 'Terjadwal' :
              po.orderStatus === 'IN_PREPARATION' ? 'Sedang Diproses' :
              po.orderStatus === 'READY' ? 'Siap Diambil' :
              po.orderStatus === 'COMPLETED' ? 'Selesai' : 'Dibatalkan';

            results.push({
              id: `po_${po.id}`,
              category: 'pre_order',
              categoryLabel: 'Pre-Order & Reservasi',
              categoryColor: 'rose',
              title: `${po.poNumber || 'PO'}: ${po.customerName} (${po.customerPhone})`,
              subtitle: `Jadwal: ${formatDate(po.scheduledDate)} ${po.scheduledTime} WIB • Total: ${formatRp(po.totalAmount)} (DP: ${formatRp(po.depositAmount)})`,
              description: `Status: ${statusLabel} • ${po.items.length} item: ${po.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ')}`,
              matchedFields: match.matchedFields,
              targetTab: 'pre_order',
              metadata: {
                totalAmount: po.totalAmount,
                depositAmount: po.depositAmount,
                remainingBalance: po.remainingBalance,
                customerName: po.customerName,
                phone: po.customerPhone,
                date: `${po.scheduledDate} ${po.scheduledTime}`,
                status: statusLabel,
                itemCount: po.items.length,
              },
              rawItem: po,
              score: match.score + 9,
            });
            count++;
            if (count >= maxPerCat) break;
          }
        }
      } catch (err) {
        console.error('Error searching pre-orders:', err);
      }
    }

    // Sort results by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }
}
