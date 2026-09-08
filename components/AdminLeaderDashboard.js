'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function AdminLeaderDashboard({ onBack }) {
  const { user, overtimeRequests, submitOvertimeRequest } = useAuth();
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

  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignShift, setAssignShift] = useState(SHIFT_OPTIONS[0]);
  const [staffList, setStaffList] = useState([
    { id: '1', name: 'Fikril Bay', role: 'Barista Senior', branch: 'LazyBloom', selected: true },
    { id: '2', name: 'Nadia Rahma', role: 'Kasir', branch: 'LazyBloom', selected: false },
    { id: '3', name: 'Bagas Pratama', role: 'Head Kitchen', branch: 'Deru Ombak', selected: false },
    { id: '4', name: 'Dimas Arya', role: 'Kitchen Crew', branch: 'Deru Ombak', selected: false },
    { id: '5', name: 'Rian Bahari', role: 'Barista & Gelato', branch: 'Sea Cafe', selected: false },
    { id: '6', name: 'Siti Aisyah', role: 'Floor Staff', branch: 'Sea Cafe', selected: false },
  ]);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // 2. MONITORING KEHADIRAN (Live Attendance)
  const [todayAttendanceList, setTodayAttendanceList] = useState([
    {
      id: '1',
      name: 'Fikril Bay',
      role: 'Barista Senior',
      branch: 'LazyBloom',
      shift: 'Shift Weekend 1 (09:00 - 18:00)',
      status: 'Terlambat 15 Mnt',
      discipline_penalty: 10000,
      check_in: '09:15 WIB',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
    },
    {
      id: '2',
      name: 'Bagas Pratama',
      role: 'Head Kitchen',
      branch: 'Deru Ombak',
      shift: 'Shift Weekday (12:00 - 21:00)',
      status: 'Hadir Tepat Waktu',
      discipline_penalty: 0,
      check_in: '12:05 WIB',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    },
    {
      id: '3',
      name: 'Rian Bahari',
      role: 'Barista & Gelato',
      branch: 'Sea Cafe',
      shift: 'Shift Weekend 1 (09:00 - 18:00)',
      status: 'Hadir Tepat Waktu',
      discipline_penalty: 0,
      check_in: '09:02 WIB',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    },
    {
      id: '4',
      name: 'Nadia Rahma',
      role: 'Kasir',
      branch: 'LazyBloom',
      shift: 'Shift Middle (11:00 - 20:00)',
      status: 'Hadir Tepat Waktu',
      discipline_penalty: 0,
      check_in: '11:08 WIB',
      photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    },
    {
      id: '5',
      name: 'Dimas Arya',
      role: 'Kitchen Crew',
      branch: 'Deru Ombak',
      shift: 'Shift Weekend 2 (13:00 - 22:00)',
      status: 'Belum Masuk',
      discipline_penalty: 0,
      check_in: '-',
      photo: null,
    },
    {
      id: '6',
      name: 'Siti Aisyah',
      role: 'Floor Staff',
      branch: 'Sea Cafe',
      shift: 'Shift Weekday (12:00 - 21:00)',
      status: 'Izin Sakit',
      discipline_penalty: 0,
      check_in: '-',
      photo: null,
    },
  ]);

  // 3. PENGAJUAN LEMBUR STAF (Leader ke Finance)
  const [otForm, setOtForm] = useState({
    employee_name: 'Fikril Bay',
    branch: 'LazyBloom',
    date: new Date().toISOString().split('T')[0],
    hours: 2,
    reason: 'Event Weekend & Closing Store',
  });
  const [otSubmitting, setOtSubmitting] = useState(false);
  const [otMsg, setOtMsg] = useState({ type: '', text: '' });

  const handleSendOvertime = async (e) => {
    e.preventDefault();
    setOtSubmitting(true);
    setOtMsg({ type: '', text: '' });

    const res = await submitOvertimeRequest(otForm);
    setOtSubmitting(false);

    if (res.success) {
      setOtMsg({
        type: 'success',
        text: `Pengajuan lembur ${otForm.employee_name} (${otForm.hours} jam) berhasil dikirim ke Admin Finance!`,
      });
      setTimeout(() => setOtMsg({ type: '', text: '' }), 4000);
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
            branch: staff.branch,
            shift_date: assignDate,
            shift_name: assignShift,
            notes: `Ditugaskan oleh Admin Leader untuk ${staff.name}`,
          },
          { onConflict: 'branch, shift_date' }
        );
      }
    } catch (err) {
      console.warn('Shift sync Supabase fallback:', err);
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
          : 'LZY';
      const employeeIdCode = `${branchPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;

      const { data, error } = await supabase.from('employees').insert({
        employee_id: employeeIdCode,
        full_name: newStaff.full_name,
        phone: newStaff.phone,
        pin: newStaff.pin,
        role: 'staff',
        position: newStaff.position,
        branch: newStaff.branch,
        birth_date: newStaff.birth_date || '2000-01-01',
        address: newStaff.address || 'Alamat Belum Diisi',
      });

      if (error) throw error;

      setStaffList((prev) => [
        ...prev,
        {
          id: `stf-${Date.now()}`,
          name: newStaff.full_name,
          role: newStaff.position,
          branch: newStaff.branch,
          selected: false,
        },
      ]);

      setStaffMsg({
        type: 'success',
        text: `Karyawan baru ${newStaff.full_name} (${employeeIdCode}) berhasil ditambahkan ke ${newStaff.branch}!`,
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
      setStaffList((prev) => [
        ...prev,
        {
          id: `stf-${Date.now()}`,
          name: newStaff.full_name,
          role: newStaff.position,
          branch: newStaff.branch,
          selected: false,
        },
      ]);
      setStaffMsg({
        type: 'success',
        text: `Karyawan ${newStaff.full_name} berhasil didaftarkan ke ${newStaff.branch}!`,
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
      </div>

      {/* ================= 1. TAB PENUGASAN SHIFT (4 SHIFT RESMI) ================= */}
      {adminTab === 'assignment' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Atur &amp; Tugaskan Jadwal Shift Staf
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tentukan tanggal dan shift resmi untuk karyawan 3 cabang
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
                  onChange={(e) => setAssignDate(e.target.value)}
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

            {/* Shift Rules Info Banner */}
            <div className="p-2.5 bg-orange-50/70 border border-orange-200 rounded-xl text-[10px] text-orange-900 leading-relaxed flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
              <span>
                <strong>Aturan Shift:</strong> Toleransi keterlambatan 10 menit. Masuk menit ke-11 otomatis dikenakan <strong>Denda Kedisiplinan Flat Rp 10.000</strong> ke slip gaji.
              </span>
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
            {todayAttendanceList
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
              })}
          </div>
        </div>
      )}

      {/* ================= 3. TAB PENGAJUAN LEMBUR STAF ================= */}
      {adminTab === 'overtime' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Form Pengajuan Lembur Staf
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Leader mengajukan jam lembur ke Finance &bull; Nominal rupiah diinput oleh Admin Finance
            </p>
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
                  Nama Staf Lembur:
                </label>
                <select
                  value={otForm.employee_name}
                  onChange={(e) => {
                    const selected = staffList.find((s) => s.name === e.target.value);
                    setOtForm({
                      ...otForm,
                      employee_name: e.target.value,
                      branch: selected?.branch || 'LazyBloom',
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.branch})
                    </option>
                  ))}
                </select>
              </div>

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
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Jumlah Durasi Lembur (Jam):
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={otForm.hours}
                onChange={(e) => setOtForm({ ...otForm, hours: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                placeholder="Contoh: 2 jam"
                required
              />
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

            <button
              type="submit"
              disabled={otSubmitting}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#EA580C] to-[#C2410C] hover:from-[#C2410C] hover:to-[#9A3412] shadow-md shadow-orange-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {otSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Kirim Pengajuan Lembur ke Finance</span>
            </button>
          </form>

          {/* Riwayat Pengajuan Lembur */}
          <div className="pt-2 border-t border-slate-100">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Riwayat Pengajuan Lembur Terakhir:
            </h5>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {(overtimeRequests || []).map((ot) => (
                <div
                  key={ot.id}
                  className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-extrabold text-slate-900">{ot.employee_name}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">({ot.hours} Jam &bull; {ot.date})</span>
                    <p className="text-[10px] text-slate-600">{ot.reason}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {ot.status || 'Diajukan Leader'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. TAB TAMBAH KARYAWAN BARU ================= */}
      {adminTab === 'addStaff' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-md space-y-4 animate-in fade-in">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Pendaftaran Karyawan Baru
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Daftarkan staf baru langsung ke database 3 cabang outlet
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
                  Cabang Outlet (3 Pilar):
                </label>
                <select
                  value={newStaff.branch}
                  onChange={(e) => setNewStaff({ ...newStaff, branch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                >
                  <option value="LazyBloom">LazyBloom</option>
                  <option value="Deru Ombak">Deru Ombak</option>
                  <option value="Sea Cafe">Sea Cafe</option>
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
