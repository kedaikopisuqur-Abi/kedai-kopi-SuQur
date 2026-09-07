import React, { useState, useEffect } from 'react';
import { User, StoreSettings, Outlet } from '../types';
import { formatRp } from '../utils/formatters';
import { Lock, Unlock, Shield, UserCheck, Delete, Eye, EyeOff, AlertCircle, Sparkles, Coffee, Building2, LogOut } from 'lucide-react';

interface AutoLockModalProps {
  user: User;
  settings: StoreSettings;
  activeOutlet?: Outlet;
  onUnlock: () => void;
  onLogout: () => void;
}

export const AutoLockModal: React.FC<AutoLockModalProps> = ({
  user,
  settings,
  activeOutlet,
  onUnlock,
  onLogout,
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Keyboard shortcut listener for numeric input & enter
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
  }, [pin, isSuccess]);

  const handleKeyPress = (digit: string) => {
    setError(null);
    if (pin.length < 8) {
      const newPin = pin + digit;
      setPin(newPin);

      // Auto submit on exact pin length match
      if (newPin.length === user.pin.length) {
        verifyPin(newPin);
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

  const verifyPin = (inputPin: string) => {
    if (inputPin === user.pin) {
      setIsSuccess(true);
      setError(null);
      setTimeout(() => {
        onUnlock();
      }, 350);
    } else {
      setError('PIN tidak sesuai! Silakan coba lagi.');
      setPin('');
      // Vibrate if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
  };

  const handleSubmit = () => {
    if (!pin) {
      setError('Masukkan PIN akun Anda');
      return;
    }
    verifyPin(pin);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1F1412]/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#2B1713] to-[#1F1412] text-[#FDFBF7] rounded-[32px] max-w-sm w-full p-6 sm:p-7 border-2 border-[#5D4037] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Store & Lock Icon */}
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
              {isSuccess ? (
                <Unlock className="w-8 h-8 text-emerald-400 animate-bounce" />
              ) : (
                <Lock className="w-8 h-8 text-amber-400" />
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-600 rounded-full border-2 border-[#2B1713] flex items-center justify-center text-[10px] font-black text-white" title="Auto-Lock Aktif">
              ⏱
            </span>
          </div>

          <div>
            <h3 className="font-serif italic font-bold text-lg text-amber-200">
              Layar Kasir Terkunci
            </h3>
            <p className="text-[11px] text-[#D7CCC8]">
              Tidak ada aktivitas selama 3 menit. Masukkan PIN untuk melanjutkan.
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="bg-[#3E2723]/90 p-3.5 rounded-2xl border border-[#5D4037] flex items-center gap-3 shadow-inner">
          <div className="relative shrink-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-11 h-11 rounded-full object-cover border-2 border-amber-400/60"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#5D4037] text-amber-200 flex items-center justify-center font-bold text-base border border-amber-500/40">
                {user.name.charAt(0)}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#3E2723]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-[#FAF3DD] truncate flex items-center gap-1.5">
              <span>{user.name}</span>
            </div>
            <div className="text-[11px] text-amber-300/90 font-medium flex items-center gap-1 mt-0.5">
              {user.role === 'admin' ? <Shield className="w-3 h-3 text-amber-400" /> : <UserCheck className="w-3 h-3 text-blue-300" />}
              <span className="capitalize">{user.role === 'admin' ? 'Owner / Admin' : 'Kasir Bertugas'}</span>
            </div>
            {activeOutlet && (
              <div className="text-[10px] text-[#D7CCC8] truncate flex items-center gap-1 mt-0.5">
                <Building2 className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="truncate">{activeOutlet.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* PIN Input Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#D7CCC8]">
              PIN Keamanan ({user.pin.length} Digit)
            </span>
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="text-[#D7CCC8] hover:text-amber-300 text-[11px] flex items-center gap-1 transition-colors"
            >
              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPin ? 'Sembunyikan' : 'Lihat PIN'}</span>
            </button>
          </div>

          {/* Dots / PIN Box */}
          <div className={`py-3 px-4 rounded-2xl bg-[#140B0A] border-2 transition-all flex items-center justify-center gap-3 min-h-[52px] shadow-inner ${
            error
              ? 'border-rose-500 bg-rose-950/30'
              : isSuccess
              ? 'border-emerald-500 bg-emerald-950/30'
              : 'border-[#5D4037] focus-within:border-amber-400'
          }`}>
            {showPin ? (
              <span className="font-mono text-2xl font-black tracking-widest text-amber-300">
                {pin || <span className="text-gray-600 text-sm font-sans font-normal tracking-normal">Ketik PIN...</span>}
              </span>
            ) : (
              <div className="flex items-center gap-3">
                {Array.from({ length: Math.max(user.pin.length, 4) }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      idx < pin.length
                        ? isSuccess
                          ? 'bg-emerald-400 scale-110 shadow-sm shadow-emerald-400'
                          : 'bg-amber-400 scale-110 shadow-sm shadow-amber-400'
                        : 'bg-[#5D4037]/70'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold px-1 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Numeric Touch Keypad */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="py-3 sm:py-3.5 rounded-2xl bg-[#3E2723] hover:bg-[#5D4037] active:scale-95 text-[#FAF3DD] font-mono font-black text-lg sm:text-xl border border-[#5D4037] shadow-md transition-all flex items-center justify-center hover:border-amber-400/50"
            >
              {num}
            </button>
          ))}

          {/* Bottom row: Clear, 0, Backspace */}
          <button
            type="button"
            onClick={handleClear}
            className="py-3 sm:py-3.5 rounded-2xl bg-[#2B1713] hover:bg-[#3E2723] active:scale-95 text-[#D7CCC8] font-bold text-xs border border-[#5D4037] shadow-xs transition-all uppercase tracking-wider"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="py-3 sm:py-3.5 rounded-2xl bg-[#3E2723] hover:bg-[#5D4037] active:scale-95 text-[#FAF3DD] font-mono font-black text-lg sm:text-xl border border-[#5D4037] shadow-md transition-all flex items-center justify-center hover:border-amber-400/50"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="py-3 sm:py-3.5 rounded-2xl bg-[#2B1713] hover:bg-[#3E2723] active:scale-95 text-rose-300 font-bold text-xs border border-[#5D4037] shadow-xs transition-all flex items-center justify-center"
            title="Hapus Digit Terakhir"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button & Logout Switcher */}
        <div className="pt-2 space-y-2 border-t border-[#5D4037]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSuccess || pin.length === 0}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-[#1F1412] font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSuccess ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Membuka Layar...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Buka Kunci Layar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 rounded-2xl bg-transparent hover:bg-rose-950/40 text-rose-300 hover:text-rose-200 font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Ganti Akun / Logout POS</span>
          </button>
        </div>

      </div>
    </div>
  );
};
