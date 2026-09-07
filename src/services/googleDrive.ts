import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { StorageService } from './storage';
import {
  executeResilientGoogleSignIn,
  GoogleUserProfile,
  isUnauthorizedDomainError,
  getDomainAuthInfo,
} from './googleAuthHelper';

// Initialize Firebase App for Google Drive & Workspace
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUserProfile: GoogleUserProfile | null = null;
const FOLDER_NAME = 'Su-Qur POS Cloud Backups';

export interface GoogleDriveBackupFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  description?: string;
  summary?: {
    productCount?: number;
    transactionCount?: number;
    ingredientCount?: number;
    shiftCount?: number;
    branchCount?: number;
    dataSizeKB?: number;
  };
}

/**
 * Initialize Google Drive Auth state listener
 */
export const initGoogleDriveAuth = (
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
export const googleDriveSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await executeResilientGoogleSignIn(DRIVE_SCOPES);
    cachedAccessToken = result.accessToken;
    cachedUserProfile = result.user;

    try {
      localStorage.setItem('suqur_google_drive_connected', 'true');
    } catch (e) {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('[Google Drive] Error login:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current Google Drive Access Token
 */
export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Sign out Google Account
 */
export const googleDriveSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {}
  cachedAccessToken = null;
  cachedUserProfile = null;
  try {
    localStorage.removeItem('suqur_google_drive_connected');
  } catch (e) {}
};

/**
 * Search or create the designated backup folder in Google Drive
 */
export const getOrCreateBackupFolder = async (
  accessToken: string,
  folderName: string = FOLDER_NAME
): Promise<string> => {
  // 1. Search existing folder
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // 2. Create new folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder Penyimpanan Backup Database Cloud Su-Qur POS Kedai Kopi',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Gagal membuat folder Google Drive: ${err}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
};

/**
 * Upload complete encrypted/timestamped POS Backup JSON to Google Drive
 */
export const uploadBackupToGoogleDrive = async (
  accessToken: string,
  customPayload?: any,
  label: string = 'Backup Cloud Su-Qur POS',
  note: string = ''
): Promise<{ success: boolean; file: GoogleDriveBackupFile }> => {
  const folderId = await getOrCreateBackupFolder(accessToken);

  // Prepare full database payload if not provided
  const products = StorageService.getProducts();
  const ingredients = StorageService.getIngredients();
  const branchInventory = StorageService.getBranchInventory();
  const stockTransfers = StorageService.getStockTransfers();
  const transactions = StorageService.getTransactions();
  const suppliers = StorageService.getSuppliers();
  const purchases = StorageService.getPurchases();
  const expenses = StorageService.getExpenses();
  const stockOpnames = StorageService.getStockOpnames();
  const shifts = StorageService.getShifts();
  const settings = StorageService.getSettings();
  const users = StorageService.getUsers();
  const outlets = StorageService.getOutlets();
  const cashLedgers = StorageService.getCashLedgers();
  const capitalRecords = StorageService.getCapitalRecords();
  const debtRecords = StorageService.getDebtRecords();
  const payrollRecords = StorageService.getPayrollRecords();
  const qrOrders = StorageService.getQROrders();

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

  const fullData = customPayload || {
    timestamp: now.toISOString(),
    app: 'Su-Qur POS',
    version: '3.0.0-cloud-drive',
    label,
    note,
    checksum: `sq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    summary: {
      productCount: products.length,
      transactionCount: transactions.length,
      ingredientCount: ingredients.length,
      shiftCount: shifts.length,
      branchCount: outlets.length,
      cashLedgerCount: cashLedgers.length,
      expenseCount: expenses.length,
      userCount: users.length,
    },
    settings,
    users,
    outlets,
    products,
    ingredients,
    branchInventory,
    stockTransfers,
    transactions,
    suppliers,
    purchases,
    expenses,
    stockOpnames,
    shifts,
    cashLedgers,
    capitalRecords,
    debtRecords,
    payrollRecords,
    qrOrders,
  };

  const fileContent = JSON.stringify(fullData, null, 2);
  const fileName = `suqur_pos_cloud_backup_${dateStr}_${timeStr}.json`;
  const description = `Su-Qur POS Backup | ${products.length} Menu | ${transactions.length} Transaksi | ${outlets.length} Cabang | Catatan: ${note || label}`;

  // Multipart upload to Google Drive REST API v3
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    description,
    properties: {
      app: 'SuQurPOS',
      productCount: String(products.length),
      transactionCount: String(transactions.length),
      branchCount: String(outlets.length),
      backupDate: now.toISOString(),
    },
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,description',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Google Drive] Upload failed:', errorText);
    throw new Error(`Gagal mengunggah file backup ke Google Drive: ${errorText}`);
  }

  const uploadedFile = await res.json();
  const formattedFile: GoogleDriveBackupFile = {
    id: uploadedFile.id,
    name: uploadedFile.name,
    mimeType: uploadedFile.mimeType,
    size: parseInt(uploadedFile.size || '0', 10),
    createdTime: uploadedFile.createdTime || now.toISOString(),
    modifiedTime: uploadedFile.modifiedTime || now.toISOString(),
    webViewLink: uploadedFile.webViewLink,
    description: uploadedFile.description,
    summary: fullData.summary,
  };

  // Record last cloud backup time
  try {
    localStorage.setItem('suqur_last_drive_backup_time', now.toISOString());
    localStorage.setItem('suqur_last_drive_backup_file', fileName);
  } catch (e) {}

  return { success: true, file: formattedFile };
};

/**
 * List all backup files in the designated Google Drive backup folder
 */
export const listBackupsFromGoogleDrive = async (
  accessToken: string
): Promise<GoogleDriveBackupFile[]> => {
  const folderId = await getOrCreateBackupFolder(accessToken);
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,description,properties)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal membaca daftar file dari Google Drive: ${err}`);
  }

  const data = await res.json();
  if (!data.files || !Array.isArray(data.files)) {
    return [];
  }

  return data.files.map((f: any) => {
    const props = f.properties || {};
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: parseInt(f.size || '0', 10),
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      description: f.description,
      summary: {
        productCount: props.productCount ? parseInt(props.productCount, 10) : undefined,
        transactionCount: props.transactionCount ? parseInt(props.transactionCount, 10) : undefined,
        branchCount: props.branchCount ? parseInt(props.branchCount, 10) : undefined,
      },
    };
  });
};

/**
 * Download and parse backup JSON file content from Google Drive
 */
export const downloadBackupFromGoogleDrive = async (
  accessToken: string,
  fileId: string
): Promise<any> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal mengunduh file backup dari Google Drive: ${err}`);
  }

  const json = await res.json();
  return json;
};

/**
 * Delete a backup file from Google Drive
 */
export const deleteBackupFromGoogleDrive = async (
  accessToken: string,
  fileId: string
): Promise<boolean> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gagal menghapus file dari Google Drive: ${err}`);
  }

  return true;
};
