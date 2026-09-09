'use client';

import React, { useState, useEffect } from 'react';
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
import { formatRupiah, CurrencyInput, fetchEmployeeSalaries } from '@/lib/currency';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const currentYearNum = new Date().getFullYear();
const YEARS = [currentYearNum - 1, currentYearNum, currentYearNum + 1, currentYearNum + 2].map(String);

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
  const [employeesList, setEmployeesList] = useState([]);
  const [employeeSalaries, setEmployeeSalaries] = useState({});

  const [salaryMonth, setSalaryMonth] = useState(() => {
    const currentMonthIdx = new Date().getMonth();
    return MONTHS[currentMonthIdx] || 'September';
  });
  const [salaryYear, setSalaryYear] = useState(() => String(new Date().getFullYear()));

  const [newSalary, setNewSalary] = useState({
    employee_name: '',
    employee_id: null,
    branch: 'LazyBloom',
    period: `${MONTHS[new Date().getMonth()] || 'September'} ${new Date().getFullYear()}`,
    // 6 Komponen Pendapatan
    basic_salary: 0,
    child_allowance: 0,
    spouse_allowance: 0,
    position_allowance: 0,
    meal_allowance: 0,
    overtime_pay: 0,
    // 4 Komponen Potongan
    meal_deduction: 0,
    attendance_deduction: 0,
    discipline_deduction: 0,
    cash_bon: 0,
    is_released: true,
  });

  const [salaryList, setSalaryList] = useState([]);

  // Fetch real payslips & employees from Supabase on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        // 1. Muat karyawan (staf aktif)
        const { data: emps } = await supabase
          .from('employees')
          .select('id, full_name, branch, position, role')
          .eq('role', 'staff')
          .order('full_name', { ascending: true });
        if (emps) setEmployeesList(emps);

        // 2. Muat paket gaji karyawan
        const pkgs = await fetchEmployeeSalaries();
        setEmployeeSalaries(pkgs || {});

        // 3. Muat cache detail 10 komponen payslip
        let detailsMap = {};
        if (typeof window !== 'undefined') {
          try {
            detailsMap = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
          } catch (e) {}
        }
        try {
          const { data: detailRow } = await supabase
            .from('admin_settings')
            .select('description')
            .eq('role', 'payslips_detail')
            .single();
          if (detailRow && detailRow.description) {
            const remoteDetails = JSON.parse(detailRow.description);
            detailsMap = { ...detailsMap, ...remoteDetails };
            if (typeof window !== 'undefined') {
              localStorage.setItem('pwa_payslips_detail', JSON.stringify(detailsMap));
            }
          }
        } catch (e) {}

        // 4. Muat slip gaji yang pernah dibuat dari Supabase
        const { data, error } = await supabase
          .from('payslips')
          .select('*, employees(full_name, branch)')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped = data.map((p) => {
            const detail = detailsMap[p.id] || {};
            return {
              id: p.id,
              employee_id: p.employee_id,
              employee_name: p.employees?.full_name || detail.employee_name || 'Staf',
              branch: p.employees?.branch || detail.branch || 'LazyBloom',
              period: p.period,
              basic_salary: detail.basic_salary ?? p.basic_salary,
              child_allowance: detail.child_allowance ?? 0,
              spouse_allowance: detail.spouse_allowance ?? 0,
              position_allowance: detail.position_allowance ?? 0,
              meal_allowance: detail.meal_allowance ?? p.attendance_allowance ?? 0,
              overtime_pay: detail.overtime_pay ?? p.overtime_pay ?? 0,
              meal_deduction: detail.meal_deduction ?? 0,
              attendance_deduction: detail.attendance_deduction ?? 0,
              discipline_deduction: detail.discipline_deduction ?? 0,
              cash_bon: detail.cash_bon ?? p.deductions ?? 0,
              net_salary: p.net_salary,
              is_released: p.is_released,
              created_at: p.created_at,
            };
          });
          setSalaryList(mapped);
        } else if (Object.keys(detailsMap).length > 0) {
          // Fallback dari local cache jika ada
          setSalaryList(Object.values(detailsMap));
        }
      } catch (err) {
        console.warn('Fetch salaries error:', err);
      }
    }
    loadInitialData();

    // Listener sinkronisasi paket gaji otomatis saat diubah di Tabel Editor
    const handlePackageUpdate = () => {
      fetchEmployeeSalaries().then((pkgs) => setEmployeeSalaries(pkgs || {}));
    };
    window.addEventListener('pwa_salary_package_updated', handlePackageUpdate);
    return () => window.removeEventListener('pwa_salary_package_updated', handlePackageUpdate);
  }, []);

  // Handler saat outlet di form slip gaji berubah
  const handleBranchChange = (newBranch) => {
    const staffInBranch = employeesList.filter(
      (e) => e.branch && e.branch.toLowerCase() === newBranch.toLowerCase()
    );
    const firstStaff = staffInBranch[0];
    const pkg = firstStaff ? (employeeSalaries[firstStaff.id] || employeeSalaries[firstStaff.full_name] || null) : null;

    setNewSalary((prev) => ({
      ...prev,
      branch: newBranch,
      employee_name: firstStaff ? firstStaff.full_name : '',
      employee_id: firstStaff ? firstStaff.id : null,
      basic_salary: pkg?.basic_salary ?? 0,
      child_allowance: pkg?.child_allowance ?? 0,
      spouse_allowance: pkg?.spouse_allowance ?? 0,
      position_allowance: pkg?.position_allowance ?? 0,
      meal_allowance: pkg?.meal_allowance ?? 0,
      overtime_pay: 0,
    }));
  };

  // Handler saat nama karyawan di dropdown form slip gaji dipilih
  const handleSelectEmployee = (empName) => {
    const staff = employeesList.find((e) => e.full_name === empName);
    const pkg = staff ? (employeeSalaries[staff.id] || employeeSalaries[staff.full_name] || null) : null;

    setNewSalary((prev) => ({
      ...prev,
      employee_name: empName,
      employee_id: staff?.id || null,
      branch: staff?.branch || prev.branch,
      basic_salary: pkg?.basic_salary ?? 0,
      child_allowance: pkg?.child_allowance ?? 0,
      spouse_allowance: pkg?.spouse_allowance ?? 0,
      position_allowance: pkg?.position_allowance ?? 0,
      meal_allowance: pkg?.meal_allowance ?? 0,
      // Overtime tetap tersimpan agar Admin Finance bisa memasukkannya
    }));
  };

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

    // Cari objek karyawan terpilih
    const targetEmployee = employeesList.find(
      (emp) => emp.id === newSalary.employee_id || emp.full_name === newSalary.employee_name
    );

    if (!targetEmployee) {
      setSalaryMsg({ type: 'error', text: 'Pilih nama karyawan terlebih dahulu.' });
      return;
    }

    const net = calculateNetSalary(newSalary);
    const totalDeductions = calculateTotalDeductions(newSalary);
    const totalAllowances =
      Number(newSalary.child_allowance || 0) +
      Number(newSalary.spouse_allowance || 0) +
      Number(newSalary.position_allowance || 0);

    let savedId = `sal_${Date.now()}`;
    let remoteCreated = null;

    try {
      // 1. Simpan ke tabel payslips resmi di Supabase
      const { data: inserted, error: insertErr } = await supabase
        .from('payslips')
        .insert({
          employee_id: targetEmployee.id,
          period: newSalary.period,
          basic_salary: Number(newSalary.basic_salary || 0),
          attendance_allowance: Number(newSalary.meal_allowance || 0),
          transport_allowance: totalAllowances,
          overtime_pay: Number(newSalary.overtime_pay || 0),
          deductions: totalDeductions,
          net_salary: net,
          is_released: Boolean(newSalary.is_released),
        })
        .select('*, employees(full_name, branch)')
        .single();

      if (!insertErr && inserted) {
        savedId = inserted.id;
        remoteCreated = inserted.created_at;
      } else if (insertErr) {
        console.warn('Supabase payslips insert error:', insertErr);
      }
    } catch (err) {
      console.warn('Payslip sync catch error:', err);
    }

    const item = {
      id: savedId,
      employee_id: targetEmployee.id,
      employee_name: targetEmployee.full_name,
      branch: targetEmployee.branch || newSalary.branch,
      period: newSalary.period,
      basic_salary: Number(newSalary.basic_salary || 0),
      child_allowance: Number(newSalary.child_allowance || 0),
      spouse_allowance: Number(newSalary.spouse_allowance || 0),
      position_allowance: Number(newSalary.position_allowance || 0),
      meal_allowance: Number(newSalary.meal_allowance || 0),
      overtime_pay: Number(newSalary.overtime_pay || 0),
      meal_deduction: Number(newSalary.meal_deduction || 0),
      attendance_deduction: Number(newSalary.attendance_deduction || 0),
      discipline_deduction: Number(newSalary.discipline_deduction || 0),
      cash_bon: Number(newSalary.cash_bon || 0),
      net_salary: net,
      is_released: Boolean(newSalary.is_released),
      created_at: remoteCreated || new Date().toISOString(),
    };

    // 2. Simpan rincian 10 komponen ke persistent cache (localStorage & cloud admin_settings)
    try {
      let savedDetails = {};
      if (typeof window !== 'undefined') {
        savedDetails = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
      }
      savedDetails[savedId] = item;
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa_payslips_detail', JSON.stringify(savedDetails));
      }

      await supabase.from('admin_settings').upsert(
        {
          role: 'payslips_detail',
          pin: '000000',
          name: 'Detail Komponen Payslips',
          description: JSON.stringify(savedDetails),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'role' }
      );
    } catch (e) {
      console.warn('Save persistent payslip details fallback:', e);
    }

    setSalaryList((prev) => [item, ...prev.filter((s) => s.id !== savedId)]);
    setIsAddingSalary(false);
    setSalaryMsg({
      type: 'success',
      text: `Slip gaji ${item.employee_name} (${item.period}) berhasil disimpan & dihitung bersih!`,
    });
    setTimeout(() => setSalaryMsg({ type: '', text: '' }), 4000);
  };

  const handleToggleRelease = async (id) => {
    const targetSlip = salaryList.find((s) => s.id === id);
    if (!targetSlip) return;
    const newStatus = !targetSlip.is_released;

    setSalaryList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_released: newStatus } : s))
    );

    // Update di Supabase tabel payslips
    try {
      await supabase.from('payslips').update({ is_released: newStatus }).eq('id', id);
    } catch (e) {
      console.warn('Update payslip release status error:', e);
    }

    // Update di persistent cache
    try {
      let savedDetails = {};
      if (typeof window !== 'undefined') {
        savedDetails = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
      }
      if (savedDetails[id]) {
        savedDetails[id].is_released = newStatus;
        if (typeof window !== 'undefined') {
          localStorage.setItem('pwa_payslips_detail', JSON.stringify(savedDetails));
        }
        await supabase.from('admin_settings').upsert(
          {
            role: 'payslips_detail',
            pin: '000000',
            name: 'Detail Komponen Payslips',
            description: JSON.stringify(savedDetails),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'role' }
        );
      }
    } catch (e) {}
  };

  const toggleSalaryRelease = handleToggleRelease;

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
                              const staff = employeesList.find((e) => e.full_name === ot.employee_name);
                              const pkg = staff ? (employeeSalaries[staff.id] || employeeSalaries[staff.full_name] || null) : null;
                              setNewSalary((prev) => ({
                                ...prev,
                                employee_name: ot.employee_name,
                                employee_id: staff?.id || null,
                                branch: ot.branch || prev.branch,
                                overtime_pay: Number(ot.nominal || 0),
                                basic_salary: pkg?.basic_salary ?? prev.basic_salary,
                                child_allowance: pkg?.child_allowance ?? prev.child_allowance,
                                spouse_allowance: pkg?.spouse_allowance ?? prev.spouse_allowance,
                                position_allowance: pkg?.position_allowance ?? prev.position_allowance,
                                meal_allowance: pkg?.meal_allowance ?? prev.meal_allowance,
                              }));
                              setIsAddingSalary(true);
                            }}
                            title="Salin data ke Form Slip Gaji"
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
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
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold cursor-pointer"
                    >
                      <option value="LazyBloom">LazyBloom</option>
                      <option value="Deru Ombak">Deru Ombak</option>
                      <option value="Sea Cafe">Sea Cafe</option>
                      <option value="Mobile / Lapangan">Mobile / Lapangan</option>
                    </select>
                  </div>
                  <div>
                    {(() => {
                      const filteredStaff = employeesList.filter(
                        (e) => e.branch && e.branch.toLowerCase() === newSalary.branch.toLowerCase()
                      );
                      return (
                        <>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            Nama Karyawan ({filteredStaff.length} Staf)
                          </label>
                          <select
                            value={newSalary.employee_name}
                            onChange={(e) => handleSelectEmployee(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold cursor-pointer"
                            required
                          >
                            <option value="">-- Pilih Karyawan {newSalary.branch} --</option>
                            {filteredStaff.map((emp) => (
                              <option key={emp.id} value={emp.full_name}>
                                {emp.full_name} ({emp.position || 'Staff'})
                              </option>
                            ))}
                          </select>
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Periode Slip</label>
                    <div className="grid grid-cols-2 gap-1">
                      <select
                        value={salaryMonth}
                        onChange={(e) => {
                          setSalaryMonth(e.target.value);
                          setNewSalary((prev) => ({ ...prev, period: `${e.target.value} ${salaryYear}` }));
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-semibold cursor-pointer"
                      >
                        {MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={salaryYear}
                        onChange={(e) => {
                          setSalaryYear(e.target.value);
                          setNewSalary((prev) => ({ ...prev, period: `${salaryMonth} ${e.target.value}` }));
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-semibold cursor-pointer"
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {newSalary.employee_name && (
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-[10px] text-blue-900 flex items-center justify-between">
                    <span>
                      ✨ Paket gaji otomatis terisi dari data karyawan. Admin Finance cukup menginput <strong>Lembur</strong>.
                    </span>
                    <span className="font-bold text-blue-700">{newSalary.employee_name}</span>
                  </div>
                )}

                {/* 1. BAGIAN PENDAPATAN (6 KOMPONEN) */}
                <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-blue-50">
                    <span className="text-[11px] font-black uppercase text-[#2563EB] tracking-wider">
                      1. Penghasilan / Pendapatan (6 Komponen)
                    </span>
                    <span className="text-[10px] font-bold text-[#2563EB]">
                      Subtotal: {formatRupiah(calculateTotalIncome(newSalary))}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Gaji Pokok</label>
                      <CurrencyInput
                        value={newSalary.basic_salary}
                        onChange={(val) => setNewSalary({ ...newSalary, basic_salary: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                        placeholder="Rp 0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Anak</label>
                      <CurrencyInput
                        value={newSalary.child_allowance}
                        onChange={(val) => setNewSalary({ ...newSalary, child_allowance: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Istri</label>
                      <CurrencyInput
                        value={newSalary.spouse_allowance}
                        onChange={(val) => setNewSalary({ ...newSalary, spouse_allowance: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Jabatan</label>
                      <CurrencyInput
                        value={newSalary.position_allowance}
                        onChange={(val) => setNewSalary({ ...newSalary, position_allowance: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Tunjangan Makan</label>
                      <CurrencyInput
                        value={newSalary.meal_allowance}
                        onChange={(val) => setNewSalary({ ...newSalary, meal_allowance: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Uang Lembur</label>
                      <CurrencyInput
                        value={newSalary.overtime_pay}
                        onChange={(val) => setNewSalary({ ...newSalary, overtime_pay: val })}
                        className="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg px-2 py-1 text-xs font-bold"
                        placeholder="Rp 0"
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
                      Subtotal: {formatRupiah(calculateTotalDeductions(newSalary))}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Potongan Makan</label>
                      <CurrencyInput
                        value={newSalary.meal_deduction}
                        onChange={(val) => setNewSalary({ ...newSalary, meal_deduction: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Potongan Kehadiran</label>
                      <CurrencyInput
                        value={newSalary.attendance_deduction}
                        onChange={(val) => setNewSalary({ ...newSalary, attendance_deduction: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[9px] font-bold text-slate-600">Pot. Kedisiplinan</label>
                        <span className="text-[8px] text-amber-600 font-bold" title="Toleransi 10 mnt, denda flat Rp 10.000">
                          (Denda)
                        </span>
                      </div>
                      <CurrencyInput
                        value={newSalary.discipline_deduction}
                        onChange={(val) => setNewSalary({ ...newSalary, discipline_deduction: val })}
                        className="w-full bg-rose-50 border border-rose-300 text-rose-700 rounded-lg px-2 py-1 text-xs font-bold"
                        placeholder="Rp 0"
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setNewSalary({ ...newSalary, discipline_deduction: 10000 })}
                          className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 py-0.5 rounded cursor-pointer"
                        >
                          1x (10rb)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSalary({ ...newSalary, discipline_deduction: 20000 })}
                          className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 py-0.5 rounded cursor-pointer"
                        >
                          2x (20rb)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSalary({ ...newSalary, discipline_deduction: 0 })}
                          className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 py-0.5 rounded cursor-pointer"
                        >
                          0
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Cash Bon</label>
                      <CurrencyInput
                        value={newSalary.cash_bon}
                        onChange={(val) => setNewSalary({ ...newSalary, cash_bon: val })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                        placeholder="Rp 0"
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
