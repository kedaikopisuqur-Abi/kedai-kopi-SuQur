/**
 * Google Apps Script Webhook Service for Google Sheets
 */

export interface SyncTransactionResult {
  success: boolean;
  message?: string;
  error?: any;
}

export const syncTransactionToGoogleSheet = async (
  webhookUrl: string,
  transactionData: any
): Promise<SyncTransactionResult> => {
  if (!webhookUrl || !webhookUrl.startsWith("https://script.google.com")) {
    return { success: false, message: "URL Webhook Google Sheets belum diatur." };
  }

  try {
    // Generate unified payload ensuring both snake_case and camelCase for Apps Script columns
    const itemsSummary = transactionData.items
      ? transactionData.items.map((i: any) => `${i.productName || i.name} (${i.quantity}x)`).join(', ')
      : '';

    const payload = {
      ...transactionData,
      action: 'NEW_TRANSACTION',
      // Multi-Outlet properties
      outlet_id: transactionData.outletId || transactionData.outlet_id || 'outlet-utama',
      outlet_name: transactionData.outletName || transactionData.outlet_name || 'Kedai Kopi Wahid',
      outletId: transactionData.outletId || transactionData.outlet_id || 'outlet-utama',
      outletName: transactionData.outletName || transactionData.outlet_name || 'Kedai Kopi Wahid',
      // Snake_case aliases for easy Google Apps Script spreadsheet mapping
      invoice_no: transactionData.invoiceNo || transactionData.id,
      cashier_name: transactionData.cashierName || transactionData.cashierId,
      customer_name: transactionData.customerName || 'Umum',
      payment_method: transactionData.paymentMethod || 'cash',
      order_type: transactionData.orderType || 'dine_in',
      total_cogs: transactionData.totalCogs || 0,
      gross_profit: transactionData.grossProfit || (transactionData.total - (transactionData.totalCogs || 0)),
      items_summary: itemsSummary,
    };

    // Menggunakan no-cors karena Apps Script merespons dengan redirect
    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return { success: true };
  } catch (error) {
    console.error("Gagal sinkronkan ke Google Sheets:", error);
    return { success: false, error };
  }
};

// Re-export all Google Sheets OAuth utilities for convenience
export * from './googleSheetsService';

