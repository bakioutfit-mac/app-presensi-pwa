'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Activity,
  UserPlus,
  ArrowLeft,
  Check,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crown,
  Clock,
  Send,
  Sparkles,
  CheckSquare,
  Square,
  CheckCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Coffee,
  Shirt,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getLocalDateString } from '@/lib/date';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export default function AdminLeaderDashboard({ onBack }) {
  const { user, todayAttendance, overtimeRequests, submitOvertimeRequest } = useAuth();
  const [adminTab, setAdminTab] = useState('assignment'); // 'assignment', 'monitoring', 'overtime', 'addStaff'
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('all');

  // 1. PENUGASAN SHIFT (4 Shift Resmi Outlet)
  const SHIFT_OPTIONS = [
    'Shift Weekday (12:00 - 21:00)',
    'Shift Weekend 1 (09:00 - 18:00)',
    'Shift Weekend 2 (13:00 - 22:00)',
    'Shift Middle (11:00 - 20:00)',
    'Libur / Off',
  ];

  const [assignDate, setAssignDate] = useState(getLocalDateString());
  const [assignShift, setAssignShift] = useState(SHIFT_OPTIONS[0]);
  const [assignDresscode, setAssignDresscode] = useState('Tentukan seragam atasan dan bawahan');
  const [staffList, setStaffList] = useState([]);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [shiftSubTab, setShiftSubTab] = useState('form'); // 'form' | 'calendar'

  // Data Semua Jadwal Shift dari Supabase & State Kalender Shift
  const [allShifts, setAllShifts] = useState([]);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedCalDate, setSelectedCalDate] = useState(getLocalDateString());

  const fetchAllShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, employees(full_name, branch, position)')
        .order('shift_date', { ascending: false });
      if (!error && data) {
        setAllShifts(data);
      }
    } catch (err) {
      console.warn('Load shifts error:', err);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    const todayStr = getLocalDateString(now);
    setSelectedCalDate(todayStr);
    setAssignDate(todayStr);
  };

  // Hitung staf bertugas & libur pada tanggal yang diklik di kalender
  const getShiftRecapForDate = (dateStr) => {
    const relevantStaff = staffList.filter(
      (s) => selectedOutletFilter === 'all' || s.branch === selectedOutletFilter
    );
    const shiftsOnDate = allShifts.filter((s) => s.shift_date === dateStr);

    const working = [];
    const off = [];

    // Hari dalam seminggu (0 = Minggu, 1 = Senin, ... 6 = Sabtu)
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 4; // Senin s/d Kamis

    relevantStaff.forEach((staff) => {
      const assigned = shiftsOnDate.find((s) => s.employee_id === staff.id);

      if (assigned) {
        const isLibur =
          assigned.shift_name?.toLowerCase().includes('libur') ||
          assigned.shift_name?.toLowerCase().includes('off');

        if (isLibur) {
          off.push({
            id: staff.id,
            name: staff.name,
            branch: staff.branch,
            shift_name: assigned.shift_name || 'Libur / Off',
          });
        } else {
          working.push({
            id: staff.id,
            name: staff.name,
            branch: staff.branch,
            shift_name: assigned.shift_name,
            dresscode: assigned.notes || 'Seragam Standar',
            time:
              assigned.start_time && assigned.end_time
                ? `${assigned.start_time.substring(0, 5)} - ${assigned.end_time.substring(0, 5)}`
                : null,
          });
        }
      } else {
        // Aturan standar:
        // Weekday (Senin-Kamis) otomatis bertugas Shift Weekday jika belum diset libur
        // Weekend (Jumat-Minggu) jika tidak ditugaskan maka statusnya Libur (Belum Dijadwalkan)
        if (isWeekday) {
          working.push({
            id: staff.id,
            name: staff.name,
            branch: staff.branch,
            shift_name: 'Shift Weekday (12:00 - 21:00)',
            dresscode: 'Kaos Hitam Outlet',
            time: '12:00 - 21:00',
          });
        } else {
          off.push({
            id: staff.id,
            name: staff.name,
            branch: staff.branch,
            shift_name: 'Libur (Belum Ditugaskan)',
            time: null,
          });
        }
      }
    });

    return { working, off };
  };

  const currentRecap = getShiftRecapForDate(selectedCalDate);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;

  // 2. MONITORING KEHADIRAN (Live Attendance)
  const [todayAttendanceList, setTodayAttendanceList] = useState([]);

  // Fetch real staff and real today's attendance from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const { data: emps } = await supabase
          .from('employees')
          .select('*')
          .eq('role', 'staff');
        if (emps && emps.length > 0) {
          setStaffList(
            emps.map((e, idx) => ({
              id: e.id,
              name: e.full_name,
              role: e.position || 'Staff',
              branch: e.branch || 'LazyBloom',
              selected: idx === 0,
            }))
          );
        }

        const todayStr = getLocalDateString();
        const { data: atts } = await supabase
          .from('attendance')
          .select('*, employees(full_name, position)')
          .eq('attendance_date', todayStr);

        if (atts && atts.length > 0) {
          const mapped = atts.map((a) => ({
            id: a.id,
            name: a.employees?.full_name || a.employee_id,
            role: a.employees?.position || 'Staff',
            branch: a.branch,
            shift: 'Shift Aktif',
            status: a.status || 'Hadir',
            discipline_penalty: a.discipline_penalty || 0,
            check_in: a.check_in_time
              ? new Date(a.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
              : '-',
            photo: a.check_out_photo || a.check_in_photo,
            check_in_lat: a.check_in_lat,
            check_in_lng: a.check_in_lng,
          }));
          setTodayAttendanceList(mapped);
        }

        await fetchAllShifts();
      } catch (err) {
        console.warn('Load staff/attendance error:', err);
      }
    }
    loadData();
  }, []);

  // Sinkronkan monitoring kehadiran dengan data check-in/out karyawan yang sedang aktif
  useEffect(() => {
    let activeToday = todayAttendance;
    if (!activeToday) {
      try {
        const stored = localStorage.getItem('pwa_today_attendance');
        if (stored) activeToday = JSON.parse(stored);
      } catch (e) {}
    }

    if (!activeToday || !activeToday.check_in_time) return;

    setTodayAttendanceList((prev) =>
      prev.map((item) => {
        const matchByName = user && item.name.toLowerCase() === user.full_name?.toLowerCase();
        const matchByBranch = user && item.branch.toLowerCase() === user.branch?.toLowerCase() && item.name === 'Fikril Bay';
        if (matchByName || matchByBranch) {
          const checkInTimeStr = new Date(activeToday.check_in_time).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB';
          return {
            ...item,
            status: activeToday.status || 'Hadir Tepat Waktu',
            discipline_penalty: activeToday.discipline_penalty || 0,
            check_in: checkInTimeStr,
            photo: activeToday.check_out_photo || activeToday.check_in_photo || item.photo,
          };
        }
        return item;
      })
    );
  }, [todayAttendance, user]);

  // 3. PENGAJUAN LEMBUR STAF (Leader ke Finance)
  const [otForm, setOtForm] = useState({
    date: getLocalDateString(),
    hours: 2,
    reason: 'Event Weekend & Closing Store',
  });
  const [selectedOtStaffIds, setSelectedOtStaffIds] = useState([]);
  const [otSubmitting, setOtSubmitting] = useState(false);
  const [otMsg, setOtMsg] = useState({ type: '', text: '' });

  // Toggle checklist satu staf
  const toggleOtStaff = (staffId) => {
    setSelectedOtStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  // Pilih semua atau batalkan semua staf pada filter yang sedang tampil
  const handleToggleSelectAllOt = (currentVisibleStaff) => {
    const visibleIds = currentVisibleStaff.map((s) => s.id);
    const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOtStaffIds.includes(id));
    if (isAllSelected) {
      setSelectedOtStaffIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedOtStaffIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSendOvertime = async (e) => {
    e.preventDefault();
    if (selectedOtStaffIds.length === 0) {
      setOtMsg({ type: 'error', text: 'Pilih minimal satu staf pada checklist untuk diajukan lembur.' });
      return;
    }
    setOtSubmitting(true);
    setOtMsg({ type: '', text: '' });

    const selectedStaffMembers = staffList.filter((s) => selectedOtStaffIds.includes(s.id));
    const payload = selectedStaffMembers.map((s) => ({
      employee_id: s.id,
      employee_name: s.name,
      branch: s.branch || 'LazyBloom',
      date: otForm.date,
      hours: Number(otForm.hours || 1),
      nominal: Number(otForm.hours || 1) * 20000,
      reason: otForm.reason,
    }));

    const res = await submitOvertimeRequest(payload);
    setOtSubmitting(false);

    if (res.success) {
      setOtMsg({
        type: 'success',
        text: `Berhasil mengajukan lembur untuk ${selectedStaffMembers.length} staf (${otForm.hours} jam) ke Admin Finance!`,
      });
      setSelectedOtStaffIds([]);
      setTimeout(() => setOtMsg({ type: '', text: '' }), 5000);
    } else {
      setOtMsg({ type: 'error', text: 'Gagal mengirim pengajuan lembur.' });
    }
  };

  // 4. TAMBAH KARYAWAN BARU
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    phone: '',
    pin: '123456',
    position: 'Barista',
    branch: 'LazyBloom',
    birth_date: '',
    address: '',
    default_shift: 'Shift Weekday (12:00 - 21:00)',
  });
  const [staffCreating, setStaffCreating] = useState(false);
  const [staffMsg, setStaffMsg] = useState({ type: '', text: '' });

  const toggleStaffSelect = (id) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleSaveShiftAssignment = async (e) => {
    e.preventDefault();
    const selectedStaff = staffList.filter((s) => s.selected);
    if (selectedStaff.length === 0) {
      alert('Pilih minimal 1 staf untuk ditugaskan shift!');
      return;
    }

    try {
      for (const staff of selectedStaff) {
        await supabase.from('shifts').upsert(
          {
            employee_id: staff.id,
            branch: staff.branch,
            shift_date: assignDate,
            shift_name: assignShift,
            start_time: assignShift.includes('09:00')
              ? '09:00:00'
              : assignShift.includes('13:00')
              ? '13:00:00'
              : assignShift.includes('11:00')
              ? '11:00:00'
              : assignShift.includes('12:00')
              ? '12:00:00'
              : null,
            end_time: assignShift.includes('18:00')
              ? '18:00:00'
              : assignShift.includes('22:00')
              ? '22:00:00'
              : assignShift.includes('20:00')
              ? '20:00:00'
              : assignShift.includes('21:00')
              ? '21:00:00'
              : null,
            notes: assignDresscode?.trim() || 'Tentukan seragam atasan dan bawahan',
          },
          { onConflict: 'employee_id, shift_date' }
        );
      }
      await fetchAllShifts();
    } catch (err) {
      console.warn('Shift sync Supabase error:', err);
    }

    setAssignSuccess(true);
    setTimeout(() => setAssignSuccess(false), 3500);
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.full_name || !newStaff.phone || !newStaff.pin) {
      setStaffMsg({ type: 'error', text: 'Nama, No HP, dan PIN wajib diisi!' });
      return;
    }

    setStaffCreating(true);
    setStaffMsg({ type: '', text: '' });

    try {
      const branchPrefix =
        newStaff.branch === 'Deru Ombak'
          ? 'DRU'
          : newStaff.branch === 'Sea Cafe'
          ? 'SEA'
          : newStaff.branch.includes('Mobile') || newStaff.branch.includes('Lapangan')
          ? 'MBL'
          : 'LZY';
      const employeeIdCode = `${branchPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;

      const { data, error } = await supabase
        .from('employees')
        .insert({
          employee_id: employeeIdCode,
          full_name: newStaff.full_name,
          phone: newStaff.phone.trim(),
          pin: newStaff.pin.trim(),
          role: 'staff',
          position: newStaff.position,
          branch: newStaff.branch,
          birth_date: newStaff.birth_date || '2000-01-01',
          address: newStaff.address || 'Alamat Belum Diisi',
        })
        .select()
        .single();

      if (error) throw error;

      setStaffList((prev) => [
        ...prev,
        {
          id: data?.id || `stf-${Date.now()}`,
          name: newStaff.full_name,
          role: newStaff.position,
          branch: newStaff.branch,
          selected: false,
        },
      ]);

      setStaffMsg({
        type: 'success',
        text: `Karyawan baru ${newStaff.full_name} (${employeeIdCode}) berhasil didaftarkan ke ${newStaff.branch}! Staf sekarang bisa login menggunakan No HP dan PIN tersebut.`,
      });

      setNewStaff({
        full_name: '',
        phone: '',
        pin: '123456',
        position: 'Barista',
        branch: 'LazyBloom',
        birth_date: '',
        address: '',
        default_shift: 'Shift Weekday (12:00 - 21:00)',
      });
    } catch (err) {
      console.error('Error creating staff:', err);
      const isDuplicate = err.message?.includes('duplicate key') || err.message?.includes('unique');
      setStaffMsg({
        type: 'error',
        text: isDuplicate
          ? 'Nomor Handphone sudah terdaftar di database! Harap gunakan nomor lain.'
          : `Gagal mendaftarkan karyawan: ${err.message || 'Terjadi kesalahan pada Supabase'}`,
      });
    } finally {
      setStaffCreating(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-xs transition"
            title="Kembali ke Beranda Staf"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-[#EA580C]" />
              <span>Dashboard Admin Leader</span>
              <span className="text-[9px] bg-[#EA580C] text-white px-2 py-0.5 rounded-full font-black">
                Operasional
              </span>
            </h3>
            <p className="text-[10px] text-slate-500">
              Kelola shift kerja, pantau keterlambatan &amp; ajukan lembur staf
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs (3 Tab Utama + Tab Lembur - Bersih Tanpa Tabel Editor) */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setAdminTab('assignment')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            adminTab === 'assignment'
              ? 'bg-white text-[#EA580C] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Shift</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('monitoring')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            adminTab === 'monitoring'
              ? 'bg-white text-[#EA580C] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Monitoring</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('overtime')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            adminTab === 'overtime'
              ? 'bg-white text-[#EA580C] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Lembur</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('addStaff')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            adminTab === 'addStaff'
              ? 'bg-white text-[#EA580C] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Staf</span>
        </button>
      </div>

      {/* Filter Outlet Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold">
        <span className="text-slate-500 shrink-0 ml-1">Filter Outlet:</span>
        <button
          type="button"
          onClick={() => setSelectedOutletFilter('all')}
          className={`px-3 py-1 rounded-full border transition shrink-0 ${
            selectedOutletFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Semua Outlet
        </button>
        <button
          type="button"
          onClick={() => setSelectedOutletFilter('LazyBloom')}
          className={`px-3 py-1 rounded-full border transition shrink-0 ${
            selectedOutletFilter === 'LazyBloom'
              ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
              : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
          }`}
        >
          LazyBloom
        </button>
        <button
          type="button"
          onClick={() => setSelectedOutletFilter('Deru Ombak')}
          className={`px-3 py-1 rounded-full border transition shrink-0 ${
            selectedOutletFilter === 'Deru Ombak'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          Deru Ombak
        </button>
        <button
          type="button"
          onClick={() => setSelectedOutletFilter('Sea Cafe')}
          className={`px-3 py-1 rounded-full border transition shrink-0 ${
            selectedOutletFilter === 'Sea Cafe'
              ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
              : 'bg-white text-sky-800 border-sky-200 hover:bg-sky-50'
          }`}
        >
          Sea Cafe
        </button>
        <button
          type="button"
          onClick={() => setSelectedOutletFilter('Mobile / Lapangan')}
          className={`px-3 py-1 rounded-full border transition shrink-0 ${
            selectedOutletFilter === 'Mobile / Lapangan'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          Mobile / Lapangan
        </button>
      </div>

      {/* ================= 1. TAB PENUGASAN SHIFT (4 SHIFT RESMI) & KALENDER REKAP ================= */}
      {adminTab === 'assignment' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Sub-Tab Tombol: Atur & Tugaskan Shift VS Kalender Shift */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setShiftSubTab('form')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                shiftSubTab === 'form'
                  ? 'bg-white text-[#EA580C] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Atur &amp; Tugaskan Shift</span>
            </button>

            <button
              type="button"
              onClick={() => setShiftSubTab('calendar')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                shiftSubTab === 'calendar'
                  ? 'bg-white text-[#EA580C] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Kalender Shift</span>
            </button>
          </div>

          {/* KONTEN 1: FORM ATUR & TUGASKAN SHIFT */}
          {shiftSubTab === 'form' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Atur &amp; Tugaskan Jadwal Shift Staf
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tentukan tanggal dan shift untuk jadwal shift staf
              </p>
            </div>

            {assignSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Jadwal shift berhasil ditugaskan &amp; disinkronkan ke staf!</span>
              </div>
            )}

            <form onSubmit={handleSaveShiftAssignment} className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Tanggal Shift:
                  </label>
                  <input
                    type="date"
                    value={assignDate}
                    onChange={(e) => {
                      setAssignDate(e.target.value);
                      setSelectedCalDate(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Pilihan Jam Shift:
                  </label>
                  <select
                    value={assignShift}
                    onChange={(e) => setAssignShift(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                  >
                    {SHIFT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Input Seragam Shift */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Seragam Shift:</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-normal">Wajib dipakai staf</span>
                </label>
                <input
                  type="text"
                  value={assignDresscode}
                  onChange={(e) => setAssignDresscode(e.target.value)}
                  placeholder="Tentukan seragam atasan dan bawahan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                />
              </div>

              {/* Shift Rules Info Banner */}
              <div className="p-3 bg-orange-50/80 border border-orange-200 rounded-xl text-[11px] text-orange-900 leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#EA580C]">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Aturan Operasional Shift Outlet:</span>
                </div>
                <p className="text-[10px] text-slate-600">
                  &bull; <strong>Senin s/d Kamis (Weekday)</strong>: Otomatis 1 shift tunggal yaitu <em>Shift Weekday (12:00 - 21:00)</em>. Leader tidak perlu input rutin.<br />
                  &bull; <strong>Jumat s/d Minggu (Weekend)</strong>: <strong>Wajib diatur oleh Leader</strong> (Pilih Weekend 1 [09:00], Weekend 2 [13:00], Middle [11:00], atau Libur).
                </p>
              </div>

              {/* Daftar Checklist Staf */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Pilih Staf yang Ditugaskan:
                </label>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {staffList
                    .filter(
                      (s) =>
                        selectedOutletFilter === 'all' || s.branch === selectedOutletFilter
                    )
                    .map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => toggleStaffSelect(staff.id)}
                        className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-center justify-between ${
                          staff.selected
                            ? 'border-[#EA580C] bg-orange-50/80 shadow-xs'
                            : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                              staff.selected
                                ? 'bg-[#EA580C] border-[#EA580C] text-white'
                                : 'bg-white border-slate-300'
                            }`}
                          >
                            {staff.selected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-slate-900">
                              {staff.name}
                            </div>
                            <div className="text-[10px] text-slate-500">{staff.role}</div>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            staff.branch === 'Deru Ombak'
                              ? 'bg-emerald-100 text-emerald-800'
                              : staff.branch === 'Sea Cafe'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {staff.branch}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#EA580C] hover:bg-[#C2410C] active:scale-98 text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Tugaskan Shift ke Staf Terpilih</span>
              </button>
            </form>
          </div>
        )}

        {/* KONTEN 2: KALENDER SHIFT & REKAPAN STAF */}
        {shiftSubTab === 'calendar' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
            {/* Header Kalender Shift */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C]">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Kalender Shift Outlet
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Klik tanggal untuk melihat daftar staf bertugas &amp; libur
                  </p>
                </div>
              </div>

              {/* Navigasi Bulan & Tahun */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-black text-slate-800 px-1 min-w-[110px] text-center">
                  {MONTH_NAMES[calMonth]} {calYear}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="text-[10px] font-bold px-2 py-1 bg-orange-50 text-[#EA580C] hover:bg-orange-100 rounded-lg transition ml-0.5 cursor-pointer"
                >
                  Hari Ini
                </button>
              </div>
            </div>

            {/* Grid Kalender */}
            <div>
              {/* Nama Hari (Sen s/d Min) */}
              <div className="grid grid-cols-7 text-center mb-1">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((dayName, idx) => (
                  <div
                    key={dayName}
                    className={`text-[10px] font-extrabold uppercase py-1 ${
                      idx >= 4 ? 'text-orange-600' : 'text-slate-400'
                    }`}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Sel Tanggal */}
              <div className="grid grid-cols-7 gap-1">
                {/* Kotak kosong offset awal bulan */}
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-9" />
                ))}

                {/* Tanggal-tanggal di bulan terpilih */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = dateStr === selectedCalDate;
                  const isToday = dateStr === getLocalDateString();

                  const shiftsOnDate = allShifts.filter((s) => s.shift_date === dateStr);
                  const hasWorking = shiftsOnDate.some(
                    (s) =>
                      !s.shift_name?.toLowerCase().includes('libur') &&
                      !s.shift_name?.toLowerCase().includes('off')
                  );
                  const hasOff = shiftsOnDate.some(
                    (s) =>
                      s.shift_name?.toLowerCase().includes('libur') ||
                      s.shift_name?.toLowerCase().includes('off')
                  );

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedCalDate(dateStr);
                        setAssignDate(dateStr);
                      }}
                      className={`h-9 rounded-xl flex flex-col items-center justify-center relative transition text-xs font-bold cursor-pointer ${
                        isSelected
                          ? 'bg-[#EA580C] text-white shadow-sm ring-2 ring-orange-400 ring-offset-1 font-black'
                          : isToday
                          ? 'border-2 border-[#EA580C] bg-orange-50/50 text-[#EA580C]'
                          : 'bg-slate-50 hover:bg-orange-50/40 text-slate-700'
                      }`}
                    >
                      <span>{dayNum}</span>
                      {/* Indikator titik jadwal */}
                      <div className="flex items-center gap-0.5 absolute bottom-1">
                        {hasWorking && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-emerald-500'
                            }`}
                          />
                        )}
                        {hasOff && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white/80' : 'bg-amber-500'
                            }`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* REKAP DETAIL TANGGAL TERPILIH (BERTUGAS & LIBUR) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              {/* Header Box Tanggal Terpilih */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#EA580C]" />
                  <div>
                    <span className="text-[11px] font-extrabold text-slate-900 block">
                      {new Date(selectedCalDate + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      Filter Outlet:{' '}
                      <strong className="text-slate-700">
                        {selectedOutletFilter === 'all' ? 'Semua Outlet' : selectedOutletFilter}
                      </strong>
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 bg-orange-100 text-[#EA580C] rounded-full">
                  Tanggal Terpilih
                </span>
              </div>

              {/* 1. BERTUGAS */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Bertugas ({currentRecap.working.length} Staf)</span>
                  </span>
                  <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                    Masuk Kerja
                  </span>
                </div>

                {currentRecap.working.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 italic">
                      Tidak ada staf yang bertugas pada tanggal ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {currentRecap.working.map((staf) => (
                      <div
                        key={staf.id}
                        className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                            {staf.name.charAt(0)}
                          </div>
                          <div>
                            <h6 className="text-xs font-bold text-slate-900">{staf.name}</h6>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[9px] text-emerald-700 font-semibold">
                                {staf.shift_name}
                              </span>
                              {staf.dresscode && (
                                <span className="text-[9px] text-slate-500 font-medium flex items-center gap-0.5">
                                  • 👔 {staf.dresscode.replace(/^Seragam:\s*/i, '')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-emerald-200 text-emerald-800 rounded-md shrink-0">
                          {staf.branch}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. LIBUR */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Coffee className="w-3.5 h-3.5 text-slate-500" />
                    <span>2. Libur ({currentRecap.off.length} Staf)</span>
                  </span>
                  <span className="text-[9px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                    Off / Libur
                  </span>
                </div>

                {currentRecap.off.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 italic">
                      Semua staf bertugas pada tanggal ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {currentRecap.off.map((staf) => (
                      <div
                        key={staf.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-600 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                            {staf.name.charAt(0)}
                          </div>
                          <div>
                            <h6 className="text-xs font-bold text-slate-800">{staf.name}</h6>
                            <div className="text-[9px] text-slate-500 font-medium">
                              {staf.shift_name}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded-md shrink-0">
                          {staf.branch}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {/* ================= 2. TAB MONITORING KEHADIRAN (LIVE PENALTY) ================= */}
      {adminTab === 'monitoring' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between px-1">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Monitoring Presensi Harian (Live)
              </h4>
              <p className="text-[10px] text-slate-500">
                Toleransi keterlambatan 10 menit &bull; Denda Flat Rp 10.000
              </p>
            </div>
            <span className="text-[10px] bg-slate-900 text-white px-2.5 py-1 rounded-full font-bold">
              {todayAttendanceList.filter((a) => a.status.includes('Hadir') || a.status.includes('Terlambat')).length} / {todayAttendanceList.length} Masuk
            </span>
          </div>

          <div className="space-y-2.5">
            {todayAttendanceList.filter(
              (a) => selectedOutletFilter === 'all' || a.branch === selectedOutletFilter
            ).length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <h5 className="text-xs font-bold text-slate-700">Belum Ada Presensi Masuk Hari Ini</h5>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Staf yang melakukan check-in akan otomatis tampil live di sini beserta foto selfie & status keterlambatan.
                </p>
              </div>
            ) : (
              todayAttendanceList
                .filter(
                  (a) =>
                    selectedOutletFilter === 'all' || a.branch === selectedOutletFilter
                )
                .map((att) => {
                const isLate = att.status.includes('Terlambat');
                return (
                  <div
                    key={att.id}
                    className={`bg-white rounded-2xl p-3.5 border transition shadow-xs flex items-center justify-between gap-3 ${
                      isLate ? 'border-rose-300 bg-rose-50/30' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar Selfie */}
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {att.photo ? (
                          <img
                            src={att.photo}
                            alt={att.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-extrabold text-xs text-slate-900">{att.name}</h5>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              att.branch === 'Deru Ombak'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.branch === 'Sea Cafe'
                                ? 'bg-sky-100 text-sky-800'
                                : att.branch === 'Mobile / Lapangan' || att.branch?.includes('Mobile')
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {att.branch}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{att.shift}</p>
                        <p className="text-[10px] font-medium text-slate-700">
                          Masuk: <span className="font-bold">{att.check_in}</span>
                        </p>
                        {att.check_in_lat && att.check_in_lng && (
                          <a
                            href={`https://www.google.com/maps?q=${att.check_in_lat},${att.check_in_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline mt-0.5 font-bold"
                          >
                            <span>📍 Buka Titik GPS</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Status & Denda Badge */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          isLate
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : att.status.includes('Hadir')
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {att.status}
                      </span>
                      {isLate && (
                        <p className="text-[10px] font-black text-rose-600 mt-1">
                          Denda: Rp 10.000
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================= 3. TAB PENGAJUAN LEMBUR STAF ================= */}
      {adminTab === 'overtime' && (() => {
        // Filter staf lembur berdasarkan kategori/outlet yang aktif (LazyBloom, Deru Ombak, Sea Cafe, Mobile / Lapangan)
        const filteredOtStaff = staffList.filter((s) => {
          if (selectedOutletFilter === 'all') return true;
          return s.branch && s.branch.toLowerCase() === selectedOutletFilter.toLowerCase();
        });

        // Hitung staf per kategori
        const countAll = staffList.length;
        const countLazy = staffList.filter((s) => s.branch && s.branch.toLowerCase() === 'lazybloom').length;
        const countDeru = staffList.filter((s) => s.branch && s.branch.toLowerCase() === 'deru ombak').length;
        const countSea = staffList.filter((s) => s.branch && s.branch.toLowerCase() === 'sea cafe').length;
        const countMobile = staffList.filter((s) => s.branch && s.branch.toLowerCase().includes('mobile')).length;

        const isAllVisibleSelected =
          filteredOtStaff.length > 0 &&
          filteredOtStaff.every((s) => selectedOtStaffIds.includes(s.id));

        return (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Form Pengajuan Lembur Staf
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  {selectedOtStaffIds.length} Staf Dipilih
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pilih kategori cabang, centang staf yang lembur &bull; Nominal rupiah diinput oleh Admin Finance
              </p>
            </div>

            {/* Kategori Cabang Lembur (Sinkron dengan data staf) */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Kategori Outlet / Lapangan:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedOutletFilter('all')}
                  className={`px-2.5 py-1 rounded-full border transition shrink-0 cursor-pointer ${
                    selectedOutletFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semua ({countAll})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOutletFilter('LazyBloom')}
                  className={`px-2.5 py-1 rounded-full border transition shrink-0 cursor-pointer ${
                    selectedOutletFilter === 'LazyBloom'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                      : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  LazyBloom ({countLazy})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOutletFilter('Deru Ombak')}
                  className={`px-2.5 py-1 rounded-full border transition shrink-0 cursor-pointer ${
                    selectedOutletFilter === 'Deru Ombak'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  Deru Ombak ({countDeru})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOutletFilter('Sea Cafe')}
                  className={`px-2.5 py-1 rounded-full border transition shrink-0 cursor-pointer ${
                    selectedOutletFilter === 'Sea Cafe'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white text-sky-800 border-sky-200 hover:bg-sky-50'
                  }`}
                >
                  Sea Cafe ({countSea})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOutletFilter('Mobile / Lapangan')}
                  className={`px-2.5 py-1 rounded-full border transition shrink-0 cursor-pointer ${
                    selectedOutletFilter === 'Mobile / Lapangan'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  Mobile / Lapangan ({countMobile})
                </button>
              </div>
            </div>

            {/* Checklist Staf Lembur */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  Pilih Nama Staf (Checklist):
                </label>
                {filteredOtStaff.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAllOt(filteredOtStaff)}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{isAllVisibleSelected ? 'Batalkan Semua' : 'Pilih Semua Staf Ini'}</span>
                  </button>
                )}
              </div>

              {filteredOtStaff.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50">
                  Tidak ada staf yang terdaftar di kategori{' '}
                  <span className="font-bold text-slate-700">{selectedOutletFilter}</span>.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 p-1.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  {filteredOtStaff.map((s) => {
                    const isChecked = selectedOtStaffIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleOtStaff(s.id)}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                          isChecked
                            ? 'bg-orange-50 border-orange-300 shadow-xs'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0 text-orange-600">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-[#EA580C]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block leading-tight">
                              {s.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {s.role} &bull; <span className="font-semibold text-slate-600">{s.branch}</span>
                            </span>
                          </div>
                        </div>

                        {isChecked && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-200/60 text-orange-900">
                            Lembur
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tag staf yang terpilih */}
              {selectedOtStaffIds.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[9px] text-slate-500 font-bold self-center">Terpilih:</span>
                  {selectedOtStaffIds.map((id) => {
                    const staff = staffList.find((s) => s.id === id);
                    if (!staff) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200"
                      >
                        <span>{staff.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOtStaff(id);
                          }}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {otMsg.text && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  otMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {otMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{otMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSendOvertime} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Tanggal Lembur:
                  </label>
                  <input
                    type="date"
                    value={otForm.date}
                    onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Durasi Lembur (Jam):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={otForm.hours}
                    onChange={(e) => setOtForm({ ...otForm, hours: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                    placeholder="Contoh: 2 jam"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Alasan / Penugasan Lembur:
                </label>
                <textarea
                  rows={2}
                  value={otForm.reason}
                  onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                  placeholder="Contoh: Event weekend ramai, closing store & inventory bahan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none"
                  required
                />
              </div>

              {/* Banner Estimasi Tarif Lembur Flat Rp 20.000 / Jam */}
              <div className="p-2.5 bg-orange-50 border border-orange-200/90 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Sparkles className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span className="text-[11px]">
                    Tarif Flat: <strong className="text-slate-900">Rp 20.000 / Jam</strong> ({otForm.hours} Jam = <strong className="text-slate-900">Rp {(Number(otForm.hours || 1) * 20000).toLocaleString('id-ID')}</strong> / staf)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Total Pengajuan:</span>
                  <span className="text-xs font-black text-[#EA580C]">
                    Rp {(selectedOtStaffIds.length * Number(otForm.hours || 1) * 20000).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={otSubmitting || selectedOtStaffIds.length === 0}
                className={`w-full py-3 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center justify-center gap-2 ${
                  selectedOtStaffIds.length === 0 || otSubmitting
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-[#EA580C] to-[#C2410C] hover:from-[#C2410C] hover:to-[#9A3412] shadow-orange-500/20 active:scale-98 cursor-pointer'
                }`}
              >
                {otSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {selectedOtStaffIds.length > 0
                    ? `Kirim Pengajuan Lembur (${selectedOtStaffIds.length} Staf) ke Finance`
                    : 'Pilih Staf Lembur Terlebih Dahulu'}
                </span>
              </button>
            </form>

            {/* Riwayat Pengajuan Lembur */}
            <div className="pt-2 border-t border-slate-100">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Riwayat Pengajuan Lembur Terakhir:
              </h5>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {(overtimeRequests || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-2 text-center">
                    Belum ada pengajuan lembur yang dikirim.
                  </p>
                ) : (
                  (overtimeRequests || []).map((ot) => {
                    const isApproved = ot.status === 'Disetujui Finance';
                    const isRejected = ot.status === 'Ditolak Finance';
                    return (
                      <div
                        key={ot.id}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-extrabold text-slate-900">{ot.employee_name}</span>
                            <span className="text-[10px] text-slate-500 ml-1.5">
                              ({ot.branch} &bull; {ot.hours} Jam &bull; {ot.date})
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isRejected
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isApproved
                              ? `Disetujui (Rp ${(Number(ot.nominal) || ot.hours * 20000).toLocaleString('id-ID')})`
                              : isRejected
                              ? 'Ditolak Finance'
                              : 'Menunggu Finance'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 italic">Tugas: {ot.reason}</p>
                        {isRejected && ot.rejection_reason && (
                          <p className="text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-100 font-medium">
                            ❌ <strong>Alasan Penolakan:</strong> {ot.rejection_reason}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= 4. TAB TAMBAH KARYAWAN BARU ================= */}
      {adminTab === 'addStaff' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Pendaftaran Karyawan Baru
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Daftarkan staf baru langsung ke database
            </p>
          </div>

          {staffMsg.text && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                staffMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {staffMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{staffMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateStaff} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Nama Lengkap Karyawan:
              </label>
              <input
                type="text"
                value={newStaff.full_name}
                onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                placeholder="Contoh: Muhammad Ilham"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Nomor Handphone:
                </label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  PIN Akses (6 Digit):
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newStaff.pin}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, pin: e.target.value.replace(/\D/g, '') })
                  }
                  placeholder="123456"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Cabang Outlet / Penugasan:
                </label>
                <select
                  value={newStaff.branch}
                  onChange={(e) => setNewStaff({ ...newStaff, branch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                >
                  <option value="LazyBloom">LazyBloom</option>
                  <option value="Deru Ombak">Deru Ombak</option>
                  <option value="Sea Cafe">Sea Cafe</option>
                  <option value="Mobile / Lapangan">Mobile / Lapangan (Tim Belanja & Marketing)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Posisi / Jabatan:
                </label>
                <input
                  type="text"
                  value={newStaff.position}
                  onChange={(e) => setNewStaff({ ...newStaff, position: e.target.value })}
                  placeholder="Barista / Kasir / Kitchen"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={staffCreating}
              className="w-full bg-[#EA580C] hover:bg-[#C2410C] active:scale-98 text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {staffCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span>Daftarkan Karyawan Baru</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
