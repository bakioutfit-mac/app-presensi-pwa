'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  Activity,
  MapPin,
  Lock,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Camera,
  Search,
  Filter,
  Users,
  Check,
  X,
  FileText,
  KeyRound,
  Compass,
  AlertCircle,
  Sliders,
  DollarSign,
  Briefcase,
  ChevronRight,
  EyeOff,
  MessageCircle,
  RotateCcw,
  Smartphone,
  Plus,
  Trash2,
  Edit3,
  UserPlus,
  Crown,
  ChevronDown,
  ChevronUp,
  Receipt,
  Banknote,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getLocalDateString, parseLocalDate } from '@/lib/date';
import { formatRupiah } from '@/lib/currency';
import BrandLogo from './BrandLogo';
import OwnerMonitoringTab from './tabs/owner/OwnerMonitoringTab';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const getPeriodLabel = (dateString) => {
  if (!dateString) return 'Periode Tidak Diketahui';
  const str = String(dateString);
  let year, month;
  if (str.includes('T')) {
    const d = new Date(str);
    year = d.getFullYear();
    month = d.getMonth();
  } else {
    const parts = str.split('-');
    if (parts.length >= 3) {
      year = parts[0];
      month = parseInt(parts[1], 10) - 1;
    } else {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
        month = d.getMonth();
      }
    }
  }
  if (isNaN(year) || isNaN(month)) return 'Periode Tidak Diketahui';
  return `${MONTH_NAMES[month]} ${year}`;
};

const groupDataByPeriod = (data, dateField) => {
  const grouped = {};
  data.forEach((item) => {
    const label = getPeriodLabel(item[dateField]);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(item);
  });
  return grouped;
};

export default function AdminOwnerDashboard({ onBack }) {
  const {
    user,
    adminPins,
    updateAdminPin,
    updateOutletCoords,
    outlets,
    lateCorrections,
    approveLateCorrection,
    rejectLateCorrection,
    loadLateCorrections,
    approveLeaveRequest,
    rejectLeaveRequest,
  } = useAuth();

  // Active Tab: 'monitoring' | 'approvals' | 'gps' | 'security'
  const [activeTab, setActiveTab] = useState('monitoring');

  // Subtab for Approvals: 'leaves' | 'corrections'
  const [approvalSubTab, setApprovalSubTab] = useState('leaves');

  // Accordion state for grouping
  const [expandedLeavePeriods, setExpandedLeavePeriods] = useState({});
  const toggleLeavePeriod = (period) => {
    setExpandedLeavePeriods((prev) => ({ ...prev, [period]: !prev[period] }));
  };

  const [expandedCorrectionPeriods, setExpandedCorrectionPeriods] = useState({});
  const toggleCorrectionPeriod = (period) => {
    setExpandedCorrectionPeriods((prev) => ({ ...prev, [period]: !prev[period] }));
  };

  // Outlet Filter
  const [selectedOutlet, setSelectedOutlet] = useState('all');

  // Notifications / Alert message
  const [toastMsg, setToastMsg] = useState({ type: '', text: '' });
  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg({ type: '', text: '' }), 4000);
  };

  // ================= 1.5 OUTLET CASH REPORTS STATE =================
  const [cashierReports, setCashierReports] = useState([]);
  const [loadingCashierReports, setLoadingCashierReports] = useState(false);
  const [selectedCashierOutlet, setSelectedCashierOutlet] = useState('all');
  const [cashierDateFilter, setCashierDateFilter] = useState(getLocalDateString());
  const [selectedReportDetail, setSelectedReportDetail] = useState(null);
  const [verifyingReportId, setVerifyingReportId] = useState(null);
  const [expandedReports, setExpandedReports] = useState({});

  const toggleExpandReport = (id) => {
    setExpandedReports((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const fetchCashierReports = async () => {
    setLoadingCashierReports(true);
    try {
      let query = supabase
        .from('outlet_cash_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (cashierDateFilter) {
        query = query.eq('report_date', cashierDateFilter);
      }

      const { data, error } = await query;
      let combined = [];

      if (!error && Array.isArray(data)) {
        combined = [...data];
      }

      // Check resilient local storage cache
      try {
        const local = JSON.parse(localStorage.getItem('pwa_outlet_cash_reports') || '[]');
        if (Array.isArray(local)) {
          local.forEach((item) => {
            if (!combined.some((c) => c.id === item.id)) {
              if (!cashierDateFilter || item.report_date === cashierDateFilter) {
                combined.push(item);
              }
            }
          });
        }
      } catch (e) {}

      combined.sort((a, b) => new Date(b.created_at || b.report_date) - new Date(a.created_at || a.report_date));
      setCashierReports(combined);
    } catch (err) {
      console.warn('Fetch cashier reports error:', err);
    } finally {
      setLoadingCashierReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'cashier') {
      fetchCashierReports();
    }
  }, [activeTab, cashierDateFilter]);

  const handleVerifyCashierReport = async (report) => {
    if (!report?.id) return;
    setVerifyingReportId(report.id);
    try {
      const { error } = await supabase
        .from('outlet_cash_reports')
        .update({ status: 'Diverifikasi Owner' })
        .eq('id', report.id);

      if (error) console.warn('Supabase verify report warning:', error);

      setCashierReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: 'Diverifikasi Owner' } : r))
      );

      try {
        const local = JSON.parse(localStorage.getItem('pwa_outlet_cash_reports') || '[]');
        const updated = local.map((r) => (r.id === report.id ? { ...r, status: 'Diverifikasi Owner' } : r));
        localStorage.setItem('pwa_outlet_cash_reports', JSON.stringify(updated));
      } catch (e) {}

      if (selectedReportDetail?.id === report.id) {
        setSelectedReportDetail((prev) => ({ ...prev, status: 'Diverifikasi Owner' }));
      }

      showToast('success', `Laporan ${report.branch} (${report.shift_name}) berhasil diverifikasi!`);
    } catch (e) {
      showToast('error', 'Gagal memverifikasi laporan.');
    } finally {
      setVerifyingReportId(null);
    }
  };

  // ================= 2. APPROVALS STATE =================
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [leaveFilter, setLeaveFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [previewDocUrl, setPreviewDocUrl] = useState(null);
  const [rejectNoteModal, setRejectNoteModal] = useState({ open: false, type: '', id: '', name: '', note: '' });

  const fetchLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select(`*, employees:employee_id (full_name, phone, branch, position)`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setLeaveRequests(data);
      }
    } catch (e) {
      console.warn('Fetch leaves error:', e);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const [loadingCorrections, setLoadingCorrections] = useState(false);

  const handleRefreshCorrections = async () => {
    setLoadingCorrections(true);
    if (typeof loadLateCorrections === 'function') {
      await loadLateCorrections();
    }
    setLoadingCorrections(false);
  };

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchLeaves();
      handleRefreshCorrections();
    }
  }, [activeTab]);

  const handleApproveLeave = async (leaveId, staffName) => {
    const res = await approveLeaveRequest(leaveId);
    if (res.success) {
      showToast('success', `Pengajuan izin ${staffName || ''} berhasil DISETUJUI.`);
      fetchLeaves();
    } else {
      showToast('error', res.error || 'Gagal menyetujui izin.');
    }
  };

  const handleOpenRejectModal = (type, id, name) => {
    setRejectNoteModal({ open: true, type, id, name, note: '' });
  };

  const handleConfirmReject = async () => {
    const { type, id, name, note } = rejectNoteModal;
    if (!note.trim()) {
      alert('Mohon isi alasan penolakan.');
      return;
    }

    if (type === 'leave') {
      const res = await rejectLeaveRequest(id, note.trim());
      if (res.success) {
        showToast('success', `Pengajuan izin ${name} ditolak.`);
        fetchLeaves();
      } else {
        showToast('error', res.error || 'Gagal menolak izin.');
      }
    } else if (type === 'correction') {
      const res = await rejectLateCorrection(id, note.trim());
      if (res.success) {
        showToast('success', `Koreksi keterlambatan ${name} ditolak.`);
      } else {
        showToast('error', 'Gagal menolak koreksi.');
      }
    }

    setRejectNoteModal({ open: false, type: '', id: '', name: '', note: '' });
  };

  const handleApproveCorrection = async (correctionId, staffName) => {
    const res = await approveLateCorrection(correctionId, 'Disetujui & Denda Dihapuskan oleh Owner');
    if (res.success) {
      showToast('success', `Koreksi keterlambatan ${staffName || ''} DISETUJUI. Denda Rp 10.000 telah dibebaskan.`);
    } else {
      showToast('error', 'Gagal menyetujui koreksi.');
    }
  };

  // Filter leaves
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'Menunggu');
  const filteredLeaves = leaveRequests.filter((l) => {
    if (leaveFilter === 'pending') return l.status === 'Menunggu';
    if (leaveFilter === 'approved') return l.status === 'Disetujui';
    if (leaveFilter === 'rejected') return l.status === 'Ditolak';
    return true;
  });

  const pendingCorrections = (lateCorrections || []).filter((c) => c.status === 'pending');

  // ================= 3. GPS CONFIG STATE =================
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
  const [detectingGpsOutlet, setDetectingGpsOutlet] = useState(null);

  const handleGpsInputChange = (outletId, field, val) => {
    setGpsForm((prev) => ({
      ...prev,
      [outletId]: {
        ...prev[outletId],
        [field]: val,
      },
    }));
  };

  const handleDetectCurrentGPS = (outletId) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      showToast('error', 'Browser tidak mendukung GPS Geolocation.');
      return;
    }
    setDetectingGpsOutlet(outletId);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsForm((prev) => ({
          ...prev,
          [outletId]: {
            ...prev[outletId],
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          },
        }));
        setDetectingGpsOutlet(null);
        showToast('success', `GPS berhasil dideteksi: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        setDetectingGpsOutlet(null);
        showToast('error', `Gagal mendeteksi GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveGPS = async (outletId) => {
    const data = gpsForm[outletId];
    if (!data?.lat || !data?.lng) {
      showToast('error', 'Latitude dan Longitude wajib diisi desimal valid!');
      return;
    }
    const res = await updateOutletCoords(outletId, data);
    if (res.success) {
      const targetName = safeOutlets.find((o) => o.id === outletId)?.name || 'Outlet';
      showToast('success', `Koordinat & radius GPS ${targetName} berhasil diperbarui!`);
    } else {
      showToast('error', 'Gagal menyimpan koordinat GPS.');
    }
  };

  // ================= 4. PIN SECURITY & STAFF PIN RESET STATE =================
  const [securitySubTab, setSecuritySubTab] = useState('staff'); // 'staff' | 'management'
  const [pinsInput, setPinsInput] = useState({
    owner: adminPins?.owner || '123123',
    leader: adminPins?.leader || '987321',
    finance: adminPins?.finance || '020103',
  });
  const [pinLoadingRole, setPinLoadingRole] = useState(null);
  const [showMasterPins, setShowMasterPins] = useState(false);

  // Staff PIN State
  const [staffList, setStaffList] = useState([]);
  const [loadingStaffList, setLoadingStaffList] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [selectedStaffOutlet, setSelectedStaffOutlet] = useState('all');
  const [pinModalStaff, setPinModalStaff] = useState(null); // { id, full_name, phone, branch, pin, newPin }
  const [resettingStaffId, setResettingStaffId] = useState(null);
  const [revealedPins, setRevealedPins] = useState({});

  // Management Multi-Admin State (Owner/Investor, Leader, Finance)
  const [managementList, setManagementList] = useState([]);
  const [loadingManagement, setLoadingManagement] = useState(false);
  const [selectedMgmtRole, setSelectedMgmtRole] = useState('all');
  const [mgmtSearchQuery, setMgmtSearchQuery] = useState('');
  const [modalNewAdmin, setModalNewAdmin] = useState(false);
  const [modalEditAdmin, setModalEditAdmin] = useState(null);
  const [pinModalAdmin, setPinModalAdmin] = useState(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [revealedMgmtPins, setRevealedMgmtPins] = useState({});

  const [newAdminForm, setNewAdminForm] = useState({
    full_name: '',
    phone: '',
    pin: '123456',
    role: 'owner',
    position: '',
    branch: '3 Pillar All Outlets',
  });

  const fetchStaffList = async () => {
    setLoadingStaffList(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .neq('role', 'owner')
        .order('full_name', { ascending: true });
      if (!error && data) {
        setStaffList(data);
      }
    } catch (e) {
      console.warn('Fetch staff list error:', e);
    } finally {
      setLoadingStaffList(false);
    }
  };

  const fetchManagementList = async () => {
    setLoadingManagement(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .in('role', ['owner', 'admin_owner', 'admin_leader', 'admin_finance', 'leader', 'finance'])
        .order('full_name', { ascending: true });

      if (!error && data) {
        setManagementList(data);
      }
    } catch (e) {
      console.warn('Fetch management list error:', e);
    } finally {
      setLoadingManagement(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'security') {
      fetchStaffList();
      fetchManagementList();
    }
  }, [activeTab]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminForm.full_name.trim()) {
      showToast('error', 'Nama lengkap pimpinan wajib diisi.');
      return;
    }
    const cleanPhone = newAdminForm.phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      showToast('error', 'Nomor handphone minimal 10 digit.');
      return;
    }
    const cleanPin = newAdminForm.pin.trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      showToast('error', 'PIN harus berupa 6 digit angka.');
      return;
    }

    setSavingAdmin(true);
    try {
      const prefix = newAdminForm.role === 'owner' ? 'OWN' : newAdminForm.role === 'admin_leader' ? 'LDR' : 'FIN';
      const empId = `${prefix}_${Date.now().toString().slice(-4)}`;

      const payload = {
        employee_id: empId,
        full_name: newAdminForm.full_name.trim(),
        phone: cleanPhone,
        pin: cleanPin,
        role: newAdminForm.role,
        position: newAdminForm.position.trim() || (newAdminForm.role === 'owner' ? 'Owner' : newAdminForm.role === 'admin_leader' ? 'Leader Outlet' : 'Finance & Payroll'),
        branch: newAdminForm.branch,
        birth_date: '01 Januari 1990',
        address: 'Pimpinan 3 Pillar Management',
      };

      const { data: inserted, error } = await supabase
        .from('employees')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('unique')) {
          throw new Error('Nomor HP sudah terdaftar pada akun lain. Gunakan nomor HP yang berbeda.');
        }
        throw error;
      }

      setManagementList((prev) => [...prev, inserted || payload]);
      setModalNewAdmin(false);
      setNewAdminForm({
        full_name: '',
        phone: '',
        pin: '123456',
        role: 'owner',
        position: '',
        branch: '3 Pillar All Outlets',
      });
      showToast('success', `Berhasil mendaftarkan akun ${payload.full_name}!`);
    } catch (err) {
      showToast('error', err.message || 'Gagal mendaftarkan pimpinan baru.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    if (!modalEditAdmin) return;
    setSavingAdmin(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          full_name: modalEditAdmin.full_name.trim(),
          phone: modalEditAdmin.phone.trim(),
          role: modalEditAdmin.role,
          position: modalEditAdmin.position.trim(),
          branch: modalEditAdmin.branch,
        })
        .eq('id', modalEditAdmin.id);

      if (error) throw error;

      setManagementList((prev) =>
        prev.map((m) => (m.id === modalEditAdmin.id ? { ...m, ...modalEditAdmin } : m))
      );
      setModalEditAdmin(null);
      showToast('success', `Data akun ${modalEditAdmin.full_name} berhasil diperbarui!`);
    } catch (err) {
      showToast('error', err.message || 'Gagal memperbarui akun.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminObj) => {
    if (adminObj.id === user?.id) {
      showToast('error', 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
      return;
    }
    if (!window.confirm(`Hapus akun "${adminObj.full_name}" (${adminObj.role})? Akun ini tidak akan dapat login lagi.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', adminObj.id);

      if (error) throw error;

      setManagementList((prev) => prev.filter((m) => m.id !== adminObj.id));
      showToast('success', `Akun ${adminObj.full_name} berhasil dihapus.`);
    } catch (err) {
      showToast('error', err.message || 'Gagal menghapus akun.');
    }
  };

  const handleResetAdminPin = async (adminObj, customPin) => {
    const pinToSet = (customPin || '123456').trim();
    if (pinToSet.length !== 6 || !/^\d{6}$/.test(pinToSet)) {
      showToast('error', 'PIN harus berupa 6 digit angka.');
      return;
    }
    try {
      const { error } = await supabase
        .from('employees')
        .update({ pin: pinToSet })
        .eq('id', adminObj.id);

      if (error) throw error;

      setManagementList((prev) =>
        prev.map((s) => (s.id === adminObj.id ? { ...s, pin: pinToSet } : s))
      );
      setPinModalAdmin(null);
      showToast('success', `PIN ${adminObj.full_name} berhasil diubah menjadi ${pinToSet}!`);
    } catch (err) {
      showToast('error', err.message || 'Gagal mengubah PIN.');
    }
  };

  const handleSavePin = async (roleKey) => {
    const val = (pinsInput[roleKey] || '').trim();
    if (val.length !== 6 || !/^\d{6}$/.test(val)) {
      showToast('error', 'PIN harus berupa 6 digit angka numerik!');
      return;
    }
    setPinLoadingRole(roleKey);
    const res = await updateAdminPin(roleKey, val);
    setPinLoadingRole(null);
    if (res.success) {
      const roleTitle = roleKey === 'owner' ? 'Owner' : roleKey === 'leader' ? 'Leader' : 'Finance';
      showToast('success', `PIN Admin ${roleTitle} berhasil diubah menjadi ${val}!`);
    } else {
      showToast('error', res.error || 'Gagal mengubah PIN.');
    }
  };

  const handleResetStaffPin = async (staff, customPin) => {
    const pinToSet = (customPin || '123456').trim();
    if (pinToSet.length !== 6 || !/^\d{6}$/.test(pinToSet)) {
      showToast('error', 'PIN harus berupa 6 digit angka numerik.');
      return;
    }
    setResettingStaffId(staff.id);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ pin: pinToSet })
        .eq('id', staff.id);
      if (error) throw error;

      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, pin: pinToSet } : s))
      );
      showToast('success', `PIN ${staff.full_name} berhasil direset menjadi ${pinToSet}!`);
      setPinModalStaff(null);
    } catch (e) {
      showToast('error', 'Gagal mereset PIN: ' + e.message);
    } finally {
      setResettingStaffId(null);
    }
  };

  const toggleRevealPin = (staffId) => {
    setRevealedPins((prev) => ({
      ...prev,
      [staffId]: !prev[staffId],
    }));
  };

  const getCleanWaPhone = (rawPhone) => {
    let clean = (rawPhone || '').replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return clean;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-12">
      {/* ================= HEADER BAR ================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 shadow-xl border border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white shadow-xs transition active:scale-95 cursor-pointer"
            title="Keluar / Kembali ke Login"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-black tracking-wide uppercase">Dashboard Owner</h2>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-extrabold">
                Superadmin
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Kendali Utama 3 Pillar Management (LazyBloom &bull; Deru Ombak &bull; Sea Cafe)
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg.text && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-md transition animate-in fade-in duration-150 ${
            toastMsg.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMsg.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* ================= 5 PRIMARY TABS NAVIGATION ================= */}
      <div className="grid grid-cols-5 gap-1 bg-slate-200/80 p-1.5 rounded-2xl shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('monitoring')}
          className={`py-2 px-1 text-[9px] sm:text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === 'monitoring'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 text-[#F97316]" />
          <span className="truncate">Monitoring</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cashier')}
          className={`py-2 px-1 text-[9px] sm:text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === 'cashier'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Banknote className="w-4 h-4 text-emerald-600" />
          <span className="truncate">Kas Outlet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={`py-2 px-1 text-[9px] sm:text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 relative cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="relative">
            <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
            {(pendingLeaves.length > 0 || pendingCorrections.length > 0) && (
              <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                {pendingLeaves.length + pendingCorrections.length}
              </span>
            )}
          </div>
          <span className="truncate">Persetujuan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gps')}
          className={`py-2 px-1 text-[9px] sm:text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === 'gps'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4 text-teal-600" />
          <span className="truncate">Titik GPS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`py-2 px-1 text-[9px] sm:text-[10px] font-bold rounded-xl transition text-center flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === 'security'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-4 h-4 text-purple-600" />
          <span className="truncate">Kelola PIN</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ======================= TAB 1: MONITORING REALTIME ====================== */}
      {/* ========================================================================= */}
      {activeTab === 'monitoring' && (
        <OwnerMonitoringTab 
          user={user}
          outlets={outlets}
          selectedOutlet={selectedOutlet}
          setSelectedOutlet={setSelectedOutlet}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* ======================= TAB: LAPORAN KASIR & KAS OUTLET ================= */}
      {/* ========================================================================= */}
      {activeTab === 'cashier' && (() => {
        const filteredCashier = cashierReports.filter((r) => {
          if (selectedCashierOutlet === 'all') return true;
          return (r.branch || '').toLowerCase().includes(selectedCashierOutlet.toLowerCase());
        });

        const totalOmzet = filteredCashier.reduce((sum, r) => sum + (Number(r.total_income) || (Number(r.income_cash) || 0) + (Number(r.income_qris) || 0)), 0);
        const totalCash = filteredCashier.reduce((sum, r) => sum + (Number(r.income_cash) || 0), 0);
        const totalQris = filteredCashier.reduce((sum, r) => sum + (Number(r.income_qris) || 0), 0);
        const totalExpense = filteredCashier.reduce((sum, r) => sum + (Number(r.expense_amount) || 0), 0);
        const totalActualCash = filteredCashier.reduce((sum, r) => sum + (Number(r.actual_cash_counted) || 0), 0);
        const totalDifference = filteredCashier.reduce((sum, r) => sum + (Number(r.cash_difference) || 0), 0);

        return (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* Header Card (Clean & Minimalist) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    Laporan Kasir &amp; Kas Outlet
                  </h4>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    {filteredCashier.length} Laporan Diterima
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchCashierReports}
                disabled={loadingCashierReports}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                title="Segarkan data laporan kasir"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCashierReports ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>

            {/* Filter Date & Outlet Bar */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2.5">
              {/* Tanggal Selector */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500 focus-within:bg-white transition">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="date"
                    value={cashierDateFilter}
                    onChange={(e) => setCashierDateFilter(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCashierDateFilter(getLocalDateString())}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer shrink-0"
                >
                  Hari Ini
                </button>
              </div>

              {/* Outlet Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCashierOutlet('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedCashierOutlet === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Cabang
                </button>
                {safeOutlets.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedCashierOutlet(o.name)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedCashierOutlet.toLowerCase() === o.name.toLowerCase()
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Summary 4-Cards Grid - Compact & Clean */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Omzet Total */}
              <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[10px] font-semibold">Total Omzet</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  {formatRupiah(totalOmzet)}
                </div>
              </div>

              {/* Penjualan Tunai */}
              <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[10px] font-semibold">Penjualan Tunai</span>
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xs sm:text-sm font-black text-emerald-700 truncate">
                  {formatRupiah(totalCash)}
                </div>
              </div>

              {/* Non-Tunai / QRIS */}
              <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[10px] font-semibold">Non-Tunai</span>
                  <Wallet className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-xs sm:text-sm font-black text-blue-700 truncate">
                  {formatRupiah(totalQris)}
                </div>
              </div>

              {/* Pengeluaran Kas */}
              <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[10px] font-semibold">Pengeluaran Kas</span>
                  <Receipt className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-xs sm:text-sm font-black text-rose-700 truncate">
                  {formatRupiah(totalExpense)}
                </div>
              </div>
            </div>

            {/* List of Cashier Report Accordion Cards */}
            {loadingCashierReports ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Memuat data laporan kasir...</p>
              </div>
            ) : filteredCashier.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Receipt className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-700">Belum ada laporan kasir untuk tanggal ini</p>
                <p className="text-[11px] text-slate-400">
                  Laporan yang diinput kasir outlet akan otomatis muncul di sini secara realtime.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCashier.map((report) => {
                  const isVerified = report.status === 'Diverifikasi Owner';
                  const diff = Number(report.cash_difference) || 0;
                  const isBalanced = diff === 0;
                  const isShortage = diff < 0;
                  const isExpanded = Boolean(expandedReports[report.id]);

                  return (
                    <div
                      key={report.id}
                      className="w-full bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
                    >
                      {/* Accordion Header / Summary Row: [Nama Cabang], [Tanggal] */}
                      <button
                        type="button"
                        onClick={() => toggleExpandReport(report.id)}
                        className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition cursor-pointer select-none"
                      >
                        {/* Left: [Nama Cabang] & [Tanggal] */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-black tracking-wide shrink-0">
                            {report.branch}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold truncate">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{report.report_date}</span>
                          </div>
                        </div>

                        {/* Right: Status Badge & Chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isVerified
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {isVerified ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-600" />
                            )}
                            <span>{isVerified ? 'Diverifikasi' : 'Menunggu'}</span>
                          </span>

                          <div className="p-1 rounded-md text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-700" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Accordion Content / Rincian Lengkap Secara Elegan */}
                      {isExpanded && (
                        <div className="p-4 pt-3.5 border-t border-slate-100 bg-slate-50/60 space-y-3.5">
                          {/* Info Petugas Kasir & Jam */}
                          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/70 flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-slate-700">
                              <span className="text-[11px] text-slate-400 font-medium">Kasir Bertugas:</span>
                              <span className="font-bold text-slate-900">{report.cashier_name}</span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                {report.shift_name}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Waktu Input: {report.created_at ? new Date(report.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} WIB
                            </div>
                          </div>

                          {/* Finansial: Modal Awal, Breakdown Cash & QRIS, Total Omzet */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Modal Awal */}
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Modal Awal Laci</span>
                              <span className="font-mono font-bold text-xs text-slate-800 block">
                                {formatRupiah(report.starting_cash || 0)}
                              </span>
                            </div>

                            {/* Penjualan Tunai */}
                            <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200/60 shadow-2xs space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Penjualan Tunai</span>
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <span className="font-mono font-black text-xs text-emerald-800 block">
                                {formatRupiah(report.income_cash || 0)}
                              </span>
                            </div>

                            {/* Penjualan Non-Tunai / QRIS */}
                            <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200/60 shadow-2xs space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-blue-700 uppercase tracking-wider block">Non-Tunai / QRIS</span>
                                <Wallet className="w-3.5 h-3.5 text-blue-600" />
                              </div>
                              <span className="font-mono font-black text-xs text-blue-800 block">
                                {formatRupiah(report.income_qris || 0)}
                              </span>
                            </div>

                            {/* Total Omzet */}
                            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-2xs space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider block">Total Omzet</span>
                              <span className="font-mono font-black text-xs text-white block">
                                {formatRupiah(report.total_income || (Number(report.income_cash || 0) + Number(report.income_qris || 0)))}
                              </span>
                            </div>
                          </div>

                          {/* Uang Fisik di Laci & Status Selisih Kas */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80 gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-slate-500 shrink-0" />
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Uang Fisik Dihitung di Laci:</span>
                                <span className="font-mono font-black text-xs text-slate-900">
                                  {formatRupiah(report.actual_cash_counted || 0)}
                                </span>
                              </div>
                            </div>

                            <div
                              className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                                isBalanced
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isShortage
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isBalanced ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Kas Sesuai / Pas (Rp 0)</span>
                                </>
                              ) : isShortage ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Kas Kurang {formatRupiah(Math.abs(diff))}</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Kas Lebih +{formatRupiah(diff)}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Rincian Nota Belanja Operasional (Petty Cash) */}
                          {(Number(report.expense_amount) > 0 || report.expense_notes) ? (
                            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                                <span className="flex items-center gap-1.5">
                                  <Receipt className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Rincian Nota Belanja Operasional:</span>
                                </span>
                                <span className="font-mono font-black text-rose-700">
                                  {formatRupiah(report.expense_amount || 0)}
                                </span>
                              </div>
                              <div className="text-xs font-mono text-amber-900 bg-white/80 p-2.5 rounded-lg border border-amber-200/50 whitespace-pre-line leading-relaxed">
                                {report.expense_notes || 'Tidak ada keterangan rincian nota belanja.'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-slate-300" />
                              <span>Tidak ada pengeluaran operasional toko (Rp 0)</span>
                            </div>
                          )}

                          {/* Catatan Kasir */}
                          {report.notes && (
                            <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Catatan Kasir:</span>
                              <p className="font-medium text-slate-800">{report.notes}</p>
                            </div>
                          )}

                          {/* Action Toolbar: Verifikasi, Kirim WA, dan Modal Detail */}
                          <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedReportDetail(report)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Lihat Detail Modal</span>
                            </button>

                            <div className="flex items-center gap-2">
                              {/* Kirim WA */}
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  `*LAPORAN KASIR 3 PILLAR*\nOutlet: ${report.branch}\nShift: ${report.shift_name}\nTanggal: ${report.report_date}\nKasir: ${report.cashier_name}\n-----------------------------\nModal Awal: ${formatRupiah(report.starting_cash || 0)}\nPenjualan Cash: ${formatRupiah(report.income_cash || 0)}\nPenjualan QRIS: ${formatRupiah(report.income_qris || 0)}\n*Total Omzet:* ${formatRupiah(report.total_income || 0)}\nTotal Pengeluaran: ${formatRupiah(report.expense_amount || 0)}\nKas Fisik Laci: ${formatRupiah(report.actual_cash_counted || 0)}\n*Selisih Kas:* ${diff === 0 ? 'PAS (Rp 0)' : diff < 0 ? `KURANG (${formatRupiah(diff)})` : `LEBIH (+${formatRupiah(diff)})`}\n-----------------------------\nStatus: ${report.status}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                title="Bagikan ringkasan ke WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Kirim WA</span>
                              </a>

                              {/* Verifikasi Button */}
                              {!isVerified ? (
                                <button
                                  type="button"
                                  disabled={verifyingReportId === report.id}
                                  onClick={() => handleVerifyCashierReport(report)}
                                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{verifyingReportId === report.id ? 'Memverifikasi...' : 'Verifikasi'}</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Diverifikasi Owner</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* ===================== TAB 2: PUSAT PERSETUJUAN ========================== */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Subtabs Approval */}
          <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setApprovalSubTab('leaves')}
              className={`py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                approvalSubTab === 'leaves'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Izin / Cuti / Sakit</span>
              {pendingLeaves.length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {pendingLeaves.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setApprovalSubTab('corrections')}
              className={`py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                approvalSubTab === 'corrections'
                  ? 'bg-white text-[#EA580C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Koreksi Keterlambatan</span>
              {pendingCorrections.length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {pendingCorrections.length}
                </span>
              )}
            </button>
          </div>

          {/* ============ BAGIAN A: PERSETUJUAN IZIN ============ */}
          {approvalSubTab === 'leaves' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#2563EB]" />
                    <span>Persetujuan Izin, Cuti &amp; Sakit Staf</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Tinjau alasan staf, surat dokter, dan berikan persetujuan resmi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchLeaves}
                  disabled={loadingLeaves}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition cursor-pointer"
                  title="Segarkan data izin"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaves ? 'animate-spin text-[#2563EB]' : ''}`} />
                </button>
              </div>

              {/* Filter status izin */}
              <div className="flex items-center gap-1.5 text-xs pb-1">
                {[
                  { id: 'pending', label: 'Menunggu' },
                  { id: 'approved', label: 'Disetujui' },
                  { id: 'rejected', label: 'Ditolak' },
                  { id: 'all', label: 'Semua' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLeaveFilter(f.id)}
                    className={`px-3 py-1 rounded-xl font-bold transition text-xs cursor-pointer ${
                      leaveFilter === f.id
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* List Izin */}
              {loadingLeaves ? (
                <div className="py-12 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
                  <span>Memuat pengajuan izin...</span>
                </div>
              ) : filteredLeaves.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Tidak ada pengajuan izin dalam status ini.
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupDataByPeriod(filteredLeaves, 'start_date')).map(([period, items]) => {
                    const isExpanded = expandedLeavePeriods[period] !== false;
                    return (
                      <div key={period} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleLeavePeriod(period)}
                          className="w-full p-3.5 bg-slate-100 flex items-center justify-between hover:bg-slate-200 transition cursor-pointer"
                        >
                          <span className="font-extrabold text-slate-800 text-xs">{period} ({items.length})</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {isExpanded && (
                          <div className="p-3.5 space-y-3">
                            {items.map((l) => {
                              const staffName = l.employees?.full_name || 'Staf';
                              const branch = l.branch || l.employees?.branch || 'LazyBloom';

                              return (
                                <div
                                  key={l.id}
                                  className="p-3.5 bg-white rounded-2xl border border-slate-200/80 space-y-2.5 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className="text-xs font-extrabold text-slate-900 block">{staffName}</span>
                                      <span className="text-[10px] text-slate-500 font-medium">
                                        {branch} &bull; {l.employees?.position || 'Staff'}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                        l.status === 'Disetujui'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                          : l.status === 'Ditolak'
                                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                                          : 'bg-amber-100 text-amber-800 border-amber-300'
                                      }`}
                                    >
                                      {l.status}
                                    </span>
                                  </div>

                                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                                    <div className="flex items-center justify-between text-slate-700">
                                      <span className="font-bold text-slate-800">{l.leave_type}</span>
                                      <span className="text-[10px] text-slate-500">
                                        {l.start_date} {l.end_date && l.end_date !== l.start_date ? `s/d ${l.end_date}` : ''}
                                      </span>
                                    </div>
                                    <p className="text-slate-600 text-[11px] leading-relaxed italic">
                                      &ldquo;{l.reason || 'Tidak ada alasan khusus'}&rdquo;
                                    </p>

                                    {/* Tombol Preview Dokumen */}
                                    {l.document_url && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewDocUrl(l.document_url)}
                                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>Lihat Lampiran / Surat Dokter</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  {l.status === 'Menunggu' && (
                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveLeave(l.id, staffName)}
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Setujui Izin</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRejectModal('leave', l.id, staffName)}
                                        className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Tolak Izin</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============ BAGIAN B: PERSETUJUAN KOREKSI KETERLAMBATAN ============ */}
          {approvalSubTab === 'corrections' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#EA580C]" />
                    <span>Persetujuan Koreksi Keterlambatan (Bebas Denda)</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Hanya Owner yang berhak menyetujui koreksi dan membebaskan denda keterlambatan (Rp 10.000).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshCorrections}
                  disabled={loadingCorrections}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition cursor-pointer"
                  title="Segarkan data koreksi"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCorrections ? 'animate-spin text-[#EA580C]' : ''}`} />
                </button>
              </div>

              {loadingCorrections ? (
                <div className="py-12 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#EA580C]" />
                  <span>Memuat pengajuan koreksi...</span>
                </div>
              ) : (!lateCorrections || lateCorrections.length === 0) ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Belum ada pengajuan koreksi keterlambatan dari staf.
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupDataByPeriod(lateCorrections, 'attendance_date')).map(([period, items]) => {
                    const isExpanded = expandedCorrectionPeriods[period] !== false;
                    return (
                      <div key={period} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleCorrectionPeriod(period)}
                          className="w-full p-3.5 bg-slate-100 flex items-center justify-between hover:bg-slate-200 transition cursor-pointer"
                        >
                          <span className="font-extrabold text-slate-800 text-xs">{period} ({items.length})</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {isExpanded && (
                          <div className="p-3.5 space-y-3">
                            {items.map((c) => (
                              <div
                                key={c.id}
                                className="p-3.5 bg-white rounded-2xl border border-slate-200/80 space-y-2.5 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="text-xs font-extrabold text-slate-900 block">
                                      {c.employee_name || 'Staf'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {c.branch} &bull; Tanggal: {c.attendance_date}
                                    </span>
                                  </div>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                      c.status === 'approved'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : c.status === 'rejected'
                                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    {c.status === 'approved'
                                      ? 'Disetujui (Bebas Denda)'
                                      : c.status === 'rejected'
                                      ? 'Ditolak'
                                      : 'Menunggu Owner'}
                                  </span>
                                </div>

                                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                                  <div className="flex items-center justify-between text-slate-700">
                                    <span className="font-bold text-rose-600">Denda Asli: Rp 10.000</span>
                                    <span className="text-[10px] text-slate-500">
                                      Masuk: {c.check_in_time ? new Date(c.check_in_time).toLocaleTimeString('id-ID') : '-'}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 text-[11px] leading-relaxed italic">
                                    Alasan Staf: &ldquo;{c.reason || 'Tidak ada alasan khusus'}&rdquo;
                                  </p>
                                  {c.review_notes && (
                                    <p className="text-[10px] text-slate-500 border-t border-slate-100 pt-1 mt-1">
                                      Catatan Keputusan: {c.review_notes}
                                    </p>
                                  )}
                                </div>

                                {/* Action Buttons for Owner */}
                                {c.status === 'pending' && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleApproveCorrection(c.id, c.employee_name)}
                                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Setujui &amp; Hapus Denda</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRejectModal('correction', c.id, c.employee_name)}
                                      className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Tolak Koreksi</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ================= TAB 3: PENGATURAN TITIK GPS OUTLET ==================== */}
      {/* ========================================================================= */}
      {activeTab === 'gps' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan Koordinat Titik GPS &amp; Radius 3 Outlet</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Atur posisi GPS valid dan batas radius meter untuk presensi staf di masing-masing cabang.
            </p>
          </div>

          <div className="space-y-4">
            {safeOutlets.map((o) => {
              const currentGps = gpsForm[o.id] || {};
              const isDetecting = detectingGpsOutlet === o.id;

              return (
                <div
                  key={o.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">{o.name}</h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ID: {o.id}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Alamat */}
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                        Alamat Lengkap Outlet
                      </label>
                      <input
                        type="text"
                        value={currentGps.address || ''}
                        onChange={(e) => handleGpsInputChange(o.id, 'address', e.target.value)}
                        placeholder="Contoh: Jl. Pantai Bahari No. 12"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      />
                    </div>

                    {/* Lat & Lng */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                          Latitude (Garis Lintang)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={currentGps.lat ?? ''}
                          onChange={(e) => handleGpsInputChange(o.id, 'lat', parseFloat(e.target.value))}
                          placeholder="-6.208800"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                          Longitude (Garis Bujur)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={currentGps.lng ?? ''}
                          onChange={(e) => handleGpsInputChange(o.id, 'lng', parseFloat(e.target.value))}
                          placeholder="106.845600"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    {/* Radius Meters */}
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                        Radius Toleransi Presensi (Meter)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="10"
                          max="1000"
                          value={currentGps.radiusMeters ?? 50}
                          onChange={(e) => handleGpsInputChange(o.id, 'radiusMeters', parseInt(e.target.value, 10))}
                          className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        />
                        <span className="text-xs font-bold text-slate-500">Meter dari titik koordinat</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleDetectCurrentGPS(o.id)}
                      disabled={isDetecting}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Compass className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin text-emerald-600' : ''}`} />
                      <span>{isDetecting ? 'Mendeteksi...' : 'Ambil GPS Saya'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveGPS(o.id)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan GPS {o.name}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ===================== TAB 4: KEAMANAN & KELOLA PIN ===================== */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* ===================== TAB 4: KEAMANAN & KELOLA PIN ===================== */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Sub-tab Navigation */}
          <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-300/60 shadow-inner">
            <button
              type="button"
              onClick={() => setSecuritySubTab('staff')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                securitySubTab === 'staff'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Reset PIN Staf</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-extrabold">
                {staffList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSecuritySubTab('management')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                securitySubTab === 'management'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>PIN Manajemen</span>
            </button>
          </div>

          {/* ================= SUB-TAB 1: RESET PIN KARYAWAN / STAF ================= */}
          {securitySubTab === 'staff' && (() => {
            const filteredStaff = staffList.filter((s) => {
              const matchOutlet =
                selectedStaffOutlet === 'all' ||
                (s.branch || '').toLowerCase() === selectedStaffOutlet.toLowerCase();
              const q = staffSearchQuery.toLowerCase().trim();
              const matchQuery =
                !q ||
                (s.full_name || '').toLowerCase().includes(q) ||
                (s.phone || '').includes(q) ||
                (s.branch || '').toLowerCase().includes(q) ||
                (s.position || '').toLowerCase().includes(q);
              return matchOutlet && matchQuery;
            });

            return (
              <div className="space-y-3.5">
                {/* Search & Filter Header */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        Pusat Reset PIN Karyawan
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Atasi kendala staf lupa PIN secara instan &amp; kirimkan via WhatsApp
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchStaffList}
                      disabled={loadingStaffList}
                      className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Segarkan data staf"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingStaffList ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Input Search */}
                  <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-purple-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-500/20 transition">
                    <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      placeholder="Cari nama staf, nomor HP, atau jabatan..."
                      className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                    />
                    {staffSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStaffSearchQuery('')}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Outlet Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold">
                    <span className="text-slate-400 shrink-0 text-[10px]">Outlet:</span>
                    {['all', 'LazyBloom', 'Deru Ombak', 'Sea Cafe'].map((outletKey) => (
                      <button
                        key={outletKey}
                        type="button"
                        onClick={() => setSelectedStaffOutlet(outletKey)}
                        className={`px-2.5 py-1 rounded-full border transition shrink-0 cursor-pointer ${
                          selectedStaffOutlet === outletKey
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {outletKey === 'all' ? 'Semua Outlet' : outletKey}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Staff List */}
                {loadingStaffList ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-100">
                    <RefreshCw className="w-5 h-5 text-purple-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Memuat data staf...</p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs space-y-1">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                    <h5 className="text-xs font-bold text-slate-700">Karyawan Tidak Ditemukan</h5>
                    <p className="text-[11px] text-slate-400">
                      Coba sesuaikan kata kunci pencarian atau filter outlet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredStaff.map((staff) => {
                      const isRevealed = !!revealedPins[staff.id];
                      const isResetting = resettingStaffId === staff.id;
                      const cleanPhone = getCleanWaPhone(staff.phone);

                      return (
                        <div
                          key={staff.id}
                          className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-3 hover:border-purple-200 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 font-black text-xs flex items-center justify-center shrink-0">
                                {(staff.full_name || 'K').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="font-extrabold text-xs text-slate-900">
                                  {staff.full_name}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                    {staff.branch || 'Outlet'}
                                  </span>
                                  <span className="text-[9px] font-medium text-slate-500">
                                    {staff.position || 'Staff'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* PIN Display Badge with Reveal */}
                            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200/80 px-2 py-1 rounded-xl shrink-0">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">PIN:</span>
                              <span className="font-mono text-xs font-black text-slate-900 tracking-wider">
                                {isRevealed ? (staff.pin || '123456') : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPin(staff.id)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 transition cursor-pointer"
                                title={isRevealed ? 'Sembunyikan PIN' : 'Lihat PIN'}
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3 text-purple-600" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Action Toolbar */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-slate-400" />
                              <span className="font-mono">{staff.phone}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* 1-Click Fast Reset ke 123456 */}
                              <button
                                type="button"
                                disabled={isResetting}
                                onClick={() => {
                                  if (window.confirm(`Reset PIN ${staff.full_name} ke default "123456"?`)) {
                                    handleResetStaffPin(staff, '123456');
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Reset cepat PIN ke 123456"
                              >
                                <RotateCcw className="w-3 h-3 text-slate-500" />
                                <span>{isResetting ? 'Mereset...' : 'Reset 123456'}</span>
                              </button>

                              {/* Custom PIN Modal Trigger */}
                              <button
                                type="button"
                                onClick={() => setPinModalStaff({ ...staff, newPin: '' })}
                                className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Ganti dengan PIN custom"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Custom PIN</span>
                              </button>

                              {/* Direct WhatsApp Share */}
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                    `Halo ${staff.full_name},\n\nPIN akses login presensi 3 Pillar Anda saat ini adalah: *${staff.pin || '123456'}*.\nNomor HP Login: ${staff.phone}\n\nSilakan gunakan nomor HP dan PIN di atas untuk masuk ke sistem. Terima kasih!`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Kirim PIN via WhatsApp ke Karyawan"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>Kirim WA</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ================= SUB-TAB 2: MULTI-ADMIN & PIN MANAJEMEN ================= */}
          {securitySubTab === 'management' && (() => {
            const ownerCount = managementList.filter((m) => ['owner', 'admin_owner'].includes(m.role)).length;
            const leaderCount = managementList.filter((m) => ['leader', 'admin_leader'].includes(m.role)).length;
            const financeCount = managementList.filter((m) => ['finance', 'admin_finance'].includes(m.role)).length;

            const filteredMgmt = managementList.filter((m) => {
              if (selectedMgmtRole === 'owner' && !['owner', 'admin_owner'].includes(m.role)) return false;
              if (selectedMgmtRole === 'leader' && !['leader', 'admin_leader'].includes(m.role)) return false;
              if (selectedMgmtRole === 'finance' && !['finance', 'admin_finance'].includes(m.role)) return false;

              if (!mgmtSearchQuery.trim()) return true;
              const q = mgmtSearchQuery.toLowerCase();
              return (
                (m.full_name || '').toLowerCase().includes(q) ||
                (m.phone || '').toLowerCase().includes(q) ||
                (m.position || '').toLowerCase().includes(q) ||
                (m.branch || '').toLowerCase().includes(q)
              );
            });

            return (
              <div className="space-y-3">
                {/* Header Card (Clean Card, No Clutter Description) */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        Manajemen Akun Pimpinan
                      </h4>
                      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                        {managementList.length} Akun Terdaftar
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNewAdminForm({
                        full_name: '',
                        phone: '',
                        pin: '123456',
                        role: 'owner',
                        position: '',
                        branch: '3 Pillar All Outlets',
                      });
                      setModalNewAdmin(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Daftarkan Pimpinan</span>
                  </button>
                </div>

                {/* Filter & Search Card */}
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2.5">
                  {/* Search Bar */}
                  <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-purple-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-500/20 transition">
                    <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cari nama pimpinan, nomor HP, atau jabatan..."
                      value={mgmtSearchQuery}
                      onChange={(e) => setMgmtSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                    />
                    {mgmtSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMgmtSearchQuery('')}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Role Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setSelectedMgmtRole('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        selectedMgmtRole === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({managementList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMgmtRole('owner')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        selectedMgmtRole === 'owner'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Owner ({ownerCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMgmtRole('leader')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        selectedMgmtRole === 'leader'
                          ? 'bg-[#EA580C] text-white shadow-xs'
                          : 'bg-orange-50 text-[#EA580C] hover:bg-orange-100'
                      }`}
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Leader ({leaderCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMgmtRole('finance')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        selectedMgmtRole === 'finance'
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'bg-blue-50 text-[#2563EB] hover:bg-blue-100'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Finance ({financeCount})</span>
                    </button>
                  </div>
                </div>

                {/* Management Full-Width Card List (No Overlapping, Responsive) */}
                {loadingManagement ? (
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
                    <RefreshCw className="w-6 h-6 text-purple-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Memuat data pimpinan...</p>
                  </div>
                ) : filteredMgmt.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Belum ada akun pimpinan yang sesuai</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredMgmt.map((admin) => {
                      const isOwnerRole = ['owner', 'admin_owner'].includes(admin.role);
                      const isLeaderRole = ['leader', 'admin_leader'].includes(admin.role);
                      const isFinanceRole = ['finance', 'admin_finance'].includes(admin.role);

                      const roleBadgeConfig = isOwnerRole
                        ? { label: 'Owner', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: Crown }
                        : isLeaderRole
                        ? { label: 'Leader', bg: 'bg-orange-50 text-orange-700 border-orange-200', icon: Briefcase }
                        : { label: 'Finance', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: DollarSign };

                      const RoleIcon = roleBadgeConfig.icon;
                      const isRevealed = Boolean(revealedMgmtPins[admin.id]);
                      const isSelf = admin.id === user?.id;

                      const cleanPhone = (admin.phone || '').replace(/\D/g, '');
                      const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

                      return (
                        <div
                          key={admin.id || admin.employee_id}
                          className="w-full bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-3"
                        >
                          {/* Row 1: Profile & PIN */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${roleBadgeConfig.bg}`}
                              >
                                <RoleIcon className="w-4 h-4" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="font-extrabold text-xs text-slate-900 truncate">
                                    {admin.full_name}
                                  </h5>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[9px] font-bold shrink-0">
                                      Anda
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${roleBadgeConfig.bg}`}
                                  >
                                    <span>{roleBadgeConfig.label}</span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
                                  <span className="font-semibold text-slate-600">
                                    {admin.position || roleBadgeConfig.label}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-500">
                                    {admin.branch || 'Semua Cabang'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* PIN Display Badge with Reveal */}
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl shrink-0">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">PIN:</span>
                              <span className="font-mono text-xs font-black text-slate-900 tracking-wider">
                                {isRevealed ? (admin.pin || '123456') : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedMgmtPins((prev) => ({
                                    ...prev,
                                    [admin.id]: !prev[admin.id],
                                  }))
                                }
                                className="text-slate-400 hover:text-slate-700 p-0.5 transition cursor-pointer"
                                title={isRevealed ? 'Sembunyikan PIN' : 'Lihat PIN'}
                              >
                                {isRevealed ? (
                                  <EyeOff className="w-3 h-3 text-purple-600" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Contact & Actions Toolbar */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                              <Smartphone className="w-3 h-3 text-slate-400" />
                              <span className="font-mono font-medium">{admin.phone || '-'}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              {/* Ubah PIN */}
                              <button
                                type="button"
                                onClick={() => setPinModalAdmin({ ...admin, newPin: '' })}
                                className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Ubah PIN</span>
                              </button>

                              {/* Edit Profil */}
                              <button
                                type="button"
                                onClick={() => setModalEditAdmin({ ...admin })}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Edit3 className="w-3 h-3 text-slate-500" />
                                <span>Edit</span>
                              </button>

                              {/* WhatsApp Share */}
                              {waPhone && (
                                <a
                                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                    `Halo ${admin.full_name},\n\nBerikut akun login Pimpinan 3 Pillar Management Anda:\n📱 No. HP Login: ${admin.phone}\n🔑 PIN Akses: *${admin.pin || '123456'}*\n🏢 Role / Jabatan: ${admin.position || roleBadgeConfig.label}\n📍 Outlet: ${admin.branch || 'Semua Cabang'}\n\nSilakan buka aplikasi presensi dan login menggunakan nomor HP & PIN di atas.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>Kirim WA</span>
                                </a>
                              )}

                              {/* Hapus */}
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdmin(admin)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer shrink-0"
                                  title="Hapus akun pimpinan"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Collapsible: Master System PIN Fallback (Minimalist) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowMasterPins((prev) => !prev)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-slate-600" />
                      <h4 className="text-xs font-bold text-slate-800">
                        PIN Master Cadangan (Fallback Sistem)
                      </h4>
                    </div>
                    {showMasterPins ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {showMasterPins && (
                    <div className="p-3.5 pt-0 space-y-2.5 border-t border-slate-100">
                      {/* PIN Owner Fallback */}
                      <div className="pt-2.5 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 w-20 shrink-0">Owner:</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinsInput.owner}
                          onChange={(e) => setPinsInput((prev) => ({ ...prev, owner: e.target.value.replace(/\D/g, '') }))}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:border-purple-500 text-center"
                          placeholder="• • • • • •"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePin('owner')}
                          disabled={pinLoadingRole === 'owner'}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                        >
                          {pinLoadingRole === 'owner' ? '...' : 'Simpan'}
                        </button>
                      </div>

                      {/* PIN Leader Fallback */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 w-20 shrink-0">Leader:</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinsInput.leader}
                          onChange={(e) => setPinsInput((prev) => ({ ...prev, leader: e.target.value.replace(/\D/g, '') }))}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:border-orange-500 text-center"
                          placeholder="• • • • • •"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePin('leader')}
                          disabled={pinLoadingRole === 'leader'}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                        >
                          {pinLoadingRole === 'leader' ? '...' : 'Simpan'}
                        </button>
                      </div>

                      {/* PIN Finance Fallback */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 w-20 shrink-0">Finance:</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinsInput.finance}
                          onChange={(e) => setPinsInput((prev) => ({ ...prev, finance: e.target.value.replace(/\D/g, '') }))}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:border-blue-500 text-center"
                          placeholder="• • • • • •"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePin('finance')}
                          disabled={pinLoadingRole === 'finance'}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                        >
                          {pinLoadingRole === 'finance' ? '...' : 'Simpan'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ================= MODAL PREVIEW FOTO SELFIE ================= */}
      {photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-sm w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-2">
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={photoPreview} alt="Selfie Absensi" className="w-full h-auto rounded-2xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {/* ================= MODAL PREVIEW DOKUMEN IZIN ================= */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-md w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-2">
            <button
              type="button"
              onClick={() => setPreviewDocUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={previewDocUrl} alt="Dokumen Izin" className="w-full h-auto rounded-2xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {/* ================= MODAL ALASAN PENOLAKAN ================= */}
      {rejectNoteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-sm w-full bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black text-slate-900">
                Alasan Penolakan ({rejectNoteModal.name})
              </h4>
              <button
                type="button"
                onClick={() => setRejectNoteModal({ open: false, type: '', id: '', name: '', note: '' })}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Tuliskan alasan penolakan agar staf memahami keputusan Owner:
            </p>

            <textarea
              rows={3}
              value={rejectNoteModal.note}
              onChange={(e) => setRejectNoteModal((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Contoh: Jadwal sangat padat / Keterlambatan melebihi batas wajar."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
              autoFocus
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectNoteModal({ open: false, type: '', id: '', name: '', note: '' })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CUSTOM RESET PIN STAF ================= */}
      {pinModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Reset Custom PIN</h4>
                  <p className="text-[10px] text-slate-500">{pinModalStaff.full_name} ({pinModalStaff.branch})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalStaff(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Masukkan 6-Digit PIN Baru
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinModalStaff.newPin || ''}
                  onChange={(e) =>
                    setPinModalStaff({
                      ...pinModalStaff,
                      newPin: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  placeholder="• • • • • •"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-black text-base text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white tracking-widest"
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 justify-center">
                <span className="text-[10px] text-slate-400">Pilihan Cepat:</span>
                {['123456', '112233', '654321'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPinModalStaff({ ...pinModalStaff, newPin: preset })}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono font-bold cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalStaff(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!pinModalStaff.newPin || pinModalStaff.newPin.length !== 6 || resettingStaffId === pinModalStaff.id}
                  onClick={() => handleResetStaffPin(pinModalStaff, pinModalStaff.newPin)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {resettingStaffId === pinModalStaff.id ? 'Menyimpan...' : 'Simpan PIN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DAFTARKAN PIMPINAN BARU ================= */}
      {modalNewAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Daftarkan Pimpinan Baru</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNewAdmin(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3.5">
              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Pilih Role Akses *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewAdminForm((prev) => ({
                        ...prev,
                        role: 'owner',
                        position: '',
                        branch: '3 Pillar All Outlets',
                      }))
                    }
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      newAdminForm.role === 'owner'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 font-black shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                    }`}
                  >
                    <Crown className="w-4 h-4" />
                    <span className="text-[10px] leading-tight">👑 Owner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewAdminForm((prev) => ({
                        ...prev,
                        role: 'admin_leader',
                        position: prev.position || 'Leader Outlet',
                        branch: safeOutlets[0]?.name || 'Outlet Riau',
                      }))
                    }
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      newAdminForm.role === 'admin_leader'
                        ? 'bg-orange-50 border-[#EA580C] text-[#EA580C] font-black shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    <span className="text-[10px] leading-tight">📋 Leader Outlet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewAdminForm((prev) => ({
                        ...prev,
                        role: 'admin_finance',
                        position: prev.position || 'Finance & Payroll',
                        branch: '3 Pillar All Outlets',
                      }))
                    }
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      newAdminForm.role === 'admin_finance'
                        ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] font-black shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="text-[10px] leading-tight">💼 Finance Staff</span>
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hj. Siti (Istri) / Pak Hendra / Budi"
                  value={newAdminForm.full_name}
                  onChange={(e) => setNewAdminForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>

              {/* Phone / Login ID */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Nomor WhatsApp / HP (Untuk Login) *
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="0812xxxxxxxx"
                    value={newAdminForm.phone}
                    onChange={(e) =>
                      setNewAdminForm((prev) => ({
                        ...prev,
                        phone: e.target.value.replace(/[^\d+]/g, ''),
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* 6-Digit PIN */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">PIN Login (6 Digit Angka) *</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={newAdminForm.pin}
                  onChange={(e) =>
                    setNewAdminForm((prev) => ({
                      ...prev,
                      pin: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-black text-center tracking-widest text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
                <div className="flex items-center gap-1.5 justify-center pt-0.5">
                  <span className="text-[10px] text-slate-400">Pilihan Cepat:</span>
                  {['123456', '112233', '888999'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewAdminForm((prev) => ({ ...prev, pin: preset }))}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Position / Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Jabatan / Keterangan</label>
                <input
                  type="text"
                  placeholder="Boleh dikosongkan (default: Owner)"
                  value={newAdminForm.position}
                  onChange={(e) => setNewAdminForm((prev) => ({ ...prev, position: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>

              {/* Branch / Outlet Assignment */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Penugasan Cabang / Outlet</label>
                <select
                  value={newAdminForm.branch}
                  onChange={(e) => setNewAdminForm((prev) => ({ ...prev, branch: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white cursor-pointer"
                >
                  <option value="3 Pillar All Outlets">3 Pillar All Outlets (Semua Cabang)</option>
                  {safeOutlets.map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNewAdmin(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {savingAdmin ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Daftarkan Akun</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT PIMPINAN ================= */}
      {modalEditAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Edit Profil Pimpinan</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditAdmin(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="space-y-3.5">
              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Role Akses</label>
                <select
                  value={modalEditAdmin.role}
                  onChange={(e) => setModalEditAdmin((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="owner">👑 Owner</option>
                  <option value="admin_leader">📋 Leader Outlet</option>
                  <option value="admin_finance">💼 Finance &amp; Payroll</option>
                </select>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={modalEditAdmin.full_name}
                  onChange={(e) => setModalEditAdmin((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Nomor WhatsApp / HP (Login)</label>
                <input
                  type="tel"
                  required
                  value={modalEditAdmin.phone}
                  onChange={(e) => setModalEditAdmin((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Position */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Jabatan / Keterangan</label>
                <input
                  type="text"
                  value={modalEditAdmin.position || ''}
                  onChange={(e) => setModalEditAdmin((prev) => ({ ...prev, position: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Branch */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Penugasan Cabang / Outlet</label>
                <select
                  value={modalEditAdmin.branch || '3 Pillar All Outlets'}
                  onChange={(e) => setModalEditAdmin((prev) => ({ ...prev, branch: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="3 Pillar All Outlets">3 Pillar All Outlets (Semua Cabang)</option>
                  {safeOutlets.map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditAdmin(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {savingAdmin ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL UBAH / RESET PIN PIMPINAN ================= */}
      {pinModalAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-sm w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Ubah PIN Pimpinan</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalAdmin(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 text-center space-y-1">
                <p className="text-[11px] font-bold text-purple-900">{pinModalAdmin.full_name}</p>
                <p className="text-[10px] text-purple-600 font-mono">{pinModalAdmin.phone}</p>
                <div className="text-[10px] text-slate-500 pt-1">
                  PIN Sekarang: <span className="font-mono font-bold text-slate-800">{pinModalAdmin.pin || '123456'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block text-center">
                  Ketik 6-Digit PIN Baru
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinModalAdmin.newPin || ''}
                  onChange={(e) =>
                    setPinModalAdmin({
                      ...pinModalAdmin,
                      newPin: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  placeholder="• • • • • •"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-black text-base text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white tracking-widest"
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 justify-center">
                <span className="text-[10px] text-slate-400">Pilihan Cepat:</span>
                {['123456', '112233', '888999', '654321'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPinModalAdmin({ ...pinModalAdmin, newPin: preset })}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono font-bold cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalAdmin(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!pinModalAdmin.newPin || pinModalAdmin.newPin.length !== 6}
                  onClick={() => handleResetAdminPin(pinModalAdmin, pinModalAdmin.newPin)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  Simpan PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DETAIL LAPORAN KASIR ================= */}
      {selectedReportDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Slip Laporan Kasir ({selectedReportDetail.branch})
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {selectedReportDetail.shift_name} &bull; {selectedReportDetail.report_date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Kasir:</span>
                <span className="font-bold text-slate-900">{selectedReportDetail.cashier_name}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Status:</span>
                <span className={`font-bold ${selectedReportDetail.status === 'Diverifikasi Owner' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedReportDetail.status || 'Terkirim'}
                </span>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Modal Awal Laci:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(selectedReportDetail.starting_cash || 0)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>+ Penjualan Tunai (Cash):</span>
                  <span className="font-bold">{formatRupiah(selectedReportDetail.income_cash || 0)}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>+ Penjualan Non-Tunai (QRIS):</span>
                  <span className="font-bold">{formatRupiah(selectedReportDetail.income_qris || 0)}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>= Total Omzet Penjualan:</span>
                  <span>{formatRupiah(selectedReportDetail.total_income || (Number(selectedReportDetail.income_cash || 0) + Number(selectedReportDetail.income_qris || 0)))}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5">
                <div className="flex justify-between text-rose-700">
                  <span>- Total Pengeluaran (Petty Cash):</span>
                  <span className="font-bold">-{formatRupiah(selectedReportDetail.expense_amount || 0)}</span>
                </div>
                {selectedReportDetail.expense_notes && (
                  <div className="bg-white p-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 whitespace-pre-line">
                    {selectedReportDetail.expense_notes}
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5">
                <div className="flex justify-between text-slate-700">
                  <span>Ekspektasi Uang Kas Laci:</span>
                  <span className="font-bold">{formatRupiah(selectedReportDetail.expected_cash || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Uang Fisik di Laci:</span>
                  <span className="font-black text-sm">{formatRupiah(selectedReportDetail.actual_cash_counted || 0)}</span>
                </div>
                <div className="flex justify-between font-black pt-1">
                  <span>Status Selisih Kas:</span>
                  <span className={Number(selectedReportDetail.cash_difference) === 0 ? 'text-emerald-700' : Number(selectedReportDetail.cash_difference) < 0 ? 'text-rose-700' : 'text-blue-700'}>
                    {Number(selectedReportDetail.cash_difference) === 0
                      ? 'PAS (Rp 0)'
                      : Number(selectedReportDetail.cash_difference) < 0
                      ? `KURANG (${formatRupiah(selectedReportDetail.cash_difference)})`
                      : `LEBIH (+${formatRupiah(selectedReportDetail.cash_difference)})`}
                  </span>
                </div>
              </div>

              {selectedReportDetail.notes && (
                <div className="border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-600">
                  <span className="font-bold">Catatan Kasir:</span> {selectedReportDetail.notes}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReportDetail(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>

              {selectedReportDetail.status !== 'Diverifikasi Owner' && (
                <button
                  type="button"
                  disabled={verifyingReportId === selectedReportDetail.id}
                  onClick={() => handleVerifyCashierReport(selectedReportDetail)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{verifyingReportId === selectedReportDetail.id ? 'Memverifikasi...' : 'Verifikasi Laporan'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

