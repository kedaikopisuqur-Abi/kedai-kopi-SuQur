import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { applyTheme, getStoredTheme, ThemeMode, setStoredTheme } from '../utils/theme';
import { idbGet, idbSet, idbDel } from '../services/idbStorage';

export type ThemePreset = 'coffee_amber' | 'emerald_green' | 'modern_white' | 'dark_mode';

export interface CustomBackgroundConfig {
  url: string | null;
  opacity: number; // 0 to 100 (% of overlay tint on top of image)
  blur: number; // 0 to 20 (px blur applied to background image)
  overlayColor: 'auto' | 'dark' | 'light' | 'amber' | 'emerald';
}

export interface ThemePresetDetails {
  id: ThemePreset;
  name: string;
  subtitle: string;
  description: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  bgLight: string;
  bgDark: string;
  textPrimary: string;
  headerGradient: string;
  bubbleColor: string;
  isDark: boolean;
  tagColor: string;
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDetails> = {
  coffee_amber: {
    id: 'coffee_amber',
    name: 'Coffee Amber (Cokelat & Kurma)',
    subtitle: 'Brand Khas Su-Qur POS',
    description: 'Nuansa hangat cokelat kopi arabika dan aksen kurma khas Su-Qur.',
    primary: '#3E2723',
    primaryHover: '#4E342E',
    secondary: '#D4A373',
    accent: '#8D7B68',
    bgLight: '#F9F6F2',
    bgDark: '#1B110F',
    textPrimary: '#3E2723',
    headerGradient: 'from-[#3E2723] via-[#2B1713] to-[#1F1412]',
    bubbleColor: 'bg-[#3E2723] text-amber-300 border-amber-500/40',
    isDark: false,
    tagColor: 'bg-amber-100 text-amber-950 border-amber-300',
  },
  emerald_green: {
    id: 'emerald_green',
    name: 'Emerald Green (Hijau Segar)',
    subtitle: 'Nuansa Segar Barista & Teh',
    description: 'Aksen hijau zamrud modern yang menyegarkan mata saat beroperasi lama.',
    primary: '#064E3B',
    primaryHover: '#065F46',
    secondary: '#10B981',
    accent: '#34D399',
    bgLight: '#F0FDF4',
    bgDark: '#062B21',
    textPrimary: '#064E3B',
    headerGradient: 'from-[#064E3B] via-[#043E2F] to-[#022C22]',
    bubbleColor: 'bg-[#064E3B] text-emerald-300 border-emerald-400/50',
    isDark: false,
    tagColor: 'bg-emerald-100 text-emerald-950 border-emerald-300',
  },
  modern_white: {
    id: 'modern_white',
    name: 'Modern Minimalist White (Terang & Sleek)',
    subtitle: 'Tampilan Bersih & Kontras Tinggi',
    description: 'Palet terang ultra-clean dengan kontras slate & aksen royal blue yang tajam.',
    primary: '#0F172A',
    primaryHover: '#1E293B',
    secondary: '#2563EB',
    accent: '#3B82F6',
    bgLight: '#F8FAFC',
    bgDark: '#0F172A',
    textPrimary: '#0F172A',
    headerGradient: 'from-[#0F172A] via-[#1E293B] to-[#334155]',
    bubbleColor: 'bg-[#0F172A] text-blue-300 border-blue-400/50',
    isDark: false,
    tagColor: 'bg-blue-100 text-blue-950 border-blue-300',
  },
  dark_mode: {
    id: 'dark_mode',
    name: 'Dark Mode (Onyx & Charcoal)',
    subtitle: 'Mode Gelap Kasir Shift Malam',
    description: 'Mode gelap elegan untuk kenyamanan mata kasir di pencahayaan redup.',
    primary: '#121212',
    primaryHover: '#1E1E1E',
    secondary: '#F59E0B',
    accent: '#D97706',
    bgLight: '#18181B',
    bgDark: '#09090B',
    textPrimary: '#FAF3DD',
    headerGradient: 'from-[#121212] via-[#18181B] to-[#27272A]',
    bubbleColor: 'bg-[#18181B] text-amber-400 border-amber-500/50',
    isDark: true,
    tagColor: 'bg-amber-950/70 text-amber-300 border-amber-700/50',
  },
};

export interface ThemeConfig {
  preset: ThemePreset;
  bgConfig: CustomBackgroundConfig;
}

const DEFAULT_THEME_CONFIG: ThemeConfig = {
  preset: 'coffee_amber',
  bgConfig: {
    url: null,
    opacity: 75,
    blur: 0,
    overlayColor: 'auto',
  },
};

const THEME_CONFIG_STORAGE_KEY = 'sq_theme_custom_config';
const CUSTOM_BG_IDB_KEY = 'sq_custom_bg_image';

interface ThemeContextType {
  preset: ThemePreset;
  presetDetails: ThemePresetDetails;
  bgConfig: CustomBackgroundConfig;
  setPreset: (preset: ThemePreset) => void;
  setBgConfig: React.Dispatch<React.SetStateAction<CustomBackgroundConfig>>;
  updateBgImage: (url: string | null) => void;
  updateBgOpacity: (opacity: number) => void;
  updateBgBlur: (blur: number) => void;
  resetToDefaultTheme: () => void;
  isDarkMode: boolean;
  applyCSSVariables: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ThemeConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_CONFIG;
    try {
      const saved = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedUrl = parsed.bgConfig?.url;
        const isDataUrl = savedUrl && typeof savedUrl === 'string' && savedUrl.startsWith('data:');

        // If saved url is a dataUrl, we will migrate it to IDB on mount
        return {
          preset: parsed.preset && THEME_PRESETS[parsed.preset as ThemePreset] ? parsed.preset : 'coffee_amber',
          bgConfig: {
            url: isDataUrl ? savedUrl : savedUrl === '__IDB__' ? null : savedUrl || null,
            opacity: typeof parsed.bgConfig?.opacity === 'number' ? parsed.bgConfig.opacity : 75,
            blur: typeof parsed.bgConfig?.blur === 'number' ? parsed.bgConfig.blur : 0,
            overlayColor: parsed.bgConfig?.overlayColor || 'auto',
          },
        };
      }
    } catch (e) {
      console.warn('[ThemeContext] Error parsing saved config:', e);
    }
    return DEFAULT_THEME_CONFIG;
  });

  // On initial mount: Hydrate custom background from IndexedDB to keep LocalStorage lightweight
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // Check if there was a data URL in localStorage that needs migration to IndexedDB
        const rawLs = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
        if (rawLs && rawLs.includes('data:image')) {
          try {
            const parsed = JSON.parse(rawLs);
            if (parsed?.bgConfig?.url?.startsWith('data:image')) {
              await idbSet(CUSTOM_BG_IDB_KEY, parsed.bgConfig.url);
              // Clean out the huge base64 from LocalStorage immediately to free up quota
              parsed.bgConfig.url = '__IDB__';
              localStorage.setItem(THEME_CONFIG_STORAGE_KEY, JSON.stringify(parsed));
            }
          } catch {
            // ignore
          }
        }

        // Load custom image from IndexedDB if not currently loaded
        const idbBg = await idbGet<string>(CUSTOM_BG_IDB_KEY);
        if (idbBg && isMounted) {
          setConfig((prev) => ({
            ...prev,
            bgConfig: {
              ...prev.bgConfig,
              url: idbBg,
            },
          }));
        }
      } catch (err) {
        console.warn('[ThemeContext] Error loading background from IndexedDB:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const presetDetails = useMemo(() => {
    return THEME_PRESETS[config.preset] || THEME_PRESETS.coffee_amber;
  }, [config.preset]);

  const isDarkMode = useMemo(() => {
    return config.preset === 'dark_mode' || getStoredTheme() === 'dark';
  }, [config.preset]);

  // Persist lightweight config to localStorage whenever config changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const isDataUrl = config.bgConfig.url && config.bgConfig.url.startsWith('data:');
        const storagePayload = {
          preset: config.preset,
          bgConfig: {
            ...config.bgConfig,
            // Never store raw large base64 data URLs in LocalStorage
            url: isDataUrl ? '__IDB__' : config.bgConfig.url,
          },
        };
        localStorage.setItem(THEME_CONFIG_STORAGE_KEY, JSON.stringify(storagePayload));
      } catch (e) {
        console.warn('[ThemeContext] Failed to save theme config:', e);
      }
    }
  }, [config]);

  // Apply CSS variables and theme class to document root
  const applyCSSVariables = () => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const details = THEME_PRESETS[config.preset] || THEME_PRESETS.coffee_amber;

    // Apply dark class
    if (config.preset === 'dark_mode') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      setStoredTheme('dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', config.preset);
      setStoredTheme('light');
    }

    // Dynamic CSS Custom Properties
    root.style.setProperty('--sq-primary', details.primary);
    root.style.setProperty('--sq-primary-hover', details.primaryHover);
    root.style.setProperty('--sq-secondary', details.secondary);
    root.style.setProperty('--sq-accent', details.accent);
    root.style.setProperty('--sq-text-primary', details.textPrimary);
    root.style.setProperty('--sq-bg-light', details.bgLight);
    root.style.setProperty('--sq-bg-dark', details.bgDark);
  };

  useEffect(() => {
    applyCSSVariables();
  }, [config.preset]);

  const setPreset = (newPreset: ThemePreset) => {
    setConfig((prev) => ({
      ...prev,
      preset: newPreset,
    }));
  };

  const setBgConfig: React.Dispatch<React.SetStateAction<CustomBackgroundConfig>> = (value) => {
    setConfig((prev) => ({
      ...prev,
      bgConfig: typeof value === 'function' ? value(prev.bgConfig) : value,
    }));
  };

  const updateBgImage = (url: string | null) => {
    if (url && url.startsWith('data:')) {
      // Safely persist heavy base64 data to IndexedDB
      idbSet(CUSTOM_BG_IDB_KEY, url).catch((err) => {
        console.warn('[ThemeContext] Failed to save background to IndexedDB:', err);
      });
    } else if (url === null) {
      // Delete from IndexedDB
      idbDel(CUSTOM_BG_IDB_KEY).catch(() => {});
    }

    setConfig((prev) => ({
      ...prev,
      bgConfig: {
        ...prev.bgConfig,
        url,
      },
    }));
  };

  const updateBgOpacity = (opacity: number) => {
    setConfig((prev) => ({
      ...prev,
      bgConfig: {
        ...prev.bgConfig,
        opacity: Math.max(0, Math.min(100, opacity)),
      },
    }));
  };

  const updateBgBlur = (blur: number) => {
    setConfig((prev) => ({
      ...prev,
      bgConfig: {
        ...prev.bgConfig,
        blur: Math.max(0, Math.min(20, blur)),
      },
    }));
  };

  const resetToDefaultTheme = () => {
    idbDel(CUSTOM_BG_IDB_KEY).catch(() => {});
    setConfig(DEFAULT_THEME_CONFIG);
  };

  return (
    <ThemeContext.Provider
      value={{
        preset: config.preset,
        presetDetails,
        bgConfig: config.bgConfig,
        setPreset,
        setBgConfig,
        updateBgImage,
        updateBgOpacity,
        updateBgBlur,
        resetToDefaultTheme,
        isDarkMode,
        applyCSSVariables,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
