'use client';

import React, { useState } from 'react';
import { Phone, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BrandLogo from './BrandLogo';

export default function LoginCard() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('085775560400');
  const [pin, setPin] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError('Harap masukkan nomor HP.');
      return;
    }
    if (!pin.trim() || pin.length < 6) {
      setError('PIN harus berupa 6 digit angka.');
      return;
    }

    setLoading(true);
    const res = await login(phone, pin);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Login gagal.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      {/* Brand Header */}
      <div className="mb-8 text-center select-none">
        <BrandLogo variant="header" size="lg" />
      </div>

      {/* Floating macOS Card */}
      <div className="w-full max-w-[380px] bg-[#A8ADB4] rounded-[28px] shadow-2xl overflow-hidden border border-white/40 backdrop-blur-sm transition-all">
        {/* Window Top Bar with 3 macOS Dots */}
        <div className="bg-[#D1D5DB] px-5 py-3.5 flex items-center gap-2 border-b border-[#9CA3AF]/40">
          <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#27C93F] shadow-inner" />
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-7">
          <h2 className="text-xl font-bold text-center text-[#1E293B] mb-6">
            Log In Presensi
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100/90 border border-red-300 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input No HP */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5 ml-2">
                Masukan No. Hp
              </label>
              <div className="relative flex items-center bg-[#DCE0E6] rounded-full px-4 py-2.5 shadow-inner focus-within:ring-2 focus-within:ring-[#F97316]/60 transition">
                <Phone className="w-4 h-4 text-gray-500 mr-3 shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full bg-transparent text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Input 6 Digit PIN */}
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5 ml-2">
                Masukan 6 Digit PIN
              </label>
              <div className="relative flex items-center bg-[#DCE0E6] rounded-full px-4 py-2.5 shadow-inner focus-within:ring-2 focus-within:ring-[#F97316]/60 transition">
                <Lock className="w-4 h-4 text-gray-500 mr-3 shrink-0" />
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-transparent text-sm font-medium tracking-widest text-gray-800 placeholder-gray-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Quick Demo Fill Pill for 3 Outlets */}
            <div className="pt-2 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider text-center">
                Pilih Akun Demo Outlet:
              </p>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setPhone('085775560400');
                    setPin('123456');
                  }}
                  className={`p-1.5 rounded-lg border transition text-center ${
                    phone === '085775560400'
                      ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                      : 'bg-white/80 text-orange-700 border-orange-300 hover:bg-orange-100'
                  }`}
                >
                  LazyBloom
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhone('081233445566');
                    setPin('123456');
                  }}
                  className={`p-1.5 rounded-lg border transition text-center ${
                    phone === '081233445566'
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                      : 'bg-white/80 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  Deru Ombak
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhone('081998877665');
                    setPin('123456');
                  }}
                  className={`p-1.5 rounded-lg border transition text-center ${
                    phone === '081998877665'
                      ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                      : 'bg-white/80 text-sky-800 border-sky-300 hover:bg-sky-100'
                  }`}
                >
                  Sea Cafe
                </button>
              </div>

              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setPhone('081234567890');
                    setPin('654321');
                  }}
                  className="text-[10px] text-gray-600 hover:text-gray-900 underline underline-offset-2 transition"
                >
                  Atau Gunakan Akun Admin HQ
                </button>
              </div>
            </div>

            {/* Submit Button inside Card Footer line */}
            <div className="pt-4 border-t border-white/50 -mx-6 sm:-mx-7 -mb-6 sm:-mb-7">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-center font-semibold text-sm text-[#1E293B] hover:bg-black/10 active:bg-black/15 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>Masuk</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
