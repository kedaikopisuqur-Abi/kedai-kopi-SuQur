import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  LogOut,
  X,
  Database,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  Globe,
  Settings,
} from 'lucide-react';
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  syncAllToGoogleSheets,
  exportTransactionsToSheets,
  exportProductsToSheets,
  exportExpensesToSheets,
  getOrCreateSpreadsheet,
} from '../../services/googleSheetsService';
import { isUnauthorizedDomainError, isPopupBlockedError, getDomainAuthInfo } from '../../services/googleAuthHelper';
import { syncTransactionToGoogleSheet } from '../../services/googleSheetService';
import { StorageService } from '../../services/storage';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDomainError, setIsDomainError] = useState<boolean>(false);
  const [isPopupBlocked, setIsPopupBlocked] = useState<boolean>(false);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbztMYnrVKF9CO0yxMjaD63ZQX22ZREqwXa7QEFfXtB1QpunSvR0_CyyScT0fBwodMkR/exec';
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('google_sheet_webhook_url') : null;
    return stored && stored.trim() ? stored : DEFAULT_WEBHOOK_URL;
  });
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const domainInfo = getDomainAuthInfo();

  const handleCopyDomain = () => {
    if (navigator.clipboard && currentDomain) {
      navigator.clipboard.writeText(currentDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleSaveWebhook = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem('google_sheet_webhook_url', url.trim());
    const currentSettings = StorageService.getSettings();
    if (currentSettings) {
      StorageService.saveSettings({ ...currentSettings, googleSheetWebhookUrl: url.trim() });
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com')) {
      setWebhookStatus('URL Webhook tidak valid. Pastikan diawali https://script.google.com/...');
      return;
    }
    setIsTestingWebhook(true);
    setWebhookStatus(null);
    try {
      const sampleTx = {
        invoiceNo: 'TEST-' + Date.now().toString().slice(-4),
        timestamp: new Date().toISOString(),
        cashierName: 'Tes Webhook',
        total: 25000,
        paymentMethod: 'cash',
        items: [{ productName: 'Kopi Susu Gula Aren (Test)', quantity: 1, totalPrice: 25000 }],
      };
      const res = await syncTransactionToGoogleSheet(webhookUrl.trim(), sampleTx);
      if (res.success) {
        setWebhookStatus('✓ Tes kirim data ke Webhook Google Sheets berhasil!');
      } else {
        setWebhookStatus(res.message || 'Gagal mengirim ke Webhook Google Sheets.');
      }
    } catch (err: any) {
      setWebhookStatus('Gagal mengirim ke Webhook: ' + err.message);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setWebhookUrl(localStorage.getItem('google_sheet_webhook_url') || DEFAULT_WEBHOOK_URL);
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, [isOpen]);

  const handleSignIn = async (preferGsi = false) => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    setIsDomainError(false);
    setIsPopupBlocked(false);
    try {
      const res = await googleSignIn(preferGsi);
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        setStatusMessage(`Berhasil terhubung sebagai ${res.user.email || res.user.displayName || 'Pengguna Google'}`);
      }
    } catch (err: any) {
      console.debug('[GoogleSheetsSyncModal] Sign-in note:', err);
      if (isPopupBlockedError(err) || (err as any)?.isPopupBlocked) {
        setIsPopupBlocked(true);
        setErrorMessage(
          'Jendela popup Google OAuth diblokir oleh browser atau dibatasi oleh iframe. Buka aplikasi di Tab Baru atau gunakan Webhook Google Sheets.'
        );
      } else if (isUnauthorizedDomainError(err) || (err as any)?.isUnauthorizedDomain) {
        setIsDomainError(true);
        setErrorMessage(
          `Domain "${currentDomain}" belum terdaftar di Firebase Authorized Domains. Anda dapat menggunakan tombol Masuk via Google OAuth di bawah.`
        );
      } else {
        setErrorMessage(err.message || 'Gagal terhubung dengan akun Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setAccessToken(null);
    setStatusMessage('Akun Google berhasil terputus.');
    setSpreadsheetUrl(null);
  };

  const handleFullSync = async () => {
    if (!accessToken) {
      setErrorMessage('Silakan hubungkan akun Google Anda terlebih dahulu.');
      return;
    }

    const confirmSync = window.confirm(
      'Apakah Anda yakin ingin mengeksport & memperbarui seluruh data (Laporan Transaksi, Daftar Produk & Stok, Pengeluaran) ke Google Sheets "Suqur POS - Data Laporan & Stok"?'
    );
    if (!confirmSync) return;

    setIsSyncing(true);
    setErrorMessage(null);
    setStatusMessage('Sedang menyiapkan Google Spreadsheet dan mengirimkan data...');

    try {
      const txs = StorageService.getTransactions();
      const prods = StorageService.getProducts();
      const exps = StorageService.getExpenses();
      const pos = StorageService.getPurchases();

      const { spreadsheetUrl } = await syncAllToGoogleSheets(accessToken, {
        transactions: txs,
        products: prods,
        expenses: exps,
        purchases: pos,
      });

      setSpreadsheetUrl(spreadsheetUrl);
      setStatusMessage('✓ SELURUH DATA POS BERHASIL DISINKRONKAN KE GOOGLE SHEETS!');
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(err.message || 'Gagal mengunggah data ke Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncTransactions = async () => {
    if (!accessToken) return;
    const confirmSync = window.confirm(
      'Ekspor riwayat transaksi penjualan ke Google Sheets "Laporan Transaksi"?'
    );
    if (!confirmSync) return;

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const txs = StorageService.getTransactions();
      const { spreadsheetId, spreadsheetUrl } = await getOrCreateSpreadsheet(accessToken);
      await exportTransactionsToSheets(accessToken, spreadsheetId, txs);
      setSpreadsheetUrl(spreadsheetUrl);
      setStatusMessage('✓ Laporan transaksi berhasil dieksport ke tab "Laporan Transaksi"!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal eksport transaksi.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncProducts = async () => {
    if (!accessToken) return;
    const confirmSync = window.confirm(
      'Ekspor daftar produk dan status stok ke Google Sheets "Daftar Produk & Stok"?'
    );
    if (!confirmSync) return;

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const prods = StorageService.getProducts();
      const { spreadsheetId, spreadsheetUrl } = await getOrCreateSpreadsheet(accessToken);
      await exportProductsToSheets(accessToken, spreadsheetId, prods);
      setSpreadsheetUrl(spreadsheetUrl);
      setStatusMessage('✓ Katalog produk & stok berhasil dieksport ke tab "Daftar Produk & Stok"!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal eksport produk.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncExpenses = async () => {
    if (!accessToken) return;
    const confirmSync = window.confirm(
      'Ekspor pengeluaran operasional & PO ke Google Sheets "Pengeluaran & PO"?'
    );
    if (!confirmSync) return;

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const exps = StorageService.getExpenses();
      const pos = StorageService.getPurchases();
      const { spreadsheetId, spreadsheetUrl } = await getOrCreateSpreadsheet(accessToken);
      await exportExpensesToSheets(accessToken, spreadsheetId, exps, pos);
      setSpreadsheetUrl(spreadsheetUrl);
      setStatusMessage('✓ Pengeluaran operasional & PO berhasil dieksport ke tab "Pengeluaran & PO"!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal eksport pengeluaran.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#2B1713] text-[#FAF3DD] w-full max-w-lg rounded-3xl shadow-2xl border border-[#5D4037] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Modal */}
        <div className="p-5 border-b border-[#4E342E] flex items-center justify-between bg-[#1F1412]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#FAF3DD]">Google Sheets Live Sync</h3>
              <p className="text-xs text-[#D7CCC8]">
                Ekspor & hubungkan laporan POS langsung ke Google Spreadsheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#D7CCC8] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status Messages */}
          {statusMessage && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{statusMessage}</p>
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Google Sheets
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error / Unauthorized Domain Notification */}
          {errorMessage && (
            <div className="p-4 bg-rose-950/90 border border-rose-500/60 rounded-2xl text-rose-200 text-xs space-y-3 shadow-lg">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-rose-100">{errorMessage}</p>
                  {isDomainError && (
                    <p className="text-[11px] text-rose-200/90 mt-1 leading-relaxed">
                      Firebase Authentication mengharuskan domain aplikasi didaftarkan di daftar <b>Authorized Domains</b> agar otorisasi Google Popup diizinkan.
                    </p>
                  )}
                </div>
              </div>

              {isPopupBlocked && (
                <div className="p-3 bg-[#1F1412] rounded-xl border border-amber-500/50 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Popup Google OAuth Diblokir Browser / Iframe</span>
                  </div>
                  <p className="text-[11px] text-amber-100/90 leading-relaxed">
                    Browser Anda atau pembatasan iframe memblokir popup Google OAuth. Solusi termudah adalah membuka aplikasi langsung di Tab Baru browser Anda atau menggunakan Webhook Google Sheets (100% tanpa popup).
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Buka Aplikasi di Tab Baru
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSignIn(true)}
                      disabled={isLoggingIn}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700/90 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} /> Coba Lagi via GSI
                    </button>
                  </div>
                </div>
              )}

              {isDomainError && (
                <div className="p-3 bg-[#1F1412] rounded-xl border border-rose-500/40 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-300 font-bold flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-amber-400" /> Domain Aplikasi Saat Ini:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-500/40 transition-colors"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Tersalin!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Salin Domain
                        </>
                      )}
                    </button>
                  </div>

                  <code className="block p-2 rounded-lg bg-black/40 text-amber-200 text-[11px] font-mono select-all break-all border border-[#5D4037]">
                    {currentDomain}
                  </code>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <a
                      href={domainInfo.consoleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] text-center flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Buka Firebase Console (Settings)
                    </a>
                  </div>
                  <p className="text-[10px] text-gray-400 italic">
                    💡 Tips: Anda juga dapat menggunakan <b>Google Apps Script Webhook</b> di bawah ini untuk sinkronisasi otomatis tanpa perlu konfigurasi Firebase Domain!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Account Authentication Card */}
          <div className="p-4 rounded-2xl bg-[#3E2723]/60 border border-[#5D4037] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#E6D5C3] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Status Koneksi Google:
              </span>
              {googleUser ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold">
                  Terhubung
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500/50 text-amber-300 text-[11px] font-bold">
                  Belum Login
                </span>
              )}
            </div>

            {googleUser ? (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full border border-amber-400"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                      {googleUser.displayName?.[0] || 'G'}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-[#FAF3DD]">
                      {googleUser.displayName || 'Pengguna Google'}
                    </p>
                    <p className="text-[10px] text-[#D7CCC8]">{googleUser.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Putus
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[#D7CCC8] mb-2">
                  Masuk dengan Google untuk memberi izin pembuatan dan pembaruan Google Sheets secara aman.
                </p>
                <button
                  type="button"
                  onClick={() => handleSignIn(false)}
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  {isLoggingIn ? 'Menghubungkan Akun Google...' : 'Masuk dengan Akun Google'}
                </button>

                {isDomainError && (
                  <button
                    type="button"
                    onClick={() => handleSignIn(true)}
                    disabled={isLoggingIn}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Otorisasi Langsung via Google OAuth (GSI)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sync Operations */}
          <div className="space-y-2.5 pt-1">
            <h4 className="text-xs font-bold text-[#E6D5C3] uppercase tracking-wider">
              Pilihan Ekspor & Live Sync Google Sheets
            </h4>

            {/* Sync All Button */}
            <button
              onClick={handleFullSync}
              disabled={!accessToken || isSyncing}
              className={`w-full p-3.5 rounded-2xl font-bold text-xs flex items-center justify-between gap-3 transition-all shadow-md ${
                accessToken && !isSyncing
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white cursor-pointer'
                  : 'bg-[#3E2723] text-gray-500 cursor-not-allowed border border-[#4E342E]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
                <div>
                  <div className="text-sm font-extrabold text-white">Ekspor Seluruh Data POS (1-Click Sync)</div>
                  <div className="text-[11px] opacity-80 font-normal">
                    Update Laporan Transaksi, Katalog Produk & Stok, dan Pengeluaran PO
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 shrink-0 text-white/80" />
            </button>

            {/* Modular Sync Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleSyncTransactions}
                disabled={!accessToken || isSyncing}
                className="p-3 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-amber-200 border border-[#5D4037] text-xs font-bold transition-all text-left space-y-1"
              >
                <div className="flex items-center justify-between text-emerald-400">
                  <Database className="w-4 h-4" />
                  <span className="text-[10px] text-gray-400">Sheet 1</span>
                </div>
                <div>Laporan Transaksi</div>
              </button>

              <button
                onClick={handleSyncProducts}
                disabled={!accessToken || isSyncing}
                className="p-3 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-amber-200 border border-[#5D4037] text-xs font-bold transition-all text-left space-y-1"
              >
                <div className="flex items-center justify-between text-emerald-400">
                  <Database className="w-4 h-4" />
                  <span className="text-[10px] text-gray-400">Sheet 2</span>
                </div>
                <div>Produk & Stok</div>
              </button>

              <button
                onClick={handleSyncExpenses}
                disabled={!accessToken || isSyncing}
                className="p-3 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-amber-200 border border-[#5D4037] text-xs font-bold transition-all text-left space-y-1"
              >
                <div className="flex items-center justify-between text-emerald-400">
                  <Database className="w-4 h-4" />
                  <span className="text-[10px] text-gray-400">Sheet 3</span>
                </div>
                <div>Pengeluaran & PO</div>
              </button>
            </div>

            {/* Webhook Apps Script Section */}
            <div className="p-3.5 rounded-2xl bg-[#1F1412] border border-[#5D4037] space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Google Apps Script Webhook (Auto-Sync Real-time)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
                  Real-time
                </span>
              </div>
              <p className="text-[11px] text-[#D7CCC8]">
                Setiap transaksi yang selesai di POS kasir akan otomatis dikirimkan ke URL Webhook ini:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={webhookUrl}
                  onChange={(e) => handleSaveWebhook(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#2B1713] border border-[#5D4037] text-white text-xs placeholder:text-gray-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook || !webhookUrl}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-[#1F1412] text-xs font-bold transition-all shrink-0"
                >
                  {isTestingWebhook ? 'Mengirim...' : 'Tes Kirim'}
                </button>
              </div>
              {webhookStatus && (
                <div
                  className={`text-[11px] font-semibold p-2 rounded-lg ${
                    webhookStatus.startsWith('✓')
                      ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950/70 text-rose-300 border border-rose-800'
                  }`}
                >
                  {webhookStatus}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#4E342E] bg-[#1F1412] flex items-center justify-between">
          <p className="text-[11px] text-[#D7CCC8]">
            File disimpan di Google Drive Anda: <b className="text-amber-300">Suqur POS - Data Laporan & Stok</b>
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-xs font-bold text-[#FAF3DD] transition-all"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
};
