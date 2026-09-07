import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Transaction, Product, Expense, PurchaseOrder, Ingredient, CashLedger } from '../types';
import {
  executeResilientGoogleSignIn,
  signInViaGsi,
  GoogleUserProfile,
  isUnauthorizedDomainError,
  getDomainAuthInfo,
} from './googleAuthHelper';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUserProfile: GoogleUserProfile | null = null;

/**
 * Initialize Google Auth listener and token cache
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (cachedUserProfile && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(cachedUserProfile, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        cachedUserProfile = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Sign in with resilient Google Auth (Firebase Popup with seamless GSI fallback)
 */
export const googleSignIn = async (
  preferGsi = false
): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = preferGsi
      ? await signInViaGsi(SHEETS_SCOPES)
      : await executeResilientGoogleSignIn(SHEETS_SCOPES);
    cachedAccessToken = result.accessToken;
    cachedUserProfile = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error saat login Google Sheets:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current Google OAuth Access Token
 */
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Sign out Google Account
 */
export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {}
  cachedAccessToken = null;
  cachedUserProfile = null;
};

// --- Google Sheets REST API Utilities ---

/**
 * Find or create Google Spreadsheet with title "Suqur POS - Data Laporan & Stok"
 */
export const getOrCreateSpreadsheet = async (
  accessToken: string,
  title = 'Suqur POS - Data Laporan & Stok'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  // 1. Search existing files in Drive
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and name='${title}' and trashed=false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const file = searchData.files[0];
      return {
        spreadsheetId: file.id,
        spreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
      };
    }
  }

  // 2. Create new spreadsheet if not found
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Laporan Transaksi' } },
        { properties: { title: 'Daftar Produk & Menu' } },
        { properties: { title: 'Bahan Baku & HPP Resep' } },
        { properties: { title: 'Buku Kas & Arus Kas' } },
        { properties: { title: 'Pengeluaran & PO' } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat Google Spreadsheet baru: ${errText}`);
  }

  const newSheet = await createRes.json();
  return {
    spreadsheetId: newSheet.spreadsheetId,
    spreadsheetUrl: newSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newSheet.spreadsheetId}/edit`,
  };
};

/**
 * Ensure sheet tab exists in spreadsheet
 */
const ensureSheetTab = async (accessToken: string, spreadsheetId: string, sheetTitle: string) => {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      const exists = data.sheets?.some((s: any) => s.properties?.title === sheetTitle);
      if (!exists) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: { title: sheetTitle },
                },
              },
            ],
          }),
        });
      }
    }
  } catch (e) {
    console.warn('Notice ensuring sheet tab:', e);
  }
};

/**
 * Sync Transactions to "Laporan Transaksi" tab
 */
export const exportTransactionsToSheets = async (
  accessToken: string,
  spreadsheetId: string,
  transactions: Transaction[]
): Promise<boolean> => {
  await ensureSheetTab(accessToken, spreadsheetId, 'Laporan Transaksi');

  const rows: any[][] = [
    ['No. Invoice / ID', 'Tanggal & Waktu', 'Kasir', 'Metode Bayar', 'Detail Items', 'Diskon (Rp)', 'Pajak (Rp)', 'Total (Rp)', 'Laba Kotor (Rp)'],
  ];

  transactions.forEach((tx) => {
    const dateStr = new Date(tx.timestamp).toLocaleString('id-ID');
    const itemsStr = tx.items ? tx.items.map((it) => `${it.quantity}x ${it.productName}${it.variantName ? ' (' + it.variantName + ')' : ''}`).join('; ') : '-';
    rows.push([
      tx.invoiceNo || tx.id,
      dateStr,
      tx.cashierName || 'Kasir',
      tx.paymentMethod?.toUpperCase() || 'CASH',
      itemsStr,
      tx.discount || 0,
      tx.tax || 0,
      tx.total || 0,
      tx.grossProfit || 0,
    ]);
  });

  const range = `'Laporan Transaksi'!A1:I${rows.length + 10}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Error exporting transactions to Sheets:', err);
    throw new Error('Gagal mengeksport transaksi ke Google Sheets.');
  }

  return true;
};

/**
 * Auto-append a single transaction row to "Laporan Transaksi" in Google Sheets
 */
export const appendSingleTransactionToSheets = async (
  tx: Transaction,
  tokenOverride?: string
): Promise<boolean> => {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    return false;
  }

  try {
    const { spreadsheetId } = await getOrCreateSpreadsheet(token);
    await ensureSheetTab(token, spreadsheetId, 'Laporan Transaksi');

    // Check if headers exist, if not initialize headers
    const checkHeaderRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Laporan Transaksi'!A1:I1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (checkHeaderRes.ok) {
      const headerData = await checkHeaderRes.json();
      if (!headerData.values || headerData.values.length === 0) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Laporan Transaksi'!A1:I1?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: "'Laporan Transaksi'!A1:I1",
              majorDimension: 'ROWS',
              values: [
                ['No. Invoice / ID', 'Tanggal & Waktu', 'Kasir', 'Metode Bayar', 'Detail Items', 'Diskon (Rp)', 'Pajak (Rp)', 'Total (Rp)', 'Laba Kotor (Rp)'],
              ],
            }),
          }
        );
      }
    }

    const dateStr = new Date(tx.timestamp).toLocaleString('id-ID');
    const itemsStr = tx.items ? tx.items.map((it) => `${it.quantity}x ${it.productName}${it.variantName ? ' (' + it.variantName + ')' : ''}`).join('; ') : '-';

    const row = [
      tx.invoiceNo || tx.id,
      dateStr,
      tx.cashierName || 'Kasir',
      tx.paymentMethod?.toUpperCase() || 'CASH',
      itemsStr,
      tx.discount || 0,
      tx.tax || 0,
      tx.total || 0,
      tx.grossProfit || 0,
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Laporan Transaksi'!A:I:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: "'Laporan Transaksi'!A:I",
          majorDimension: 'ROWS',
          values: [row],
        }),
      }
    );

    if (appendRes.ok) {
      console.log('✅ [Google Sheets Auto-Sync] Transaksi berhasil disinkronkan ke Google Sheets:', tx.id);
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [Google Sheets Auto-Sync] Gagal auto-export transaksi:', err);
  }
  return false;
};

/**
 * Sync Products & Menu to "Daftar Produk & Stok" tab
 */
export const exportProductsToSheets = async (
  accessToken: string,
  spreadsheetId: string,
  products: Product[]
): Promise<boolean> => {
  await ensureSheetTab(accessToken, spreadsheetId, 'Daftar Produk & Stok');

  const rows: any[][] = [
    ['ID Produk', 'Nama Produk', 'Kategori', 'Harga Jual (Rp)', 'HPP Modal (Rp)', 'Status Ketersediaan'],
  ];

  products.forEach((p) => {
    rows.push([
      p.id,
      p.name,
      p.category || 'Kopi Espresso',
      p.price || 0,
      p.cogs || 0,
      p.isAvailable ? 'Tersedia / Aktif' : 'Tidak Aktif / Habis',
    ]);
  });

  const range = `'Daftar Produk & Stok'!A1:F${rows.length + 10}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Error exporting products to Sheets:', err);
    throw new Error('Gagal mengeksport daftar produk ke Google Sheets.');
  }

  return true;
};

/**
 * Sync Expenses & Purchase Orders to "Pengeluaran & PO" tab
 */
export const exportExpensesToSheets = async (
  accessToken: string,
  spreadsheetId: string,
  expenses: Expense[],
  purchases: PurchaseOrder[]
): Promise<boolean> => {
  await ensureSheetTab(accessToken, spreadsheetId, 'Pengeluaran & PO');

  const rows: any[][] = [
    ['Tipe Record', 'No. Ref / ID', 'Tanggal', 'Kategori / Supplier', 'Keterangan / Bahan Baku', 'Jumlah / Total (Rp)', 'Dicatat Oleh'],
  ];

  expenses.forEach((e) => {
    const dateStr = new Date(e.date).toLocaleString('id-ID');
    rows.push([
      'PENGELUARAN',
      e.expenseNo || e.id,
      dateStr,
      e.category || 'Operasional',
      e.description || '-',
      e.amount || 0,
      e.recordedBy || '-',
    ]);
  });

  purchases.forEach((po) => {
    const dateStr = new Date(po.date).toLocaleString('id-ID');
    rows.push([
      'PURCHASE ORDER (PO)',
      po.poNo || po.id,
      dateStr,
      po.supplierName || 'Supplier',
      `${po.quantity} (${po.ingredientName})`,
      po.totalCost || 0,
      '-',
    ]);
  });

  const range = `'Pengeluaran & PO'!A1:G${rows.length + 10}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Error exporting expenses to Sheets:', err);
    throw new Error('Gagal mengeksport pengeluaran ke Google Sheets.');
  }

  return true;
};

/**
 * Sync Raw Ingredients & Recipe HPP to "Bahan Baku & HPP Resep" tab
 */
export const exportIngredientsAndHppToSheets = async (
  accessToken: string,
  spreadsheetId: string,
  ingredients: Ingredient[]
): Promise<boolean> => {
  await ensureSheetTab(accessToken, spreadsheetId, 'Bahan Baku & HPP Resep');

  const rows: any[][] = [
    ['ID Bahan', 'Nama Bahan Baku', 'Satuan', 'HPP / Biaya per Satuan (Rp)', 'Stok Saat Ini', 'Stok Minimum', 'Total Nilai Aset Stok (Rp)'],
  ];

  ingredients.forEach((ing) => {
    const totalAssetValue = (ing.costPerUnit || 0) * (ing.currentStock || 0);
    rows.push([
      ing.id,
      ing.name,
      ing.unit || 'gram',
      ing.costPerUnit || 0,
      ing.currentStock || 0,
      ing.minStock || 0,
      totalAssetValue,
    ]);
  });

  const range = `'Bahan Baku & HPP Resep'!A1:G${rows.length + 10}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Error exporting ingredients & HPP to Sheets:', err);
    throw new Error('Gagal mengeksport bahan baku & HPP ke Google Sheets.');
  }

  return true;
};

/**
 * Sync Cash Ledger & Cashflow to "Buku Kas & Arus Kas" tab
 */
export const exportCashLedgersToSheets = async (
  accessToken: string,
  spreadsheetId: string,
  cashLedgers: CashLedger[]
): Promise<boolean> => {
  await ensureSheetTab(accessToken, spreadsheetId, 'Buku Kas & Arus Kas');

  const rows: any[][] = [
    ['ID Kas', 'Tanggal', 'Tipe (IN/OUT)', 'Kategori', 'Nominal (Rp)', 'Metode Bayar', 'Cabang / Outlet', 'Keterangan', 'Dicatat Oleh'],
  ];

  cashLedgers.forEach((cl) => {
    rows.push([
      cl.id,
      cl.date,
      cl.type === 'IN' ? 'KAS MASUK (IN)' : 'KAS KELUAR (OUT)',
      cl.category || 'Operasional',
      cl.amount || 0,
      cl.paymentMethod || 'CASH',
      cl.outletName || 'Pusat',
      cl.description || '-',
      cl.createdBy || 'Kasir / Admin',
    ]);
  });

  const range = `'Buku Kas & Arus Kas'!A1:I${rows.length + 10}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Error exporting cash ledgers to Sheets:', err);
    throw new Error('Gagal mengeksport buku kas ke Google Sheets.');
  }

  return true;
};

/**
 * Full Sync All Master Data (Transactions, Products, Ingredients/HPP, Cash Ledgers, Expenses) to Google Sheets
 */
export const syncAllToGoogleSheets = async (
  accessToken: string,
  data: {
    transactions: Transaction[];
    products: Product[];
    ingredients?: Ingredient[];
    cashLedgers?: CashLedger[];
    expenses: Expense[];
    purchases: PurchaseOrder[];
  }
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const { spreadsheetId, spreadsheetUrl } = await getOrCreateSpreadsheet(accessToken);

  await exportTransactionsToSheets(accessToken, spreadsheetId, data.transactions);
  await exportProductsToSheets(accessToken, spreadsheetId, data.products);
  if (data.ingredients && data.ingredients.length > 0) {
    await exportIngredientsAndHppToSheets(accessToken, spreadsheetId, data.ingredients);
  }
  if (data.cashLedgers && data.cashLedgers.length > 0) {
    await exportCashLedgersToSheets(accessToken, spreadsheetId, data.cashLedgers);
  }
  await exportExpensesToSheets(accessToken, spreadsheetId, data.expenses, data.purchases);

  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Send transaction to Google Sheets Webhook (Apps Script)
 */
export const syncTransactionToGoogleSheet = async (
  webhookUrl: string,
  transactionData: any
): Promise<{ success: boolean; message?: string; error?: any }> => {
  if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com')) {
    return { success: false, message: 'URL Webhook Google Sheets belum diatur.' };
  }

  try {
    // Menggunakan no-cors karena Apps Script merespons dengan redirect
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
    });

    return { success: true };
  } catch (error) {
    console.error('Gagal sinkronkan ke Google Sheets:', error);
    return { success: false, error };
  }
};
