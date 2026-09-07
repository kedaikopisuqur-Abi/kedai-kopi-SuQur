import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  FileSpreadsheet,
  HardDrive,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Check,
  Server,
  Sparkles,
  Layers,
  ArrowRight,
  LogOut,
  Info,
  Clock,
  Building2,
  Coffee,
  Receipt,
  Wallet,
  Copy,
  Globe,
} from 'lucide-react';
import {
  initGoogleDriveAuth,
  googleDriveSignIn,
  googleDriveSignOut,
  getDriveAccessToken,
  uploadBackupToGoogleDrive,
  listBackupsFromGoogleDrive,
  downloadBackupFromGoogleDrive,
  deleteBackupFromGoogleDrive,
  GoogleDriveBackupFile,
} from '../../services/googleDrive';
import {
  isUnauthorizedDomainError,
  isPopupBlockedError,
  getDomainAuthInfo,
} from '../../services/googleAuthHelper';
import {
  syncAllToGoogleSheets,
  exportTransactionsToSheets,
  exportProductsToSheets,
  exportIngredientsAndHppToSheets,
  exportCashLedgersToSheets,
  exportExpensesToSheets,
  getOrCreateSpreadsheet,
} from '../../services/googleSheetsService';
import { StorageService } from '../../services/storage';
import { AutoBackupService, AutoBackupConfig } from '../../services/autoBackupService';
import { downloadSqlDumpFile, generatePosSqlDump } from '../../utils/sqlExporter';
import { StoreSettings, Outlet, User } from '../../types';

interface ServerMigrationTabProps {
  settings: StoreSettings;
  currentUser?: User;
  onSaveSettings: (settings: StoreSettings) => void;
  onNotification?: (msg: string) => void;
}

export const ServerMigrationTab: React.FC<ServerMigrationTabProps> = ({
  settings,
  currentUser,
  onSaveSettings,
  onNotification,
}) => {
  // Google Drive & Gmail Owner Auth State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDomainAuthError, setIsDomainAuthError] = useState<boolean>(false);
  const [isPopupBlocked, setIsPopupBlocked] = useState<boolean>(false);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const domainInfo = getDomainAuthInfo();

  const handleCopyDomain = () => {
    if (navigator.clipboard && currentDomain) {
      navigator.clipboard.writeText(currentDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  // Cloud Backups List
  const [cloudBackups, setCloudBackups] = useState<GoogleDriveBackupFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [backupNote, setBackupNote] = useState('');

  // Google Sheets Sync State
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Local Restore File State
  const [importedFile, setImportedFile] = useState<{
    fileName: string;
    rawText: string;
    fileType: 'json' | 'sql';
    data?: any;
    summary?: {
      productCount: number;
      transactionCount: number;
      ingredientCount: number;
      outletCount: number;
      timestamp?: string;
    };
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<{ success: boolean; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-backup configuration state
  const [autoBackupConfig, setAutoBackupConfig] = useState<AutoBackupConfig>(() =>
    AutoBackupService.getConfig()
  );

  // Database snapshot summary for current POS state
  const [posStats, setPosStats] = useState({
    products: 0,
    ingredients: 0,
    transactions: 0,
    expenses: 0,
    cashLedgers: 0,
    outlets: 0,
    shifts: 0,
  });

  const refreshPosStats = () => {
    setPosStats({
      products: StorageService.getProducts().length,
      ingredients: StorageService.getIngredients().length,
      transactions: StorageService.getTransactions().length,
      expenses: StorageService.getExpenses().length,
      cashLedgers: StorageService.getCashLedgers().length,
      outlets: StorageService.getOutlets().length,
      shifts: StorageService.getShifts().length,
    });
  };

  useEffect(() => {
    refreshPosStats();

    // Initialize Google Auth
    const unsubscribe = initGoogleDriveAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        fetchCloudBackups(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const fetchCloudBackups = async (token?: string) => {
    const activeToken = token || accessToken || getDriveAccessToken();
    if (!activeToken) return;

    setIsLoadingBackups(true);
    try {
      const files = await listBackupsFromGoogleDrive(activeToken);
      setCloudBackups(files);
    } catch (err: any) {
      console.warn('[ServerMigrationTab] Gagal memuat backup Drive:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    setIsDomainAuthError(false);
    setIsPopupBlocked(false);
    try {
      const res = await googleDriveSignIn();
      if (res?.user && res.accessToken) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        await fetchCloudBackups(res.accessToken);
        if (onNotification) onNotification('✓ Akun Google Owner berhasil terhubung ke Google Drive & Sheets!');
      }
    } catch (err: any) {
      console.debug('[ServerMigrationTab] Google sign-in note:', err);
      if (isPopupBlockedError(err) || (err as any)?.isPopupBlocked) {
        setIsPopupBlocked(true);
        setAuthError(
          'Jendela popup otorisasi Google diblokir oleh browser atau dibatasi oleh sandbox iframe.'
        );
      } else if (isUnauthorizedDomainError(err) || (err as any)?.isUnauthorizedDomain) {
        setIsDomainAuthError(true);
        setAuthError(
          `Domain "${currentDomain}" belum didaftarkan di Authorized Domains Firebase Authentication.`
        );
      } else {
        setAuthError(err?.message || 'Gagal login dengan akun Google.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await googleDriveSignOut();
    setGoogleUser(null);
    setAccessToken(null);
    setCloudBackups([]);
    if (onNotification) onNotification('Akun Google berhasil diputuskan.');
  };

  const handleBackupToGoogleDrive = async () => {
    const token = accessToken || getDriveAccessToken();
    if (!token) {
      alert('Silakan login ke Akun Google Owner terlebih dahulu.');
      return;
    }

    setIsUploadingToDrive(true);
    try {
      const res = await uploadBackupToGoogleDrive(
        token,
        undefined,
        'Backup Cloud Su-Qur POS',
        backupNote.trim()
      );
      if (res.success) {
        setBackupNote('');
        await fetchCloudBackups(token);
        if (onNotification) onNotification('✓ Database berhasil diekspor & dicadangkan ke folder Google Drive Owner!');
        alert(`✓ Backup Cloud Berhasil!\nFile "${res.file.name}" tersimpan di Google Drive folder "Su-Qur POS Cloud Backups".`);
      }
    } catch (err: any) {
      alert('Gagal mengunggah backup ke Google Drive: ' + err.message);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleRestoreFromDriveFile = async (file: GoogleDriveBackupFile) => {
    const token = accessToken || getDriveAccessToken();
    if (!token) {
      alert('Sesi Google kedaluwarsa, silakan login ulang.');
      return;
    }

    const confirmMsg = `PULIHKAN DATABASE DARI GOOGLE DRIVE?\n\nFile: ${file.name}\nTanggal: ${new Date(file.createdTime).toLocaleString('id-ID')}\nMode: ${restoreMode === 'replace' ? 'Timpa Bersih (Replace)' : 'Gabungkan Data (Merge)'}\n\nApakah Anda yakin ingin memulihkan database POS?`;
    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    try {
      const backupData = await downloadBackupFromGoogleDrive(token, file.id);
      const ok = StorageService.restoreBackupJSON(backupData, restoreMode);
      if (ok) {
        refreshPosStats();
        alert('✓ Pemulihan database dari Google Drive berhasil! Halaman akan memuat data terbaru.');
        window.location.reload();
      } else {
        alert('Format file backup Google Drive tidak valid atau rusak.');
      }
    } catch (err: any) {
      alert('Gagal memulihkan dari Google Drive: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteDriveFile = async (fileId: string) => {
    const token = accessToken || getDriveAccessToken();
    if (!token) return;

    if (!window.confirm('Hapus file backup ini secara permanen dari Google Drive Owner?')) return;

    try {
      await deleteBackupFromGoogleDrive(token, fileId);
      setCloudBackups((prev) => prev.filter((f) => f.id !== fileId));
      if (onNotification) onNotification('File backup di Google Drive berhasil dihapus.');
    } catch (err: any) {
      alert('Gagal menghapus file dari Google Drive: ' + err.message);
    }
  };

  // Local File Upload for Restore
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const isJson = fileName.endsWith('.json');
    const isSql = fileName.endsWith('.sql');

    if (!isJson && !isSql) {
      alert('Hanya mendukung file backup berformat .json atau .sql');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || '';
      if (isJson) {
        try {
          const parsed = JSON.parse(text);
          const summary = {
            productCount: Array.isArray(parsed.products) ? parsed.products.length : 0,
            transactionCount: Array.isArray(parsed.transactions) ? parsed.transactions.length : 0,
            ingredientCount: Array.isArray(parsed.ingredients) ? parsed.ingredients.length : 0,
            outletCount: Array.isArray(parsed.outlets) ? parsed.outlets.length : 0,
            timestamp: parsed.timestamp,
          };
          setImportedFile({
            fileName,
            rawText: text,
            fileType: 'json',
            data: parsed,
            summary,
          });
          setRestoreNotice(null);
        } catch (err) {
          alert('File JSON tidak valid atau korup.');
        }
      } else {
        // SQL File
        setImportedFile({
          fileName,
          rawText: text,
          fileType: 'sql',
        });
        setRestoreNotice(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = () => {
    if (!importedFile) return;

    if (importedFile.fileType === 'sql') {
      alert(
        'File .sql adalah skrip SQL untuk database server (MySQL / MariaDB / PostgreSQL).\n\nUntuk mengimpor ke server backend / hosting baru:\n1. Buka phpMyAdmin / Terminal MySQL di hosting Anda.\n2. Pilih database tujuan.\n3. Masuk ke tab "Import" dan upload file .sql ini.'
      );
      return;
    }

    if (!importedFile.data) {
      alert('Data file tidak terbaca.');
      return;
    }

    const confirmMsg = `KONFIRMASI PEMULIHAN DATABASE (PINDAH SERVER)\n\nFile: ${importedFile.fileName}\nProduk: ${importedFile.summary?.productCount || 0}\nTransaksi: ${importedFile.summary?.transactionCount || 0}\nBahan Baku: ${importedFile.summary?.ingredientCount || 0}\nCabang: ${importedFile.summary?.outletCount || 0}\nMode: ${restoreMode === 'replace' ? 'TIMPA BERSIH (Replace Total)' : 'GABUNGKAN DATA (Merge)'}\n\nLanjutkan pemulihan database sekarang?`;
    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    try {
      const ok = StorageService.restoreBackupJSON(importedFile.data, restoreMode);
      if (ok) {
        setRestoreNotice({
          success: true,
          message: '✓ Database berhasil dipulihkan secara penuh! Memuat ulang sistem...',
        });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setRestoreNotice({
          success: false,
          message: 'Gagal memulihkan database. Format data tidak dikenali.',
        });
      }
    } catch (err: any) {
      setRestoreNotice({
        success: false,
        message: 'Terjadi kesalahan saat memulihkan: ' + err.message,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Google Sheets Full Sync Handler
  const handleSyncToGoogleSheets = async (targetType: 'all' | 'transactions' | 'products' | 'ingredients' | 'cash' | 'expenses') => {
    const token = accessToken || getDriveAccessToken();
    if (!token) {
      alert('Silakan login ke Akun Google terlebih dahulu.');
      return;
    }

    setIsSyncingSheets(true);
    setSyncStatusMsg('Menyinkronkan data ke Google Sheets...');
    try {
      const { spreadsheetId, spreadsheetUrl } = await getOrCreateSpreadsheet(token);
      setSheetsUrl(spreadsheetUrl);

      const txs = StorageService.getTransactions();
      const prods = StorageService.getProducts();
      const ings = StorageService.getIngredients();
      const cash = StorageService.getCashLedgers();
      const exps = StorageService.getExpenses();
      const pos = StorageService.getPurchases();

      if (targetType === 'all') {
        await syncAllToGoogleSheets(token, {
          transactions: txs,
          products: prods,
          ingredients: ings,
          cashLedgers: cash,
          expenses: exps,
          purchases: pos,
        });
        setSyncStatusMsg('✓ Seluruh data master & transaksi berhasil disinkronkan ke Google Sheets!');
      } else if (targetType === 'transactions') {
        await exportTransactionsToSheets(token, spreadsheetId, txs);
        setSyncStatusMsg('✓ Laporan transaksi berhasil disinkronkan ke Google Sheets!');
      } else if (targetType === 'products') {
        await exportProductsToSheets(token, spreadsheetId, prods);
        setSyncStatusMsg('✓ Daftar menu & produk berhasil disinkronkan ke Google Sheets!');
      } else if (targetType === 'ingredients') {
        await exportIngredientsAndHppToSheets(token, spreadsheetId, ings);
        setSyncStatusMsg('✓ Bahan baku & HPP resep berhasil disinkronkan ke Google Sheets!');
      } else if (targetType === 'cash') {
        await exportCashLedgersToSheets(token, spreadsheetId, cash);
        setSyncStatusMsg('✓ Buku kas & arus kas berhasil disinkronkan ke Google Sheets!');
      } else if (targetType === 'expenses') {
        await exportExpensesToSheets(token, spreadsheetId, exps, pos);
        setSyncStatusMsg('✓ Pengeluaran & PO berhasil disinkronkan ke Google Sheets!');
      }

      if (onNotification) onNotification('✓ Sinkronisasi ke Google Sheets berhasil!');
    } catch (err: any) {
      setSyncStatusMsg('Gagal menyinkronkan: ' + err.message);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleDownloadFullJson = () => {
    StorageService.exportBackupJSON();
    if (onNotification) onNotification('File backup JSON berhasil diunduh ke komputer.');
  };

  const handleDownloadSqlDump = () => {
    downloadSqlDumpFile();
    if (onNotification) onNotification('File skrip SQL Dump (.sql) berhasil diunduh.');
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#2B1713] via-[#3E2723] to-[#1F1412] text-[#FAF3DD] p-6 rounded-3xl border border-amber-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
              <Server className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Pindah Server, Google Drive & Database Exporter</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/40">
                  Cloud & Migration
                </span>
              </div>
              <p className="text-xs text-[#D7CCC8] mt-1 max-w-2xl leading-relaxed">
                Cadangkan database secara otomatis ke Google Drive milik Owner, ekspor dump SQL untuk hosting baru, serta sinkronkan seluruh data master ke Google Sheets secara real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={refreshPosStats}
              className="px-3 py-2 rounded-xl bg-[#4E342E] hover:bg-[#5D4037] text-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Status Data
            </button>
          </div>
        </div>

        {/* STATS OVERVIEW CHIPS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-5 pt-4 border-t border-amber-500/20">
          <div className="bg-[#1A110F]/70 p-2.5 rounded-xl border border-[#3E2924] text-center">
            <span className="text-[10px] text-[#A1887F] block">Menu Produk</span>
            <span className="text-sm font-extrabold text-amber-300">{posStats.products}</span>
          </div>
          <div className="bg-[#1A110F]/70 p-2.5 rounded-xl border border-[#3E2924] text-center">
            <span className="text-[10px] text-[#A1887F] block">Bahan & HPP</span>
            <span className="text-sm font-extrabold text-amber-300">{posStats.ingredients}</span>
          </div>
          <div className="bg-[#1A110F]/70 p-2.5 rounded-xl border border-[#3E2924] text-center">
            <span className="text-[10px] text-[#A1887F] block">Transaksi</span>
            <span className="text-sm font-extrabold text-amber-300">{posStats.transactions}</span>
          </div>
          <div className="bg-[#1A110F]/70 p-2.5 rounded-xl border border-[#3E2924] text-center">
            <span className="text-[10px] text-[#A1887F] block">Buku Kas</span>
            <span className="text-sm font-extrabold text-amber-300">{posStats.cashLedgers}</span>
          </div>
          <div className="bg-[#1A110F]/70 p-2.5 rounded-xl border border-[#3E2924] text-center">
            <span className="text-[10px] text-[#A1887F] block">Pengeluaran</span>
            <span className="text-sm font-extrabold text-amber-300">{posStats.expenses}</span>
          </div>
          <div className="bg-[#1A110F]/70 p-2.5 rounded-xl border border-[#3E2924] text-center">
            <span className="text-[10px] text-[#A1887F] block">Data Cabang</span>
            <span className="text-sm font-extrabold text-amber-300">{posStats.outlets}</span>
          </div>
          <div className="bg-[#1A110F]/70 p-2.5 rounded-xl border border-[#3E2924] text-center">
            <span className="text-[10px] text-[#A1887F] block">Shift Kasir</span>
            <span className="text-sm font-extrabold text-amber-300">{posStats.shifts}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: GOOGLE DRIVE CLOUD BACKUP (AKUN GMAIL OWNER) */}
      <div className="bg-white rounded-3xl border border-[#E6D5C3] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6D5C3] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-[#2B1713] flex items-center gap-2">
                Google Drive Cloud Backup (Akun Gmail Owner)
                {googleUser ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Terhubung
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                    Belum Terhubung
                  </span>
                )}
              </h4>
              <p className="text-xs text-[#8D6E63] mt-0.5">
                Simpan snapshot database secara aman di folder khusus <strong>Google Drive Owner</strong> tanpa batas penyimpanan.
              </p>
            </div>
          </div>

          <div>
            {googleUser ? (
              <div className="flex items-center gap-2 bg-[#FDFBF7] p-1.5 rounded-2xl border border-[#E6D5C3]">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt="Avatar" className="w-7 h-7 rounded-xl object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                    {googleUser.email ? googleUser.email.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                <div className="pr-2">
                  <span className="block text-xs font-bold text-[#2B1713] truncate max-w-[150px]">
                    {googleUser.displayName || 'Owner'}
                  </span>
                  <span className="block text-[10px] text-[#8D6E63] truncate max-w-[150px]">
                    {googleUser.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors"
                  title="Logout Akun Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthLoading}
                className="px-4 py-2.5 rounded-2xl bg-[#3E2723] hover:bg-[#4E342E] text-white font-bold text-xs transition-all shadow-sm flex items-center gap-2"
              >
                {isAuthLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <Cloud className="w-4 h-4 text-amber-400" />
                )}
                Login dengan Google Drive
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-900 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">{authError}</p>
                {isDomainAuthError && (
                  <p className="text-[11px] text-rose-700 mt-1">
                    Firebase Authentication menolak login Google Popup karena domain aplikasi belum didaftarkan di daftar <b>Authorized Domains</b>.
                  </p>
                )}
              </div>
            </div>

            {isPopupBlocked && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-2 text-amber-900">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Popup Google OAuth Diblokir Browser / Iframe</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Browser Anda atau pembatasan iframe memblokir popup otorisasi Google. Buka aplikasi langsung di Tab Baru browser Anda (bebas dari pembatasan iframe) agar popup otorisasi Google diizinkan.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Aplikasi di Tab Baru
                  </button>
                </div>
              </div>
            )}

            {isDomainAuthError && (
              <div className="p-3 bg-white/90 rounded-xl border border-rose-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-800 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-700" /> Domain Aplikasi Saat Ini:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyDomain}
                    className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center gap-1 border border-amber-300 transition-colors"
                  >
                    {copiedDomain ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-amber-800" /> Salin Domain
                      </>
                    )}
                  </button>
                </div>

                <code className="block p-2 rounded-lg bg-gray-100 text-gray-900 text-[11px] font-mono select-all break-all border border-gray-300">
                  {currentDomain}
                </code>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href={domainInfo.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#3E2723] hover:bg-[#4E342E] text-white font-bold text-[11px] text-center flex items-center justify-center gap-1.5 shadow-xs transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Firebase Console (Settings)
                  </a>
                </div>

                <p className="text-[10px] text-gray-600 italic">
                  💡 Tips: Anda tetap dapat mengunduh <b>Backup JSON</b> atau <b>SQL Dump</b> di bawah ini secara offline dan 100% aman tanpa konfigurasi domain!
                </p>
              </div>
            )}
          </div>
        )}

        {/* DRIVE BACKUP CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#FAF3DD]/40 border border-[#E6D5C3] p-4.5 rounded-2xl space-y-3">
            <h5 className="font-bold text-xs text-[#2B1713] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-700" /> Buat Backup Baru ke Google Drive
            </h5>
            <p className="text-[11px] text-[#8D6E63]">
              Ekspor seluruh data transaksi, stok cabang, resep HPP, dan buku kas langsung ke Google Drive Owner.
            </p>
            <input
              type="text"
              placeholder="Catatan backup (opsional, contoh: Sebelum ganti menu)"
              value={backupNote}
              onChange={(e) => setBackupNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6D5C3] text-xs focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 outline-none"
            />
            <button
              type="button"
              onClick={handleBackupToGoogleDrive}
              disabled={isUploadingToDrive || !googleUser}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                googleUser
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isUploadingToDrive ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Mengunggah ke Google Drive...
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" /> Cadangkan Sekarang ke Google Drive
                </>
              )}
            </button>
          </div>

          <div className="bg-[#FAF3DD]/40 border border-[#E6D5C3] p-4.5 rounded-2xl space-y-3">
            <h5 className="font-bold text-xs text-[#2B1713] flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" /> Informasi Folder Cloud Drive
            </h5>
            <div className="space-y-1.5 text-xs text-gray-700">
              <div className="flex justify-between py-1 border-b border-[#E6D5C3]/60">
                <span className="text-[#8D6E63]">Lokasi Folder:</span>
                <span className="font-bold text-[#2B1713]">My Drive / Su-Qur POS Cloud Backups</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E6D5C3]/60">
                <span className="text-[#8D6E63]">Enkripsi & Checksum:</span>
                <span className="font-mono text-emerald-700 font-bold">SHA-256 Validated JSON</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8D6E63]">Status Auto-Sync:</span>
                <span className="text-xs font-bold text-emerald-700">
                  {autoBackupConfig.enabled ? 'Aktif (Transaksi & Shift)' : 'Nonaktif'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* DRIVE BACKUP FILES LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-xs text-[#2B1713] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#8D6E63]" /> Riwayat Backup di Google Drive ({cloudBackups.length})
            </h5>
            {googleUser && (
              <button
                type="button"
                onClick={() => fetchCloudBackups()}
                disabled={isLoadingBackups}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} /> Refresh Daftar
              </button>
            )}
          </div>

          {!googleUser ? (
            <div className="p-6 rounded-2xl bg-[#FDFBF7] border border-[#E6D5C3] text-center text-xs text-[#8D6E63]">
              Hubungkan akun Google Owner di atas untuk melihat dan mengelola backup di cloud.
            </div>
          ) : isLoadingBackups ? (
            <div className="p-6 rounded-2xl bg-[#FDFBF7] border border-[#E6D5C3] text-center text-xs text-[#8D6E63] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600" /> Membaca riwayat backup dari Google Drive...
            </div>
          ) : cloudBackups.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#FDFBF7] border border-[#E6D5C3] text-center text-xs text-[#8D6E63]">
              Belum ada file backup di Google Drive. Klik tombol "Cadangkan Sekarang ke Google Drive" untuk membuat backup pertama.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {cloudBackups.map((file) => (
                <div
                  key={file.id}
                  className="bg-[#FDFBF7] p-3.5 rounded-2xl border border-[#E6D5C3] hover:border-amber-400 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#2B1713]">{file.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {Math.round(file.size / 1024)} KB
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3">
                      <span>🕒 {new Date(file.createdTime).toLocaleString('id-ID')}</span>
                      {file.description && <span className="text-amber-800">{file.description}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestoreFromDriveFile(file)}
                      disabled={isRestoring}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                      title="Pulihkan data POS dari backup ini"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Restore ke POS
                    </button>

                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 border border-[#E6D5C3] transition-colors"
                        title="Buka di Google Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteDriveFile(file.id)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus file ini dari Google Drive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: DATABASE EXPORTER (MANUAL BACKUP & SERVER MIGRATION DUMP) */}
      <div className="bg-white rounded-3xl border border-[#E6D5C3] p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-[#E6D5C3] pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-base text-[#2B1713]">
              Database Exporter (Unduh File Backup Lokal & SQL Dump)
            </h4>
            <p className="text-xs text-[#8D6E63] mt-0.5">
              Unduh salinan database ke komputer/HP dalam format JSON lengkap atau skrip SQL Dump untuk migrasi hosting baru.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Format 1: JSON Backup */}
          <div className="bg-[#FDFBF7] p-5 rounded-2xl border-2 border-amber-200/80 hover:border-amber-400 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                  JSON
                </div>
                <div>
                  <h5 className="font-bold text-xs text-[#2B1713]">Download Backup JSON Lengkap (.json)</h5>
                  <span className="text-[10px] text-gray-500">Universal POS Snapshot Format</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                Rekomendasi
              </span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Menyimpan seluruh master menu, resep, transaksi kasir, pengeluaran, shift, mutasi buku kas, dan cabang dalam format JSON terstruktur untuk di-restore kapan saja.
            </p>
            <button
              type="button"
              onClick={handleDownloadFullJson}
              className="w-full py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" /> Unduh Backup Database JSON (.json)
            </button>
          </div>

          {/* Format 2: SQL Dump */}
          <div className="bg-[#FDFBF7] p-5 rounded-2xl border-2 border-blue-200/80 hover:border-blue-400 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  SQL
                </div>
                <div>
                  <h5 className="font-bold text-xs text-[#2B1713]">Download Server SQL Dump (.sql)</h5>
                  <span className="text-[10px] text-gray-500">MySQL / MariaDB / PostgreSQL DDL+DML</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold">
                Pindah Server
              </span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Membuat skrip SQL terstruktur lengkap dengan perintah <code>CREATE TABLE IF NOT EXISTS</code> dan <code>INSERT INTO</code> siap import ke phpMyAdmin / server hosting baru.
            </p>
            <button
              type="button"
              onClick={handleDownloadSqlDump}
              className="w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileCode2 className="w-4 h-4 text-blue-200" /> Unduh Skrip SQL Dump (.sql)
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: RESTORE / IMPOR DATABASE & SERVER MIGRATION MANAGER */}
      <div className="bg-white rounded-3xl border border-[#E6D5C3] p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-[#E6D5C3] pb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-base text-[#2B1713]">
              Restore / Impor Database (Fitur Pindah Server)
            </h4>
            <p className="text-xs text-[#8D6E63] mt-0.5">
              Unggah file backup saat aplikasi dipasang di server/hosting baru atau saat memulihkan database.
            </p>
          </div>
        </div>

        {restoreNotice && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
              restoreNotice.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            {restoreNotice.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-bold">{restoreNotice.message}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#D4A373] hover:border-amber-600 bg-[#FAF3DD]/30 hover:bg-[#FAF3DD]/60 p-8 rounded-3xl text-center cursor-pointer transition-all space-y-2"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm text-[#2B1713] block">
              {importedFile ? `File Dipilih: ${importedFile.fileName}` : 'Klik untuk Pilih File Backup (.json / .sql)'}
            </span>
            <p className="text-xs text-[#8D6E63]">
              Pilih file hasil backup JSON atau skrip SQL dump dari perangkat Anda
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.sql"
              onChange={handleLocalFileSelect}
              className="hidden"
            />
          </div>

          {/* PREVIEW OF SELECTED FILE */}
          {importedFile && (
            <div className="bg-[#FDFBF7] p-5 rounded-2xl border border-amber-300 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-5 h-5 text-amber-700" />
                  <div>
                    <h5 className="font-bold text-xs text-[#2B1713]">{importedFile.fileName}</h5>
                    <span className="text-[10px] text-emerald-700 font-bold">✓ File Valid & Terverifikasi</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImportedFile(null)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                >
                  Batal
                </button>
              </div>

              {importedFile.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3] text-center">
                    <span className="text-[10px] text-gray-500 block">Menu Produk</span>
                    <span className="text-sm font-extrabold text-[#2B1713]">{importedFile.summary.productCount}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3] text-center">
                    <span className="text-[10px] text-gray-500 block">Transaksi</span>
                    <span className="text-sm font-extrabold text-[#2B1713]">{importedFile.summary.transactionCount}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3] text-center">
                    <span className="text-[10px] text-gray-500 block">Bahan Baku</span>
                    <span className="text-sm font-extrabold text-[#2B1713]">{importedFile.summary.ingredientCount}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3] text-center">
                    <span className="text-[10px] text-gray-500 block">Data Cabang</span>
                    <span className="text-sm font-extrabold text-[#2B1713]">{importedFile.summary.outletCount}</span>
                  </div>
                </div>
              )}

              {/* RESTORE MODE SELECTOR */}
              <div className="space-y-2 pt-2 border-t border-[#E6D5C3]">
                <label className="text-xs font-bold text-[#2B1713] block">Pilih Mode Pemulihan:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('replace')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      restoreMode === 'replace'
                        ? 'border-amber-600 bg-amber-50 shadow-xs'
                        : 'border-[#E6D5C3] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#2B1713]">1. Timpa Bersih (Replace Total)</span>
                      {restoreMode === 'replace' && <Check className="w-4 h-4 text-amber-700" />}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                      Menimpa seluruh database lama dengan isi file backup (Cocok saat pindah server baru).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      restoreMode === 'merge'
                        ? 'border-amber-600 bg-amber-50 shadow-xs'
                        : 'border-[#E6D5C3] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#2B1713]">2. Gabungkan Data (Merge & Append)</span>
                      {restoreMode === 'merge' && <Check className="w-4 h-4 text-amber-700" />}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                      Menggabungkan data transaksi & menu baru tanpa menghapus data lokal yang ada.
                    </p>
                  </button>
                </div>
              </div>

              {/* EXECUTE RESTORE BUTTON */}
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Memulihkan Database...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Jalankan Pemulihan Database Sekarang
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: GOOGLE SHEETS REAL-TIME MASTER DATA SYNC */}
      <div className="bg-white rounded-3xl border border-[#E6D5C3] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6D5C3] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-[#2B1713]">
                Google Sheets Real-time & Master Data Sync
              </h4>
              <p className="text-xs text-[#8D6E63] mt-0.5">
                Sinkronkan seluruh data master (Produk, HPP Resep, Transaksi, Kas, Pengeluaran) ke spreadsheet Google Owner.
              </p>
            </div>
          </div>

          {sheetsUrl && (
            <a
              href={sheetsUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <ExternalLink className="w-4 h-4" /> Buka Spreadsheet di Tab Baru
            </a>
          )}
        </div>

        {syncStatusMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* SYNC ALL MASTER DATA */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-950 text-white flex flex-col justify-between space-y-3 col-span-1 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-300" />
                <h5 className="font-black text-sm">Sync Semua Data Master & Transaksi (Full Sync)</h5>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-800 text-emerald-200">
                5 Tab Otomatis
              </span>
            </div>
            <p className="text-xs text-emerald-200">
              Menyinkronkan tab: 'Laporan Transaksi', 'Daftar Produk & Menu', 'Bahan Baku & HPP Resep', 'Buku Kas & Arus Kas', dan 'Pengeluaran & PO' sekaligus.
            </p>
            <button
              type="button"
              onClick={() => handleSyncToGoogleSheets('all')}
              disabled={isSyncingSheets || !googleUser}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                googleUser
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 cursor-pointer shadow-md'
                  : 'bg-emerald-800/60 text-emerald-300/60 cursor-not-allowed'
              }`}
            >
              {isSyncingSheets ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Sinkronkan Seluruh Data ke Google Sheets
            </button>
          </div>

          {/* INDIVIDUAL SYNC 1: TRANSAKSI */}
          <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6D5C3] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-[#2B1713]">
                <Receipt className="w-4 h-4 text-amber-700" /> Transaksi Penjualan
              </div>
              <p className="text-[10px] text-[#8D6E63] mt-1">
                Faktur, total omzet, diskon, metode pembayaran, laba kotor.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSyncToGoogleSheets('transactions')}
              disabled={isSyncingSheets || !googleUser}
              className="w-full py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              Sync Transaksi
            </button>
          </div>

          {/* INDIVIDUAL SYNC 2: PRODUK & RESEP HPP */}
          <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6D5C3] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-[#2B1713]">
                <Coffee className="w-4 h-4 text-amber-700" /> Menu & Bahan HPP
              </div>
              <p className="text-[10px] text-[#8D6E63] mt-1">
                Harga jual menu, HPP modal, bahan baku, dan stok real-time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSyncToGoogleSheets('products')}
              disabled={isSyncingSheets || !googleUser}
              className="w-full py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              Sync Produk & Menu
            </button>
          </div>

          {/* INDIVIDUAL SYNC 3: BUKU KAS & MUTASI */}
          <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6D5C3] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-[#2B1713]">
                <Wallet className="w-4 h-4 text-amber-700" /> Buku Kas & Arus Kas
              </div>
              <p className="text-[10px] text-[#8D6E63] mt-1">
                Mutasi kas masuk/keluar, kas operasional, modal, dan kasbon.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSyncToGoogleSheets('cash')}
              disabled={isSyncingSheets || !googleUser}
              className="w-full py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              Sync Buku Kas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
