/**
 * PWA Service Worker Entry Point for Su-Qur POS
 * Handles caching, background sync for offline orders, push notifications, and client routing.
 */

// This file is also served statically from /public/sw.js for production PWA registration
export const SW_VERSION = 'su-qur-pos-v2';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  return navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      console.log('[PWA] Service Worker registered with scope:', reg.scope);
      return reg;
    })
    .catch((err) => {
      console.warn('[PWA] Service Worker registration warning:', err);
      return null;
    });
}
