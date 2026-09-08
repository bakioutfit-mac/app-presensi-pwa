'use client';

import React, { useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle, ArrowRight, UserCheck, DollarSign } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdminPinModal({ isOpen, onClose }) {
  const { verifyAdminPin } = useAuth();
  const [role, setRole] = useState('leader'); // 'leader' | 'finance'
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!pin || pin.length !== 6) {
      setError('PIN harus berupa 6 digit angka.');
      return;
    }

    const res = verifyAdminPin(role, pin);
    if (res.success) {
      setPin('');
      onClose();
    } else {
      setError(res.error || 'PIN verifikasi salah.');
    }
  };

  const handleSelectRole = (newRole) => {
    setRole(newRole);
    setPin('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[380px] bg-white rounded-[28px] shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs tracking-wider text-slate-900 uppercase">
                Otorisasi Mode Admin
              </h3>
              <p className="text-[11px] text-slate-500">Pilih akses otorisasi admin</p>
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
        <div className="p-6 space-y-4">
          {/* Role Selector Tabs */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
              Pilih Akses Mode Admin:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Admin Leader */}
              <button
                type="button"
                onClick={() => handleSelectRole('leader')}
                className={`p-3.5 rounded-2xl border-2 transition text-left flex flex-col justify-between ${
                  role === 'leader'
                    ? 'border-[#EA580C] bg-orange-50/70 shadow-sm shadow-orange-500/10'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      role === 'leader' ? 'bg-[#EA580C] text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                  </div>
                  {role === 'leader' && (
                    <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">Admin Leader</h4>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Shift, Absensi &amp; Staf
                  </p>
                </div>
              </button>

              {/* Option 2: Admin Finance */}
              <button
                type="button"
                onClick={() => handleSelectRole('finance')}
                className={`p-3.5 rounded-2xl border-2 transition text-left flex flex-col justify-between ${
                  role === 'finance'
                    ? 'border-[#2563EB] bg-blue-50/70 shadow-sm shadow-blue-500/10'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      role === 'finance' ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                  </div>
                  {role === 'finance' && (
                    <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">Admin Finance</h4>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Gaji &amp; Titik GPS 3 Outlet
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Form Input PIN */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 ml-1">
                Masukkan 6-Digit PIN {role === 'leader' ? 'Leader' : 'Finance'}
              </label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-slate-900 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-900/10 transition">
                <Lock className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full bg-transparent text-sm font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none text-center"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full py-3.5 rounded-2xl text-xs font-bold text-white shadow-md transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer ${
                role === 'leader'
                  ? 'bg-gradient-to-r from-[#EA580C] to-[#C2410C] hover:from-[#C2410C] hover:to-[#9A3412] shadow-orange-500/20'
                  : 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-blue-500/20'
              }`}
            >
              <span>Verifikasi &amp; Buka Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Perubahan PIN Hubungi Fkrlbhq
          </p>
        </div>
      </div>
    </div>
  );
}
