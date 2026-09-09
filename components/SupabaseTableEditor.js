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
              pin: adminPins?.leader || '112233',
              description: 'PIN Verifikasi Admin Leader (Shift, Monitoring, Staf)',
              updated_at: new Date().toISOString(),
            },
            {
              id: 'adm-pin-2',
              role: 'finance',
              pin: adminPins?.finance || '445566',
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
      setMsg({ type: 'error', text: 'PIN Admin Leader harus tepat 6 digit angka (misal: 112233).' });
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
      setMsg({ type: 'error', text: 'PIN Admin Finance harus tepat 6 digit angka (misal: 445566).' });
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
                    placeholder="Contoh: 112233"
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
                    placeholder="Contoh: 445566"
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
              <th className="px-3 py-2">Detail &amp; Nilai Data</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  Tidak ada data yang ditemukan di tabel ini.
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-gray-50/80 transition">
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                    {row.employee_id || row.role || row.id?.slice(0, 8) || `#${idx + 1}`}
                  </td>
                  <td className="px-3 py-2 font-bold text-gray-900">
                    {row.role === 'leader'
                      ? 'Admin Leader'
                      : row.role === 'finance'
                      ? 'Admin Finance'
                      : row.full_name || row.employee_name || row.name || row.period || row.shift_name || '-'}
                  </td>
                  <td className="px-3 py-2">
                    {row.branch || row.name ? (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          (row.branch || row.name) === 'Deru Ombak'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (row.branch || row.name) === 'Sea Cafe'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {row.branch || row.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-[10px]">
                    {row.pin ? (
                      <span className="font-mono font-bold bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                        PIN: {row.pin}
                      </span>
                    ) : row.latitude ? (
                      <span>
                        Lat: {row.latitude}, Lng: {row.longitude} (R: {row.radius_meters || 50}m)
                      </span>
                    ) : (
                      row.position ||
                      (row.check_in_time && `Masuk: ${row.check_in_time}`) ||
                      row.leave_type ||
                      (row.net_salary && `Rp ${row.net_salary.toLocaleString('id-ID')}`) ||
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
    </div>
  );
}
