'use client';

import React, { useState } from 'react';
import { Phone, Lock, AlertCircle, Loader2, ArrowRight, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BrandLogo from './BrandLogo';
import AdminPinModal from './AdminPinModal';

export default function LoginCard() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError('Harap masukkan nomor HP terdaftar.');
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
      setError(res.error || 'Nomor HP atau PIN salah. Silakan periksa kembali.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200">
      {/* Brand Header */}
      <div className="mb-6 text-center select-none animate-in fade-in duration-300">
        <BrandLogo variant="header" size="lg" />
      </div>

      {/* Modern Clean Card */}
      <div className="w-full max-w-[390px] bg-white rounded-[32px] shadow-2xl shadow-slate-300/60 border border-slate-100 overflow-hidden backdrop-blur-md transition-all">
        {/* Decorative Top Accent Bar (3 Pilar Color Gradient) */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#F97316] via-[#059669] to-[#2563EB]" />

        {/* Card Body */}
        <div className="p-7 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Masuk Presensi Staf
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan Nomor HP &amp; PIN yang telah didaftarkan
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input No HP */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 ml-1">
                Nomor Handphone
              </label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-[#F97316] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#F97316]/15 transition duration-150">
                <Phone className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            {/* Input 6 Digit PIN */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 ml-1">
                6-Digit PIN Keamanan
              </label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-[#F97316] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#F97316]/15 transition duration-150">
                <Lock className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full bg-transparent text-sm font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] shadow-lg shadow-orange-500/25 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Presensi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Akses Admin
            </span>
          </div>

          {/* Direct Admin Access Button */}
          <button
            type="button"
            onClick={() => setAdminModalOpen(true)}
            className="w-full py-3 px-4 rounded-2xl font-bold text-xs text-slate-800 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <UserCog className="w-4 h-4 text-[#EA580C]" />
            <span>Masuk Mode Admin (Leader / Finance)</span>
          </button>

          {/* Security & Outlet Guarantee Footer */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Terhubung Terenkripsi ke Supabase</span>
          </div>
        </div>
      </div>

      {/* Modal Verifikasi PIN Admin */}
      <AdminPinModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />

      {/* Footer Branding */}
      <p className="mt-6 text-xs text-slate-600 font-medium text-center">
        3 Pillar Management &bull; LazyBloom &bull; Deru Ombak &bull; Sea Cafe
      </p>
    </div>
  );
}
