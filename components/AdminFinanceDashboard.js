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
  XCircle,
  X,
  FileText,
  CheckCircle,
  Edit3,
  RefreshCw,
  Printer,
  ClipboardCheck,
  Eye,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Zap,
  Sliders,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah, CurrencyInput, fetchEmployeeSalaries, saveEmployeeSalaries } from '@/lib/currency';
import { getPeriodFromDate, formatIndonesianDate } from '@/lib/date';
import PayslipPrintModal from './PayslipPrintModal';
import { getOvertimeRateByPosition } from '@/lib/overtimeRates';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const currentYearNum = new Date().getFullYear();
const YEARS = [currentYearNum - 1, currentYearNum, currentYearNum + 1, currentYearNum + 2].map(String);


const getCutoffDateRange = (targetMonth, targetYear, payday) => {
  const monthIdx = MONTHS.indexOf(targetMonth);
  if (monthIdx === -1) return null;
  
  if (!payday || Number(payday) === 1) {
     const lastDay = new Date(targetYear, monthIdx + 1, 0).getDate();
     return {
       start: `${targetYear}-${String(monthIdx + 1).padStart(2, '0')}-01`,
       end: `${targetYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
     };
  }
  
  const pd = Number(payday);
  let prevMonthIdx = monthIdx - 1;
  let prevYear = Number(targetYear);
  if (prevMonthIdx < 0) {
    prevMonthIdx = 11;
    prevYear -= 1;
  }
  
  const maxPrevDays = new Date(prevYear, prevMonthIdx + 1, 0).getDate();
  const safePd = Math.min(pd, maxPrevDays);
  
  let endDay = pd - 1;
  if (endDay < 1) endDay = 1;
  
  const maxCurrDays = new Date(targetYear, monthIdx + 1, 0).getDate();
  const safeEndDay = Math.min(endDay, maxCurrDays);

  return {
    start: `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(safePd).padStart(2, '0')}`,
    end: `${targetYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(safeEndDay).padStart(2, '0')}`
  };
};

export default function AdminFinanceDashboard({ onBack }) {

  const {
    overtimeRequests,
    loadOvertimeRequests,
    approveOvertimeRequest,
    rejectOvertimeRequest,
  } = useAuth();
  const [payrollSubTab, setPayrollSubTab] = useState('manage'); // 'manage' | 'overtime'
  const [printModalSlip, setPrintModalSlip] = useState(null);

  // Modal Penolakan Lembur
  const [rejectModal, setRejectModal] = useState({
    open: false,
    otId: null,
    employeeName: '',
    hours: 0,
    reason: '',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [otNominals, setOtNominals] = useState({});

  // Filter Pengajuan Lembur
  const pendingOvertimes = (overtimeRequests || []).filter(
    (ot) => ot.status === 'Diajukan Leader'
  );
  const processedOvertimes = (overtimeRequests || []).filter(
    (ot) => ot.status !== 'Diajukan Leader'
  );

  // ================= 1. KELOLA SLIP GAJI 3 OUTLET =================
  const [selectedOutletSalary, setSelectedOutletSalary] = useState('all');
  const [isAddingSalary, setIsAddingSalary] = useState(false);
  const [salaryMsg, setSalaryMsg] = useState({ type: '', text: '' });


  // 10 Komponen Gaji Outlet (6 Pendapatan + 4 Potongan)
  const [employeesList, setEmployeesList] = useState([]);
  const [employeeSalaries, setEmployeeSalaries] = useState({});

  const [salaryMonth, setSalaryMonth] = useState(() => {
    const currentMonthIdx = new Date().getMonth();
    return MONTHS[currentMonthIdx] || 'September';
  });
  const [salaryYear, setSalaryYear] = useState(() => String(new Date().getFullYear()));

  const [newSalary, setNewSalary] = useState({
    existing_slip_id: null,
    employee_name: '',
    employee_id: null,
    branch: 'LazyBloom',
    period: `${MONTHS[new Date().getMonth()] || 'September'} ${new Date().getFullYear()}`,
    // Komponen Pendapatan
    basic_salary: 0,
    child_allowance: 0,
    spouse_allowance: 0,
    position_allowance: 0,
    meal_allowance: 0,
    overtime_pay: 0,
    plus_day_count: 0,
    plus_day_pay: 0,
    plus_day_note: '',
    // Komponen Potongan
    meal_deduction: 0,
    attendance_deduction: 0,
    discipline_deduction: 0,
    cash_bon: 0,
    is_released: true,
  });

  const [salaryList, setSalaryList] = useState([]);
  const [expandedPeriods, setExpandedPeriods] = useState({});
  const [expandedOtHistoryPeriods, setExpandedOtHistoryPeriods] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetailedComponents, setShowDetailedComponents] = useState(false);
  const [autoLateCount, setAutoLateCount] = useState(0);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // State Tab Master Data Gaji Staf
  const [selectedOutletMaster, setSelectedOutletMaster] = useState('all');
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [editingStaffSalary, setEditingStaffSalary] = useState(null);
  const [savingMaster, setSavingMaster] = useState(false);

  // Helper mendapatkan periode bulan sebelumnya
  const getPreviousPeriod = (m, y) => {
    const idx = MONTHS.indexOf(m);
    if (idx === -1) return null;
    if (idx === 0) {
      return `Desember ${Number(y) - 1}`;
    }
    return `${MONTHS[idx - 1]} ${y}`;
  };

  const handleRefreshSalaries = async () => {
    setIsRefreshing(true);
    await loadInitialData();
    setIsRefreshing(false);
  };

  const handleRefreshOvertimes = async () => {
    setIsRefreshing(true);
    if (loadOvertimeRequests) {
      await loadOvertimeRequests();
    }
    setIsRefreshing(false);
  };

  // Fetch real payslips & employees from Supabase on mount
  const loadInitialData = async () => {
    try {
        // 1. Muat karyawan (staf aktif)
        const { data: emps } = await supabase
          .from('employees')
          .select('id, full_name, branch, position, role, is_active, status')
          .order('full_name', { ascending: true });
        
        if (emps) {
          // Hanya simpan karyawan yang aktif bekerja
          const activeEmps = emps.filter(
            (e) => e.is_active !== false && e.status !== 'inactive' && e.status !== 'nonaktif'
          );
          setEmployeesList(activeEmps);
        }

        // 2. Muat paket gaji karyawan
        const pkgs = await fetchEmployeeSalaries();
        setEmployeeSalaries(pkgs || {});

        // 3. Muat cache detail 11 komponen payslip
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
            // Remote details adalah sumber kebenaran data cloud
            detailsMap = { ...detailsMap, ...remoteDetails };
          }
        } catch (e) {}

        // Pembersihan & Deduplikasi Otomatis: Pastikan hanya ada 1 record per karyawan per periode
        const cleanDetailsMap = {};
        const seenEmployeePeriod = new Set();
        // Urutkan key dari yang terbaru berdasarkan created_at
        const sortedEntries = Object.entries(detailsMap).sort(([, a], [, b]) => {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });

        let hadDuplicates = false;
        for (const [key, val] of sortedEntries) {
          const empIdent = (val.employee_id || val.employee_name || '').toLowerCase().trim();
          const periodIdent = (val.period || '').toLowerCase().trim();
          const comboKey = `${empIdent}___${periodIdent}`;
          if (!seenEmployeePeriod.has(comboKey)) {
            seenEmployeePeriod.add(comboKey);
            cleanDetailsMap[key] = val;
          } else {
            hadDuplicates = true;
          }
        }

        detailsMap = cleanDetailsMap;
        if (typeof window !== 'undefined') {
          localStorage.setItem('pwa_payslips_detail', JSON.stringify(cleanDetailsMap));
        }

        if (hadDuplicates) {
          try {
            await supabase.from('admin_settings').update({
              description: JSON.stringify(cleanDetailsMap),
              updated_at: new Date().toISOString(),
            }).eq('role', 'payslips_detail');
          } catch (e) {}
        }

        // Helper deduplikasi list slip gaji
        const deduplicateList = (list) => {
          const seen = new Set();
          const result = [];
          const sorted = [...list].sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeB - timeA;
          });
          for (const item of sorted) {
            const empIdent = (item.employee_id || item.employee_name || '').toLowerCase().trim();
            const periodIdent = (item.period || '').toLowerCase().trim();
            const key = `${empIdent}___${periodIdent}`;
            if (!seen.has(key)) {
              seen.add(key);
              result.push(item);
            }
          }
          return result;
        };

        // 4. Muat slip gaji yang pernah dibuat dari Supabase
        const { data, error } = await supabase
          .from('payslips')
          .select('*, employees(full_name, branch)')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          // DATABASE SUPABASE ADALAH SUMBER KEBENARAN UTAMA (Single Source of Truth):
          // Bersihkan detailsMap dari ID slip 'zombie' yang sudah dihapus di tabel payslips
          const existingSlipIds = new Set(data.map((p) => p.id));
          const cleanDetails = {};
          for (const [id, detail] of Object.entries(detailsMap)) {
            if (existingSlipIds.has(id)) {
              cleanDetails[id] = detail;
            }
          }
          detailsMap = cleanDetails;

          if (typeof window !== 'undefined') {
            if (Object.keys(cleanDetails).length > 0) {
              localStorage.setItem('pwa_payslips_detail', JSON.stringify(cleanDetails));
            } else {
              localStorage.removeItem('pwa_payslips_detail');
            }
          }

          if (data.length > 0) {
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
                plus_day_count: detail.plus_day_count ?? p.plus_day_count ?? 0,
                plus_day_pay: detail.plus_day_pay ?? p.plus_day_pay ?? 0,
                plus_day_note: detail.plus_day_note ?? p.plus_day_note ?? '',
                meal_deduction: detail.meal_deduction ?? 0,
                attendance_deduction: detail.attendance_deduction ?? 0,
                discipline_deduction: detail.discipline_deduction ?? 0,
                cash_bon: detail.cash_bon ?? p.deductions ?? 0,
                net_salary: p.net_salary,
                is_released: p.is_released,
                is_paid: p.is_paid,
                created_at: p.created_at,
              };
            });
            setSalaryList(deduplicateList(mapped));
          } else {
            // Tabel payslips di Supabase kosong: set salaryList kosong & bersihkan cloud backup
            setSalaryList([]);
            try {
              await supabase
                .from('admin_settings')
                .update({ description: '{}', updated_at: new Date().toISOString() })
                .eq('role', 'payslips_detail');
            } catch (e) {}
          }
        } else if (error && Object.keys(detailsMap).length > 0) {
          // Hanya fallback ke cache lokal jika koneksi ke database error (misal offline)
          setSalaryList(deduplicateList(Object.values(detailsMap)));
        }
      } catch (err) {
        console.warn('Fetch salaries error:', err);
      }
    };

  useEffect(() => {
    loadInitialData();

    // Listener sinkronisasi paket gaji otomatis saat diubah di Tabel Editor
    const handlePackageUpdate = () => {
      fetchEmployeeSalaries().then((pkgs) => setEmployeeSalaries(pkgs || {}));
    };
    window.addEventListener('pwa_salary_package_updated', handlePackageUpdate);

    // Listener sinkronisasi penghapusan slip gaji dari Tabel Editor
    const handlePayslipDeleted = (e) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setSalaryList((prev) => prev.filter((item) => item.id !== deletedId));
      }
    };
    window.addEventListener('pwa_payslips_deleted', handlePayslipDeleted);

    return () => {
      window.removeEventListener('pwa_salary_package_updated', handlePackageUpdate);
      window.removeEventListener('pwa_payslips_deleted', handlePayslipDeleted);
    };
  }, []);

  // Helper mencari apakah staf sudah memiliki slip gaji di periode tertentu
  const findExistingSlip = (empId, empName, targetPeriod) => {
    return salaryList.find((slip) => {
      const matchEmp =
        (empId && slip.employee_id && slip.employee_id === empId) ||
        (empName && slip.employee_name && slip.employee_name.toLowerCase().trim() === empName.toLowerCase().trim());
      const matchPeriod = (slip.period || '').toLowerCase().trim() === (targetPeriod || '').toLowerCase().trim();
      return matchEmp && matchPeriod;
    });
  };

  // Helper mengisi form slip gaji: Jika sudah ada slip di bulan tersebut, otomatis beralih ke Mode Edit (Opsi A)
  const populateSalaryForm = async (empName, branch, targetMonth, targetYear) => {
    const staff = employeesList.find((e) => e.full_name === empName);
    const empId = staff?.id || null;
    const targetPeriod = `${targetMonth} ${targetYear}`;
    const existingSlip = findExistingSlip(empId, empName, targetPeriod);

    if (existingSlip) {
      // 1. JIKA SUDAH ADA: Beralih ke Mode Edit (Opsi A: Mencegah Slip Ganda)
      setNewSalary({
        existing_slip_id: existingSlip.id,
        employee_name: existingSlip.employee_name,
        employee_id: existingSlip.employee_id,
        branch: existingSlip.branch || branch,
        period: targetPeriod,
        basic_salary: existingSlip.basic_salary ?? 0,
        child_allowance: existingSlip.child_allowance ?? 0,
        spouse_allowance: existingSlip.spouse_allowance ?? 0,
        position_allowance: existingSlip.position_allowance ?? 0,
        meal_allowance: existingSlip.meal_allowance ?? 0,
        overtime_pay: existingSlip.overtime_pay ?? 0,
        plus_day_count: existingSlip.plus_day_count ?? 0,
        plus_day_pay: existingSlip.plus_day_pay ?? 0,
        plus_day_note: existingSlip.plus_day_note ?? '',
        meal_deduction: existingSlip.meal_deduction ?? 0,
        attendance_deduction: existingSlip.attendance_deduction ?? 0,
        discipline_deduction: existingSlip.discipline_deduction ?? 0,
        cash_bon: existingSlip.cash_bon ?? 0,
        is_released: existingSlip.is_released ?? true,
      });
      setAutoLateCount(0);
      return true;
    } else {
      // 2. JIKA BELUM ADA: Mode Buat Baru
      // Cek apakah ada slip bulan lalu sebagai acuan otomatis
      const prevPeriod = getPreviousPeriod(targetMonth, targetYear);
      const prevSlip = prevPeriod ? findExistingSlip(empId, empName, prevPeriod) : null;
      const pkg = staff ? (employeeSalaries[staff.id] || employeeSalaries[staff.full_name] || null) : null;

      const approvedOtSum = (overtimeRequests || [])
        .filter((ot) => {
          const matchEmp = (staff && ot.employee_id === staff.id) || ot.employee_name === empName;
          const payday = pkg?.payday_date || 1;
          const dr = getCutoffDateRange(targetMonth, targetYear, payday);
          let matchPeriod = false;
          if (dr) {
             const otD = new Date(ot.date);
             matchPeriod = otD >= new Date(dr.start) && otD <= new Date(dr.end);
          } else {
             matchPeriod = getPeriodFromDate(ot.date) === targetPeriod;
          }
          return matchEmp && matchPeriod && ot.status === 'Disetujui Finance';
        })
        .reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);

      // Hitung otomatis denda presensi dari tabel attendance di periode ini
      let autoLateFee = 0;
      let lateTimes = 0;
      if (empId) {
        try {
          const payday = pkg?.payday_date || 1;
            const dr = getCutoffDateRange(targetMonth, targetYear, payday);
            if (dr) {
              const { data: attRecords } = await supabase
                .from('attendance')
                .select('discipline_penalty, is_late, status')
                .eq('employee_id', empId)
                .gte('attendance_date', dr.start)
                .lte('attendance_date', dr.end);

            if (attRecords && attRecords.length > 0) {
              attRecords.forEach((a) => {
                const isLate = a.is_late || (typeof a.status === 'string' && a.status.includes('Terlambat'));
                if (isLate) {
                  lateTimes += 1;
                  autoLateFee += Number(a.discipline_penalty) > 0 ? Number(a.discipline_penalty) : 10000;
                }
              });
            }
          }
        } catch (e) {
          console.warn('Calculate late penalty error:', e);
        }
      }

      setAutoLateCount(lateTimes);

      setNewSalary({
        existing_slip_id: null,
        employee_name: empName,
        employee_id: empId,
        branch: staff?.branch || branch,
        period: targetPeriod,
        basic_salary: (pkg && Number(pkg.basic_salary) > 0) ? pkg.basic_salary : (prevSlip?.basic_salary ?? 0),
        child_allowance: (pkg && pkg.child_allowance !== undefined) ? pkg.child_allowance : (prevSlip?.child_allowance ?? 0),
        spouse_allowance: (pkg && pkg.spouse_allowance !== undefined) ? pkg.spouse_allowance : (prevSlip?.spouse_allowance ?? 0),
        position_allowance: (pkg && pkg.position_allowance !== undefined) ? pkg.position_allowance : (prevSlip?.position_allowance ?? 0),
        meal_allowance: (pkg && pkg.meal_allowance !== undefined) ? pkg.meal_allowance : (prevSlip?.meal_allowance ?? 0),
        overtime_pay: approvedOtSum,
        plus_day_count: 0,
        plus_day_pay: 0,
        plus_day_note: '',
        meal_deduction: 0,
        attendance_deduction: 0,
        discipline_deduction: autoLateFee,
        cash_bon: 0,
        is_released: true,
      });
      return false;
    }
  };

  // Handler saat outlet di form slip gaji berubah
  const handleBranchChange = (newBranch) => {
    const staffInBranch = employeesList.filter(
      (e) => e.branch && e.branch.toLowerCase() === newBranch.toLowerCase()
    );
    const firstStaff = staffInBranch[0];
    if (firstStaff) {
      populateSalaryForm(firstStaff.full_name, newBranch, salaryMonth, salaryYear);
    } else {
      setNewSalary((prev) => ({
        ...prev,
        existing_slip_id: null,
        branch: newBranch,
        employee_name: '',
        employee_id: null,
        basic_salary: 0,
        child_allowance: 0,
        spouse_allowance: 0,
        position_allowance: 0,
        meal_allowance: 0,
        overtime_pay: 0,
        plus_day_count: 0,
        plus_day_pay: 0,
        plus_day_note: '',
        meal_deduction: 0,
        attendance_deduction: 0,
        discipline_deduction: 0,
        cash_bon: 0,
      }));
      setAutoLateCount(0);
    }
  };


  const handleExportCSV = () => {
    if (salaryList.length === 0) {
      alert("Tidak ada slip gaji untuk diekspor di bulan ini!");
      return;
    }
    
    // Prepare CSV data
    const headers = [
      "Nama Pegawai", "Cabang/Outlet", "Periode", "Cut-Off (Tgl Gajian)",
      "Gaji Pokok", "Tj. Jabatan", "Tj. Anak", "Tj. Istri", "Uang Makan", "Uang Lembur", "Insentif Tambahan",
      "Potongan Kehadiran", "Potongan Disiplin/Lain", "Potongan Uang Makan", "Cash Bon",
      "TAKE HOME PAY"
    ];
    
    const rows = salaryList.map(slip => {
      const pkg = employeeSalaries[slip.employee_id] || employeeSalaries[slip.employee_name] || {};
      const payday = pkg.payday_date || 1;
      
      const totalPendapatan = (slip.basic_salary||0) + (slip.position_allowance||0) + (slip.child_allowance||0) + (slip.spouse_allowance||0) + (slip.meal_allowance||0) + (slip.overtime_pay||0) + (slip.plus_day_pay||0);
      const totalPotongan = (slip.attendance_deduction||0) + (slip.discipline_deduction||0) + (slip.meal_deduction||0) + (slip.cash_bon||0);
      const thp = totalPendapatan - totalPotongan;
      
      return [
        slip.employee_name,
        slip.branch || "-",
        slip.period,
        `Tgl ${payday}`,
        slip.basic_salary || 0,
        slip.position_allowance || 0,
        slip.child_allowance || 0,
        slip.spouse_allowance || 0,
        slip.meal_allowance || 0,
        slip.overtime_pay || 0,
        slip.plus_day_pay || 0,
        slip.attendance_deduction || 0,
        slip.discipline_deduction || 0,
        slip.meal_deduction || 0,
        slip.cash_bon || 0,
        thp
      ].map(v => `"${v}"`).join(",");
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Gaji_${salaryMonth}_${salaryYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler saat nama karyawan di dropdown form slip gaji dipilih

  const handleSelectEmployee = (empName) => {
    populateSalaryForm(empName, newSalary.branch, salaryMonth, salaryYear);
  };

  // Handler Salin Gaji dari Bulan Sebelumnya
  const handleCopyPreviousSalary = () => {
    const prevPeriod = getPreviousPeriod(salaryMonth, salaryYear);
    if (!prevPeriod || !newSalary.employee_name) return;
    const prevSlip = findExistingSlip(newSalary.employee_id, newSalary.employee_name, prevPeriod);
    if (!prevSlip) {
      setSalaryMsg({
        type: 'error',
        text: `Tidak ada data slip gaji ${newSalary.employee_name} di periode sebelumnya (${prevPeriod}).`,
      });
      return;
    }
    setNewSalary((prev) => ({
      ...prev,
      basic_salary: prevSlip.basic_salary ?? prev.basic_salary,
      child_allowance: prevSlip.child_allowance ?? prev.child_allowance,
      spouse_allowance: prevSlip.spouse_allowance ?? prev.spouse_allowance,
      position_allowance: prevSlip.position_allowance ?? prev.position_allowance,
      meal_allowance: prevSlip.meal_allowance ?? prev.meal_allowance,
      meal_deduction: prevSlip.meal_deduction ?? prev.meal_deduction,
      attendance_deduction: prevSlip.attendance_deduction ?? prev.attendance_deduction,
      cash_bon: prevSlip.cash_bon ?? 0,
    }));
    setSalaryMsg({
      type: 'success',
      text: `Berhasil menyalin data gaji ${newSalary.employee_name} dari periode ${prevPeriod}!`,
    });
  };

  // Handler Generate Draft Gaji Otomatis untuk Semua Staf Outlet Terpilih
  const handleBulkGenerateSalary = async () => {
    const targetPeriod = `${salaryMonth} ${salaryYear}`;
    const targetBranch = selectedOutletSalary;
    const branchStaff = employeesList.filter(
      (e) => targetBranch === 'all' || e.branch?.toLowerCase() === targetBranch.toLowerCase()
    );

    const ungenerated = branchStaff.filter(
      (emp) =>
        !salaryList.some(
          (s) =>
            (s.employee_id === emp.id || s.employee_name === emp.full_name) &&
            s.period === targetPeriod
        )
    );

    if (ungenerated.length === 0) {
      setSalaryMsg({
        type: 'error',
        text: `Semua staf di ${targetBranch === 'all' ? 'Semua Outlet' : targetBranch} sudah memiliki slip gaji periode ${targetPeriod}.`,
      });
      return;
    }

    if (
      !window.confirm(
        `Generate draf slip gaji otomatis untuk ${ungenerated.length} staf ${
          targetBranch === 'all' ? 'Semua Outlet' : targetBranch
        } periode ${targetPeriod}?`
      )
    ) {
      return;
    }

    setIsBulkGenerating(true);
    setSalaryMsg({ type: '', text: '' });

    try {
      const prevPeriod = getPreviousPeriod(salaryMonth, salaryYear);
      let newSlips = [];

      for (const emp of ungenerated) {
        const prevSlip = prevPeriod ? findExistingSlip(emp.id, emp.full_name, prevPeriod) : null;
        const pkg = employeeSalaries[emp.id] || employeeSalaries[emp.full_name] || null;

        const basic = Number(prevSlip?.basic_salary ?? pkg?.basic_salary ?? 2000000);
        const child = Number(prevSlip?.child_allowance ?? pkg?.child_allowance ?? 0);
        const spouse = Number(prevSlip?.spouse_allowance ?? pkg?.spouse_allowance ?? 0);
        const pos = Number(prevSlip?.position_allowance ?? pkg?.position_allowance ?? 0);
        const meal = Number(prevSlip?.meal_allowance ?? pkg?.meal_allowance ?? 0);

        const approvedOtSum = (overtimeRequests || [])
          .filter((ot) => {
            const matchEmp = (emp.id && ot.employee_id === emp.id) || ot.employee_name === emp.full_name;
            const payday = pkg?.payday_date || 1;
            const dr = getCutoffDateRange(salaryMonth, salaryYear, payday);
            let matchPeriod = false;
            if (dr) {
               const otD = new Date(ot.date);
               matchPeriod = otD >= new Date(dr.start) && otD <= new Date(dr.end);
            } else {
               matchPeriod = getPeriodFromDate(ot.date) === targetPeriod;
            }
            return matchEmp && matchPeriod && ot.status === 'Disetujui Finance';
          })
          .reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);

        let lateDeduction = 0;
        try {
          const payday = pkg?.payday_date || 1;
          const dr = getCutoffDateRange(salaryMonth, salaryYear, payday);
          if (dr && emp.id) {
            const { data: attRecords } = await supabase
              .from('attendance')
              .select('discipline_penalty, is_late, status')
              .eq('employee_id', emp.id)
              .gte('attendance_date', dr.start)
              .lte('attendance_date', dr.end);

            if (attRecords && attRecords.length > 0) {
              attRecords.forEach((a) => {
                const isLate = a.is_late || (typeof a.status === 'string' && a.status.includes('Terlambat'));
                if (isLate) {
                  lateDeduction += Number(a.discipline_penalty) > 0 ? Number(a.discipline_penalty) : 10000;
                }
              });
            }
          }
        } catch (e) {}

        const net = basic + child + spouse + pos + meal + approvedOtSum - lateDeduction;

        const basePayload = {
          employee_id: emp.id,
          period: targetPeriod,
          basic_salary: basic,
          net_salary: net,
          is_released: false, // Draf agar Finance bisa cek & sesuaikan
        };

        const { data: inserted } = await supabase
          .from('payslips')
          .insert(basePayload)
          .select('*, employees(full_name, branch)')
          .single();

        const slipId = inserted?.id || `gen-${emp.id}-${Date.now()}`;
        const item = {
          id: slipId,
          employee_id: emp.id,
          employee_name: emp.full_name,
          branch: emp.branch,
          period: targetPeriod,
          basic_salary: basic,
          child_allowance: child,
          spouse_allowance: spouse,
          position_allowance: pos,
          meal_allowance: meal,
          overtime_pay: approvedOtSum,
          plus_day_count: 0,
          plus_day_pay: 0,
          plus_day_note: '',
          meal_deduction: 0,
          attendance_deduction: 0,
          discipline_deduction: lateDeduction,
          cash_bon: 0,
          net_salary: net,
          is_released: false,
          created_at: inserted?.created_at || new Date().toISOString(),
        };

        newSlips.push(item);

        try {
          let savedDetails = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
          savedDetails[slipId] = item;
          localStorage.setItem('pwa_payslips_detail', JSON.stringify(savedDetails));
        } catch (e) {}
      }

      if (newSlips.length > 0) {
        setSalaryList((prev) => [...newSlips, ...prev]);
        setSalaryMsg({
          type: 'success',
          text: `⚡ Berhasil membuat ${newSlips.length} draft slip gaji untuk periode ${targetPeriod}!`,
        });
      }
    } catch (err) {
      console.error('Bulk generate error:', err);
      setSalaryMsg({ type: 'error', text: `Gagal generate massal: ${err.message}` });
    } finally {
      setIsBulkGenerating(false);
    }
  };

  // Handler Simpan / Perbarui Paket Master Gaji Karyawan
  const handleSaveStaffPackage = async (e) => {
    e.preventDefault();
    if (!editingStaffSalary) return;
    setSavingMaster(true);
    try {
      const empId = editingStaffSalary.id;
      const empName = editingStaffSalary.full_name;

      const updatedMap = {
        ...employeeSalaries,
        [empId]: {
          basic_salary: Number(editingStaffSalary.basic_salary || 0),
          position_allowance: Number(editingStaffSalary.position_allowance || 0),
          meal_allowance: Number(editingStaffSalary.meal_allowance || 0),
          child_allowance: Number(editingStaffSalary.child_allowance || 0),
          spouse_allowance: Number(editingStaffSalary.spouse_allowance || 0),
        },
        [empName]: {
          basic_salary: Number(editingStaffSalary.basic_salary || 0),
          position_allowance: Number(editingStaffSalary.position_allowance || 0),
          meal_allowance: Number(editingStaffSalary.meal_allowance || 0),
          child_allowance: Number(editingStaffSalary.child_allowance || 0),
          spouse_allowance: Number(editingStaffSalary.spouse_allowance || 0),
        },
      };

      await saveEmployeeSalaries(updatedMap);
      setEmployeeSalaries(updatedMap);
      setEditingStaffSalary(null);
      setSalaryMsg({
        type: 'success',
        text: `Berhasil memperbarui paket gaji master untuk ${empName}!`,
      });
    } catch (err) {
      console.error('Save staff package error:', err);
      setSalaryMsg({
        type: 'error',
        text: `Gagal menyimpan paket gaji master: ${err.message}`,
      });
    } finally {
      setSavingMaster(false);
    }
  };

  // Handler tombol [Edit] pada kartu slip gaji yang ada di daftar
  const handleEditExistingSlip = (slip) => {
    const parts = (slip.period || '').split(' ');
    if (parts.length === 2) {
      setSalaryMonth(parts[0]);
      setSalaryYear(parts[1]);
    }
    setNewSalary({
      existing_slip_id: slip.id,
      employee_name: slip.employee_name,
      employee_id: slip.employee_id,
      branch: slip.branch,
      period: slip.period,
      basic_salary: slip.basic_salary ?? 0,
      child_allowance: slip.child_allowance ?? 0,
      spouse_allowance: slip.spouse_allowance ?? 0,
      position_allowance: slip.position_allowance ?? 0,
      meal_allowance: slip.meal_allowance ?? 0,
      overtime_pay: slip.overtime_pay ?? 0,
      plus_day_count: slip.plus_day_count ?? 0,
      plus_day_pay: slip.plus_day_pay ?? 0,
      plus_day_note: slip.plus_day_note ?? '',
      meal_deduction: slip.meal_deduction ?? 0,
      attendance_deduction: slip.attendance_deduction ?? 0,
      discipline_deduction: slip.discipline_deduction ?? 0,
      cash_bon: slip.cash_bon ?? 0,
      is_released: slip.is_released ?? true,
    });
    setIsAddingSalary(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  // Kalkulasi total pendapatan (6 Komponen Tetap + Lembur + Perbantuan +Day)
  const calculateTotalIncome = (s) => {
    return (
      (Number(s.basic_salary) || 0) +
      (Number(s.child_allowance) || 0) +
      (Number(s.spouse_allowance) || 0) +
      (Number(s.position_allowance) || 0) +
      (Number(s.meal_allowance) || 0) +
      (Number(s.overtime_pay) || 0) +
      (Number(s.plus_day_pay) || 0)
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

    // Cek apakah mode edit/update atau buat baru (Opsi A: Mencegah Slip Ganda)
    const existingSlip = newSalary.existing_slip_id
      ? salaryList.find((s) => s.id === newSalary.existing_slip_id)
      : findExistingSlip(targetEmployee.id, targetEmployee.full_name, newSalary.period);

    const isUpdate = !!existingSlip;
    let savedId = existingSlip ? existingSlip.id : `sal_${Date.now()}`;
    let remoteCreated = existingSlip?.created_at || null;

    const basePayload = {
      employee_id: targetEmployee.id,
      period: newSalary.period,
      basic_salary: Number(newSalary.basic_salary || 0),
      attendance_allowance: Number(newSalary.meal_allowance || 0),
      transport_allowance: totalAllowances,
      overtime_pay: Number(newSalary.overtime_pay || 0),
      deductions: totalDeductions,
      net_salary: net,
      is_released: Boolean(newSalary.is_released),
    };

    try {
      if (isUpdate) {
        // UPDATE SLIP YANG SUDAH ADA (TIDAK MEMBUAT DUPLIKAT)
        const { error: updErr } = await supabase
          .from('payslips')
          .update(basePayload)
          .eq('id', savedId);

        if (updErr) {
          console.warn('Supabase payslips update error:', updErr);
        }
      } else {
        // INSERT SLIP BARU
        const { data: inserted, error: insertErr } = await supabase
          .from('payslips')
          .insert(basePayload)
          .select('*, employees(full_name, branch)')
          .single();

        if (!insertErr && inserted) {
          savedId = inserted.id;
          remoteCreated = inserted.created_at;
        } else if (insertErr) {
          console.warn('Supabase payslips insert error:', insertErr);
        }
      }

      // Hapus potensi baris duplikat lain di tabel Supabase untuk staf & periode ini
      if (targetEmployee.id && typeof targetEmployee.id === 'string' && targetEmployee.id.includes('-')) {
        await supabase
          .from('payslips')
          .delete()
          .eq('employee_id', targetEmployee.id)
          .eq('period', newSalary.period)
          .neq('id', savedId);
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
      plus_day_count: Number(newSalary.plus_day_count || 0),
      plus_day_pay: Number(newSalary.plus_day_pay || 0),
      plus_day_note: newSalary.plus_day_note || '',
      meal_deduction: Number(newSalary.meal_deduction || 0),
      attendance_deduction: Number(newSalary.attendance_deduction || 0),
      discipline_deduction: Number(newSalary.discipline_deduction || 0),
      cash_bon: Number(newSalary.cash_bon || 0),
      net_salary: net,
      is_released: Boolean(newSalary.is_released),
      created_at: remoteCreated || new Date().toISOString(),
    };

    // 2. Simpan rincian 11 komponen ke persistent cache (localStorage & cloud admin_settings)
    try {
      let savedDetails = {};
      if (typeof window !== 'undefined') {
        savedDetails = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
      }

      // Hapus SEMUA key lama di savedDetails untuk karyawan & periode yang sama
      const targetEmpName = (targetEmployee.full_name || '').toLowerCase().trim();
      const targetPeriod = (newSalary.period || '').toLowerCase().trim();

      for (const [k, v] of Object.entries(savedDetails)) {
        const vEmpName = (v.employee_name || '').toLowerCase().trim();
        const vPeriod = (v.period || '').toLowerCase().trim();
        const sameEmp =
          (v.employee_id && targetEmployee.id && v.employee_id === targetEmployee.id) ||
          (vEmpName === targetEmpName);
        const samePeriod = vPeriod === targetPeriod;
        if (sameEmp && samePeriod) {
          delete savedDetails[k];
        }
      }

      // Simpan item tunggal yang valid
      savedDetails[savedId] = item;

      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa_payslips_detail', JSON.stringify(savedDetails));
        window.dispatchEvent(new Event('pwa_payslips_detail_updated'));
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

    setSalaryList((prev) => {
      const targetEmpName = (targetEmployee.full_name || '').toLowerCase().trim();
      const targetPeriod = (newSalary.period || '').toLowerCase().trim();

      const filtered = prev.filter((s) => {
        if (s.id === savedId) return false;
        const sEmpName = (s.employee_name || '').toLowerCase().trim();
        const sPeriod = (s.period || '').toLowerCase().trim();
        const sameEmp =
          (s.employee_id && targetEmployee.id && s.employee_id === targetEmployee.id) ||
          (sEmpName === targetEmpName);
        const samePeriod = sPeriod === targetPeriod;
        if (sameEmp && samePeriod) return false;
        return true;
      });
      return [item, ...filtered];
    });
    setIsAddingSalary(false);
    setSalaryMsg({
      type: 'success',
      text: isUpdate
        ? `Slip gaji ${item.employee_name} (${item.period}) berhasil DIPERBARUI (data disinkronkan)!`
        : `Slip gaji ${item.employee_name} (${item.period}) berhasil DITERBITKAN!`,
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

    // 1. Update di persistent cache (localStorage & cloud admin_settings)
    try {
      let savedDetails = {};
      if (typeof window !== 'undefined') {
        savedDetails = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
      }
      try {
        const { data: remoteRow } = await supabase
          .from('admin_settings')
          .select('description')
          .eq('role', 'payslips_detail')
          .single();
        if (remoteRow && remoteRow.description) {
          savedDetails = { ...savedDetails, ...JSON.parse(remoteRow.description) };
        }
      } catch (e) {}

      // Cari entri yang cocok di savedDetails
      let matchedKey = id;
      if (!savedDetails[id]) {
        const targetEmpName = (targetSlip.employee_name || '').toLowerCase().trim();
        const targetPeriod = (targetSlip.period || '').toLowerCase().trim();
        const foundEntry = Object.entries(savedDetails).find(([, v]) => {
          const vEmpName = (v.employee_name || '').toLowerCase().trim();
          const vPeriod = (v.period || '').toLowerCase().trim();
          const sameEmp =
            (v.employee_id && targetSlip.employee_id && v.employee_id === targetSlip.employee_id) ||
            (vEmpName === targetEmpName);
          const samePeriod = vPeriod === targetPeriod;
          return sameEmp && samePeriod;
        });
        if (foundEntry) matchedKey = foundEntry[0];
      }

      if (savedDetails[matchedKey]) {
        savedDetails[matchedKey].is_released = newStatus;
      } else {
        savedDetails[matchedKey] = {
          ...targetSlip,
          is_released: newStatus,
        };
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa_payslips_detail', JSON.stringify(savedDetails));
        window.dispatchEvent(new Event('pwa_payslips_detail_updated'));
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
      console.warn('Persistent release toggle error:', e);
    }

    // 2. Update atau Upsert di Supabase tabel payslips resmi
    try {
      const { error: updErr } = await supabase
        .from('payslips')
        .update({ is_released: newStatus })
        .eq('id', id);

      if (updErr && targetSlip.employee_id && typeof targetSlip.employee_id === 'string' && targetSlip.employee_id.includes('-')) {
        await supabase.from('payslips').upsert({
          id: id,
          employee_id: targetSlip.employee_id,
          period: targetSlip.period,
          basic_salary: Number(targetSlip.basic_salary || 0),
          attendance_allowance: Number(targetSlip.meal_allowance || 0),
          transport_allowance: Number(targetSlip.transport_allowance || targetSlip.position_allowance || 0),
          overtime_pay: Number(targetSlip.overtime_pay || 0),
          deductions: Number(targetSlip.deductions || 0),
          net_salary: Number(targetSlip.net_salary || 0),
          is_released: newStatus,
        }, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Update payslip release status error:', e);
    }
  };

  const toggleSalaryRelease = handleToggleRelease;

  // Finance Setujui Lembur (Nominal Diinput & Ditentukan oleh Finance)
  const handleApproveOvertimeItem = async (ot, inputNominal = null) => {
    const finalNominal = inputNominal !== null && inputNominal !== undefined && inputNominal !== ''
      ? Number(inputNominal)
      : (ot.nominal > 0 ? Number(ot.nominal) : Number(ot.hours || 1) * 15000);

    setActionLoading(true);
    try {
      await approveOvertimeRequest(ot.id, finalNominal);
      setSalaryMsg({
        type: 'success',
        text: `Lembur ${ot.employee_name} (${ot.hours} Jam - Rp ${finalNominal.toLocaleString('id-ID')}) telah DISETUJUI & otomatis diagregasikan ke slip gaji!`,
      });
      setTimeout(() => setSalaryMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setSalaryMsg({ type: 'error', text: 'Gagal menyetujui lembur.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (ot) => {
    setRejectModal({
      open: true,
      otId: ot.id,
      employeeName: ot.employee_name,
      hours: ot.hours || 1,
      reason: '',
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectModal.reason.trim()) {
      alert('Mohon tuliskan alasan penolakan lembur.');
      return;
    }
    setActionLoading(true);
    try {
      await rejectOvertimeRequest(rejectModal.otId, rejectModal.reason.trim());
      setSalaryMsg({
        type: 'success',
        text: `Pengajuan lembur ${rejectModal.employeeName} ditolak. Alasan dicatat & akan tampil transparan pada slip gaji staf.`,
      });
      setTimeout(() => setSalaryMsg({ type: '', text: '' }), 4000);
      setRejectModal({ open: false, otId: null, employeeName: '', hours: 0, reason: '' });
    } catch (err) {
      setSalaryMsg({ type: 'error', text: 'Gagal menolak lembur.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Hapus Slip Gaji Langsung dari Kelola Gaji
  const handleDeleteSlip = async (slip) => {
    if (
      !window.confirm(
        `Yakin ingin menghapus slip gaji ${slip.employee_name} (${slip.period})? Data akan dihapus permanen dari sistem.`
      )
    ) {
      return;
    }

    try {
      // 1. Hapus dari Supabase tabel payslips
      const { error } = await supabase.from('payslips').delete().eq('id', slip.id);
      if (error) throw error;

      // 2. Hapus dari localStorage
      let currentDetails = {};
      if (typeof window !== 'undefined') {
        try {
          currentDetails = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
          delete currentDetails[slip.id];
          if (Object.keys(currentDetails).length > 0) {
            localStorage.setItem('pwa_payslips_detail', JSON.stringify(currentDetails));
          } else {
            localStorage.removeItem('pwa_payslips_detail');
          }
        } catch (e) {}
      }

      // 3. Update admin_settings di Supabase
      try {
        await supabase
          .from('admin_settings')
          .update({
            description: JSON.stringify(currentDetails),
            updated_at: new Date().toISOString(),
          })
          .eq('role', 'payslips_detail');
      } catch (e) {}

      // 4. Update state salaryList
      setSalaryList((prev) => prev.filter((s) => s.id !== slip.id));

      // 5. Tampilkan notifikasi
      setSalaryMsg({
        type: 'success',
        text: `Slip gaji ${slip.employee_name} (${slip.period}) berhasil dihapus permanen!`,
      });
      setTimeout(() => setSalaryMsg({ type: '', text: '' }), 4000);

      // 6. Broadcast event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pwa_payslips_deleted', { detail: { id: slip.id } }));
      }
    } catch (err) {
      console.error('Delete slip error:', err);
      setSalaryMsg({
        type: 'error',
        text: `Gagal menghapus slip gaji: ${err.message}`,
      });
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
              <DollarSign className="w-4 h-4 text-[#2563EB]" />
              <span>Dashboard Admin Finance</span>
              <span className="text-[9px] bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-black">
                Keuangan &amp; Payroll
              </span>
            </h3>
            <p className="text-[10px] text-slate-500">
              Kelola gaji 3 outlet &amp; persetujuan pengajuan lembur staf
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Tab Navigation: Scrollable Horizontal Menu */}
        <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-300/60 shadow-inner overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              type="button"
              onClick={() => setPayrollSubTab('manage')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                ['manage', 'master'].includes(payrollSubTab)
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Banknote className="w-4 h-4 shrink-0" />
              <span>Gaji</span>
            </button>

            <button
              type="button"
              onClick={() => setPayrollSubTab('overtime')}
              className={`px-3 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 relative shrink-0 cursor-pointer ${
                payrollSubTab === 'overtime'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className="truncate">Lembur</span>
              {pendingOvertimes.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs animate-pulse">
                  {pendingOvertimes.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPayrollSubTab('revenue')}
              className={`px-3 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                payrollSubTab === 'revenue'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>Revenue</span>
            </button>

            <button
              type="button"
              onClick={() => setPayrollSubTab('supplier')}
              className={`px-3 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                payrollSubTab === 'supplier'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>Bayar Supplier</span>
            </button>
          </div>

          {/* ================= NESTED TABS UNTUK GAJI ================= */}
          {['manage', 'master'].includes(payrollSubTab) && (
            <div className="bg-white p-1.5 rounded-2xl flex items-center gap-1.5 shadow-sm border border-slate-200 w-full mb-2">
              <button
                type="button"
                onClick={() => setPayrollSubTab('manage')}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  payrollSubTab === 'manage'
                    ? 'bg-[#2563EB]/10 text-[#2563EB] shadow-xs border border-[#2563EB]/20'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Kelola Slip
              </button>
              <button
                type="button"
                onClick={() => setPayrollSubTab('master')}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  payrollSubTab === 'master'
                    ? 'bg-[#2563EB]/10 text-[#2563EB] shadow-xs border border-[#2563EB]/20'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Master Data
              </button>
            </div>
          )}

          {/* ================= SUB-TAB: KELOLA REVENUE ================= */}
          {payrollSubTab === 'revenue' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Coming Soon!</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Fitur <strong>Kelola Revenue</strong> sedang dalam tahap pengembangan dan akan segera hadir.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= SUB-TAB: BAYAR SUPPLIER ================= */}
          {payrollSubTab === 'supplier' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                  <Database className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Pembayaran PO / Supplier</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                    Modul ini (Tahap 4) masih dalam pengembangan. Nantinya di sini Admin Finance dapat melihat daftar tagihan PO yang diteruskan oleh divisi Purchasing untuk dilunasi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= SUB-TAB: PERSETUJUAN LEMBUR ================= */}
          {payrollSubTab === 'overtime' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Banner Info Kebijakan Lembur */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-blue-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-300">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-wide flex items-center gap-1.5">
                        <span>Pusat Persetujuan Lembur Staf</span>
                        <span className="text-[9px] bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-black px-2 py-0.5 rounded-full">
                          Nominal Diinput Finance
                        </span>
                      </h4>
                      <p className="text-[10px] text-blue-200">
                        Leader mengajukan penugasan lembur, Finance mengambil keputusan resmi
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black bg-white/10 px-2.5 py-1 rounded-full border border-white/20 text-blue-100">
                      {pendingOvertimes.length} Menunggu
                    </span>
                    <button
                      type="button"
                      onClick={handleRefreshOvertimes}
                      disabled={isRefreshing}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black rounded-full border border-white/20 flex items-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50"
                      title="Muat ulang data lembur"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 1: Antrean Pengajuan yang Menunggu Persetujuan */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>Menunggu Keputusan Finance</span>
                        {pendingOvertimes.length > 0 && (
                          <span className="text-[9px] bg-rose-100 text-rose-800 font-black px-2 py-0.5 rounded-full">
                            Perlu Tindakan
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Tinjau jam lembur dan tentukan persetujuan
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full border border-orange-200">
                    {pendingOvertimes.length} Pengajuan
                  </span>
                </div>

                {pendingOvertimes.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-black text-slate-800">Semua Pengajuan Telah Diproses</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                      Tidak ada pengajuan lembur yang menunggu persetujuan dari Leader saat ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingOvertimes.map((ot) => {
                      const currentNominal = otNominals[ot.id] !== undefined
                        ? otNominals[ot.id]
                        : (ot.nominal > 0 ? ot.nominal : Number(ot.hours || 1) * 15000);

                      return (
                        <div
                          key={ot.id}
                          className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl hover:border-blue-200 transition space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900">{ot.employee_name}</span>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                                {ot.branch}
                              </span>
                              {ot.position && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                  {ot.position}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 font-medium">• {ot.date}</span>
                            </div>
                            <span className="text-[9px] font-black bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full border border-orange-200">
                              Menunggu Keputusan
                            </span>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Durasi Lembur:</span>
                                <span className="text-xs font-black text-slate-800">
                                  {ot.hours} Jam ({ot.position || 'Staff'})
                                </span>
                              </div>

                              <div className="w-full sm:w-60">
                                <label className="text-[10px] font-bold text-slate-700 block mb-1 flex items-center justify-between">
                                  <span>Nominal Uang Lembur:</span>
                                  <span className="text-[9px] text-[#2563EB] font-bold">Input oleh Finance</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">Rp</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="5000"
                                    value={currentNominal}
                                    onChange={(e) => setOtNominals({ ...otNominals, [ot.id]: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-white"
                                    placeholder="Contoh: 30000"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                              <span className="font-bold text-slate-700">Tugas / Catatan Leader: </span>
                              <span className="italic">&ldquo;{ot.reason}&rdquo;</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleApproveOvertimeItem(ot, currentNominal)}
                              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Setujui (Rp {Number(currentNominal || 0).toLocaleString('id-ID')})</span>
                            </button>

                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleOpenReject(ot)}
                              className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Riwayat Keputusan Lembur (ACC & Ditolak) */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        Riwayat Keputusan Lembur
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Arsip keputusan lembur yang telah disetujui atau ditolak Finance
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                    {processedOvertimes.length} Selesai
                  </span>
                </div>

                {processedOvertimes.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    Belum ada riwayat keputusan lembur yang tersimpan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const groupedOt = processedOvertimes.reduce((acc, ot) => {
                        const dateObj = new Date(ot.date);
                        const monthName = dateObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                        const period = isNaN(dateObj.getTime()) ? 'Periode Lainnya' : monthName;
                        if (!acc[period]) acc[period] = [];
                        acc[period].push(ot);
                        return acc;
                      }, {});

                      // Sort descending by date
                      const sortedPeriods = Object.entries(groupedOt).sort((a, b) => {
                        if (a[0] === 'Periode Lainnya') return 1;
                        if (b[0] === 'Periode Lainnya') return -1;
                        const dateA = new Date(a[1][0].date).getTime();
                        const dateB = new Date(b[1][0].date).getTime();
                        return dateB - dateA;
                      });

                      return sortedPeriods.map(([period, ots]) => {
                        const isExpanded = expandedOtHistoryPeriods[period] !== false; // default true
                        return (
                          <div key={period} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedOtHistoryPeriods(prev => ({ ...prev, [period]: !isExpanded }))}
                              className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                  <h4 className="text-xs font-black text-slate-900">{period}</h4>
                                  <p className="text-[10px] font-medium text-slate-500">{ots.length} Keputusan Lembur</p>
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="p-3 bg-white space-y-2 border-t border-slate-100">
                                {ots.map((ot) => {
                                  const isApproved = ot.status === 'Disetujui Finance';
                                  return (
                                    <div
                                      key={ot.id}
                                      className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-xs font-black text-slate-900">{ot.employee_name}</span>
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                            {ot.branch}
                                          </span>
                                          <span className="text-[10px] text-slate-500 font-medium">• {ot.date}</span>
                                          <span
                                            className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                              isApproved
                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                : 'bg-rose-100 text-rose-800 border-rose-200'
                                            }`}
                                          >
                                            {isApproved ? 'Disetujui Finance' : 'Ditolak Finance'}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600">
                                          Durasi: <strong className="text-slate-900">{ot.hours} Jam</strong> • Tugas: <span className="italic">{ot.reason}</span>
                                        </p>
                                        {!isApproved && ot.rejection_reason && (
                                          <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg font-medium">
                                            <strong>Alasan Penolakan: </strong>
                                            &ldquo;{ot.rejection_reason}&rdquo; <span className="text-[10px] text-rose-500 block sm:inline sm:ml-1">• Tampil di slip gaji staf</span>
                                          </p>
                                        )}
                                      </div>

                                      <div className="text-right shrink-0">
                                        {isApproved ? (
                                          <div>
                                            <span className="text-[10px] text-slate-400 block font-medium">Uang Lembur:</span>
                                            <span className="text-xs font-black text-emerald-600">
                                              +Rp {Number(ot.nominal || (ot.hours * (ot.hourly_rate || getOvertimeRateByPosition(ot.position)))).toLocaleString('id-ID')}
                                            </span>
                                            <span className="text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md block mt-1">
                                              Masuk Slip Gaji
                                            </span>
                                          </div>
                                        ) : (
                                          <div>
                                            <span className="text-[10px] text-rose-500 block font-bold">Lembur Dibatalkan</span>
                                            <span className="text-xs font-black text-slate-400">Rp 0</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= SUB-TAB: MASTER GAJI (DAFTAR GAJI STAF) ================= */}
          {payrollSubTab === 'master' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Header Banner Master Gaji */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-blue-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-300">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-wide flex items-center gap-1.5">
                        <span>Master Pengaturan Gaji Staf</span>
                        <span className="text-[9px] bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-black px-2 py-0.5 rounded-full">
                          Otomatisasi Payroll
                        </span>
                      </h4>
                      <p className="text-[10px] text-blue-200/80">
                        Atur Gaji Pokok &amp; 4 Tunjangan Tetap per staf (Jabatan, Makan, Anak, Keluarga/Istri).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback Message */}
              {salaryMsg.text && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{salaryMsg.text}</span>
                </div>
              )}

              {/* Search & Filter Outlet */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs space-y-2.5">
                {/* Outlet filter pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: 'all', label: 'Semua Outlet' },
                    { id: 'LazyBloom', label: 'LazyBloom' },
                    { id: 'Deru Ombak', label: 'Deru Ombak' },
                    { id: 'Sea Cafe', label: 'Sea Cafe' },
                    { id: 'Mobile / Lapangan', label: 'Mobile / Lapangan' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedOutletMaster(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition cursor-pointer ${
                        selectedOutletMaster === tab.id
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Staff Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={masterSearchQuery}
                    onChange={(e) => setMasterSearchQuery(e.target.value)}
                    placeholder="Cari nama staf di master gaji..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#2563EB] focus:outline-hidden"
                  />
                  {masterSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMasterSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Modal / Form Edit Paket Gaji Karyawan */}
              {editingStaffSalary && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
                  <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-blue-300" />
                        <div>
                          <h4 className="text-xs font-black">Atur Paket Gaji Tetap</h4>
                          <p className="text-[10px] text-blue-200">
                            {editingStaffSalary.full_name} • {editingStaffSalary.branch}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingStaffSalary(null)}
                        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveStaffPackage} className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
                      <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-[10px] text-blue-900">
                        Nilai ini tersimpan di sistem cloud dan otomatis diisikan ke form gaji bulanan staf <strong>{editingStaffSalary.full_name}</strong>.
                      </div>

                      {/* 0. Tanggal Gajian */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          Tanggal Gajian (Cut-Off)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editingStaffSalary.payday_date || '1'}
                          onChange={(e) => setEditingStaffSalary(prev => ({...prev, payday_date: e.target.value}))}
                          className="w-full text-xs font-bold text-slate-900 border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white cursor-text"
                          placeholder="Contoh: 1, 10, 15, 25"
                        />
                        <p className="text-[9px] text-slate-500 mt-1 px-1">
                          Jika diisi 1 = Hitungan dari tgl 1 s.d akhir bulan.<br/>
                          Jika diisi 16 = Hitungan dari tgl 16 bulan lalu s.d 15 bulan ini.
                        </p>
                      </div>

                      {/* Gaji Pokok */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          1. Gaji Pokok (Wajib)
                        </label>
                        <CurrencyInput
                          value={editingStaffSalary.basic_salary}
                          onChange={(val) =>
                            setEditingStaffSalary((prev) => ({ ...prev, basic_salary: val }))
                          }
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:bg-white"
                          placeholder="Rp 0"
                          required
                        />
                      </div>

                      {/* 4 Tunjangan Tetap */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            2. Tunjangan Jabatan
                          </label>
                          <CurrencyInput
                            value={editingStaffSalary.position_allowance}
                            onChange={(val) =>
                              setEditingStaffSalary((prev) => ({ ...prev, position_allowance: val }))
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                            placeholder="Rp 0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            3. Tunjangan Makan
                          </label>
                          <CurrencyInput
                            value={editingStaffSalary.meal_allowance}
                            onChange={(val) =>
                              setEditingStaffSalary((prev) => ({ ...prev, meal_allowance: val }))
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                            placeholder="Rp 0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            4. Tunjangan Anak
                          </label>
                          <CurrencyInput
                            value={editingStaffSalary.child_allowance}
                            onChange={(val) =>
                              setEditingStaffSalary((prev) => ({ ...prev, child_allowance: val }))
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                            placeholder="Rp 0"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            5. Tunjangan Keluarga / Istri
                          </label>
                          <CurrencyInput
                            value={editingStaffSalary.spouse_allowance}
                            onChange={(val) =>
                              setEditingStaffSalary((prev) => ({ ...prev, spouse_allowance: val }))
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                            placeholder="Rp 0"
                          />
                        </div>
                      </div>

                      {/* Summary Box */}
                      {(() => {
                        const totalTetap =
                          Number(editingStaffSalary.basic_salary || 0) +
                          Number(editingStaffSalary.position_allowance || 0) +
                          Number(editingStaffSalary.meal_allowance || 0) +
                          Number(editingStaffSalary.child_allowance || 0) +
                          Number(editingStaffSalary.spouse_allowance || 0);

                        return (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-emerald-900 block">Total Paket Tetap:</span>
                              <span className="text-[9px] text-emerald-700">Pokok + 4 Tunjangan</span>
                            </div>
                            <span className="font-black text-sm text-emerald-700">
                              Rp {totalTetap.toLocaleString('id-ID')}
                            </span>
                          </div>
                        );
                      })()}

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setEditingStaffSalary(null)}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={savingMaster}
                          className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {savingMaster ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>{savingMaster ? 'Menyimpan...' : 'Simpan Master Gaji'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Daftar Karyawan & Paket Gaji */}
              {(() => {
                const filteredStaff = employeesList
                  .filter((emp) => selectedOutletMaster === 'all' || emp.branch?.toLowerCase() === selectedOutletMaster.toLowerCase())
                  .filter((emp) =>
                    !masterSearchQuery
                      ? true
                      : emp.full_name?.toLowerCase().includes(masterSearchQuery.toLowerCase()) ||
                        emp.position?.toLowerCase().includes(masterSearchQuery.toLowerCase())
                  );

                if (filteredStaff.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 space-y-2">
                      <p className="text-xs font-bold">Tidak ada staf yang ditemukan</p>
                      <p className="text-[10px]">Coba ubah filter outlet atau kata kunci pencarian.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Menampilkan {filteredStaff.length} Staf ({selectedOutletMaster === 'all' ? 'Semua Outlet' : selectedOutletMaster})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {filteredStaff.map((emp) => {
                        const pkg = employeeSalaries[emp.id] || employeeSalaries[emp.full_name] || {};
                        const basic = Number(pkg.basic_salary || 0);
                        const pos = Number(pkg.position_allowance || 0);
                        const meal = Number(pkg.meal_allowance || 0);
                        const child = Number(pkg.child_allowance || 0);
                        const spouse = Number(pkg.spouse_allowance || 0);
                        const totalTetap = basic + pos + meal + child + spouse;
                        const isConfigured = basic > 0 || totalTetap > 0;

                        return (
                          <div
                            key={emp.id}
                            className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:border-blue-200 transition space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                  {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : 'S'}
                                </div>
                                <div>
                                  <h5 className="text-xs font-black text-slate-900 leading-tight">
                                    {emp.full_name}
                                  </h5>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-medium text-slate-500">
                                      {emp.position || 'Staff'}
                                    </span>
                                    <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded-md">
                                      {emp.branch}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingStaffSalary({
                                    id: emp.id,
                                    full_name: emp.full_name,
                                    branch: emp.branch,
                                    position: emp.position,
                                    basic_salary: basic,
                                    position_allowance: pos,
                                    meal_allowance: meal,
                                    child_allowance: child,
                                    spouse_allowance: spouse,
                                  })
                                }
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-[10px] font-black rounded-xl border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{isConfigured ? 'Ubah Paket' : 'Atur Paket'}</span>
                              </button>
                            </div>

                            {/* Rincian 5 Komponen Tetap */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-2 bg-slate-50 rounded-xl text-[10px]">
                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block">Gaji Pokok</span>
                                <span className="font-black text-slate-800">
                                  Rp {basic.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block">Tunj. Jabatan</span>
                                <span className="font-bold text-slate-700">
                                  Rp {pos.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block">Tunj. Makan</span>
                                <span className="font-bold text-slate-700">
                                  Rp {meal.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block">Tunj. Anak</span>
                                <span className="font-bold text-slate-700">
                                  Rp {child.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block">Tunj. Keluarga</span>
                                <span className="font-bold text-slate-700">
                                  Rp {spouse.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                              <span className="text-slate-500 font-medium">Total Paket Tetap Bulanan:</span>
                              <span className="font-black text-[#2563EB]">
                                Rp {totalTetap.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================= SUB-TAB: KELOLA GAJI ================= */}
          {payrollSubTab === 'manage' && (
            <div className="space-y-4">
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
                         <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleBulkGenerateSalary}
                  disabled={isBulkGenerating}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-black rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  title={`Generate draf gaji otomatis untuk seluruh staf ${selectedOutletSalary === 'all' ? 'Semua Outlet' : selectedOutletSalary}`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isBulkGenerating ? 'Memproses...' : 'Generate Massal'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingSalary(!isAddingSalary)}
                  className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-black rounded-xl flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Slip Gaji</span>
                </button>

                <button
                  type="button"
                  onClick={handleRefreshSalaries}
                  disabled={isRefreshing}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-xl flex items-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50"
                  title="Muat ulang data gaji"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black rounded-xl flex items-center gap-1 shadow-xs transition cursor-pointer"
                  title="Export seluruh slip gaji bulan ini ke CSV/Excel"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export Laporan</span>
                </button>
              </div>
            </div>

            {salaryMsg.text && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{salaryMsg.text}</span>
              </div>
            )}

            {/* Form Tambah / Edit Slip Gaji (Mode Ringkas & Pintar) */}
            {isAddingSalary && (
              <form onSubmit={handleSaveSalary} className="p-4 bg-slate-50/90 border border-blue-200 rounded-2xl space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h5 className="font-black text-xs text-[#2563EB] flex items-center gap-1.5">
                    <span>
                      {newSalary.existing_slip_id
                        ? 'Form Edit / Perbarui Slip Gaji (Mode Update)'
                        : 'Form Input Slip Gaji Ringkas (Smart View)'}
                    </span>
                  </h5>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      newSalary.existing_slip_id
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {newSalary.existing_slip_id ? 'Slip Sudah Ada (Edit)' : 'Slip Baru'}
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
                            {filteredStaff.map((emp) => {
                              const alreadyHasSlip = salaryList.some(
                                (s) =>
                                  (s.employee_id === emp.id || s.employee_name === emp.full_name) &&
                                  s.period === `${salaryMonth} ${salaryYear}`
                              );
                              return (
                                <option key={emp.id} value={emp.full_name}>
                                  {emp.full_name} ({emp.position || 'Staff'}) {alreadyHasSlip ? '• [Ada Slip]' : ''}
                                </option>
                              );
                            })}
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
                          const m = e.target.value;
                          setSalaryMonth(m);
                          if (newSalary.employee_name) {
                            populateSalaryForm(newSalary.employee_name, newSalary.branch, m, salaryYear);
                          } else {
                            setNewSalary((prev) => ({ ...prev, period: `${m} ${salaryYear}` }));
                          }
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
                          const y = e.target.value;
                          setSalaryYear(y);
                          if (newSalary.employee_name) {
                            populateSalaryForm(newSalary.employee_name, newSalary.branch, salaryMonth, y);
                          } else {
                            setNewSalary((prev) => ({ ...prev, period: `${salaryMonth} ${y}` }));
                          }
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

                {/* Banner Status & Tombol Pintasan Cepat */}
                {newSalary.employee_name && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
                      <div className="text-[10px] text-blue-900 leading-tight">
                        <span>Gaji staf <strong>{newSalary.employee_name}</strong></span>
                        {autoLateCount > 0 ? (
                          <span className="block text-rose-700 font-bold mt-0.5">
                            • Denda presensi: Rp {Number(newSalary.discipline_deduction).toLocaleString('id-ID')} (Terdeteksi {autoLateCount}x Terlambat)
                          </span>
                        ) : (
                          <span className="block text-emerald-700 font-medium mt-0.5">
                            • Presensi tepat waktu (Tidak ada denda)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tombol Salin dari Bulan Lalu */}
                    {(() => {
                      const prevPeriod = getPreviousPeriod(salaryMonth, salaryYear);
                      const prevSlip = prevPeriod ? findExistingSlip(newSalary.employee_id, newSalary.employee_name, prevPeriod) : null;
                      if (!prevSlip) return null;
                      return (
                        <button
                          type="button"
                          onClick={handleCopyPreviousSalary}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 text-[10px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                          title={`Salin data gaji dari periode ${prevPeriod}`}
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                          <span>Salin Gaji dari {prevPeriod}</span>
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* ================= 1. RINGKASAN DATA GAJI TETAP (DARI MASTER) ================= */}
                {newSalary.employee_name && (
                  <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-[11px] font-black uppercase text-blue-900 tracking-wider">
                          Data Gaji Tetap (Otomatis dari Master)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPayrollSubTab('master')}
                        className="text-[10px] font-black text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Buka tab Master Gaji untuk edit paket tetap staf ini"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Ubah di Master Gaji</span>
                      </button>
                    </div>

                    {/* Chips Nilai Tetap & Otomatis */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[8px] text-slate-400 font-bold block">Gaji Pokok</span>
                        <span className="font-black text-slate-800">
                          Rp {Number(newSalary.basic_salary || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[8px] text-slate-400 font-bold block">Tunj. Jabatan</span>
                        <span className="font-bold text-slate-700">
                          Rp {Number(newSalary.position_allowance || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[8px] text-slate-400 font-bold block">Tunj. Makan</span>
                        <span className="font-bold text-slate-700">
                          Rp {Number(newSalary.meal_allowance || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[8px] text-slate-400 font-bold block">Tunj. Anak &amp; Istri</span>
                        <span className="font-bold text-slate-700">
                          Rp {(Number(newSalary.child_allowance || 0) + Number(newSalary.spouse_allowance || 0)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Lembur: Rp {Number(newSalary.overtime_pay || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          Denda Presensi: Rp {Number(newSalary.discipline_deduction || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="font-black text-blue-900">
                        Total Tetap: Rp {(
                          Number(newSalary.basic_salary || 0) +
                          Number(newSalary.position_allowance || 0) +
                          Number(newSalary.meal_allowance || 0) +
                          Number(newSalary.child_allowance || 0) +
                          Number(newSalary.spouse_allowance || 0)
                        ).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= 2. FOKUS INPUT FINANCE: 3 POTONGAN VARIABEL ================= */}
                <div className="p-3.5 bg-white rounded-xl border-2 border-amber-300/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider">
                        Input Potongan Bulan Ini (Wajib Diisi Finance)
                      </span>
                    </div>
                    <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                      3 Kolom Potongan
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Finance hanya perlu mengisi potongan berikut untuk periode <strong>{newSalary.period}</strong> (biarkan Rp 0 jika tidak ada):
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. Potongan Cash Bon */}
                    <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-1">
                      <label className="block text-[10px] font-black text-amber-900">
                        1. Potongan Cash Bon (Kasbon)
                      </label>
                      <CurrencyInput
                        value={newSalary.cash_bon}
                        onChange={(val) => setNewSalary({ ...newSalary, cash_bon: val })}
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-rose-700 focus:outline-hidden focus:border-amber-500"
                        placeholder="Rp 0"
                      />
                      <span className="text-[8px] text-slate-500 block">Pinjaman staf bulan ini</span>
                    </div>

                    {/* 2. Potongan Makan */}
                    <div className="p-2.5 rounded-xl bg-rose-50/40 border border-rose-200 space-y-1">
                      <label className="block text-[10px] font-black text-rose-900">
                        2. Potongan Makan
                      </label>
                      <CurrencyInput
                        value={newSalary.meal_deduction}
                        onChange={(val) => setNewSalary({ ...newSalary, meal_deduction: val })}
                        className="w-full bg-white border border-rose-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-rose-700 focus:outline-hidden focus:border-rose-500"
                        placeholder="Rp 0"
                      />
                      <span className="text-[8px] text-slate-500 block">Biaya makan di outlet</span>
                    </div>

                    {/* 3. Potongan Kehadiran */}
                    <div className="p-2.5 rounded-xl bg-rose-50/40 border border-rose-200 space-y-1">
                      <label className="block text-[10px] font-black text-rose-900">
                        3. Potongan Kehadiran
                      </label>
                      <CurrencyInput
                        value={newSalary.attendance_deduction}
                        onChange={(val) => setNewSalary({ ...newSalary, attendance_deduction: val })}
                        className="w-full bg-white border border-rose-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-rose-700 focus:outline-hidden focus:border-rose-500"
                        placeholder="Rp 0"
                      />
                      <span className="text-[8px] text-slate-500 block">Absen tanpa keterangan / izin</span>
                    </div>
                  </div>
                </div>

                {/* Komponen Khusus: Perbantuan Hari Libur / Event (+Day) */}
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-800 flex items-center gap-1">
                      <Plus className="w-3 h-3 text-[#2563EB]" />
                      <span>Perbantuan Event / Hari Libur (+Day)</span>
                    </span>
                    <span className="text-[8px] text-slate-400">Opsional (isi jika ada tugas)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Jumlah Hari (+Day)</label>
                      <input
                        type="number"
                        min="0"
                        value={newSalary.plus_day_count || 0}
                        onChange={(e) =>
                          setNewSalary({
                            ...newSalary,
                            plus_day_count: Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                        placeholder="0 Hari"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Total Uang Perbantuan (Rp)</label>
                      <CurrencyInput
                        value={newSalary.plus_day_pay}
                        onChange={(val) => setNewSalary({ ...newSalary, plus_day_pay: val })}
                        className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-black text-emerald-700"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Keterangan Event (Opsional)</label>
                      <input
                        type="text"
                        value={newSalary.plus_day_note || ''}
                        onChange={(e) => setNewSalary({ ...newSalary, plus_day_note: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800"
                        placeholder="Contoh: Event Musik Weekend"
                      />
                    </div>
                  </div>
                </div>

                {/* ================= 3. ACCORDION: SESUAIKAN NILAI TETAP BULAN INI (JIKA ADA PENYESUAIAN) ================= */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowDetailedComponents(!showDetailedComponents)}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/30 text-xs font-bold text-slate-600 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sesuaikan Rincian Gaji Pokok / Tunjangan / Denda Bulan Ini (Opsional)</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        showDetailedComponents ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  {showDetailedComponents && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1.5">
                          Penyesuaian Pendapatan Khusus Bulan Ini:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Gaji Pokok</label>
                            <CurrencyInput
                              value={newSalary.basic_salary}
                              onChange={(val) => setNewSalary({ ...newSalary, basic_salary: val })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                              placeholder="Rp 0"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Tunjangan Jabatan</label>
                            <CurrencyInput
                              value={newSalary.position_allowance}
                              onChange={(val) => setNewSalary({ ...newSalary, position_allowance: val })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                              placeholder="Rp 0"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Tunjangan Makan</label>
                            <CurrencyInput
                              value={newSalary.meal_allowance}
                              onChange={(val) => setNewSalary({ ...newSalary, meal_allowance: val })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                              placeholder="Rp 0"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Tunjangan Anak</label>
                            <CurrencyInput
                              value={newSalary.child_allowance}
                              onChange={(val) => setNewSalary({ ...newSalary, child_allowance: val })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                              placeholder="Rp 0"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Tunjangan Istri</label>
                            <CurrencyInput
                              value={newSalary.spouse_allowance}
                              onChange={(val) => setNewSalary({ ...newSalary, spouse_allowance: val })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900"
                              placeholder="Rp 0"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Uang Lembur (Jam)</label>
                            <CurrencyInput
                              value={newSalary.overtime_pay}
                              onChange={(val) => setNewSalary({ ...newSalary, overtime_pay: val })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700"
                              placeholder="Rp 0"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">Denda Presensi</label>
                            <CurrencyInput
                              value={newSalary.discipline_deduction}
                              onChange={(val) => setNewSalary({ ...newSalary, discipline_deduction: val })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600"
                              placeholder="Rp 0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Rilis & Total Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Status Rilis Slip</label>
                    <select
                      value={newSalary.is_released ? 'true' : 'false'}
                      onChange={(e) => setNewSalary({ ...newSalary, is_released: e.target.value === 'true' })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 cursor-pointer"
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
                    onClick={() => {
                      setIsAddingSalary(false);
                      setShowDetailedComponents(false);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-blue-500/25 transition flex items-center gap-1.5 cursor-pointer ${
                      newSalary.existing_slip_id
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                    }`}
                  >
                    {newSalary.existing_slip_id ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Perbarui Slip Gaji Ini</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan &amp; Terbitkan Slip</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Filter Outlet */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold overflow-x-auto pb-1">
              <span className="text-slate-500">Filter Outlet:</span>
              {['all', 'LazyBloom', 'Deru Ombak', 'Sea Cafe', 'Mobile / Lapangan'].map((b) => (
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
            <div className="space-y-3">
              {(() => {
                const activeEmployeeIds = new Set(employeesList.map((e) => e.id));
                const filteredSalaries = salaryList.filter(
                  (s) => (selectedOutletSalary === 'all' || s.branch === selectedOutletSalary) && activeEmployeeIds.has(s.employee_id)
                );

                if (filteredSalaries.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Banknote className="w-5 h-5" />
                      </div>
                      <h5 className="text-xs font-bold text-slate-700">Belum Ada Data Penggajian</h5>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Klik tombol "+ Buat &amp; Terbitkan Slip Gaji Baru" di atas untuk memproses gaji dan denda staf.
                      </p>
                    </div>
                  );
                }

                // Group by period
                const grouped = filteredSalaries.reduce((acc, slip) => {
                  const p = slip.period || 'Periode Lainnya';
                  if (!acc[p]) acc[p] = [];
                  acc[p].push(slip);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([period, slips]) => {
                  const isExpanded = expandedPeriods[period] !== false; // default true
                  return (
                    <div key={period} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedPeriods(prev => ({ ...prev, [period]: !isExpanded }))}
                        className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <h4 className="text-xs font-black text-slate-900">{period}</h4>
                            <p className="text-[10px] font-medium text-slate-500">{slips.length} Slip Gaji</p>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="p-3 bg-white space-y-2 border-t border-slate-100">
                          {slips.map((slip) => (
                            <div
                              key={slip.id}
                              className="p-3.5 bg-white border border-slate-200/90 rounded-2xl flex flex-col gap-2.5 hover:border-slate-300 transition shadow-xs w-full overflow-hidden relative"
                            >
                              {slip.is_paid && (
                                <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Terbayarkan
                                </span>
                              )}
                              {/* Informasi Karyawan & Gaji */}
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h5 className="text-xs font-black text-slate-900 pr-16">{slip.employee_name}</h5>
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                    {slip.branch}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                                  <span className="font-black text-sm text-[#2563EB]">
                                    Rp {Number(slip.net_salary || 0).toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-slate-400 text-[10px]">
                                    (Gaji Pokok: Rp {Number(slip.basic_salary || 0).toLocaleString('id-ID')})
                                  </span>
                                </div>
                                {(Number(slip.plus_day_pay) > 0 || Number(slip.plus_day_count) > 0) && (
                                  <div className="mt-0.5">
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                                      +Day: {slip.plus_day_count || 0} Hari (+Rp {Number(slip.plus_day_pay || 0).toLocaleString('id-ID')})
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Tombol Aksi: Terbungkus Rapi di Dalam Kotak */}
                              <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 w-full">
                                {/* Tombol Status Rilis Slip */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleRelease(slip.id, slip.is_released)}
                                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                                    slip.is_released
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                                  }`}
                                  title={slip.is_released ? 'Klik untuk mengunci kembali slip gaji' : 'Klik untuk merilis slip ke staf'}
                                >
                                  {slip.is_released ? (
                                    <>
                                      <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>Rilis (Terbuka)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      <span>Terkunci (Draft)</span>
                                    </>
                                  )}
                                </button>

                                {/* Grup Tombol Cetak, Edit, Hapus */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setPrintModalSlip(slip)}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Pratinjau & Cetak Slip PDF Resmi"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Cetak</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleEditExistingSlip(slip)}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-50 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-slate-700 border border-slate-200 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Edit / Sesuaikan Slip Gaji Ini"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSlip(slip)}
                                    className="px-2 py-1.5 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Hapus Slip Gaji Ini Permanen"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Modal Pratinjau & Cetak Slip Gaji Resmi Kop 3 Pillar (Admin Finance) */}
      <PayslipPrintModal
        isOpen={!!printModalSlip}
        onClose={() => setPrintModalSlip(null)}
        slip={printModalSlip}
        user={null}
        approvedOvertimes={
          printModalSlip
            ? (overtimeRequests || []).filter(
                (ot) =>
                  ((printModalSlip.employee_id && ot.employee_id === printModalSlip.employee_id) ||
                    ot.employee_name === printModalSlip.employee_name) &&
                  getPeriodFromDate(ot.date) === printModalSlip.period &&
                  ot.status === 'Disetujui Finance'
              )
            : []
        }
        rejectedOvertimes={
          printModalSlip
            ? (overtimeRequests || []).filter(
                (ot) =>
                  ((printModalSlip.employee_id && ot.employee_id === printModalSlip.employee_id) ||
                    ot.employee_name === printModalSlip.employee_name) &&
                  getPeriodFromDate(ot.date) === printModalSlip.period &&
                  ot.status === 'Ditolak Finance'
              )
            : []
        }
      />
    </div>
  );
}
