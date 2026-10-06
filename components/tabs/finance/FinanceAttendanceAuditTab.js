'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  UserCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  X,
  Eye,
  Camera,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseLocalDate, formatIndonesianDate, getLocalDateString } from '@/lib/date';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const OUTLETS = ['all', 'LazyBloom', 'Deru Ombak', 'Sea Cafe', 'Mobile / Lapangan'];

export default function FinanceAttendanceAuditTab() {
  // Preset Periode (Default: Cut-Off 25 Ags 2026 s.d. 25 Sep 2026)
  const [selectedMonth, setSelectedMonth] = useState('September');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [cutoffDay, setCutoffDay] = useState(25);

  // Date Range State
  const [startDate, setStartDate] = useState('2026-08-25');
  const [endDate, setEndDate] = useState('2026-09-25');

  // Filters
  const [selectedOutlet, setSelectedOutlet] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data State
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leavesRecords, setLeavesRecords] = useState([]);

  // UI State
  const [expandedEmpId, setExpandedEmpId] = useState(null);
  const [photoModal, setPhotoModal] = useState({ open: false, url: '', title: '' });

  // Update startDate & endDate ketika bulan/tahun/cutoffDay berubah
  const handleApplyPresetCutoff = (month, year, cutDay) => {
    const monthIdx = MONTHS.indexOf(month);
    if (monthIdx === -1) return;

    let prevMonthIdx = monthIdx - 1;
    let prevYear = Number(year);
    if (prevMonthIdx < 0) {
      prevMonthIdx = 11;
      prevYear -= 1;
    }

    const startMonthStr = String(prevMonthIdx + 1).padStart(2, '0');
    const startDayStr = String(cutDay).padStart(2, '0');
    const endMonthStr = String(monthIdx + 1).padStart(2, '0');
    const endDayStr = String(cutDay).padStart(2, '0');

    setStartDate(`${prevYear}-${startMonthStr}-${startDayStr}`);
    setEndDate(`${year}-${endMonthStr}-${endDayStr}`);
  };

  // Fetch data dari Supabase
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Ambil daftar seluruh staf aktif
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });

      if (empErr) console.warn('Supabase fetch employees error:', empErr);

      const activeEmployees = (empData || []).filter(
        (e) => e.is_active !== false && e.status !== 'inactive' && e.status !== 'nonaktif'
      );
      setEmployees(activeEmployees);

      // 2. Ambil absensi dalam rentang tanggal
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: true });

      if (attErr) console.warn('Supabase fetch attendance error:', attErr);
      setAttendanceRecords(attData || []);

      // 3. Ambil data izin / sakit / cuti yang disetujui dalam rentang tanggal
      const { data: lvData, error: lvErr } = await supabase
        .from('leaves')
        .select('*')
        .eq('status', 'Disetujui')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      if (lvErr) console.warn('Supabase fetch leaves error:', lvErr);
      setLeavesRecords(lvData || []);
    } catch (err) {
      console.error('Audit attendance fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  // Kalkulasi rekapitulasi audit kehadiran per karyawan
  const auditReport = useMemo(() => {
    const report = [];

    // Filter staf berdasarkan outlet dan search query
    const filteredEmployees = employees.filter((emp) => {
      const matchOutlet =
        selectedOutlet === 'all' ||
        (emp.branch && emp.branch.toLowerCase() === selectedOutlet.toLowerCase());
      const matchSearch =
        !searchQuery ||
        emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchOutlet && matchSearch;
    });

    for (const emp of filteredEmployees) {
      // Absensi staf ini dalam periode
      const empAtts = attendanceRecords.filter((a) => a.employee_id === emp.id);

      // Izin staf ini dalam periode
      const empLeaves = leavesRecords.filter((l) => l.employee_id === emp.id);

      // Tanggal-tanggal izin terlambat resmi yang disetujui (dimaafkan / tidak dipotong)
      const excusedLateDates = new Set();
      let paidLeaveDaysCount = 0;

      const cutStart = new Date(startDate).getTime();
      const cutEnd = new Date(endDate).getTime();

      empLeaves.forEach((lv) => {
        if (lv.leave_type === 'Izin Terlambat') {
          excusedLateDates.add(lv.start_date);
        }
        if (['Sakit', 'Izin', 'Cuti', 'Cuti Tahunan'].includes(lv.leave_type)) {
          const s = new Date(lv.start_date).getTime();
          const e = new Date(lv.end_date).getTime();
          for (let d = s; d <= e; d += 86400000) {
            if (d >= cutStart && d <= cutEnd) {
              paidLeaveDaysCount++;
            }
          }
        }
      });

      // Hitung metrik
      let presentDays = 0;
      let totalLateTimes = 0;
      let excusedLateTimes = 0;
      let unexcusedLateTimes = 0;
      let totalLateMinutes = 0;
      let totalWorkSeconds = 0;
      let missingCheckoutCount = 0;

      // Detail harian yang di-enrich
      const dailyLogs = empAtts.map((att) => {
        const isLate =
          typeof att.status === 'string' && att.status.toLowerCase().includes('terlambat');
        const isExcused = excusedLateDates.has(att.attendance_date);

        // Estimasi menit keterlambatan (jika check-in lewat jam 08:00 WIB atau status terlambat)
        let lateMins = 0;
        if (isLate && att.check_in_time) {
          try {
            const checkInD = new Date(att.check_in_time);
            // Default threshold outlet: 08:00:00
            const threshold = new Date(att.check_in_time);
            threshold.setHours(8, 0, 0, 0);
            if (checkInD > threshold) {
              lateMins = Math.max(1, Math.round((checkInD - threshold) / (1000 * 60)));
            } else {
              lateMins = 15; // Estimasi fallback jika jam persis tidak sinkron
            }
          } catch (e) {
            lateMins = 15;
          }
        }

        if (isLate) {
          totalLateTimes++;
          totalLateMinutes += lateMins;
          if (isExcused) {
            excusedLateTimes++;
          } else {
            unexcusedLateTimes++;
          }
        }

        presentDays++;

        // Durasi kerja
        if (att.working_hours_seconds && att.working_hours_seconds > 0) {
          totalWorkSeconds += att.working_hours_seconds;
        } else if (att.check_in_time && att.check_out_time) {
          const diffSec = Math.round(
            (new Date(att.check_out_time) - new Date(att.check_in_time)) / 1000
          );
          if (diffSec > 0) totalWorkSeconds += diffSec;
        } else if (att.check_in_time && !att.check_out_time) {
          missingCheckoutCount++;
        }

        return {
          ...att,
          isLate,
          isExcused,
          lateMins,
        };
      });

      // Format durasi jam kerja
      const totalWorkHours = Math.floor(totalWorkSeconds / 3600);
      const totalWorkRemainMins = Math.floor((totalWorkSeconds % 3600) / 60);

      // Format durasi keterlambatan
      const lateHours = Math.floor(totalLateMinutes / 60);
      const lateRemainMins = totalLateMinutes % 60;

      // Rekomendasi denda potongan (Flat Rp 10.000 per telat tanpa izin)
      const penaltyDeduction = unexcusedLateTimes * 10000;

      report.push({
        employee: emp,
        presentDays,
        paidLeaveDaysCount,
        totalCalculatedDays: presentDays + paidLeaveDaysCount,
        totalLateTimes,
        excusedLateTimes,
        unexcusedLateTimes,
        totalLateMinutes,
        lateDurationDisplay:
          lateHours > 0
            ? `${lateHours} Jam ${lateRemainMins} Menit`
            : `${lateRemainMins} Menit`,
        totalWorkSeconds,
        totalWorkDisplay: `${totalWorkHours} Jam ${totalWorkRemainMins} Menit`,
        missingCheckoutCount,
        penaltyDeduction,
        dailyLogs,
      });
    }

    return report;
  }, [employees, attendanceRecords, leavesRecords, selectedOutlet, searchQuery, startDate, endDate]);

  // Statistik Ringkasan Atas
  const summaryStats = useMemo(() => {
    let totalPresent = 0;
    let totalLate = 0;
    let totalSeconds = 0;
    let totalPenalty = 0;

    auditReport.forEach((item) => {
      totalPresent += item.presentDays;
      totalLate += item.totalLateTimes;
      totalSeconds += item.totalWorkSeconds;
      totalPenalty += item.penaltyDeduction;
    });

    const hours = Math.floor(totalSeconds / 3600);
    return {
      totalStaff: auditReport.length,
      totalPresent,
      totalLate,
      totalWorkHours: hours,
      totalPenalty,
    };
  }, [auditReport]);

  // Handler Export CSV Laporan
  const handleExportCSV = () => {
    if (auditReport.length === 0) {
      alert('Tidak ada data audit untuk diexport.');
      return;
    }

    const headers = [
      'Nama Karyawan',
      'Jabatan',
      'Outlet',
      'Periode Cut-Off',
      'Hari Hadir',
      'Hari Izin/Sakit/Cuti',
      'Total Hari Dihitung',
      'Frekuensi Telat',
      'Telat Ada Izin',
      'Telat Tanpa Izin',
      'Durasi Telat',
      'Denda Potongan (Rp)',
      'Total Jam Kerja',
      'Lupa Check-out',
    ];

    const rows = auditReport.map((item) => [
      item.employee.full_name || '-',
      item.employee.position || 'Staff',
      item.employee.branch || '-',
      `${startDate} s.d ${endDate}`,
      `${item.presentDays} Hari`,
      `${item.paidLeaveDaysCount} Hari`,
      `${item.totalCalculatedDays} Hari`,
      `${item.totalLateTimes}x`,
      `${item.excusedLateTimes}x (Diampuni)`,
      `${item.unexcusedLateTimes}x (Kena Denda)`,
      item.lateDurationDisplay,
      item.penaltyDeduction,
      item.totalWorkDisplay,
      item.missingCheckoutCount > 0 ? `${item.missingCheckoutCount}x` : '0',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((v) => `"${v}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Kehadiran_CutOff_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ================= HEADER & FILTER SECTION ================= */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5 sm:space-y-4">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#2563EB] shadow-xs shrink-0">
              <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                  Daftar Hadir &amp; Cut-Off Penggajian
                </h3>
                <span className="text-[9px] sm:text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.2 rounded-full">
                  Audit Payslip
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                Cek rekap kehadiran, durasi kerja, dan denda cut-off staf secara transparan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center shrink-0">
            <button
              type="button"
              onClick={fetchData}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="w-full sm:w-auto px-3 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-98 transition cursor-pointer"
              title="Export Rekap ke CSV / Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 1. Preset Cut-Off Bulan & Tahun */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider">
              1. Preset Cut-Off Periode
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const m = e.target.value;
                  setSelectedMonth(m);
                  handleApplyPresetCutoff(m, selectedYear, cutoffDay);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-hidden cursor-pointer"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const y = e.target.value;
                  setSelectedYear(y);
                  handleApplyPresetCutoff(selectedMonth, y, cutoffDay);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-hidden cursor-pointer"
              >
                {['2025', '2026', '2027', '2028'].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2 & 3. Rentang Tanggal Mulai & Selesai (Side-by-Side di HP) */}
          <div className="grid grid-cols-2 gap-1.5 sm:contents">
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider truncate">
                2. Mulai Cut-Off
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider truncate">
                3. Selesai Cut-Off
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* 4. Filter Outlet Cabang */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider">
              4. Filter Outlet Cabang
            </label>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-hidden cursor-pointer truncate"
            >
              {OUTLETS.map((ot) => (
                <option key={ot} value={ot}>
                  {ot === 'all' ? 'Semua Outlet' : ot}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar & Active Cut-Off Range Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama staf atau jabatan..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#2563EB] focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-600 bg-blue-50/70 border border-blue-200/80 px-2.5 py-1.5 rounded-xl truncate">
            <Calendar className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <span className="truncate">
              Periode: <strong>{formatIndonesianDate(startDate)}</strong> s.d.{' '}
              <strong>{formatIndonesianDate(endDate)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ================= STATS SUMMARY CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-wider block truncate">
              Staf Terverifikasi
            </span>
            <span className="text-base sm:text-lg font-black text-slate-800 mt-0.5 block truncate">
              {summaryStats.totalStaff} Orang
            </span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 ml-2">
            <User className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-wider block truncate">
              Total Kehadiran
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-600 mt-0.5 block truncate">
              {summaryStats.totalPresent} Hari
            </span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ml-2">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-wider block truncate">
              Keterlambatan
            </span>
            <span className="text-base sm:text-lg font-black text-rose-600 mt-0.5 block truncate">
              {summaryStats.totalLate}x Kejadian
            </span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 ml-2">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-wider block truncate">
              Total Jam Kerja
            </span>
            <span className="text-base sm:text-lg font-black text-[#2563EB] mt-0.5 block truncate">
              {summaryStats.totalWorkHours} Jam
            </span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 ml-2">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ================= TABEL REKAPITULASI KEHADIRAN PER KARYAWAN ================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider truncate">
              Rekapitulasi Kehadiran Cut-Off ({auditReport.length} Staf)
            </h4>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold shrink-0">
            Klik baris untuk rincian
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#2563EB]" />
            <span>Memuat data absensi &amp; izin dari cloud Supabase...</span>
          </div>
        ) : auditReport.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-1">
            <p className="font-bold text-slate-700">Tidak ada staf yang sesuai filter.</p>
            <p className="text-[11px] text-slate-400">
              Coba ganti pilihan outlet atau sesuaikan kata kunci pencarian.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditReport.map((item) => {
              const isExpanded = expandedEmpId === item.employee.id;

              return (
                <div key={item.employee.id} className="transition-colors hover:bg-slate-50/50">
                  {/* Row Ringkasan Utama */}
                  <div
                    onClick={() => setExpandedEmpId(isExpanded ? null : item.employee.id)}
                    className="p-3.5 sm:p-4 cursor-pointer space-y-2.5"
                  >
                    {/* Header Baris Karyawan */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black text-xs shrink-0 overflow-hidden shadow-2xs">
                          {item.employee.avatar_url ? (
                            <img
                              src={item.employee.avatar_url}
                              alt={item.employee.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            item.employee.full_name?.charAt(0).toUpperCase() || 'S'
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate">
                            {item.employee.full_name}
                          </h5>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-medium truncate">
                              {item.employee.position || 'Staf'}
                            </span>
                            <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded-md">
                              {item.employee.branch || 'Outlet'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tombol Expand */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 hidden sm:inline">
                          {isExpanded ? 'Tutup Log' : 'Buka Log'}
                        </span>
                        <button
                          type="button"
                          className={`p-1.5 rounded-full transition cursor-pointer ${
                            isExpanded
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Metrik 3-Kolom Responsif (Mobile & Desktop) */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-[10px]">
                      {/* 1. Hadir & Izin */}
                      <div className="bg-emerald-50/80 border border-emerald-200/80 p-2 sm:p-2.5 rounded-xl">
                        <span className="text-emerald-900 font-black block leading-tight truncate">
                          {item.presentDays} Hari Hadir
                        </span>
                        <span className="text-[8px] sm:text-[9px] text-emerald-700 block mt-0.5 truncate">
                          {item.paidLeaveDaysCount > 0 ? `+${item.paidLeaveDaysCount} Izin Sah` : 'Aktual Presensi'}
                        </span>
                      </div>

                      {/* 2. Keterlambatan & Potongan Denda */}
                      <div
                        className={`p-2 sm:p-2.5 rounded-xl border ${
                          item.totalLateTimes > 0
                            ? 'bg-rose-50/80 border-rose-200/80 text-rose-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-black leading-tight truncate">
                          <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">
                            {item.totalLateTimes > 0
                              ? `${item.totalLateTimes}x Telat`
                              : '0x Telat'}
                          </span>
                        </div>
                        <span className="text-[8px] sm:text-[9px] block mt-0.5 truncate">
                          {item.penaltyDeduction > 0
                            ? `Denda Rp ${item.penaltyDeduction.toLocaleString('id-ID')}`
                            : 'Bebas Denda'}
                        </span>
                      </div>

                      {/* 3. Durasi Kerja Akumulasi */}
                      <div className="bg-indigo-50/80 border border-indigo-200/80 p-2 sm:p-2.5 rounded-xl">
                        <span className="text-indigo-900 font-black block leading-tight truncate">
                          {item.totalWorkDisplay.replace(' Menit', 'm').replace(' Jam', 'j')}
                        </span>
                        <span className="text-[8px] sm:text-[9px] text-indigo-700 block mt-0.5 truncate">
                          {item.missingCheckoutCount > 0 ? (
                            <span className="text-amber-700 font-bold">⚠️ {item.missingCheckoutCount}x No Out</span>
                          ) : (
                            'Total Jam Kerja'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ================= DRILL-DOWN LOG HARIAN ================= */}
                  {isExpanded && (
                    <div className="px-3 sm:px-4 pb-4 pt-1 bg-slate-50/80 border-t border-slate-200/80 animate-in fade-in duration-150">
                      <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 gap-2">
                          <h6 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 truncate">
                            <Clock className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                            <span className="truncate">
                              Riwayat Harian Presensi ({item.dailyLogs.length} Log)
                            </span>
                          </h6>
                          <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium shrink-0">
                            {startDate} s.d {endDate}
                          </span>
                        </div>

                        {item.dailyLogs.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-3 text-center">
                            Tidak ada catatan presensi dalam rentang cut-off ini.
                          </p>
                        ) : (
                          <>
                            {/* TAMPILAN MOBILE: Card List (No Horizontal Scroll) */}
                            <div className="space-y-2 sm:hidden">
                              {item.dailyLogs.map((log) => {
                                const formattedD = formatIndonesianDate(log.attendance_date);
                                const inTime = log.check_in_time
                                  ? new Date(log.check_in_time).toLocaleTimeString('id-ID', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }) + ' WIB'
                                  : '-';
                                const outTime = log.check_out_time
                                  ? new Date(log.check_out_time).toLocaleTimeString('id-ID', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }) + ' WIB'
                                  : '-';

                                const workSecs = log.working_hours_seconds || 0;
                                const workDur =
                                  workSecs > 0
                                    ? `${Math.floor(workSecs / 3600)}j ${Math.floor(
                                        (workSecs % 3600) / 60
                                      )}m`
                                    : '-';

                                return (
                                  <div
                                    key={log.id}
                                    className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-black text-slate-800">
                                        {formattedD}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                            log.isLate
                                              ? 'bg-rose-100 text-rose-800'
                                              : 'bg-emerald-100 text-emerald-800'
                                          }`}
                                        >
                                          {log.status || 'Hadir'}
                                        </span>

                                        {/* Foto selfie */}
                                        <div className="flex items-center gap-1">
                                          {log.check_in_photo && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPhotoModal({
                                                  open: true,
                                                  url: log.check_in_photo,
                                                  title: `Foto Masuk - ${item.employee.full_name} (${formattedD})`,
                                                })
                                              }
                                              className="p-1 rounded bg-blue-50 text-[#2563EB] hover:bg-blue-100 cursor-pointer"
                                              title="Foto Masuk"
                                            >
                                              <Camera className="w-3 h-3" />
                                            </button>
                                          )}
                                          {log.check_out_photo && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPhotoModal({
                                                  open: true,
                                                  url: log.check_out_photo,
                                                  title: `Foto Pulang - ${item.employee.full_name} (${formattedD})`,
                                                })
                                              }
                                              className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer"
                                              title="Foto Pulang"
                                            >
                                              <Camera className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-200/70">
                                      <div>
                                        <span className="text-slate-400 block text-[9px]">Jam Absen:</span>
                                        <span className="font-mono text-slate-800 font-bold">
                                          {inTime} &rarr; {outTime === '-' && inTime !== '-' ? (
                                            <span className="text-amber-600">Belum Out</span>
                                          ) : (
                                            outTime
                                          )}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-slate-400 block text-[9px]">Durasi Kerja:</span>
                                        <span className="font-mono text-slate-700 font-bold">
                                          {workDur}
                                        </span>
                                        {log.isLate && (
                                          <span className="text-rose-600 font-bold text-[9px] block">
                                            +{log.lateMins}m {log.isExcused ? '(Izin Sah)' : ''}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* TAMPILAN DESKTOP/TABLET: Table */}
                            <div className="hidden sm:block overflow-x-auto">
                              <table className="w-full text-[10px] text-left">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px]">
                                    <th className="py-2 px-2.5">Tanggal</th>
                                    <th className="py-2 px-2">Jam Masuk</th>
                                    <th className="py-2 px-2">Jam Pulang</th>
                                    <th className="py-2 px-2">Keterlambatan</th>
                                    <th className="py-2 px-2">Durasi Kerja</th>
                                    <th className="py-2 px-2">Status</th>
                                    <th className="py-2 px-2 text-center">Bukti Foto</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {item.dailyLogs.map((log) => {
                                    const formattedD = formatIndonesianDate(log.attendance_date);
                                    const inTime = log.check_in_time
                                      ? new Date(log.check_in_time).toLocaleTimeString('id-ID', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        }) + ' WIB'
                                      : '-';
                                    const outTime = log.check_out_time
                                      ? new Date(log.check_out_time).toLocaleTimeString('id-ID', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        }) + ' WIB'
                                      : '-';

                                    const workSecs = log.working_hours_seconds || 0;
                                    const workDur =
                                      workSecs > 0
                                        ? `${Math.floor(workSecs / 3600)}j ${Math.floor(
                                            (workSecs % 3600) / 60
                                          )}m`
                                        : '-';

                                    return (
                                      <tr key={log.id} className="hover:bg-slate-50/70">
                                        <td className="py-2 px-2.5 font-bold text-slate-800">
                                          {formattedD}
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-700">
                                          {inTime}
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-700">
                                          {outTime === '-' && inTime !== '-' ? (
                                            <span className="text-amber-600 font-bold">
                                              Belum Check-Out
                                            </span>
                                          ) : (
                                            outTime
                                          )}
                                        </td>
                                        <td className="py-2 px-2">
                                          {log.isLate ? (
                                            <span className="text-rose-600 font-bold">
                                              +{log.lateMins} Menit{' '}
                                              {log.isExcused && (
                                                <span className="text-blue-600 font-normal">
                                                  (Izin Sah)
                                                </span>
                                              )}
                                            </span>
                                          ) : (
                                            <span className="text-emerald-600 font-medium">Tepat Waktu</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-600">
                                          {workDur}
                                        </td>
                                        <td className="py-2 px-2">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              log.isLate
                                                ? 'bg-rose-100 text-rose-800'
                                                : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                          >
                                            {log.status || 'Hadir'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                          <div className="flex items-center justify-center gap-1.5">
                                            {log.check_in_photo && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setPhotoModal({
                                                    open: true,
                                                    url: log.check_in_photo,
                                                    title: `Foto Masuk - ${item.employee.full_name} (${formattedD})`,
                                                  })
                                                }
                                                className="p-1 rounded bg-blue-50 text-[#2563EB] hover:bg-blue-100 cursor-pointer"
                                                title="Lihat Foto Masuk"
                                              >
                                                <Camera className="w-3 h-3" />
                                              </button>
                                            )}
                                            {log.check_out_photo && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setPhotoModal({
                                                    open: true,
                                                    url: log.check_out_photo,
                                                    title: `Foto Pulang - ${item.employee.full_name} (${formattedD})`,
                                                  })
                                                }
                                                className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer"
                                                title="Lihat Foto Pulang"
                                              >
                                                <Camera className="w-3 h-3" />
                                              </button>
                                            )}
                                            {!log.check_in_photo && !log.check_out_photo && (
                                              <span className="text-slate-300">-</span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= MODAL PREVIEW FOTO SELFIE ================= */}
      {photoModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h5 className="text-xs font-black truncate pr-2">{photoModal.title}</h5>
              <button
                type="button"
                onClick={() => setPhotoModal({ open: false, url: '', title: '' })}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-100 flex items-center justify-center min-h-[260px]">
              {photoModal.url ? (
                <img
                  src={photoModal.url}
                  alt="Bukti Selfie Presensi"
                  className="max-h-[360px] w-auto object-contain rounded-xl shadow-xs"
                />
              ) : (
                <p className="text-xs text-slate-400">Foto tidak tersedia.</p>
              )}
            </div>
            <div className="p-3 bg-white text-center">
              <button
                type="button"
                onClick={() => setPhotoModal({ open: false, url: '', title: '' })}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
