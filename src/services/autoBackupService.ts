import { idbGet, idbSet } from './idbStorage';
import { StorageService } from './storage';

export interface AutoBackupConfig {
  enabled: boolean;
  triggerOnTransaction: boolean;
  triggerOnShiftClose: boolean;
  triggerIntervalHours: number; // e.g. 12 hours
  autoDownloadOnBackup: boolean; // if true, triggers browser file download on backup
  maxHistorySnapshots: number; // default 15
  lastAutoBackupTime?: string;
}

export interface AutoBackupSnapshot {
  id: string;
  timestamp: string;
  triggerType: 'transaction' | 'shift_close' | 'interval' | 'manual';
  label: string;
  summary: {
    productCount: number;
    transactionCount: number;
    ingredientCount: number;
    shiftCount: number;
    dataSizeKB: number;
  };
  data: any;
}

const CONFIG_KEY = 'suqur_pos_autobackup_config';
const SNAPSHOTS_KEY = 'suqur_pos_autobackup_history';

export const defaultConfig: AutoBackupConfig = {
  enabled: true,
  triggerOnTransaction: true,
  triggerOnShiftClose: true,
  triggerIntervalHours: 12,
  autoDownloadOnBackup: false,
  maxHistorySnapshots: 15,
};

// Internal memory cache
let cachedConfig: AutoBackupConfig | null = null;

export const AutoBackupService = {
  /**
   * Get Auto-Backup Configuration
   */
  getConfig: (): AutoBackupConfig => {
    if (cachedConfig) return cachedConfig;
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        cachedConfig = { ...defaultConfig, ...JSON.parse(raw) };
        return cachedConfig!;
      }
    } catch (e) {
      console.warn('Error reading auto backup config:', e);
    }
    cachedConfig = { ...defaultConfig };
    return cachedConfig!;
  },

  /**
   * Save Auto-Backup Configuration
   */
  saveConfig: (newConfig: AutoBackupConfig): void => {
    cachedConfig = newConfig;
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
      idbSet(CONFIG_KEY, newConfig).catch(console.error);
    } catch (e) {
      console.error('Error saving auto backup config:', e);
    }
  },

  /**
   * Get all historical snapshots from IndexedDB (or fallback LocalStorage)
   */
  getHistory: async (): Promise<AutoBackupSnapshot[]> => {
    try {
      const idbData = await idbGet<AutoBackupSnapshot[]>(SNAPSHOTS_KEY);
      if (idbData && Array.isArray(idbData)) {
        return idbData;
      }
      const raw = localStorage.getItem(SNAPSHOTS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error loading backup history:', e);
    }
    return [];
  },

  /**
   * Save snapshot list to IndexedDB & LocalStorage
   */
  saveHistory: async (history: AutoBackupSnapshot[]): Promise<void> => {
    try {
      await idbSet(SNAPSHOTS_KEY, history);
      // Keep lightweight metadata in localStorage without full payload if too large
      const metaOnly = history.map((s) => ({
        ...s,
        data: undefined, // drop full payload in localStorage to preserve quota
      }));
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(metaOnly));
    } catch (e) {
      console.warn('Error saving backup history:', e);
    }
  },

  /**
   * Execute Auto-Backup
   */
  performBackup: async (
    triggerType: 'transaction' | 'shift_close' | 'interval' | 'manual',
    customLabel?: string
  ): Promise<AutoBackupSnapshot | null> => {
    const config = AutoBackupService.getConfig();
    if (!config.enabled && triggerType !== 'manual') {
      return null;
    }

    try {
      const products = StorageService.getProducts();
      const ingredients = StorageService.getIngredients();
      const transactions = StorageService.getTransactions();
      const suppliers = StorageService.getSuppliers();
      const purchases = StorageService.getPurchases();
      const expenses = StorageService.getExpenses();
      const stockOpnames = StorageService.getStockOpnames();
      const shifts = StorageService.getShifts();
      const settings = StorageService.getSettings();
      const users = StorageService.getUsers();

      const backupData = {
        timestamp: new Date().toISOString(),
        app: 'Su-Qur POS',
        version: '2.0.0-indexeddb',
        backupTrigger: triggerType,
        settings,
        users,
        products,
        ingredients,
        transactions,
        suppliers,
        purchases,
        expenses,
        stockOpnames,
        shifts,
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const dataSizeKB = Math.round(jsonString.length / 1024);

      let defaultLabel = 'Auto-Backup Otomatis System';
      if (triggerType === 'transaction') defaultLabel = 'Auto-Backup Selesai Transaksi';
      else if (triggerType === 'shift_close') defaultLabel = 'Auto-Backup Penutupan Shift';
      else if (triggerType === 'interval') defaultLabel = 'Auto-Backup Berkala 12-Jam';
      else if (triggerType === 'manual') defaultLabel = 'Backup Manual Pengguna';

      const nowStr = new Date().toISOString();
      const newSnapshot: AutoBackupSnapshot = {
        id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: nowStr,
        triggerType,
        label: customLabel || defaultLabel,
        summary: {
          productCount: products.length,
          transactionCount: transactions.length,
          ingredientCount: ingredients.length,
          shiftCount: shifts.length,
          dataSizeKB,
        },
        data: backupData,
      };

      // Get current history and prepend
      const existingHistory = await AutoBackupService.getHistory();
      const updatedHistory = [newSnapshot, ...existingHistory].slice(0, config.maxHistorySnapshots);

      await AutoBackupService.saveHistory(updatedHistory);

      // Update last backup time
      config.lastAutoBackupTime = nowStr;
      AutoBackupService.saveConfig(config);

      // Auto Download if configured or if manual trigger requested download
      if (config.autoDownloadOnBackup || triggerType === 'manual') {
        AutoBackupService.downloadSnapshotFile(newSnapshot);
      }

      console.log(`[Auto-Backup] Successfully created snapshot "${newSnapshot.label}" (${dataSizeKB} KB) in IndexedDB.`);
      return newSnapshot;
    } catch (err) {
      console.error('[Auto-Backup] Failed to create backup snapshot:', err);
      return null;
    }
  },

  /**
   * Helper to trigger browser download of a snapshot JSON
   */
  downloadSnapshotFile: (snapshot: AutoBackupSnapshot): void => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot.data, null, 2));
      const datePart = snapshot.timestamp.split('T')[0];
      const timePart = snapshot.timestamp.split('T')[1].substring(0, 5).replace(':', '-');
      const filename = `suqur_pos_autobackup_${datePart}_${timePart}_${snapshot.triggerType}.json`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error('[Auto-Backup] Error downloading snapshot file:', e);
    }
  },

  /**
   * Delete a snapshot from history
   */
  deleteSnapshot: async (snapshotId: string): Promise<boolean> => {
    const history = await AutoBackupService.getHistory();
    const filtered = history.filter((s) => s.id !== snapshotId);
    await AutoBackupService.saveHistory(filtered);
    return true;
  },

  /**
   * Clear all snapshot history
   */
  clearHistory: async (): Promise<boolean> => {
    await AutoBackupService.saveHistory([]);
    return true;
  },

  /**
   * Restore POS data from a snapshot object or ID
   */
  restoreFromSnapshot: async (snapshot: AutoBackupSnapshot): Promise<boolean> => {
    if (!snapshot) return false;

    let payload = snapshot.data;

    // Fallback lookup: If snapshot.data is missing, search IndexedDB directly for full snapshot
    if (!payload && snapshot.id) {
      try {
        const fullHistory = await idbGet<AutoBackupSnapshot[]>(SNAPSHOTS_KEY);
        if (fullHistory && Array.isArray(fullHistory)) {
          const match = fullHistory.find((s) => s.id === snapshot.id);
          if (match && match.data) {
            payload = match.data;
          }
        }
      } catch (e) {
        console.warn('[AutoBackup] Error querying IndexedDB for snapshot payload:', e);
      }
    }

    if (!payload) {
      console.error('[AutoBackup] Snapshot payload is missing or empty.');
      return false;
    }

    return StorageService.restoreBackupJSON(payload);
  },

  /**
   * Check if periodic interval backup should run
   */
  checkIntervalBackup: async (): Promise<void> => {
    const config = AutoBackupService.getConfig();
    if (!config.enabled) return;

    if (!config.lastAutoBackupTime) {
      await AutoBackupService.performBackup('interval', 'Auto-Backup Perdana System');
      return;
    }

    const lastTime = new Date(config.lastAutoBackupTime).getTime();
    const now = Date.now();
    const intervalMs = config.triggerIntervalHours * 3600 * 1000;

    if (now - lastTime >= intervalMs) {
      await AutoBackupService.performBackup('interval');
    }
  },
};
