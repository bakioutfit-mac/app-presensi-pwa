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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import SupabaseTableEditor from './SupabaseTableEditor';
import { formatRupiah, CurrencyInput, fetchEmployeeSalaries } from '@/lib/currency';
import { getPeriodFromDate, formatIndonesianDate } from '@/lib/date';
import PayslipPrintModal from './PayslipPrintModal';
import { getOvertimeRateByPosition } from '@/lib/overtimeRates';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const currentYearNum = new Date().getFullYear();
const YEARS = [currentYearNum - 1, currentYearNum, currentYearNum + 1, currentYearNum + 2].map(String);

export default function AdminFinanceDashboard({ onBack }) {
  const {
    outlets,
    updateOutletCoords,
    overtimeRequests,
    approveOvertimeRequest,
    rejectOvertimeRequest,
  } = useAuth();
  const [financeTab, setFinanceTab] = useState('payroll'); // 'payroll' | 'leaveApproval' | 'gpsConfig' | 'tableEditor'
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

  // ================= 1.5 PERSETUJUAN IZIN / SAKIT STAF =================
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [leaveFilter, setLeaveFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [leaveSearch, setLeaveSearch] = useState('');
  const [previewDocUrl, setPreviewDocUrl] = useState(null);
  const [rejectLeaveModal, setRejectLeaveModal] = useState({
    open: false,
    leaveId: null,
    staffName: '',
    leaveType: '',
    reason: '',
    rejectionNote: '',
  });

  const pendingLeaves = (leaveRequests || []).filter((l) => l.status === 'Menunggu');
  const approvedLeaves = (leaveRequests || []).filter((l) => l.status === 'Disetujui');
  const rejectedLeaves = (leaveRequests || []).filter((l) => l.status === 'Ditolak');
  const pendingLeavesCount = pendingLeaves.length;

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
    }
    loadInitialData();
    fetchLeaves();

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

    // Listener sinkronisasi permohonan izin staf
    const handleLeaveUpdate = () => {
      fetchLeaves();
    };
    window.addEventListener('pwa_leave_submitted', handleLeaveUpdate);
    window.addEventListener('pwa_leave_status_changed', handleLeaveUpdate);
    window.addEventListener('pwa_leave_deleted', handleLeaveUpdate);

    return () => {
      window.removeEventListener('pwa_salary_package_updated', handlePackageUpdate);
      window.removeEventListener('pwa_payslips_deleted', handlePayslipDeleted);
      window.removeEventListener('pwa_leave_submitted', handleLeaveUpdate);
      window.removeEventListener('pwa_leave_status_changed', handleLeaveUpdate);
      window.removeEventListener('pwa_leave_deleted', handleLeaveUpdate);
    };
  }, []);

  const fetchLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select('*, employees(full_name, branch, position)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setLeaveRequests(data);
      }
    } catch (err) {
      console.warn('Fetch leaves error:', err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const handleApproveLeave = async (leaveId) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('leaves')
        .update({ status: 'Disetujui' })
        .eq('id', leaveId);
      if (error) throw error;

      setLeaveRequests((prev) =>
        prev.map((l) => (l.id === leaveId ? { ...l, status: 'Disetujui' } : l))
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pwa_leave_status_changed', {
            detail: { id: leaveId, status: 'Disetujui' },
          })
        );
      }
      setSalaryMsg({ type: 'success', text: 'Pengajuan izin staf berhasil disetujui!' });
    } catch (err) {
      console.error('Approve leave error:', err);
      setSalaryMsg({ type: 'error', text: 'Gagal menyetujui izin: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRejectLeave = async () => {
    if (!rejectLeaveModal.leaveId) return;
    setActionLoading(true);
    try {
      const currentLeave = leaveRequests.find((l) => l.id === rejectLeaveModal.leaveId);
      const originalReason = currentLeave?.reason || '';
      const updatedReason = rejectLeaveModal.rejectionNote.trim()
        ? `${originalReason} (Alasan Tolak: ${rejectLeaveModal.rejectionNote.trim()})`
        : originalReason;

      const { error } = await supabase
        .from('leaves')
        .update({
          status: 'Ditolak',
          reason: updatedReason,
        })
        .eq('id', rejectLeaveModal.leaveId);
      if (error) throw error;

      setLeaveRequests((prev) =>
        prev.map((l) =>
          l.id === rejectLeaveModal.leaveId
            ? { ...l, status: 'Ditolak', reason: updatedReason }
            : l
        )
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pwa_leave_status_changed', {
            detail: { id: rejectLeaveModal.leaveId, status: 'Ditolak' },
          })
        );
      }
      setRejectLeaveModal({ open: false, leaveId: null, staffName: '', leaveType: '', reason: '', rejectionNote: '' });
      setSalaryMsg({ type: 'success', text: 'Pengajuan izin staf telah ditolak.' });
    } catch (err) {
      console.error('Reject leave error:', err);
      setSalaryMsg({ type: 'error', text: 'Gagal menolak izin: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

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
  const populateSalaryForm = (empName, branch, targetMonth, targetYear) => {
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
      return true;
    } else {
      // 2. JIKA BELUM ADA: Mode Buat Baru
      const pkg = staff ? (employeeSalaries[staff.id] || employeeSalaries[staff.full_name] || null) : null;
      const approvedOtSum = (overtimeRequests || [])
        .filter((ot) => {
          const matchEmp = (staff && ot.employee_id === staff.id) || ot.employee_name === empName;
          const matchPeriod = getPeriodFromDate(ot.date) === targetPeriod;
          return matchEmp && matchPeriod && ot.status === 'Disetujui Finance';
        })
        .reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);

      setNewSalary({
        existing_slip_id: null,
        employee_name: empName,
        employee_id: empId,
        branch: staff?.branch || branch,
        period: targetPeriod,
        basic_salary: pkg?.basic_salary ?? 0,
        child_allowance: pkg?.child_allowance ?? 0,
        spouse_allowance: pkg?.spouse_allowance ?? 0,
        position_allowance: pkg?.position_allowance ?? 0,
        meal_allowance: pkg?.meal_allowance ?? 0,
        overtime_pay: approvedOtSum,
        plus_day_count: 0,
        plus_day_pay: 0,
        plus_day_note: '',
        meal_deduction: 0,
        attendance_deduction: 0,
        discipline_deduction: 0,
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
      }));
    }
  };

  // Handler saat nama karyawan di dropdown form slip gaji dipilih
  const handleSelectEmployee = (empName) => {
    populateSalaryForm(empName, newSalary.branch, salaryMonth, salaryYear);
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
      <div className="grid grid-cols-4 gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl">
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
          <span className="truncate">Gaji 3 Outlet</span>
        </button>

        <button
          type="button"
          onClick={() => setFinanceTab('leaveApproval')}
          className={`py-2 px-1 text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 relative ${
            financeTab === 'leaveApproval'
              ? 'bg-white text-[#2563EB] shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="relative">
            <ClipboardCheck className="w-4 h-4" />
            {pendingLeavesCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                {pendingLeavesCount > 9 ? '9+' : pendingLeavesCount}
              </span>
            )}
          </div>
          <span className="truncate">Persetujuan Izin</span>
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
          <span className="truncate">Titik GPS</span>
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
          <span className="truncate">Tabel Editor</span>
        </button>
      </div>

      {/* ================= TAB 1: KELOLA GAJI 3 OUTLET ================= */}
      {financeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Sub-Tab Navigation: Kelola Gaji | Persetujuan Lembur */}
          <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-300/60 shadow-inner">
            <button
              type="button"
              onClick={() => setPayrollSubTab('manage')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
                payrollSubTab === 'manage'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Kelola Gaji</span>
            </button>

            <button
              type="button"
              onClick={() => setPayrollSubTab('overtime')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 relative ${
                payrollSubTab === 'overtime'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Persetujuan Lembur</span>
              {pendingOvertimes.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                  {pendingOvertimes.length}
                </span>
              )}
            </button>
          </div>

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
                  <span className="text-[10px] font-black bg-white/10 px-2.5 py-1 rounded-full border border-white/20 text-blue-100">
                    {pendingOvertimes.length} Menunggu
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/10 text-[11px] text-blue-100">
                  <div className="flex items-start gap-1.5 bg-white/5 p-2 rounded-xl border border-white/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold">Jika Di-ACC / Disetujui:</strong>
                      <span>Otomatis hilang dari antrean pending &amp; langsung masuk ke slip gaji bulan berjalan staf terkait.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 bg-white/5 p-2 rounded-xl border border-white/10">
                    <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold">Jika Ditolak:</strong>
                      <span>Finance wajib memberikan alasan penolakan. Alasan ini akan tampil transparan pada slip gaji staf.</span>
                    </div>
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
                  <div className="space-y-2">
                    {processedOvertimes.map((ot) => {
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

            {/* Form Tambah / Edit Slip Gaji (11 Komponen Resmi) */}
            {isAddingSalary && (
              <form onSubmit={handleSaveSalary} className="p-4 bg-slate-50/80 border border-blue-200 rounded-2xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h5 className="font-black text-xs text-[#2563EB] flex items-center gap-1.5">
                    <span>
                      {newSalary.existing_slip_id
                        ? 'Form Edit / Perbarui Slip Gaji (Mode Update)'
                        : 'Form Input Slip Gaji (11 Komponen Resmi)'}
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

                {/* Banner Status Mode Input vs Edit */}
                {newSalary.existing_slip_id ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2.5 shadow-xs">
                    <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-spin-reverse" />
                    <div>
                      <span className="font-black block text-amber-900">
                        Mode Edit / Perbarui Aktif (Pencegahan Slip Ganda)
                      </span>
                      <p className="text-[10px] text-amber-800 leading-relaxed mt-0.5">
                        Slip gaji periode <strong>{newSalary.period}</strong> untuk <strong>{newSalary.employee_name}</strong> sudah pernah diterbitkan. Data di bawah otomatis dimuat dari slip sebelumnya. Perubahan akan <strong>memperbarui slip yang tersimpan</strong> dan tidak akan membuat data ganda.
                      </p>
                    </div>
                  </div>
                ) : newSalary.employee_name ? (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[10px] text-blue-900 flex items-center justify-between">
                    <span>
                      ✨ Paket gaji otomatis terisi. Finance cukup cek <strong>Lembur</strong> atau <strong>+Day (Perbantuan)</strong> jika ada.
                    </span>
                    <span className="font-bold text-blue-700">{newSalary.employee_name}</span>
                  </div>
                ) : null}

                {/* 1. BAGIAN PENDAPATAN (7 KOMPONEN: 5 POKOK/TUNJANGAN + LEMBUR + PERBANTUAN +DAY) */}
                <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-blue-50">
                    <span className="text-[11px] font-black uppercase text-[#2563EB] tracking-wider">
                      1. Penghasilan / Pendapatan (7 Komponen)
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
                      <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Uang Lembur (Jam)</label>
                      <CurrencyInput
                        value={newSalary.overtime_pay}
                        onChange={(val) => setNewSalary({ ...newSalary, overtime_pay: val })}
                        className="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg px-2 py-1 text-xs font-bold"
                        placeholder="Rp 0"
                      />
                    </div>

                    {/* Komponen Khusus: Perbantuan Hari Libur / Event (+Day) */}
                    <div className="col-span-2 sm:col-span-3 pt-2 border-t border-blue-100">
                      <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-blue-900 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-blue-600" />
                            <span>Perbantuan Hari Libur / Event (+Day)</span>
                          </span>
                          <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                            Tarif Fleksibel Sesuai Event &amp; Posisi
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                              Jumlah Hari (+Day)
                            </label>
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
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900"
                              placeholder="0 Hari"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                              Total Uang Perbantuan (Rp)
                            </label>
                            <CurrencyInput
                              value={newSalary.plus_day_pay}
                              onChange={(val) => setNewSalary({ ...newSalary, plus_day_pay: val })}
                              className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs font-black text-emerald-700"
                              placeholder="Rp 0"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-600 mb-0.5">
                              Keterangan Event / Posisi (Opsional)
                            </label>
                            <input
                              type="text"
                              value={newSalary.plus_day_note || ''}
                              onChange={(e) => setNewSalary({ ...newSalary, plus_day_note: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800"
                              placeholder="Contoh: Event Musik Weekend Deru Ombak"
                            />
                          </div>
                        </div>
                      </div>
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
                    className={`px-4 py-1.5 rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
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
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-xs font-black text-slate-900">{slip.employee_name}</h5>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            {slip.branch}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">• {slip.period}</span>
                          {(Number(slip.plus_day_pay) > 0 || Number(slip.plus_day_count) > 0) && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              +Day: {slip.plus_day_count || 0} Hari (+Rp {Number(slip.plus_day_pay || 0).toLocaleString('id-ID')})
                            </span>
                          )}
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
                          onClick={() => setPrintModalSlip(slip)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Pratinjau & Cetak Slip PDF Resmi"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          <span>Cetak</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditExistingSlip(slip)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-slate-700 border border-slate-200 transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Edit / Sesuaikan Slip Gaji Ini"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>

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

                        <button
                          type="button"
                          onClick={() => handleDeleteSlip(slip)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Hapus Slip Gaji Ini Permanen"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* ================= TAB 1.5: PERSETUJUAN IZIN & SAKIT STAF ================= */}
      {financeTab === 'leaveApproval' && (
        <div className="bg-white/90 border border-gray-200 rounded-2xl p-4 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#2563EB]" />
                <span>Persetujuan Izin & Sakit Staf 3 Outlet</span>
              </h4>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Verifikasi, tinjau bukti surat dokter, dan berikan persetujuan atau penolakan pengajuan izin staf.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLeaves}
              disabled={loadingLeaves}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaves ? 'animate-spin text-[#2563EB]' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>

          {/* Sub-filter status dan Search */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setLeaveFilter('pending')}
                className={`py-1.5 px-3 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 ${
                  leaveFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Menunggu Approval</span>
                {pendingLeaves.length > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    leaveFilter === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
                  }`}>
                    {pendingLeaves.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setLeaveFilter('approved')}
                className={`py-1.5 px-3 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 ${
                  leaveFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Disetujui ({approvedLeaves.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setLeaveFilter('rejected')}
                className={`py-1.5 px-3 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 ${
                  leaveFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Ditolak ({rejectedLeaves.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setLeaveFilter('all')}
                className={`py-1.5 px-3 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 ${
                  leaveFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Semua ({leaveRequests.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama staf, outlet, alasan, atau jenis izin..."
                value={leaveSearch}
                onChange={(e) => setLeaveSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
              {leaveSearch && (
                <button
                  type="button"
                  onClick={() => setLeaveSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Cards Pengajuan Izin */}
          <div className="space-y-3 pt-1">
            {loadingLeaves ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
                <span>Memuat data pengajuan izin staf...</span>
              </div>
            ) : (leaveRequests || []).filter((l) => {
              if (leaveFilter === 'pending' && l.status !== 'Menunggu') return false;
              if (leaveFilter === 'approved' && l.status !== 'Disetujui') return false;
              if (leaveFilter === 'rejected' && l.status !== 'Ditolak') return false;
              if (leaveSearch.trim()) {
                const q = leaveSearch.toLowerCase();
                const name = (l.employees?.full_name || '').toLowerCase();
                const branch = (l.branch || l.employees?.branch || '').toLowerCase();
                const reason = (l.reason || '').toLowerCase();
                const type = (l.leave_type || '').toLowerCase();
                return name.includes(q) || branch.includes(q) || reason.includes(q) || type.includes(q);
              }
              return true;
            }).length === 0 ? (
              <div className="py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  {leaveFilter === 'pending'
                    ? 'Tidak ada pengajuan izin yang menunggu persetujuan.'
                    : 'Tidak ada data pengajuan izin yang sesuai filter.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {leaveFilter === 'pending'
                    ? 'Semua permohonan izin staf telah diproses.'
                    : 'Coba ubah kata kunci pencarian atau ganti filter di atas.'}
                </p>
              </div>
            ) : (
              (leaveRequests || [])
                .filter((l) => {
                  if (leaveFilter === 'pending' && l.status !== 'Menunggu') return false;
                  if (leaveFilter === 'approved' && l.status !== 'Disetujui') return false;
                  if (leaveFilter === 'rejected' && l.status !== 'Ditolak') return false;
                  if (leaveSearch.trim()) {
                    const q = leaveSearch.toLowerCase();
                    const name = (l.employees?.full_name || '').toLowerCase();
                    const branch = (l.branch || l.employees?.branch || '').toLowerCase();
                    const reason = (l.reason || '').toLowerCase();
                    const type = (l.leave_type || '').toLowerCase();
                    return name.includes(q) || branch.includes(q) || reason.includes(q) || type.includes(q);
                  }
                  return true;
                })
                .map((leave) => {
                  const empName = leave.employees?.full_name || 'Staf';
                  const branchName = leave.branch || leave.employees?.branch || 'LazyBloom';
                  const position = leave.employees?.position || '-';
                  const isPending = leave.status === 'Menunggu';
                  const isApproved = leave.status === 'Disetujui';
                  const isRejected = leave.status === 'Ditolak';

                  const startDateStr = formatIndonesianDate(leave.start_date);
                  const endDateStr = formatIndonesianDate(leave.end_date);
                  const dateDisplay =
                    leave.start_date === leave.end_date
                      ? `${startDateStr} (1 hari)`
                      : `${startDateStr} s/d ${endDateStr}`;

                  return (
                    <div
                      key={leave.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPending
                          ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                          : isApproved
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50 border-slate-200 opacity-90'
                      }`}
                    >
                      {/* Header Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {empName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h5 className="font-extrabold text-xs text-slate-900 leading-tight">
                              {empName}
                            </h5>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded-md border border-blue-200">
                                {branchName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {position}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                              <span>Menunggu Approval</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Disetujui</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Ditolak</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Box */}
                      <div className="mt-3 p-3 bg-white rounded-xl border border-slate-100 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Kategori Izin</span>
                            <span className="font-extrabold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                              {leave.leave_type}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Rentang Tanggal</span>
                            <span className="font-bold text-slate-800 block mt-0.5">
                              {dateDisplay}
                            </span>
                          </div>
                        </div>

                        {leave.leave_type === 'Izin Terlambat' && Number(leave.late_duration_minutes) > 0 && (
                          <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              Durasi Terlambat: <strong>{leave.late_duration_minutes} Menit</strong>
                              {Number(leave.late_duration_minutes) > 30 ? ' (Otomatis nonaktifkan presensi)' : ' (Presensi tetap dibuka)'}
                            </span>
                          </div>
                        )}

                        <div>
                          <span className="text-slate-400 block text-[10px]">Alasan / Keterangan:</span>
                          <p className="text-slate-700 text-[11px] italic bg-slate-50 p-2 rounded-lg mt-0.5 border border-slate-100">
                            &ldquo;{leave.reason || 'Tidak ada keterangan khusus'}&rdquo;
                          </p>
                        </div>

                        {/* Bukti Dokumen */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                          <span className="text-slate-400">Lampiran Dokumen:</span>
                          {leave.document_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewDocUrl(leave.document_url)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-bold rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Surat / Bukti</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">
                              Tanpa lampiran dokumen
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex items-center gap-2">
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleApproveLeave(leave.id)}
                              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Setujui Izin</span>
                            </button>

                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                setRejectLeaveModal({
                                  open: true,
                                  leaveId: leave.id,
                                  staffName: empName,
                                  leaveType: leave.leave_type,
                                  reason: leave.reason || '',
                                  rejectionNote: '',
                                })
                              }
                              className="py-2 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          </>
                        ) : (
                          <div className="w-full flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span>
                              Status: <strong className={isApproved ? 'text-emerald-600' : 'text-rose-600'}>{leave.status}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isApproved) {
                                  setRejectLeaveModal({
                                    open: true,
                                    leaveId: leave.id,
                                    staffName: empName,
                                    leaveType: leave.leave_type,
                                    reason: leave.reason || '',
                                    rejectionNote: '',
                                  });
                                } else {
                                  handleApproveLeave(leave.id);
                                }
                              }}
                              className="text-[10px] text-slate-500 underline hover:text-slate-800 cursor-pointer"
                            >
                              {isApproved ? 'Ubah ke Tolak' : 'Ubah ke Setujui'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
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

      {/* ================= MODAL PENOLAKAN LEMBUR ================= */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Tolak Pengajuan Lembur</h3>
                  <p className="text-xs text-slate-500">
                    {rejectModal.employeeName} ({rejectModal.hours} Jam)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModal({ open: false, otId: null, employeeName: '', hours: 0, reason: '' })}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Alasan Penolakan <span className="text-rose-500">* (Wajib - tampil di slip gaji staf)</span>
              </label>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                placeholder="Contoh: Melebihi batas kuota lembur bulan ini / Pekerjaan dapat diselesaikan di jam reguler"
                className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Catatan: Alasan ini wajib diisi oleh Finance dan akan langsung tampil secara transparan pada rincian slip gaji karyawan yang bersangkutan.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRejectModal({ open: false, otId: null, employeeName: '', hours: 0, reason: '' })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectModal.reason.trim()}
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Menyimpan...' : 'Konfirmasi Tolak'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Surat Dokter / Bukti Dokumen */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-slate-100 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <h4 className="font-extrabold text-xs text-slate-800">
                  Pratinjau Surat Dokter / Dokumen Izin
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocUrl(null)}
                className="p-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto bg-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewDocUrl}
                alt="Surat Dokter / Bukti Izin"
                className="max-h-[60vh] w-auto object-contain rounded-xl shadow-md"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '';
                }}
              />
            </div>

            <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
              <a
                href={previewDocUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#2563EB] hover:underline"
              >
                Buka di Tab Baru &rarr;
              </a>
              <button
                type="button"
                onClick={() => setPreviewDocUrl(null)}
                className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Penolakan Izin Staf */}
      {rejectLeaveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">
                    Tolak Pengajuan Izin
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {rejectLeaveModal.staffName} ({rejectLeaveModal.leaveType})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRejectLeaveModal({ open: false, leaveId: null, staffName: '', leaveType: '', reason: '', rejectionNote: '' })
                }
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-[11px] font-bold text-slate-700">
                Alasan Penolakan (akan dicatat di sistem):
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Bukti surat dokter kurang jelas, atau shift tidak memungkinkan cuti..."
                value={rejectLeaveModal.rejectionNote}
                onChange={(e) =>
                  setRejectLeaveModal((prev) => ({ ...prev, rejectionNote: e.target.value }))
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setRejectLeaveModal({ open: false, leaveId: null, staffName: '', leaveType: '', reason: '', rejectionNote: '' })
                }
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRejectLeave}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Menyimpan...' : 'Konfirmasi Tolak'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
