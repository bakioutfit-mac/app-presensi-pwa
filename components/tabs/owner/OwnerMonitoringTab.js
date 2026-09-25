'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/date';
import { Search, Filter, RefreshCw, X, Camera, Eye, Activity } from 'lucide-react';

export default function OwnerMonitoringTab({ user, outlets, selectedOutlet, setSelectedOutlet, showToast }) {
  // ================= 1. MONITORING STATE =================
  const safeOutlets = outlets || [{ id: 1, name: 'LazyBloom' }, { id: 2, name: 'Deru Ombak' }, { id: 3, name: 'Sea Cafe' }];
  const [monitoringList, setMonitoringList] = useState([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const fetchMonitoringData = async () => {
    setLoadingMonitoring(true);
    const todayStr = getLocalDateString();

    try {
      // 1. Ambil semua karyawan staf aktif
      const { data: employeesData } = await supabase
        .from('employees')
        .select('*')
        .neq('role', 'admin_finance')
        .neq('role', 'owner')
        .order('full_name', { ascending: true });

      // 2. Ambil absensi hari ini
      const { data: attData } = await supabase
        .from('attendance')
        .select('*')
        .eq('attendance_date', todayStr);

      const attMap = new Map();
      (attData || []).forEach((att) => attMap.set(att.employee_id, att));

      // 3. Ambil izin aktif hari ini
      const { data: leavesData } = await supabase
        .from('leaves')
        .select('*')
        .lte('start_date', todayStr)
        .gte('end_date', todayStr)
        .eq('status', 'Disetujui');

      const leaveMap = new Map();
      (leavesData || []).forEach((l) => leaveMap.set(l.employee_id, l));

      // Gabungkan data
      const combined = (employeesData || []).map((emp) => {
        const att = attMap.get(emp.id);
        const leave = leaveMap.get(emp.id);

        let statusText = 'Belum Hadir';
        let statusBadge = 'bg-slate-100 text-slate-600 border-slate-200';

        if (leave) {
          statusText = `Izin: ${leave.leave_type}`;
          statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
        } else if (att) {
          if (att.check_out_time) {
            statusText = 'Selesai Bekerja';
            statusBadge = 'bg-slate-200 text-slate-700 border-slate-300';
          } else if (att.check_in_time) {
            const isLateAtt = !!att.is_late || (typeof att.status === 'string' && att.status.includes('Terlambat'));
            if (isLateAtt) {
              statusText = att.status?.includes('Terlambat') ? att.status : `Terlambat ${att.late_duration_minutes || 0}m`;
              statusBadge = 'bg-rose-100 text-rose-800 border-rose-300';
            } else {
              statusText = 'Hadir Tepat Waktu';
              statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
            }
          }
        }

        return {
          id: emp.id,
          name: emp.full_name,
          phone: emp.phone,
          position: emp.position || 'Staff',
          branch: att?.branch || emp.branch || 'LazyBloom',
          attendance: att || null,
          leave: leave || null,
          statusText,
          statusBadge,
        };
      });

      setMonitoringList(combined);
    } catch (err) {
      console.warn('Fetch monitoring error:', err);
    } finally {
      setLoadingMonitoring(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  // Filtered monitoring
  const filteredMonitoring = monitoringList.filter((item) => {
    if (selectedOutlet === 'all') return true;
    return (item.branch || '').toLowerCase().includes(selectedOutlet.toLowerCase());
  });

  // KPI calculations
  const totalStaffCount = filteredMonitoring.length;
  const presentCount = filteredMonitoring.filter((m) => m.attendance?.check_in_time).length;
  const lateCount = filteredMonitoring.filter((m) => m.attendance?.is_late).length;
  const onDutyCount = filteredMonitoring.filter(
    (m) => m.attendance?.check_in_time && !m.attendance?.check_out_time
  ).length;

  return (
    <>
      <div className="space-y-4 animate-in fade-in duration-200">
          {/* Outlet Filter Bar & Refresh */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedOutlet('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition text-xs shrink-0 cursor-pointer ${
                  selectedOutlet === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Outlet
              </button>
              {safeOutlets.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOutlet(o.name)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition text-xs shrink-0 cursor-pointer ${
                    selectedOutlet === o.name
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {o.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchMonitoringData}
              disabled={loadingMonitoring}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition cursor-pointer shrink-0"
              title="Segarkan Radar Presensi"
            >
              <RefreshCw className={`w-4 h-4 ${loadingMonitoring ? 'animate-spin text-[#F97316]' : ''}`} />
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Staf</span>
              <span className="text-lg font-black text-slate-900">{totalStaffCount}</span>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 block uppercase">Hadir</span>
              <span className="text-lg font-black text-emerald-700">{presentCount}</span>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-rose-600 block uppercase">Terlambat</span>
              <span className="text-lg font-black text-rose-700">{lateCount}</span>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-blue-600 block uppercase">Aktif Duty</span>
              <span className="text-lg font-black text-blue-700">{onDutyCount}</span>
            </div>
          </div>

          {/* List Staf Live Attendance */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#F97316]" />
                <span>Live Radar Kehadiran Hari Ini</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">{filteredMonitoring.length} Orang Terdaftar</span>
            </div>

            {loadingMonitoring ? (
              <div className="py-12 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#F97316]" />
                <span>Memuat data absensi...</span>
              </div>
            ) : filteredMonitoring.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Belum ada staf terdaftar pada outlet yang dipilih.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredMonitoring.map((item) => {
                  const att = item.attendance;
                  const photoUrl = att?.check_out_photo || att?.check_in_photo;

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/70 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar / Selfie Thumbnail */}
                        {photoUrl ? (
                          <button
                            type="button"
                            onClick={() => setPhotoPreview(photoUrl)}
                            className="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-xs shrink-0 cursor-pointer group"
                            title="Klik untuk melihat foto selfie"
                          >
                            <img src={photoUrl} alt={item.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 font-black text-xs flex items-center justify-center shrink-0">
                            {item.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        {/* Staf Info */}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">{item.branch}</span>
                            <span>&bull;</span>
                            <span className="truncate">{item.position}</span>
                          </div>

                          {/* Jam Masuk / Pulang */}
                          {att && att.check_in_time && (
                            <div className="text-[10px] font-mono text-slate-600 mt-1 flex items-center gap-2">
                              <span>
                                In:{' '}
                                {new Date(att.check_in_time).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {att.check_out_time && (
                                <span>
                                  Out:{' '}
                                  {new Date(att.check_out_time).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-extrabold border ${item.statusBadge}`}
                        >
                          {item.statusText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= MODAL PREVIEW FOTO SELFIE ================= */}
        {photoPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative max-w-sm w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-2">
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <img src={photoPreview} alt="Selfie Absensi" className="w-full h-auto rounded-2xl object-contain max-h-[80vh]" />
            </div>
          </div>
        )}
    </>
  );
}
