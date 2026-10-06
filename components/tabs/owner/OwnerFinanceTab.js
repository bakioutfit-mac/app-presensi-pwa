'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/currency';
import {
  CheckCircle2,
  Receipt,
  AlertCircle,
  RefreshCw,
  Briefcase,
  FileText,
  Banknote,
  CalendarCheck,
  UserCheck,
  X,
  TrendingUp,
  Calendar,
  ChevronUp,
  ChevronDown,
  Printer,
  Copy,
  Clock,
  ShieldCheck,
  Building2,
  Filter,
  Check,
} from 'lucide-react';
import PayslipPrintModal from '@/components/PayslipPrintModal';
import FinanceAttendanceAuditTab from '@/components/tabs/finance/FinanceAttendanceAuditTab';

export default function OwnerFinanceTab({ user, onBack, showToast }) {
  const [subTab, setSubTab] = useState('gaji'); // 'gaji', 'hadir', 'revenue'
  const [salaryList, setSalaryList] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [overtimesList, setOvertimesList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedOutlet, setSelectedOutlet] = useState('all');

  // Accordion state
  const [openSlipId, setOpenSlipId] = useState(null);

  // Modal Cetak Slip
  const [printModalData, setPrintModalData] = useState({
    open: false,
    slip: null,
    targetUser: null,
    approvedOts: [],
    rejectedOts: [],
  });

  // Salin nomor rekening ke clipboard
  const handleCopyAccount = (accountNumber) => {
    if (!accountNumber) return;
    navigator.clipboard.writeText(accountNumber);
    if (showToast) showToast('success', `Nomor rekening disalin: ${accountNumber}`);
  };

  // Toggle status pembayaran (Paid / Pending) oleh Owner
  const handleTogglePaid = async (slipId, currentPaidStatus) => {
    const newPaidStatus = !currentPaidStatus;
    try {
      // 1. Update tabel payslips Supabase jika ada id UUID
      if (slipId && typeof slipId === 'string' && slipId.includes('-')) {
        await supabase
          .from('payslips')
          .update({ is_paid: newPaidStatus })
          .eq('id', slipId);
      }

      // 2. Update persistent cache admin_settings payslips_detail
      try {
        let detailsMap = {};
        if (typeof window !== 'undefined') {
          detailsMap = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
          if (detailsMap[slipId]) {
            detailsMap[slipId].is_paid = newPaidStatus;
            localStorage.setItem('pwa_payslips_detail', JSON.stringify(detailsMap));
          }
        }
        const { data: detailRow } = await supabase
          .from('admin_settings')
          .select('description')
          .eq('role', 'payslips_detail')
          .maybeSingle();
        if (detailRow?.description) {
          const remoteMap = JSON.parse(detailRow.description);
          if (remoteMap[slipId]) {
            remoteMap[slipId].is_paid = newPaidStatus;
            await supabase
              .from('admin_settings')
              .update({
                description: JSON.stringify(remoteMap),
                updated_at: new Date().toISOString(),
              })
              .eq('role', 'payslips_detail');
          }
        }
      } catch (e) {
        console.warn('Update payslip detail is_paid error:', e);
      }

      // Update state lokal
      setSalaryList((prev) =>
        prev.map((s) => (s.id === slipId ? { ...s, is_paid: newPaidStatus } : s))
      );

      if (showToast) {
        showToast(
          'success',
          newPaidStatus
            ? 'Gaji berhasil ditandai Terbayar (Lunas).'
            : 'Status Terbayar dibatalkan (Pending).'
        );
      }
    } catch (err) {
      if (showToast) showToast('error', 'Gagal memperbarui status: ' + err.message);
    }
  };

  // Fetch seluruh data keuangan
  const fetchData = async () => {
    setLoading(true);
    try {
      if (subTab === 'gaji') {
        // 1. Ambil detail komponen dari admin_settings (payslips_detail) & localStorage
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
            .maybeSingle();
          if (detailRow?.description) {
            const remoteDetails = JSON.parse(detailRow.description);
            detailsMap = { ...detailsMap, ...remoteDetails };
          }
        } catch (e) {}

        // 2. Ambil master employees
        let empsList = [];
        try {
          const { data: emps, error: empErr } = await supabase
            .from('employees')
            .select('*')
            .order('full_name', { ascending: true });
          if (!empErr && emps) {
            empsList = emps;
            setEmployeeList(emps);
          }
        } catch (e) {}

        const empMapById = {};
        const empMapByName = {};
        empsList.forEach((e) => {
          if (e.id) empMapById[e.id] = e;
          if (e.full_name) empMapByName[e.full_name.toLowerCase().trim()] = e;
        });

        // 3. Ambil lembur
        try {
          const { data: ots } = await supabase.from('overtimes').select('*');
          if (ots) setOvertimesList(ots);
        } catch (e) {}

        // 4. Query tabel payslips dari Supabase
        let dbSlips = [];
        try {
          const { data: slips, error: slipErr } = await supabase
            .from('payslips')
            .select('*')
            .order('created_at', { ascending: false });
          if (!slipErr && slips) {
            dbSlips = slips;
          }
        } catch (e) {}

        // 5. Kumpulkan hanya slip yang SUDAH DIRILIS oleh Finance (is_released === true)
        const rawCombined = [];

        // Masukkan dari tabel dbSlips
        dbSlips.forEach((p) => {
          const detail = detailsMap[p.id] || {};
          const matchedEmp =
            empMapById[p.employee_id] ||
            empMapByName[(detail.employee_name || '').toLowerCase().trim()];

          // ATURAN SINKRONISASI: Jika belum dirilis oleh Finance, TIDAK MUNCUL DI OWNER
          const isReleased =
            detail.is_released !== undefined
              ? Boolean(detail.is_released)
              : Boolean(p.is_released);
          if (!isReleased) return;

          rawCombined.push({
            id: p.id,
            employee_id: p.employee_id,
            employee_name: matchedEmp?.full_name || detail.employee_name || 'Staf',
            branch: matchedEmp?.branch || detail.branch || 'LazyBloom',
            position: matchedEmp?.position || detail.position || 'Staf Operasional',
            bank_name: matchedEmp?.bank_name || detail.bank_name || '',
            bank_account: matchedEmp?.bank_account || detail.bank_account || '',
            period: p.period,
            period_range: p.period_range || detail.period_range || p.period,
            payment_date: p.payment_date || detail.payment_date || '',
            basic_salary: Number(detail.basic_salary ?? p.basic_salary ?? 0),
            child_allowance: Number(detail.child_allowance ?? 0),
            spouse_allowance: Number(detail.spouse_allowance ?? 0),
            position_allowance: Number(detail.position_allowance ?? 0),
            meal_allowance: Number(detail.meal_allowance ?? p.attendance_allowance ?? 0),
            discipline_allowance: Number(detail.discipline_allowance ?? 0),
            overtime_pay: Number(detail.overtime_pay ?? p.overtime_pay ?? 0),
            plus_day_count: Number(detail.plus_day_count ?? p.plus_day_count ?? 0),
            plus_day_pay: Number(detail.plus_day_pay ?? p.plus_day_pay ?? 0),
            plus_day_note: detail.plus_day_note ?? p.plus_day_note ?? '',
            meal_deduction: Number(detail.meal_deduction ?? 0),
            attendance_deduction: Number(detail.attendance_deduction ?? 0),
            discipline_deduction: Number(detail.discipline_deduction ?? 0),
            cash_bon: Number(detail.cash_bon ?? p.deductions ?? 0),
            net_salary: Number(detail.net_salary ?? p.net_salary ?? 0),
            is_released: true,
            is_paid: Boolean(p.is_paid !== undefined ? p.is_paid : detail.is_paid),
            created_at: p.created_at || new Date().toISOString(),
          });
        });

        // Masukkan juga dari cache detailsMap jika belum ada di rawCombined
        for (const [id, item] of Object.entries(detailsMap)) {
          // ATURAN SINKRONISASI: Lewati jika belum dirilis oleh Finance
          const isReleased = Boolean(item.is_released);
          if (!isReleased) continue;

          const matchedEmp =
            empMapById[item.employee_id] ||
            empMapByName[(item.employee_name || '').toLowerCase().trim()];

          const alreadyInList = rawCombined.some(
            (r) =>
              r.id === id ||
              (r.employee_id &&
                item.employee_id &&
                r.employee_id === item.employee_id &&
                (r.period || '').toLowerCase().trim() ===
                  (item.period || '').toLowerCase().trim())
          );

          if (!alreadyInList) {
            rawCombined.push({
              id: item.id || id,
              employee_id: item.employee_id || matchedEmp?.id,
              employee_name: item.employee_name || matchedEmp?.full_name || 'Staf',
              branch: item.branch || matchedEmp?.branch || 'LazyBloom',
              position: matchedEmp?.position || item.position || 'Staf Operasional',
              bank_name: matchedEmp?.bank_name || item.bank_name || '',
              bank_account: matchedEmp?.bank_account || item.bank_account || '',
              period: item.period,
              period_range: item.period_range || item.period,
              payment_date: item.payment_date || '',
              basic_salary: Number(item.basic_salary ?? 0),
              child_allowance: Number(item.child_allowance ?? 0),
              spouse_allowance: Number(item.spouse_allowance ?? 0),
              position_allowance: Number(item.position_allowance ?? 0),
              meal_allowance: Number(item.meal_allowance ?? 0),
              discipline_allowance: Number(item.discipline_allowance ?? 0),
              overtime_pay: Number(item.overtime_pay ?? 0),
              plus_day_count: Number(item.plus_day_count ?? 0),
              plus_day_pay: Number(item.plus_day_pay ?? 0),
              plus_day_note: item.plus_day_note ?? '',
              meal_deduction: Number(item.meal_deduction ?? 0),
              attendance_deduction: Number(item.attendance_deduction ?? 0),
              discipline_deduction: Number(item.discipline_deduction ?? 0),
              cash_bon: Number(item.cash_bon ?? 0),
              net_salary: Number(item.net_salary ?? 0),
              is_released: true,
              is_paid: Boolean(item.is_paid),
              created_at: item.created_at || new Date().toISOString(),
            });
          }
        }

        // 6. Deduplikasi per staf & periode
        const uniqueList = [];
        const seenCombo = new Set();
        rawCombined.forEach((slip) => {
          const empIdent = (slip.employee_id || slip.employee_name || '').toLowerCase().trim();
          const periodIdent = (slip.period || '').toLowerCase().trim();
          const key = `${empIdent}___${periodIdent}`;
          if (!seenCombo.has(key)) {
            seenCombo.add(key);
            uniqueList.push(slip);
          }
        });

        uniqueList.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        setSalaryList(uniqueList);
      }
    } catch (err) {
      if (showToast) showToast('error', 'Gagal memuat data finance: ' + err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'gaji') {
      fetchData();
    }
  }, [subTab]);

  // Daftar periode yang ada di slip rilis
  const availablePeriods = useMemo(() => {
    const set = new Set();
    salaryList.forEach((s) => {
      if (s.period) set.add(s.period);
    });
    return Array.from(set);
  }, [salaryList]);

  // Filter slip berdasarkan periode dan outlet
  const filteredSalaries = useMemo(() => {
    return salaryList.filter((slip) => {
      const matchPeriod =
        selectedPeriod === 'all' ||
        (slip.period || '').toLowerCase().trim() === selectedPeriod.toLowerCase().trim();
      const matchOutlet =
        selectedOutlet === 'all' ||
        (slip.branch && slip.branch.toLowerCase().trim() === selectedOutlet.toLowerCase().trim());
      return matchPeriod && matchOutlet;
    });
  }, [salaryList, selectedPeriod, selectedOutlet]);

  // KPI Ringkasan
  const totalNet = useMemo(() => {
    return filteredSalaries.reduce((sum, s) => sum + (Number(s.net_salary) || 0), 0);
  }, [filteredSalaries]);

  const totalPaid = useMemo(() => {
    return filteredSalaries
      .filter((s) => s.is_paid)
      .reduce((sum, s) => sum + (Number(s.net_salary) || 0), 0);
  }, [filteredSalaries]);

  const totalPending = useMemo(() => {
    return filteredSalaries
      .filter((s) => !s.is_paid)
      .reduce((sum, s) => sum + (Number(s.net_salary) || 0), 0);
  }, [filteredSalaries]);

  const toggleAccordion = (slipId) => {
    setOpenSlipId((prev) => (prev === slipId ? null : slipId));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* ================= HEADER OWNER FINANCE ================= */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-xs transition cursor-pointer shrink-0"
            title="Kembali ke Dashboard Utama"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
              <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
              <span className="truncate">Finance Overview (Owner)</span>
            </h2>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 truncate">
              Sinkronisasi Gaji Rilis Finance &amp; Audit Cut-Off Kehadiran
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading || subTab !== 'gaji'}
          className="p-2 sm:p-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer disabled:opacity-50 shrink-0"
          title="Segarkan Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ================= SUB-TABS NAVIGASI ================= */}
      <div className="grid grid-cols-3 gap-1 bg-white rounded-2xl p-1 sm:p-1.5 border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => setSubTab('gaji')}
          className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center ${
            subTab === 'gaji'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Gaji Rilis</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('hadir')}
          className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center ${
            subTab === 'hadir'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Daftar Hadir</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('revenue')}
          className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center ${
            subTab === 'revenue'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Revenue</span>
        </button>
      </div>

      {/* ================= KONTEN SUB-TAB GAJI ================= */}
      {subTab === 'gaji' && (
        <div className="space-y-3 sm:space-y-3.5">
          {/* Filter Bar: Periode & Outlet */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer truncate"
                >
                  <option value="all">Semua Periode</option>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer truncate"
                >
                  <option value="all">Semua Cabang</option>
                  <option value="LazyBloom">LazyBloom</option>
                  <option value="Deru Ombak">Deru Ombak</option>
                  <option value="Sea Cafe">Sea Cafe</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold pt-1.5 border-t border-slate-100">
              <span>Status Rilis Finance:</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-black">
                {filteredSalaries.length} Slip Rilis
              </span>
            </div>
          </div>

          {/* Ringkasan Finansial KPI (Mobile Master Card & Desktop 3-Card Grid) */}
          {/* Mobile Master Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2.5 sm:hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Beban Gaji Resmi
                </span>
                <span className="text-base font-black text-slate-900 block mt-0.5">
                  {formatRupiah(totalNet)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Slip</span>
                <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  {filteredSalaries.length} Staf
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80">
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800">
                  <span>Terbayar</span>
                  <span className="bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded font-black text-[9px]">
                    {filteredSalaries.filter((s) => s.is_paid).length} Lunas
                  </span>
                </div>
                <span className="text-xs font-black text-emerald-700 block mt-1 truncate">
                  {formatRupiah(totalPaid)}
                </span>
              </div>

              <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80">
                <div className="flex items-center justify-between text-[10px] font-bold text-amber-800">
                  <span>Pending</span>
                  <span className="bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded font-black text-[9px]">
                    {filteredSalaries.filter((s) => !s.is_paid).length} Belum
                  </span>
                </div>
                <span className="text-xs font-black text-amber-700 block mt-1 truncate">
                  {formatRupiah(totalPending)}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop 3-Card Grid */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Total Rilis</span>
              <span className="text-base font-black text-slate-900 block mt-0.5">
                {formatRupiah(totalNet)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Beban Gaji Resmi</span>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Terbayar</span>
                <span className="text-[9px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.2 rounded font-black">
                  {filteredSalaries.filter((s) => s.is_paid).length} Lunas
                </span>
              </div>
              <span className="text-base font-black text-emerald-700 block mt-0.5">
                {formatRupiah(totalPaid)}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">Dana Ditransfer</span>
            </div>

            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending</span>
                <span className="text-[9px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-black">
                  {filteredSalaries.filter((s) => !s.is_paid).length} Belum
                </span>
              </div>
              <span className="text-base font-black text-amber-700 block mt-0.5">
                {formatRupiah(totalPending)}
              </span>
              <span className="text-[10px] text-amber-600 font-medium">Menunggu Transfer</span>
            </div>
          </div>

          {/* ================= DAFTAR SLIP GAJI RILIS (PERSIS TAMPILAN STAF) ================= */}
          {loading ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">Menyinkronkan data slip gaji rilis...</p>
            </div>
          ) : filteredSalaries.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-[#2563EB]">
                <Banknote className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Belum Ada Slip Gaji yang Dirilis</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Slip gaji dari Admin Finance belum ada yang berstatus <strong>Dirilis</strong> untuk filter ini. Slip gaji staf hanya akan tampil di sini setelah Admin Finance merilisnya.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSalaries.map((slip) => {
                const isOpen = openSlipId === slip.id;

                // Hitung total pendapatan & potongan rincian persis seperti di akun staf
                const totalIncome =
                  (Number(slip.basic_salary) || 0) +
                  (Number(slip.child_allowance) || 0) +
                  (Number(slip.spouse_allowance) || 0) +
                  (Number(slip.position_allowance) || 0) +
                  (Number(slip.meal_allowance) || 0) +
                  (Number(slip.discipline_allowance) || 0) +
                  (Number(slip.overtime_pay) || 0) +
                  (Number(slip.plus_day_pay) || 0);

                const totalDeductions =
                  (Number(slip.meal_deduction) || 0) +
                  (Number(slip.attendance_deduction) || 0) +
                  (Number(slip.discipline_deduction) || 0) +
                  (Number(slip.cash_bon) || 0);

                const empOtsApproved = overtimesList.filter((ot) => {
                  const matchEmp =
                    (slip.employee_id && ot.employee_id === slip.employee_id) ||
                    ot.employee_name === slip.employee_name;
                  return matchEmp && ot.status === 'Disetujui Finance';
                });

                const empOtsRejected = overtimesList.filter((ot) => {
                  const matchEmp =
                    (slip.employee_id && ot.employee_id === slip.employee_id) ||
                    ot.employee_name === slip.employee_name;
                  return matchEmp && ot.status === 'Ditolak Finance';
                });

                return (
                  <div
                    key={slip.id}
                    className={`rounded-2xl border transition-all overflow-hidden bg-white ${
                      isOpen
                        ? 'border-blue-400 shadow-md ring-1 ring-blue-400/20'
                        : 'border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Header Slip (Informasi Karyawan & Status Pembayaran Owner) */}
                    <div className="p-3.5 sm:p-4 border-b border-slate-100 space-y-2.5">
                      {/* Baris 1: Checklist Paid, Nama & Cabang, Status Pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Tombol Checklist Paid/Pending untuk Owner */}
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(slip.id, slip.is_paid)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition cursor-pointer mt-0.5 ${
                              slip.is_paid
                                ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                                : 'bg-white border-slate-300 text-slate-300 hover:border-slate-400 hover:text-slate-400'
                            }`}
                            title={slip.is_paid ? 'Klik untuk batalkan status Lunas' : 'Klik untuk tandai Gaji Lunas Terbayar'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                                {slip.employee_name}
                              </h4>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                {slip.branch}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                              {slip.position} &bull; Periode: <strong className="text-slate-700">{slip.period}</strong>
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            slip.is_paid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {slip.is_paid ? 'Paid (Lunas)' : 'Pending'}
                        </span>
                      </div>

                      {/* Baris 2: Info Rekening Bank & Salin */}
                      <div className="flex items-center justify-between bg-slate-50/90 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-[10px]">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold uppercase text-[9px] shrink-0">
                            {slip.bank_name || 'Bank?'}
                          </span>
                          <span className="font-mono text-slate-800 font-semibold truncate">
                            {slip.bank_account || '-'}
                          </span>
                        </div>
                        {slip.bank_account && (
                          <button
                            type="button"
                            onClick={() => handleCopyAccount(slip.bank_account)}
                            className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer flex items-center gap-1 text-[9px] font-bold shrink-0 ml-1.5 transition active:scale-95"
                            title="Salin nomor rekening"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </button>
                        )}
                      </div>

                      {/* Baris 3: Nominal Gaji Bersih (THP) & Tombol Accordion */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                            Gaji Bersih (THP)
                          </span>
                          <p className="text-xs sm:text-sm font-black text-emerald-600 leading-tight">
                            {formatRupiah(slip.net_salary)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleAccordion(slip.id)}
                          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 text-[11px] font-bold cursor-pointer ${
                            isOpen
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{isOpen ? 'Tutup' : 'Rincian'}</span>
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* ================= BODY RINCIAN 11 KOMPONEN (PERSIS TAMPILAN STAF) ================= */}
                    {isOpen && (
                      <div className="p-4 pt-3 space-y-3.5 bg-gradient-to-b from-white to-slate-50/50 animate-in fade-in duration-200">
                        {/* Header Cut-Off & Tanggal */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-dashed border-slate-200">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {slip.period_range || slip.period}
                          </span>
                          <span>Tgl Terbit: {slip.payment_date || 'Resmi Terbit'}</span>
                        </div>

                        {/* 1. Komponen Pendapatan */}
                        <div className="space-y-1.5 p-3 bg-blue-50/40 border border-blue-100 rounded-xl">
                          <div className="flex justify-between items-center pb-1 border-b border-blue-100/60">
                            <span className="text-[10px] font-black uppercase text-[#2563EB] tracking-wider">
                              1. Penghasilan / Pendapatan
                            </span>
                            <span className="text-[10px] font-bold text-[#2563EB]">
                              Subtotal: {formatRupiah(totalIncome)}
                            </span>
                          </div>

                          <div className="flex justify-between text-xs text-slate-700 pt-1">
                            <span>Gaji Pokok</span>
                            <span className="font-semibold">{formatRupiah(slip.basic_salary)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>Tunjangan Anak</span>
                            <span className="font-semibold">{formatRupiah(slip.child_allowance)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>Tunjangan Istri</span>
                            <span className="font-semibold">{formatRupiah(slip.spouse_allowance)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>Tunjangan Jabatan</span>
                            <span className="font-semibold">{formatRupiah(slip.position_allowance)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>Tunjangan Makan</span>
                            <span className="font-semibold">{formatRupiah(slip.meal_allowance)}</span>
                          </div>
                          {Number(slip.discipline_allowance || 0) > 0 && (
                            <div className="flex justify-between text-xs text-slate-700">
                              <span>Tunjangan Kedisiplinan</span>
                              <span className="font-semibold">{formatRupiah(slip.discipline_allowance)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>Uang Lembur</span>
                            <span className="font-semibold text-emerald-600">
                              +{formatRupiah(slip.overtime_pay)}
                            </span>
                          </div>

                          {(Number(slip.plus_day_pay) > 0 || Number(slip.plus_day_count) > 0) && (
                            <div className="flex justify-between text-xs text-slate-700 pt-1 border-t border-blue-100/60">
                              <div>
                                <span className="font-bold text-blue-900">Perbantuan (+Day)</span>
                                <span className="text-[10px] text-blue-600 block font-medium">
                                  {slip.plus_day_count || 0} Hari {slip.plus_day_note ? `• ${slip.plus_day_note}` : ''}
                                </span>
                              </div>
                              <span className="font-semibold text-emerald-600">
                                +{formatRupiah(slip.plus_day_pay)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 2. Komponen Potongan */}
                        <div className="space-y-1.5 p-3 bg-rose-50/40 border border-rose-100 rounded-xl">
                          <div className="flex justify-between items-center pb-1 border-b border-rose-100/60">
                            <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">
                              2. Potongan
                            </span>
                            <span className="text-[10px] font-bold text-rose-600">
                              Subtotal: -{formatRupiah(totalDeductions)}
                            </span>
                          </div>

                          <div className="flex justify-between text-xs text-slate-700 pt-1">
                            <span>Potongan Makan</span>
                            <span className="font-semibold text-rose-600">-{formatRupiah(slip.meal_deduction)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>Potongan Kehadiran</span>
                            <span className="font-semibold text-rose-600">-{formatRupiah(slip.attendance_deduction)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-700">
                            <span className="flex items-center gap-1">
                              <span>Potongan Kedisiplinan</span>
                              {slip.discipline_deduction > 0 && (
                                <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-bold">
                                  Denda Terlambat
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-rose-600">-{formatRupiah(slip.discipline_deduction)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>Cash Bon</span>
                            <span className="font-semibold text-rose-600">-{formatRupiah(slip.cash_bon)}</span>
                          </div>
                        </div>

                        {/* Total Net Salary */}
                        <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex justify-between items-center">
                          <div>
                            <span className="font-black text-xs text-slate-900 block">
                              Total Gaji Bersih (Take Home Pay)
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Total Pendapatan - Total Potongan
                            </span>
                          </div>
                          <span className="font-black text-base text-[#2563EB]">
                            {formatRupiah(slip.net_salary)}
                          </span>
                        </div>

                        {/* Tombol Cetak Dokumen PDF Resmi */}
                        <div className="pt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPrintModalData({
                                open: true,
                                slip,
                                targetUser: {
                                  full_name: slip.employee_name,
                                  branch: slip.branch,
                                  position: slip.position,
                                  employee_id: slip.employee_id,
                                },
                                approvedOts: empOtsApproved,
                                rejectedOts: empOtsRejected,
                              })
                            }
                            className="flex-1 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-98 transition cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Cetak / Simpan PDF Slip Gaji</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= KONTEN SUB-TAB REVENUE ================= */}
      {subTab === 'revenue' && (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-black text-slate-800">Revenue Analytics</h3>
          <p className="text-xs text-slate-500 font-medium max-w-[240px]">
            (Coming Soon)<br />Fitur grafik analitik revenue sedang disinkronkan dengan laporan kasir outlet.
          </p>
        </div>
      )}

      {/* ================= KONTEN SUB-TAB DAFTAR HADIR (AUDIT KEHADIRAN CUT-OFF) ================= */}
      {subTab === 'hadir' && (
        <FinanceAttendanceAuditTab />
      )}

      {/* Modal Cetak Slip Gaji Resmi Kop 3 Pillar */}
      <PayslipPrintModal
        isOpen={printModalData.open}
        onClose={() =>
          setPrintModalData({
            open: false,
            slip: null,
            targetUser: null,
            approvedOts: [],
            rejectedOts: [],
          })
        }
        slip={printModalData.slip}
        user={printModalData.targetUser || user}
        approvedOvertimes={printModalData.approvedOts}
        rejectedOvertimes={printModalData.rejectedOts}
      />
    </div>
  );
}
