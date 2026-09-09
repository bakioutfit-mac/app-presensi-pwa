'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Activity,
  UserPlus,
  ArrowLeft,
  Check,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Database,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import SupabaseTableEditor from './SupabaseTableEditor';

export default function AdminDashboard({ onBack }) {
  const { user } = useAuth();
  const [adminTab, setAdminTab] = useState('assignment'); // 'assignment', 'monitoring', 'addStaff'
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('all'); // 'all' | 'LazyBloom' | 'Deru Ombak' | 'Sea Cafe'

  // ================= 1. TAB PENUGASAN SHIFT =================
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignShift, setAssignShift] = useState('Shift Pagi (08:00 - 16:00)');
  const [staffList, setStaffList] = useState([]);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // ================= 2. TAB MONITORING SHIFT =================
  const [todayAttendanceList, setTodayAttendanceList] = useState([]);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data: emps } = await supabase.from('employees').select('*').eq('role', 'staff');
        if (emps) {
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

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: atts } = await supabase
          .from('attendance')
          .select('*, employees(full_name, position)')
          .eq('attendance_date', todayStr);

        if (atts && atts.length > 0) {
          setTodayAttendanceList(
            atts.map((a) => ({
              id: a.id,
              name: a.employees?.full_name || a.employee_id,
              role: a.employees?.position || 'Staff',
              branch: a.branch,
              shift: 'Shift Aktif',
              status: a.status || 'Hadir',
              check_in: a.check_in_time
                ? new Date(a.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                : '-',
              photo: a.check_out_photo || a.check_in_photo,
            }))
          );
        } else {
          setTodayAttendanceList([]);
        }
      } catch (err) {
        console.warn('AdminDashboard fetch error:', err);
      }
    }
    loadAdminData();
  }, []);

  // ================= 3. TAB TAMBAH STAF BARU =================
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

  // Toggle staff checkbox in shift assignment
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
      // Save shifts to Supabase if employees table exists
      for (const s of staffList.filter((item) => item.selected)) {
        await supabase.from('shifts').upsert(
          {
            shift_date: assignDate,
            shift_name: assignShift,
            notes: `Ditugaskan oleh ${user?.full_name || 'Admin'}`,
          },
          { onConflict: 'employee_id, shift_date' }
        );
      }
    } catch (err) {
      console.warn('Supabase shift assign sync:', err);
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

    if (newStaff.pin.length !== 6) {
      setStaffMsg({ type: 'error', text: 'PIN harus berupa 6 digit angka.' });
      return;
    }

    setStaffCreating(true);
    try {
      const generatedId = `LZY_${Math.floor(1000 + Math.random() * 9000)}`;
      const { data, error } = await supabase.from('employees').insert({
        employee_id: generatedId,
        full_name: newStaff.full_name,
        phone: newStaff.phone,
        pin: newStaff.pin,
        role: 'staff',
        position: newStaff.position,
        branch: 'LazyBloom',
        birth_date: newStaff.birth_date || '2000-01-01',
        address: newStaff.address || '-',
      });

      if (error) {
        console.warn('Supabase create employee error:', error);
      }

      // Add to local list
      setStaffList((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          name: newStaff.full_name,
          role: newStaff.position,
          selected: false,
        },
      ]);

      setStaffMsg({
        type: 'success',
        text: `Staf ${newStaff.full_name} (${generatedId}) berhasil ditambahkan!`,
      });

      setNewStaff({
        full_name: '',
        phone: '',
        pin: '123456',
        position: 'Barista',
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
      {/* Top Header Card */}
      <div className="bg-[#CACFD6] rounded-2xl p-4 border border-white/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
              <span>Dashboard Admin</span>
              <span className="text-[10px] bg-[#2563EB] text-white px-2 py-0.2 rounded-full font-bold">
                Manager
              </span>
            </h3>
            <p className="text-[10px] text-gray-600">
              Kelola shift, pantau absensi &amp; data staf
            </p>
          </div>
        </div>
      </div>

      {/* Admin Sub-Tabs (4 Sub-Tabs) */}
      <div className="grid grid-cols-4 gap-1 bg-[#B8BFC8] p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setAdminTab('assignment')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-0.5 ${
            adminTab === 'assignment'
              ? 'bg-white text-[#F97316] shadow-xs'
              : 'text-gray-700 hover:text-gray-950'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Penugasan</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('monitoring')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-0.5 ${
            adminTab === 'monitoring'
              ? 'bg-white text-[#F97316] shadow-xs'
              : 'text-gray-700 hover:text-gray-950'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Monitoring</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('addStaff')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-0.5 ${
            adminTab === 'addStaff'
              ? 'bg-white text-[#F97316] shadow-xs'
              : 'text-gray-700 hover:text-gray-950'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('tableEditor')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-0.5 ${
            adminTab === 'tableEditor'
              ? 'bg-white text-[#2563EB] shadow-xs'
              : 'text-gray-700 hover:text-gray-950'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Tabel Editor</span>
        </button>
      </div>

      {/* Outlet Filter Bar (for Assignment and Monitoring) */}
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

      {/* SUB-TAB 1: PENUGASAN SHIFT */}
      {adminTab === 'assignment' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#F97316]" />
            <span>Penugasan Jadwal Shift Staf</span>
          </h4>

          {assignSuccess && (
            <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Jadwal shift berhasil disimpan untuk staf terpilih!</span>
            </div>
          )}

          {/* Date Picker & Shift Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Pilih Tanggal
              </label>
              <input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Pilih Shift Kerja
              </label>
              <select
                value={assignShift}
                onChange={(e) => setAssignShift(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
              >
                <option value="Shift Pagi (08:00 - 16:00)">Shift Pagi (08:00 - 16:00)</option>
                <option value="Shift Siang (14:00 - 22:00)">Shift Siang (14:00 - 22:00)</option>
                <option value="Shift Malam (22:00 - 06:00)">Shift Malam (22:00 - 06:00)</option>
                <option value="Libur / Off">Libur / Off</option>
              </select>
            </div>
          </div>

          {/* Staff Multi-Select Checklist (Filtered by Outlet) */}
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
                        ? 'bg-orange-50 border-[#F97316] text-[#F97316]'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={() => {}}
                        className="w-4 h-4 text-[#F97316] rounded-md border-gray-300 focus:ring-[#F97316]"
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
            className="w-full bg-[#F97316] hover:bg-[#EA580C] active:scale-98 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Penugasan Shift</span>
          </button>
        </div>
      )}

      {/* SUB-TAB 2: MONITORING SHIFT */}
      {adminTab === 'monitoring' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-gray-100">
            <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <span>Status Kehadiran Hari Ini</span>
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

      {/* SUB-TAB 3: TAMBAH STAF BARU */}
      {adminTab === 'addStaff' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#F97316]" />
            <span>Pendaftaran Staf Baru</span>
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
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
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
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
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
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
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
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
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
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
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
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
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
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
              />
            </div>

            <button
              type="submit"
              disabled={staffCreating}
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              {staffCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Staf...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Daftarkan Staf Baru</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 4: TABEL EDITOR SUPABASE */}
      {adminTab === 'tableEditor' && <SupabaseTableEditor />}
    </div>
  );
}
