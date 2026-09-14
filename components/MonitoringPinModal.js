'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function MonitoringPinModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'verify',
}) {
  const { adminPins, verifyAdminPin, updateAdminPin } = useAuth();

  const [mode, setMode] = useState(initialMode); // 'verify' | 'change'
  
  // Verify state
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Change PIN state
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef(null);

  // Reset states saat modal dibuka / ditutup
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'verify');
      setPin('');
      setShowPin(false);
      setError('');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setChangeError('');
      setChangeSuccess('');
      setIsSaving(false);
      setIsVerifying(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  // Handle submit verifikasi PIN
  const handleVerifySubmit = (e) => {
    e.preventDefault();
    setError('');

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length !== 6) {
      setError('PIN harus berupa 6 digit angka.');
      return;
    }

    setIsVerifying(true);
    const res = verifyAdminPin('monitoring', cleanPin);
    setIsVerifying(false);

    if (res.success) {
      setPin('');
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || 'PIN verifikasi salah.');
    }
  };

  // Handle submit ganti PIN
  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    setChangeError('');
    setChangeSuccess('');

    const currentMonitoringPin = adminPins?.monitoring || '654321';
    const currentLeaderPin = adminPins?.leader || '987321';

    // Verifikasi PIN lama atau PIN Admin Leader
    if (!oldPin || (oldPin !== currentMonitoringPin && oldPin !== currentLeaderPin)) {
      setChangeError('PIN Lama salah! (Anda juga bisa menggunakan PIN Leader utama sebagai verifikasi).');
      return;
    }

    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setChangeError('PIN Baru harus berupa 6 digit angka.');
      return;
    }

    if (newPin !== confirmPin) {
      setChangeError('Konfirmasi PIN Baru tidak cocok.');
      return;
    }

    if (newPin === oldPin) {
      setChangeError('PIN Baru tidak boleh sama dengan PIN saat ini.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateAdminPin('monitoring', newPin);
      if (res.success) {
        setChangeSuccess('PIN Akses Monitoring berhasil diperbarui!');
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
        // Otomatis langsung buka akses setelah 1.2 detik
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1200);
      } else {
        setChangeError(res.error || 'Gagal menyimpan PIN baru.');
      }
    } catch (err) {
      setChangeError('Terjadi kesalahan saat memperbarui PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[390px] bg-white rounded-[28px] shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Header Modal */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              {mode === 'change' ? (
                <KeyRound className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-xs tracking-wider text-slate-900 uppercase">
                {mode === 'change' ? 'Ganti PIN Monitoring' : 'Akses Tab Monitoring'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {mode === 'change'
                  ? 'Perbarui PIN keamanan monitoring'
                  : 'Verifikasi PIN khusus monitoring'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {mode === 'verify' ? (
            /* ================= MODE VERIFIKASI ================= */
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                  Tab <strong>Monitoring Presensi</strong> dilindungi PIN terpisah untuk menjaga kerahasiaan data presensi dan denda.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 ml-1">
                  Masukkan PIN Monitoring (6 Digit):
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/10 transition">
                  <Lock className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                  <input
                    ref={inputRef}
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Masukkan 6 digit angka"
                    className="w-full bg-transparent text-slate-900 font-mono tracking-widest text-base font-bold focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
                  PIN awal default: <span className="font-mono font-bold text-slate-600">654321</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || pin.length !== 6}
                  className="flex-2 py-3 px-4 rounded-xl bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Buka Tab Monitoring</span>
                    </>
                  )}
                </button>
              </div>

              {/* Switch to Change PIN */}
              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('change');
                    setError('');
                  }}
                  className="text-xs font-bold text-[#EA580C] hover:text-orange-700 inline-flex items-center gap-1.5 transition"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Ganti / Perbarui PIN Monitoring</span>
                </button>
              </div>
            </form>
          ) : (
            /* ================= MODE GANTI PIN ================= */
            <form onSubmit={handleChangePinSubmit} className="space-y-3.5">
              <button
                type="button"
                onClick={() => {
                  setMode('verify');
                  setChangeError('');
                  setChangeSuccess('');
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Verifikasi</span>
              </button>

              {changeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="font-medium">{changeError}</span>
                </div>
              )}

              {changeSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-bold">{changeSuccess}</span>
                </div>
              )}

              {/* PIN Lama */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 ml-1">
                  PIN Lama / PIN Leader:
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-orange-500 focus-within:bg-white transition">
                  <Lock className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type={showOldPin ? 'text' : 'password'}
                    maxLength={6}
                    inputMode="numeric"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="PIN Monitoring lama / PIN Leader"
                    className="w-full bg-transparent text-slate-900 font-mono text-sm font-bold focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPin(!showOldPin)}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  >
                    {showOldPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* PIN Baru */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 ml-1">
                  PIN Baru (6 Digit):
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-orange-500 focus-within:bg-white transition">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    maxLength={6}
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 digit angka baru"
                    className="w-full bg-transparent text-slate-900 font-mono text-sm font-bold focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  >
                    {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi PIN Baru */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 ml-1">
                  Ulangi PIN Baru:
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-orange-500 focus-within:bg-white transition">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    maxLength={6}
                    inputMode="numeric"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ketik ulang 6 digit angka baru"
                    className="w-full bg-transparent text-slate-900 font-mono text-sm font-bold focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Tombol Simpan */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('verify')}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || newPin.length !== 6 || confirmPin.length !== 6}
                  className="flex-2 py-2.5 px-3 rounded-xl bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Simpan PIN Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
