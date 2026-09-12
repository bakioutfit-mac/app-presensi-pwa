'use client';

import React, { useState, useRef } from 'react';
import { X, FileText, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { uploadLeaveDocument } from '@/lib/storage';
import { getLocalDateString } from '@/lib/date';

export default function LeaveModal({ isOpen, onClose }) {
  const { user, submitLeave } = useAuth();
  const [leaveType, setLeaveType] = useState('Sakit');
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [lateDuration, setLateDuration] = useState('45');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selected));
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Harap isi alasan pengajuan izin.');
      return;
    }

    setLoading(true);
    try {
      let documentUrl = null;
      if (file) {
        documentUrl = await uploadLeaveDocument(file, user?.employee_id || 'emp');
      }

      const res = await submitLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        late_duration_minutes: leaveType === 'Izin Terlambat' ? Number(lateDuration) : 0,
        reason,
        document_url: documentUrl,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'Gagal mengajukan izin.');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[390px] bg-white rounded-3xl shadow-2xl border-2 border-[#F97316] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#F97316]/40 bg-[#CACFD6]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2563EB]" />
            <h3 className="font-extrabold text-sm tracking-wider text-[#2563EB]">
              FORM PENGAJUAN IZIN
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-500 hover:text-gray-800 hover:bg-black/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 max-h-[80vh] overflow-y-auto">
          {success ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-sm text-gray-800">
                Pengajuan Izin Berhasil Dikirim!
              </h4>
              <p className="text-xs text-gray-500">
                Pengajuan izin Anda telah tercatat dan menunggu persetujuan dari Admin Finance.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Kategori Izin */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">
                  Kategori Izin
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
                >
                  <option value="Sakit">Sakit (Surat Dokter)</option>
                  <option value="Cuti Tahunan">Cuti Tahunan</option>
                  <option value="Izin Terlambat">Izin Terlambat</option>
                  <option value="Izin Pulang Cepat">Izin Pulang Cepat</option>
                  <option value="Lainnya">Keperluan Mendesak / Lainnya</option>
                </select>
              </div>

              {/* If Izin Terlambat: Input Durasi Menit */}
              {leaveType === 'Izin Terlambat' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <label className="block text-xs font-semibold text-amber-900">
                    Durasi Keterlambatan (Menit)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={lateDuration}
                    onChange={(e) => setLateDuration(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-amber-700 leading-tight">
                    * Catatan: Izin terlambat &gt; 30 menit akan otomatis menonaktifkan tombol presensi masuk hari ini.
                  </p>
                </div>
              )}

              {/* Tanggal */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">
                    Mulai Tanggal
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
                  />
                </div>
              </div>

              {/* Keterangan / Alasan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">
                  Keterangan / Alasan
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan izin / sakit..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
                  required
                />
              </div>

              {/* Upload Bukti Surat / Foto */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">
                  Upload Foto Bukti / Surat Dokter (Opsional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-[#F97316] rounded-xl p-3 flex flex-col items-center justify-center gap-1 text-xs text-gray-600 transition bg-gray-50 hover:bg-orange-50/40"
                >
                  <Upload className="w-5 h-5 text-gray-400" />
                  {file ? (
                    <span className="font-semibold text-gray-800 truncate max-w-[240px]">
                      {file.name}
                    </span>
                  ) : (
                    <span>Pilih Foto atau Dokumen Surat</span>
                  )}
                </button>

                {filePreview && (
                  <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-gray-300 mx-auto">
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F97316] hover:bg-[#EA580C] active:scale-98 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengunggah & Menyimpan...</span>
                    </>
                  ) : (
                    <span>Kirim Pengajuan Izin</span>
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
