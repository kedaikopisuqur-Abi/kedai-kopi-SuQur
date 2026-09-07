import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Palette,
  Image as ImageIcon,
  Upload,
  Trash2,
  Sparkles,
  Check,
  Sun,
  Moon,
  Eye,
  RotateCcw,
  Sliders,
  Layers,
  Coffee,
  CheckCircle2,
  Info,
  Laptop,
  Smartphone,
  Maximize2,
} from 'lucide-react';
import { useTheme, THEME_PRESETS, ThemePreset } from '../context/ThemeContext';
import { formatRp } from '../utils/formatters';

// Wallpaper presets bawaan beresolusi tinggi dan bernuansa cafe
const CAFE_WALLPAPERS = [
  {
    id: 'cafe-interior',
    name: 'Coffee Shop Warm Ambience',
    thumbnail: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    full: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'espresso-bar',
    name: 'Espresso Barista Counter',
    thumbnail: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=600&q=80',
    full: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'rustic-wood',
    name: 'Rustic Wooden Coffee Table',
    thumbnail: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    full: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'cozy-cafe',
    name: 'Cozy Botanical Coffee Corner',
    thumbnail: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
    full: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'minimalist-dark',
    name: 'Modern Charcoal Concrete Wall',
    thumbnail: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=600&q=80',
    full: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1920&q=80',
  },
];

export const ThemeSettings: React.FC = () => {
  const {
    preset,
    presetDetails,
    bgConfig,
    setPreset,
    updateBgImage,
    updateBgOpacity,
    updateBgBlur,
    resetToDefaultTheme,
  } = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // Handle custom image upload from device gallery
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar yang valid (JPG, PNG, atau WebP).');
      return;
    }

    setIsCompressing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress & resize image to max 1280px width/height for fast persistence
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1280;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          updateBgImage(compressedDataUrl);
          showNotice('Gambar wallpaper kustom berhasil diterapkan!');
        }
        setIsCompressing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const handleSelectPresetWallpaper = (url: string) => {
    updateBgImage(url);
    showNotice('Wallpaper latar belakang berhasil dipilih!');
  };

  const handleRemoveWallpaper = () => {
    updateBgImage(null);
    showNotice('Wallpaper dihapus. Tampilan kembali ke warna latar solid.');
  };

  const handleResetAll = () => {
    if (confirm('Kembalikan seluruh tema & gambar latar belakang ke pengaturan standar Su-Qur POS?')) {
      resetToDefaultTheme();
      showNotice('Tema berhasil dikembalikan ke standar Coffee Amber Su-Qur POS.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {saveNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveNotice}</span>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-lg">Realtime Sync</span>
        </motion.div>
      )}

      {/* SECTION 1: PRESET WARNA UTAMA */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-[#E6D5C3] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F2EFE9] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shadow-2xs">
              <Palette className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base md:text-lg text-[#3E2723]">
                1. Preset Warna Utama (Primary Accent)
              </h3>
              <p className="text-xs text-[#8D7B68]">
                Pilih palet warna identitas kasir untuk tombol, header, widget, dan kartu menu
              </p>
            </div>
          </div>

          <button
            onClick={handleResetAll}
            className="text-xs text-[#8D7B68] hover:text-[#3E2723] flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D7CCC8] hover:bg-[#F9F6F2] transition-colors self-start sm:self-auto"
            title="Reset ke Tema Bawaan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Bawaan</span>
          </button>
        </div>

        {/* 4 Theme Preset Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((themeKey) => {
            const item = THEME_PRESETS[themeKey];
            const isSelected = preset === themeKey;

            return (
              <div
                key={themeKey}
                onClick={() => {
                  setPreset(themeKey);
                  showNotice(`Tema ${item.name} aktif!`);
                }}
                className={`relative cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col justify-between gap-3 text-left overflow-hidden ${
                  isSelected
                    ? 'border-[#3E2723] bg-amber-50/40 shadow-md ring-2 ring-amber-500/20'
                    : 'border-[#EBE3D5] bg-[#FDFBF7] hover:border-[#D4A373] hover:bg-white'
                }`}
              >
                {/* Active Pill Badge */}
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-[#3E2723] text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <Check className="w-3 h-3" />
                    <span>Aktif</span>
                  </div>
                )}

                {/* Color Palette Swatches */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-7 h-7 rounded-xl shadow-xs border border-white/50"
                      style={{ backgroundColor: item.primary }}
                      title="Warna Utama"
                    />
                    <div
                      className="w-7 h-7 rounded-xl shadow-xs border border-white/50"
                      style={{ backgroundColor: item.secondary }}
                      title="Warna Aksen"
                    />
                    <div
                      className="w-7 h-7 rounded-xl shadow-xs border border-gray-200"
                      style={{ backgroundColor: item.bgLight }}
                      title="Latar Belakang"
                    />
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-[#3E2723] flex items-center gap-1.5">
                      {themeKey === 'coffee_amber' && <Coffee className="w-4 h-4 text-amber-800" />}
                      {themeKey === 'emerald_green' && <Sparkles className="w-4 h-4 text-emerald-700" />}
                      {themeKey === 'modern_white' && <Sun className="w-4 h-4 text-blue-600" />}
                      {themeKey === 'dark_mode' && <Moon className="w-4 h-4 text-amber-400" />}
                      <span>{item.name}</span>
                    </h4>
                    <span className="text-[11px] font-semibold text-[#8D7B68] block mt-0.5">
                      {item.subtitle}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#5D4037] leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Small preview chip */}
                <div className="pt-2 border-t border-[#EBE3D5] flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${item.tagColor}`}>
                    Preview UI
                  </span>
                  <span className="text-[10px] font-mono text-[#8D7B68]">
                    {item.primary}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: UPLOAD GAMBAR BACKGROUND / WALLPAPER */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-[#E6D5C3] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#F2EFE9] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shadow-2xs">
              <ImageIcon className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base md:text-lg text-[#3E2723]">
                2. Upload Wallpaper / Gambar Background
              </h3>
              <p className="text-xs text-[#8D7B68]">
                Pasang foto cafe atau wallpaper estetik dari perangkat Anda sebagai latar belakang aplikasi
              </p>
            </div>
          </div>

          {bgConfig.url && (
            <button
              onClick={handleRemoveWallpaper}
              className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Wallpaper</span>
            </button>
          )}
        </div>

        {/* Upload Action Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Custom Upload Dropzone */}
          <div className="lg:col-span-1 flex flex-col justify-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#D4A373] hover:border-[#8D7B68] bg-[#FDFBF7] hover:bg-amber-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group h-full min-h-[160px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 group-hover:scale-105 flex items-center justify-center transition-transform shadow-xs">
                {isCompressing ? (
                  <div className="w-5 h-5 border-2 border-amber-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-amber-800" />
                )}
              </div>
              <div>
                <span className="font-bold text-xs text-[#3E2723] block">
                  {isCompressing ? 'Sedang Memproses Gambar...' : 'Upload dari Galeri / PC'}
                </span>
                <span className="text-[10px] text-[#8D7B68]">
                  Format PNG, JPG, WebP (Maks 10MB)
                </span>
              </div>
              <span className="px-3 py-1 bg-white border border-[#D7CCC8] rounded-xl text-[10px] font-bold text-[#5D4037] group-hover:bg-[#3E2723] group-hover:text-white transition-all shadow-2xs">
                Pilih File Gambar
              </span>
            </div>
          </div>

          {/* Preset HD Cafe Wallpapers */}
          <div className="lg:col-span-2 space-y-2">
            <span className="text-xs font-bold text-[#8D7B68] block">
              Atau Pilih Wallpaper Cafe Berkualitas HD Siap Pakai:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CAFE_WALLPAPERS.map((wp) => {
                const isCurrent = bgConfig.url === wp.full;
                return (
                  <div
                    key={wp.id}
                    onClick={() => handleSelectPresetWallpaper(wp.full)}
                    className={`group relative rounded-2xl overflow-hidden cursor-pointer border-2 transition-all aspect-video shadow-2xs ${
                      isCurrent
                        ? 'border-amber-600 ring-2 ring-amber-500/40 scale-[1.02]'
                        : 'border-[#EBE3D5] hover:border-amber-400'
                    }`}
                  >
                    <img
                      src={wp.thumbnail}
                      alt={wp.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 flex flex-col justify-end">
                      <span className="text-[10px] font-bold text-white leading-tight truncate">
                        {wp.name}
                      </span>
                    </div>

                    {isCurrent && (
                      <div className="absolute top-1.5 right-1.5 bg-amber-600 text-white rounded-full p-1 shadow-xs">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* No wallpaper solid option */}
              <div
                onClick={handleRemoveWallpaper}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer border-2 transition-all aspect-video bg-[#F2EFE9] flex flex-col items-center justify-center p-2 text-center ${
                  !bgConfig.url
                    ? 'border-[#3E2723] bg-amber-50/60 ring-2 ring-amber-500/30'
                    : 'border-[#EBE3D5] hover:border-[#D7CCC8]'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-white border border-[#D7CCC8] flex items-center justify-center mb-1 text-[#8D7B68]">
                  <RotateCcw className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-[#3E2723]">
                  Warna Solid (Tanpa Gambar)
                </span>
                {!bgConfig.url && (
                  <div className="absolute top-1.5 right-1.5 bg-[#3E2723] text-amber-300 rounded-full p-1 shadow-xs">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: SLIDER KONTROL OVERLAY & BLUR EFFECT */}
        <div className="pt-4 border-t border-[#F2EFE9] space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3E2723]">
            <Sliders className="w-4 h-4 text-amber-800" />
            <span>Pengaturan Keterbacaan & Efek Latar Belakang (Transparansi & Blur)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opacity Slider */}
            <div className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#EBE3D5] space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold text-[#3E2723]">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#8D7B68]" />
                  Transparansi / Opacity Overlay
                </span>
                <span className="bg-[#3E2723] text-white px-2 py-0.5 rounded-md font-mono text-[11px]">
                  {bgConfig.opacity}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={bgConfig.opacity}
                onChange={(e) => updateBgOpacity(Number(e.target.value))}
                className="w-full accent-[#3E2723] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#8D7B68]">
                <span>0% (Transparan Penuh)</span>
                <span className="font-semibold text-amber-900">75% (Rekomendasi POS)</span>
                <span>100% (Solid Penuh)</span>
              </div>
              <p className="text-[10px] text-[#8D7B68] leading-tight">
                *Semakin tinggi persentase, kartu kasir, teks harga, dan tombol akan semakin kontras dan mudah dibaca.
              </p>
            </div>

            {/* Blur Slider */}
            <div className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#EBE3D5] space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold text-[#3E2723]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#8D7B68]" />
                  Efek Blur Latar Belakang
                </span>
                <span className="bg-[#3E2723] text-white px-2 py-0.5 rounded-md font-mono text-[11px]">
                  {bgConfig.blur} px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={bgConfig.blur}
                onChange={(e) => updateBgBlur(Number(e.target.value))}
                className="w-full accent-[#3E2723] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#8D7B68]">
                <span>0 px (Tajam Asli)</span>
                <span className="font-semibold text-amber-900">4 px (Bokeh Lembut)</span>
                <span>20 px (Blur Tebal)</span>
              </div>
              <p className="text-[10px] text-[#8D7B68] leading-tight">
                *Efek blur menghasilkan estetika kaca buram modern tanpa mengalihkan fokus mata kasir dari antrean.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: LIVE INTERACTIVE PREVIEW CARD */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-[#E6D5C3] shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-[#F2EFE9] pb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
            <Eye className="w-4 h-4 text-amber-800" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-[#3E2723]">
              Pratinjau Langsung (Live Preview Display)
            </h4>
            <p className="text-xs text-[#8D7B68]">
              Simulasi tampilan kartu menu POS, tombol aksi, dan floating widget dengan tema saat ini
            </p>
          </div>
        </div>

        {/* Mockup Canvas Container */}
        <div className="relative rounded-2xl overflow-hidden border border-[#D7CCC8] p-5 shadow-inner min-h-[220px] flex flex-col justify-between">
          {/* Background Wallpaper Simulation */}
          {bgConfig.url && (
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-300"
              style={{
                backgroundImage: `url(${bgConfig.url})`,
                filter: `blur(${bgConfig.blur}px)`,
                transform: bgConfig.blur > 0 ? 'scale(1.05)' : 'none',
              }}
            />
          )}

          {/* Overlay Tint Simulation */}
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              backgroundColor: preset === 'dark_mode' ? '#09090B' : presetDetails.bgLight,
              opacity: bgConfig.url ? bgConfig.opacity / 100 : 1,
            }}
          />

          {/* Foreground Elements Simulation */}
          <div className="relative z-10 space-y-4">
            {/* Top Bar Preview */}
            <div
              className="px-4 py-2.5 rounded-xl text-white flex items-center justify-between shadow-xs"
              style={{ backgroundColor: presetDetails.primary }}
            >
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-300" />
                <span className="font-serif font-bold text-xs">Su-Qur POS Cafe</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.2 rounded-full font-sans">Kasir 01</span>
              </div>
              <span className="text-[10px] text-amber-200 font-bold">{presetDetails.name}</span>
            </div>

            {/* Sample Order Cards & Action */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Product Card */}
              <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-white/60 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-[#8D7B68] uppercase tracking-wider block">Menu Terlaris</span>
                <div className="font-bold text-xs text-[#3E2723]">Es Kopi Kurma Su-Qur</div>
                <div className="font-black text-xs" style={{ color: presetDetails.primary }}>
                  {formatRp(24000)}
                </div>
              </div>

              {/* Bill Card */}
              <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-white/60 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-[#8D7B68] uppercase tracking-wider block">Total Tagihan</span>
                <div className="font-black text-base text-[#3E2723]">{formatRp(48000)}</div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                  2 Menu Siap Bayar
                </span>
              </div>

              {/* Action Button Preview */}
              <div className="flex flex-col justify-center gap-2">
                <button
                  type="button"
                  className="w-full py-2.5 px-3 rounded-xl text-white font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: presetDetails.primary }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Bayar Sekarang</span>
                </button>

                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-[#5D4037]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Widget Floating Bubble Aktif</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ThemeSettings;
