'use client';

import React, { useState } from 'react';
import {
  Banknote,
  MapPin,
  ArrowLeft,
  Check,
  Plus,
  Lock,
  Unlock,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Database,
  Building2,
  DollarSign,
  LocateFixed,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import SupabaseTableEditor from './SupabaseTableEditor';

export default function AdminFinanceDashboard({ onBack }) {
  const { outlets, updateOutletCoords } = useAuth();
  const [financeTab, setFinanceTab] = useState('payroll'); // 'payroll' | 'gpsConfig' | 'tableEditor'

  // ================= 1. KELOLA SLIP GAJI 3 OUTLET =================
  const [selectedOutletSalary, setSelectedOutletSalary] = useState('all');
  const [isAddingSalary, setIsAddingSalary] = useState(false);
  const [salaryMsg, setSalaryMsg] = useState({ type: '', text: '' });

  const [newSalary, setNewSalary] = useState({
    employee_name: 'Fikril Bay',
    branch: 'LazyBloom',
    period: 'September 2026',
    basic_salary: 3500000,
    attendance_allowance: 500000,
    transport_allowance: 300000,
    overtime_pay: 150000,
    deductions: 50000,
    is_released: true,
  });

  const [salaryList, setSalaryList] = useState([
    {
      id: 'sal-1',
      employee_name: 'Fikril Bay',
      branch: 'LazyBloom',
      period: 'Agustus 2026',
      basic_salary: 3500000,
      net_salary: 4450000,
      is_released: true,
    },
    {
      id: 'sal-2',
      employee_name: 'Bagas Pratama',
      branch: 'Deru Ombak',
      period: 'Agustus 2026',
      basic_salary: 3800000,
      net_salary: 4750000,
      is_released: true,
    },
    {
      id: 'sal-3',
      employee_name: 'Rian Bahari',
      branch: 'Sea Cafe',
      period: 'Agustus 2026',
      basic_salary: 3400000,
      net_salary: 4300000,
      is_released: true,
    },
    {
      id: 'sal-4',
      employee_name: 'Fikril Bay',
      branch: 'LazyBloom',
      period: 'September 2026',
      basic_salary: 3500000,
      net_salary: 4300000,
      is_released: false, // Bergembok
    },
  ]);

  // Kalkulasi total gaji bersih secara live
  const calculateNetSalary = (s) => {
    const basic = Number(s.basic_salary) || 0;
    const att = Number(s.attendance_allowance) || 0;
    const trans = Number(s.transport_allowance) || 0;
    const ovt = Number(s.overtime_pay) || 0;
    const ded = Number(s.deductions) || 0;
    return basic + att + trans + ovt - ded;
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    const net = calculateNetSalary(newSalary);
    const item = {
      id: `sal_${Date.now()}`,
      ...newSalary,
      net_salary: net,
    };

    try {
      await supabase.from('payslips').insert({
        period: newSalary.period,
        basic_salary: newSalary.basic_salary,
        attendance_allowance: newSalary.attendance_allowance,
        transport_allowance: newSalary.transport_allowance,
        overtime_pay: newSalary.overtime_pay,
        deductions: newSalary.deductions,
        net_salary: net,
        is_released: newSalary.is_released,
      });
    } catch (e) {
      console.warn('Payslip sync:', e);
    }

    setSalaryList([item, ...salaryList]);
    setIsAddingSalary(false);
    setSalaryMsg({
      type: 'success',
      text: `Slip gaji ${item.employee_name} (${item.period}) berhasil disimpan!`,
    });
    setTimeout(() => setSalaryMsg({ type: '', text: '' }), 3000);
  };

  const toggleSalaryRelease = (id) => {
    setSalaryList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_released: !s.is_released } : s))
    );
  };

  // ================= 2. PENGATURAN TITIK GPS 3 OUTLET =================
  const [gpsForm, setGpsForm] = useState(
    outlets.reduce((acc, o) => {
      acc[o.id] = {
        lat: o.coords.lat,
        lng: o.coords.lng,
        radiusMeters: o.coords.radiusMeters || 50,
        address: o.address,
      };
      return acc;
    }, {})
  );

  const [activeGpsOutlet, setActiveGpsOutlet] = useState('lazybloom');
  const [gpsMsg, setGpsMsg] = useState({ type: '', text: '' });
  const [detectingGps, setDetectingGps] = useState(false);

  // Auto Detect GPS perangkat saat berada di outlet fisik
  const handleDetectCurrentGPS = (outletId) => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung geolokasi.');
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const curLat = pos.coords.latitude.toFixed(6);
        const curLng = pos.coords.longitude.toFixed(6);

        setGpsForm((prev) => ({
          ...prev,
          [outletId]: {
            ...prev[outletId],
            lat: curLat,
            lng: curLng,
          },
        }));
        setDetectingGps(false);
        setGpsMsg({
          type: 'success',
          text: `Koordinat GPS saat ini berhasil diambil: ${curLat}, ${curLng}`,
        });
      },
      (err) => {
        setDetectingGps(false);
        alert('Gagal mengambil GPS: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSaveGps = (outletId) => {
    const data = gpsForm[outletId];
    if (!data.lat || !data.lng) {
      setGpsMsg({ type: 'error', text: 'Latitude dan Longitude wajib diisi desimal valid!' });
      return;
    }

    updateOutletCoords(outletId, data);
    setGpsMsg({
      type: 'success',
      text: `Titik koordinat GPS ${outlets.find((o) => o.id === outletId)?.name} berhasil diperbarui!`,
    });
    setTimeout(() => setGpsMsg({ type: '', text: '' }), 3500);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
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
            <h3 className="text-xs font-black text-[#1E293B] flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#2563EB]" />
              <span>Dashboard Admin Finance</span>
              <span className="text-[9px] bg-[#2563EB] text-white px-2 py-0.2 rounded-full font-extrabold">
                Keuangan &amp; GPS
              </span>
            </h3>
            <p className="text-[10px] text-gray-600">
              Kelola gaji 3 outlet &amp; atur koordinat latitude/longitude
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1.5 bg-[#B8BFC8] p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setFinanceTab('payroll')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-0.5 ${
            financeTab === 'payroll'
              ? 'bg-white text-[#2563EB] shadow-xs'
              : 'text-gray-700 hover:text-gray-950'
          }`}
        >
          <Banknote className="w-3.5 h-3.5" />
          <span>Gaji 3 Outlet</span>
        </button>

        <button
          type="button"
          onClick={() => setFinanceTab('gpsConfig')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-0.5 ${
            financeTab === 'gpsConfig'
              ? 'bg-white text-[#2563EB] shadow-xs'
              : 'text-gray-700 hover:text-gray-950'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Titik GPS Outlet</span>
        </button>

        <button
          type="button"
          onClick={() => setFinanceTab('tableEditor')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-0.5 ${
            financeTab === 'tableEditor'
              ? 'bg-white text-[#2563EB] shadow-xs'
              : 'text-gray-700 hover:text-gray-950'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Tabel Editor</span>
        </button>
      </div>

      {/* ================= TAB 1: KELOLA GAJI 3 OUTLET ================= */}
      {financeTab === 'payroll' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-[#2563EB]" />
              <span>Kelola &amp; Rilis Slip Gaji Karyawan</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingSalary(!isAddingSalary)}
              className="px-2.5 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-bold rounded-xl flex items-center gap-1 shadow-xs transition"
            >
              <Plus className="w-3 h-3" />
              <span>Tambah Slip Gaji</span>
            </button>
          </div>

          {salaryMsg.text && (
            <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{salaryMsg.text}</span>
            </div>
          )}

          {/* Form Tambah Slip Gaji Baru */}
          {isAddingSalary && (
            <form onSubmit={handleSaveSalary} className="p-3.5 bg-gray-50 border border-blue-200 rounded-2xl space-y-3">
              <h5 className="font-bold text-xs text-[#2563EB] pb-1 border-b border-gray-200">
                Form Input Slip Gaji Karyawan
              </h5>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Pilih Outlet</label>
                  <select
                    value={newSalary.branch}
                    onChange={(e) => setNewSalary({ ...newSalary, branch: e.target.value })}
                    className="w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                  >
                    <option value="LazyBloom">LazyBloom</option>
                    <option value="Deru Ombak">Deru Ombak</option>
                    <option value="Sea Cafe">Sea Cafe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Nama Karyawan</label>
                  <input
                    type="text"
                    value={newSalary.employee_name}
                    onChange={(e) => setNewSalary({ ...newSalary, employee_name: e.target.value })}
                    className="w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Periode Gaji</label>
                  <input
                    type="text"
                    value={newSalary.period}
                    onChange={(e) => setNewSalary({ ...newSalary, period: e.target.value })}
                    placeholder="Contoh: September 2026"
                    className="w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Gaji Pokok (Rp)</label>
                  <input
                    type="number"
                    value={newSalary.basic_salary}
                    onChange={(e) => setNewSalary({ ...newSalary, basic_salary: e.target.value })}
                    className="w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1">Tunj. Hadir</label>
                  <input
                    type="number"
                    value={newSalary.attendance_allowance}
                    onChange={(e) => setNewSalary({ ...newSalary, attendance_allowance: e.target.value })}
                    className="w-full bg-white border rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1">Tunj. Transport</label>
                  <input
                    type="number"
                    value={newSalary.transport_allowance}
                    onChange={(e) => setNewSalary({ ...newSalary, transport_allowance: e.target.value })}
                    className="w-full bg-white border rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1">Lembur</label>
                  <input
                    type="number"
                    value={newSalary.overtime_pay}
                    onChange={(e) => setNewSalary({ ...newSalary, overtime_pay: e.target.value })}
                    className="w-full bg-white border rounded-lg px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-rose-600 mb-1">Potongan BPJS / Denda (Rp)</label>
                  <input
                    type="number"
                    value={newSalary.deductions}
                    onChange={(e) => setNewSalary({ ...newSalary, deductions: e.target.value })}
                    className="w-full bg-white border border-rose-300 rounded-xl px-2.5 py-1.5 text-xs text-rose-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">Status Rilis Slip</label>
                  <select
                    value={newSalary.is_released ? 'true' : 'false'}
                    onChange={(e) => setNewSalary({ ...newSalary, is_released: e.target.value === 'true' })}
                    className="w-full bg-white border rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <option value="true">Rilis (Terbuka untuk staf)</option>
                    <option value="false">Terkunci / Bergembok</option>
                  </select>
                </div>
              </div>

              {/* Total Bersih Preview */}
              <div className="p-2 bg-blue-100/70 border border-blue-300 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-blue-900">Total Gaji Bersih:</span>
                <span className="font-black text-sm text-[#2563EB]">
                  Rp {calculateNetSalary(newSalary).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingSalary(false)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-gray-200 text-gray-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold shadow-xs"
                >
                  Simpan &amp; Terbitkan Slip
                </button>
              </div>
            </form>
          )}

          {/* Filter Outlet */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold overflow-x-auto pb-1">
            <span className="text-gray-500">Filter:</span>
            {['all', 'LazyBloom', 'Deru Ombak', 'Sea Cafe'].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedOutletSalary(b)}
                className={`px-2.5 py-1 rounded-full border transition shrink-0 ${
                  selectedOutletSalary === b
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {b === 'all' ? 'Semua Outlet' : b}
              </button>
            ))}
          </div>

          {/* Tabel Daftar Slip Gaji */}
          <div className="space-y-2">
            {salaryList
              .filter(
                (s) => selectedOutletSalary === 'all' || s.branch === selectedOutletSalary
              )
              .map((slip) => (
                <div
                  key={slip.id}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between hover:border-gray-300 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold text-gray-900">{slip.employee_name}</h5>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-blue-100 text-blue-800">
                        {slip.branch}
                      </span>
                      <span className="text-[10px] text-gray-500">• {slip.period}</span>
                    </div>
                    <p className="text-xs font-extrabold text-[#2563EB] mt-0.5">
                      Rp {slip.net_salary.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSalaryRelease(slip.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                        slip.is_released
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'
                      }`}
                    >
                      {slip.is_released ? (
                        <>
                          <Unlock className="w-3 h-3 text-emerald-600" />
                          <span>Rilis</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-gray-500" />
                          <span>Terkunci</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ================= TAB 2: PENGATURAN TITIK GPS 3 OUTLET ================= */}
      {financeTab === 'gpsConfig' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="pb-1 border-b border-gray-100">
            <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#2563EB]" />
              <span>Pengaturan Titik GPS Lokasi 3 Outlet</span>
            </h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Tentukan koordinat Latitude, Longitude, dan Radius validasi absensi untuk masing-masing outlet.
            </p>
          </div>

          {gpsMsg.text && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                gpsMsg.type === 'success'
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                  : 'bg-red-100 border border-red-300 text-red-800'
              }`}
            >
              {gpsMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{gpsMsg.text}</span>
            </div>
          )}

          {/* Pilihan 3 Outlet untuk Dikonfigurasi */}
          <div className="grid grid-cols-3 gap-1.5">
            {outlets.map((outlet) => {
              const isSelected = activeGpsOutlet === outlet.id;
              return (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => setActiveGpsOutlet(outlet.id)}
                  className={`p-2.5 rounded-xl border-2 transition text-center flex flex-col items-center ${
                    isSelected
                      ? `${outlet.badgeBg} text-white ${outlet.badgeBorder} shadow-xs font-black`
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold'
                  }`}
                >
                  <Building2 className="w-4 h-4 mb-1" />
                  <span className="text-xs">{outlet.name}</span>
                  <span className="text-[9px] opacity-80 mt-0.5">
                    {outlet.coords.radiusMeters || 50}m
                  </span>
                </button>
              );
            })}
          </div>

          {/* Form Konfigurasi GPS Outlet Terpilih */}
          {activeGpsOutlet && gpsForm[activeGpsOutlet] && (
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-gray-200">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                  <h5 className="font-extrabold text-xs text-gray-900">
                    Form Titik Lokasi: {outlets.find((o) => o.id === activeGpsOutlet)?.name}
                  </h5>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">
                  ID: {activeGpsOutlet}
                </span>
              </div>

              {/* Alamat Fisik */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">
                  Alamat Lengkap Outlet
                </label>
                <input
                  type="text"
                  value={gpsForm[activeGpsOutlet].address || ''}
                  onChange={(e) =>
                    setGpsForm({
                      ...gpsForm,
                      [activeGpsOutlet]: { ...gpsForm[activeGpsOutlet], address: e.target.value },
                    })
                  }
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-800"
                  placeholder="Alamat fisik outlet..."
                />
              </div>

              {/* Input Latitude & Longitude */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-1">
                    Latitude (Garis Lintang)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={gpsForm[activeGpsOutlet].lat}
                    onChange={(e) =>
                      setGpsForm({
                        ...gpsForm,
                        [activeGpsOutlet]: { ...gpsForm[activeGpsOutlet], lat: e.target.value },
                      })
                    }
                    placeholder="-6.208800"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#2563EB]/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-1">
                    Longitude (Garis Bujur)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={gpsForm[activeGpsOutlet].lng}
                    onChange={(e) =>
                      setGpsForm({
                        ...gpsForm,
                        [activeGpsOutlet]: { ...gpsForm[activeGpsOutlet], lng: e.target.value },
                      })
                    }
                    placeholder="106.845600"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#2563EB]/40"
                    required
                  />
                </div>
              </div>

              {/* Radius Geofencing */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-gray-700">
                    Radius Validasi Geofencing (Meter)
                  </label>
                  <span className="text-[10px] font-black text-[#2563EB]">
                    {gpsForm[activeGpsOutlet].radiusMeters} Meter
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={gpsForm[activeGpsOutlet].radiusMeters}
                  onChange={(e) =>
                    setGpsForm({
                      ...gpsForm,
                      [activeGpsOutlet]: { ...gpsForm[activeGpsOutlet], radiusMeters: e.target.value },
                    })
                  }
                  className="w-full accent-[#2563EB]"
                />
                <div className="flex justify-between text-[9px] text-gray-400">
                  <span>20m (Sangat Ketat)</span>
                  <span>50m (Standar)</span>
                  <span>200m (Luas)</span>
                </div>
              </div>

              {/* Action Buttons: Auto-Detect GPS & Save */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDetectCurrentGPS(activeGpsOutlet)}
                  disabled={detectingGps}
                  className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <LocateFixed className={`w-3.5 h-3.5 ${detectingGps ? 'animate-spin' : ''}`} />
                  <span>{detectingGps ? 'Mendeteksi...' : 'Ambil GPS Saat Ini'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveGps(activeGpsOutlet)}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Titik GPS</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: TABEL EDITOR SUPABASE ================= */}
      {financeTab === 'tableEditor' && <SupabaseTableEditor />}
    </div>
  );
}
