'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  LogOut,
  UserCheck,
  CalendarCheck,
  Banknote,
  ClipboardList,
  MapPin,
  FileCheck,
  UserCog,
  User,
  AlertTriangle,
  LocateFixed,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ProfileModal from './ProfileModal';
import CameraModal from './CameraModal';
import LeaveModal from './LeaveModal';
import ShiftScheduleTab from './tabs/ShiftScheduleTab';
import PayslipTab from './tabs/PayslipTab';
import AttendanceHistoryTab from './tabs/AttendanceHistoryTab';
import AdminPinModal from './AdminPinModal';
import AdminLeaderDashboard from './AdminLeaderDashboard';
import AdminFinanceDashboard from './AdminFinanceDashboard';
import BrandLogo from './BrandLogo';

// Resto Coordinates fallback
const RESTO_COORDS = {
  lat: -6.2088,
  lng: 106.8456,
  radiusMeters: 50,
};

export default function HomeDashboard() {
  const {
    user,
    userOutlet,
    currentOutlet,
    logout,
    todayAttendance,
    activeLeave,
    adminRole,
    setAdminRole,
    outlets,
  } = useAuth();

  // Outlet aktif karyawan dengan fallback yang aman
  const outlet = userOutlet || currentOutlet || outlets?.[0];

  // Active Tab: 'presensi' | 'shift' | 'payslip' | 'history'
  const [activeTab, setActiveTab] = useState('presensi');

  // Modals
  const [profileOpen, setProfileOpen] = useState(false);
  const [cameraModal, setCameraModal] = useState({ open: false, type: 'checkin' });
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);

  // Live Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Geofencing state
  const [isInRadius, setIsInRadius] = useState(true);
  const [currentDistance, setCurrentDistance] = useState(15); // in meters
  const [userCoords, setUserCoords] = useState({ lat: -6.2088, lng: 106.8456 });

  // Deteksi apakah staf bertugas di luar outlet / lapangan (Tim Belanja & Tim Marketing)
  const isFieldStaff =
    user?.branch === 'Mobile / Lapangan' ||
    user?.branch?.toLowerCase().includes('mobile') ||
    user?.branch?.toLowerCase().includes('lapangan') ||
    user?.position?.toLowerCase().includes('belanja') ||
    user?.position?.toLowerCase().includes('marketing') ||
    user?.position?.toLowerCase().includes('purchasing');

  // Check if attendance is disabled due to approved leave / sick / late > 30m
  const isLeaveDisabled =
    activeLeave &&
    (activeLeave.leave_type === 'Sakit' ||
      activeLeave.leave_type === 'Cuti Tahunan' ||
      (activeLeave.leave_type === 'Izin Terlambat' &&
        Number(activeLeave.late_duration_minutes) > 30));

  // Geolocation watch
  useEffect(() => {
    if (isFieldStaff) {
      setIsInRadius(true);
    }
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoords({ lat, lng });

          // Staf mobile selalu bebas radius
          if (isFieldStaff) {
            setIsInRadius(true);
            return;
          }

          // Calculate distance in meters relative to outlet coordinates
          const targetCoords = outlet?.coords || RESTO_COORDS;
          const R = 6371e3; // Earth radius in metres
          const φ1 = (lat * Math.PI) / 180;
          const φ2 = (targetCoords.lat * Math.PI) / 180;
          const Δφ = ((targetCoords.lat - lat) * Math.PI) / 180;
          const Δλ = ((targetCoords.lng - lng) * Math.PI) / 180;

          const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = Math.round(R * c);

          setCurrentDistance(distance);
          setIsInRadius(distance <= targetCoords.radiusMeters);
        },
        (err) => {
          console.warn('Geolocation access warning:', err.message);
          setIsInRadius(true); // Fallback to allowed for testing
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [outlet, isFieldStaff]);

  // Live Timer Interval
  useEffect(() => {
    let interval = null;

    if (todayAttendance?.check_in_time && !todayAttendance?.check_out_time) {
      const checkInDate = new Date(todayAttendance.check_in_time).getTime();

      const updateTimer = () => {
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((now - checkInDate) / 1000));
        setElapsedSeconds(diff);
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else if (todayAttendance?.check_out_time && todayAttendance?.check_in_time) {
      const checkInDate = new Date(todayAttendance.check_in_time).getTime();
      const checkOutDate = new Date(todayAttendance.check_out_time).getTime();
      const diff = Math.max(0, Math.floor((checkOutDate - checkInDate) / 1000));
      setElapsedSeconds(diff);
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [todayAttendance]);

  // Format Timer HH:MM:SS
  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 8 Hours target = 28800 seconds
  const shiftTargetSecs = 8 * 3600;
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / shiftTargetSecs) * 100));

  // Formatted Indonesian Date
  const getFormattedDate = () => {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  // If Admin Leader Mode is active
  if (adminRole === 'leader') {
    return (
      <div className="min-h-screen max-w-[430px] mx-auto px-4 py-6 bg-slate-50">
        <AdminLeaderDashboard onBack={() => setAdminRole(null)} />
      </div>
    );
  }

  // If Admin Finance Mode is active
  if (adminRole === 'finance') {
    return (
      <div className="min-h-screen max-w-[430px] mx-auto px-4 py-6 bg-slate-50">
        <AdminFinanceDashboard onBack={() => setAdminRole(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 py-5 flex flex-col pb-12 bg-slate-50/60">
      {/* Brand Header */}
      <div className="mb-4 text-center select-none">
        <BrandLogo variant="header" size="md" />
      </div>

      {/* Main Profile Greeting Card */}
      <div className="relative bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/70 pt-6 pb-11 px-6 text-center mb-6 overflow-visible">
        {/* Top Flower Logo Badge */}
        <div className="mb-2">
          <BrandLogo variant="badge" size="md" />
        </div>

        {/* Staff Greeting & Assigned Outlet Category */}
        <h2 className="text-lg font-black text-slate-800 tracking-tight">
          Halo, {user?.full_name || 'Staf Presensi'}
        </h2>

        {/* Dedicated Outlet Category Badge */}
        <div className="mt-1.5 mb-1 flex flex-col items-center justify-center">
          <div
            className={`px-3.5 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1.5 shadow-sm ${
              isFieldStaff
                ? 'bg-indigo-600'
                : outlet?.id === 'deru-ombak' || outlet?.id === 'deru_ombak'
                ? 'bg-emerald-600'
                : outlet?.id === 'sea-cafe' || outlet?.id === 'sea_cafe'
                ? 'bg-sky-600'
                : 'bg-orange-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white shadow-xs animate-pulse" />
            <span>{isFieldStaff ? (user?.position || 'Tim Lapangan (Mobile)') : (outlet?.name || 'Deru Ombak')}</span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 mt-1">
            {isFieldStaff ? 'Penugasan Luar Outlet (Bebas Radius)' : (outlet?.description || 'beachfront Coffe & Eatery')}
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{getFormattedDate()}</p>

        {/* Top Control Icons (Settings Left, Logout Right) */}
        <div className="absolute top-6 left-6">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="p-2.5 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 shadow-xs transition"
            title="Profile Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute top-6 right-6">
          <button
            type="button"
            onClick={logout}
            className="p-2.5 rounded-full text-slate-600 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 shadow-xs transition"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Overlapping Bottom Avatar */}
        <div className="absolute left-1/2 -bottom-10 -translate-x-1/2">
          <div className="w-20 h-20 rounded-full border-4 border-white bg-slate-200 shadow-md flex items-center justify-center overflow-hidden">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Row of 4 circular buttons) */}
      <div className="mt-4 mb-4">
        <div className="bg-white rounded-2xl p-2 flex items-center justify-around shadow-sm border border-slate-200/80">
          {/* Tab 1: Presensi */}
          <button
            type="button"
            onClick={() => setActiveTab('presensi')}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              activeTab === 'presensi'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-105'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Presensi"
          >
            <UserCheck className="w-5 h-5" />
          </button>

          {/* Tab 2: Jadwal Shift */}
          <button
            type="button"
            onClick={() => setActiveTab('shift')}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              activeTab === 'shift'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-105'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Jadwal Shift"
          >
            <CalendarCheck className="w-5 h-5" />
          </button>

          {/* Tab 3: Slip Gaji */}
          <button
            type="button"
            onClick={() => setActiveTab('payslip')}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              activeTab === 'payslip'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-105'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Slip Gaji"
          >
            <Banknote className="w-5 h-5" />
          </button>

          {/* Tab 4: Daftar Hadir */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              activeTab === 'history'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-105'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Daftar Hadir"
          >
            <ClipboardList className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Labels */}
        <div className="grid grid-cols-4 text-center mt-1.5 px-2">
          <span
            className={`text-[10px] font-bold tracking-tight ${
              activeTab === 'presensi' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            Presensi
          </span>
          <span
            className={`text-[10px] font-bold tracking-tight ${
              activeTab === 'shift' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            Jadwal Shift
          </span>
          <span
            className={`text-[10px] font-bold tracking-tight ${
              activeTab === 'payslip' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            Slip Gaji
          </span>
          <span
            className={`text-[10px] font-bold tracking-tight ${
              activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            Daftar Hadir
          </span>
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* TAB 1: PRESENSI UTAMA */}
      {activeTab === 'presensi' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Active Leave Notification if any */}
          {isLeaveDisabled && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">
                  Status Izin Aktif ({activeLeave.leave_type})
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                  {activeLeave.leave_type === 'Izin Terlambat'
                    ? `Izin terlambat > 30 menit (${activeLeave.late_duration_minutes} mnt). Tombol presensi dinonaktifkan.`
                    : 'Anda sedang dalam status izin sakit/cuti. Tombol presensi dinonaktifkan.'}
                </p>
              </div>
            </div>
          )}

          {/* Work Duration Card */}
          <div className="bg-white rounded-[28px] border border-slate-100 p-6 text-center shadow-lg shadow-slate-200/60 space-y-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Durasi Waktu Kerja Hari Ini
            </h3>

            {/* Live Digital Timer */}
            <div className="text-4xl font-black text-slate-900 tracking-wider font-mono">
              {formatTimer(elapsedSeconds)}
            </div>

            <p className="text-xs font-medium text-slate-500">
              {!todayAttendance?.check_in_time
                ? 'Belum mulai bekerja hari ini'
                : todayAttendance?.check_out_time
                ? 'Selesai bekerja hari ini'
                : 'Jam kerja sedang berjalan...'}
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
              <div
                className="bg-gradient-to-r from-[#F97316] to-[#EA580C] h-full rounded-full transition-all duration-1000 ease-out shadow-xs"
                style={{ width: `${todayAttendance?.check_in_time ? Math.max(8, progressPercent) : 0}%` }}
              />
            </div>

            {/* Status Dot */}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 pt-1">
              {!todayAttendance?.check_in_time ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />
                  <span>Belum Presensi Masuk</span>
                </>
              ) : todayAttendance?.check_out_time ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
                  <span>Sudah Presensi Pulang</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm" />
                  <span>Bekerja Aktif (Masuk: {new Date(todayAttendance.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons: Presensi Masuk & Presensi Pulang */}
          <div className="grid grid-cols-2 gap-3">
            {/* Presensi Masuk Button */}
            <button
              type="button"
              onClick={() => setCameraModal({ open: true, type: 'checkin' })}
              disabled={
                isLeaveDisabled ||
                !!todayAttendance?.check_in_time ||
                (!isFieldStaff && !isInRadius)
              }
              className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                !todayAttendance?.check_in_time && !isLeaveDisabled && (isFieldStaff || isInRadius)
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/25 active:scale-98 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
              }`}
            >
              <span>Presensi Masuk</span>
            </button>

            {/* Presensi Pulang Button */}
            <button
              type="button"
              onClick={() => setCameraModal({ open: true, type: 'checkout' })}
              disabled={
                isLeaveDisabled ||
                !todayAttendance?.check_in_time ||
                !!todayAttendance?.check_out_time ||
                (!isFieldStaff && !isInRadius)
              }
              className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                todayAttendance?.check_in_time &&
                !todayAttendance?.check_out_time &&
                !isLeaveDisabled &&
                (isFieldStaff || isInRadius)
                  ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white shadow-md shadow-orange-500/25 active:scale-98 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
              }`}
            >
              <span>Presensi Pulang</span>
            </button>
          </div>

          {/* Geolocation Status Indicator (Clean Pill) */}
          <div className="flex flex-col items-center justify-center gap-1.5 text-center pt-1">
            {isFieldStaff ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition bg-sky-50 text-sky-800 border-sky-200">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                  <span>📍 Mode Tugas Lapangan: Bebas Radius (GPS Aktif)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Titik koordinat GPS &amp; foto selfie dicatat otomatis saat presensi masuk &amp; pulang
                </p>
              </>
            ) : (
              <>
                <div
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                    isInRadius
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isInRadius ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  <span>
                    {isInRadius
                      ? `Dalam Radius Presensi (${currentDistance}m)`
                      : `Di Luar Radius Outlet (${currentDistance}m)`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Titik Absen: {outlet?.name || 'Outlet Area'} (Radius Maksimal {outlet?.coords?.radiusMeters || 50}m)
                </p>
              </>
            )}
          </div>

          {/* Bottom Action Buttons: Ajukan Izin & Mode Admin */}
          <div className="space-y-2.5 pt-2">
            {/* Ajukan Izin / Sakit */}
            <button
              type="button"
              onClick={() => setLeaveModalOpen(true)}
              className="w-full py-3.5 bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileCheck className="w-4 h-4 text-[#2563EB]" />
              <span>Ajukan Izin / Cuti / Sakit</span>
            </button>

            {/* Mode Admin (Memerlukan Verifikasi PIN Admin) */}
            <button
              type="button"
              onClick={() => setAdminPinModalOpen(true)}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-98 rounded-2xl text-xs font-bold text-white shadow-md shadow-slate-900/15 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCog className="w-4 h-4 text-orange-400" />
              <span>Mode Admin</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: JADWAL SHIFT */}
      {activeTab === 'shift' && <ShiftScheduleTab />}

      {/* TAB 3: SLIP GAJI */}
      {activeTab === 'payslip' && <PayslipTab />}

      {/* TAB 4: DAFTAR HADIR */}
      {activeTab === 'history' && <AttendanceHistoryTab />}

      {/* MODALS */}
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <CameraModal
        isOpen={cameraModal.open}
        type={cameraModal.type}
        coords={userCoords}
        outlet={outlet}
        onClose={() => setCameraModal({ open: false, type: 'checkin' })}
      />

      <LeaveModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
      />

      {/* Modal Verifikasi PIN Admin (Leader / Finance) */}
      <AdminPinModal
        isOpen={adminPinModalOpen}
        onClose={() => setAdminPinModalOpen(false)}
      />
    </div>
  );
}
