'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Clock,
  MapPin,
  Camera,
  CheckCircle,
  AlertTriangle,
  X,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getLocalDateString, parseLocalDate } from '@/lib/date';
import LateCorrectionModal from '@/components/LateCorrectionModal';

export default function AttendanceHistoryTab() {
  const { user, todayAttendance, lateCorrections, refreshAttendance } = useAuth();
  const [history, setHistory] = useState([]);
  const [photoModal, setPhotoModal] = useState(null);
  const [correctionModal, setCorrectionModal] = useState({ open: false, record: null });

  const mapLeaveItem = (item) => {
    const dateObj = parseLocalDate(item.start_date);
    const dayName = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('id-ID', { weekday: 'long' })
      : 'Hari Kerja';
    const formattedStartDate = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : item.start_date;
    const formattedEndDate =
      item.end_date && item.end_date !== item.start_date
        ? parseLocalDate(item.end_date).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : null;

    const dateDisplay = formattedEndDate
      ? `${formattedStartDate} s/d ${formattedEndDate}`
      : formattedStartDate;

    return {
      id: item.id || `leave-${item.start_date}`,
      type: 'leave',
      raw_date: item.start_date,
      date: dateDisplay,
      day: dayName,
      leave_type: item.leave_type || 'Izin',
      status: item.status || 'Menunggu',
      reason: item.reason || 'Tidak ada keterangan khusus',
      document_url: item.document_url || null,
      late_duration_minutes: Number(item.late_duration_minutes || 0),
    };
  };

  const mapAttendanceItem = (item) => {
    const dateObj = parseLocalDate(item.attendance_date);
    const dayName = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('id-ID', { weekday: 'long' })
      : 'Hari Kerja';
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : item.attendance_date;

    const isWorking = !!item.check_in_time && !item.check_out_time;

    return {
      id: item.id || `att-${item.attendance_date}`,
      raw_date: item.attendance_date,
      date: formattedDate,
      day: dayName,
      check_in: item.check_in_time
        ? new Date(item.check_in_time).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB'
        : '-',
      check_out: item.check_out_time
        ? new Date(item.check_out_time).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB'
        : isWorking
        ? 'Sedang Bekerja'
        : '-',
      duration: item.working_hours_seconds
        ? `${Math.floor(item.working_hours_seconds / 3600)} Jam ${Math.floor(
            (item.working_hours_seconds % 3600) / 60
          )} Menit`
        : isWorking
        ? 'Aktif'
        : '-',
      status: item.status || (isWorking ? 'Sedang Bekerja' : 'Hadir Tepat Waktu'),
      discipline_penalty: item.discipline_penalty || 0,
      photo: item.check_out_photo || item.check_in_photo,
      location: `${item.branch || user?.branch || 'Outlet'} GPS (Valid)`,
      isWorking: !!isWorking,
      attendance_date: item.attendance_date,
      branch: item.branch || user?.branch || 'LazyBloom',
      check_in_time: item.check_in_time,
      name: user?.full_name || 'Staff',
    };
  };

  useEffect(() => {
    async function fetchAttendance() {
      if (!user) return;

      let baseList = [];
      let leavesList = [];
      const isValidUUID =
        typeof user.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);

      // 1. Ambil data presensi & data pengajuan izin dari Supabase
      if (isValidUUID) {
        try {
          const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', user.id)
            .order('attendance_date', { ascending: false });

          if (!error && data && data.length > 0) {
            baseList = data.map(mapAttendanceItem);
          }
        } catch (err) {
          console.warn('Supabase fetch attendance error:', err);
        }

        try {
          const { data: leaveData, error: leaveError } = await supabase
            .from('leaves')
            .select('*')
            .eq('employee_id', user.id)
            .order('start_date', { ascending: false });

          if (!leaveError && leaveData && leaveData.length > 0) {
            leavesList = leaveData.map(mapLeaveItem);
          }
        } catch (err) {
          console.warn('Supabase fetch leaves error:', err);
        }
      }

      // 2. Ambil dari riwayat lokal localStorage jika Supabase kosong atau mode demo/offline
      if (baseList.length === 0) {
        try {
          const localHistoryStr = localStorage.getItem('pwa_attendance_history');
          if (localHistoryStr) {
            const parsed = JSON.parse(localHistoryStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const userFiltered = parsed.filter((p) => !p.employee_id || p.employee_id === user.id);
              if (userFiltered.length > 0) {
                baseList = userFiltered.map(mapAttendanceItem);
              }
            }
          }
        } catch (e) {
          console.warn('Local history parse error:', e);
        }
      }

      // 3. SINKRONKAN REAKTIF DENGAN todayAttendance
      let currentToday = todayAttendance;
      if (!currentToday) {
        try {
          const savedToday = localStorage.getItem('pwa_today_attendance');
          if (savedToday) currentToday = JSON.parse(savedToday);
        } catch (e) {}
      }

      if (currentToday && (currentToday.check_in_time || currentToday.check_out_time)) {
        const todayStr = currentToday.attendance_date || getLocalDateString();
        const formattedToday = mapAttendanceItem(currentToday);

        const existingIdx = baseList.findIndex((item) => {
          if (item.raw_date && item.raw_date === todayStr) return true;
          const dateObj = parseLocalDate(todayStr);
          const fDate = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            : todayStr;
          return item.date === fDate;
        });

        if (existingIdx >= 0) {
          baseList[existingIdx] = formattedToday;
        } else {
          baseList = [formattedToday, ...baseList];
        }
      }

      // 4. Gabungkan riwayat kehadiran fisik & pengajuan izin, lalu urutkan berdasarkan tanggal terbaru
      const combined = [...baseList, ...leavesList].sort((a, b) => {
        const dateA = new Date(a.raw_date || 0).getTime();
        const dateB = new Date(b.raw_date || 0).getTime();
        return dateB - dateA;
      });

      setHistory(combined);
    }

    fetchAttendance();

    // Listener otomatis pembaruan izin real-time
    const handleLeaveUpdate = () => {
      fetchAttendance();
    };
    window.addEventListener('pwa_leave_submitted', handleLeaveUpdate);
    window.addEventListener('pwa_leave_status_changed', handleLeaveUpdate);

    return () => {
      window.removeEventListener('pwa_leave_submitted', handleLeaveUpdate);
      window.removeEventListener('pwa_leave_status_changed', handleLeaveUpdate);
    };
  }, [user, todayAttendance]);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900">
              Riwayat Daftar Hadir
            </h3>
            <p className="text-[10px] text-slate-500">
              Log kehadiran real-time &amp; verifikasi GPS
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black bg-[#2563EB] text-white px-2.5 py-1 rounded-full shadow-xs">
          Total: {history.length} Riwayat
        </span>
      </div>

      {/* History Items */}
      {history.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-[#2563EB]">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Belum Ada Riwayat Presensi</h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Data kehadiran akan otomatis tercatat dan tersimpan di sini setelah Anda melakukan Presensi Masuk di Tab Presensi.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((h) => {
            // JIKA TIPE ITEM ADALAH PENGAJUAN IZIN / SAKIT
            if (h.type === 'leave') {
              const isApproved = h.status === 'Disetujui';
              const isRejected = h.status === 'Ditolak';
              const isPending = h.status === 'Menunggu';

              return (
                <div
                  key={h.id}
                  className={`border rounded-2xl p-3.5 shadow-xs flex items-center justify-between transition ${
                    isPending
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : isApproved
                      ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail Dokumen / Izin */}
                    <button
                      type="button"
                      onClick={() => h.document_url && setPhotoModal(h.document_url)}
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 relative transition ${
                        h.document_url
                          ? 'bg-blue-50 border-blue-200 text-[#2563EB] hover:bg-blue-100 cursor-pointer'
                          : 'bg-slate-100 border-slate-200 text-slate-400 cursor-default'
                      }`}
                      title={h.document_url ? 'Klik untuk lihat surat/bukti' : 'Pengajuan Izin'}
                    >
                      <FileText className="w-5 h-5" />
                      {h.document_url && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[9px] shadow-xs">
                          <Eye className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>

                    <div className="text-left space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-500">{h.day},</span>
                        <h4 className="text-xs font-black text-slate-900">{h.date}</h4>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-800">
                          {h.leave_type}
                        </span>
                        {/* Status Badge */}
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${
                            isPending
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {isPending && <Clock className="w-2.5 h-2.5 text-amber-600 animate-pulse" />}
                          {isApproved && <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />}
                          {isRejected && <XCircle className="w-2.5 h-2.5 text-rose-600" />}
                          <span>
                            {isPending
                              ? 'Menunggu Approval'
                              : isApproved
                              ? 'Disetujui Finance'
                              : 'Ditolak'}
                          </span>
                        </span>
                      </div>

                      {/* Detail Keterangan Alasan */}
                      <p className="text-[11px] text-slate-600 italic">
                        &ldquo;{h.reason}&rdquo;
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                        {h.late_duration_minutes > 0 && (
                          <span className="text-amber-700 font-bold">
                            Durasi: {h.late_duration_minutes} mnt •
                          </span>
                        )}
                        <span>
                          {h.document_url
                            ? 'Lampiran surat dokter tersedia (klik thumbnail)'
                            : 'Tanpa lampiran dokumen'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // JIKA TIPE ITEM ADALAH PRESENSI KERJA BIASA
            const isLate = (h.status || '').toLowerCase().includes('terlambat');
            const correction = (lateCorrections || []).find(
              (c) =>
                (c.attendance_id && c.attendance_id === h.id) ||
                (c.employee_id === user?.id && c.attendance_date === h.raw_date)
            );

            return (
              <div
                key={h.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 transition flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Photo Thumbnail */}
                    <button
                      type="button"
                      onClick={() => h.photo && setPhotoModal(h.photo)}
                      className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative group shrink-0"
                    >
                      {h.photo ? (
                        <>
                          <img
                            src={h.photo}
                            alt="Selfie Presensi"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Camera className="w-3.5 h-3.5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}
                    </button>

                    <div className="text-left space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-500">{h.day},</span>
                        <h4 className="text-xs font-black text-slate-900">
                          {h.date}
                        </h4>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm ${
                            h.isWorking
                              ? 'bg-blue-100 text-blue-700 animate-pulse'
                              : isLate
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {h.status}
                        </span>
                        {h.discipline_penalty > 0 && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded-sm">
                            Denda Rp 10.000
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Masuk: {h.check_in}
                        </span>
                        <span>
                          • Pulang:{' '}
                          <span className={h.isWorking ? 'text-blue-600 font-bold' : ''}>
                            {h.check_out}
                          </span>
                        </span>
                        {h.duration && h.duration !== '-' && (
                          <span className="text-[10px] text-slate-400">({h.duration})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{h.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seksi Aksi Koreksi Keterlambatan */}
                {isLate && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    {correction ? (
                      correction.status === 'pending' ? (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl">
                          <span className="animate-spin">⏳</span>
                          <span>Menunggu Review Leader: <strong>{correction.target_shift}</strong></span>
                        </div>
                      ) : correction.status === 'approved' ? (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl">
                          <span>✅</span>
                          <span>Koreksi Disetujui ({correction.target_shift}) &bull; Denda Rp 0</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-1 rounded-xl">
                            ❌ Koreksi Ditolak ({correction.review_notes || 'Jadwal sesuai'})
                          </span>
                          <button
                            type="button"
                            onClick={() => setCorrectionModal({ open: true, record: h })}
                            className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                          >
                            Ajukan Ulang
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCorrectionModal({ open: true, record: h })}
                        className="text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 px-2.5 py-1 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                      >
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Ajukan Koreksi Keterlambatan</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Preview Modal */}
      {photoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative bg-white rounded-3xl p-4 shadow-2xl max-w-[320px] w-full border border-slate-200">
            <button
              type="button"
              onClick={() => setPhotoModal(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="rounded-2xl overflow-hidden aspect-square border border-slate-200">
              <img
                src={photoModal}
                alt="Selfie Detail"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-center text-xs font-bold text-slate-800 mt-2.5">
              Foto Selfie Presensi GPS Terverifikasi
            </p>
          </div>
        </div>
      )}

      {/* Modal Pengajuan Koreksi Keterlambatan */}
      <LateCorrectionModal
        isOpen={correctionModal.open}
        onClose={() => setCorrectionModal({ open: false, record: null })}
        attendanceRecord={correctionModal.record}
        onSuccess={() => {
          if (refreshAttendance) refreshAttendance();
        }}
      />
    </div>
  );
}
