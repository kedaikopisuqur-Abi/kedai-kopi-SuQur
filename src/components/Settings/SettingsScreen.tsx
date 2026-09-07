import React, { useState, useRef, useEffect } from 'react';
import { StoreSettings, User, UserRole, Outlet } from '../../types';
import { StorageService } from '../../services/storage';
import { AutoBackupService, AutoBackupConfig, AutoBackupSnapshot } from '../../services/autoBackupService';
import { resolvePublicOrderOrigin, PUBLIC_APP_ORIGIN } from '../../utils/publicUrlHelper';
import {
  checkHardwareCapabilities,
  connectBluetoothPrinter,
  connectUsbPrinter,
  openCashDrawer,
  printTestReceipt,
} from '../../services/thermalPrinterService';
import {
  Settings,
  Store,
  Printer,
  Database,
  Users,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertCircle,
  UserPlus,
  Edit3,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  Plus,
  X,
  Lock,
  UserCheck,
  Shield,
  Camera,
  Image as ImageIcon,
  QrCode,
  Clock,
  HardDrive,
  FileJson,
  CheckCircle2,
  History,
  Play,
  Save,
  FileSpreadsheet,
  Unlock,
  Radio,
  Usb,
  Wifi,
  DollarSign,
  Cpu,
  Monitor,
  Sparkles,
  Building2,
  Bell,
  Volume2,
  Sun,
  Moon,
  Palette,
  Cloud,
  Calculator,
  TrendingUp,
  Coins,
  Coffee,
  HelpCircle,
} from 'lucide-react';
import { formatRp, calculateOverheadPerCup } from '../../utils/formatters';
import { playOrderNotificationBell } from '../../utils/audio';
import { GoogleSheetsSyncModal } from '../GoogleSheets/GoogleSheetsSyncModal';
import { DatabaseInspectorModal } from '../Database/DatabaseInspectorModal';
import { syncTransactionToGoogleSheet } from '../../services/googleSheetService';
import { OutletManagementTab } from './OutletManagementTab';
import { WhatsAppIntegrationTab } from './WhatsAppIntegrationTab';
import { ServerMigrationTab } from './ServerMigrationTab';
import { ThemeSettings } from '../ThemeSettings';
import { getStoredTheme, setStoredTheme, ThemeMode } from '../../utils/theme';
import { MessageSquare } from 'lucide-react';

interface SettingsScreenProps {
  settings: StoreSettings;
  users: User[];
  currentUser?: User;
  outlets?: Outlet[];
  onSaveSettings: (settings: StoreSettings) => void;
  onSaveUsers?: (users: User[]) => void;
  onExportBackup: () => void;
  onRestoreBackup: (jsonStr: string) => boolean;
  onResetDefault: () => void;
  onResetInventory?: () => void;
  onResetOperational?: () => void;
  onResetReports?: () => void;
  onResetOperationalAndReports?: () => void;
  onResetAllEmpty?: () => void;
  onOutletsChange?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  users,
  currentUser,
  outlets,
  onSaveSettings,
  onSaveUsers,
  onExportBackup,
  onRestoreBackup,
  onResetDefault,
  onResetInventory,
  onResetOperational,
  onResetReports,
  onResetOperationalAndReports,
  onResetAllEmpty,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'store' | 'theme' | 'outlets' | 'whatsapp' | 'printer' | 'users' | 'backup' | 'migration'>('store');

  // Store profile form - ambil nama kedai dari localStorage (jika ada), atau gunakan default dari settings
  const [storeName, setStoreName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('storeName');
      if (saved && saved.trim()) return saved.trim();
    }
    return settings.storeName || 'Kedai Kopi Su-Qur';
  });
  const [customName, setCustomName] = useState<string>('');
  const [storeNameNotice, setStoreNameNotice] = useState<string | null>(null);

  // Contoh daftar pilihan kedai/brand yang tersedia
  const defaultStores = [
    'Kedai Kopi Su-Qur',
    'Kedai Kopi Wahid',
    'Su-Qur Roastery & Cafe',
  ];

  // Simpan perubahan nama ke LocalStorage & State & update real-time ke aplikasi
  const handleSelectStore = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    setStoreName(cleanName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('storeName', cleanName);
    }
    // Update live settings in parent so Header, Struk POS, Laporan update secara instan
    onSaveSettings({
      ...settings,
      storeName: cleanName,
    });
    setStoreNameNotice(`✓ Nama kedai berhasil diubah menjadi "${cleanName}" & disimpan ke localStorage.`);
    setTimeout(() => setStoreNameNotice(null), 3500);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customName.trim()) {
      handleSelectStore(customName.trim());
      setCustomName('');
    }
  };
  const [tagline, setTagline] = useState(settings.tagline);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [receiptLogoSize, setReceiptLogoSize] = useState<'small' | 'medium' | 'large' | 'none'>(settings.receiptLogoSize || 'medium');
  const [receiptHeader, setReceiptHeader] = useState(settings.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [printerPaperSize, setPrinterPaperSize] = useState<'58mm' | '80mm'>(settings.printerPaperSize || '58mm');
  const [printerConnectionType, setPrinterConnectionType] = useState<'bluetooth' | 'usb' | 'network' | 'system'>(
    settings.printerConnectionType || 'bluetooth'
  );
  const [printerNetworkIp, setPrinterNetworkIp] = useState(settings.printerNetworkIp || '192.168.1.200');
  const [printerNetworkPort, setPrinterNetworkPort] = useState<number>(settings.printerNetworkPort || 9100);
  const [printerDeviceName, setPrinterDeviceName] = useState(settings.printerDeviceName || '');
  const [autoOpenCashDrawer, setAutoOpenCashDrawer] = useState<boolean>(settings.autoOpenCashDrawer ?? true);
  const [cashDrawerPulsePin, setCashDrawerPulsePin] = useState<'pin2' | 'pin5' | 'both'>(
    settings.cashDrawerPulsePin || 'both'
  );
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(settings.autoPrintReceipt ?? false);
  const [allowCashierInventoryAccess, setAllowCashierInventoryAccess] = useState<boolean>(settings.allowCashierInventoryAccess ?? false);
  const [qrOrderSoundAlertEnabled, setQrOrderSoundAlertEnabled] = useState<boolean>(settings.qrOrderSoundAlertEnabled ?? true);
  const [qrSelfOrderEnabled, setQrSelfOrderEnabled] = useState<boolean>(settings.qrSelfOrderEnabled ?? true);
  const [publicOrderUrl, setPublicOrderUrl] = useState<string>(() =>
    resolvePublicOrderOrigin(settings)
  );
  const [autoPrintQROrders, setAutoPrintQROrders] = useState<boolean>(settings.autoPrintQROrders ?? true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    setStoredTheme(mode);
  };

  const [hardwareCaps] = useState(() => checkHardwareCapabilities());
  const [isHardwareBusy, setIsHardwareBusy] = useState(false);
  const [hardwareNotice, setHardwareNotice] = useState<{ success: boolean; message: string } | null>(null);

  const [taxPercentage, setTaxPercentage] = useState<number>(settings.taxPercentage);
  const [monthlyOperationalExpense, setMonthlyOperationalExpense] = useState<number>(
    settings.monthlyOperationalExpense ?? 12000000
  );
  const [monthlyTargetSalesCup, setMonthlyTargetSalesCup] = useState<number>(
    settings.monthlyTargetSalesCup ?? 3000
  );
  const [qrisNmid, setQrisNmid] = useState(settings.qrisNmid);
  const [qrisMerchantName, setQrisMerchantName] = useState(settings.qrisMerchantName);
  const [qrisImageUrl, setQrisImageUrl] = useState(settings.qrisImageUrl || '');

  const qrisFileInputRef = useRef<HTMLInputElement>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // Google Sheet Webhook URL State
  const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbztMYnrVKF9CO0yxMjaD63ZQX22ZREqwXa7QEFfXtB1QpunSvR0_CyyScT0fBwodMkR/exec';
  const [googleSheetWebhookUrl, setGoogleSheetWebhookUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('google_sheet_webhook_url');
      if (stored && stored.trim()) return stored;
      if (settings.googleSheetWebhookUrl && settings.googleSheetWebhookUrl.trim()) return settings.googleSheetWebhookUrl;
      // Auto initialize with the user's active webhook URL
      localStorage.setItem('google_sheet_webhook_url', DEFAULT_WEBHOOK_URL);
      return DEFAULT_WEBHOOK_URL;
    }
    return settings.googleSheetWebhookUrl || DEFAULT_WEBHOOK_URL;
  });
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestNotice, setWebhookTestNotice] = useState<{ success: boolean; message: string } | null>(null);

  const handleWebhookUrlChange = (url: string) => {
    setGoogleSheetWebhookUrl(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('google_sheet_webhook_url', url.trim());
    }
  };

  const handleSetDefaultWebhook = () => {
    handleWebhookUrlChange(DEFAULT_WEBHOOK_URL);
    setWebhookTestNotice({
      success: true,
      message: '✓ URL Webhook Google Sheet disetel ke: ' + DEFAULT_WEBHOOK_URL,
    });
  };

  const handleTestWebhook = async () => {
    const url = googleSheetWebhookUrl.trim();
    if (!url || !url.startsWith('https://script.google.com')) {
      setWebhookTestNotice({
        success: false,
        message: 'URL Webhook belum valid. Pastikan URL diawali dengan "https://script.google.com/macros/s/.../exec".',
      });
      return;
    }

    setIsTestingWebhook(true);
    setWebhookTestNotice(null);

    try {
      const sampleTx = {
        invoiceNo: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
        timestamp: new Date().toISOString(),
        cashierName: currentUser?.name || 'Kasir',
        total: 28000,
        paymentMethod: 'cash',
        items: [{ productName: 'Es Kopi Gula Aren (Tes Webhook)', quantity: 1, totalPrice: 28000 }],
      };

      const result = await syncTransactionToGoogleSheet(url, sampleTx);
      if (result.success) {
        setWebhookTestNotice({
          success: true,
          message: '✓ Berhasil terhubung! Data transaksi tes terkirim ke Webhook Google Sheets.',
        });
      } else {
        setWebhookTestNotice({
          success: false,
          message: result.message || 'Gagal mengirim data ke Webhook Google Sheets.',
        });
      }
    } catch (err: any) {
      setWebhookTestNotice({
        success: false,
        message: 'Gagal mengirim ke Webhook: ' + (err?.message || 'Error jaringan'),
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Auto-Backup JSON & IndexedDB State
  const [autoBackupConfig, setAutoBackupConfig] = useState<AutoBackupConfig>(() => AutoBackupService.getConfig());
  const [backupHistory, setBackupHistory] = useState<AutoBackupSnapshot[]>([]);
  const [idbStatus, setIdbStatus] = useState<{
    supported: boolean;
    keyCount: number;
    keys: string[];
    estimatedSizeKB: number;
    lsMigrated: boolean;
  }>({ supported: true, keyCount: 0, keys: [], estimatedSizeKB: 0, lsMigrated: true });
  const [isMigrating, setIsMigrating] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'backup') {
      refreshBackupAndIDBData();
    }
  }, [activeSubTab]);

  const refreshBackupAndIDBData = async () => {
    setAutoBackupConfig(AutoBackupService.getConfig());
    const history = await AutoBackupService.getHistory();
    setBackupHistory(history);
    const status = await StorageService.getIndexedDBStatus();
    setIdbStatus(status);
  };

  const handleUpdateAutoBackupConfig = (updates: Partial<AutoBackupConfig>) => {
    const updated = { ...autoBackupConfig, ...updates };
    setAutoBackupConfig(updated);
    AutoBackupService.saveConfig(updated);
    setBackupNotice('Konfigurasi Auto-Backup JSON berhasil disimpan!');
    setTimeout(() => setBackupNotice(null), 3000);
  };

  const handleManualBackupNow = async () => {
    setIsBackingUp(true);
    const snapshot = await AutoBackupService.performBackup('manual', 'Backup Manual Pengguna');
    setIsBackingUp(false);
    if (snapshot) {
      setBackupNotice(`Backup manual berhasil dibuat! (${snapshot.summary.dataSizeKB} KB tersimpan di IndexedDB)`);
      refreshBackupAndIDBData();
      setTimeout(() => setBackupNotice(null), 3500);
    }
  };

  const handleRestoreSnapshot = async (snapshot: AutoBackupSnapshot) => {
    if (
      window.confirm(
        `Yakin ingin memulihkan database POS ke versi snapshot tanggal ${new Date(snapshot.timestamp).toLocaleString('id-ID')}?`
      )
    ) {
      const ok = await AutoBackupService.restoreFromSnapshot(snapshot);
      if (ok) {
        alert('Data POS berhasil dipulihkan dari snapshot IndexedDB! Halaman akan dimuat ulang.');
        window.location.reload();
      } else {
        alert('Gagal memulihkan data dari snapshot.');
      }
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (window.confirm('Hapus snapshot backup ini dari riwayat IndexedDB?')) {
      await AutoBackupService.deleteSnapshot(id);
      refreshBackupAndIDBData();
    }
  };

  const handleRunIndexedDBMigration = async () => {
    setIsMigrating(true);
    const res = await StorageService.runMigrationToIndexedDB();
    setIsMigrating(false);
    if (res.success) {
      setBackupNotice(`Migrasi sukses! ${res.migratedKeys.length} kunci data telah tersimpan di IndexedDB.`);
      refreshBackupAndIDBData();
      setTimeout(() => setBackupNotice(null), 3500);
    }
  };

  // User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('kasir');
  const [formPin, setFormPin] = useState('');
  const [formAvatar, setFormAvatar] = useState('');
  const [formAssignedOutlets, setFormAssignedOutlets] = useState<string[]>(['ALL']);
  const [showFormPin, setShowFormPin] = useState(false);
  const [showPins, setShowPins] = useState<{ [userId: string]: boolean }>({});
  const [userError, setUserError] = useState<string | null>(null);
  const [userNotification, setUserNotification] = useState<string | null>(null);
  const userFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file gambar logo maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQrisImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Ukuran file gambar QRIS maksimal 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setQrisImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAll = () => {
    const cleanedWebhookUrl = googleSheetWebhookUrl.trim();
    const cleanStoreName = storeName.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('google_sheet_webhook_url', cleanedWebhookUrl);
      localStorage.setItem('storeName', cleanStoreName);
    }

    const updated: StoreSettings = {
      storeName: cleanStoreName,
      tagline: tagline.trim(),
      address: address.trim(),
      phone: phone.trim(),
      logoUrl: logoUrl.trim(),
      receiptLogoSize,
      receiptHeader,
      receiptFooter,
      printerPaperSize,
      printerConnectionType,
      printerNetworkIp: printerNetworkIp.trim(),
      printerNetworkPort: Number(printerNetworkPort) || 9100,
      printerDeviceName: printerDeviceName.trim(),
      autoOpenCashDrawer,
      cashDrawerPulsePin,
      autoPrintReceipt,
      taxPercentage,
      monthlyOperationalExpense: Math.max(0, Number(monthlyOperationalExpense) || 0),
      monthlyTargetSalesCup: Math.max(1, Number(monthlyTargetSalesCup) || 1),
      qrisNmid: qrisNmid.trim(),
      qrisMerchantName: qrisMerchantName.trim(),
      qrisImageUrl: qrisImageUrl.trim(),
      googleSheetWebhookUrl: cleanedWebhookUrl,
      allowCashierInventoryAccess,
      qrOrderSoundAlertEnabled,
      qrSelfOrderEnabled,
      publicOrderUrl: publicOrderUrl.trim() || 'https://suqur-pos.app',
      autoPrintQROrders,
      themeMode,
    };

    onSaveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const getEffectiveSettings = (): StoreSettings => ({
    ...settings,
    storeName: storeName.trim(),
    printerPaperSize,
    printerConnectionType,
    printerNetworkIp: printerNetworkIp.trim(),
    printerNetworkPort: Number(printerNetworkPort) || 9100,
    printerDeviceName: printerDeviceName.trim(),
    autoOpenCashDrawer,
    cashDrawerPulsePin,
    autoPrintReceipt,
    allowCashierInventoryAccess,
    monthlyOperationalExpense: Math.max(0, Number(monthlyOperationalExpense) || 0),
    monthlyTargetSalesCup: Math.max(1, Number(monthlyTargetSalesCup) || 1),
    qrOrderSoundAlertEnabled,
    qrSelfOrderEnabled,
    publicOrderUrl: publicOrderUrl.trim() || 'https://suqur-pos.app',
    autoPrintQROrders,
    themeMode,
  });

  const handleConnectBluetooth = async () => {
    setIsHardwareBusy(true);
    setHardwareNotice(null);
    try {
      const res = await connectBluetoothPrinter();
      if (res.success && res.deviceName) {
        setPrinterDeviceName(res.deviceName);
        setPrinterConnectionType('bluetooth');
        setHardwareNotice({
          success: true,
          message: `Berhasil terhubung ke printer Bluetooth: ${res.deviceName}`,
        });
      } else {
        setHardwareNotice({
          success: false,
          message: res.error || 'Gagal menyambungkan Bluetooth',
        });
      }
    } catch (err: any) {
      setHardwareNotice({
        success: false,
        message: err?.message || 'Gagal menyambungkan Bluetooth',
      });
    } finally {
      setIsHardwareBusy(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsHardwareBusy(true);
    setHardwareNotice(null);
    try {
      const res = await connectUsbPrinter();
      if (res.success && res.deviceName) {
        setPrinterDeviceName(res.deviceName);
        setPrinterConnectionType('usb');
        setHardwareNotice({
          success: true,
          message: `Berhasil mendeteksi printer USB: ${res.deviceName}`,
        });
      } else {
        setHardwareNotice({
          success: false,
          message: res.error || 'Gagal mendeteksi USB',
        });
      }
    } catch (err: any) {
      setHardwareNotice({
        success: false,
        message: err?.message || 'Gagal mendeteksi USB',
      });
    } finally {
      setIsHardwareBusy(false);
    }
  };

  const handleTestDrawerKick = async () => {
    setIsHardwareBusy(true);
    setHardwareNotice(null);
    try {
      const effSettings = getEffectiveSettings();
      const res = await openCashDrawer(effSettings);
      setHardwareNotice({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setHardwareNotice({
        success: false,
        message: err?.message || 'Gagal mengirim sinyal ke laci kasir',
      });
    } finally {
      setIsHardwareBusy(false);
    }
  };

  const handleTestFullPrint = async () => {
    setIsHardwareBusy(true);
    setHardwareNotice(null);
    try {
      const effSettings = getEffectiveSettings();
      const res = await printTestReceipt(effSettings);
      setHardwareNotice({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setHardwareNotice({
        success: false,
        message: err?.message || 'Gagal melakukan cetak uji coba',
      });
    } finally {
      setIsHardwareBusy(false);
    }
  };

  // User Management Handlers
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setFormName('');
    setFormRole('kasir');
    setFormPin('');
    setFormAvatar('');
    setFormAssignedOutlets(['ALL']);
    setShowFormPin(false);
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormRole(u.role);
    setFormPin(u.pin);
    setFormAvatar(u.avatar || '');
    const assigned =
      u.outletIds && u.outletIds.length > 0
        ? u.outletIds
        : u.assignedOutletId
        ? [u.assignedOutletId]
        : u.outletId
        ? [u.outletId]
        : ['ALL'];
    setFormAssignedOutlets(assigned);
    setShowFormPin(false);
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleUserAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Pilih file gambar (JPG, PNG, WebP)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePinVisibility = (userId: string) => {
    setShowPins((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleSaveUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    const trimmedName = formName.trim();
    const trimmedPin = formPin.trim();

    if (!trimmedName) {
      setUserError('Nama akun tidak boleh kosong.');
      return;
    }

    if (!trimmedPin || trimmedPin.length < 4) {
      setUserError('PIN login minimal 4 digit angka.');
      return;
    }

    if (!/^\d+$/.test(trimmedPin)) {
      setUserError('PIN login harus berupa angka.');
      return;
    }

    if (!onSaveUsers) {
      setUserError('Fungsi simpan akun tidak tersedia.');
      return;
    }

    const finalAssigned =
      formRole === 'admin' ? ['ALL'] : formAssignedOutlets.length > 0 ? formAssignedOutlets : ['ALL'];
    const primaryAssignedOutlet =
      finalAssigned.length > 0 && finalAssigned[0] !== 'ALL' ? finalAssigned[0] : undefined;

    if (editingUser) {
      // Update existing user
      const updatedList = users.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              name: trimmedName,
              role: formRole,
              pin: trimmedPin,
              avatar: formAvatar,
              outletIds: finalAssigned,
              assignedOutletId: primaryAssignedOutlet,
              outletId: primaryAssignedOutlet,
            }
          : u
      );
      onSaveUsers(updatedList);
      showNotification(`Akun ${trimmedName} berhasil diperbarui!`);
    } else {
      // Create new user
      const newUser: User = {
        id: `u-${Date.now()}`,
        name: trimmedName,
        role: formRole,
        pin: trimmedPin,
        avatar: formAvatar,
        outletIds: finalAssigned,
        assignedOutletId: primaryAssignedOutlet,
        outletId: primaryAssignedOutlet,
      };
      onSaveUsers([...users, newUser]);
      showNotification(`Akun ${trimmedName} (${formRole.toUpperCase()}) berhasil ditambahkan!`);
    }

    setIsUserModalOpen(false);
  };

  const handleDeleteUser = (u: User) => {
    if (currentUser && currentUser.id === u.id) {
      alert('Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini.');
      return;
    }

    if (users.length <= 1) {
      alert('Sistem harus memiliki minimal 1 akun terdaftar.');
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus akun "${u.name}"?`)) {
      const updatedList = users.filter((item) => item.id !== u.id);
      if (onSaveUsers) {
        onSaveUsers(updatedList);
        showNotification(`Akun "${u.name}" telah dihapus.`);
      }
    }
  };

  const showNotification = (msg: string) => {
    setUserNotification(msg);
    setTimeout(() => setUserNotification(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = onRestoreBackup(content);
      if (success) {
        setRestoreStatus('Berhasil merestore data backup JSON!');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setRestoreStatus('Gagal restore: File JSON tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#3E2723] to-[#2B1713] p-5 rounded-2xl text-[#F5EBE0] shadow-xl border border-[#4E342E]">
        <div>
          <h2 className="text-xl font-bold text-[#FAF3DD] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#D4A373]" /> Pengaturan & Hardware POS
          </h2>
          <p className="text-xs text-[#D4A373] mt-0.5">
            Konfigurasi profil cafe, printer thermal 58mm/80mm, QRIS merchant & backup data JSON
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className="px-4 py-2.5 rounded-xl bg-[#D4A373] text-[#1F1412] font-bold text-xs hover:bg-[#c39262] transition-all flex items-center justify-center gap-1.5 shadow-md self-start sm:self-auto"
        >
          {savedSuccess ? <Check className="w-4 h-4 text-emerald-900" /> : <Settings className="w-4 h-4" />}
          {savedSuccess ? 'Tersimpan!' : 'Simpan Semua Pengaturan'}
        </button>
      </div>

      {/* Settings Navigation Pills */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-2xl border border-[#E6D5C3] shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('store')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'store' ? 'bg-[#3E2723] text-[#FAF3DD]' : 'text-[#8D6E63] hover:bg-[#F5EBE0]'
          }`}
        >
          <Store className="w-4 h-4" /> Profil Cafe & QRIS
        </button>
        <button
          onClick={() => setActiveSubTab('theme')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'theme' ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs' : 'text-[#8D6E63] hover:bg-[#F5EBE0]'
          }`}
        >
          <Palette className="w-4 h-4 text-amber-500" /> Tampilan & Tema Display
        </button>
        <button
          onClick={() => setActiveSubTab('outlets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'outlets' ? 'bg-[#3E2723] text-[#FAF3DD]' : 'text-[#8D6E63] hover:bg-[#F5EBE0]'
          }`}
        >
          <Building2 className="w-4 h-4" /> Manajemen Cabang / Outlet
        </button>
        <button
          onClick={() => setActiveSubTab('whatsapp')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'whatsapp' ? 'bg-[#1B4332] text-[#FAF3DD]' : 'text-[#8D6E63] hover:bg-[#F5EBE0]'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" /> Integrasi WhatsApp
        </button>
        <button
          onClick={() => setActiveSubTab('printer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'printer' ? 'bg-[#3E2723] text-[#FAF3DD]' : 'text-[#8D6E63] hover:bg-[#F5EBE0]'
          }`}
        >
          <Printer className="w-4 h-4" /> Hardware Printer Thermal
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'users' ? 'bg-[#3E2723] text-[#FAF3DD]' : 'text-[#8D6E63] hover:bg-[#F5EBE0]'
          }`}
        >
          <Users className="w-4 h-4" /> Akun Kasir & Admin
        </button>
        <button
          onClick={() => setActiveSubTab('migration')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'migration' || activeSubTab === 'backup'
              ? 'bg-[#2B1713] text-amber-300 shadow-sm border border-amber-500/40'
              : 'text-[#8D6E63] hover:bg-[#F5EBE0]'
          }`}
        >
          <Cloud className="w-4 h-4 text-amber-500" /> Pindah Server / Backup Data
        </button>
      </div>

      {/* SUBTAB THEME: Customizer & Background Uploader */}
      {activeSubTab === 'theme' && <ThemeSettings />}

      {/* SUBTAB OUTLETS: Multi-Outlet / Cabang */}
      {activeSubTab === 'outlets' && (
        <OutletManagementTab
          settings={settings}
          onSaveSettings={onSaveSettings}
          onOutletChanged={() => {
            // Trigger storage reload
          }}
        />
      )}

      {/* SUBTAB WHATSAPP: Integrasi WhatsApp Webhook Pengeluaran */}
      {activeSubTab === 'whatsapp' && (
        <WhatsAppIntegrationTab
          settings={settings}
          outlets={outlets || StorageService.getOutlets()}
          onSaveSettings={onSaveSettings}
          onNotification={(msg) => showNotification(msg)}
        />
      )}

      {/* SUBTAB 1: Store & QRIS Profile */}
      {activeSubTab === 'store' && (
        <div className="bg-white rounded-2xl border border-[#E6D5C3] p-6 shadow-xs space-y-5">
          {/* Theme & Display Mode Preference Card */}
          <div className="bg-[#FAF3DD]/60 border-2 border-amber-500/40 p-5 rounded-2xl space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3E2723] text-amber-300 flex items-center justify-center shadow-xs">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-[#2B1713] flex items-center gap-2">
                    Tema & Tampilan Layar POS (Dark / Light Mode)
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                      Tersimpan di LocalStorage
                    </span>
                  </h4>
                  <p className="text-xs text-[#8D6E63] mt-0.5">
                    Sesuaikan skema warna tampilan aplikasi untuk kenyamanan kasir saat operasional siang maupun malam hari.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Light Mode */}
              <button
                type="button"
                onClick={() => handleThemeModeChange('light')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between gap-3 cursor-pointer ${
                  themeMode === 'light'
                    ? 'border-amber-600 bg-white shadow-md ring-2 ring-amber-500/20'
                    : 'border-[#E6D5C3] bg-[#FDFBF7] hover:border-amber-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                    <Sun className="w-5 h-5" />
                  </div>
                  {themeMode === 'light' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-600 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> AKTIF
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      PILIH
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold text-xs text-[#2B1713] block">Mode Terang (Siang)</span>
                  <p className="text-[11px] text-[#8D6E63] mt-1 leading-relaxed">
                    Nuansa cerah & hangat kopi khas Su-Qur POS dengan kontras jernih di siang hari.
                  </p>
                </div>
                {/* Mini Visual Swatch */}
                <div className="h-6 rounded-lg bg-[#F9F6F2] border border-[#E6D5C3] flex items-center px-2 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3E2723]" />
                  <div className="w-8 h-1.5 rounded-full bg-[#8D7B68]" />
                  <div className="w-5 h-1.5 rounded-full bg-amber-500 ml-auto" />
                </div>
              </button>

              {/* Option 2: Dark Mode */}
              <button
                type="button"
                onClick={() => handleThemeModeChange('dark')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between gap-3 cursor-pointer ${
                  themeMode === 'dark'
                    ? 'border-amber-500 bg-[#1A110F] text-[#FAF3DD] shadow-md ring-2 ring-amber-500/30'
                    : 'border-[#3E2924] bg-[#231714] text-[#D7CCC8] hover:border-amber-500/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-[#2B1713] flex items-center justify-center text-amber-300">
                    <Moon className="w-5 h-5 fill-amber-300/30" />
                  </div>
                  {themeMode === 'dark' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-[#1F1412] flex items-center gap-1">
                      <Check className="w-3 h-3" /> AKTIF
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3E2723] text-amber-300 border border-amber-500/30">
                      PILIH
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold text-xs text-[#FAF3DD] block">Mode Gelap (Malam)</span>
                  <p className="text-[11px] text-[#A1887F] mt-1 leading-relaxed">
                    Latar roasted espresso pekat, nyaman untuk mata & hemat baterai saat kasir malam.
                  </p>
                </div>
                {/* Mini Visual Swatch */}
                <div className="h-6 rounded-lg bg-[#140C0A] border border-[#3E2924] flex items-center px-2 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-8 h-1.5 rounded-full bg-[#A1887F]" />
                  <div className="w-5 h-1.5 rounded-full bg-[#3E2723] ml-auto" />
                </div>
              </button>

              {/* Option 3: System / Auto */}
              <button
                type="button"
                onClick={() => handleThemeModeChange('system')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between gap-3 cursor-pointer ${
                  themeMode === 'system'
                    ? 'border-indigo-600 bg-white shadow-md ring-2 ring-indigo-500/20'
                    : 'border-[#E6D5C3] bg-[#FDFBF7] hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  {themeMode === 'system' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> AKTIF
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      PILIH
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold text-xs text-[#2B1713] block">Otomatis Sistem</span>
                  <p className="text-[11px] text-[#8D6E63] mt-1 leading-relaxed">
                    Menyesuaikan tema terang atau gelap secara otomatis mengikuti setelan perangkat HP / Laptop.
                  </p>
                </div>
                {/* Mini Visual Swatch Split */}
                <div className="h-6 rounded-lg border border-[#E6D5C3] flex overflow-hidden">
                  <div className="flex-1 bg-[#F9F6F2] flex items-center justify-center">
                    <Sun className="w-3 h-3 text-amber-600" />
                  </div>
                  <div className="flex-1 bg-[#140C0A] flex items-center justify-center">
                    <Moon className="w-3 h-3 text-amber-300" />
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Logo Upload Section */}
          <div className="bg-[#FAF3DD]/40 border border-[#E6D5C3] p-4.5 rounded-2xl space-y-3">
            <div>
              <label className="font-bold text-xs text-[#2B1713] flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#3E2723]" /> Logo Kedai / Cafe
              </label>
              <p className="text-[11px] text-[#8D6E63] mt-0.5">
                Upload logo usaha Anda (PNG/JPG/SVG). Logo akan langsung tampil di Header aplikasi POS.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-[#E6D5C3]">
              {/* Preview Circle/Square */}
              <div className="w-20 h-20 rounded-2xl bg-[#F5EBE0] border-2 border-dashed border-[#D4A373] flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Store" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-serif font-black text-2xl text-[#3E2723]">
                    {storeName ? storeName.charAt(0).toUpperCase() : 'S'}
                  </span>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-3 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold text-xs cursor-pointer transition-all flex items-center gap-2 shadow-xs">
                    <Upload className="w-4 h-4 text-[#D4A373]" />
                    <span>Upload Logo Baru</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Logo</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-[#F5EBE0]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8D6E63] shrink-0">
                    Atau Link URL Gambar:
                  </span>
                  <input
                    type="text"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#E6D5C3] text-[11px] font-mono focus:outline-none focus:border-[#3E2723]"
                  />
                </div>

                <div className="pt-2 border-t border-[#F5EBE0] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#2B1713]">
                    Ukuran Logo Tampil di Struk Thermal (Paling Atas):
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReceiptLogoSize('small')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        receiptLogoSize === 'small'
                          ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                          : 'bg-[#F5EBE0] text-[#8D6E63] hover:bg-[#E6D5C3]'
                      }`}
                    >
                      Kecil (44px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptLogoSize('medium')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        receiptLogoSize === 'medium'
                          ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                          : 'bg-[#F5EBE0] text-[#8D6E63] hover:bg-[#E6D5C3]'
                      }`}
                    >
                      Sedang (64px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptLogoSize('large')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        receiptLogoSize === 'large'
                          ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                          : 'bg-[#F5EBE0] text-[#8D6E63] hover:bg-[#E6D5C3]'
                      }`}
                    >
                      Besar (88px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptLogoSize('none')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        receiptLogoSize === 'none'
                          ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                          : 'bg-[#F5EBE0] text-[#8D6E63] hover:bg-[#E6D5C3]'
                      }`}
                    >
                      Sembunyikan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h3 className="font-bold text-sm text-[#2B1713] border-b border-[#E6D5C3] pb-2 pt-2">Informasi Profil Kedai / Cafe</h3>

          {/* Form / Panel Pengaturan Nama Kedai (Dropdown & Manual Edit Input) */}
          <div className="bg-[#FAF3DD]/50 border-2 border-amber-600/30 rounded-2xl p-4.5 space-y-3.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center font-bold shrink-0">
                  <Store className="w-4 h-4 text-[#3E2723]" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#2B1713]">Pengaturan Nama Kedai</h4>
                  <p className="text-[11px] text-[#8D6E63]">
                    Pilih nama kedai dari daftar brand atau edit manual nama baru. Nilai tersimpan ke <code>localStorage['storeName']</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-[11px] font-bold text-amber-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                <span>Aktif: <strong className="font-serif italic font-black text-xs text-[#2B1713]">{storeName}</strong></span>
              </div>
            </div>

            {storeNameNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{storeNameNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Option 1: Pilih dari Daftar Kedai */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-[#E6D5C3] flex flex-col justify-between shadow-2xs">
                <div>
                  <label className="font-bold text-xs text-[#2B1713] flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-amber-700" />
                      Option 1: Pilih Kedai (Dropdown)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Dropdown List
                    </span>
                  </label>
                  <select
                    value={defaultStores.includes(storeName) ? storeName : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        handleSelectStore(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-[#FDFBF7] text-xs font-semibold text-[#2B1713] focus:outline-none focus:border-[#3E2723] focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                  >
                    {defaultStores.map((store, index) => (
                      <option key={index} value={store}>
                        {store}
                      </option>
                    ))}
                    {!defaultStores.includes(storeName) && (
                      <option value="__custom__">
                        {storeName} (Nama Kustom Aktif)
                      </option>
                    )}
                  </select>
                </div>
                <p className="text-[10px] text-[#8D6E63] mt-1">
                  Pilih salah satu dari daftar kedai di atas untuk langsung beralih dan menyimpannya ke LocalStorage.
                </p>
              </div>

              {/* Option 2: Edit / Input Nama Kedai Baru */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-[#E6D5C3] flex flex-col justify-between shadow-2xs">
                <div>
                  <label className="font-bold text-xs text-[#2B1713] flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                      Option 2: Edit / Input Nama Kedai Baru
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                      Manual Input
                    </span>
                  </label>
                  <form onSubmit={handleCustomSubmit} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ketik nama kedai baru..."
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-[#E6D5C3] bg-[#FDFBF7] text-xs text-[#2B1713] focus:outline-none focus:border-[#3E2723] focus:ring-2 focus:ring-amber-500/20 font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!customName.trim()}
                      className="px-3.5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAF3DD] font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span>Simpan Nama Baru</span>
                    </button>
                  </form>
                </div>
                <p className="text-[10px] text-[#8D6E63] mt-1">
                  Ketik nama kedai baru di atas lalu klik tombol "Simpan Nama Baru" untuk menerapkan ke sistem &amp; LocalStorage.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-[#8D6E63]">Nama Kedai / Cafe (Edit Langsung)</label>
                <span className="text-[10px] text-amber-800 font-mono font-medium">localStorage: 'storeName'</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStoreName(val);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('storeName', val);
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs font-semibold focus:outline-none focus:border-[#D4A373]"
                  placeholder="Nama Kedai..."
                />
                <button
                  type="button"
                  onClick={() => handleSelectStore(storeName)}
                  className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition-all shrink-0 cursor-pointer"
                  title="Simpan nama kedai ke localStorage dan perbarui header"
                >
                  Terapkan
                </button>
              </div>
            </div>

            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">Tagline / Slogan</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#D4A373]"
              />
            </div>

            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#D4A373]"
              />
            </div>

            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">No. WhatsApp / Telepon</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#D4A373]"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  URL Web Publik untuk Self-Ordering &amp; Pre-Order (Bebas Login)
                </label>
                <button
                  type="button"
                  onClick={() => setPublicOrderUrl(resolvePublicOrderOrigin(null))}
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Gunakan link publik resmi yang bisa dibuka pelanggan di HP tanpa login Google/GitHub"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Gunakan Domain Publik Bebas Login
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                  https://
                </div>
                <input
                  type="text"
                  placeholder="domain-anda.com atau ais-pre-..."
                  value={publicOrderUrl.replace(/^https?:\/\//i, '')}
                  onChange={(e) => setPublicOrderUrl('https://' + e.target.value.replace(/^https?:\/\//i, ''))}
                  className="w-full pl-20 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono focus:bg-white focus:border-amber-600 outline-none transition-all"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                * Domain ini digunakan di QR Code Meja &amp; link pemesanan pelanggan. Otomatis diarahkan ke domain publik bebas login agar pelanggan di HP <b>tidak perlu login email atau GitHub sama sekali</b>.
              </p>
            </div>
          </div>

          {/* CARD: Perhitungan Standar HPP & Alokasi Overhead Operasional Global */}
          <div className="bg-[#FAF3DD]/60 border-2 border-amber-600/40 p-5 rounded-2xl space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3E2723] text-amber-300 flex items-center justify-center shadow-xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-[#2B1713] flex items-center gap-2">
                    Kalkulator HPP & Alokasi Biaya Overhead Operasional (Global Kedai)
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                      RUMUS HPP OTOMATIS
                    </span>
                  </h4>
                  <p className="text-xs text-[#8D6E63] mt-0.5">
                    Integrasi 2 variabel HPP: <strong>Biaya Bahan Baku + Kemasan</strong> &amp; <strong>Alokasi Overhead per Cup</strong> (Listrik, Air, Perawatan Alat, Biaya Pekerja).
                  </p>
                </div>
              </div>

              <div className="bg-[#3E2723] text-white px-3.5 py-2 rounded-xl text-right shadow-xs self-start sm:self-auto">
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                  Overhead Terhitung / Cup:
                </span>
                <span className="text-base font-black text-white">
                  {formatRp(calculateOverheadPerCup(monthlyOperationalExpense, monthlyTargetSalesCup))} <span className="text-[11px] font-normal text-amber-200">/ porsi</span>
                </span>
              </div>
            </div>

            {/* Input Form Operasional & Target Sales Cup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 bg-white p-4 rounded-xl border border-[#E6D5C3]">
                <label className="font-bold text-[#2B1713] flex items-center justify-between">
                  <span>1. Biaya Operasional Bulanan (Rp)</span>
                  <span className="text-[10px] text-amber-800 font-extrabold">{formatRp(monthlyOperationalExpense)}</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-gray-500 text-xs">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    value={monthlyOperationalExpense || ''}
                    onChange={(e) => setMonthlyOperationalExpense(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="Contoh: 12000000"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none focus:border-[#3E2723]"
                  />
                </div>
                <div className="pt-2">
                  <span className="text-[10px] font-semibold text-[#8D6E63] block mb-1">Komponen Beban Tetap Kedai:</span>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF3DD] text-[#3E2723] text-[10px] border border-[#E6D5C3]">⚡ Listrik & Air</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF3DD] text-[#3E2723] text-[10px] border border-[#E6D5C3]">👥 Gaji / Biaya Pekerja</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF3DD] text-[#3E2723] text-[10px] border border-[#E6D5C3]">🔧 Perawatan & Servis Alat</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF3DD] text-[#3E2723] text-[10px] border border-[#E6D5C3]">🏠 Sewa Tempat & Wifi</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 bg-white p-4 rounded-xl border border-[#E6D5C3]">
                <label className="font-bold text-[#2B1713] flex items-center justify-between">
                  <span>2. Target Sales Cup / Porsi Bulanan</span>
                  <span className="text-[10px] text-amber-800 font-extrabold">
                    {monthlyTargetSalesCup.toLocaleString('id-ID')} Cup / Bulan
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="100"
                    value={monthlyTargetSalesCup || ''}
                    onChange={(e) => setMonthlyTargetSalesCup(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    placeholder="Contoh: 3000"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs focus:outline-none focus:border-[#3E2723]"
                  />
                </div>
                <div className="pt-2 text-[11px] text-[#8D6E63] space-y-1">
                  <p>
                    📊 Estimasi target harian: <strong>~{Math.round((monthlyTargetSalesCup || 3000) / 30)} cup / hari</strong>
                  </p>
                  <p>
                    💰 Beban operasional per hari: <strong>{formatRp(Math.round((monthlyOperationalExpense || 0) / 30))} / hari</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Live Formula & Calculation Breakdown Summary */}
            <div className="bg-white p-4 rounded-xl border border-[#E6D5C3] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F5EBE0] pb-2 text-xs">
                <span className="font-bold text-[#2B1713] flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> Rumus Perhitungan Otomatis:
                </span>
                <span className="text-[11px] text-gray-500">
                  Overhead per Cup = Total Biaya Operasional ÷ Target Sales Cup
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-[#FAF3DD]/80 border border-[#E6D5C3]">
                  <span className="text-[10px] text-[#8D6E63] uppercase font-bold block">Total Operasional</span>
                  <span className="font-bold text-[#3E2723] text-sm">{formatRp(monthlyOperationalExpense)}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FAF3DD]/80 border border-[#E6D5C3]">
                  <span className="text-[10px] text-[#8D6E63] uppercase font-bold block">Target Sales Cup</span>
                  <span className="font-bold text-[#3E2723] text-sm">{monthlyTargetSalesCup.toLocaleString('id-ID')} Cup</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">Alokasi Overhead / Cup</span>
                  <span className="font-black text-emerald-800 text-sm">
                    {formatRp(calculateOverheadPerCup(monthlyOperationalExpense, monthlyTargetSalesCup))} / cup
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#8D6E63] leading-relaxed bg-[#FDFBF7] p-2.5 rounded-lg border border-[#E6D5C3]">
                💡 <strong>Penerapan Otomatis:</strong> Nilai overhead <strong>{formatRp(calculateOverheadPerCup(monthlyOperationalExpense, monthlyTargetSalesCup))}</strong> per cup ini akan secara otomatis digabungkan dengan <strong>Biaya Bahan Baku + Kemasan (Cup/Sablon/Sedotan)</strong> pada modul Inventori &amp; Resep BOM untuk menentukan Total HPP dan Margin Keuntungan (Gross Profit %) setiap menu secara real-time.
              </p>
            </div>
          </div>

          <h3 className="font-bold text-sm text-[#2B1713] border-b border-[#E6D5C3] pb-2 pt-4">Konfigurasi Merchant QRIS</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">NMID Merchant QRIS</label>
              <input
                type="text"
                value={qrisNmid}
                onChange={(e) => setQrisNmid(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] font-mono text-xs focus:outline-none focus:border-[#D4A373]"
              />
            </div>

            <div>
              <label className="font-semibold text-[#8D6E63] block mb-1">Nama Merchant Tampil di QRIS</label>
              <input
                type="text"
                value={qrisMerchantName}
                onChange={(e) => setQrisMerchantName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#D4A373]"
              />
            </div>
          </div>

          {/* QRIS Image Upload Section */}
          <div className="pt-2">
            <label className="font-semibold text-[#8D6E63] block mb-1.5">
              Upload Gambar Barcode / QRIS Toko (Tampil Saat Pembayaran QRIS)
            </label>
            <input
              type="file"
              accept="image/*"
              ref={qrisFileInputRef}
              onChange={handleQrisImageUpload}
              className="hidden"
            />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#F5EBE0]/60 p-3.5 rounded-2xl border border-[#E6D5C3]">
              {qrisImageUrl ? (
                <div className="relative group shrink-0">
                  <img
                    src={qrisImageUrl}
                    alt="Preview QRIS Toko"
                    className="w-28 h-28 object-contain rounded-xl bg-white border border-gray-200 p-1 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setQrisImageUrl('')}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md text-xs transition-colors"
                    title="Hapus Gambar QRIS"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-28 h-28 rounded-xl bg-white border-2 border-dashed border-[#D4A373] flex flex-col items-center justify-center text-center p-2 text-gray-400 shrink-0">
                  <QrCode className="w-8 h-8 text-[#8D6E63] opacity-60 mb-1" />
                  <span className="text-[10px] leading-tight font-medium">Belum Ada Gambar QRIS</span>
                </div>
              )}

              <div className="space-y-2 flex-1 w-full">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => qrisFileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-4 h-4 text-[#D4A373]" /> Upload Gambar QRIS
                  </button>

                  {qrisImageUrl && (
                    <button
                      type="button"
                      onClick={() => setQrisImageUrl('')}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold border border-red-200 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-500">
                  Upload file gambar QRIS resmi dari bank/e-wallet Anda (PNG, JPG, maks 3MB). Jika diunggah, gambar ini akan langsung ditampilkan secara penuh di layar modal kasir saat pelanggan memilih metode pembayaran QRIS.
                </p>

                <div>
                  <span className="text-[10px] text-[#8D6E63] font-semibold">Atau gunakan URL Gambar QRIS:</span>
                  <input
                    type="text"
                    placeholder="https://domain.com/qris-merchant.png"
                    value={qrisImageUrl}
                    onChange={(e) => setQrisImageUrl(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[#E6D5C3] text-xs font-mono bg-white focus:outline-none focus:border-[#D4A373]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD: Integrasi Webhook Google Sheets (Auto-Sync Real-time Transaksi) */}
          <div className="bg-[#FAF3DD]/60 border-2 border-emerald-600/40 p-5 rounded-2xl space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-[#FAF3DD] flex items-center justify-center shadow-xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-[#2B1713] flex items-center gap-2">
                    Integrasi Webhook Google Sheets (Auto-Sync Real-Time)
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black border border-emerald-300">
                      LIVE POS
                    </span>
                  </h4>
                  <p className="text-xs text-[#8D6E63] mt-0.5">
                    Otomatis kirim setiap struk transaksi penjualan kasir ke Google Spreadsheet secara langsung di latar belakang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <FileSpreadsheet className="w-4 h-4" /> Buka Menu Google Sheets
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-xs text-[#2B1713] flex items-center gap-1.5">
                  <span>URL Webhook Google Apps Script:</span>
                  <span className="text-[10px] text-emerald-800 font-semibold">(Tersimpan ke localStorage)</span>
                </label>
                <button
                  type="button"
                  onClick={handleSetDefaultWebhook}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline hover:no-underline flex items-center gap-1"
                  title="Gunakan URL Webhook Aktif"
                >
                  <Sparkles className="w-3 h-3" /> Pasang URL Webhook Aktif
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={googleSheetWebhookUrl}
                  onChange={(e) => handleWebhookUrlChange(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-xs font-mono bg-white focus:outline-none focus:border-emerald-600 shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook || !googleSheetWebhookUrl}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  {isTestingWebhook ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menguji...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Tes Kirim Webhook
                    </>
                  )}
                </button>
              </div>

              {webhookTestNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
                    webhookTestNotice.success
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                      : 'bg-rose-50 text-rose-900 border border-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {webhookTestNotice.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{webhookTestNotice.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWebhookTestNotice(null)}
                    className="text-gray-400 hover:text-gray-700 font-black p-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="bg-white/80 p-3 rounded-xl border border-[#E6D5C3] text-[11px] text-[#8D6E63] space-y-1">
                <p className="font-bold text-[#2B1713]">📝 Cara Pasang Webhook Google Sheets:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[#5D4037]">
                  <li>Buka Spreadsheet Google Anda &gt; Menu <strong>Extensions (Ekstensi)</strong> &gt; <strong>Apps Script</strong>.</li>
                  <li>Tempelkan kode Apps Script Webhook penerima transaksi.</li>
                  <li>Klik <strong>Deploy &gt; New Deployment &gt; Web App</strong> (Execute as: <em>Me</em>, Who has access: <em>Anyone</em>).</li>
                  <li>Salin URL Web App yang dihasilkan (awalan <code>https://script.google.com/macros/s/.../exec</code>) lalu tempelkan di form input di atas.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* CARD: Self-Order Barcode Meja & Notifikasi Suara Bel Pesanan Masuk */}
          <div className="bg-white rounded-2xl border-2 border-[#D4A373] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3E2723] text-[#FAF3DD] flex items-center justify-center shadow-xs">
                  <QrCode className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-[#2B1713] flex items-center gap-2">
                    Self-Order Barcode Meja & Notifikasi Suara Bel
                  </h4>
                  <p className="text-xs text-[#8D6E63] mt-0.5">
                    Aktifkan pemesanan mandiri oleh pelanggan lewat scan QR code meja dan alarm bel bersuara di POS kasir.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => playOrderNotificationBell()}
                className="px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
                title="Bunyikan tes suara bel pesanan"
              >
                <Volume2 className="w-4 h-4 text-amber-700" />
                <span>Tes Bunyi Bel (Ding-Dong-Ding!)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Toggle 1: Enable Sound Alert */}
              <div className="p-4 rounded-xl bg-[#FAF3DD]/60 border border-[#E6D5C3] flex items-start justify-between gap-3">
                <div>
                  <label className="font-bold text-xs text-[#2B1713] flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-700" />
                    Notifikasi Suara Bel & Pop-up Jendela Pesanan Masuk
                  </label>
                  <p className="text-[11px] text-[#8D6E63] mt-1 leading-relaxed">
                    Mainkan suara bel dapur dan tampilkan jendela pop-up notifikasi secara otomatis seketika ada pelanggan yang memesan via Barcode Meja di cabang kasir aktif.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={qrOrderSoundAlertEnabled}
                    onChange={(e) => setQrOrderSoundAlertEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3E2723]"></div>
                </label>
              </div>

              {/* Toggle 2: Auto-Print Kitchen Ticket on QR Order */}
              <div className="p-4 rounded-xl bg-[#FAF3DD]/60 border border-[#E6D5C3] flex items-start justify-between gap-3">
                <div>
                  <label className="font-bold text-xs text-[#2B1713] flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-[#3E2723]" />
                    Otomatis Cetak Tiket Dapur saat Pesanan QR Masuk
                  </label>
                  <p className="text-[11px] text-[#8D6E63] mt-1 leading-relaxed">
                    Langsung cetak tiket pesanan dapur ke printer thermal ketika pesanan self-order barcode diterima.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoPrintQROrders}
                    onChange={(e) => setAutoPrintQROrders(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3E2723]"></div>
                </label>
              </div>
            </div>

            {/* Public Domain / URL for QR Generator */}
            <div className="p-4 rounded-xl bg-[#FAF3DD]/60 border border-[#E6D5C3] space-y-2">
              <label className="block font-bold text-xs text-[#2B1713]">
                Domain / URL Publik Pemesanan QR & Pre-Order
              </label>
              <p className="text-[11px] text-[#8D6E63]">
                Alamat domain web yang ditanamkan ke dalam barcode QR Meja & QR Pre-Order saat dicetak.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={publicOrderUrl}
                  onChange={(e) => setPublicOrderUrl(e.target.value)}
                  placeholder="https://suqur-pos.app"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-[#D4A373] bg-white text-xs font-mono text-[#2B1713] focus:outline-none focus:ring-2 focus:ring-[#3E2723]"
                />
                <button
                  type="button"
                  onClick={() => setPublicOrderUrl('https://suqur-pos.app')}
                  className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs transition-colors shrink-0"
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Printer Thermal & Cash Drawer Hardware Settings */}
      {activeSubTab === 'printer' && (
        <div className="space-y-6">
          {/* Hardware Diagnostic Notice Banner */}
          {hardwareNotice && (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-fadeIn ${
                hardwareNotice.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {hardwareNotice.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <span>{hardwareNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setHardwareNotice(null)}
                className="text-gray-400 hover:text-gray-700 font-black p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Section 1: Printer Hardware Interface Selection */}
          <div className="bg-white rounded-2xl border border-[#E6D5C3] p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6D5C3] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#2B1713] flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#8D6E63]" />
                  Koneksi Hardware Printer Kasir & Laci Uang (Cash Drawer)
                </h3>
                <p className="text-xs text-[#8D6E63] mt-0.5">
                  Hubungkan printer thermal kasir (58mm/80mm) via Bluetooth, USB Kabel, atau Jaringan WiFi/LAN untuk cetak otomatis dan buka laci uang.
                </p>
              </div>

              {/* Hardware API Detection Badges */}
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                    hardwareCaps.bluetooth
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  title={hardwareCaps.bluetooth ? 'Web Bluetooth didukung di browser ini' : 'Web Bluetooth tidak tersedia (gunakan Chrome/Android)'}
                >
                  <Radio className="w-3 h-3" /> Bluetooth {hardwareCaps.bluetooth ? '✓' : '—'}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                    hardwareCaps.usb || hardwareCaps.serial
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  title="WebUSB / Serial OTG Kabel POS"
                >
                  <Usb className="w-3 h-3" /> USB/OTG {hardwareCaps.usb || hardwareCaps.serial ? '✓' : '—'}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-800 flex items-center gap-1"
                  title="Jaringan WiFi / TCP Socket LAN"
                >
                  <Wifi className="w-3 h-3" /> LAN/WiFi ✓
                </span>
              </div>
            </div>

            {/* Connection Mode Selector Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option 1: Bluetooth */}
              <button
                type="button"
                onClick={() => setPrinterConnectionType('bluetooth')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  printerConnectionType === 'bluetooth'
                    ? 'border-[#3E2723] bg-[#F5EBE0] ring-2 ring-[#3E2723]'
                    : 'border-[#E6D5C3] bg-white hover:border-[#BCAAA4]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-[#3E2723] text-amber-200 flex items-center justify-center font-bold shadow-xs">
                    <Radio className="w-5 h-5" />
                  </div>
                  {printerConnectionType === 'bluetooth' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#3E2723] text-white">
                      Dipilih
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#2B1713]">Bluetooth Thermal</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Printer mini nirkabel (RPP02N, Panda, Hoin, Goojprt, EP-58, MPT-II).
                  </p>
                </div>
              </button>

              {/* Option 2: USB Cable */}
              <button
                type="button"
                onClick={() => setPrinterConnectionType('usb')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  printerConnectionType === 'usb'
                    ? 'border-[#3E2723] bg-[#F5EBE0] ring-2 ring-[#3E2723]'
                    : 'border-[#E6D5C3] bg-white hover:border-[#BCAAA4]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-[#3E2723] text-amber-200 flex items-center justify-center font-bold shadow-xs">
                    <Usb className="w-5 h-5" />
                  </div>
                  {printerConnectionType === 'usb' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#3E2723] text-white">
                      Dipilih
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#2B1713]">Kabel USB / OTG</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Kabel USB langsung (Epson TM-T82, Xprinter XP-58/80, Panda POS).
                  </p>
                </div>
              </button>

              {/* Option 3: WiFi / LAN Network */}
              <button
                type="button"
                onClick={() => setPrinterConnectionType('network')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  printerConnectionType === 'network'
                    ? 'border-[#3E2723] bg-[#F5EBE0] ring-2 ring-[#3E2723]'
                    : 'border-[#E6D5C3] bg-white hover:border-[#BCAAA4]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-[#3E2723] text-amber-200 flex items-center justify-center font-bold shadow-xs">
                    <Wifi className="w-5 h-5" />
                  </div>
                  {printerConnectionType === 'network' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#3E2723] text-white">
                      Dipilih
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#2B1713]">Jaringan WiFi / LAN</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Printer jaringan IP kasir / dapur (TCP Port 9100 / Raw Socket).
                  </p>
                </div>
              </button>

              {/* Option 4: System Spooler */}
              <button
                type="button"
                onClick={() => setPrinterConnectionType('system')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  printerConnectionType === 'system'
                    ? 'border-[#3E2723] bg-[#F5EBE0] ring-2 ring-[#3E2723]'
                    : 'border-[#E6D5C3] bg-white hover:border-[#BCAAA4]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-[#3E2723] text-amber-200 flex items-center justify-center font-bold shadow-xs">
                    <Monitor className="w-5 h-5" />
                  </div>
                  {printerConnectionType === 'system' && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#3E2723] text-white">
                      Dipilih
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#2B1713]">Dialog Sistem</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Menggunakan print spooler standar bawaan sistem operasi / HP.
                  </p>
                </div>
              </button>
            </div>

            {/* Connection Specific Configurations */}
            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E6D5C3] space-y-3">
              {printerConnectionType === 'bluetooth' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="font-bold text-xs text-[#2B1713] block">
                      Perangkat Bluetooth Kasir Terhubung:
                    </label>
                    <p className="text-xs font-mono text-[#3E2723] mt-0.5">
                      {printerDeviceName ? (
                        <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          ✓ {printerDeviceName}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Belum ada perangkat terpilih</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectBluetooth}
                    disabled={isHardwareBusy}
                    className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs shrink-0"
                  >
                    <Radio className="w-4 h-4 text-amber-300" />
                    <span>{isHardwareBusy ? 'Mencari Perangkat...' : 'Pindai & Sambungkan Bluetooth'}</span>
                  </button>
                </div>
              )}

              {printerConnectionType === 'usb' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="font-bold text-xs text-[#2B1713] block">
                      Perangkat Printer USB Terhubung:
                    </label>
                    <p className="text-xs font-mono text-[#3E2723] mt-0.5">
                      {printerDeviceName ? (
                        <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          ✓ {printerDeviceName}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Kabel USB belum terdeteksi</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectUsb}
                    disabled={isHardwareBusy}
                    className="px-4 py-2 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs shrink-0"
                  >
                    <Usb className="w-4 h-4 text-amber-300" />
                    <span>{isHardwareBusy ? 'Mendeteksi...' : 'Deteksi Printer USB'}</span>
                  </button>
                </div>
              )}

              {printerConnectionType === 'network' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-xs text-[#2B1713] block mb-1">
                      IP Address Printer Thermal (LAN / WiFi):
                    </label>
                    <input
                      type="text"
                      value={printerNetworkIp}
                      onChange={(e) => setPrinterNetworkIp(e.target.value)}
                      placeholder="192.168.1.200"
                      className="w-full px-3 py-2 rounded-lg border border-[#E6D5C3] text-xs font-mono bg-white focus:outline-none focus:border-[#3E2723]"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Masukkan alamat IP lokal printer thermal kasir atau dapur.
                    </p>
                  </div>
                  <div>
                    <label className="font-bold text-xs text-[#2B1713] block mb-1">
                      Port TCP / Socket:
                    </label>
                    <input
                      type="number"
                      value={printerNetworkPort}
                      onChange={(e) => setPrinterNetworkPort(Number(e.target.value) || 9100)}
                      placeholder="9100"
                      className="w-full px-3 py-2 rounded-lg border border-[#E6D5C3] text-xs font-mono bg-white focus:outline-none focus:border-[#3E2723]"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Port ESC/POS standar printer adalah <strong>9100</strong>.
                    </p>
                  </div>
                </div>
              )}

              {printerConnectionType === 'system' && (
                <p className="text-xs text-gray-600">
                  ℹ️ POS akan memanggil kotak dialog pencetakan bawaan sistem operasi (Android Print Service / Windows / Mac). Kompatibel dengan semua driver printer yang telah terpasang.
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Cash Drawer (Laci Uang Kasir) & Solenoid Pulse Settings */}
          <div className="bg-white rounded-2xl border border-[#E6D5C3] p-6 shadow-xs space-y-5">
            <div className="border-b border-[#E6D5C3] pb-3">
              <h3 className="font-bold text-sm text-[#2B1713] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                Integrasi Laci Penyimpanan Uang (Cash Drawer / Storage Cash)
              </h3>
              <p className="text-xs text-[#8D6E63] mt-0.5">
                Kendalikan laci uang kasir yang terhubung ke port <strong>RJ11 / RJ12</strong> di bagian belakang printer thermal.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Option: Auto-open Drawer on Cash Payment */}
              <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E6D5C3] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="font-bold text-xs text-[#2B1713] block">
                      Otomatis Buka Laci saat Pembayaran Tunai
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Kirim sinyal pulse listrik untuk membuka laci kasir otomatis seketika kasir menekan tombol "Selesaikan Pembayaran Tunai (Cash)".
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={autoOpenCashDrawer}
                      onChange={(e) => setAutoOpenCashDrawer(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3E2723]"></div>
                  </label>
                </div>

                <div className="pt-2 border-t border-[#E6D5C3]">
                  <label className="font-semibold text-[#8D6E63] block mb-1.5">
                    Konfigurasi Pin Pulsa RJ11 / RJ12 Laci:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCashDrawerPulsePin('both')}
                      className={`p-2 rounded-lg border text-center font-bold text-xs transition-all ${
                        cashDrawerPulsePin === 'both'
                          ? 'bg-[#3E2723] text-white border-[#3E2723]'
                          : 'bg-white text-gray-700 border-[#E6D5C3] hover:bg-[#F5EBE0]'
                      }`}
                      title="Universal (Direkomendasikan untuk semua merk laci kasir)"
                    >
                      Pin 2 & 5 (Universal)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashDrawerPulsePin('pin2')}
                      className={`p-2 rounded-lg border text-center font-bold text-xs transition-all ${
                        cashDrawerPulsePin === 'pin2'
                          ? 'bg-[#3E2723] text-white border-[#3E2723]'
                          : 'bg-white text-gray-700 border-[#E6D5C3] hover:bg-[#F5EBE0]'
                      }`}
                      title="Epson, Xprinter, Panda standar"
                    >
                      Pin 2 (Epson/XP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashDrawerPulsePin('pin5')}
                      className={`p-2 rounded-lg border text-center font-bold text-xs transition-all ${
                        cashDrawerPulsePin === 'pin5'
                          ? 'bg-[#3E2723] text-white border-[#3E2723]'
                          : 'bg-white text-gray-700 border-[#E6D5C3] hover:bg-[#F5EBE0]'
                      }`}
                      title="Star Micronics & Citizen"
                    >
                      Pin 5 (Star/Citizen)
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Box: Direct Cash Drawer Test Button */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between gap-3">
                <div>
                  <h4 className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" /> Uji Coba Laci Kasir (Cash Drawer Kick)
                  </h4>
                  <p className="text-[11px] text-amber-900/80 mt-1 leading-relaxed">
                    Uji apakah kabel RJ11 dari laci uang Anda sudah terpasang kencang ke printer dan solenoid penarik laci merespons perintah pulse.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestDrawerKick}
                    disabled={isHardwareBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                  >
                    <DollarSign className="w-4 h-4 text-amber-200" />
                    <span>{isHardwareBusy ? 'Mengirim Sinyal...' : '⚡ Buka Laci Kasir Sekarang (Test Kick)'}</span>
                  </button>

                  <p className="text-[10px] text-amber-800/80 text-center">
                    Tombol buka laci darurat juga selalu tersedia di <strong>Header Atas</strong> dan <strong>Modal Struk Kasir</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Receipt Paper, Layout & Auto-Print Settings */}
          <div className="bg-white rounded-2xl border border-[#E6D5C3] p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#2B1713] border-b border-[#E6D5C3] pb-2">
              Format Struk Thermal & Opsi Otomatis
            </h3>

            <div className="space-y-4 text-xs">
              {/* Auto Print Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6F0] border border-[#E6D5C3]">
                <div>
                  <label className="font-bold text-xs text-[#2B1713] block">
                    Otomatis Cetak Struk Setelah Transaksi Selesai
                  </label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Langsung kirim struk ke printer kasir tanpa harus menekan tombol cetak secara manual di modal receipt.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoPrintReceipt}
                    onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3E2723]"></div>
                </label>
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Ukuran Kertas Thermal Standar</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paper"
                      checked={printerPaperSize === '58mm'}
                      onChange={() => setPrinterPaperSize('58mm')}
                    />
                    <span>58 mm (Printer Mini Bluetooth Mobile)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paper"
                      checked={printerPaperSize === '80mm'}
                      onChange={() => setPrinterPaperSize('80mm')}
                    />
                    <span>80 mm (Printer Desktop Thermal POS)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Ukuran Logo Kedai di Struk (Paling Atas)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setReceiptLogoSize('small')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      receiptLogoSize === 'small'
                        ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                        : 'bg-white text-[#8D6E63] border-[#E6D5C3] hover:bg-[#F5EBE0]'
                    }`}
                  >
                    Kecil (44px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptLogoSize('medium')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      receiptLogoSize === 'medium'
                        ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                        : 'bg-white text-[#8D6E63] border-[#E6D5C3] hover:bg-[#F5EBE0]'
                    }`}
                  >
                    Sedang (64px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptLogoSize('large')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      receiptLogoSize === 'large'
                        ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                        : 'bg-white text-[#8D6E63] border-[#E6D5C3] hover:bg-[#F5EBE0]'
                    }`}
                  >
                    Besar (88px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptLogoSize('none')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      receiptLogoSize === 'none'
                        ? 'bg-[#3E2723] text-[#FAF3DD] border-[#3E2723]'
                        : 'bg-white text-[#8D6E63] border-[#E6D5C3] hover:bg-[#F5EBE0]'
                    }`}
                  >
                    Sembunyikan Logo
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Pajak PPN (%)</label>
                <input
                  type="number"
                  value={taxPercentage}
                  onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 rounded-xl border border-[#E6D5C3] font-bold text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Pesan Header Struk (Atas)</label>
                <textarea
                  rows={2}
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-[#8D6E63] block mb-1">Pesan Footer Struk (Bawah)</label>
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs font-mono"
                />
              </div>
            </div>

            {/* Complete Hardware Print & Kick Test Button */}
            <div className="pt-4 border-t border-[#E6D5C3] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Lakukan pengujian penuh untuk memeriksa hasil cetak teks, logo, pemotong kertas (paper cut), dan pembukaan laci kasir.
              </div>
              <button
                type="button"
                onClick={handleTestFullPrint}
                disabled={isHardwareBusy}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all shrink-0"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>{isHardwareBusy ? 'Mencetak Uji Coba...' : '🖨️ Cetak Struk Diagnostik & Test Buka Laci'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Users */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-[#E6D5C3] p-6 shadow-xs space-y-5">
          {/* Top Banner with Add User Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6D5C3] pb-4">
            <div>
              <h3 className="font-bold text-base text-[#2B1713] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#3E2723]" /> Kelola Akun Kasir & Administrator
              </h3>
              <p className="text-xs text-[#8D6E63] mt-0.5">
                Atur otorisasi staf, nama akun, PIN unik login, dan tingkat hak akses pengguna POS.
              </p>
            </div>

            <button
              onClick={handleOpenAddUser}
              className="px-4 py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center justify-center gap-2 shadow-xs shrink-0"
            >
              <UserPlus className="w-4 h-4 text-[#D4A373]" />
              <span>Tambah Akun Baru</span>
            </button>
          </div>

          {/* Success Notification Banner */}
          {userNotification && (
            <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{userNotification}</span>
            </div>
          )}

          {/* Otorisasi Hak Akses Modul Stok & Resep untuk Kasir */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#FAF3DD] to-[#F5EBE0] border-2 border-[#D4A373] shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3E2723] text-[#FAF3DD] flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-[#2B1713]">
                      Otorisasi Akses Modul Stok & Resep untuk Kasir
                    </h4>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        allowCashierInventoryAccess
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {allowCashierInventoryAccess ? 'Terbuka / Diizinkan' : 'Terkunci / Khusus Admin'}
                    </span>
                  </div>
                  <p className="text-xs text-[#8D6E63] mt-1 leading-relaxed">
                    Tentukan apakah pengguna dengan peran <strong>Kasir</strong> diizinkan untuk membuka modul <strong>Stok & Resep</strong>, memantau sisa bahan baku, serta melakukan audit stock opname.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowCashierInventoryAccess}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAllowCashierInventoryAccess(val);
                      const updatedSettings = {
                        ...settings,
                        allowCashierInventoryAccess: val,
                      };
                      onSaveSettings(updatedSettings);
                      setUserNotification(
                        val
                          ? '✓ Akses Modul Stok & Resep kini DIBUKA untuk Kasir.'
                          : '✓ Akses Modul Stok & Resep kini DIBATASI (Khusus Admin).'
                      );
                      setTimeout(() => setUserNotification(null), 3000);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
                <span className="text-xs font-bold text-[#2B1713]">
                  {allowCashierInventoryAccess ? 'Diizinkan' : 'Dibatasi'}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-[#8D6E63] bg-white/70 p-2.5 rounded-xl border border-[#E6D5C3] flex items-center gap-2">
              <span className="font-semibold text-[#3E2723]">Info Keamanan:</span>
              <span>
                {allowCashierInventoryAccess
                  ? 'Kasir dapat melihat daftar stok bahan baku & opname. Aksi berisiko (seperti hapus menu atau reset database) tetap dikunci hanya untuk Admin.'
                  : 'Modul Stok & Resep disembunyikan dari navigasi kasir untuk melindungi kerahasiaan komposisi resep & kalkulasi HPP COGS.'}
              </span>
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => {
              const isCurrent = currentUser?.id === u.id;
              const isVisible = !!showPins[u.id];
              return (
                <div
                  key={u.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3 relative flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-[#FAF3DD]/60 border-[#D4A373] shadow-xs'
                      : 'bg-[#FDFBF7] border-[#E6D5C3] hover:border-[#D4A373]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="relative group/avatar cursor-pointer" onClick={() => handleOpenEditUser(u)}>
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-11 h-11 rounded-2xl object-cover border-2 border-[#3E2723] shadow-xs"
                            />
                          ) : (
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-xs ${
                                u.role === 'admin'
                                  ? 'bg-gradient-to-br from-[#3E2723] to-[#2B1713] text-[#D4A373] border border-[#4E342E]'
                                  : 'bg-gradient-to-br from-[#0D9488] to-[#0f766e]'
                              }`}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-amber-200">
                            <Camera className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#2B1713] flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] bg-[#3E2723] text-white px-2 py-0.5 rounded-full font-bold">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {u.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg">
                                <Shield className="w-3 h-3 text-amber-800" /> Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg">
                                <UserCheck className="w-3 h-3 text-emerald-800" /> Kasir
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PIN Display Row */}
                    <div className="bg-white p-2.5 rounded-xl border border-[#E6D5C3] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-[#8D6E63]" />
                        <span className="text-[#8D6E63] font-medium">PIN Login:</span>
                        <span className="font-mono font-bold text-[#2B1713]">
                          {isVisible ? u.pin : '••••'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePinVisibility(u.id)}
                        className="text-[#8D6E63] hover:text-[#3E2723] p-1 rounded-lg hover:bg-[#F5EBE0]"
                        title={isVisible ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                      >
                        {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Outlet Assignment Badge */}
                    <div className="bg-white p-2 rounded-xl border border-[#E6D5C3] text-xs flex items-center gap-1.5 text-[#8D6E63]">
                      <Building2 className="w-3.5 h-3.5 text-[#3E2723] shrink-0" />
                      <span className="font-medium text-[11px]">Cabang:</span>
                      <span className="font-bold text-[#2B1713] text-[11px] truncate">
                        {u.role === 'admin' || !u.outletIds || u.outletIds.includes('ALL')
                          ? 'Semua Cabang (Akses Penuh)'
                          : u.outletIds
                              .map((id) => (outlets || StorageService.getOutlets()).find((o) => o.id === id)?.name || id)
                              .join(', ')}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#8D6E63] leading-relaxed">
                      {u.role === 'admin'
                        ? 'Akses penuh ke seluruh sistem POS, laporan keuangan, HPP resep & pengaturan.'
                        : 'Akses terbatas untuk melayani transaksi POS dan laporan shift kasir.'}
                    </p>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6D5C3]">
                    <button
                      onClick={() => handleOpenEditUser(u)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#E6D5C3] hover:bg-[#F5EBE0] text-[#3E2723] font-bold text-xs transition-all flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#3E2723]" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      disabled={isCurrent || users.length <= 1}
                      className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition-all flex items-center gap-1 ${
                        isCurrent || users.length <= 1
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      }`}
                      title={
                        isCurrent
                          ? 'Tidak bisa menghapus akun saat ini'
                          : users.length <= 1
                          ? 'Sistem butuh minimal 1 akun'
                          : 'Hapus Akun'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 4: Pindah Server, Google Drive Cloud Backup & Database Exporter */}
      {(activeSubTab === 'migration' || activeSubTab === 'backup') && (
        <div className="space-y-6">
          <ServerMigrationTab
            settings={settings}
            currentUser={currentUser}
            onSaveSettings={onSaveSettings}
            onNotification={(msg) => showNotification(msg)}
          />

          <div className="bg-white rounded-2xl border border-[#E6D5C3] p-6 shadow-xs space-y-6">
            <div>
              <h3 className="font-bold text-base text-[#2B1713] flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-[#3E2723]" /> Penyimpanan Lokal IndexedDB & Snapshot Logs
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Penyimpanan lokal perangkat menggunakan IndexedDB browser dan riwayat cadangan snapshot internal.
              </p>
            </div>

          {backupNotice && (
            <div className="bg-emerald-50 text-emerald-800 p-3.5 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{backupNotice}</span>
              </div>
              <button
                onClick={() => setBackupNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 text-[11px] underline font-medium"
              >
                Tutup
              </button>
            </div>
          )}

          {restoreStatus && (
            <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-200 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" /> {restoreStatus}
            </div>
          )}

          {/* CARD 1: Status Storage Engine IndexedDB & Migrasi Data */}
          <div className="bg-[#FAF3DD]/40 p-5 rounded-2xl border border-[#E6D5C3] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6D5C3]/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#3E2723] text-[#D4A373] flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#2B1713] flex items-center gap-2">
                    Engine Penyimpanan IndexedDB
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aktif & Ter-Migrasi
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8D6E63]">
                    Data transaksi & gambar disimpan di IndexedDB browser (Kapasitas hingga ~500MB+).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunIndexedDBMigration}
                disabled={isMigrating}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F5EBE0] text-[#3E2723] text-xs font-bold border border-[#E6D5C3] transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#D4A373] ${isMigrating ? 'animate-spin' : ''}`} />
                <span>{isMigrating ? 'Memigrasi...' : 'Sinkronkan Migrasi LocalStorage → IndexedDB'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-[#E6D5C3]/70 space-y-1">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Status Database</div>
                <div className="font-bold text-[#3E2723] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  IndexedDB Ready
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E6D5C3]/70 space-y-1">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Total Kunci Data</div>
                <div className="font-bold text-[#3E2723]">{idbStatus.keyCount} Tabel / Key</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E6D5C3]/70 space-y-1">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Perkiraan Ukuran Data</div>
                <div className="font-bold text-[#3E2723]">{idbStatus.estimatedSizeKB} KB</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E6D5C3]/70 space-y-1">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Batas Kuota Simpan</div>
                <div className="font-bold text-emerald-700">Tak Terbatas (GB)</div>
              </div>
            </div>
          </div>

          {/* CARD 2: Pengaturan Auto-Backup JSON Otomatis */}
          <div className="bg-[#FDFBF7] p-5 rounded-2xl border border-[#E6D5C3] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D4A373] text-[#1F1412] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#2B1713]">Pengaturan Auto-Backup JSON Otomatis</h4>
                  <p className="text-[11px] text-gray-500">
                    Sistem akan menyimpan cadangan snapshot JSON secara latar belakang di IndexedDB.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-[#E6D5C3]">
                  <input
                    type="checkbox"
                    checked={autoBackupConfig.enabled}
                    onChange={(e) => handleUpdateAutoBackupConfig({ enabled: e.target.checked })}
                    className="w-4 h-4 text-[#3E2723] rounded-xs accent-[#3E2723]"
                  />
                  <span className="font-bold text-xs text-[#3E2723]">
                    {autoBackupConfig.enabled ? 'Auto-Backup Aktif' : 'Auto-Backup Nonaktif'}
                  </span>
                </label>
              </div>
            </div>

            {/* Auto-Backup Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2.5 bg-white p-4 rounded-xl border border-[#E6D5C3]/70">
                <div className="font-bold text-[#3E2723] mb-1">Pemicu Otomatis (Triggers)</div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBackupConfig.triggerOnTransaction}
                    onChange={(e) => handleUpdateAutoBackupConfig({ triggerOnTransaction: e.target.checked })}
                    className="w-4 h-4 rounded-xs accent-[#3E2723]"
                  />
                  <div>
                    <span className="font-semibold text-gray-800">Backup Otomatis Selesai Transaksi Kasir</span>
                    <p className="text-[10px] text-gray-500">Membuat snapshot JSON instan setiap kali kasir menyelesaikan pembayaran.</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={autoBackupConfig.triggerOnShiftClose}
                    onChange={(e) => handleUpdateAutoBackupConfig({ triggerOnShiftClose: e.target.checked })}
                    className="w-4 h-4 rounded-xs accent-[#3E2723]"
                  />
                  <div>
                    <span className="font-semibold text-gray-800">Backup Otomatis Saat Penutupan Shift Kasir</span>
                    <p className="text-[10px] text-gray-500">Membuat snapshot JSON lengkap saat kasir menutup laporan shift harian.</p>
                  </div>
                </label>
              </div>

              <div className="space-y-2.5 bg-white p-4 rounded-xl border border-[#E6D5C3]/70">
                <div className="font-bold text-[#3E2723] mb-1">Opsi Frekuensi & Unduhan</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800">Interval Backup Berkala</span>
                  <select
                    value={autoBackupConfig.triggerIntervalHours}
                    onChange={(e) => handleUpdateAutoBackupConfig({ triggerIntervalHours: parseInt(e.target.value) || 12 })}
                    className="px-2.5 py-1 rounded-lg border border-[#E6D5C3] text-xs font-medium focus:outline-none focus:border-[#D4A373]"
                  >
                    <option value={6}>Setiap 6 Jam</option>
                    <option value={12}>Setiap 12 Jam (Rekomendasi)</option>
                    <option value={24}>Setiap 24 Jam (1 Hari)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={autoBackupConfig.autoDownloadOnBackup}
                    onChange={(e) => handleUpdateAutoBackupConfig({ autoDownloadOnBackup: e.target.checked })}
                    className="w-4 h-4 rounded-xs accent-[#3E2723]"
                  />
                  <div>
                    <span className="font-semibold text-gray-800">Otomatis Unduh File .JSON ke Browser</span>
                    <p className="text-[10px] text-gray-500">Jika dicentang, file backup .json juga akan langsung terunduh ke komputer/HP Anda.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Action & Status Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-gray-600 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#8D6E63]" />
                <span>
                  Backup Otomatis Terakhir:{' '}
                  <strong className="text-[#3E2723]">
                    {autoBackupConfig.lastAutoBackupTime
                      ? new Date(autoBackupConfig.lastAutoBackupTime).toLocaleString('id-ID')
                      : 'Belum pernah'}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleManualBackupNow}
                disabled={isBackingUp}
                className="px-4 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs shrink-0"
              >
                <Play className={`w-3.5 h-3.5 text-[#D4A373] ${isBackingUp ? 'animate-spin' : ''}`} />
                <span>{isBackingUp ? 'Memproses Backup...' : 'Jalankan Auto-Backup Sekarang'}</span>
              </button>
            </div>
          </div>

          {/* CARD 3: Riwayat Log Auto-Backup JSON (IndexedDB Snapshots) */}
          <div className="bg-white rounded-2xl border border-[#E6D5C3] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#3E2723]" />
                <h4 className="font-bold text-sm text-[#2B1713]">
                  Riwayat Snapshot Auto-Backup (IndexedDB History)
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-[#F5EBE0] text-[#3E2723] text-[10px] font-bold">
                  {backupHistory.length} Snapshot
                </span>
              </div>

              {backupHistory.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Bersihkan seluruh riwayat snapshot auto-backup dari IndexedDB?')) {
                      await AutoBackupService.clearHistory();
                      refreshBackupAndIDBData();
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Riwayat Snapshot
                </button>
              )}
            </div>

            {backupHistory.length === 0 ? (
              <div className="p-8 text-center bg-[#FAF3DD]/30 rounded-2xl border border-dashed border-[#E6D5C3]">
                <FileJson className="w-10 h-10 text-[#D4A373] mx-auto mb-2 opacity-60" />
                <div className="font-bold text-xs text-[#3E2723]">Belum ada snapshot auto-backup</div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Lakukan transaksi kasir atau klik "Jalankan Auto-Backup Sekarang" untuk membuat snapshot otomatis pertama.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {backupHistory.map((snap) => {
                  let triggerBadgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
                  let triggerText = 'Auto-Backup';

                  if (snap.triggerType === 'transaction') {
                    triggerBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                    triggerText = 'Kasir Transaksi';
                  } else if (snap.triggerType === 'shift_close') {
                    triggerBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
                    triggerText = 'Penutupan Shift';
                  } else if (snap.triggerType === 'interval') {
                    triggerBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                    triggerText = 'Berkala 12-Jam';
                  } else if (snap.triggerType === 'manual') {
                    triggerBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    triggerText = 'Manual Pengguna';
                  }

                  return (
                    <div
                      key={snap.id}
                      className="bg-[#FDFBF7] p-3.5 rounded-xl border border-[#E6D5C3] hover:border-[#D4A373] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${triggerBadgeClass}`}
                          >
                            {triggerText}
                          </span>
                          <span className="font-bold text-xs text-[#2B1713]">{snap.label}</span>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {new Date(snap.timestamp).toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>📦 <strong>{snap.summary?.productCount || 0}</strong> Menu</span>
                          <span>🛒 <strong>{snap.summary?.transactionCount || 0}</strong> Transaksi</span>
                          <span>⏱️ <strong>{snap.summary?.shiftCount || 0}</strong> Shift</span>
                          <span>💾 Ukuran: <strong>{snap.summary?.dataSizeKB || 0} KB</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => AutoBackupService.downloadSnapshotFile(snap)}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F5EBE0] text-[#3E2723] text-xs font-bold border border-[#E6D5C3] flex items-center gap-1 transition-colors"
                          title="Unduh File JSON Snapshot Ini"
                        >
                          <Download className="w-3.5 h-3.5 text-[#D4A373]" /> Unduh JSON
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRestoreSnapshot(snap)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#D4A373] hover:bg-[#c39262] text-[#1F1412] text-xs font-bold flex items-center gap-1 transition-colors"
                          title="Pulihkan POS ke Snapshot Ini"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Restore
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSnapshot(snap.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Hapus Snapshot Ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CARD 3.5: Google Sheets Live Sync Integration */}
          <div className="bg-gradient-to-br from-[#2B1713] to-[#1F1412] text-[#FAF3DD] p-5 rounded-2xl border-2 border-emerald-500/60 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-[#FAF3DD]">Google Sheets Live Integration</h4>
                  <p className="text-xs text-[#D7CCC8]">
                    Ekspor & sinkronkan laporan transaksi, katalog produk & stok, dan pengeluaran ke Google Spreadsheets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" /> Buka Google Sheets Sync
              </button>
            </div>
          </div>

          {/* CARD 3.6: Database Terbuka & Inspector Data Tersembunyi */}
          <div className="bg-gradient-to-br from-[#1F1412] to-[#2B1713] text-[#FAF3DD] p-5 rounded-2xl border-2 border-amber-500/60 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-500/50 flex items-center justify-center text-amber-400">
                  <Database className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-[#FAF3DD] flex items-center gap-2">
                    Database Terbuka & Data Tersembunyi
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/40 flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Unlocked
                    </span>
                  </h4>
                  <p className="text-xs text-[#D7CCC8]">
                    Buka, jelajahi, dan inspeksi seluruh tabel mentah JSON (IndexedDB, LocalStorage, Cloud Firestore & Backup)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDatabaseModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
              >
                <Eye className="w-4 h-4" /> Buka Database Inspector
              </button>
            </div>
          </div>

          {/* CARD 4: Export Manual & Import Restore JSON */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#E6D5C3] pt-5">
            {/* Export Backup Button */}
            <div className="bg-[#FDFBF7] p-5 rounded-2xl border border-[#E6D5C3] space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[#3E2723]">
                <Download className="w-5 h-5 text-[#D4A373]" /> Unduh File Backup JSON Manual
              </div>
              <p className="text-xs text-gray-600">
                Unduh langsung seluruh riwayat transaksi, katalog menu, resep & stok dalam satu file `.json`.
              </p>
              <button
                type="button"
                onClick={onExportBackup}
                className="w-full py-2.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#D4A373]" /> Unduh File Backup JSON
              </button>
            </div>

            {/* Restore Backup Button */}
            <div className="bg-[#FDFBF7] p-5 rounded-2xl border border-[#E6D5C3] space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[#3E2723]">
                <Upload className="w-5 h-5 text-[#D4A373]" /> Restore Data dari File JSON
              </div>
              <p className="text-xs text-gray-600">
                Pilih dan unggah file `.json` backup terdahulu untuk mengembalikan seluruh database POS.
              </p>
              <label className="w-full py-2.5 rounded-xl bg-[#D4A373] text-[#1F1412] font-bold text-xs hover:bg-[#c39262] transition-all shadow-xs text-center block cursor-pointer flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Pilih File JSON Restore
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* CARD 5: Reset & Kosongkan Data Per Modul */}
          <div className="border-t border-red-100 pt-5 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-red-800 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-red-600" /> Kosongkan & Reset Data per Modul
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Hapus data secara spesifik agar siap di-input dengan data toko baru.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Reset Stok & Resep */}
              <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-200/60 flex flex-col justify-between space-y-2">
                <div>
                  <div className="font-bold text-xs text-[#2B1713]">Data Stok & Resep</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Hapus seluruh menu, bahan baku, & opname.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Yakin ingin menghapus? Seluruh data stok dan resep akan dikosongkan.')) {
                      onResetInventory?.();
                      alert('Data Stok & Resep telah berhasil dikosongkan.');
                    }
                  }}
                  className="w-full py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset Stok & Resep
                </button>
              </div>

              {/* Reset Operasional */}
              <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-200/60 flex flex-col justify-between space-y-2">
                <div>
                  <div className="font-bold text-xs text-[#2B1713]">Data Operasional</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Hapus beban pengeluaran, PO, & supplier.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Yakin ingin menghapus? Seluruh data operasional akan dikosongkan.')) {
                      onResetOperational?.();
                      alert('Data Operasional telah berhasil dikosongkan.');
                    }
                  }}
                  className="w-full py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset Operasional
                </button>
              </div>

              {/* Reset Laporan & Transaksi */}
              <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-200/60 flex flex-col justify-between space-y-2">
                <div>
                  <div className="font-bold text-xs text-[#2B1713]">Data Laporan & Transaksi</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Hapus riwayat faktur & shift kasir.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Yakin ingin menghapus? Seluruh data transaksi dan laporan akan dikosongkan.')) {
                      onResetReports?.();
                      alert('Data Laporan & Transaksi telah berhasil dikosongkan.');
                    }
                  }}
                  className="w-full py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset Laporan
                </button>
              </div>
            </div>

            {/* Combined Reset Operasional + Laporan (Periode 1 Bulan Balance) */}
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
              <div>
                <div className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-700" />
                  Kosongkan Operasional & Laporan Transaksi (Rp 0 - Periode 1 Bulan)
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  Kosongkan beban pengeluaran, PO, supplier, faktur transaksi, & shift kasir menjadi Rp 0 untuk keseimbangan laporan periode 1 bulan (Master produk & menu tetap aman).
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Yakin ingin menghapus seluruh pencatatan operasional & laporan transaksi menjadi Rp 0 agar periode 1 bulan kembali seimbang?'
                    )
                  ) {
                    if (onResetOperationalAndReports) {
                      onResetOperationalAndReports();
                    } else {
                      onResetOperational?.();
                      onResetReports?.();
                    }
                    alert('✓ Pencatatan operasional dan laporan telah dikosongkan ke Rp 0. Periode 1 bulan kini seimbang.');
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 w-full sm:w-auto justify-center shrink-0"
              >
                <Trash2 className="w-4 h-4" /> Reset Operasional & Laporan (Rp 0)
              </button>
            </div>

            {/* Reset All & Default */}
            <div className="bg-rose-100/60 p-4 rounded-2xl border border-rose-300 flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
              <div>
                <div className="font-bold text-xs text-rose-900">Kosongkan Seluruh Data Database POS</div>
                <div className="text-[11px] text-rose-800">
                  Hapus SEMUA stok, resep, pengeluaran, & transaksi sekaligus menjadi bersih kosong.
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Yakin ingin menghapus? Seluruh database stok, resep, operasional, dan laporan akan dikosongkan.')) {
                      onResetAllEmpty?.();
                      alert('Seluruh data database POS telah berhasil dikosongkan.');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 w-full sm:w-auto justify-center"
                >
                  <Trash2 className="w-4 h-4" /> Kosongkan Seluruh Data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Yakin ingin menghapus? Data akan dikembalikan ke data sampel bawaan awal.')) {
                      onResetDefault();
                      window.location.reload();
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold border border-gray-300 transition-colors shrink-0"
                >
                  Reset Sampel Awal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Modal Edit / Tambah Akun Kasir & Admin */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#E6D5C3] space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E6D5C3] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-[#3E2723] text-[#D4A373] flex items-center justify-center">
                  {editingUser ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#2B1713]">
                    {editingUser ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna'}
                  </h3>
                  <p className="text-[11px] text-[#8D6E63]">
                    {editingUser ? 'Perbarui detail staf kasir / admin' : 'Buat kredensial kasir atau admin baru'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F5EBE0] hover:bg-[#E6D5C3] text-[#3E2723] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            {userError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{userError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveUserForm} className="space-y-4">
              {/* Foto Profil Upload */}
              <div className="bg-[#FAF3DD]/50 p-3.5 rounded-2xl border border-[#E6D5C3] space-y-2">
                <label className="font-bold text-xs text-[#3E2723] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#D4A373]" /> Foto Profil / Avatar Akun
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#F5EBE0] border-2 border-[#3E2723] flex items-center justify-center shrink-0 shadow-xs">
                    {formAvatar ? (
                      <img src={formAvatar} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-lg text-[#3E2723]">
                        {formName ? formName.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      ref={userFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUserAvatarFileUpload}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => userFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#D4A373]" /> Upload Foto HP/File
                      </button>
                      {formAvatar && (
                        <button
                          type="button"
                          onClick={() => setFormAvatar('')}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs hover:bg-rose-200"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500">Format: JPG, PNG, WEBP. Bisa upload langsung dari HP atau Laptop.</p>
                  </div>
                </div>
              </div>

              {/* Nama Pengguna */}
              <div>
                <label className="font-bold text-xs text-[#3E2723] block mb-1">
                  Nama Lengkap / Staf <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya (Kasir Shift Pagi)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-xs font-bold text-[#2B1713] focus:outline-none focus:border-[#3E2723] focus:ring-1 focus:ring-[#3E2723]"
                />
              </div>

              {/* Select Role */}
              <div>
                <label className="font-bold text-xs text-[#3E2723] block mb-1.5">
                  Peran & Hak Akses Sistem <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      formRole === 'kasir'
                        ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                        : 'bg-white border-[#E6D5C3] hover:bg-[#FDFBF7]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#2B1713] flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-700" /> Kasir
                      </span>
                      <input
                        type="radio"
                        name="role"
                        value="kasir"
                        checked={formRole === 'kasir'}
                        onChange={() => setFormRole('kasir')}
                        className="accent-emerald-700"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Akses operasional POS & Buka/Tutup Kasir.
                    </p>
                  </label>

                  <label
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      formRole === 'admin'
                        ? 'bg-[#3E2723]/10 border-[#3E2723] ring-1 ring-[#3E2723] shadow-xs'
                        : 'bg-white border-[#E6D5C3] hover:bg-[#FDFBF7]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#2B1713] flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-amber-800" /> Admin
                      </span>
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={formRole === 'admin'}
                        onChange={() => setFormRole('admin')}
                        className="accent-[#3E2723]"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Akses penuh ke Laporan, HPP, Stok, & Pengaturan.
                    </p>
                  </label>
                </div>
              </div>

              {/* PIN Code */}
              <div>
                <label className="font-bold text-xs text-[#3E2723] block mb-1">
                  PIN Login (Angka) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showFormPin ? 'text' : 'password'}
                    required
                    maxLength={8}
                    placeholder="Minimal 4 digit angka (e.g. 1234)"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#E6D5C3] font-mono font-bold text-sm tracking-widest text-[#2B1713] focus:outline-none focus:border-[#3E2723] focus:ring-1 focus:ring-[#3E2723]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPin(!showFormPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D6E63] hover:text-[#3E2723] p-1 rounded-lg"
                  >
                    {showFormPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#8D6E63] mt-1">
                  Digunakan untuk login cepat saat berpindah kasir.
                </p>
              </div>

              {/* Outlet Assignment Section */}
              <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#E6D5C3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs text-[#3E2723] flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#D4A373]" /> Penugasan Cabang / Outlet
                  </label>
                  {formRole === 'admin' ? (
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                      Akses Semua Cabang
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-600 font-medium">
                      {formAssignedOutlets.includes('ALL')
                        ? 'Semua Cabang'
                        : `${formAssignedOutlets.length} Cabang Dipilih`}
                    </span>
                  )}
                </div>

                {formRole === 'admin' ? (
                  <p className="text-[11px] text-[#8D6E63] bg-white p-2.5 rounded-xl border border-[#E6D5C3]">
                    Akun <strong>Admin / Manager</strong> memiliki hak akses master dan dapat masuk di seluruh cabang tanpa batasan.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* Toggle All Outlets */}
                    <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-[#E6D5C3] cursor-pointer hover:bg-[#FDFBF7]">
                      <input
                        type="checkbox"
                        checked={formAssignedOutlets.includes('ALL')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormAssignedOutlets(['ALL']);
                          } else {
                            const activeList = (outlets || StorageService.getOutlets()).filter((o) => o.isActive !== false);
                            setFormAssignedOutlets(activeList.map((o) => o.id));
                          }
                        }}
                        className="w-4 h-4 rounded text-[#3E2723] focus:ring-[#3E2723] accent-[#3E2723]"
                      />
                      <span className="text-xs font-bold text-[#2B1713]">
                        Izinkan Kasir Login di Semua Cabang
                      </span>
                    </label>

                    {!formAssignedOutlets.includes('ALL') && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-[#8D6E63] uppercase tracking-wider block">
                          Pilih Cabang Khusus Kasir Ini:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(outlets || StorageService.getOutlets())
                            .filter((o) => o.isActive !== false)
                            .map((outlet) => {
                              const isChecked = formAssignedOutlets.includes(outlet.id);
                              return (
                                <label
                                  key={outlet.id}
                                  className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-emerald-50/80 border-emerald-500 text-[#2B1713]'
                                      : 'bg-white border-[#E6D5C3] text-[#8D6E63] hover:bg-[#FDFBF7]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormAssignedOutlets((prev) => [
                                          ...prev.filter((id) => id !== 'ALL'),
                                          outlet.id,
                                        ]);
                                      } else {
                                        const remaining = formAssignedOutlets.filter((id) => id !== outlet.id);
                                        setFormAssignedOutlets(remaining.length > 0 ? remaining : ['ALL']);
                                      }
                                    }}
                                    className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 shrink-0"
                                  />
                                  <div className="text-xs leading-tight">
                                    <div className="font-bold text-[#2B1713]">{outlet.name}</div>
                                    <div className="text-[10px] text-gray-500 truncate max-w-[170px]">
                                      {outlet.address}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6D5C3]">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F5EBE0] hover:bg-[#E6D5C3] text-[#3E2723] font-bold text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#3E2723] hover:bg-[#4E342E] text-[#FAF3DD] font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-[#D4A373]" />
                  <span>{editingUser ? 'Simpan Perubahan' : 'Tambah Akun'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
      />

      {/* Database Terbuka & Inspector Modal */}
      <DatabaseInspectorModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
      />
    </div>
  );
};
