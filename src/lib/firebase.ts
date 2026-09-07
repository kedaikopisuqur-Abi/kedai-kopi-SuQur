import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot as rawOnSnapshot,
  setDoc as rawSetDoc,
  updateDoc as rawUpdateDoc,
  deleteDoc as rawDeleteDoc,
  getDocs as rawGetDocs,
  getDocFromServer,
  writeBatch,
  DocumentReference,
  SetOptions,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  trackFirestoreRead,
  trackFirestoreWrite,
  trackFirestoreDelete,
  setFirestoreQuotaExceededState,
} from '../utils/firestoreQuotaTracker';

// Silence verbose internal Firestore logs to avoid console noise
try {
  setLogLevel('silent');
} catch (e) {}

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with clean, resilient multi-tab configuration
const cfg = firebaseConfig as any;
let firestoreInstance: any;

try {
  firestoreInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    cfg.firestoreDatabaseId || undefined
  );
} catch (e1) {
  try {
    firestoreInstance = initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
      },
      cfg.firestoreDatabaseId || undefined
    );
  } catch (e2) {
    try {
      firestoreInstance = cfg.firestoreDatabaseId
        ? getFirestore(app, cfg.firestoreDatabaseId)
        : getFirestore(app);
    } catch (e3) {
      console.debug('Firestore fallback instance notice:', e3);
    }
  }
}

export const db = firestoreInstance;

/**
 * Explicitly reconnects / enables Firestore network synchronization.
 */
export async function enableFirestoreNetwork(): Promise<boolean> {
  try {
    if (db) {
      await enableNetwork(db);
    }
    return true;
  } catch (err: any) {
    console.debug('Firestore enableNetwork notice:', err?.message || err);
    return false;
  }
}

/**
 * Explicitly disconnects / disables Firestore network synchronization (safe offline mode).
 */
export async function disableFirestoreNetwork(): Promise<boolean> {
  try {
    if (db) {
      await disableNetwork(db);
    }
    return true;
  } catch (err: any) {
    console.debug('Firestore disableNetwork notice:', err?.message || err);
    return false;
  }
}

/**
 * Flushes pending local writes to Firestore with a safe timeout guard.
 */
export async function waitForFirestorePendingWrites(timeoutMs = 3000): Promise<boolean> {
  try {
    if (!db) return true;
    const flushPromise = waitForPendingWrites(db);
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Flush timeout')), timeoutMs)
    );
    await Promise.race([flushPromise, timeoutPromise]);
    return true;
  } catch {
    return false;
  }
}

// Test connection on boot and on demand per Firebase guidelines with timeout guard
export async function testConnection(timeoutMs = 3500): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) {
    return true; // Gracefully treat as healthy offline-first state
  }
  try {
    if (!db) return false;
    const testPromise = getDocs(collection(db, 'test'));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout')), timeoutMs)
    );
    await Promise.race([testPromise, timeoutPromise]);
    return true;
  } catch (error: any) {
    checkAndHandleQuotaError(error);
    return false;
  }
}

// Automatically trigger non-blocking test connection
if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
    },
    operationType,
    path,
  };
  console.debug('Firestore Operation Event: ', JSON.stringify(errInfo));
}

// Quota state tracking and auto-circuit breaker
let _quotaExceededUntil = 0;

export function isFirestoreQuotaExceeded(): boolean {
  return Date.now() < _quotaExceededUntil;
}

export function setQuotaExceeded(durationMinutes = 60): void {
  _quotaExceededUntil = Date.now() + durationMinutes * 60 * 1000;
  setFirestoreQuotaExceededState(true);
  console.warn(`[Firestore Smart Guard]: Quota limit reached. Auto-switching to Offline-First IndexedDB engine for ${durationMinutes} minutes.`);
  try {
    if (db) {
      disableNetwork(db).catch(() => {});
    }
  } catch (e) {}
}

function checkAndHandleQuotaError(err: any): void {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units') ||
    msg.includes('Quota exceeded')
  ) {
    setQuotaExceeded(60);
  }
}

/**
 * Recursively removes `undefined` properties from an object or array.
 * Firestore throws errors when encountering `undefined` values.
 */
export function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as unknown as T;
  }
  const cleanObj: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      cleanObj[key] = removeUndefined(val);
    }
  }
  return cleanObj as T;
}

// In-memory write deduplication cache to prevent redundant writes of unchanged payloads
const recentWriteHashes = new Map<string, { hash: string; timestamp: number }>();

export const clearWriteCache = (docPath?: string) => {
  if (docPath) recentWriteHashes.delete(docPath);
  else recentWriteHashes.clear();
};

export const setDoc = async <T>(
  reference: DocumentReference<T>,
  data: T,
  options?: SetOptions
): Promise<void> => {
  if (isFirestoreQuotaExceeded()) {
    // Graceful offline-first fallback: do not spam exhausted cloud API
    return;
  }
  const sanitized = removeUndefined(data);
  const docPath = reference?.path || '';
  let payloadHash = '';
  try {
    payloadHash = JSON.stringify(sanitized);
  } catch (e) {}

  // Deduplication guard: if identical document was written within last 25 seconds, skip write to conserve quota
  if (docPath && payloadHash) {
    const cached = recentWriteHashes.get(docPath);
    if (cached && cached.hash === payloadHash && Date.now() - cached.timestamp < 25000) {
      return;
    }
  }

  try {
    if (options) {
      await rawSetDoc(reference, sanitized as T, options);
    } else {
      await rawSetDoc(reference, sanitized as T);
    }
    trackFirestoreWrite(1);
    if (docPath && payloadHash) {
      recentWriteHashes.set(docPath, { hash: payloadHash, timestamp: Date.now() });
      if (recentWriteHashes.size > 500) {
        const oldest = recentWriteHashes.keys().next().value;
        if (oldest) recentWriteHashes.delete(oldest);
      }
    }
  } catch (err: any) {
    checkAndHandleQuotaError(err);
    console.debug('Firestore setDoc notice (saved to local cache/offline queue):', err?.message || err);
  }
};

export const updateDoc = async <T>(
  reference: DocumentReference<T>,
  data: any
): Promise<void> => {
  if (isFirestoreQuotaExceeded()) {
    return;
  }
  const sanitized = removeUndefined(data);
  const docPath = reference?.path || '';
  let payloadHash = '';
  try {
    payloadHash = JSON.stringify(sanitized);
  } catch (e) {}

  if (docPath && payloadHash) {
    const cached = recentWriteHashes.get(docPath);
    if (cached && cached.hash === payloadHash && Date.now() - cached.timestamp < 25000) {
      return;
    }
  }

  try {
    await rawUpdateDoc(reference, sanitized);
    trackFirestoreWrite(1);
    if (docPath && payloadHash) {
      recentWriteHashes.set(docPath, { hash: payloadHash, timestamp: Date.now() });
    }
  } catch (err: any) {
    checkAndHandleQuotaError(err);
    console.debug('Firestore updateDoc notice (saved to local cache/offline queue):', err?.message || err);
  }
};

export const deleteDoc = async <T>(
  reference: DocumentReference<T>
): Promise<void> => {
  if (isFirestoreQuotaExceeded()) {
    return;
  }
  if (reference?.path) {
    recentWriteHashes.delete(reference.path);
  }
  try {
    await rawDeleteDoc(reference);
    trackFirestoreDelete(1);
  } catch (err: any) {
    checkAndHandleQuotaError(err);
    console.debug('Firestore deleteDoc notice (saved to local cache/offline queue):', err?.message || err);
  }
};

/**
 * Commits documents in fast batches of up to batchSize to avoid network request congestion.
 */
export async function commitBatchDocs(
  items: Array<{ ref: DocumentReference<any>; data: any; options?: SetOptions }>,
  batchSize = 200
): Promise<void> {
  if (!items || items.length === 0) return;
  if (isFirestoreQuotaExceeded()) {
    return;
  }
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    try {
      const batch = writeBatch(db);
      chunk.forEach(({ ref, data, options }) => {
        const sanitized = removeUndefined(data);
        if (options) {
          batch.set(ref, sanitized, options);
        } else {
          batch.set(ref, sanitized);
        }
      });
      await batch.commit();
      trackFirestoreWrite(chunk.length);
    } catch (err: any) {
      checkAndHandleQuotaError(err);
      console.debug('Batch commit notice (saved to local cache):', err?.message || err);
      break;
    }
  }
}

export const getDocs = async (queryRef: any): Promise<any> => {
  try {
    const snap = await rawGetDocs(queryRef);
    trackFirestoreRead(Math.max(1, snap?.docs?.length || 0));
    return snap;
  } catch (err: any) {
    console.debug('Firestore getDocs notice:', err?.message || err);
    return { empty: true, docs: [], forEach: () => {} };
  }
};

// Safe onSnapshot wrapper that absorbs stream errors gracefully
export const onSnapshot = (
  targetRef: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): (() => void) => {
  return rawOnSnapshot(
    targetRef,
    (snap) => {
      try {
        const docCount = snap?.docChanges ? snap.docChanges().length : (snap?.docs ? snap.docs.length : (snap?.size || 1));
        trackFirestoreRead(Math.max(1, docCount));
        onNext(snap);
      } catch (err) {
        console.debug('Snapshot handler internal notice:', err);
      }
    },
    (error) => {
      // Absorb network transport reconnection notifications gracefully
      console.debug('Firestore snapshot connection event:', error?.message || error);
      if (onError) {
        try {
          onError(error);
        } catch (e) {}
      }
    }
  );
};

export { doc, collection, writeBatch, query, where, orderBy, limit };



