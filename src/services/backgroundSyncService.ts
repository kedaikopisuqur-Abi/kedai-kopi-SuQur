import { StorageService } from './storage';

/**
 * Manual fallback upload when BackgroundSync is not supported by the browser/device or in iframe
 */
export async function kirimManualKeServer(): Promise<void> {
  try {
    await StorageService.syncLocalToFirestore();
  } catch (err) {
    // Silently ignore or debug log if offline
    console.debug('[Sync] Info sinkronisasi data:', err);
  }
}

/**
 * Panggil Background Sync untuk mendaftarkan tag 'sync-offline-orders' di Service Worker
 * Jika browser tidak mendukung SyncManager atau berjalan di dalam iframe/sandbox, otomatis beralih ke sinkronisasi langsung (direct sync).
 */
export async function panggilBackgroundSync(): Promise<void> {
  // Background Sync requires top-level window context and SyncManager support
  const isTopWindow = typeof window !== 'undefined' && window.self === window.top;

  if (isTopWindow && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'sync' in reg && typeof (reg as any).sync?.register === 'function') {
        await (reg as any).sync.register('sync-offline-orders');
        console.log('✅ Background Sync registered: sync-offline-orders');
        return;
      }
    } catch (err) {
      // In sandboxed environments or when registration is disallowed, silently use direct sync
      await kirimManualKeServer();
      return;
    }
  }

  // Fallback sinkronisasi langsung jika di dalam iframe atau browser tidak mendukung Background Sync
  await kirimManualKeServer();
}

