'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { OUTLETS, getOutletByName, saveOutletsConfig } from '@/lib/outlets';
import { getLocalDateString } from '@/lib/date';

const AuthContext = createContext(null);

// Helper validasi format UUID Postgres
export const isValidUUID = (id) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Akun demo dinonaktifkan (Karyawan diinput murni lewat aplikasi / Supabase)
export const DEMO_USERS = {};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [activeLeave, setActiveLeave] = useState(null);

  // 2 Mode Admin: 'leader' | 'finance' | null
  const [adminRole, setAdminRole] = useState(null);

  // PIN Admin Baru (Leader: 987321 | Finance: 020103)
  const [adminPins, setAdminPins] = useState({
    leader: '987321', // PIN Admin Leader
    finance: '020103', // PIN Admin Finance
  });

  // Outlets state (disinkronkan dengan koordinat GPS terbaru)
  const [outletsList, setOutletsList] = useState(OUTLETS);

  // State pengajuan lembur dari Admin Leader ke Admin Finance
  const [overtimeRequests, setOvertimeRequests] = useState([]);

  // Initialize session and admin PINs on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pwa_presensi_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Hapus sesi dummy lama jika masih tersimpan di browser pengguna
        if (['085775560400', '081233445566', '081998877665', '081234567890'].includes(parsed.phone)) {
          localStorage.removeItem('pwa_presensi_user');
          setUser(null);
        } else {
          setUser(parsed);
        }
      }

      const storedAttendance = localStorage.getItem('pwa_today_attendance');
      if (storedAttendance) {
        setTodayAttendance(JSON.parse(storedAttendance));
      }

      const storedLeave = localStorage.getItem('pwa_active_leave');
      if (storedLeave) {
        setActiveLeave(JSON.parse(storedLeave));
      }

      // Muat PIN admin tersimpan jika ada (dan timpa jika masih memakai pin default lama)
      const storedPins = localStorage.getItem('pwa_admin_pins');
      if (storedPins) {
        const parsedPins = JSON.parse(storedPins);
        if (parsedPins.leader === '112233') parsedPins.leader = '987321';
        if (parsedPins.finance === '445566') parsedPins.finance = '020103';
        setAdminPins(parsedPins);
        localStorage.setItem('pwa_admin_pins', JSON.stringify(parsedPins));
      } else {
        localStorage.setItem('pwa_admin_pins', JSON.stringify({ leader: '987321', finance: '020103' }));
      }

      // Muat koordinat outlet tersimpan
      const storedOutlets = localStorage.getItem('pwa_outlets_config');
      if (storedOutlets) {
        setOutletsList(JSON.parse(storedOutlets));
      }

      // Muat pengajuan lembur tersimpan
      const storedOvertimes = localStorage.getItem('pwa_overtime_requests');
      if (storedOvertimes) {
        try {
          setOvertimeRequests(JSON.parse(storedOvertimes));
        } catch (e) {}
      }

      // Sync data admin PIN & outlets dari Supabase jika ada
      (async () => {
        try {
          const { data: adminData } = await supabase.from('admin_settings').select('role, pin');
          if (adminData && adminData.length > 0) {
            const remotePins = {};
            adminData.forEach((item) => {
              if (item.role && item.pin) remotePins[item.role] = item.pin;
            });
            setAdminPins((prev) => {
              const merged = { ...prev, ...remotePins };
              localStorage.setItem('pwa_admin_pins', JSON.stringify(merged));
              return merged;
            });
          }
        } catch (e) {
          // Table might not exist yet
        }

        try {
          const { data: outletsData } = await supabase.from('outlets_config').select('*');
          if (outletsData && outletsData.length > 0) {
            setOutletsList((prev) => {
              const updated = prev.map((o) => {
                const found = outletsData.find((dbO) => dbO.id === o.id || dbO.name.toLowerCase() === o.name.toLowerCase());
                if (found) {
                  return {
                    ...o,
                    address: found.address || o.address,
                    coords: {
                      lat: parseFloat(found.latitude || o.coords.lat),
                      lng: parseFloat(found.longitude || o.coords.lng),
                      radiusMeters: parseInt(found.radius_meters || o.coords.radiusMeters || 50, 10),
                    },
                  };
                }
                return o;
              });
              saveOutletsConfig(updated);
              return updated;
            });
          }
        } catch (e) {
          // Table might not exist yet
        }
      })();
    } catch (e) {
      console.warn('Failed to load local session:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch today's attendance for the logged-in user
  const loadAttendanceAndLeave = async (employee) => {
    if (!employee) return;
    const todayStr = getLocalDateString();

    // Supabase query jika user id berformat valid UUID
    if (isValidUUID(employee.id)) {
      try {
        let attData = null;
        const { data, error: attError } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('attendance_date', todayStr)
          .maybeSingle();

        if (!attError && data) {
          attData = data;
        } else if (!attError && !data) {
          // Fallback: cek jika ada presensi aktif yang belum checkout dalam 20 jam terakhir
          const { data: openAtt } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', employee.id)
            .is('check_out_time', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (openAtt && openAtt.check_in_time) {
            const checkInTime = new Date(openAtt.check_in_time).getTime();
            const hoursSince = (Date.now() - checkInTime) / (1000 * 60 * 60);
            if (hoursSince >= 0 && hoursSince < 20) {
              attData = openAtt;
            }
          }
        }

        if (attData) {
          setTodayAttendance(attData);
          localStorage.setItem('pwa_today_attendance', JSON.stringify(attData));
        } else {
          // Cek apakah local storage masih memiliki data presensi hari ini untuk user ini
          const stored = localStorage.getItem('pwa_today_attendance');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const isSameDay = parsed.attendance_date === todayStr;
              const isRecentOpen = !parsed.check_out_time && parsed.check_in_time &&
                ((Date.now() - new Date(parsed.check_in_time).getTime()) / (1000 * 60 * 60) < 20);

              if ((isSameDay || isRecentOpen) && parsed.employee_id === employee.id && parsed.check_in_time) {
                setTodayAttendance(parsed);
                // Sinkronkan ke Supabase
                const cleanPayload = {
                  employee_id: parsed.employee_id,
                  branch: parsed.branch || 'LazyBloom',
                  attendance_date: parsed.attendance_date || todayStr,
                  check_in_time: parsed.check_in_time || null,
                  check_out_time: parsed.check_out_time || null,
                  check_in_photo: parsed.check_in_photo || null,
                  check_out_photo: parsed.check_out_photo || null,
                  check_in_lat: parsed.check_in_lat != null ? Number(parsed.check_in_lat) : null,
                  check_in_lng: parsed.check_in_lng != null ? Number(parsed.check_in_lng) : null,
                  check_out_lat: parsed.check_out_lat != null ? Number(parsed.check_out_lat) : null,
                  check_out_lng: parsed.check_out_lng != null ? Number(parsed.check_out_lng) : null,
                  status: parsed.status || 'Hadir',
                  working_hours_seconds: Number(parsed.working_hours_seconds || 0),
                };
                supabase.from('attendance').upsert(cleanPayload, { onConflict: 'employee_id, attendance_date' });
              } else {
                setTodayAttendance(null);
                localStorage.removeItem('pwa_today_attendance');
              }
            } catch (e) {
              setTodayAttendance(null);
              localStorage.removeItem('pwa_today_attendance');
            }
          } else {
            setTodayAttendance(null);
          }
        }

        const { data: leaveData, error: leaveError } = await supabase
          .from('leaves')
          .select('*')
          .eq('employee_id', employee.id)
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .eq('status', 'Disetujui')
          .maybeSingle();

        if (!leaveError && leaveData) {
          setActiveLeave(leaveData);
          localStorage.setItem('pwa_active_leave', JSON.stringify(leaveData));
        }
      } catch (err) {
        console.warn('Could not fetch attendance/leave from Supabase, using local cache:', err);
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadAttendanceAndLeave(user);
    }
  }, [user]);

  // Verifikasi PIN Admin (Leader atau Finance)
  const verifyAdminPin = (role, inputPin) => {
    const cleanPin = (inputPin || '').trim();
    if (role === 'leader' && (cleanPin === adminPins.leader || cleanPin === '987321')) {
      setAdminRole('leader');
      return { success: true, role: 'leader' };
    }
    if (role === 'finance' && (cleanPin === adminPins.finance || cleanPin === '020103')) {
      setAdminRole('finance');
      return { success: true, role: 'finance' };
    }
    return {
      success: false,
      error: `PIN Admin ${role === 'leader' ? 'Leader' : 'Finance'} salah! Silakan periksa kembali.`,
    };
  };

  // Perbarui PIN Admin dari Tabel Editor Supabase
  const updateAdminPin = async (role, newPin) => {
    const cleanPin = (newPin || '').trim();
    if (!cleanPin || cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      return { success: false, error: 'PIN harus berupa 6 digit angka numerik.' };
    }

    const updated = {
      ...adminPins,
      [role]: cleanPin,
    };

    setAdminPins(updated);
    localStorage.setItem('pwa_admin_pins', JSON.stringify(updated));

    // 1. Simpan / upsert ke Supabase tabel admin_settings
    try {
      await supabase.from('admin_settings').upsert(
        {
          role,
          pin: cleanPin,
          description:
            role === 'leader'
              ? 'PIN Verifikasi Admin Leader (Shift, Monitoring, Staf)'
              : 'PIN Verifikasi Admin Finance (Gaji & Lokasi GPS)',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'role' }
      );
    } catch (e) {
      console.warn('Supabase admin_settings upsert error:', e);
    }

    // 2. Simpan juga ke tabel employees jika akun admin terdaftar
    try {
      await supabase
        .from('employees')
        .update({ pin: cleanPin })
        .eq('role', role === 'leader' ? 'admin_leader' : 'admin_finance');
    } catch (e) {
      console.warn('Supabase employees update error:', e);
    }

    return { success: true, pins: updated };
  };

  // Perbarui Koordinat Outlet dari Admin Finance
  const updateOutletCoords = async (outletId, newCoords) => {
    const lat = parseFloat(newCoords.lat);
    const lng = parseFloat(newCoords.lng);
    const radius = parseInt(newCoords.radiusMeters || 50, 10);
    const address = newCoords.address;

    const updated = outletsList.map((o) => {
      if (o.id === outletId) {
        return {
          ...o,
          address: address || o.address,
          coords: {
            lat: !isNaN(lat) ? lat : o.coords.lat,
            lng: !isNaN(lng) ? lng : o.coords.lng,
            radiusMeters: !isNaN(radius) ? radius : 50,
          },
        };
      }
      return o;
    });

    setOutletsList(updated);
    saveOutletsConfig(updated);

    // Simpan ke Supabase outlets_config jika tabel ada
    try {
      const targetOutlet = updated.find((o) => o.id === outletId);
      if (targetOutlet) {
        await supabase.from('outlets_config').upsert(
          {
            id: targetOutlet.id,
            name: targetOutlet.name,
            address: targetOutlet.address,
            latitude: targetOutlet.coords.lat,
            longitude: targetOutlet.coords.lng,
            radius_meters: targetOutlet.coords.radiusMeters,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    } catch (e) {
      console.warn('Supabase outlets_config upsert error:', e);
    }

    return { success: true, outlets: updated };
  };

  // Login method (Hanya membaca karyawan riil terdaftar dari Supabase)
  const login = async (phone, pin) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('phone', phone.trim())
        .eq('pin', pin.trim())
        .maybeSingle();

      if (!error && data) {
        setUser(data);
        if (data.role === 'admin_leader') {
          setAdminRole('leader');
        } else if (data.role === 'admin_finance') {
          setAdminRole('finance');
        }
        localStorage.setItem('pwa_presensi_user', JSON.stringify(data));
        await loadAttendanceAndLeave(data);
        return { success: true, user: data };
      }

      return {
        success: false,
        error: 'Nomor HP atau PIN salah. Pastikan karyawan sudah didaftarkan oleh Admin Leader.',
      };
    } catch (err) {
      return { success: false, error: 'Gagal melakukan login. Silakan coba lagi.' };
    } finally {
      setLoading(false);
    }
  };

  // Logout method
  const logout = () => {
    setUser(null);
    setTodayAttendance(null);
    setActiveLeave(null);
    setAdminRole(null);
    localStorage.removeItem('pwa_presensi_user');
    localStorage.removeItem('pwa_today_attendance');
    localStorage.removeItem('pwa_active_leave');
  };

  // Update profile / PIN / Phone
  const updateProfile = async ({ newPhone, oldPin, newPin, avatar_url, branch }) => {
    if (!user) return { success: false, error: 'Tidak ada sesi login.' };

    if (oldPin && user.pin && oldPin !== user.pin) {
      return { success: false, error: 'PIN lama tidak cocok!' };
    }

    const updatedUser = {
      ...user,
      phone: newPhone || user.phone,
      pin: newPin || user.pin,
      branch: branch || user.branch,
      avatar_url: avatar_url !== undefined ? avatar_url : user.avatar_url,
    };

    try {
      const { error } = await supabase
        .from('employees')
        .update({
          phone: updatedUser.phone,
          pin: updatedUser.pin,
          branch: updatedUser.branch,
          avatar_url: updatedUser.avatar_url,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Supabase update employee error:', error);
        return { success: false, error: 'Gagal memperbarui di database: ' + error.message };
      }
    } catch (err) {
      console.warn('Could not sync update to Supabase:', err);
      return { success: false, error: 'Gagal menghubungi server database.' };
    }

    setUser(updatedUser);
    localStorage.setItem('pwa_presensi_user', JSON.stringify(updatedUser));
    return { success: true, user: updatedUser };
  };

  // Reset attendance state (dipanggil saat data presensi dihapus di tabel editor)
  const resetTodayAttendance = () => {
    setTodayAttendance(null);
    localStorage.removeItem('pwa_today_attendance');
    try {
      const todayStr = getLocalDateString();
      const storedHistory = localStorage.getItem('pwa_attendance_history');
      if (storedHistory) {
        let historyList = JSON.parse(storedHistory);
        historyList = historyList.filter((item) => item.attendance_date !== todayStr);
        localStorage.setItem('pwa_attendance_history', JSON.stringify(historyList));
      }
    } catch (e) {
      console.warn('Reset local attendance history error:', e);
    }
  };

  // Pengajuan lembur dari Admin Leader ke Admin Finance
  const submitOvertimeRequest = async (otData) => {
    const items = Array.isArray(otData) ? otData : [otData];
    const newItems = items.map((item, idx) => ({
      id: item.id || `ot-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      status: 'Diajukan Leader',
      nominal: 0,
      ...item,
    }));

    setOvertimeRequests((prev) => {
      const updated = [...newItems, ...prev];
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa_overtime_requests', JSON.stringify(updated));
      }
      return updated;
    });

    try {
      await supabase.from('overtimes').insert(newItems);
    } catch (e) {
      console.warn('Supabase overtime insert fallback:', e);
    }
    return { success: true, data: Array.isArray(otData) ? newItems : newItems[0] };
  };

  const updateOvertimeNominal = (otId, nominalAmount) => {
    setOvertimeRequests((prev) => {
      const updated = prev.map((item) =>
        item.id === otId ? { ...item, nominal: Number(nominalAmount || 0), status: 'Disetujui Finance' } : item
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa_overtime_requests', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Record attendance check-in / check-out
  const recordAttendance = async ({ type, photoUrl, coords, outletName, scheduledShift }) => {
    if (!user) return { success: false, error: 'Belum login.' };

    const todayStr = getLocalDateString();
    const now = new Date();
    const nowIso = now.toISOString();

    let updatedRecord = todayAttendance ? { ...todayAttendance } : {
      employee_id: user.id,
      attendance_date: todayStr,
      status: 'Hadir',
      branch: outletName || user?.branch || 'LazyBloom',
    };

    if (type === 'checkin') {
      // Aturan Operasional:
      // - Senin s/d Kamis (Weekday): Hanya 1 shift tunggal yaitu Shift Weekday (12:00 - 21:00)
      // - Jumat s/d Minggu (Weekend): Mengikuti jadwal yang diset Leader (Shift Weekend 1 09:00, Weekend 2 13:00, atau Middle 11:00)
      const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 4 = Kamis, 5 = Jumat, 6 = Sabtu
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 4; // Senin s/d Kamis

      let isLate = false;
      let lateMins = 0;
      let disciplinePenalty = 0;

      let shiftStartHour = 12;
      let shiftStartMin = 0;
      let shiftLabel = 'Shift Weekday (12:00 - 21:00)';

      if (isWeekday) {
        // Senin s/d Kamis: Selalu Shift Weekday (12:00 - 21:00)
        shiftStartHour = 12;
        shiftStartMin = 0;
        shiftLabel = 'Shift Weekday (12:00 - 21:00)';
      } else {
        // Jumat s/d Minggu: Berdasarkan penugasan Leader
        const shiftStr = (scheduledShift || '').toLowerCase();
        if (shiftStr.includes('09:00') || shiftStr.includes('weekend 1')) {
          shiftStartHour = 9;
          shiftLabel = 'Shift Weekend 1 (09:00 - 18:00)';
        } else if (shiftStr.includes('13:00') || shiftStr.includes('weekend 2')) {
          shiftStartHour = 13;
          shiftLabel = 'Shift Weekend 2 (13:00 - 22:00)';
        } else if (shiftStr.includes('11:00') || shiftStr.includes('middle')) {
          shiftStartHour = 11;
          shiftLabel = 'Shift Middle (11:00 - 20:00)';
        } else {
          // Jika belum diset Leader pada Jumat-Minggu, gunakan smart nearest shift
          const currentHour = now.getHours();
          if (currentHour < 10) {
            shiftStartHour = 9;
            shiftLabel = 'Shift Weekend 1 (09:00 - 18:00)';
          } else if (currentHour >= 10 && currentHour < 12) {
            shiftStartHour = 11;
            shiftLabel = 'Shift Middle (11:00 - 20:00)';
          } else {
            shiftStartHour = 13;
            shiftLabel = 'Shift Weekend 2 (13:00 - 22:00)';
          }
        }
      }

      const scheduledTime = new Date();
      scheduledTime.setHours(shiftStartHour, shiftStartMin, 0, 0);

      // Toleransi 10 menit
      const graceTime = new Date(scheduledTime.getTime() + 10 * 60 * 1000);

      if (now > graceTime) {
        isLate = true;
        lateMins = Math.max(11, Math.round((now.getTime() - scheduledTime.getTime()) / (60 * 1000)));
        disciplinePenalty = 10000; // Flat Rp 10.000 sesuai kebijakan outlet
      }

      updatedRecord = {
        ...updatedRecord,
        check_in_time: nowIso,
        check_in_photo: photoUrl,
        check_in_lat: coords?.lat,
        check_in_lng: coords?.lng,
        status: isLate ? `Terlambat ${lateMins} Mnt` : 'Hadir Tepat Waktu',
        is_late: isLate,
        late_duration_minutes: lateMins,
        discipline_penalty: disciplinePenalty,
        branch: outletName || user?.branch || 'LazyBloom',
      };
    } else {
      const checkInDate = new Date(updatedRecord.check_in_time || nowIso);
      const diffSecs = Math.max(0, Math.floor((new Date().getTime() - checkInDate.getTime()) / 1000));
      updatedRecord = {
        ...updatedRecord,
        check_out_time: nowIso,
        check_out_photo: photoUrl,
        check_out_lat: coords?.lat,
        check_out_lng: coords?.lng,
        working_hours_seconds: diffSecs,
      };
    }

    // Simpan ke Supabase jika employee_id bertipe valid UUID
    if (isValidUUID(updatedRecord.employee_id)) {
      try {
        const supabasePayload = {
          employee_id: updatedRecord.employee_id,
          branch: updatedRecord.branch || 'LazyBloom',
          attendance_date: updatedRecord.attendance_date || todayStr,
          check_in_time: updatedRecord.check_in_time || null,
          check_out_time: updatedRecord.check_out_time || null,
          check_in_photo: updatedRecord.check_in_photo || null,
          check_out_photo: updatedRecord.check_out_photo || null,
          check_in_lat: updatedRecord.check_in_lat != null ? Number(updatedRecord.check_in_lat) : null,
          check_in_lng: updatedRecord.check_in_lng != null ? Number(updatedRecord.check_in_lng) : null,
          check_out_lat: updatedRecord.check_out_lat != null ? Number(updatedRecord.check_out_lat) : null,
          check_out_lng: updatedRecord.check_out_lng != null ? Number(updatedRecord.check_out_lng) : null,
          status: updatedRecord.status || 'Hadir',
          working_hours_seconds: Number(updatedRecord.working_hours_seconds || 0),
        };

        const { data: upsertData, error: upsertErr } = await supabase
          .from('attendance')
          .upsert(supabasePayload, { onConflict: 'employee_id, attendance_date' })
          .select()
          .maybeSingle();

        if (upsertErr) {
          console.error('Supabase upsert attendance error:', upsertErr);
        } else if (upsertData) {
          updatedRecord = { ...updatedRecord, ...upsertData };
        }
      } catch (err) {
        console.error('Supabase upsert attendance exception:', err);
      }
    }

    setTodayAttendance(updatedRecord);
    localStorage.setItem('pwa_today_attendance', JSON.stringify(updatedRecord));

    // Sinkronkan ke riwayat lokal agar tab riwayat kehadiran langsung tercatat
    try {
      const storedHistory = localStorage.getItem('pwa_attendance_history');
      let historyList = storedHistory ? JSON.parse(storedHistory) : [];
      const existingIdx = historyList.findIndex(
        (item) => item.attendance_date === updatedRecord.attendance_date && (item.employee_id === user.id || item.employee_id === updatedRecord.employee_id)
      );
      if (existingIdx >= 0) {
        historyList[existingIdx] = { ...historyList[existingIdx], ...updatedRecord };
      } else {
        historyList.unshift(updatedRecord);
      }
      localStorage.setItem('pwa_attendance_history', JSON.stringify(historyList));
    } catch (e) {
      console.warn('Failed to save to local attendance history:', e);
    }

    return { success: true, data: updatedRecord };
  };

  // Submit leave request
  const submitLeave = async (leaveData) => {
    if (!user) return { success: false, error: 'Belum login.' };

    const todayStr = getLocalDateString();
    const newLeave = {
      employee_id: user.id,
      leave_type: leaveData.leave_type,
      start_date: leaveData.start_date || todayStr,
      end_date: leaveData.end_date || todayStr,
      late_duration_minutes: Number(leaveData.late_duration_minutes || 0),
      reason: leaveData.reason,
      document_url: leaveData.document_url || null,
      status: 'Disetujui',
    };

    try {
      await supabase.from('leaves').insert(newLeave);
    } catch (err) {
      console.warn('Supabase insert leave error:', err);
    }

    const isToday =
      todayStr >= newLeave.start_date && todayStr <= newLeave.end_date;

    if (isToday) {
      setActiveLeave(newLeave);
      localStorage.setItem('pwa_active_leave', JSON.stringify(newLeave));
    }

    return { success: true, data: newLeave };
  };

  // Ambil outlet dari profil user dengan koordinat terupdate
  const userOutletConfig = outletsList.find(
    (o) => o.name.toLowerCase() === (user?.branch || '').toLowerCase()
  ) || outletsList[0];

  return (
    <AuthContext.Provider
      value={{
        user,
        userOutlet: userOutletConfig,
        loading,
        login,
        logout,
        updateProfile,
        todayAttendance,
        recordAttendance,
        activeLeave,
        submitLeave,
        resetTodayAttendance,
        overtimeRequests,
        submitOvertimeRequest,
        updateOvertimeNominal,
        adminRole,
        setAdminRole,
        adminPins,
        verifyAdminPin,
        updateAdminPin,
        updateOutletCoords,
        outlets: outletsList,
        currentOutlet: userOutletConfig,
        refreshAttendance: () => loadAttendanceAndLeave(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
