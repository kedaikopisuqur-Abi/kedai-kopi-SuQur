export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'sq_theme_mode';

/**
 * Mendapatkan preferensi tema pengguna yang tersimpan di localStorage
 * Default: 'light'
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      return saved;
    }
  } catch (e) {
    console.warn('[Theme] Gagal membaca preferensi tema:', e);
  }
  return 'light';
}

/**
 * Cek apakah sistem operasi/perangkat pengguna sedang aktif dark mode
 */
export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Cek apakah dark mode sedang aktif secara efektif di layar
 */
export function isDarkActive(mode: ThemeMode = getStoredTheme()): boolean {
  if (mode === 'dark') return true;
  if (mode === 'system') return getSystemPrefersDark();
  return false;
}

/**
 * Menerapkan tema ke elemen root document (HTML & Body)
 */
export function applyTheme(mode: ThemeMode): boolean {
  if (typeof document === 'undefined') return false;

  const root = document.documentElement;
  const body = document.body;
  const isDark = isDarkActive(mode);

  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    if (body) {
      body.classList.add('dark');
      body.setAttribute('data-theme', 'dark');
    }
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    if (body) {
      body.classList.remove('dark');
      body.setAttribute('data-theme', 'light');
    }
  }

  // Update theme-color meta tag for mobile browsers / Android address bar
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.setAttribute('content', isDark ? '#18110F' : '#3E2723');

  // Broadcast custom event so all open views immediately update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sq_theme_changed', {
        detail: { mode, isDark },
      })
    );
  }

  return isDark;
}

/**
 * Menyimpan preferensi tema ke localStorage dan langsung menerapkannya
 */
export function setStoredTheme(mode: ThemeMode): boolean {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('[Theme] Gagal menyimpan preferensi tema:', e);
    }
  }
  return applyTheme(mode);
}

/**
 * Toggle cepat antara Mode Terang dan Mode Gelap
 */
export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  setStoredTheme(next);
  return next;
}

/**
 * Inisialisasi listener perubahan preferensi tema sistem (OS Dark Mode changes)
 */
export function initThemeListener(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  // Initial apply
  applyTheme(getStoredTheme());

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  } else {
    // Fallback for older browsers
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }
}
