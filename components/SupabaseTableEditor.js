'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Table as TableIcon,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Check,
  X,
  AlertCircle,
  Copy,
  ExternalLink,
  Filter,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  Lock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OUTLETS } from '@/lib/outlets';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah, CurrencyInput, fetchEmployeeSalaries, saveEmployeeSalaries } from '@/lib/currency';

export default function SupabaseTableEditor() {
  const { adminPins, updateAdminPin, outlets, updateOutletCoords, resetTodayAttendance } = useAuth();

  const [activeTable, setActiveTable] = useState('admin_settings');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newRowData, setNewRowData] = useState({});
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // State untuk Perubahan PIN Admin
  const [leaderPinInput, setLeaderPinInput] = useState('');
  const [financePinInput, setFinancePinInput] = useState('');
  const [showLeaderPin, setShowLeaderPin] = useState(false);
  const [showFinancePin, setShowFinancePin] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Map nama karyawan untuk tampilan attendance yang akurat (tidak '-')
  const [employeeMap, setEmployeeMap] = useState({});
  // Paket Gaji Karyawan (Pokok + 4 Tunjangan)
  const [employeeSalaries, setEmployeeSalaries] = useState({});
  const [editingSalaryEmp, setEditingSalaryEmp] = useState(null);
  const [salaryPkgInput, setSalaryPkgInput] = useState({
    basic_salary: 0,
    child_allowance: 0,
    spouse_allowance: 0,
    position_allowance: 0,
    meal_allowance: 0,
  });
  const [isSavingSalaryPkg, setIsSavingSalaryPkg] = useState(false);

  // Load employee map dan salary packages
  const refreshEmployeeSalaries = async () => {
    try {
      const { data: emps } = await supabase.from('employees').select('id, full_name, branch, position');
      if (emps) {
        const map = {};
        emps.forEach((e) => {
          map[e.id] = e;
        });
        setEmployeeMap(map);
      }
      const pkgs = await fetchEmployeeSalaries();
      setEmployeeSalaries(pkgs || {});
    } catch (e) {
      console.warn('Load employee map error:', e);
    }
  };

  useEffect(() => {
    refreshEmployeeSalaries();
    const handleUpdate = () => refreshEmployeeSalaries();
    window.addEventListener('pwa_salary_package_updated', handleUpdate);
    return () => window.removeEventListener('pwa_salary_package_updated', handleUpdate);
  }, []);

  const handleOpenSalaryModal = (emp) => {
    const pkg = employeeSalaries[emp.id] || employeeSalaries[emp.full_name] || {};
    setSalaryPkgInput({
      basic_salary: pkg.basic_salary ?? 0,
      child_allowance: pkg.child_allowance ?? 0,
      spouse_allowance: pkg.spouse_allowance ?? 0,
      position_allowance: pkg.position_allowance ?? 0,
      meal_allowance: pkg.meal_allowance ?? 0,
    });
    setEditingSalaryEmp(emp);
  };

  const handleSaveEmployeeSalaryPkg = async (e) => {
    e.preventDefault();
    if (!editingSalaryEmp) return;
    setIsSavingSalaryPkg(true);

    const updatedMap = {
      ...employeeSalaries,
      [editingSalaryEmp.id]: { ...salaryPkgInput },
      [editingSalaryEmp.full_name]: { ...salaryPkgInput },
    };

    const res = await saveEmployeeSalaries(updatedMap);
    setIsSavingSalaryPkg(false);

    if (res.success) {
      setEmployeeSalaries(updatedMap);
      setEditingSalaryEmp(null);
      setMsg({
        type: 'success',
        text: `Paket gaji untuk ${editingSalaryEmp.full_name} berhasil disimpan dan otomatis sinkron ke Tab Gaji 3 Outlet!`,
      });
      setTimeout(() => setMsg({ type: '', text: '' }), 5000);
    } else {
      setMsg({ type: 'error', text: 'Gagal menyimpan paket gaji ke database.' });
    }
  };

  const tables = [
    { id: 'admin_settings', label: 'Admin PIN Settings (Kunci Akses)', icon: '🔐' },
    { id: 'outlets_config', label: 'Outlets GPS Config (Titik Lokasi)', icon: '📍' },
    { id: 'employees', label: 'Employees (Karyawan)', icon: '👥' },
    { id: 'attendance', label: 'Attendance (Presensi)', icon: '📸' },
    { id: 'leaves', label: 'Leaves (Izin & Sakit)', icon: '📄' },
    { id: 'shifts', label: 'Shifts (Jadwal Kerja)', icon: '📅' },
    { id: 'payslips', label: 'Payslips (Slip Gaji)', icon: '💰' },
  ];

  // Default fallback data (kosong tanpa data dummy)
  const fallbackData = {
    admin_settings: [],
    outlets_config: [],
    employees: [],
    attendance: [],
    leaves: [],
    shifts: [],
    payslips: [],
  };

  // Fetch data dari Supabase
  const fetchData = async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      if (activeTable === 'admin_settings') {
        const { data: result, error } = await supabase.from('admin_settings').select('*');
        if (!error && result && result.length > 0) {
          setData(result);
        } else {
          setData([
            {
              id: 'adm-pin-1',
              role: 'leader',
              pin: adminPins?.leader || '987321',
              description: 'PIN Verifikasi Admin Leader (Shift, Monitoring, Staf)',
              updated_at: new Date().toISOString(),
            },
            {
              id: 'adm-pin-2',
              role: 'finance',
              pin: adminPins?.finance || '020103',
              description: 'PIN Verifikasi Admin Finance (Gaji 3 Outlet & Lokasi GPS)',
              updated_at: new Date().toISOString(),
            },
          ]);
        }
        return;
      }

      if (activeTable === 'outlets_config') {
        const { data: result, error } = await supabase.from('outlets_config').select('*');
        if (!error && result && result.length > 0) {
          setData(result);
        } else {
          setData(
            (outlets && outlets.length > 0 ? outlets : OUTLETS).map((o) => ({
              id: o.id,
              name: o.name,
              address: o.address,
              latitude: o.coords?.lat,
              longitude: o.coords?.lng,
              radius_meters: o.coords?.radiusMeters || 50,
              branch: o.name,
            }))
          );
        }
        return;
      }

      if (activeTable === 'attendance') {
        const { data: result, error } = await supabase
          .from('attendance')
          .select('*, employees(full_name, position, branch)')
          .order('created_at', { ascending: false });

        if (!error && result) {
          setData(result);
        } else {
          const { data: rawRes } = await supabase
            .from('attendance')
            .select('*')
            .order('created_at', { ascending: false });
          setData(rawRes || []);
        }
        return;
      }

      const { data: result, error } = await supabase
        .from(activeTable)
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && result) {
        setData(result);
      } else {
        console.warn('Fetch table error:', error);
        setData([]);
      }
    } catch (err) {
      console.warn('Fetch table catch:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setIsAdding(false);
  }, [activeTable, adminPins]);

  // Handle Update PIN Admin Leader
  const handleSaveLeaderPin = async (e) => {
    e.preventDefault();
    if (!leaderPinInput || leaderPinInput.trim().length !== 6 || !/^\d{6}$/.test(leaderPinInput.trim())) {
      setMsg({ type: 'error', text: 'PIN Admin Leader harus tepat 6 digit angka (misal: 987321).' });
      return;
    }

    setIsSavingPin(true);
    setMsg({ type: '', text: '' });

    const res = await updateAdminPin('leader', leaderPinInput.trim());
    setIsSavingPin(false);

    if (res.success) {
      setLeaderPinInput('');
      setMsg({
        type: 'success',
        text: `PIN Admin Leader berhasil diubah menjadi "${leaderPinInput.trim()}" dan tersimpan di database Supabase!`,
      });
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Gagal mengubah PIN Admin Leader.' });
    }
  };

  // Handle Update PIN Admin Finance
  const handleSaveFinancePin = async (e) => {
    e.preventDefault();
    if (!financePinInput || financePinInput.trim().length !== 6 || !/^\d{6}$/.test(financePinInput.trim())) {
      setMsg({ type: 'error', text: 'PIN Admin Finance harus tepat 6 digit angka (misal: 020103).' });
      return;
    }

    setIsSavingPin(true);
    setMsg({ type: '', text: '' });

    const res = await updateAdminPin('finance', financePinInput.trim());
    setIsSavingPin(false);

    if (res.success) {
      setFinancePinInput('');
      setMsg({
        type: 'success',
        text: `PIN Admin Finance berhasil diubah menjadi "${financePinInput.trim()}" dan tersimpan di database Supabase!`,
      });
      fetchData();
    } else {
      setMsg({ type: 'error', text: res.error || 'Gagal mengubah PIN Admin Finance.' });
    }
  };

  // Handle Hapus Baris
  const handleDeleteRow = async (id) => {
    if (!confirm('Yakin ingin menghapus baris data ini?')) return;
    try {
      const { error } = await supabase.from(activeTable).delete().eq('id', id);
      if (error) {
        setMsg({ type: 'error', text: `Gagal menghapus baris dari Supabase: ${error.message}` });
        return;
      }
    } catch (e) {
      console.warn('Delete exception:', e);
    }

    setData((prev) => prev.filter((r) => r.id !== id));
    if (activeTable === 'attendance') {
      resetTodayAttendance();
      setMsg({
        type: 'success',
        text: 'Data presensi berhasil dihapus permanen dari Supabase! Sesi hari ini telah di-reset.',
      });
    } else if (activeTable === 'payslips') {
      try {
        const stored = localStorage.getItem('pwa_payslips_detail');
        if (stored) {
          const map = JSON.parse(stored);
          delete map[id];
          localStorage.setItem('pwa_payslips_detail', JSON.stringify(map));
          await supabase.from('admin_settings').upsert(
            {
              setting_key: 'payslips_detail_backup',
              setting_value: map,
              role: 'payslips_detail',
              description: JSON.stringify(map),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'setting_key' }
          );
        }
      } catch (err) {
        console.warn('Error clearing payslip detail cache:', err);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pwa_payslips_deleted', { detail: { id } }));
      }
      setMsg({
        type: 'success',
        text: 'Data slip gaji berhasil dihapus dari Supabase & tampilan Kelola Gaji!',
      });
    } else if (activeTable === 'leaves') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pwa_leave_deleted', { detail: { id } }));
      }
      setMsg({ type: 'success', text: 'Data pengajuan izin berhasil dihapus dari database!' });
    } else {
      setMsg({ type: 'success', text: 'Baris data berhasil dihapus permanen dari Supabase!' });
    }
  };

  // Handle Tambah Baris Baru
  const handleAddRow = async (e) => {
    e.preventDefault();
    try {
      const newRow = {
        id: `local_${Date.now()}`,
        created_at: new Date().toISOString(),
        ...newRowData,
      };

      await supabase.from(activeTable).insert(newRowData);
      setData((prev) => [newRow, ...prev]);
      setIsAdding(false);
      setNewRowData({});
      setMsg({ type: 'success', text: 'Data baru berhasil ditambahkan ke tabel!' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal menambahkan data.' });
    }
  };

  // Filter Search & Outlet
  const filteredData = data.filter((row) => {
    const matchesOutlet =
      selectedOutlet === 'all' ||
      !row.branch ||
      row.branch.toLowerCase().includes(selectedOutlet.toLowerCase());

    const searchStr = JSON.stringify(row).toLowerCase();
    const matchesSearch = !search || searchStr.includes(search.toLowerCase());

    return matchesOutlet && matchesSearch;
  });

  return (
    <div className="bg-white/95 border border-gray-200 rounded-2xl p-4 shadow-md space-y-4 animate-in fade-in">
      {/* Header Tabel Editor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shadow-sm">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-800">
              Supabase Table Editor (Database Manager)
            </h4>
            <p className="text-[10px] text-gray-500">
              Kelola data tabel database &amp; PIN otorisasi admin Supabase
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>SQL Schema Supabase</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* SQL Setup Banner */}
      {showSqlGuide && (
        <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between font-bold text-amber-400">
            <span>Panduan Menjalankan SQL di Supabase:</span>
            <button
              type="button"
              onClick={() => setShowSqlGuide(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            1. Buka <strong>Supabase Dashboard</strong> &rarr; Masuk ke project Anda.
            <br />
            2. Klik menu <strong>SQL Editor</strong> di panel sebelah kiri.
            <br />
            3. Buka file <code>supabase_schema.sql</code>, salin seluruh isinya, lalu tempel di SQL Editor.
            <br />
            4. Klik tombol <strong>RUN</strong>. Tabel <code>admin_settings</code>, <code>outlets_config</code>, <code>employees</code>, <code>attendance</code>, <code>leaves</code>, <code>shifts</code>, dan <code>payslips</code> otomatis siap digunakan!
          </p>
        </div>
      )}

      {/* Tabs Pilihan Tabel */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tables.map((tbl) => (
          <button
            key={tbl.id}
            type="button"
            onClick={() => setActiveTable(tbl.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTable === tbl.id
                ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            <span>{tbl.icon}</span>
            <span>{tbl.label}</span>
          </button>
        ))}
      </div>

      {/* Alert Notifikasi Pesan */}
      {msg.text && (
        <div
          className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-red-50 text-red-800 border border-red-300'
          }`}
        >
          {msg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* ================= KHUSUS TAB: ADMIN SETTINGS (PENGATURAN PIN ADMIN) ================= */}
      {activeTable === 'admin_settings' && (
        <div className="space-y-3 bg-gradient-to-br from-blue-50/70 to-orange-50/70 border-2 border-blue-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#2563EB]" />
            <h5 className="font-extrabold text-xs text-gray-800 uppercase tracking-wider">
              Pusat Kontrol Perubahan PIN Admin Supabase
            </h5>
          </div>
          <p className="text-[11px] text-gray-600">
            Ubah PIN verifikasi 6-digit untuk masing-masing mode admin. Perubahan langsung disimpan ke database Supabase dan aktif saat verifikasi berikutnya.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {/* Box 1: PIN Admin Leader */}
            <div className="bg-white rounded-2xl p-3.5 border-2 border-[#EA580C]/40 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#EA580C] text-white flex items-center justify-center font-bold text-xs">
                    L
                  </div>
                  <div>
                    <h6 className="font-extrabold text-xs text-gray-900">Admin Leader</h6>
                    <p className="text-[9px] text-gray-500">Shift, Monitoring &amp; Karyawan</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded-md border">
                    {showLeaderPin ? adminPins?.leader : '••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLeaderPin(!showLeaderPin)}
                    className="text-gray-400 hover:text-gray-700 p-1"
                    title={showLeaderPin ? 'Sembunyikan' : 'Lihat PIN'}
                  >
                    {showLeaderPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveLeaderPin} className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">
                    Masukkan PIN Baru (6 Digit):
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={leaderPinInput}
                    onChange={(e) => setLeaderPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 987321"
                    className="w-full bg-orange-50/40 border border-orange-200 rounded-xl px-3 py-1.5 text-center font-mono font-bold tracking-widest text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingPin || leaderPinInput.length !== 6}
                  className={`w-full py-2 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-xs ${
                    leaderPinInput.length === 6
                      ? 'bg-[#EA580C] hover:bg-orange-700 cursor-pointer active:scale-98'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan PIN Admin Leader</span>
                </button>
              </form>
            </div>

            {/* Box 2: PIN Admin Finance */}
            <div className="bg-white rounded-2xl p-3.5 border-2 border-[#2563EB]/40 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs">
                    F
                  </div>
                  <div>
                    <h6 className="font-extrabold text-xs text-gray-900">Admin Finance</h6>
                    <p className="text-[9px] text-gray-500">Slip Gaji &amp; Titik Lokasi GPS</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded-md border">
                    {showFinancePin ? adminPins?.finance : '••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFinancePin(!showFinancePin)}
                    className="text-gray-400 hover:text-gray-700 p-1"
                    title={showFinancePin ? 'Sembunyikan' : 'Lihat PIN'}
                  >
                    {showFinancePin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveFinancePin} className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">
                    Masukkan PIN Baru (6 Digit):
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={financePinInput}
                    onChange={(e) => setFinancePinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 020103"
                    className="w-full bg-blue-50/40 border border-blue-200 rounded-xl px-3 py-1.5 text-center font-mono font-bold tracking-widest text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingPin || financePinInput.length !== 6}
                  className={`w-full py-2 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-xs ${
                    financePinInput.length === 6
                      ? 'bg-[#2563EB] hover:bg-blue-700 cursor-pointer active:scale-98'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan PIN Admin Finance</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Filter Outlet & Search Bar (untuk tabel umum) */}
      {activeTable !== 'admin_settings' && (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Cari di tabel ${activeTable}...`}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
            >
              <option value="all">Semua Outlet (3 Pilar)</option>
              <option value="LazyBloom">LazyBloom</option>
              <option value="Deru Ombak">Deru Ombak</option>
              <option value="Sea Cafe">Sea Cafe</option>
            </select>

            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Form Tambah Baris Manual */}
      {isAdding && activeTable !== 'admin_settings' && (
        <form
          onSubmit={handleAddRow}
          className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 animate-in fade-in"
        >
          <div className="font-bold text-xs text-gray-800">
            Tambah Baris Baru ke Tabel {activeTable}:
          </div>

          {activeTable === 'employees' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nama Lengkap"
                className="bg-white border rounded-lg px-2 py-1 text-xs"
                onChange={(e) => setNewRowData({ ...newRowData, full_name: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="No HP (08...)"
                className="bg-white border rounded-lg px-2 py-1 text-xs"
                onChange={(e) => setNewRowData({ ...newRowData, phone: e.target.value })}
                required
              />
              <select
                className="bg-white border rounded-lg px-2 py-1 text-xs"
                onChange={(e) => setNewRowData({ ...newRowData, branch: e.target.value })}
              >
                <option value="LazyBloom">LazyBloom</option>
                <option value="Deru Ombak">Deru Ombak</option>
                <option value="Sea Cafe">Sea Cafe</option>
              </select>
              <input
                type="text"
                placeholder="Posisi (Barista/Kitchen/Kasir)"
                className="bg-white border rounded-lg px-2 py-1 text-xs"
                onChange={(e) => setNewRowData({ ...newRowData, position: e.target.value })}
              />
            </div>
          )}

          {activeTable === 'shifts' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="bg-white border rounded-lg px-2 py-1 text-xs"
                onChange={(e) => setNewRowData({ ...newRowData, shift_date: e.target.value })}
                required
              />
              <select
                className="bg-white border rounded-lg px-2 py-1 text-xs"
                onChange={(e) => setNewRowData({ ...newRowData, shift_name: e.target.value })}
              >
                <option value="Shift Pagi (08:00 - 16:00)">Shift Pagi</option>
                <option value="Shift Siang (14:00 - 22:00)">Shift Siang</option>
                <option value="Libur / Off">Libur / Off</option>
              </select>
            </div>
          )}

          {activeTable !== 'employees' && activeTable !== 'shifts' && (
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Keterangan / Nilai Data..."
                className="w-full bg-white border rounded-lg px-2 py-1 text-xs"
                onChange={(e) => setNewRowData({ ...newRowData, notes: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-gray-200 text-gray-700"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs"
            >
              Simpan ke Database
            </button>
          </div>
        </form>
      )}

      {/* Tabel Data View */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-left text-[11px] text-gray-700 divide-y divide-gray-200">
          <thead className="bg-gray-100 font-bold text-gray-800 text-[10px] uppercase">
            <tr>
              <th className="px-3 py-2">ID / Info</th>
              <th className="px-3 py-2">Nama / Role / Item</th>
              <th className="px-3 py-2">Outlet / Cabang</th>
              {activeTable === 'employees' && (
                <th className="px-3 py-2">Paket Gaji (Pokok &amp; Tunjangan)</th>
              )}
              <th className="px-3 py-2">Detail &amp; Nilai Data</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={activeTable === 'employees' ? 6 : 5} className="px-3 py-6 text-center text-gray-400">
                  Tidak ada data yang ditemukan di tabel ini.
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-gray-50/80 transition">
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                    {row.attendance_date || row.employee_id || row.role || row.id?.slice(0, 8) || `#${idx + 1}`}
                  </td>
                  <td className="px-3 py-2 font-bold text-gray-900">
                    {row.role === 'leader'
                      ? 'Admin Leader'
                      : row.role === 'finance'
                      ? 'Admin Finance'
                      : row.employees?.full_name ||
                        employeeMap[row.employee_id]?.full_name ||
                        row.full_name ||
                        row.employee_name ||
                        row.name ||
                        row.period ||
                        row.shift_name ||
                        '-'}
                  </td>
                  <td className="px-3 py-2">
                    {row.branch || row.employees?.branch || row.name ? (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          (row.branch || row.employees?.branch || row.name) === 'Deru Ombak'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (row.branch || row.employees?.branch || row.name) === 'Sea Cafe'
                            ? 'bg-sky-100 text-sky-800'
                            : (row.branch || row.employees?.branch || row.name) === 'Mobile / Lapangan'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {row.branch || row.employees?.branch || row.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>

                  {/* Kolom Khusus Employees: Paket Gaji & 4 Tunjangan */}
                  {activeTable === 'employees' && (() => {
                    const pkg = employeeSalaries[row.id] || employeeSalaries[row.full_name] || null;
                    const totalTunjangan =
                      (pkg?.child_allowance || 0) +
                      (pkg?.spouse_allowance || 0) +
                      (pkg?.position_allowance || 0) +
                      (pkg?.meal_allowance || 0);

                    return (
                      <td className="px-3 py-2">
                        {pkg ? (
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-extrabold text-emerald-800">
                              Pokok: {formatRupiah(pkg.basic_salary || 0)}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              Tunjangan: {formatRupiah(totalTunjangan)}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenSalaryModal(row)}
                              className="text-[9px] font-bold text-[#2563EB] hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>⚙ Ubah Paket Gaji</span>
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[9px] text-slate-400 block mb-0.5">Rp 0 (Belum diatur)</span>
                            <button
                              type="button"
                              onClick={() => handleOpenSalaryModal(row)}
                              className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer transition"
                            >
                              + Atur Gaji
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })()}

                  <td className="px-3 py-2 text-gray-600 text-[10px]">
                    {row.pin ? (
                      <span className="font-mono font-bold bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                        PIN: {row.pin}
                      </span>
                    ) : row.latitude ? (
                      <span>
                        Lat: {row.latitude}, Lng: {row.longitude} (R: {row.radius_meters || 50}m)
                      </span>
                    ) : row.check_in_time ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800">
                          Masuk: {new Date(row.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {row.check_out_time &&
                            ` • Pulang: ${new Date(row.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                        {row.status && (
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            {row.status}
                          </span>
                        )}
                      </div>
                    ) : (
                      row.position ||
                      row.leave_type ||
                      (row.net_salary && formatRupiah(row.net_salary)) ||
                      row.notes ||
                      row.description ||
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {activeTable !== 'admin_settings' ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 rounded-md text-red-500 hover:bg-red-50 transition"
                        title="Hapus Baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-mono">Protected</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
        <span>Menampilkan {filteredData.length} baris data</span>
        <span className="font-semibold text-emerald-700">● Terhubung ke Supabase</span>
      </div>

      {/* Modal Atur Paket Gaji Karyawan */}
      {editingSalaryEmp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#2563EB]" />
                  <span>Atur Paket Gaji &amp; Tunjangan</span>
                </h4>
                <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                  {editingSalaryEmp.full_name} &bull;{' '}
                  <span className="text-orange-600 font-bold">{editingSalaryEmp.branch}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSalaryEmp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployeeSalaryPkg} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Gaji Pokok:
                </label>
                <CurrencyInput
                  value={salaryPkgInput.basic_salary}
                  onChange={(val) => setSalaryPkgInput({ ...salaryPkgInput, basic_salary: val })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Rp 0"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                    4 Komponen Tunjangan Resmi
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSalaryPkgInput((prev) => ({
                        ...prev,
                        child_allowance: 0,
                        spouse_allowance: 0,
                        position_allowance: 0,
                        meal_allowance: 0,
                      }))
                    }
                    className="text-[9px] font-bold text-slate-500 hover:text-rose-600 underline cursor-pointer"
                  >
                    Reset Tunjangan ke Rp 0
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Anak</label>
                    <CurrencyInput
                      value={salaryPkgInput.child_allowance}
                      onChange={(val) => setSalaryPkgInput({ ...salaryPkgInput, child_allowance: val })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                      placeholder="Rp 0"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Istri</label>
                    <CurrencyInput
                      value={salaryPkgInput.spouse_allowance}
                      onChange={(val) => setSalaryPkgInput({ ...salaryPkgInput, spouse_allowance: val })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                      placeholder="Rp 0"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Jabatan</label>
                    <CurrencyInput
                      value={salaryPkgInput.position_allowance}
                      onChange={(val) => setSalaryPkgInput({ ...salaryPkgInput, position_allowance: val })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                      placeholder="Rp 0"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Makan</label>
                    <CurrencyInput
                      value={salaryPkgInput.meal_allowance}
                      onChange={(val) => setSalaryPkgInput({ ...salaryPkgInput, meal_allowance: val })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                      placeholder="Rp 0"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSalaryEmp(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSalaryPkg}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-98 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingSalaryPkg ? 'Menyimpan...' : 'Simpan Paket Gaji'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
