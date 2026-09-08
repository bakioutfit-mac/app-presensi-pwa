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
  Database,
  Crown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import SupabaseTableEditor from './SupabaseTableEditor';

export default function AdminLeaderDashboard({ onBack }) {
  const { user } = useAuth();
  const [adminTab, setAdminTab] = useState('assignment'); // 'assignment', 'monitoring', 'addStaff', 'tableEditor'
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('all');

  // 1. PENUGASAN SHIFT
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignShift, setAssignShift] = useState('Shift Pagi (08:00 - 16:00)');
  const [staffList, setStaffList] = useState([
    { id: '1', name: 'Fikril Bay', role: 'Barista Senior', branch: 'LazyBloom', selected: true },
    { id: '2', name: 'Nadia Rahma', role: 'Kasir', branch: 'LazyBloom', selected: false },
    { id: '3', name: 'Bagas Pratama', role: 'Head Kitchen', branch: 'Deru Ombak', selected: false },
    { id: '4', name: 'Dimas Arya', role: 'Kitchen Crew', branch: 'Deru Ombak', selected: false },
    { id: '5', name: 'Rian Bahari', role: 'Barista & Gelato', branch: 'Sea Cafe', selected: false },
    { id: '6', name: 'Siti Aisyah', role: 'Floor Staff', branch: 'Sea Cafe', selected: false },
  ]);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // 2. MONITORING KEHADIRAN
  const [todayAttendanceList, setTodayAttendanceList] = useState([
    {
      id: '1',
      name: 'Fikril Bay',
      role: 'Barista Senior',
      branch: 'LazyBloom',
      shift: 'Shift Pagi',
      status: 'Hadir',
      check_in: '07:55 WIB',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
    },
    {
      id: '2',
      name: 'Bagas Pratama',
      role: 'Head Kitchen',
      branch: 'Deru Ombak',
      shift: 'Shift Pagi',
      status: 'Hadir',
      check_in: '07:45 WIB',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    },
    {
      id: '3',
      name: 'Rian Bahari',
      role: 'Barista & Gelato',
      branch: 'Sea Cafe',
      shift: 'Shift Pagi',
      status: 'Hadir',
      check_in: '07:58 WIB',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    },
    {
      id: '4',
      name: 'Nadia Rahma',
      role: 'Kasir',
      branch: 'LazyBloom',
      shift: 'Shift Pagi',
      status: 'Hadir',
      check_in: '08:02 WIB',
      photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    },
    {
      id: '5',
      name: 'Dimas Arya',
      role: 'Kitchen Crew',
      branch: 'Deru Ombak',
      shift: 'Shift Siang',
      status: 'Belum Masuk',
      check_in: '-',
      photo: null,
    },
    {
      id: '6',
      name: 'Siti Aisyah',
      role: 'Floor Staff',
      branch: 'Sea Cafe',
      shift: 'Shift Pagi',
      status: 'Izin Sakit',
      check_in: '-',
      photo: null,
    },
  ]);

  // 3. TAMBAH KARYAWAN BARU
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    phone: '',
    pin: '123456',
    position: 'Barista',
    branch: 'LazyBloom',
    birth_date: '',
    address: '',
    default_shift: 'Shift Pagi',
  });
  const [staffCreating, setStaffCreating] = useState(false);
  const [staffMsg, setStaffMsg] = useState({ type: '', text: '' });

  const toggleStaffSelect = (id) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleSaveShiftAssignment = async () => {
    const selectedCount = staffList.filter((s) => s.selected).length;
    if (selectedCount === 0) {
      alert('Pilih setidaknya satu staf untuk penugasan shift.');
      return;
    }

    try {
      for (const s of staffList.filter((item) => item.selected)) {
        await supabase.from('shifts').upsert(
          {
            shift_date: assignDate,
            shift_name: assignShift,
            notes: `Ditugaskan oleh Admin Leader (${user?.full_name || 'Leader'})`,
          },
          { onConflict: 'employee_id, shift_date' }
        );
      }
    } catch (err) {
      console.warn('Shift assignment sync:', err);
    }

    setAssignSuccess(true);
    setTimeout(() => setAssignSuccess(false), 2500);
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffMsg({ type: '', text: '' });

    if (!newStaff.full_name || !newStaff.phone || !newStaff.pin) {
      setStaffMsg({ type: 'error', text: 'Nama, No. HP, dan PIN wajib diisi!' });
      return;
    }

    setStaffCreating(true);
    try {
      const generatedId = `LZY_${Math.floor(1000 + Math.random() * 9000)}`;
      await supabase.from('employees').insert({
        employee_id: generatedId,
        full_name: newStaff.full_name,
        phone: newStaff.phone,
        pin: newStaff.pin,
        role: 'staff',
        position: newStaff.position,
        branch: newStaff.branch,
        birth_date: newStaff.birth_date || '2000-01-01',
        address: newStaff.address || '-',
      });

      setStaffList((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          name: newStaff.full_name,
          role: newStaff.position,
          branch: newStaff.branch,
          selected: false,
        },
      ]);

      setStaffMsg({
        type: 'success',
        text: `Karyawan ${newStaff.full_name} (${newStaff.branch}) berhasil didaftarkan!`,
      });

      setNewStaff({
        full_name: '',
        phone: '',
        pin: '123456',
        position: 'Barista',
        branch: 'LazyBloom',
        birth_date: '',
        address: '',
        default_shift: 'Shift Pagi',
      });
    } catch (err) {
      setStaffMsg({ type: 'error', text: 'Gagal menambahkan staf baru.' });
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
              Kelola shift kerja, monitoring absensi &amp; pendaftaran staf
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
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

        <button
          type="button"
          onClick={() => setAdminTab('tableEditor')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            adminTab === 'tableEditor'
              ? 'bg-white text-[#2563EB] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Tabel Editor</span>
        </button>
      </div>

      {/* Outlet Filter Bar */}
      {(adminTab === 'assignment' || adminTab === 'monitoring') && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold">
          <span className="text-gray-600 shrink-0">Filter Outlet:</span>
          <button
            type="button"
            onClick={() => setSelectedOutletFilter('all')}
            className={`px-2.5 py-1 rounded-full border transition shrink-0 ${
              selectedOutletFilter === 'all'
                ? 'bg-[#1E293B] text-white border-[#1E293B]'
                : 'bg-white/70 text-gray-700 border-gray-300'
            }`}
          >
            Semua (3 Outlet)
          </button>
          <button
            type="button"
            onClick={() => setSelectedOutletFilter('LazyBloom')}
            className={`px-2.5 py-1 rounded-full border transition shrink-0 ${
              selectedOutletFilter === 'LazyBloom'
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white/70 text-orange-700 border-orange-200'
            }`}
          >
            LazyBloom
          </button>
          <button
            type="button"
            onClick={() => setSelectedOutletFilter('Deru Ombak')}
            className={`px-2.5 py-1 rounded-full border transition shrink-0 ${
              selectedOutletFilter === 'Deru Ombak'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white/70 text-emerald-800 border-emerald-200'
            }`}
          >
            Deru Ombak
          </button>
          <button
            type="button"
            onClick={() => setSelectedOutletFilter('Sea Cafe')}
            className={`px-2.5 py-1 rounded-full border transition shrink-0 ${
              selectedOutletFilter === 'Sea Cafe'
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white/70 text-sky-800 border-sky-200'
            }`}
          >
            Sea Cafe
          </button>
        </div>
      )}

      {/* 1. PENUGASAN SHIFT */}
      {adminTab === 'assignment' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#EA580C]" />
            <span>Penugasan Jadwal Shift Staf (3 Outlet)</span>
          </h4>

          {assignSuccess && (
            <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Jadwal shift berhasil disimpan untuk staf terpilih!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Pilih Tanggal
              </label>
              <input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Pilih Shift Kerja
              </label>
              <select
                value={assignShift}
                onChange={(e) => setAssignShift(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
              >
                <option value="Shift Pagi (08:00 - 16:00)">Shift Pagi (08:00 - 16:00)</option>
                <option value="Shift Siang (14:00 - 22:00)">Shift Siang (14:00 - 22:00)</option>
                <option value="Shift Malam (22:00 - 06:00)">Shift Malam (22:00 - 06:00)</option>
                <option value="Libur / Off">Libur / Off</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-gray-600">
                Pilih Staf untuk Ditugaskan
              </label>
              <span className="text-[10px] text-gray-500">
                {staffList.filter((s) => s.selected).length} dipilih
              </span>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {staffList
                .filter(
                  (s) =>
                    selectedOutletFilter === 'all' ||
                    s.branch === selectedOutletFilter
                )
                .map((s) => (
                  <label
                    key={s.id}
                    onClick={() => toggleStaffSelect(s.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
                      s.selected
                        ? 'bg-orange-50 border-[#EA580C] text-[#EA580C]'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={() => {}}
                        className="w-4 h-4 text-[#EA580C] rounded-md border-gray-300 focus:ring-[#EA580C]"
                      />
                      <div>
                        <span className="text-xs font-semibold block">{s.name}</span>
                        <span className="text-[9px] text-gray-400">{s.role}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        s.branch === 'Deru Ombak'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.branch === 'Sea Cafe'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {s.branch}
                    </span>
                  </label>
                ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveShiftAssignment}
            className="w-full bg-[#EA580C] hover:bg-[#C2410C] active:scale-98 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Penugasan Shift</span>
          </button>
        </div>
      )}

      {/* 2. MONITORING KEHADIRAN */}
      {adminTab === 'monitoring' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-gray-100">
            <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#EA580C]" />
              <span>Status Kehadiran Hari Ini (Live GPS Verified)</span>
            </h4>
            <span className="text-[10px] text-gray-500">Live Status</span>
          </div>

          <div className="space-y-2">
            {todayAttendanceList
              .filter(
                (s) =>
                  selectedOutletFilter === 'all' ||
                  s.branch === selectedOutletFilter
              )
              .map((staff) => {
                const isPresent = staff.status === 'Hadir';
                const isLeave = staff.status.includes('Izin');

                return (
                  <div
                    key={staff.id}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-200 overflow-hidden border border-gray-300 relative shrink-0">
                        {staff.photo ? (
                          <img
                            src={staff.photo}
                            alt={staff.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Users className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      <div className="text-left space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-bold text-gray-800">
                            {staff.name}
                          </h5>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm ${
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
                        <p className="text-[10px] text-gray-500">
                          {staff.role} • {staff.shift}
                        </p>
                        {isPresent && (
                          <p className="text-[10px] text-emerald-700 font-medium">
                            Jam Masuk: {staff.check_in}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPresent
                            ? 'bg-emerald-100 text-emerald-800'
                            : isLeave
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {staff.status}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 3. TAMBAH KARYAWAN BARU */}
      {adminTab === 'addStaff' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#EA580C]" />
            <span>Pendaftaran Karyawan Baru</span>
          </h4>

          {staffMsg.text && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                staffMsg.type === 'success'
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                  : 'bg-red-100 border border-red-300 text-red-800'
              }`}
            >
              {staffMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{staffMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateStaff} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1 ml-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={newStaff.full_name}
                onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                placeholder="Contoh: Rian Pratama"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 ml-1">
                  Nomor HP (Login)
                </label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 ml-1">
                  PIN (6 Digit)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newStaff.pin}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, pin: e.target.value.replace(/\D/g, '') })
                  }
                  placeholder="123456"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 ml-1">
                  Penempatan Outlet
                </label>
                <select
                  value={newStaff.branch}
                  onChange={(e) => setNewStaff({ ...newStaff, branch: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
                >
                  <option value="LazyBloom">LazyBloom (Specialty Coffee)</option>
                  <option value="Deru Ombak">Deru Ombak (Seaside Eatery)</option>
                  <option value="Sea Cafe">Sea Cafe (Oceanfront Coffee)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 ml-1">
                  Posisi / Jabatan
                </label>
                <select
                  value={newStaff.position}
                  onChange={(e) => setNewStaff({ ...newStaff, position: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
                >
                  <option value="Barista">Barista</option>
                  <option value="Kasir">Kasir</option>
                  <option value="Kitchen Crew">Kitchen Crew</option>
                  <option value="Floor Staff">Floor Staff</option>
                  <option value="Supervisor">Supervisor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1 ml-1">
                Tanggal Lahir
              </label>
              <input
                type="date"
                value={newStaff.birth_date}
                onChange={(e) => setNewStaff({ ...newStaff, birth_date: e.target.value })}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1 ml-1">
                Alamat Tempat Tinggal
              </label>
              <textarea
                rows={2}
                value={newStaff.address}
                onChange={(e) => setNewStaff({ ...newStaff, address: e.target.value })}
                placeholder="Alamat domisili staf..."
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/60"
              />
            </div>

            <button
              type="submit"
              disabled={staffCreating}
              className="w-full bg-[#EA580C] hover:bg-[#C2410C] active:scale-98 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              {staffCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Karyawan...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Daftarkan Karyawan Baru</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 4. TABEL EDITOR */}
      {adminTab === 'tableEditor' && <SupabaseTableEditor />}
    </div>
  );
}
