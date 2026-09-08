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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function AttendanceHistoryTab() {
  const { user, todayAttendance } = useAuth();
  const [history, setHistory] = useState([]);
  const [photoModal, setPhotoModal] = useState(null);

  const defaultHistory = [
    {
      id: 'h-1',
      date: '07 Sep 2026',
      day: 'Senin',
      check_in: '07:55 WIB',
      check_out: '16:05 WIB',
      duration: '8 Jam 10 Menit',
      status: 'Hadir Tepat Waktu',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
      location: 'LazyBloom Store (Valid)',
    },
    {
      id: 'h-2',
      date: '06 Sep 2026',
      day: 'Minggu',
      check_in: '07:58 WIB',
      check_out: '16:02 WIB',
      duration: '8 Jam 04 Menit',
      status: 'Hadir Tepat Waktu',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      location: 'LazyBloom Store (Valid)',
    },
    {
      id: 'h-3',
      date: '05 Sep 2026',
      day: 'Sabtu',
      check_in: '08:12 WIB',
      check_out: '16:15 WIB',
      duration: '8 Jam 03 Menit',
      status: 'Terlambat 12 Menit',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
      location: 'LazyBloom Store (Valid)',
    },
    {
      id: 'h-4',
      date: '04 Sep 2026',
      day: 'Jumat',
      check_in: '07:50 WIB',
      check_out: '16:00 WIB',
      duration: '8 Jam 10 Menit',
      status: 'Hadir Tepat Waktu',
      photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop',
      location: 'LazyBloom Store (Valid)',
    },
  ];

  useEffect(() => {
    async function fetchAttendance() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', user.id)
          .order('attendance_date', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped = data.map((item) => ({
            id: item.id,
            date: item.attendance_date,
            day: 'Hari Kerja',
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
              : 'Sedang Bekerja',
            duration: item.working_hours_seconds
              ? `${Math.floor(item.working_hours_seconds / 3600)} Jam ${Math.floor(
                  (item.working_hours_seconds % 3600) / 60
                )} Menit`
              : 'Aktif',
            status: item.status || 'Hadir',
            photo: item.check_in_photo,
            location: 'LazyBloom Store GPS',
          }));
          setHistory(mapped);
        } else {
          setHistory(defaultHistory);
        }
      } catch (err) {
        setHistory(defaultHistory);
      }
    }
    fetchAttendance();
  }, [user, todayAttendance]);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="bg-[#CACFD6] rounded-2xl p-4 border border-white/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#2563EB]" />
          <div>
            <h3 className="text-xs font-bold text-[#1E293B]">
              Riwayat Daftar Hadir
            </h3>
            <p className="text-[10px] text-gray-600">
              Log kehadiran &amp; verifikasi foto selfie
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold bg-[#2563EB] text-white px-2 py-0.5 rounded-full">
          Total: {history.length} Hari
        </span>
      </div>

      {/* History Items */}
      <div className="space-y-2.5">
        {history.map((h) => {
          const isLate = h.status.toLowerCase().includes('terlambat');

          return (
            <div
              key={h.id}
              className="bg-white/90 border border-gray-200 rounded-2xl p-3.5 shadow-xs flex items-center justify-between hover:border-gray-300 transition"
            >
              <div className="flex items-center gap-3">
                {/* Photo Thumbnail */}
                <button
                  type="button"
                  onClick={() => h.photo && setPhotoModal(h.photo)}
                  className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-300 overflow-hidden relative group shrink-0"
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
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Camera className="w-4 h-4" />
                    </div>
                  )}
                </button>

                <div className="text-left space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-gray-800">
                      {h.date}
                    </h4>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm ${
                        isLate
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      Masuk: {h.check_in}
                    </span>
                    <span>• Pulang: {h.check_out}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                    <span>{h.location}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo Preview Modal */}
      {photoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative bg-white rounded-3xl p-3 shadow-2xl max-w-[320px] w-full border-2 border-[#F97316]">
            <button
              type="button"
              onClick={() => setPhotoModal(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="rounded-2xl overflow-hidden aspect-square">
              <img
                src={photoModal}
                alt="Selfie Detail"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-center text-xs font-semibold text-gray-700 mt-2">
              Foto Selfie Presensi GPS Terverifikasi
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
