import React, { useState, useRef } from 'react';
import { User } from '../types';
import { Camera, Upload, Link as LinkIcon, Check, X, User as UserIcon, Image as ImageIcon } from 'lucide-react';

interface UserProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveUser: (updatedUser: User) => void;
}

// Preset photo options for quick selection
const PRESET_AVATARS = [
  {
    label: 'Barista / Kasir 1',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
  },
  {
    label: 'Barista / Kasir 2',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  },
  {
    label: 'Admin / Manager 1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  },
  {
    label: 'Kasir / Staf Female',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  },
  {
    label: 'Kasir / Staf Male',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  },
  {
    label: 'Coffee Specialist',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onSaveUser,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatar || '');
  const [userName, setUserName] = useState<string>(user.name);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [tabMode, setTabMode] = useState<'upload' | 'presets' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState<string>(user.avatar || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Local File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar (JPG, PNG, WebP)');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        setUrlInput(result);
        setToastMessage('Foto berhasil diunggah! Klik Simpan Foto.');
        setTimeout(() => setToastMessage(null), 3000);
      }
      setIsUploading(false);
    };

    reader.onerror = () => {
      alert('Gagal membaca file gambar');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const updatedUser: User = {
      ...user,
      name: userName,
      avatar: avatarUrl,
    };
    onSaveUser(updatedUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#E6D5C3] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3E2723] to-[#2B1713] p-5 text-[#FAF3DD] flex items-center justify-between border-b border-[#4E342E]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#5D4037] text-amber-200 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Ganti Foto Profil ({user.role === 'admin' ? 'Admin' : 'Kasir'})</h3>
              <p className="text-[11px] text-[#D7CCC8]">Ubah foto atau avatar akun {user.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF3DD] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Avatar Preview Box */}
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#3E2723] shadow-lg bg-[#F5EBE0] flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-12 h-12 text-[#8D6E63]" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#3E2723] text-amber-200 border-2 border-white flex items-center justify-center shadow-md hover:bg-[#4E342E] transition-all"
                title="Pilih foto dari galeri/HP"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                Akun {user.role}
              </span>
              <h4 className="font-bold text-base text-[#2B1713]">{userName}</h4>
            </div>
          </div>

          {/* Toast Notice */}
          {toastMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Option Tabs */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#3E2723] block">Pilih Cara Mengubah Foto:</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F5EBE0] rounded-2xl border border-[#E6D5C3]">
              <button
                type="button"
                onClick={() => setTabMode('upload')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  tabMode === 'upload'
                    ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                    : 'text-[#8D6E63] hover:text-[#3E2723]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setTabMode('presets')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  tabMode === 'presets'
                    ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                    : 'text-[#8D6E63] hover:text-[#3E2723]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Preset Foto
              </button>
              <button
                type="button"
                onClick={() => setTabMode('url')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  tabMode === 'url'
                    ? 'bg-[#3E2723] text-[#FAF3DD] shadow-xs'
                    : 'text-[#8D6E63] hover:text-[#3E2723]'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" /> Link Image
              </button>
            </div>
          </div>

          {/* Tab 1: Upload File */}
          {tabMode === 'upload' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D4A373] hover:border-[#3E2723] bg-[#FDFBF7] hover:bg-[#FAF3DD]/50 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-[#F5EBE0] text-[#3E2723] flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-[#8D6E63]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2B1713]">
                    {isUploading ? 'Membaca gambar...' : 'Klik untuk Upload Foto dari Galeri / Kamera'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Format disarankan: JPG, PNG, WEBP (Bebas ukuran)</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Preset Avatars */}
          {tabMode === 'presets' && (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500">Pilih salah satu karakter foto profesional berikut:</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PRESET_AVATARS.map((preset, idx) => {
                  const isSelected = avatarUrl === preset.url;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAvatarUrl(preset.url);
                        setUrlInput(preset.url);
                      }}
                      className={`p-1.5 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'border-[#3E2723] bg-[#FAF3DD] ring-2 ring-[#3E2723]'
                          : 'border-[#E6D5C3] bg-white hover:border-[#D4A373]'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-12 h-12 rounded-full object-cover border border-[#E6D5C3]"
                      />
                      <span className="text-[9px] font-bold text-[#3E2723] truncate w-full text-center">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: URL Input */}
          {tabMode === 'url' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8D6E63] block">Tempelkan Link URL Gambar / Foto:</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E6D5C3] text-xs focus:outline-none focus:border-[#3E2723]"
                />
                <button
                  type="button"
                  onClick={() => setAvatarUrl(urlInput)}
                  className="px-3 py-2 rounded-xl bg-[#3E2723] text-white font-bold text-xs hover:bg-[#4E342E]"
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}

          {/* Edit Name Optional */}
          <div className="pt-2 border-t border-[#E6D5C3]">
            <label className="text-xs font-bold text-[#3E2723] block mb-1">Nama Tampil Akun:</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6D5C3] text-xs font-bold text-[#2B1713] focus:outline-none focus:border-[#3E2723]"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-[#FDFBF7] border-t border-[#E6D5C3] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#F5EBE0] text-[#3E2723] font-bold text-xs hover:bg-[#E6D5C3] transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[#3E2723] text-[#FAF3DD] font-bold text-xs hover:bg-[#4E342E] transition-all flex items-center gap-1.5 shadow-md"
          >
            <Check className="w-4 h-4 text-[#D4A373]" />
            <span>Simpan Foto Profil</span>
          </button>
        </div>
      </div>
    </div>
  );
};
