'use client';

import React, { useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle, ArrowRight, UserCheck, DollarSign } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdminPinModal({ isOpen, onClose }) {
  const { verifyAdminPin, adminPins } = useAuth();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[370px] bg-white rounded-3xl shadow-2xl border-2 border-[#2563EB] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-200 bg-[#DCE0E6]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs tracking-wider text-[#1E3A8A]">
                VERIFIKASI PIN ADMIN
              </h3>
              <p className="text-[10px] text-gray-500">Pilih akses otorisasi admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-500 hover:text-gray-900 hover:bg-black/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Role Selector Tabs */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5 ml-1">
              Pilih Peran Mode Admin:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {/* Option 1: Admin Leader */}
              <button
                type="button"
                onClick={() => handleSelectRole('leader')}
                className={`p-3 rounded-2xl border-2 transition text-left flex flex-col justify-between ${
                  role === 'leader'
                    ? 'border-[#EA580C] bg-orange-50/90 shadow-sm'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      role === 'leader' ? 'bg-[#EA580C] text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                  </div>
                  {role === 'leader' && (
                    <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-gray-900">Admin Leader</h4>
                  <p className="text-[9px] text-gray-500 leading-tight mt-0.5">
                    Shift, Absensi &amp; Karyawan
                  </p>
                </div>
              </button>

              {/* Option 2: Admin Finance */}
              <button
                type="button"
                onClick={() => handleSelectRole('finance')}
                className={`p-3 rounded-2xl border-2 transition text-left flex flex-col justify-between ${
                  role === 'finance'
                    ? 'border-[#2563EB] bg-blue-50/90 shadow-sm'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      role === 'finance' ? 'bg-[#2563EB] text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                  </div>
                  {role === 'finance' && (
                    <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-gray-900">Admin Finance</h4>
                  <p className="text-[9px] text-gray-500 leading-tight mt-0.5">
                    Gaji &amp; Titik GPS 3 Outlet
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Input PIN */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-xs font-semibold text-gray-700">
                  PIN 6-Digit {role === 'leader' ? 'Admin Leader' : 'Admin Finance'}
                </label>
              </div>
              <div className="relative flex items-center bg-gray-100 rounded-2xl px-4 py-2.5 border border-gray-300 focus-within:ring-2 focus-within:ring-[#2563EB]/60 transition">
                <Lock className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full bg-transparent text-sm font-bold tracking-widest text-gray-800 placeholder-gray-400 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Quick Demo Fill Buttons */}
            <div className="pt-1 flex items-center justify-between text-[10px] text-gray-500 px-1">
              <span>PIN Default:</span>
              <button
                type="button"
                onClick={() => setPin(role === 'leader' ? adminPins.leader : adminPins.finance)}
                className="font-bold text-[#2563EB] hover:underline"
              >
                Gunakan PIN {role === 'leader' ? adminPins.leader : adminPins.finance}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-2 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>Verifikasi &amp; Buka Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[10px] text-gray-400 text-center">
            * Perubahan PIN admin dapat diatur melalui menu Tabel Editor Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
