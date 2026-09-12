'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, CheckCircle2, ChevronRight, Sparkles, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getOutletShifts } from '@/lib/shifts';

export default function LateCorrectionModal({
  isOpen,
  onClose,
  attendanceRecord,
  onSuccess,
}) {
  const { user, submitLateCorrection } = useAuth();
  const [selectedShift, setSelectedShift] = useState('');
  const [customShift, setCustomShift] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  // Ambil daftar shift outlet
  const branchName = attendanceRecord?.branch || user?.branch || 'LazyBloom';
  const outletShifts = getOutletShifts(branchName);

  useEffect(() => {
    if (isOpen) {
      if (outletShifts.length > 0) {
        setSelectedShift(outletShifts[0].name);
      }
      setReason('');
      setCustomShift('');
      setErrorMsg('');
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen, branchName]);

  if (!isOpen || !attendanceRecord) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const finalTargetShift = selectedShift === 'custom' ? customShift.trim() : selectedShift;

    if (!finalTargetShift) {
      setErrorMsg('Pilih atau tentukan jadwal shift sebenarnya.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Tuliskan alasan atau keterangan koreksi.');
      return;
    }

    setLoading(true);
    try {
      const res = await submitLateCorrection({
        attendanceId: attendanceRecord.id || attendanceRecord.attendance_id,
        employeeId: attendanceRecord.employee_id || user?.id,
        employeeName: attendanceRecord.name || user?.full_name,
        branch: branchName,
        attendanceDate: attendanceRecord.attendance_date || attendanceRecord.raw_date,
        checkInTime: attendanceRecord.check_in_time || attendanceRecord.check_in,
        originalStatus: attendanceRecord.status,
        targetShift: finalTargetShift,
        reason: reason.trim(),
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) onSuccess(res.data);
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Gagal mengajukan koreksi.');
      }
    } catch (err) {
      console.error('Submit late correction error:', err);
      setErrorMsg('Terjadi kesalahan sistem saat mengajukan koreksi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900">
                Ajukan Koreksi Keterlambatan
              </h3>
              <p className="text-[10px] text-slate-500">
                Klarifikasi jam shift ke Leader Outlet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800">
          {success ? (
            <div className="py-12 text-center space-y-2 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-black text-slate-900">Pengajuan Terkirim!</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Koreksi keterlambatan Anda telah dikirimkan ke Sub-Tab Monitoring Leader untuk diverifikasi.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ringkasan Presensi Terlambat */}
              <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    Data Presensi Terdeteksi
                  </span>
                  <span className="text-[9px] font-black bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded-full">
                    {attendanceRecord.status || 'Terlambat'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-rose-200/60">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Tanggal:</span>
                    <span className="font-bold text-slate-800 text-[11px]">
                      {attendanceRecord.date || attendanceRecord.attendance_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Jam Masuk:</span>
                    <span className="font-bold text-slate-800 text-[11px]">
                      {attendanceRecord.check_in || attendanceRecord.check_in_time || '-'}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-rose-700 font-semibold bg-white/80 p-2 rounded-xl border border-rose-200/50 flex items-center justify-between">
                  <span>Potongan Disiplin:</span>
                  <strong className="font-black text-rose-600">Rp 10.000 (Akan dihapus jika disetujui)</strong>
                </div>
              </div>

              {/* Pilihan Shift Sebenarnya */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
                  Jadwal Shift Sebenarnya ({branchName}):
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {outletShifts.map((shift) => (
                    <label
                      key={shift.id}
                      onClick={() => setSelectedShift(shift.name)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition ${
                        selectedShift === shift.name
                          ? 'border-[#EA580C] bg-orange-50/80 text-orange-950 font-bold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                            selectedShift === shift.name
                              ? 'border-[#EA580C] bg-[#EA580C]'
                              : 'border-slate-300'
                          }`}
                        >
                          {selectedShift === shift.name && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span>{shift.name}</span>
                      </div>
                    </label>
                  ))}

                  {/* Opsi Shift Kustom / Lainnya */}
                  <label
                    onClick={() => setSelectedShift('custom')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition ${
                      selectedShift === 'custom'
                        ? 'border-[#EA580C] bg-orange-50/80 text-orange-950 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          selectedShift === 'custom'
                            ? 'border-[#EA580C] bg-[#EA580C]'
                            : 'border-slate-300'
                        }`}
                      >
                        {selectedShift === 'custom' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span>Jadwal Lainnya (Ketik Manual)</span>
                    </div>
                  </label>
                </div>

                {selectedShift === 'custom' && (
                  <input
                    type="text"
                    value={customShift}
                    onChange={(e) => setCustomShift(e.target.value)}
                    placeholder="Contoh: Shift Middle Khusus 10:30 - 19:30"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                    required
                  />
                )}
              </div>

              {/* Alasan / Catatan */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Alasan / Keterangan Koreksi:
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Jadwal saya Shift Middle jam 11.00 WIB, datang jam 09.45 untuk persiapan toko bersama kasir."
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40 resize-none"
                  required
                />
              </div>

              {errorMsg && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {errorMsg}
                </p>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-bold text-xs shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Mengirim...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Pengajuan</span>
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
