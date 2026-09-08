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

// Resto Coordinates (LazyBloom Store Location default)
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

  // Geofencing state (with simulation toggle)
  const [isInRadius, setIsInRadius] = useState(true);
  const [currentDistance, setCurrentDistance] = useState(15); // in meters
  const [userCoords, setUserCoords] = useState({ lat: -6.2088, lng: 106.8456 });

  // Check if attendance is disabled due to approved leave / sick / late > 30m
  const isLeaveDisabled =
    activeLeave &&
    (activeLeave.leave_type === 'Sakit' ||
      activeLeave.leave_type === 'Cuti Tahunan' ||
      (activeLeave.leave_type === 'Izin Terlambat' &&
        Number(activeLeave.late_duration_minutes) > 30));

  // Geolocation watch
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoords({ lat, lng });

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
          console.log('Using simulated location:', err.message);
        },
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Timer Calculation (Seconds since check_in_time)
  useEffect(() => {
    const updateTimer = () => {
      if (todayAttendance?.check_in_time) {
        const checkInMs = new Date(todayAttendance.check_in_time).getTime();
        const endMs = todayAttendance.check_out_time
          ? new Date(todayAttendance.check_out_time).getTime()
          : Date.now();
        const diff = Math.max(0, Math.floor((endMs - checkInMs) / 1000));
        setElapsedSeconds(diff);
      } else {
        setElapsedSeconds(0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [todayAttendance]);

  // Format Elapsed Time 00 : 00 : 00
  const formatTimer = (totalSecs) => {
    const hours = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSecs % 60).padStart(2, '0');
    return `${hours} : ${minutes} : ${seconds}`;
  };

  // Working shift target (e.g. 8 hours = 28800 seconds)
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
      <div className="min-h-screen max-w-[430px] mx-auto px-4 py-6">
        <AdminLeaderDashboard onBack={() => setAdminRole(null)} />
      </div>
    );
  }

  // If Admin Finance Mode is active
  if (adminRole === 'finance') {
    return (
      <div className="min-h-screen max-w-[430px] mx-auto px-4 py-6">
        <AdminFinanceDashboard onBack={() => setAdminRole(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 py-5 flex flex-col pb-12">
      {/* Brand Header */}
      <div className="mb-4 text-center select-none">
        <BrandLogo variant="header" size="md" />
      </div>

      {/* Main Profile Greeting Card (Screenshot 3) */}
      <div className="relative bg-[#CACFD6] rounded-[32px] border-2 border-[#F97316] shadow-xl pt-5 pb-10 px-5 text-center mb-6">
        {/* Top Flower Logo Badge */}
        <div className="mb-2.5">
          <BrandLogo variant="badge" size="md" />
        </div>

        {/* Staff Greeting & Assigned Outlet Category */}
        <h2 className="text-lg font-extrabold text-[#1E293B]">
          Halo, {user?.full_name || 'Fikril Bay'}
        </h2>

        {/* Dedicated Outlet Category Badge */}
        <div className="mt-1.5 mb-1 flex flex-col items-center justify-center">
          <div
            className={`px-3.5 py-1 rounded-full text-xs font-black border-2 flex items-center gap-1.5 shadow-xs ${
              outlet?.badgeBg || 'bg-orange-500'
            } text-white ${outlet?.badgeBorder || 'border-orange-500'}`}
          >
            <span className="w-2 h-2 rounded-full bg-white shadow-xs animate-pulse" />
            <span>Kategori Outlet: {outlet?.name || 'LazyBloom'}</span>
          </div>
          <span className="text-[10px] font-medium text-gray-600 mt-0.5">
            {outlet?.description || 'Specialty Coffee & Pastry'}
          </span>
        </div>

        <p className="text-[11px] text-gray-500 mt-0.5">{getFormattedDate()}</p>

        {/* Top Control Icons (Settings Left, Logout Right) */}
        <div className="absolute top-1/2 left-6 -translate-y-1">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="p-2 rounded-full text-white/90 bg-[#A8B0B9] hover:bg-white hover:text-gray-800 shadow-md transition"
            title="Profile Settings"
          >
            <Settings className="w-5 h-5 text-white hover:text-gray-800 transition" />
          </button>
        </div>

        <div className="absolute top-1/2 right-6 -translate-y-1">
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-full text-white/90 bg-[#A8B0B9] hover:bg-white hover:text-gray-800 shadow-md transition"
            title="Keluar"
          >
            <LogOut className="w-5 h-5 text-white hover:text-gray-800 transition" />
          </button>
        </div>

        {/* Overlapping Bottom Avatar */}
        <div className="absolute left-1/2 -bottom-10 -translate-x-1/2">
          <div className="w-20 h-20 rounded-full border-4 border-[#CACFD6] bg-[#9CA3AF] flex items-center justify-center shadow-lg overflow-hidden">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-white/90" />
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Row of 4 circular buttons, Screenshot 3) */}
      <div className="mt-4 mb-4">
        <div className="bg-[#B8BFC8] rounded-full p-2 flex items-center justify-around shadow-inner border border-white/40">
          {/* Tab 1: Presensi */}
          <button
            type="button"
            onClick={() => setActiveTab('presensi')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-sm ${
              activeTab === 'presensi'
                ? 'bg-white text-[#2563EB] ring-2 ring-[#2563EB]'
                : 'bg-white/90 text-gray-600 hover:bg-white'
            }`}
            title="Presensi"
          >
            <UserCheck className="w-5 h-5" />
          </button>

          {/* Tab 2: Jadwal Shift */}
          <button
            type="button"
            onClick={() => setActiveTab('shift')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-sm ${
              activeTab === 'shift'
                ? 'bg-white text-[#2563EB] ring-2 ring-[#2563EB]'
                : 'bg-white/90 text-gray-600 hover:bg-white'
            }`}
            title="Jadwal Shift"
          >
            <CalendarCheck className="w-5 h-5" />
          </button>

          {/* Tab 3: Slip Gaji */}
          <button
            type="button"
            onClick={() => setActiveTab('payslip')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-sm ${
              activeTab === 'payslip'
                ? 'bg-white text-[#2563EB] ring-2 ring-[#2563EB]'
                : 'bg-white/90 text-gray-600 hover:bg-white'
            }`}
            title="Slip Gaji"
          >
            <Banknote className="w-5 h-5" />
          </button>

          {/* Tab 4: Daftar Hadir */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-sm ${
              activeTab === 'history'
                ? 'bg-white text-[#2563EB] ring-2 ring-[#2563EB]'
                : 'bg-white/90 text-gray-600 hover:bg-white'
            }`}
            title="Daftar Hadir"
          >
            <ClipboardList className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Labels */}
        <div className="grid grid-cols-4 text-center mt-1.5 px-2">
          <span
            className={`text-[11px] font-bold ${
              activeTab === 'presensi' ? 'text-[#1E293B]' : 'text-gray-500'
            }`}
          >
            Presensi
          </span>
          <span
            className={`text-[11px] font-bold ${
              activeTab === 'shift' ? 'text-[#1E293B]' : 'text-gray-500'
            }`}
          >
            Jadwal Shift
          </span>
          <span
            className={`text-[11px] font-bold ${
              activeTab === 'payslip' ? 'text-[#1E293B]' : 'text-gray-500'
            }`}
          >
            Slip Gaji
          </span>
          <span
            className={`text-[11px] font-bold ${
              activeTab === 'history' ? 'text-[#1E293B]' : 'text-gray-500'
            }`}
          >
            Daftar Hadir
          </span>
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* TAB 1: PRESENSI UTAMA */}
      {activeTab === 'presensi' && (
        <div className="space-y-4">
          {/* Active Leave Notification if any */}
          {isLeaveDisabled && (
            <div className="p-3 bg-amber-100 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <div>
                <p className="font-bold">
                  Status Izin Aktif ({activeLeave.leave_type})
                </p>
                <p className="text-[11px] text-amber-800">
                  {activeLeave.leave_type === 'Izin Terlambat'
                    ? `Izin terlambat > 30 menit (${activeLeave.late_duration_minutes} mnt). Tombol presensi dinonaktifkan.`
                    : 'Anda sedang dalam status izin sakit/cuti. Tombol presensi dinonaktifkan.'}
                </p>
              </div>
            </div>
          )}

          {/* Work Duration Card (Screenshot 3) */}
          <div className="bg-[#CACFD6] rounded-[28px] border-2 border-[#F97316] p-5 text-center shadow-lg space-y-3">
            <h3 className="text-xs font-bold text-[#2563EB]">
              Sudah berapa lama kamu bekerja?
            </h3>

            {/* Live Digital Timer */}
            <div className="text-3xl sm:text-4xl font-black text-[#1E3A8A] tracking-wider font-mono">
              {formatTimer(elapsedSeconds)}
            </div>

            <p className="text-[11px] font-medium text-gray-700">
              {!todayAttendance?.check_in_time
                ? 'Belum mulai bekerja hari ini'
                : todayAttendance?.check_out_time
                ? 'Sudah selesai bekerja hari ini'
                : 'Sedang berlangsung...'}
            </p>

            {/* Two-tone Progress Bar */}
            <div className="w-full bg-[#E5D5C5] h-3.5 rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className="bg-[#F97316] h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${todayAttendance?.check_in_time ? Math.max(8, progressPercent) : 0}%` }}
              />
            </div>

            {/* Status Dot */}
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-800 pt-1">
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
                  <span>Sedang Bekerja (Masuk: {new Date(todayAttendance.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons: Presensi Masuk & Presensi Pulang (Screenshot 3) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Presensi Masuk Button */}
            <button
              type="button"
              onClick={() => setCameraModal({ open: true, type: 'checkin' })}
              disabled={
                isLeaveDisabled ||
                !!todayAttendance?.check_in_time ||
                !isInRadius
              }
              className={`py-3.5 px-2 rounded-2xl text-xs font-bold border-2 transition shadow-xs flex items-center justify-center gap-1.5 ${
                !todayAttendance?.check_in_time && !isLeaveDisabled && isInRadius
                  ? 'border-emerald-500 bg-[#B8C0C8] text-[#1E293B] hover:bg-[#a8b0b8] active:scale-98'
                  : 'border-emerald-300 bg-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
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
                !isInRadius
              }
              className={`py-3.5 px-2 rounded-2xl text-xs font-bold border-2 transition shadow-xs flex items-center justify-center gap-1.5 ${
                todayAttendance?.check_in_time &&
                !todayAttendance?.check_out_time &&
                !isLeaveDisabled &&
                isInRadius
                  ? 'border-[#F97316] bg-[#B8C0C8] text-[#1E293B] hover:bg-[#a8b0b8] active:scale-98'
                  : 'border-gray-300 bg-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
              }`}
            >
              <span>Presensi Pulang</span>
            </button>
          </div>

          {/* Geolocation Status Indicator (Screenshot 3) */}
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <MapPin
                className={`w-3.5 h-3.5 shrink-0 ${
                  isInRadius ? 'text-emerald-600' : 'text-red-500'
                }`}
              />
              {isInRadius ? (
                <span className="text-emerald-700">
                  Kamu berada di dalam Radius {outlet?.name || 'Outlet'} ({currentDistance}m)
                </span>
              ) : (
                <span className="text-red-600">
                  Kamu berada di luar Radius {outlet?.name || 'Outlet'} ({currentDistance}m)
                </span>
              )}

              {/* Simulation toggle button for testing */}
              <button
                type="button"
                onClick={() => {
                  const nextState = !isInRadius;
                  setIsInRadius(nextState);
                  setCurrentDistance(nextState ? 12 : 500);
                }}
                className="ml-2 text-[10px] underline text-gray-500 hover:text-gray-800"
                title="Ubah simulasi radius GPS untuk keperluan testing"
              >
                [Ubah GPS Demo]
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              Titik Absen: {outlet?.address || 'Outlet Area'} (Radius 50m)
            </p>
          </div>

          {/* Bottom Action Buttons: Ajukan Izin & Mode Admin (Screenshot 3) */}
          <div className="space-y-2.5 pt-1">
            {/* Ajukan Izin / Sakit */}
            <button
              type="button"
              onClick={() => setLeaveModalOpen(true)}
              className="w-full py-3 bg-[#CACFD6] hover:bg-[#bcc2ca] active:scale-98 border-2 border-[#F97316] rounded-2xl text-xs font-bold text-[#1E293B] shadow-sm transition flex items-center justify-center gap-2"
            >
              <FileCheck className="w-4 h-4 text-[#2563EB]" />
              <span>Ajukan Izin/Sakit</span>
            </button>

            {/* Mode Admin (Memerlukan Verifikasi PIN Admin) */}
            <button
              type="button"
              onClick={() => setAdminPinModalOpen(true)}
              className="w-full py-3 bg-[#CACFD6] hover:bg-[#bcc2ca] active:scale-98 border-2 border-[#F97316] rounded-2xl text-xs font-bold text-[#1E293B] shadow-sm transition flex items-center justify-center gap-2"
            >
              <UserCog className="w-4 h-4 text-[#2563EB]" />
              <span>Mode Admin (Leader / Finance)</span>
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
