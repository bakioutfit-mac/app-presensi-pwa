'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, UserCheck, Shirt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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
          const dateStr = dateObj.toISOString().split('T')[0];
          const dayOfWeek = dateObj.getDay(); // 0 = Min, 1 = Sen, ..., 4 = Kam, 5 = Jum, 6 = Sab
          const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
          const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 4; // Senin s/d Kamis

          const assigned = dbShifts.find((s) => s.shift_date === dateStr);

          if (isWeekday) {
            // Senin s/d Kamis: Otomatis Shift Weekday
            generated.push({
              id: assigned?.id || `shift-${dateStr}`,
              shift_date: dateStr,
              day_name: dayName,
              shift_name: 'Shift Weekday',
              time: '12:00 - 21:00 WIB',
              dresscode: assigned?.notes || 'Kaos Hitam Outlet',
              status: i === 0 ? 'Bertugas Hari Ini' : 'Shift Rutin',
              is_today: i === 0,
            });
          } else {
            // Jumat s/d Minggu: Berdasarkan penugasan Leader di Supabase
            if (assigned) {
              const isOff = (assigned.shift_name || '').includes('Off') || (assigned.shift_name || '').includes('Libur');
              generated.push({
                id: assigned.id,
                shift_date: dateStr,
                day_name: dayName,
                shift_name: assigned.shift_name,
                time: isOff ? 'Libur' : (assigned.start_time ? `${assigned.start_time.slice(0, 5)} - ${assigned.end_time?.slice(0, 5)} WIB` : '09:00 - 18:00 WIB'),
                dresscode: isOff ? null : (assigned.notes || 'Seragam Standar'),
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
          return (
            <div
              key={s.id || idx}
              className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                s.is_today
                  ? 'bg-blue-50/70 border-blue-300 shadow-sm'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black shrink-0 ${
                    s.is_today
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : isOff
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-slate-100 text-[#2563EB]'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-tighter">
                    {s.day_name?.slice(0, 3) || 'HRI'}
                  </span>
                  <span className="text-xs leading-none mt-0.5">
                    {s.shift_date ? s.shift_date.split('-')[2] : idx + 7}
                  </span>
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-slate-800">
                      {s.shift_name}
                    </h4>
                    {s.is_today && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded-sm">
                        Hari Ini
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-medium flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{s.time || `${s.start_time || '12:00'} - ${s.end_time || '21:00'}`}</span>
                    </span>
                    {s.dresscode && !isOff && (
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                        <Shirt className="w-3 h-3 text-blue-600" />
                        <span>Seragam: {s.dresscode.replace(/^Seragam:\s*/i, '')}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <span
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                    isOff
                      ? 'bg-slate-100 text-slate-500 border border-slate-200'
                      : s.is_today
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-blue-50 text-[#2563EB] border border-blue-200'
                  }`}
                >
                  {isOff ? 'Libur' : s.is_today ? 'Bertugas' : 'Terjadwal'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
