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
  UserX,
  Coffee,
  Shirt,
  AlertTriangle,
  Lock,
  ShieldCheck,
  KeyRound,
  MessageCircle,
  Search,
  Phone,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getLocalDateString } from '@/lib/date';
import { getOvertimeRateByPosition } from '@/lib/overtimeRates';
import { getOutletShifts } from '@/lib/shifts';

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
  const {
    user,
    todayAttendance,
    overtimeRequests,
    submitOvertimeRequest,
    lateCorrections,
    loadLateCorrections,
  } = useAuth();
  const [adminTab, setAdminTab] = useState('assignment'); // 'assignment', 'overtime', 'addStaff', 'corrections'
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('all');
  const [copiedCorrectionId, setCopiedCorrectionId] = useState(null);

  const handleCopyForwardText = (corr) => {
    const text = `Halo Bapak/Ibu Owner, staf ${corr.employee_name} (${corr.branch}) mengajukan koreksi keterlambatan tanggal ${corr.attendance_date} untuk shift ${corr.target_shift}.\nAlasan kendala: "${corr.reason}".\nMohon persetujuan/peninjauan di Dashboard Owner. Terima kasih.`;
    navigator.clipboard.writeText(text);
    setCopiedCorrectionId(corr.id);
    setTimeout(() => setCopiedCorrectionId(null), 3000);
  };

  // 1. PENUGASAN SHIFT (Scroll/Wheel [Jam:Menit] - [Jam:Menit])
  const [assignDate, setAssignDate] = useState(getLocalDateString());
  const [shiftStartTime, setShiftStartTime] = useState('13:00');
  const [shiftEndTime, setShiftEndTime] = useState('22:00');
  const [isAssignOff, setIsAssignOff] = useState(false);
  const [assignDresscode, setAssignDresscode] = useState('');
  const [shiftStaffSearch, setShiftStaffSearch] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [shiftSubTab, setShiftSubTab] = useState('form'); // 'form' | 'calendar'
  const [staffSubTab, setStaffSubTab] = useState('list'); // 'list' | 'add'
  const [staffListSearch, setStaffListSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [togglingStaffId, setTogglingStaffId] = useState(null);
  const [confirmModalStaff, setConfirmModalStaff] = useState(null); // { staff, action: 'deactivate' | 'activate' }

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
      (s) =>
        s.status !== 'inactive' &&
        s.status !== 'nonaktif' &&
        s.is_active !== false &&
        (selectedOutletFilter === 'all' || s.branch === selectedOutletFilter)
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

  // Fetch real staff and all shifts from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const { data: emps } = await supabase
          .from('employees')
          .select('*')
          .eq('role', 'staff')
          .order('full_name', { ascending: true });
        if (emps && emps.length > 0) {
          setStaffList(
            emps.map((e, idx) => ({
              id: e.id,
              employee_id: e.employee_id,
              name: e.full_name,
              full_name: e.full_name,
              role: e.position || 'Staff',
              position: e.position || 'Staff',
              branch: e.branch || 'LazyBloom',
              phone: e.phone,
              status: e.status || (e.is_active === false ? 'inactive' : 'active'),
              is_active: e.is_active !== false && e.status !== 'inactive' && e.status !== 'nonaktif',
              birth_date: e.birth_date,
              address: e.address,
              created_at: e.created_at,
              selected: idx === 0,
            }))
          );
        }

        await fetchAllShifts();
      } catch (err) {
        console.warn('Load staff/shift error:', err);
      }
    }
    loadData();
  }, []);

  const handleConfirmToggleStatus = async () => {
    if (!confirmModalStaff) return;
    const { staff, action } = confirmModalStaff;
    const isDeactivating = action === 'deactivate';
    const newStatus = isDeactivating ? 'inactive' : 'active';
    const newIsActive = !isDeactivating;

    setTogglingStaffId(staff.id);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          status: newStatus,
          is_active: newIsActive,
        })
        .eq('id', staff.id);

      if (error) {
        console.warn('Supabase status update warning:', error);
      }

      setStaffList((prev) =>
        prev.map((s) =>
          s.id === staff.id
            ? {
                ...s,
                status: newStatus,
                is_active: newIsActive,
              }
            : s
        )
      );

      setStaffMsg({
        type: 'success',
        text: isDeactivating
          ? `Karyawan ${staff.name} berhasil dinonaktifkan (status keluar/resign). Akun login telah diblokir.`
          : `Karyawan ${staff.name} berhasil diaktifkan kembali!`,
      });
      setTimeout(() => setStaffMsg({ type: '', text: '' }), 4500);
    } catch (err) {
      console.error('Toggle staff error:', err);
      setStaffMsg({ type: 'error', text: 'Gagal mengubah status karyawan.' });
    } finally {
      setTogglingStaffId(null);
      setConfirmModalStaff(null);
    }
  };

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
      position: s.role || s.position || 'Staff',
      branch: s.branch || 'LazyBloom',
      date: otForm.date,
      hours: Number(otForm.hours || 1),
      nominal: 0, // Nominal akan ditentukan langsung oleh Admin Finance
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
      const shiftName = isAssignOff
        ? 'Libur / Off'
        : `Shift ${shiftStartTime} - ${shiftEndTime}`;
      const startTime = isAssignOff
        ? null
        : `${shiftStartTime}:00`;
      const endTime = isAssignOff
        ? null
        : `${shiftEndTime}:00`;

      for (const staff of selectedStaff) {
        await supabase.from('shifts').upsert(
          {
            employee_id: staff.id,
            branch: staff.branch,
            shift_date: assignDate,
            shift_name: shiftName,
            start_time: startTime,
            end_time: endTime,
            notes: isAssignOff
              ? 'Libur'
              : (assignDresscode?.trim() || 'Seragam Bebas Rapi'),
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
          status: 'active',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setStaffList((prev) => [
        ...prev,
        {
          id: data?.id || `stf-${Date.now()}`,
          employee_id: employeeIdCode,
          name: newStaff.full_name,
          full_name: newStaff.full_name,
          role: newStaff.position,
          position: newStaff.position,
          branch: newStaff.branch,
          phone: newStaff.phone.trim(),
          status: 'active',
          is_active: true,
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

      // Pindahkan ke sub-tab daftar karyawan agar leader langsung melihat hasilnya
      setStaffSubTab('list');
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

      {/* Sub-Tabs (Shift, Lembur, Tambah Staf, Koreksi Staf) */}
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
          <span>Staf</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('corrections')}
          className={`relative py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            adminTab === 'corrections'
              ? 'bg-white text-[#EA580C] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Koreksi</span>
          {(lateCorrections || []).filter((c) => c.status === 'pending').length > 0 && (
            <span className="absolute top-1 right-1.5 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
              {(lateCorrections || []).filter((c) => c.status === 'pending').length}
            </span>
          )}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Pilihan Jam Shift:
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500 hover:text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={isAssignOff}
                        onChange={(e) => setIsAssignOff(e.target.checked)}
                        className="rounded text-[#EA580C] focus:ring-[#EA580C] w-3 h-3"
                      />
                      <span className={isAssignOff ? 'font-bold text-rose-600' : ''}>Libur / Off</span>
                    </label>
                  </div>

                  {isAssignOff ? (
                    <div className="w-full bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-2 text-xs font-bold text-rose-600 text-center animate-in fade-in">
                      Libur / Off (Staf Tidak Masuk)
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <input
                          type="time"
                          value={shiftStartTime}
                          onChange={(e) => setShiftStartTime(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40 text-center cursor-pointer shadow-xs"
                          required={!isAssignOff}
                        />
                      </div>
                      <span className="text-slate-400 font-bold text-xs">-</span>
                      <div className="flex-1">
                        <input
                          type="time"
                          value={shiftEndTime}
                          onChange={(e) => setShiftEndTime(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40 text-center cursor-pointer shadow-xs"
                          required={!isAssignOff}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Input Seragam Shift */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Seragam Shift:</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-normal">Opsional</span>
                </label>
                <input
                  type="text"
                  value={assignDresscode}
                  onChange={(e) => setAssignDresscode(e.target.value)}
                  placeholder="Contoh: Kaos Hitam & Celana Jeans (opsional)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                />
              </div>

              {/* Daftar Checklist Staf */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Pilih Staf yang Ditugaskan:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const filteredIds = staffList
                          .filter(
                            (s) =>
                              s.status !== 'inactive' &&
                              s.status !== 'nonaktif' &&
                              s.is_active !== false &&
                              (selectedOutletFilter === 'all' || s.branch === selectedOutletFilter) &&
                              (!shiftStaffSearch || s.name.toLowerCase().includes(shiftStaffSearch.toLowerCase()))
                          )
                          .map((s) => s.id);
                        setStaffList((prev) =>
                          prev.map((s) => (filteredIds.includes(s.id) ? { ...s, selected: true } : s))
                        );
                      }}
                      className="text-[10px] font-bold text-[#EA580C] hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffList((prev) => prev.map((s) => ({ ...s, selected: false })));
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Batal Semua
                    </button>
                  </div>
                </div>

                {/* Fitur Ketik Nama Staf */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={shiftStaffSearch}
                    onChange={(e) => setShiftStaffSearch(e.target.value)}
                    placeholder="Ketik nama staf untuk mencari..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40 transition"
                  />
                  {shiftStaffSearch && (
                    <button
                      type="button"
                      onClick={() => setShiftStaffSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* List Staf Panjang (max-h-[380px]) */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {staffList
                    .filter(
                      (s) =>
                        s.status !== 'inactive' &&
                        s.status !== 'nonaktif' &&
                        s.is_active !== false &&
                        (selectedOutletFilter === 'all' || s.branch === selectedOutletFilter) &&
                        (!shiftStaffSearch || s.name.toLowerCase().includes(shiftStaffSearch.toLowerCase()))
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

                  {staffList.filter(
                    (s) =>
                      (selectedOutletFilter === 'all' || s.branch === selectedOutletFilter) &&
                      (!shiftStaffSearch || s.name.toLowerCase().includes(shiftStaffSearch.toLowerCase()))
                  ).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
                      Tidak ditemukan staf dengan nama &ldquo;{shiftStaffSearch}&rdquo;
                    </div>
                  )}
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

      {/* ================= 4. TAB STATUS KOREKSI KETERLAMBATAN (TERUSKAN KE OWNER) ================= */}
      {adminTab === 'corrections' && (() => {
        const filteredCorrections = (lateCorrections || []).filter((corr) => {
          if (selectedOutletFilter === 'all') return true;
          return (corr.branch || '').toLowerCase() === selectedOutletFilter.toLowerCase();
        });
        const pendingCount = filteredCorrections.filter((c) => c.status === 'pending').length;

        return (
          <div className="space-y-3 animate-in fade-in">
            {/* Header Status Koreksi */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Pengajuan Koreksi Staf
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Kendala operasional & klaim jam shift
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  {pendingCount} Menunggu Owner
                </span>
              </div>

              {/* Box Info Wewenang Owner */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-950 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>SOP Wewenang Persetujuan</span>
                </div>
                <p className="text-[10px] text-amber-900/90 leading-relaxed">
                  Leader tidak berwenang menyetujui atau menolak permohonan staf yang terlambat karena kendala operasional. Permohonan langsung diteruskan ke <strong>Owner</strong> untuk disetujui dan dibebaskan dendanya (Rp 10.000).
                </p>
              </div>
            </div>

            {/* List Permohonan Koreksi */}
            {filteredCorrections.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <h5 className="text-xs font-bold text-slate-700">Tidak Ada Pengajuan Koreksi</h5>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Semua staf hadir sesuai jadwal atau belum ada permohonan kendala operasional yang diajukan.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCorrections.map((corr) => {
                  const isPending = corr.status === 'pending';
                  const isApproved = corr.status === 'approved';
                  const isRejected = corr.status === 'rejected';

                  return (
                    <div
                      key={corr.id}
                      className={`bg-white rounded-2xl p-3.5 border transition shadow-xs space-y-2.5 ${
                        isPending
                          ? 'border-amber-200 bg-amber-50/20'
                          : isApproved
                          ? 'border-emerald-200'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs text-slate-900">
                              {corr.employee_name}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {corr.branch}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400">
                              • {corr.attendance_date}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 mt-1">
                            Klaim Shift: <strong className="text-[#EA580C]">{corr.target_shift}</strong>
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Menunggu Owner</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Disetujui Owner (Denda Rp 0)</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>Ditolak Owner</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Alasan Kendala */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-700 italic">
                        "{corr.reason}"
                      </div>

                      {/* Review notes if rejected/approved */}
                      {corr.review_notes && (
                        <div className="text-[10px] font-medium text-slate-600 px-1">
                          Catatan Owner: <span className="font-bold text-slate-800">{corr.review_notes}</span>
                        </div>
                      )}

                      {/* Action: Salin / Teruskan ke Owner via WA jika pending */}
                      {isPending && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-500">
                            Teruskan laporan kendala ini ke Owner:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyForwardText(corr)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3 text-slate-500" />
                              <span>{copiedCorrectionId === corr.id ? 'Tersalin!' : 'Salin Info'}</span>
                            </button>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(
                                `Halo Bapak/Ibu Owner, staf ${corr.employee_name} (${corr.branch}) mengajukan koreksi keterlambatan tanggal ${corr.attendance_date} untuk shift ${corr.target_shift}.\nAlasan kendala: "${corr.reason}".\nMohon persetujuan/peninjauan di Dashboard Owner. Terima kasih.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Teruskan WA ke Owner</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ================= 3. TAB PENGAJUAN LEMBUR STAF ================= */}
      {adminTab === 'overtime' && (() => {
        // Filter staf lembur berdasarkan kategori/outlet yang aktif (LazyBloom, Deru Ombak, Sea Cafe, Mobile / Lapangan)
        const filteredOtStaff = staffList.filter((s) => {
          if (s.status === 'inactive' || s.status === 'nonaktif' || s.is_active === false) return false;
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
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                              <span className="font-semibold text-slate-700">{s.role}</span>
                              <span>&bull;</span>
                              <span>{s.branch}</span>
                            </div>
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

              {/* Ringkasan Pengajuan Lembur ke Finance */}
              <div className="p-3.5 bg-orange-50/90 border border-orange-200/90 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-2.5 text-slate-700">
                  <div className="w-8 h-8 rounded-xl bg-[#EA580C]/10 flex items-center justify-center text-[#EA580C] shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      Pengajuan: {selectedOtStaffIds.length} Staf Terpilih ({otForm.hours} Jam)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Nominal uang lembur akan diinput &amp; ditentukan langsung oleh Admin Finance
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 shrink-0">
                  Input Finance
                </span>
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
                              ? `Disetujui (Rp ${(Number(ot.nominal) || 0).toLocaleString('id-ID')})`
                              : isRejected
                              ? 'Ditolak Finance'
                              : 'Menunggu Nominal Finance'}
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

      {/* ================= 4. TAB MANAJEMEN STAF (DAFTAR KARYAWAN & TAMBAH BARU) ================= */}
      {adminTab === 'addStaff' && (() => {
        // Filter staf berdasarkan outlet terpilih
        const outletFilteredStaff = staffList.filter((s) => {
          if (selectedOutletFilter === 'all') return true;
          return s.branch && s.branch.toLowerCase() === selectedOutletFilter.toLowerCase();
        });

        // Filter pencarian dan status bekerja
        const finalFilteredStaff = outletFilteredStaff.filter((s) => {
          const isActive = s.status !== 'inactive' && s.status !== 'nonaktif' && s.is_active !== false;
          if (staffStatusFilter === 'active' && !isActive) return false;
          if (staffStatusFilter === 'inactive' && isActive) return false;

          if (staffListSearch.trim()) {
            const q = staffListSearch.toLowerCase();
            const matchName = (s.name || s.full_name || '').toLowerCase().includes(q);
            const matchPhone = (s.phone || '').includes(q);
            const matchRole = (s.role || s.position || '').toLowerCase().includes(q);
            const matchId = (s.employee_id || '').toLowerCase().includes(q);
            return matchName || matchPhone || matchRole || matchId;
          }
          return true;
        });

        const activeStaffCount = outletFilteredStaff.filter(
          (s) => s.status !== 'inactive' && s.status !== 'nonaktif' && s.is_active !== false
        ).length;
        const inactiveStaffCount = outletFilteredStaff.filter(
          (s) => s.status === 'inactive' || s.status === 'nonaktif' || s.is_active === false
        ).length;

        return (
          <div className="space-y-4 animate-in fade-in">
            {/* Sub-Tab Switcher: Daftar Karyawan vs Tambah Karyawan */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl">
              <button
                type="button"
                onClick={() => setStaffSubTab('list')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  staffSubTab === 'list'
                    ? 'bg-white text-[#EA580C] shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Daftar Karyawan</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    staffSubTab === 'list'
                      ? 'bg-orange-100 text-[#EA580C]'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {activeStaffCount} Aktif
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStaffSubTab('add')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  staffSubTab === 'add'
                    ? 'bg-white text-[#EA580C] shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Tambah Karyawan</span>
              </button>
            </div>

            {/* Feedback Message */}
            {staffMsg.text && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
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

            {/* SUB-TAB 1: DAFTAR KARYAWAN (Kelola & Nonaktifkan Staf Keluar) */}
            {staffSubTab === 'list' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Header & Filter Controls Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Daftar Staf &amp; Status Bekerja
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Nonaktifkan akun karyawan yang keluar/resign agar tidak bisa login dan tidak dijadwalkan shift.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStaffSubTab('add')}
                      className="px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Tambah Staf Baru</span>
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={staffListSearch}
                      onChange={(e) => setStaffListSearch(e.target.value)}
                      placeholder="Cari nama karyawan, ID staf, nomor HP, atau posisi..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                    />
                    {staffListSearch && (
                      <button
                        type="button"
                        onClick={() => setStaffListSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter Status Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto text-[11px] pt-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                      Status:
                    </span>
                    <button
                      type="button"
                      onClick={() => setStaffStatusFilter('all')}
                      className={`px-3 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
                        staffStatusFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({outletFilteredStaff.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffStatusFilter('active')}
                      className={`px-3 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
                        staffStatusFilter === 'active'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      Aktif Bekerja ({activeStaffCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffStatusFilter('inactive')}
                      className={`px-3 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
                        staffStatusFilter === 'inactive'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      Keluar / Resign ({inactiveStaffCount})
                    </button>
                  </div>
                </div>

                {/* Staff Cards List */}
                {finalFilteredStaff.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#EA580C] flex items-center justify-center mx-auto">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Tidak ada staf yang sesuai filter</p>
                    <p className="text-[11px] text-slate-400">
                      Silakan ganti kata kunci pencarian atau ubah filter status di atas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {finalFilteredStaff.map((staff) => {
                      const isActive =
                        staff.status !== 'inactive' &&
                        staff.status !== 'nonaktif' &&
                        staff.is_active !== false;

                      return (
                        <div
                          key={staff.id}
                          className={`w-full bg-white rounded-2xl p-3.5 border transition shadow-2xs space-y-3 ${
                            isActive
                              ? 'border-slate-200/90 hover:border-slate-300'
                              : 'border-rose-200 bg-rose-50/20'
                          }`}
                        >
                          {/* Top Row: Avatar, Name, ID, Role, Branch, Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                                  isActive
                                    ? 'bg-orange-50 text-[#EA580C] border-orange-200'
                                    : 'bg-rose-100 text-rose-700 border-rose-300'
                                }`}
                              >
                                {staff.name?.slice(0, 2).toUpperCase() || 'ST'}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5
                                    className={`font-black text-xs truncate ${
                                      isActive
                                        ? 'text-slate-900'
                                        : 'text-slate-600 line-through decoration-rose-500'
                                    }`}
                                  >
                                    {staff.name}
                                  </h5>
                                  {staff.employee_id && (
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                      {staff.employee_id}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    {staff.role}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      staff.branch === 'Deru Ombak'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : staff.branch === 'Sea Cafe'
                                        ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                        : staff.branch.includes('Mobile')
                                        ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                        : 'bg-orange-50 text-orange-800 border border-orange-200'
                                    }`}
                                  >
                                    {staff.branch}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                }`}
                              />
                              <span>{isActive ? 'Aktif Bekerja' : 'Keluar / Resign'}</span>
                            </span>
                          </div>

                          {/* Bottom Row: Contact Details & Action Button */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2 flex-wrap text-xs">
                            <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-mono">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{staff.phone || '-'}</span>
                            </div>

                            {/* Action Button: Nonaktifkan (Keluar) OR Aktifkan Kembali */}
                            {isActive ? (
                              <button
                                type="button"
                                disabled={togglingStaffId === staff.id}
                                onClick={() => setConfirmModalStaff({ staff, action: 'deactivate' })}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Nonaktifkan akun karyawan karena keluar / resign"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Nonaktifkan (Keluar)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={togglingStaffId === staff.id}
                                onClick={() => setConfirmModalStaff({ staff, action: 'activate' })}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Aktifkan kembali akun karyawan"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Aktifkan Kembali</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 2: PENDAFTARAN KARYAWAN BARU */}
            {staffSubTab === 'add' && (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Pendaftaran Karyawan Baru
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Daftarkan staf baru langsung ke database 3 Pillar
                  </p>
                </div>

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
                        <option value="Mobile / Lapangan">Mobile / Lapangan (Tim Belanja &amp; Marketing)</option>
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
      })()}

      {/* ================= MODAL KONFIRMASI NONAKTIFKAN / AKTIFKAN KARYAWAN ================= */}
      {confirmModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-sm w-full bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmModalStaff.action === 'deactivate'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {confirmModalStaff.action === 'deactivate' ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {confirmModalStaff.action === 'deactivate'
                    ? 'Nonaktifkan Karyawan?'
                    : 'Aktifkan Kembali Karyawan?'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {confirmModalStaff.staff.name} ({confirmModalStaff.staff.branch})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 text-xs text-slate-600 space-y-1.5 border border-slate-200/70">
              {confirmModalStaff.action === 'deactivate' ? (
                <>
                  <p className="font-bold text-rose-700">
                    ⚠️ Karyawan keluar / mengundurkan diri (resign):
                  </p>
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-slate-600">
                    <li>Akun login presensi akan diblokir seketika.</li>
                    <li>Disembunyikan dari daftar penugasan shift kerja harian.</li>
                    <li>Histori absensi dan slip gaji sebelumnya tetap aman.</li>
                  </ul>
                </>
              ) : (
                <p className="text-slate-700">
                  Karyawan akan kembali aktif, dapat login ke aplikasi presensi, dan dapat dijadwalkan shift kerja oleh Leader.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalStaff(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={togglingStaffId === confirmModalStaff.staff.id}
                onClick={handleConfirmToggleStatus}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 ${
                  confirmModalStaff.action === 'deactivate'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {togglingStaffId === confirmModalStaff.staff.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : confirmModalStaff.action === 'deactivate' ? (
                  <UserX className="w-3.5 h-3.5" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                <span>
                  {confirmModalStaff.action === 'deactivate'
                    ? 'Ya, Nonaktifkan Staf'
                    : 'Ya, Aktifkan Kembali'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
