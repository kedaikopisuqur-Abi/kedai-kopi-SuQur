import { playOrderNotificationBell } from '../utils/audio';

export interface IncomingOrderNotificationPayload {
  id?: string;
  orderNo?: string;
  tableNo?: string;
  customerName?: string;
  total?: number;
  itemsCount?: number;
  orderType?: 'qr_order' | 'wa_order' | 'transaction';
  notes?: string;
}

export class NotificationService {
  /**
   * Cek apakah browser mendukung Notification API
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Status izin notifikasi saat ini ('granted', 'denied', atau 'default')
   */
  static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Meminta izin push notification ke pengguna / kasir
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('[Notification] Gagal meminta izin notifikasi:', e);
      return 'denied';
    }
  }

  /**
   * Kirim push notification ke HP/laptop saat pesanan baru masuk
   * Bekerja saat aplikasi sedang aktif maupun di-minimize di latar belakang
   */
  static async notifyIncomingOrder(payload: IncomingOrderNotificationPayload): Promise<void> {
    // Selalu bunyikan bel notifikasi
    try {
      playOrderNotificationBell();
    } catch (e) {}

    // Getar HP jika didukung
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250, 100, 250]);
      } catch (e) {}
    }

    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    const title =
      payload.orderType === 'wa_order'
        ? `💬 Pesanan WhatsApp Baru Masuk!`
        : `🔔 Pesanan QR Baru: ${payload.tableNo || 'Meja Kasir'}`;

    const bodyText = [
      payload.orderNo ? `No: ${payload.orderNo}` : '',
      payload.customerName ? `Pelanggan: ${payload.customerName}` : '',
      payload.itemsCount ? `${payload.itemsCount} Menu` : '',
      payload.total ? `Total: Rp ${payload.total.toLocaleString('id-ID')}` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    const notificationOptions: any = {
      body: bodyText || 'Pesanan pelanggan baru masuk dan siap diproses kasir.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `incoming-order-${payload.id || payload.orderNo || Date.now()}`,
      renotify: true,
      requireInteraction: true,
      data: {
        url: '/',
        orderId: payload.id,
        orderNo: payload.orderNo,
        orderType: payload.orderType || 'qr_order',
      },
    };

    // Prefer Service Worker Notification if registered
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notificationOptions);
          return;
        }
      } catch (err) {
        console.debug('[Notification] Service Worker notification fallback to standard notification:', err);
      }
    }

    // Fallback ke Web Notification standar
    try {
      const notif = new Notification(title, notificationOptions);
      notif.onclick = () => {
        window.focus();
        window.dispatchEvent(
          new CustomEvent('realtime_notification_clicked', { detail: payload })
        );
        notif.close();
      };
    } catch (e) {
      console.debug('[Notification] Gagal menampilkan web notification:', e);
    }
  }

  /**
   * Tes Notifikasi & Suara
   */
  static async testNotification(): Promise<boolean> {
    const perm = await this.requestPermission();
    if (perm !== 'granted') {
      alert('Izin notifikasi belum diizinkan di browser Anda. Mohon aktifkan izin notifikasi di pengaturan browser.');
      return false;
    }

    await this.notifyIncomingOrder({
      id: 'test-' + Date.now(),
      orderNo: 'TES-NOTIF-01',
      tableNo: 'Meja 01 (Tes)',
      customerName: 'Pelanggan Uji Coba',
      total: 35000,
      itemsCount: 2,
      orderType: 'qr_order',
    });

    return true;
  }
}
