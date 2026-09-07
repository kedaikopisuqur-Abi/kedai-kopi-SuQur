const CACHE_NAME = 'su-qur-pos-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshots/desktop-home.webp',
  '/screenshots/mobile-home.webp'
];

// Pre-cache aset statis saat install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Cache addAll partial warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - Pembersihan cache lama & klaim klien
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Offline & Asset Fetch Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Jangan cache API routes dan Firebase Firestore real-time network traffic
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Navigasi halaman HTML (SPA Navigation Fallback untuk Offline Mode)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ketika offline, sajikan index.html dari cache
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('/');
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate untuk static assets & JS/CSS/Fonts
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Notification Listener (Menerima Pesanan Masuk dari Server saat Browser/HP di-minimize)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || '🔔 Pesanan Baru Masuk - Su-Qur POS';
  const options = {
    body: data.body || 'Ada pesanan QR Self-Order / WA baru siap diproses kasir!',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: data.tag || 'incoming-order-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
      orderId: data.orderId,
      orderType: data.orderType || 'qr_order',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open_pos', title: '🛒 Buka Kasir' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handler (Membawa Kasir langsung ke layar POS)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and broadcast event
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_OPEN_ORDER',
            orderData: event.notification.data
          });
          return client.focus();
        }
      }
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Message Listener from Client (e.g. Foreground app requesting SW to trigger background notification)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'TRIGGER_BACKGROUND_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(
      title || '🔔 Pesanan Baru Masuk - Su-Qur POS',
      {
        body: options?.body || 'Pesanan baru masuk ke antrean kasir!',
        icon: options?.icon || '/icon-192.png',
        badge: options?.badge || '/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: options?.tag || 'order-' + Date.now(),
        renotify: true,
        data: options?.data || {},
        actions: [
          { action: 'open_pos', title: '🛒 Buka Kasir' },
          { action: 'dismiss', title: 'Tutup' }
        ]
      }
    );
  }
});

// Background Sync untuk transaksi offline & sinkronisasi pesanan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-orders' || event.tag === 'sync-incoming-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  console.log('[SW] Background sync triggered: sync-offline-orders');
  // Broadcast to all active clients that background sync was executed
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  allClients.forEach((client) => {
    client.postMessage({ type: 'BACKGROUND_SYNC_COMPLETED' });
  });
}

