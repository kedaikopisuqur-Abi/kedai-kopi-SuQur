/**
 * Firestore Daily Operational API Quota Tracker
 * Tracks real-time Read, Write, and Delete operations against Firestore standard daily free limits (Spark Tier).
 * Auto-resets daily at 00:00 midnight local time.
 */

export interface FirestoreQuotaStats {
  date: string; // YYYY-MM-DD
  readsUsed: number;
  writesUsed: number;
  deletesUsed: number;
  readLimit: number;
  writeLimit: number;
  deleteLimit: number;
  lastOperationTime: string;
  lastOperationType: 'read' | 'write' | 'delete' | 'init';
  isQuotaExceeded: boolean;
}

export interface FirestoreQuotaRemaining {
  readsRemaining: number;
  writesRemaining: number;
  readPercentageRemaining: number; // 0 to 100
  writePercentageRemaining: number; // 0 to 100
  overallPercentageRemaining: number; // 0 to 100
  readPercentageUsed: number;
  writePercentageUsed: number;
  isWarning: boolean; // < 25% remaining
  isCritical: boolean; // < 10% remaining
  isExceeded: boolean;
  timeUntilReset: string;
  hoursUntilReset: number;
}

const STORAGE_KEY = 'sq_firestore_daily_quota_stats_v1';

// Standard Google Cloud Firestore Spark Plan limits
export const DEFAULT_DAILY_READ_LIMIT = 50000;
export const DEFAULT_DAILY_WRITE_LIMIT = 20000;
export const DEFAULT_DAILY_DELETE_LIMIT = 20000;

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultStats(): FirestoreQuotaStats {
  return {
    date: getTodayString(),
    readsUsed: 0,
    writesUsed: 0,
    deletesUsed: 0,
    readLimit: DEFAULT_DAILY_READ_LIMIT,
    writeLimit: DEFAULT_DAILY_WRITE_LIMIT,
    deleteLimit: DEFAULT_DAILY_DELETE_LIMIT,
    lastOperationTime: new Date().toISOString(),
    lastOperationType: 'init',
    isQuotaExceeded: false,
  };
}

let cachedStats: FirestoreQuotaStats | null = null;
let broadcastTimer: any = null;

export function getFirestoreQuotaStats(): FirestoreQuotaStats {
  const today = getTodayString();
  if (cachedStats && cachedStats.date === today) {
    return cachedStats;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FirestoreQuotaStats;
      if (parsed && parsed.date === today) {
        cachedStats = {
          ...getDefaultStats(),
          ...parsed,
          readLimit: parsed.readLimit || DEFAULT_DAILY_READ_LIMIT,
          writeLimit: parsed.writeLimit || DEFAULT_DAILY_WRITE_LIMIT,
          deleteLimit: parsed.deleteLimit || DEFAULT_DAILY_DELETE_LIMIT,
        };
        return cachedStats;
      }
    }
  } catch (e) {
    console.debug('[QuotaTracker] Failed reading stored quota:', e);
  }

  // New day or first run: initialize today's counters
  cachedStats = getDefaultStats();
  saveStats(cachedStats);
  return cachedStats;
}

function saveStats(stats: FirestoreQuotaStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.debug('[QuotaTracker] Storage write failed:', e);
  }
}

function broadcastUpdate(): void {
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    try {
      const stats = getFirestoreQuotaStats();
      const remaining = getFirestoreQuotaRemaining();
      window.dispatchEvent(
        new CustomEvent('firestore_quota_updated', {
          detail: { stats, remaining },
        })
      );
    } catch (e) {}
  }, 100);
}

export function trackFirestoreRead(count = 1): void {
  if (count <= 0) return;
  const stats = getFirestoreQuotaStats();
  stats.readsUsed += count;
  stats.lastOperationTime = new Date().toISOString();
  stats.lastOperationType = 'read';
  saveStats(stats);
  broadcastUpdate();
}

export function trackFirestoreWrite(count = 1): void {
  if (count <= 0) return;
  const stats = getFirestoreQuotaStats();
  stats.writesUsed += count;
  stats.lastOperationTime = new Date().toISOString();
  stats.lastOperationType = 'write';
  saveStats(stats);
  broadcastUpdate();
}

export function trackFirestoreDelete(count = 1): void {
  if (count <= 0) return;
  const stats = getFirestoreQuotaStats();
  stats.deletesUsed += count;
  stats.lastOperationTime = new Date().toISOString();
  stats.lastOperationType = 'delete';
  saveStats(stats);
  broadcastUpdate();
}

export function setFirestoreQuotaExceededState(isExceeded: boolean): void {
  const stats = getFirestoreQuotaStats();
  stats.isQuotaExceeded = isExceeded;
  saveStats(stats);
  broadcastUpdate();
}

export function resetFirestoreQuotaStats(): void {
  cachedStats = getDefaultStats();
  saveStats(cachedStats);
  broadcastUpdate();
}

export function simulateLowQuota(percentageRemaining = 8): void {
  const stats = getFirestoreQuotaStats();
  const ratio = Math.max(0.01, Math.min(0.095, percentageRemaining / 100));
  stats.readsUsed = Math.floor(stats.readLimit * (1 - ratio));
  stats.writesUsed = Math.floor(stats.writeLimit * (1 - ratio));
  stats.lastOperationTime = new Date().toISOString();
  stats.lastOperationType = 'write';
  saveStats(stats);
  broadcastUpdate();
}

export function getTimeUntilMidnight(): { text: string; hours: number; minutes: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return {
    text: `${diffHrs} jam ${diffMins} mnt`,
    hours: diffHrs,
    minutes: diffMins,
  };
}

export function getFirestoreQuotaRemaining(): FirestoreQuotaRemaining {
  const stats = getFirestoreQuotaStats();
  const time = getTimeUntilMidnight();

  const readsRemaining = Math.max(0, stats.readLimit - stats.readsUsed);
  const totalWritesAndDeletes = stats.writesUsed + stats.deletesUsed;
  const writesRemaining = Math.max(0, stats.writeLimit - totalWritesAndDeletes);

  const readPercentageRemaining = Number(
    Math.max(0, Math.min(100, (readsRemaining / stats.readLimit) * 100)).toFixed(1)
  );
  const writePercentageRemaining = Number(
    Math.max(0, Math.min(100, (writesRemaining / stats.writeLimit) * 100)).toFixed(1)
  );

  const overallPercentageRemaining = Number(
    Math.min(readPercentageRemaining, writePercentageRemaining).toFixed(1)
  );

  const readPercentageUsed = Number((100 - readPercentageRemaining).toFixed(1));
  const writePercentageUsed = Number((100 - writePercentageRemaining).toFixed(1));

  const isWarning = overallPercentageRemaining <= 25 && overallPercentageRemaining > 10;
  const isCritical = overallPercentageRemaining <= 10;
  const isExceeded = stats.isQuotaExceeded || readsRemaining === 0 || writesRemaining === 0;

  return {
    readsRemaining,
    writesRemaining,
    readPercentageRemaining,
    writePercentageRemaining,
    overallPercentageRemaining,
    readPercentageUsed,
    writePercentageUsed,
    isWarning,
    isCritical,
    isExceeded,
    timeUntilReset: time.text,
    hoursUntilReset: time.hours,
  };
}

export function subscribeQuotaUpdates(
  callback: (stats: FirestoreQuotaStats, remaining: FirestoreQuotaRemaining) => void
): () => void {
  const handler = () => {
    callback(getFirestoreQuotaStats(), getFirestoreQuotaRemaining());
  };

  window.addEventListener('firestore_quota_updated', handler);
  // Send initial data immediately
  handler();

  return () => {
    window.removeEventListener('firestore_quota_updated', handler);
  };
}
