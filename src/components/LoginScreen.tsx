import React, { useState, useEffect } from 'react';
import { User as POSUser, StoreSettings, Outlet } from '../types';
import { StorageService } from '../services/storage';
import {
  Coffee,
  Shield,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  ChevronRight,
  AlertCircle,
  Delete,
  CheckCircle2,
  Sparkles,
  MapPin,
  Building2,
  Check,
  Store,
  QrCode,
  Download,
  Calendar,
} from 'lucide-react';

interface LoginScreenProps {
  users: POSUser[];
  settings: StoreSettings;
  outlets?: Outlet[];
  currentOutletId?: string;
  onLoginSuccess: (user: POSUser, selectedOutletId?: string) => void;
  onOpenCustomerOrder?: () => void;
  onOpenCustomerPO?: () => void;
  onOpenInstallApp?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  settings,
  outlets,
  currentOutletId,
  onLoginSuccess,
  onOpenCustomerOrder,
  onOpenCustomerPO,
  onOpenInstallApp,
}) => {
  const rawOutlets = outlets && outlets.length > 0 ? outlets : StorageService.getOutlets();
  const activeOutlets = rawOutlets.filter((o) => o.isActive !== false);

  // Filter state for user tabs
  const [roleFilter, setRoleFilter] = useState<'all' | 'kasir' | 'admin'>('all');

  // Selected user
  const [selectedUser, setSelectedUser] = useState<POSUser | null>(users[0] || null);

  // Resolve assigned outlet for currently selected user
  const getUserAssignedOutletId = (user: POSUser | null): string => {
    if (!user) return activeOutlets[0]?.id || 'outlet-lagoa';
    if (user.assignedOutletId && user.assignedOutletId !== 'ALL') {
      return user.assignedOutletId;
    }
    if (user.outletId && user.outletId !== 'ALL') {
      return user.outletId;
    }
    if (user.outletIds && user.outletIds.length === 1 && user.outletIds[0] !== 'ALL') {
      return user.outletIds[0];
    }
    // Fallback or Admin
    return currentOutletId || StorageService.getActiveOutletId() || activeOutlets[0]?.id || 'outlet-lagoa';
  };

  const [effectiveOutletId, setEffectiveOutletId] = useState<string>(() =>
    getUserAssignedOutletId(users[0] || null)
  );

  // When selectedUser changes, automatically sync their outlet
  useEffect(() => {
    if (selectedUser) {
      const assigned = getUserAssignedOutletId(selectedUser);
      setEffectiveOutletId(assigned);
    }
  }, [selectedUser]);

  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const displayedUsers = users.filter((u) => {
    if (roleFilter === 'kasir') return u.role === 'kasir';
    if (roleFilter === 'admin') return u.role === 'admin';
    return true;
  });

  const resolvedOutlet =
    activeOutlets.find((o) => o.id === effectiveOutletId) ||
    activeOutlets[0] ||
    rawOutlets[0] || {
      id: 'outlet-lagoa',
      name: 'Cabang Utama Lagoa',
      address: settings.address || 'Jl. Lagoa Terusan No. 12, Koja',
    };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSuccess) return;

      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 8) {
          handleKeyPress(e.key);
        }
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, selectedUser, isSuccess, effectiveOutletId]);

  const handleKeyPress = (digit: string) => {
    setError(null);
    if (pin.length < 8) {
      const newPin = pin + digit;
      setPin(newPin);

      // Auto submit on exact pin length match
      if (selectedUser && newPin.length === selectedUser.pin.length) {
        verifyPin(newPin, selectedUser);
      }
    }
  };

  const handleDelete = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
  };

  const verifyPin = (inputPin: string, targetUser: POSUser) => {
    if (inputPin === targetUser.pin) {
      setIsSuccess(true);
      setError(null);
      const targetOutletId = getUserAssignedOutletId(targetUser);
      setTimeout(() => {
        StorageService.setActiveOutletId(targetOutletId);
        onLoginSuccess(targetUser, targetOutletId);
      }, 400);
    } else {
      setError('PIN tidak sesuai! Silakan periksa kembali.');
      setPin('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setError('Pilih akun terlebih dahulu.');
      return;
    }
    if (!pin) {
      setError('Masukkan PIN.');
      return;
    }
    verifyPin(pin, selectedUser);
  };

  const handleSelectUser = (user: POSUser) => {
    setSelectedUser(user);
    setPin('');
    setError(null);
    const assigned = getUserAssignedOutletId(user);
    setEffectiveOutletId(assigned);
  };

  const getOutletNameForUser = (user: POSUser) => {
    const outId = user.assignedOutletId || user.outletId || (user.outletIds && user.outletIds[0]);
    if (!outId || outId === 'ALL') {
      return user.role === 'admin' ? 'Semua Cabang (Pusat)' : 'Cabang Utama';
    }
    const found = activeOutlets.find((o) => o.id === outId);
    return found?.name || 'Cabang Terdaftar';
  };

  return (
    <div className="min-h-screen w-full bg-[#1A100E] text-[#FDFBF7] flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Subtle Warm Background Glow */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-[#8D6E63]/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-[450px] h-[450px] bg-[#3E2723]/50 rounded-full blur-3xl pointer-events-none translate-y-1/3" />

      {/* Top Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-white/10 border border-[#D7CCC8]/30 p-1 flex items-center justify-center shadow-md">
              <img src={settings.logoUrl} alt={settings.storeName} className="w-full h-full object-cover rounded-xl" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4A373] to-[#8D6E63] text-[#1F1412] flex items-center justify-center font-serif font-black text-xl shadow-md">
              {settings.storeName ? settings.storeName.charAt(0).toUpperCase() : 'S'}
            </div>
          )}
          <div>
            <h1 className="font-serif italic font-bold text-lg text-[#FAF3DD] tracking-tight">
              {settings.storeName}
            </h1>
            <p className="text-[10px] text-[#D7CCC8]/70 font-semibold uppercase tracking-wider">
              {resolvedOutlet.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#2B1713] px-3 py-1.5 rounded-full border border-[#5D4037] text-xs font-semibold text-amber-200">
          <Building2 className="w-3.5 h-3.5 text-amber-400" />
          <span>{resolvedOutlet.name}</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-3 sm:p-6 my-auto">
        <div className="w-full max-w-4xl bg-[#241310] border border-[#5D4037]/70 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Left Column: Fast Account Selector */}
          <div className="md:col-span-6 p-5 sm:p-7 border-b md:border-b-0 md:border-r border-[#5D4037]/60 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-[#FAF3DD] flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#D4A373]" /> Pilih Akun Kasir / Admin
                </h2>
                <p className="text-xs text-[#D7CCC8]/80 mt-0.5">
                  Klik akun Anda untuk langsung masuk ke cabang penugasan.
                </p>
              </div>

              {/* Role Tabs */}
              <div className="flex gap-1.5 p-1 bg-[#1A100E] rounded-xl border border-[#4E342E] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    roleFilter === 'all' ? 'bg-[#D4A373] text-[#1F1412]' : 'text-[#D7CCC8]/70 hover:text-white'
                  }`}
                >
                  Semua ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('kasir')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    roleFilter === 'kasir' ? 'bg-emerald-700 text-white' : 'text-[#D7CCC8]/70 hover:text-white'
                  }`}
                >
                  Kasir ({users.filter((u) => u.role === 'kasir').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('admin')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    roleFilter === 'admin' ? 'bg-amber-700 text-white' : 'text-[#D7CCC8]/70 hover:text-white'
                  }`}
                >
                  Admin ({users.filter((u) => u.role === 'admin').length})
                </button>
              </div>

              {/* User Account Cards List */}
              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {displayedUsers.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  const outletLabel = getOutletNameForUser(u);

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`w-full p-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-[#3E2723] border-[#D4A373] ring-2 ring-[#D4A373]/50 shadow-md scale-[1.01]'
                          : 'bg-[#1A100E]/70 border-[#4E342E] hover:border-[#8D6E63] text-[#D7CCC8]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-10 h-10 rounded-xl object-cover border border-[#D4A373]/40 shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              u.role === 'admin'
                                ? 'bg-amber-900/80 text-amber-200 border border-amber-500/40'
                                : 'bg-emerald-900/80 text-emerald-200 border border-emerald-500/40'
                            }`}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-[#FAF3DD] truncate flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {u.role === 'admin' ? (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                Admin
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                                Kasir
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#D7CCC8]/80 flex items-center gap-1 truncate mt-0.5">
                            <MapPin className="w-3 h-3 text-[#D4A373] shrink-0" />
                            <span className="truncate">{outletLabel}</span>
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-[#D4A373] text-[#1F1412] flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#D7CCC8]/50 font-mono">
                          PIN: {u.pin.replace(/./g, '•')}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Outlet Information Badge */}
            <div className="p-3 bg-[#1A100E] rounded-xl border border-[#4E342E] text-xs space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Cabang Login Aktif
              </div>
              <div className="font-bold text-[#FAF3DD]">{resolvedOutlet.name}</div>
              <div className="text-[11px] text-[#D7CCC8]/70 line-clamp-1">{resolvedOutlet.address}</div>
            </div>
          </div>

          {/* Right Column: PIN Keypad Entry */}
          <div className="md:col-span-6 p-5 sm:p-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#FAF3DD] flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-[#D4A373]" /> Masukkan PIN
                  </h3>
                  <p className="text-[11px] text-[#D7CCC8]/70">
                    Akun: <strong className="text-white">{selectedUser?.name || 'Kasir'}</strong>
                  </p>
                </div>
                {selectedUser && (
                  <span className="text-[11px] text-amber-300 font-bold bg-[#1A100E] px-2.5 py-1 rounded-lg border border-[#4E342E]">
                    {selectedUser.role.toUpperCase()}
                  </span>
                )}
              </div>

              {/* PIN Display Field */}
              <div className="relative">
                <div
                  className={`w-full py-2.5 px-4 rounded-2xl bg-[#1A100E] border-2 transition-all flex items-center justify-center gap-3 ${
                    error
                      ? 'border-red-500 bg-red-950/20'
                      : isSuccess
                      ? 'border-emerald-500 bg-emerald-950/20'
                      : 'border-[#4E342E] focus-within:border-[#D4A373]'
                  }`}
                >
                  {Array.from({ length: Math.max(4, selectedUser ? selectedUser.pin.length : 4) }).map((_, i) => {
                    const hasValue = i < pin.length;
                    return (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full transition-all flex items-center justify-center font-mono font-bold text-xs ${
                          hasValue
                            ? isSuccess
                              ? 'bg-emerald-400 text-[#1F1412] shadow-sm scale-110'
                              : 'bg-[#D4A373] text-[#1F1412] shadow-sm scale-110'
                            : 'bg-[#3E2723] border border-[#5D4037]'
                        }`}
                      >
                        {hasValue && showPin ? pin[i] : null}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D7CCC8]/70 hover:text-white p-1 rounded-lg"
                  title={showPin ? 'Sembunyikan Angka PIN' : 'Lihat PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="bg-red-900/40 text-red-200 border border-red-500/40 p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Notice */}
              {isSuccess && (
                <div className="bg-emerald-900/50 text-emerald-200 border border-emerald-500/50 p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Login Berhasil! Membuka kasir...</span>
                </div>
              )}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeyPress(digit)}
                    disabled={isSuccess}
                    className="h-11 rounded-2xl bg-[#2B1713] hover:bg-[#3E2723] active:bg-[#D4A373] active:text-[#1F1412] border border-[#4E342E] text-base font-bold text-[#FAF3DD] transition-all flex items-center justify-center shadow-xs cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSuccess}
                  className="h-11 rounded-2xl bg-[#2B1713]/40 hover:bg-red-950/40 text-red-300 border border-red-500/30 text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyPress('0')}
                  disabled={isSuccess}
                  className="h-11 rounded-2xl bg-[#2B1713] hover:bg-[#3E2723] active:bg-[#D4A373] active:text-[#1F1412] border border-[#4E342E] text-base font-bold text-[#FAF3DD] transition-all flex items-center justify-center shadow-xs cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSuccess}
                  className="h-11 rounded-2xl bg-[#2B1713]/40 hover:bg-[#3E2723] text-[#D7CCC8] border border-[#4E342E] text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Login Action Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSuccess || pin.length === 0 || !selectedUser}
              className={`w-full py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                isSuccess
                  ? 'bg-emerald-600 text-white'
                  : pin.length > 0 && selectedUser
                  ? 'bg-gradient-to-r from-[#D4A373] to-[#8D6E63] text-[#1F1412] hover:brightness-110 active:scale-[0.99] cursor-pointer'
                  : 'bg-[#2B1713] text-[#D7CCC8]/40 border border-[#4E342E] cursor-not-allowed'
              }`}
            >
              <span>{isSuccess ? 'Membuka POS...' : `Masuk POS • ${resolvedOutlet.name}`}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {onOpenCustomerOrder && (
              <button
                type="button"
                onClick={onOpenCustomerOrder}
                className="w-full py-2.5 rounded-2xl border border-amber-500/30 bg-[#2B1713]/60 hover:bg-[#3E2723] text-amber-200 hover:text-amber-100 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-2"
              >
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Buka Katalog Menu Pelanggan (Self-Order)</span>
              </button>
            )}

            {onOpenCustomerPO && (
              <button
                type="button"
                onClick={onOpenCustomerPO}
                className="w-full py-2.5 rounded-2xl border border-amber-500/30 bg-[#3E2723]/70 hover:bg-[#4E342E] text-amber-200 hover:text-amber-100 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-1"
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Buka Form Pre-Order (PO) Publik</span>
              </button>
            )}

            {onOpenInstallApp && (
              <button
                type="button"
                onClick={onOpenInstallApp}
                className="w-full py-2 rounded-2xl border border-amber-500/20 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 hover:text-amber-200 text-[11px] font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-1"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Pasang Aplikasi Su-Qur POS (PWA / APK)</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-4 text-center text-xs text-[#D7CCC8]/60 flex flex-col sm:flex-row items-center justify-between gap-1">
        <p>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>
        <p className="font-mono text-[11px]">{resolvedOutlet.name} • Su-Qur POS</p>
      </footer>
    </div>
  );
};
