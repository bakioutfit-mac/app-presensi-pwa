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
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import SupabaseTableEditor from './SupabaseTableEditor';

export default function AdminFinanceDashboard({ onBack }) {
  const { outlets, updateOutletCoords, overtimeRequests, updateOvertimeNominal } = useAuth();
  const [financeTab, setFinanceTab] = useState('payroll'); // 'payroll' | 'gpsConfig' | 'tableEditor'

  // ================= 1. KELOLA SLIP GAJI 3 OUTLET =================
  const [selectedOutletSalary, setSelectedOutletSalary] = useState('all');
  const [isAddingSalary, setIsAddingSalary] = useState(false);
  const [salaryMsg, setSalaryMsg] = useState({ type: '', text: '' });
  const [editingOtId, setEditingOtId] = useState(null);
  const [editingOtNominal, setEditingOtNominal] = useState('');

  // 10 Komponen Gaji Outlet (6 Pendapatan + 4 Potongan)
  const [newSalary, setNewSalary] = useState({
    employee_name: 'Fikril Bay',
    branch: 'LazyBloom',
    period: 'September 2026',
    // 6 Komponen Pendapatan
    basic_salary: 3500000,
    child_allowance: 200000,
    spouse_allowance: 300000,
    position_allowance: 500000,
    meal_allowance: 400000,
    overtime_pay: 150000,
    // 4 Komponen Potongan
    meal_deduction: 50000,
    attendance_deduction: 0,
    discipline_deduction: 10000, // Default denda terlambat Rp 10.000
    cash_bon: 100000,
    is_released: true,
  });

  const [salaryList, setSalaryList] = useState([]);

  // Fetch real payslips from Supabase on mount
  useEffect(() => {
    async function fetchSalaries() {
      try {
        const { data, error } = await supabase
          .from('payslips')
          .select('*, employees(full_name, branch)')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped = data.map((p) => ({
            id: p.id,
            employee_name: p.employees?.full_name || 'Staf',
            branch: p.employees?.branch || 'LazyBloom',
            period: p.period,
            basic_salary: p.basic_salary,
            child_allowance: p.child_allowance || 0,
            spouse_allowance: p.spouse_allowance || 0,
            position_allowance: p.position_allowance || 0,
            meal_allowance: p.attendance_allowance || p.meal_allowance || 0,
            overtime_pay: p.overtime_pay || 0,
            meal_deduction: 0,
            attendance_deduction: p.attendance_deduction || 0,
            discipline_deduction: p.discipline_deduction || 0,
            cash_bon: p.deductions || 0,
            net_salary: p.net_salary,
            is_released: p.is_released,
          }));
          setSalaryList(mapped);
        } else {
          setSalaryList([]);
        }
      } catch (e) {
        console.warn('Fetch payslips error:', e);
        setSalaryList([]);
      }
    }
    fetchSalaries();
  }, []);

  // Kalkulasi total pendapatan
  const calculateTotalIncome = (s) => {
    return (
      (Number(s.basic_salary) || 0) +
      (Number(s.child_allowance) || 0) +
      (Number(s.spouse_allowance) || 0) +
      (Number(s.position_allowance) || 0) +
      (Number(s.meal_allowance) || 0) +
      (Number(s.overtime_pay) || 0)
    );
  };

  // Kalkulasi total potongan
  const calculateTotalDeductions = (s) => {
    return (
      (Number(s.meal_deduction) || 0) +
      (Number(s.attendance_deduction) || 0) +
      (Number(s.discipline_deduction) || 0) +
      (Number(s.cash_bon) || 0)
    );
  };

  // Kalkulasi total gaji bersih (Take Home Pay)
  const calculateNetSalary = (s) => {
    return calculateTotalIncome(s) - calculateTotalDeductions(s);
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
        child_allowance: newSalary.child_allowance,
        spouse_allowance: newSalary.spouse_allowance,
        position_allowance: newSalary.position_allowance,
        meal_allowance: newSalary.meal_allowance,
        overtime_pay: newSalary.overtime_pay,
        meal_deduction: newSalary.meal_deduction,
        attendance_deduction: newSalary.attendance_deduction,
        discipline_deduction: newSalary.discipline_deduction,
        cash_bon: newSalary.cash_bon,
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
      text: `Slip gaji ${item.employee_name} (${item.period}) berhasil disimpan & dihitung bersih!`,
    });
    setTimeout(() => setSalaryMsg({ type: '', text: '' }), 3500);
  };

  const toggleSalaryRelease = (id) => {
    setSalaryList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_released: !s.is_released } : s))
    );
  };

  // Finance input nominal lembur dari Leader
  const handleApproveOvertime = (otId, amount) => {
    updateOvertimeNominal(otId, amount);
    setEditingOtId(null);
    setSalaryMsg({
      type: 'success',
      text: `Nominal lembur berhasil disetujui sebesar Rp ${Number(amount).toLocaleString('id-ID')}`,
    });
    setTimeout(() => setSalaryMsg({ type: '', text: '' }), 3000);
  };

  // ================= 2. PENGATURAN TITIK GPS 3 OUTLET =================
  const safeOutlets = Array.isArray(outlets) && outlets.length > 0 ? outlets : [];
  const [gpsForm, setGpsForm] = useState(() => {
    return safeOutlets.reduce((acc, o) => {
      acc[o.id] = {
        lat: o.coords?.lat ?? o.latitude ?? -6.2088,
        lng: o.coords?.lng ?? o.longitude ?? 106.8456,
        radiusMeters: o.coords?.radiusMeters ?? o.radius_meters ?? 50,
        address: o.address || '',
      };
      return acc;
    }, {});
  });

  const [activeGpsOutlet, setActiveGpsOutlet] = useState(() => safeOutlets[0]?.id || 'lazybloom');
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
              <DollarSign className="w-4 h-4 text-[#2563EB]" />
              <span>Dashboard Admin Finance</span>
              <span className="text-[9px] bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-black">
                Keuangan &amp; GPS
              </span>
            </h3>
            <p className="text-[10px] text-slate-500">
              Kelola gaji 3 outlet &amp; atur koordinat latitude/longitude
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setFinanceTab('payroll')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            financeTab === 'payroll'
              ? 'bg-white text-[#2563EB] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Gaji 3 Outlet</span>
        </button>

        <button
          type="button"
          onClick={() => setFinanceTab('gpsConfig')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            financeTab === 'gpsConfig'
              ? 'bg-white text-[#2563EB] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Titik GPS Outlet</span>
        </button>

        <button
          type="button"
          onClick={() => setFinanceTab('tableEditor')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 ${
            financeTab === 'tableEditor'
              ? 'bg-white text-[#2563EB] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Tabel Editor</span>
        </button>
      </div>

      {/* ================= TAB 1: KELOLA GAJI 3 OUTLET ================= */}
      {financeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Panel Pengajuan Lembur dari Admin Leader */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <span>Pengajuan Lembur Staf</span>
                    <span className="text-[9px] bg-orange-100 text-orange-800 font-black px-2 py-0.5 rounded-full">
                      Dari Leader
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Leader mengajukan jam &amp; tugas, Finance menentukan nominal rupiah
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                {overtimeRequests.length} Pengajuan
              </span>
            </div>

            <div className="space-y-2">
              {overtimeRequests.map((ot) => {
                const isApproved = ot.status === 'Disetujui Finance';
                return (
                  <div
                    key={ot.id}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{ot.employee_name}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-blue-100 text-blue-800">
                          {ot.branch}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">• {ot.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Durasi: <strong className="text-slate-900">{ot.hours} Jam</strong> • Alasan: <span className="italic">{ot.reason}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {editingOtId === ot.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            placeholder="Rp Nominal"
                            value={editingOtNominal}
                            onChange={(e) => setEditingOtNominal(e.target.value)}
                            className="w-24 px-2 py-1 text-xs border rounded-lg bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleApproveOvertime(ot.id, editingOtNominal)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg shadow-xs"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingOtId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Uang Lembur:</span>
                            <span className="text-xs font-black text-[#2563EB]">
                              Rp {Number(ot.nominal || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOtId(ot.id);
                              setEditingOtNominal(ot.nominal || 50000);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-[#2563EB] text-white hover:bg-blue-700'
                            }`}
                          >
                            {isApproved ? 'Ubah Nominal' : 'Input Nominal'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewSalary((prev) => ({
                                ...prev,
                                employee_name: ot.employee_name,
                                branch: ot.branch,
                                overtime_pay: Number(ot.nominal || 0),
                              }));
                              setIsAddingSalary(true);
                            }}
                            title="Salin data ke Form Slip Gaji"
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold"
                          >
                            + Ke Slip Gaji
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Slip Gaji Karyawan */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    Kelola &amp; Rilis Slip Gaji Resmi Outlet
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    10 Komponen Penggajian: 6 Pendapatan &amp; 4 Potongan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingSalary(!isAddingSalary)}
                className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-black rounded-xl flex items-center gap-1 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Slip Gaji</span>
              </button>
            </div>

            {salaryMsg.text && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{salaryMsg.text}</span>
              </div>
            )}

            {/* Form Tambah Slip Gaji Baru (10 Komponen) */}
            {isAddingSalary && (
              <form onSubmit={handleSaveSalary} className="p-4 bg-slate-50/80 border border-blue-200 rounded-2xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h5 className="font-black text-xs text-[#2563EB] flex items-center gap-1.5">
                    <span>Form Input Slip Gaji (10 Komponen Resmi)</span>
                  </h5>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                    Sesuai Standar Outlet
                  </span>
                </div>

                {/* Profil Penerima */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Outlet</label>
                    <select
                      value={newSalary.branch}
                      onChange={(e) => setNewSalary({ ...newSalary, branch: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                    >
                      <option value="LazyBloom">LazyBloom</option>
                      <option value="Deru Ombak">Deru Ombak</option>
                      <option value="Sea Cafe">Sea Cafe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Nama Karyawan</label>
                    <input
                      type="text"
                      value={newSalary.employee_name}
                      onChange={(e) => setNewSalary({ ...newSalary, employee_name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Periode Slip</label>
                    <input
                      type="text"
                      value={newSalary.period}
                      onChange={(e) => setNewSalary({ ...newSalary, period: e.target.value })}
                      placeholder="September 2026"
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* 1. BAGIAN PENDAPATAN (6 KOMPONEN) */}
                <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-blue-50">
                    <span className="text-[11px] font-black uppercase text-[#2563EB] tracking-wider">
                      1. Penghasilan / Pendapatan (6 Komponen)
                    </span>
                    <span className="text-[10px] font-bold text-[#2563EB]">
                      Subtotal: Rp {calculateTotalIncome(newSalary).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Gaji Pokok</label>
                      <input
                        type="number"
                        value={newSalary.basic_salary}
                        onChange={(e) => setNewSalary({ ...newSalary, basic_salary: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Anak</label>
                      <input
                        type="number"
                        value={newSalary.child_allowance}
                        onChange={(e) => setNewSalary({ ...newSalary, child_allowance: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Istri</label>
                      <input
                        type="number"
                        value={newSalary.spouse_allowance}
                        onChange={(e) => setNewSalary({ ...newSalary, spouse_allowance: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Jabatan</label>
                      <input
                        type="number"
                        value={newSalary.position_allowance}
                        onChange={(e) => setNewSalary({ ...newSalary, position_allowance: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Makan</label>
                      <input
                        type="number"
                        value={newSalary.meal_allowance}
                        onChange={(e) => setNewSalary({ ...newSalary, meal_allowance: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Uang Lembur</label>
                      <input
                        type="number"
                        value={newSalary.overtime_pay}
                        onChange={(e) => setNewSalary({ ...newSalary, overtime_pay: e.target.value })}
                        className="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. BAGIAN POTONGAN (4 KOMPONEN) */}
                <div className="p-3 bg-white rounded-xl border border-rose-100 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-rose-50">
                    <span className="text-[11px] font-black uppercase text-rose-600 tracking-wider">
                      2. Potongan (4 Komponen)
                    </span>
                    <span className="text-[10px] font-bold text-rose-600">
                      Subtotal: Rp {calculateTotalDeductions(newSalary).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Potongan Makan</label>
                      <input
                        type="number"
                        value={newSalary.meal_deduction}
                        onChange={(e) => setNewSalary({ ...newSalary, meal_deduction: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Potongan Kehadiran</label>
                      <input
                        type="number"
                        value={newSalary.attendance_deduction}
                        onChange={(e) => setNewSalary({ ...newSalary, attendance_deduction: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[9px] font-bold text-slate-600">Pot. Kedisiplinan</label>
                        <span className="text-[8px] text-amber-600 font-bold" title="Toleransi 10 mnt, denda flat Rp 10.000">
                          (Denda)
                        </span>
                      </div>
                      <input
                        type="number"
                        value={newSalary.discipline_deduction}
                        onChange={(e) => setNewSalary({ ...newSalary, discipline_deduction: e.target.value })}
                        className="w-full bg-rose-50 border border-rose-300 text-rose-700 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setNewSalary({ ...newSalary, discipline_deduction: 10000 })}
                          className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 py-0.5 rounded"
                        >
                          1x (10rb)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSalary({ ...newSalary, discipline_deduction: 20000 })}
                          className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 py-0.5 rounded"
                        >
                          2x (20rb)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSalary({ ...newSalary, discipline_deduction: 0 })}
                          className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 py-0.5 rounded"
                        >
                          0
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Cash Bon</label>
                      <input
                        type="number"
                        value={newSalary.cash_bon}
                        onChange={(e) => setNewSalary({ ...newSalary, cash_bon: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Rilis & Total Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Status Rilis Slip</label>
                    <select
                      value={newSalary.is_released ? 'true' : 'false'}
                      onChange={(e) => setNewSalary({ ...newSalary, is_released: e.target.value === 'true' })}
                      className="w-full bg-white border rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="true">Rilis Terbuka (Staf bisa melihat &amp; unduh)</option>
                      <option value="false">Terkunci / Bergembok (Draft Finance)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-900 block">Total Gaji Bersih (THP):</span>
                      <span className="text-[9px] text-blue-700">Total Pendapatan - Total Potongan</span>
                    </div>
                    <span className="font-black text-base text-[#2563EB]">
                      Rp {calculateNetSalary(newSalary).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddingSalary(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black shadow-xs transition"
                  >
                    Simpan &amp; Terbitkan Slip
                  </button>
                </div>
              </form>
            )}

            {/* Filter Outlet */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold overflow-x-auto pb-1">
              <span className="text-slate-500">Filter Outlet:</span>
              {['all', 'LazyBloom', 'Deru Ombak', 'Sea Cafe'].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedOutletSalary(b)}
                  className={`px-3 py-1 rounded-full border transition shrink-0 ${
                    selectedOutletSalary === b
                      ? 'bg-[#2563EB] text-white border-[#2563EB] font-black shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {b === 'all' ? 'Semua Outlet' : b}
                </button>
              ))}
            </div>

            {/* Tabel Daftar Slip Gaji */}
            <div className="space-y-2">
              {salaryList.filter(
                (s) => selectedOutletSalary === 'all' || s.branch === selectedOutletSalary
              ).length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-700">Belum Ada Data Penggajian</h5>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Klik tombol "+ Buat &amp; Terbitkan Slip Gaji Baru" di atas untuk memproses gaji dan denda staf.
                  </p>
                </div>
              ) : (
                salaryList
                  .filter(
                    (s) => selectedOutletSalary === 'all' || s.branch === selectedOutletSalary
                  )
                  .map((slip) => (
                    <div
                      key={slip.id}
                      className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-300 transition shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-black text-slate-900">{slip.employee_name}</h5>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            {slip.branch}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">• {slip.period}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px]">
                          <span className="font-black text-sm text-[#2563EB]">
                            Rp {Number(slip.net_salary || 0).toLocaleString('id-ID')}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            (Gaji Pokok: Rp {Number(slip.basic_salary || 0).toLocaleString('id-ID')})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleRelease(slip.id, slip.is_released)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs ${
                            slip.is_released
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300'
                          }`}
                        >
                          {slip.is_released ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Rilis (Terbuka)</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-slate-500" />
                              <span>Terkunci (Draft)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
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
            {(outlets || []).map((outlet) => {
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
                    {outlet.coords?.radiusMeters || 50}m
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
