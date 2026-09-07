/**
 * Inventory Automation Service
 * Handles automatic raw material stock updates, HPP / unit cost recalculation,
 * and purchase audit trails from Cash Ledger / Operational Expenses.
 */
import { Ingredient, BranchInventoryItem, PurchaseOrder, CashLedger, StockOpname } from '../types';
import { StorageService } from './storage';

export interface RawMaterialPurchaseParams {
  outletId: string;
  outletName?: string;
  ingredientId: string;
  quantity: number; // Jumlah pembelian dalam satuan dasar (gram, ml, pcs, dll)
  totalCost: number; // Total nominal belanja kas
  recordedBy: string;
  date?: string;
  paymentMethod?: string;
  notes?: string;
  ledgerId?: string;
}

export interface PurchaseStockResult {
  success: boolean;
  message: string;
  ingredient?: Ingredient;
  branchItem?: BranchInventoryItem;
  previousStock: number;
  newStock: number;
  unitCost: number;
  previousUnitCost: number;
}

export class InventoryService {
  /**
   * Automatically process raw material purchase from Cash Ledger / Expense Outflow.
   * Updates physical stock for the specific outlet and recalculates HPP / unit cost.
   */
  static processPurchaseFromCashExpense(params: RawMaterialPurchaseParams): PurchaseStockResult {
    const {
      outletId,
      outletName = 'Cabang Aktif',
      ingredientId,
      quantity,
      totalCost,
      recordedBy,
      date = new Date().toISOString().split('T')[0],
      notes = 'Pembelian dari Pengeluaran Kas',
      ledgerId,
    } = params;

    if (!ingredientId || quantity <= 0 || totalCost < 0) {
      return {
        success: false,
        message: 'Data bahan baku, jumlah pembelian, atau nominal tidak valid.',
        previousStock: 0,
        newStock: 0,
        unitCost: 0,
        previousUnitCost: 0,
      };
    }

    // 1. Get Master Ingredients
    const masterIngredients = StorageService.getIngredients();
    const targetIngredient = masterIngredients.find((i) => i.id === ingredientId);

    if (!targetIngredient) {
      return {
        success: false,
        message: `Bahan baku dengan ID ${ingredientId} tidak ditemukan di inventori.`,
        previousStock: 0,
        newStock: 0,
        unitCost: 0,
        previousUnitCost: 0,
      };
    }

    const previousMasterStock = targetIngredient.currentStock;
    const previousMasterUnitCost = targetIngredient.costPerUnit || 0;
    const newPurchaseUnitCost = Math.round(totalCost / quantity);

    // Calculate moving weighted average cost for HPP:
    // If existing stock > 0, compute weighted average; otherwise use the new purchase unit cost.
    let updatedCostPerUnit = newPurchaseUnitCost;
    if (previousMasterStock > 0 && previousMasterUnitCost > 0) {
      const totalOldValue = previousMasterStock * previousMasterUnitCost;
      const totalNewValue = totalCost;
      const combinedStock = previousMasterStock + quantity;
      updatedCostPerUnit = Math.round((totalOldValue + totalNewValue) / combinedStock);
    }

    // 2. Update Branch Inventory specifically for this outlet
    const branchInventory = StorageService.getBranchInventory();
    let branchItemIndex = branchInventory.findIndex(
      (bi) => bi.outletId === outletId && bi.ingredientId === ingredientId
    );

    let prevBranchStock = 0;
    let newBranchStock = quantity;

    if (branchItemIndex !== -1) {
      prevBranchStock = branchInventory[branchItemIndex].currentStock;
      newBranchStock = prevBranchStock + quantity;
      branchInventory[branchItemIndex].currentStock = newBranchStock;
      branchInventory[branchItemIndex].costPerUnit = updatedCostPerUnit;
      branchInventory[branchItemIndex].lastUpdated = new Date().toISOString();
      if (outletName && !branchInventory[branchItemIndex].outletName) {
        branchInventory[branchItemIndex].outletName = outletName;
      }
    } else {
      // Create branch item record if not present
      const newBranchItem: BranchInventoryItem = {
        id: `bi-${outletId}-${ingredientId}`,
        outletId,
        outletName,
        ingredientId: targetIngredient.id,
        ingredientName: targetIngredient.name,
        unit: targetIngredient.unit,
        costPerUnit: updatedCostPerUnit,
        currentStock: quantity,
        minStock: targetIngredient.minStock || 10,
        category: targetIngredient.category,
        lastUpdated: new Date().toISOString(),
      };
      branchInventory.push(newBranchItem);
      branchItemIndex = branchInventory.length - 1;
    }

    // Save updated branch inventory
    StorageService.saveBranchInventory(branchInventory);

    // 3. Update Master Ingredient Stock & Cost Per Unit
    targetIngredient.currentStock = previousMasterStock + quantity;
    targetIngredient.costPerUnit = updatedCostPerUnit;
    StorageService.saveIngredients(masterIngredients);

    // 4. Create Purchase Order audit record
    const purchaseNo = `PO-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    const purchaseRecord: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNo: purchaseNo,
      supplierId: 'cash-expense',
      supplierName: `Belanja Kasir (${outletName})`,
      date,
      ingredientId: targetIngredient.id,
      ingredientName: targetIngredient.name,
      quantity,
      unitCost: newPurchaseUnitCost,
      totalCost,
      notes: `${notes}${ledgerId ? ` [Ref: ${ledgerId}]` : ''} - Dicatat oleh ${recordedBy}`,
      outletId,
      outletName,
    };

    // Save purchase order to history
    const currentPurchases = StorageService.getPurchases();
    currentPurchases.unshift(purchaseRecord);
    StorageService.savePurchases(currentPurchases);

    // 5. Create Stock Mutation / Audit Log (Stock Opname record with positive adjustment)
    const auditRecord: StockOpname = {
      id: `so-${Date.now()}`,
      date,
      outletId,
      outletName,
      ingredientId: targetIngredient.id,
      ingredientName: targetIngredient.name,
      systemStock: prevBranchStock,
      actualStock: newBranchStock,
      difference: quantity,
      reason: 'Lainnya',
      adjustedBy: `${recordedBy} (Kas Keluar: ${purchaseNo})`,
    };

    const currentOpnames = StorageService.getStockOpnames();
    currentOpnames.unshift(auditRecord);
    StorageService.saveStockOpnames(currentOpnames);

    return {
      success: true,
      message: `Stok ${targetIngredient.name} berhasil ditambah +${quantity} ${targetIngredient.unit} untuk ${outletName}. HPP diperbarui menjadi Rp ${updatedCostPerUnit.toLocaleString('id-ID')}/${targetIngredient.unit}.`,
      ingredient: targetIngredient,
      branchItem: branchInventory[branchItemIndex],
      previousStock: prevBranchStock,
      newStock: newBranchStock,
      unitCost: updatedCostPerUnit,
      previousUnitCost: previousMasterUnitCost,
    };
  }

  /**
   * Get available stock for a specific ingredient at an outlet
   */
  static getIngredientStockForOutlet(outletId: string, ingredientId: string): number {
    const branchInv = StorageService.getBranchInventory();
    const item = branchInv.find((bi) => bi.outletId === outletId && bi.ingredientId === ingredientId);
    if (item) return item.currentStock;

    const master = StorageService.getIngredients().find((i) => i.id === ingredientId);
    return master ? master.currentStock : 0;
  }
}
