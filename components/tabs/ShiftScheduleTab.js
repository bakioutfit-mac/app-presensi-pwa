'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function ShiftScheduleTab() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generate 7 days schedule starting today
  const defaultShifts = [
    {
      id: '1',
      shift_date: '2026-09-07',
      day_name: 'Senin',
      shift_name: 'Shift Pagi',
      time: '08:00 - 16:00',
      status: 'Bertugas',
      is_today: true,
    },
    {
      id: '2',
      shift_date: '2026-09-08',
      day_name: 'Selasa',
      shift_name: 'Shift Pagi',
      time: '08:00 - 16:00',
      status: 'Mendatang',
      is_today: false,
    },
    {
      id: '3',
      shift_date: '2026-09-09',
      day_name: 'Rabu',
      shift_name: 'Shift Siang',
      time: '14:00 - 22:00',
      status: 'Mendatang',
      is_today: false,
    },
    {
      id: '4',
      shift_date: '2026-09-10',
      day_name: 'Kamis',
      shift_name: 'Shift Siang',
      time: '14:00 - 22:00',
      status: 'Mendatang',
      is_today: false,
    },
    {
      id: '5',
      shift_date: '2026-09-11',
      day_name: 'Jumat',
      shift_name: 'Shift Pagi',
      time: '08:00 - 16:00',
      status: 'Mendatang',
      is_today: false,
    },
    {
      id: '6',
      shift_date: '2026-09-12',
      day_name: 'Sabtu',
      shift_name: 'Shift Pagi',
      time: '08:00 - 16:00',
      status: 'Mendatang',
      is_today: false,
    },
    {
      id: '7',
      shift_date: '2026-09-13',
      day_name: 'Minggu',
      shift_name: 'Libur / Off',
      time: 'Libur',
      status: 'Libur',
      is_today: false,
    },
  ];

  useEffect(() => {
    async function fetchShifts() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('employee_id', user.id)
          .order('shift_date', { ascending: true });

        if (!error && data && data.length > 0) {
          setShifts(data);
        } else {
          setShifts(defaultShifts);
        }
      } catch (err) {
        setShifts(defaultShifts);
      } finally {
        setLoading(false);
      }
    }
    fetchShifts();
  }, [user]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Schedule Header Card */}
      <div className="bg-[#CACFD6] rounded-2xl p-4 border border-white/60 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#2563EB]" />
            <div>
              <h3 className="text-xs font-bold text-[#1E293B]">
                Jadwal Shift Minggu Ini
              </h3>
              <p className="text-[10px] text-gray-600">
                LazyBloom - September 2026
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-[#F97316] text-white px-2 py-0.5 rounded-full">
            {user?.position || 'Barista Senior'}
          </span>
        </div>
      </div>

      {/* Shifts List */}
      <div className="space-y-2.5">
        {shifts.map((s, idx) => {
          const isOff = s.shift_name.includes('Off') || s.shift_name.includes('Libur');
          return (
            <div
              key={s.id || idx}
              className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                s.is_today
                  ? 'bg-orange-50/90 border-[#F97316] shadow-sm'
                  : 'bg-white/80 border-gray-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 ${
                    s.is_today
                      ? 'bg-[#F97316] text-white'
                      : isOff
                      ? 'bg-gray-200 text-gray-500'
                      : 'bg-blue-100 text-[#2563EB]'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-tighter">
                    {s.day_name?.slice(0, 3) || 'HARI'}
                  </span>
                  <span className="text-xs leading-none">
                    {s.shift_date ? s.shift_date.split('-')[2] : idx + 7}
                  </span>
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-gray-800">
                      {s.shift_name}
                    </h4>
                    {s.is_today && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-sm">
                        Hari Ini
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>{s.time || `${s.start_time || '08:00'} - ${s.end_time || '16:00'}`}</span>
                  </div>
                </div>
              </div>

              <div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isOff
                      ? 'bg-gray-100 text-gray-500 border border-gray-300'
                      : s.is_today
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-blue-50 text-[#2563EB] border border-blue-200'
                  }`}
                >
                  {isOff ? 'Libur' : s.is_today ? 'Aktif' : 'Terjadwal'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
