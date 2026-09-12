'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, UserCheck, Shirt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getLocalDateString } from '@/lib/date';

export default function ShiftScheduleTab() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generate 7 hari jadwal dinamis (Senin-Kamis: Shift Weekday otomatis, Jumat-Minggu: Penugasan Leader)
  useEffect(() => {
    async function fetchShifts() {
      if (!user) return;
      try {
        let dbShifts = [];
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('employee_id', user.id);

        if (!error && data) {
          dbShifts = data;
        }

        const generated = [];
        for (let i = 0; i < 7; i++) {
          const dateObj = new Date();
          dateObj.setDate(dateObj.getDate() + i);
          const dateStr = getLocalDateString(dateObj);
          const dayOfWeek = dateObj.getDay(); // 0 = Min, 1 = Sen, ..., 4 = Kam, 5 = Jum, 6 = Sab
          const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
          const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 4; // Senin s/d Kamis

          const assigned = dbShifts.find((s) => s.shift_date === dateStr);

          if (isWeekday) {
            // Senin s/d Kamis: Shift Weekday (atau Shift Middle/Khusus jika ditugaskan Leader)
            if (assigned) {
              const isOff = (assigned.shift_name || '').includes('Off') || (assigned.shift_name || '').includes('Libur');
              generated.push({
                id: assigned.id,
                shift_date: dateStr,
                day_name: dayName,
                shift_name: assigned.shift_name || 'Shift Weekday',
                time: isOff ? 'Libur' : (assigned.start_time ? `${assigned.start_time.slice(0, 5).replace(':', '.')} - ${assigned.end_time?.slice(0, 5).replace(':', '.')} WIB` : '12.00 - 21.00 WIB'),
                dresscode: isOff ? null : (assigned.notes || null),
                status: isOff ? 'Libur' : i === 0 ? 'Bertugas Hari Ini' : 'Shift Khusus Leader',
                is_today: i === 0,
              });
            } else {
              generated.push({
                id: `shift-${dateStr}`,
                shift_date: dateStr,
                day_name: dayName,
                shift_name: 'Shift Weekday',
                time: '12.00 - 21.00 WIB',
                dresscode: null,
                status: i === 0 ? 'Bertugas Hari Ini' : 'Shift Rutin',
                is_today: i === 0,
              });
            }
          } else {
            // Jumat s/d Minggu: Berdasarkan penugasan Leader di Supabase
            if (assigned) {
              const isOff = (assigned.shift_name || '').includes('Off') || (assigned.shift_name || '').includes('Libur');
              generated.push({
                id: assigned.id,
                shift_date: dateStr,
                day_name: dayName,
                shift_name: assigned.shift_name,
                time: isOff ? 'Libur' : (assigned.start_time ? `${assigned.start_time.slice(0, 5).replace(':', '.')} - ${assigned.end_time?.slice(0, 5).replace(':', '.')} WIB` : '09.00 - 18.00 WIB'),
                dresscode: isOff ? null : (assigned.notes || null),
                status: isOff ? 'Libur' : i === 0 ? 'Bertugas Hari Ini' : 'Jadwal Leader',
                is_today: i === 0,
              });
            } else {
              generated.push({
                id: `pending-${dateStr}`,
                shift_date: dateStr,
                day_name: dayName,
                shift_name: 'Menunggu Jadwal Leader',
                time: 'Wajib Diset Leader (Jum-Min)',
                dresscode: null,
                status: 'Belum Diset',
                is_today: i === 0,
              });
            }
          }
        }

        setShifts(generated);
      } catch (err) {
        console.warn('Fetch shifts error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchShifts();
  }, [user]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Schedule Header Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900">
              Jadwal Shift Minggu Ini
            </h3>
            <p className="text-[10px] text-slate-500">
              {user?.branch || 'LazyBloom'} • September 2026
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black bg-[#2563EB] text-white px-2.5 py-1 rounded-full shadow-xs">
          {user?.position || 'Barista Senior'}
        </span>
      </div>

      {/* Shifts List */}
      <div className="space-y-2.5">
        {shifts.map((s, idx) => {
          const isOff = (s.shift_name || '').includes('Off') || (s.shift_name || '').includes('Libur');
          const isPending = s.status === 'Belum Diset';

          // Format jam Indonesia (memastikan pemisah titik)
          let displayTime = s.time || '';
          if (isOff) {
            displayTime = 'Libur';
          } else if (displayTime) {
            displayTime = displayTime.replace(/:/g, '.');
          }

          // Cek seragam
          const rawDresscode = (s.dresscode || '').replace(/^Seragam:\s*/i, '').trim();
          const isDresscodeSet =
            rawDresscode &&
            rawDresscode.toLowerCase() !== 'tentukan seragam atasan dan bawahan' &&
            rawDresscode.toLowerCase() !== 'seragam standar' &&
            rawDresscode.toLowerCase() !== 'belum di atur' &&
            rawDresscode !== '-';

          // Status Badge & Teks Seragam
          let badgeLabel = 'Bertugas';
          let badgeStyle = s.is_today
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-blue-50 text-[#2563EB] border border-blue-200';
          let seragamText = isDresscodeSet ? rawDresscode : 'belum di atur';

          if (isOff) {
            badgeLabel = 'Libur';
            badgeStyle = 'bg-slate-100 text-slate-500 border border-slate-200';
            seragamText = '-';
          } else if (isPending) {
            badgeLabel = 'Belum Diset';
            badgeStyle = 'bg-amber-50 text-amber-700 border border-amber-200';
            seragamText = 'belum di atur';
          }

          return (
            <div
              key={s.id || idx}
              className={`p-3.5 rounded-2xl border transition flex items-center gap-3.5 ${
                s.is_today
                  ? 'bg-blue-50/70 border-blue-300 shadow-sm'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Badge Tanggal (Kiri) */}
              <div
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shrink-0 ${
                  s.is_today
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : isOff
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-slate-100 text-[#2563EB]'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider font-extrabold">
                  {s.day_name?.slice(0, 3) || 'HRI'}
                </span>
                <span className="text-base font-black leading-none mt-0.5">
                  {s.shift_date ? s.shift_date.split('-')[2] : idx + 7}
                </span>
              </div>

              {/* Konten Shift (Kanan) */}
              <div className="flex-1 min-w-0">
                {/* Baris 1: Label Info */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">
                    {isOff ? 'Status hari ini :' : 'Kamu bertugas di :'}
                  </span>
                  {s.is_today && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Hari Ini
                    </span>
                  )}
                </div>

                {/* Baris 2: Jam Kerja (BOLD) & Badge Status Sejajar */}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {!isOff && <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span
                      className={`text-xs sm:text-sm tracking-tight truncate ${
                        isOff ? 'text-slate-500 font-bold' : 'text-slate-900 font-black'
                      }`}
                    >
                      {displayTime}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${badgeStyle}`}>
                    {badgeLabel}
                  </span>
                </div>

                {/* Baris 3: Seragam */}
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                  <Shirt className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">
                    seragam :{' '}
                    <span
                      className={
                        isDresscodeSet
                          ? 'font-semibold text-slate-700'
                          : isOff
                          ? 'text-slate-400 font-semibold'
                          : 'text-slate-400 italic'
                      }
                    >
                      {seragamText}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
