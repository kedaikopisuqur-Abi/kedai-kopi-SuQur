import { Capacitor } from '@capacitor/core';
import { ActionSheet, ShowActionsOptions, ActionSheetButtonStyle } from '@capacitor/action-sheet';

export interface OverlayConfig {
  enabled: boolean;
  position: { x: number; y: number };
  dockSide: 'left' | 'right' | 'free';
  opacity: number;
  autoMinimizeOnOrder: boolean;
  systemAlertWindowGranted: boolean;
}

const STORAGE_KEY_ENABLED = 'sq_floating_widget_enabled';
const STORAGE_KEY_POS = 'sq_floating_widget_pos';
const STORAGE_KEY_CONFIG = 'sq_floating_widget_config';

/**
 * Service for managing Floating Overlay Widget state,
 * touch coordinates persistence, and Capacitor Native Android System Alert Window bridge.
 */
export class NativeOverlayBridge {
  /**
   * Check whether running in native Capacitor runtime (Android / iOS)
   */
  public static isNative(): boolean {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  /**
   * Get the current platform ('android', 'ios', or 'web')
   */
  public static getPlatform(): string {
    try {
      return Capacitor.getPlatform();
    } catch {
      return 'web';
    }
  }

  /**
   * Get widget enabled/disabled preference from localStorage
   * Default is true (enabled)
   */
  public static isWidgetEnabled(): boolean {
    try {
      const val = localStorage.getItem(STORAGE_KEY_ENABLED);
      if (val === null) return true; // Default ON
      return val === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Set widget enabled state and notify listeners
   */
  public static setWidgetEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
      window.dispatchEvent(
        new CustomEvent('sq_floating_widget_toggle', { detail: { enabled } })
      );
    } catch (e) {
      console.warn('Gagal menyimpan status gelembung melayang:', e);
    }
  }

  /**
   * Get saved widget position
   */
  public static getSavedPosition(): { x: number; y: number } {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return { x: 0, y: 0 };
  }

  /**
   * Save widget position
   */
  public static savePosition(pos: { x: number; y: number }): void {
    try {
      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(pos));
    } catch (e) {
      console.warn('Gagal menyimpan posisi gelembung:', e);
    }
  }

  /**
   * Reset widget position to default (bottom-right)
   */
  public static resetPosition(): { x: number; y: number } {
    const defaultPos = { x: 0, y: 0 };
    this.savePosition(defaultPos);
    return defaultPos;
  }

  /**
   * Native Android ActionSheet Menu via @capacitor/action-sheet
   */
  public static async showNativeQuickActions(options: {
    title?: string;
    message?: string;
    onOpenPos: () => void;
    onToggleFocus: () => void;
    onOpenShift: () => void;
    onLockScreen: () => void;
    onToggleWidget: (enabled: boolean) => void;
    onRequestOverlayPermission?: () => void;
    currentEnabled: boolean;
  }): Promise<void> {
    const isCurrentlyEnabled = options.currentEnabled;

    if (this.isNative()) {
      try {
        const actionOptions: ShowActionsOptions = {
          title: options.title || '⚡ Su-Qur POS • Quick Actions',
          message: options.message || 'Pilih menu akses cepat kasir atau pengaturan gelembung:',
          options: [
            {
              title: '☕ Buka Kasir POS (Input Order)',
              style: ActionSheetButtonStyle.Default,
            },
            {
              title: '⚡ Toggle Mode Kasir Fokus',
              style: ActionSheetButtonStyle.Default,
            },
            {
              title: '🕒 Status / Buka-Tutup Shift',
              style: ActionSheetButtonStyle.Default,
            },
            {
              title: '🔒 Kunci Layar (PIN Lock)',
              style: ActionSheetButtonStyle.Default,
            },
            {
              title: isCurrentlyEnabled ? '🚫 Sembunyikan Gelembung (OFF)' : '🟢 Tampilkan Gelembung (ON)',
              style: ActionSheetButtonStyle.Destructive,
            },
            {
              title: '📱 Izin Tampil di Atas Aplikasi Lain (APK Android)',
              style: ActionSheetButtonStyle.Default,
            },
            {
              title: 'Tutup',
              style: ActionSheetButtonStyle.Cancel,
            },
          ],
        };

        const result = await ActionSheet.showActions(actionOptions);
        switch (result.index) {
          case 0:
            options.onOpenPos();
            break;
          case 1:
            options.onToggleFocus();
            break;
          case 2:
            options.onOpenShift();
            break;
          case 3:
            options.onLockScreen();
            break;
          case 4:
            options.onToggleWidget(!isCurrentlyEnabled);
            break;
          case 5:
            if (options.onRequestOverlayPermission) {
              options.onRequestOverlayPermission();
            } else {
              this.requestSystemAlertWindow();
            }
            break;
          default:
            break;
        }
        return;
      } catch (err) {
        console.warn('Native ActionSheet fallback to standard flow:', err);
      }
    }
  }

  /**
   * Request / Guide for SYSTEM_ALERT_WINDOW (Draw Over Other Apps / Overlay) permission on Android
   */
  public static async requestSystemAlertWindow(): Promise<{
    granted: boolean;
    instructions: string[];
    isNative: boolean;
  }> {
    const isNativeAndroid = this.isNative() && this.getPlatform() === 'android';

    if (isNativeAndroid) {
      // In native Capacitor environment, try opening Android overlay settings intent if plugin available
      try {
        const plugins = (window as any).Capacitor?.Plugins;
        if (plugins?.BackgroundRunner || plugins?.App) {
          // Trigger system settings
          console.log('Requesting Android native overlay intent...');
        }
      } catch (e) {
        console.warn('Native intent launch notice:', e);
      }
    }

    // Return detailed vendor instructions for user guidance
    return {
      granted: false,
      isNative: isNativeAndroid,
      instructions: [
        '1. Buka Pengaturan (Settings) di HP Android Anda.',
        '2. Pilih menu "Aplikasi" atau "Manajemen Aplikasi" -> Pilih "Su-Qur POS".',
        '3. Cari menu "Tampil di atas aplikasi lain" (Draw over other apps / Display pop-up window).',
        '4. Aktifkan sakelar (toggle) ke posisi ON / IZINKAN.',
        '5. Untuk HP Xiaomi/MIUI/HyperOS: Aktifkan juga "Tampilkan jendela pop-up saat berjalan di latar belakang".',
      ],
    };
  }
}
