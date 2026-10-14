'use client';

import React, { useState } from 'react';
import { X, Clock, Calendar, AlertCircle, CheckCircle2, ChevronRight, History, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getLocalDateString, formatIndonesianDate } from '@/lib/date';

const formatHariTanggalBulanTahun = (dateStr) => {
  if (!dateStr) return '';
  return formatIndonesianDate(dateStr, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export default function OvertimeModal({ isOpen, onClose }) {
  const { user, userOutlet, currentOutlet, outlets } = useAuth();
  const outlet = userOutlet || currentOutlet || outlets?.[0];

  const [date, setDate] = useState(getLocalDateString());
  const [hours, setHours] = useState('2');
  const [reason, setReason] = useState('');
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'history'
  const [submittedPreview, setSubmittedPreview] = useState(false);

  if (!isOpen) return null;

  const handlePreviewSubmit = (e) => {
    e.preventDefault();
    // Tampilan dulu (preview interaktif sebelum integrasi logika backend penuh)
    setSubmittedPreview(true);
    setTimeout(() => {
      setSubmittedPreview(false);
      onClose();
    }, 2000);
  };

  const presetHours = ['1', '2', '3', '4', '5'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[400px] bg-white rounded-3xl shadow-2xl border-2 border-[#F97316] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#F97316]/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide text-slate-800">
                PENGAJUAN LEMBUR
              </h3>
              <p className="text-[10px] font-semibold text-[#F97316]">
                Role Staf &amp; Leader
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi: Form Pengajuan vs Riwayat */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 m-4 mb-2 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'form'
                ? 'bg-white text-[#F97316] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Form Lembur</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-[#F97316] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Saya</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="px-4 pb-4 max-h-[75vh] overflow-y-auto">
          {activeTab === 'form' ? (
            submittedPreview ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-in zoom-in-50 duration-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-black text-sm text-slate-800">
                  Pengajuan Lembur Terkirim!
                </h4>
                <p className="text-xs text-slate-500 max-w-[260px] mx-auto">
                  Pengajuan lembur Anda untuk tanggal <span className="font-semibold text-slate-700">{date}</span> ({hours} jam) berhasil disimpan.
                </p>
                <div className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
                  (Preview Tampilan Selesai)
                </div>
              </div>
            ) : (
              <form onSubmit={handlePreviewSubmit} className="space-y-3.5 pt-1">
                {/* Info Karyawan */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Nama Pemohon
                    </p>
                    <p className="text-xs font-extrabold text-slate-800">
                      {user?.name || 'Staf 3 Pillar'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {user?.role || 'Staff'} • {outlet?.name || 'LazyBloom'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 bg-[#F97316]/10 text-[#F97316] rounded-full border border-[#F97316]/20">
                    Aktif
                  </span>
                </div>

                {/* Tanggal Lembur */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                    Tanggal Pelaksanaan Lembur
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
                    />
                  </div>
                </div>

                {/* Durasi Jam Lembur */}
                <div>
                  <div className="flex items-center justify-between mb-1 ml-1">
                    <label className="text-xs font-bold text-slate-700">
                      Durasi Lembur (Jam)
                    </label>
                    <span className="text-[11px] font-extrabold text-[#F97316]">
                      {hours || 0} Jam Kerja
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {presetHours.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHours(h)}
                        className={`py-1.5 rounded-xl text-xs font-extrabold transition border ${
                          hours === h
                            ? 'bg-[#F97316] text-white border-[#F97316] shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {h} Jam
                      </button>
                    ))}
                  </div>

                  {/* Custom Number Input */}
                  <div className="relative">
                    <input
                      type="number"
                      min="0.5"
                      max="12"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="Atau ketik durasi jam (misal 2.5)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
                    />
                  </div>
                </div>

                {/* Alasan / Uraian Tugas */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                    Alasan / Uraian Tugas Lembur
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    placeholder="Contoh: Bongkar muat barang masuk dari gudang, stok opname mingguan, atau backup kasir saat promo toko..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316] resize-none"
                  />
                </div>

                {/* Catatan Info */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Pengajuan lembur akan ditinjau oleh <strong>Leader / Finance</strong>. Nominal insentif lembur akan dihitung pada rekap gaji bulanan.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-1/3 py-3 border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-50 active:scale-98 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-3 bg-gradient-to-r from-[#F97316] to-amber-600 hover:from-orange-600 hover:to-amber-700 active:scale-98 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Ajukan Lembur</span>
                  </button>
                </div>
              </form>
            )
          ) : (
            /* TAB RIWAYAT */
            <div className="py-2 space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Daftar Pengajuan Lembur Terakhir
              </p>

              {/* Sample item 1 */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-slate-800">
                      {formatHariTanggalBulanTahun(date)} <span className="text-amber-600 font-semibold">(Menunggu Review)</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Durasi: {hours || 2} Jam • {reason || 'Stok opname & display produk'}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-xs font-black text-[#F97316]">
                    +{hours || 2} Jam
                  </span>
                </div>
              </div>

              {/* Sample item 2 */}
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-slate-700">
                      {formatHariTanggalBulanTahun('2026-10-08')} <span className="text-emerald-600 font-semibold">(Disetujui)</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Durasi: 3 Jam • Closing kasir & rekap mingguan
                  </p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-xs font-black text-emerald-600">
                    +3 Jam
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-center text-slate-400 pt-3">
                Riwayat lengkap akan tersinkronisasi otomatis dengan akun Finance Anda.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
