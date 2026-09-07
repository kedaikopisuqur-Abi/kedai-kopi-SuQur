/**
 * IndexedDB Storage Engine for Su-Qur POS
 * Provides persistent, high-capacity browser storage (virtually unlimited compared to 5MB LocalStorage)
 */

const DB_NAME = 'SuQurPOS_IndexedDB';
const DB_VERSION = 1;
const STORE_NAME = 'pos_store';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function getIDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event: Event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        
        // Handle unexpected db close / version change gracefully
        dbInstance.onversionchange = () => {
          try {
            dbInstance?.close();
          } catch (_) {}
          dbInstance = null;
          dbPromise = null;
        };

        dbInstance.onclose = () => {
          dbInstance = null;
          dbPromise = null;
        };

        dbInstance.onerror = () => {
          // Reset connection handle on fatal errors
          dbInstance = null;
          dbPromise = null;
        };

        resolve(dbInstance);
      };

      request.onerror = (event: Event) => {
        dbPromise = null;
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onblocked = () => {
        // Unblock older connections
        dbPromise = null;
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Get item from IndexedDB
 */
export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve(request.result !== undefined ? (request.result as T) : null);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (txErr) {
        // Reset cached db instance if transaction fails due to closed connection
        dbInstance = null;
        dbPromise = null;
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Set item in IndexedDB with transaction safety
 */
export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          resolve(false);
        };
      } catch (txErr) {
        dbInstance = null;
        dbPromise = null;
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Delete item from IndexedDB
 */
export async function idbDel(key: string): Promise<boolean> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (txErr) {
        dbInstance = null;
        dbPromise = null;
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Get all keys in IndexedDB
 */
export async function idbGetAllKeys(): Promise<string[]> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();

        request.onsuccess = () => {
          resolve((request.result as string[]) || []);
        };

        request.onerror = () => resolve([]);
      } catch (txErr) {
        dbInstance = null;
        dbPromise = null;
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

/**
 * Clear all data in IndexedDB
 */
export async function idbClear(): Promise<boolean> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (txErr) {
        dbInstance = null;
        dbPromise = null;
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Migration helper: Automatically copies LocalStorage items matching "suqur_pos_*" to IndexedDB.
 * Safely preserves full snapshots in IndexedDB without overwriting them with LocalStorage metadata.
 */
export async function migrateLocalStorageToIndexedDB(): Promise<{
  success: boolean;
  migratedKeys: string[];
  totalKeys: number;
}> {
  const migratedKeys: string[] = [];
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { success: false, migratedKeys: [], totalKeys: 0 };
    }

    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('suqur_pos_')) {
        lsKeys.push(key);
      }
    }

    for (const key of lsKeys) {
      try {
        // CRITICAL FIX: Do NOT overwrite suqur_pos_autobackup_history in IndexedDB if IndexedDB already has history!
        if (key === 'suqur_pos_autobackup_history') {
          const existingIDB = await idbGet<any[]>(key);
          if (existingIDB && Array.isArray(existingIDB) && existingIDB.length > 0) {
            // Check if existing IDB has at least one snapshot with data
            const hasDataPayload = existingIDB.some((s) => s && s.data);
            if (hasDataPayload) {
              // Preserve full snapshots in IndexedDB! Do not overwrite with LocalStorage meta-only.
              continue;
            }
          }
        }

        const raw = localStorage.getItem(key);
        if (raw !== null) {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            // If the item was stored as a raw primitive string (e.g. "outlet-kelapa-gading"), treat it as string
            parsed = raw;
          }
          await idbSet(key, parsed);
          migratedKeys.push(key);
        }
      } catch (err) {
        // Safe skip on individual item error
      }
    }

    return {
      success: true,
      migratedKeys,
      totalKeys: lsKeys.length,
    };
  } catch (err) {
    return {
      success: false,
      migratedKeys,
      totalKeys: 0,
    };
  }
}

/**
 * Get Storage Health & IndexedDB Status
 */
export async function getIndexedDBStatus(): Promise<{
  supported: boolean;
  keyCount: number;
  keys: string[];
  estimatedSizeKB: number;
  lsMigrated: boolean;
}> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return { supported: false, keyCount: 0, keys: [], estimatedSizeKB: 0, lsMigrated: false };
  }

  try {
    const keys = await idbGetAllKeys();
    let totalBytes = 0;

    for (const k of keys) {
      const val = await idbGet(k);
      if (val) {
        totalBytes += JSON.stringify(val).length;
      }
    }

    return {
      supported: true,
      keyCount: keys.length,
      keys,
      estimatedSizeKB: Math.round(totalBytes / 1024),
      lsMigrated: keys.length > 0,
    };
  } catch {
    return { supported: false, keyCount: 0, keys: [], estimatedSizeKB: 0, lsMigrated: false };
  }
}
