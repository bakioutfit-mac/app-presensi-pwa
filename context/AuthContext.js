'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { OUTLETS, getOutletByName, saveOutletsConfig } from '@/lib/outlets';

const AuthContext = createContext(null);

// Default mock employees for each of the 3 outlets
export const DEMO_USERS = {
  lazybloom: {
    id: 'demo-emp-001',
    employee_id: 'LZY_0021',
    full_name: 'Fikril Bay',
    phone: '085775560400',
    pin: '123456',
    role: 'staff',
    position: 'Barista Senior',
    branch: 'LazyBloom',
    birth_date: '21 November 1998',
    address: 'Jl. Ir Moh Hatta, Candiareng Perumahan candi wanamas',
    avatar_url: null,
  },
  deru_ombak: {
    id: 'demo-emp-002',
    employee_id: 'DRU_0015',
    full_name: 'Bagas Pratama',
    phone: '081233445566',
    pin: '123456',
    role: 'staff',
    position: 'Head Kitchen & Chef',
    branch: 'Deru Ombak',
    birth_date: '15 Maret 1997',
    address: 'Kawasan Wisata Bahari Blok A3',
    avatar_url: null,
  },
  sea_cafe: {
    id: 'demo-emp-003',
    employee_id: 'SEA_0009',
    full_name: 'Rian Bahari',
    phone: '081998877665',
    pin: '123456',
    role: 'staff',
    position: 'Barista & Gelato Maker',
    branch: 'Sea Cafe',
    birth_date: '04 Juli 2000',
    address: 'Jl. Dermaga Pelabuhan No. 8',
    avatar_url: null,
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [activeLeave, setActiveLeave] = useState(null);

  // 2 Mode Admin: 'leader' | 'finance' | null
  const [adminRole, setAdminRole] = useState(null);

  // PIN Admin (Dapat diubah via Tabel Editor Supabase)
  const [adminPins, setAdminPins] = useState({
    leader: '112233', // Default PIN Admin Leader
    finance: '445566', // Default PIN Admin Finance
  });

  // Outlets state (disinkronkan dengan koordinat GPS terbaru)
  const [outletsList, setOutletsList] = useState(OUTLETS);

  // Initialize session and admin PINs on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pwa_presensi_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      }

      const storedAttendance = localStorage.getItem('pwa_today_attendance');
      if (storedAttendance) {
        setTodayAttendance(JSON.parse(storedAttendance));
      }

      const storedLeave = localStorage.getItem('pwa_active_leave');
      if (storedLeave) {
        setActiveLeave(JSON.parse(storedLeave));
      }

      // Muat PIN admin tersimpan jika ada
      const storedPins = localStorage.getItem('pwa_admin_pins');
      if (storedPins) {
        setAdminPins(JSON.parse(storedPins));
      }

      // Muat koordinat outlet tersimpan
      const storedOutlets = localStorage.getItem('pwa_outlets_config');
      if (storedOutlets) {
        setOutletsList(JSON.parse(storedOutlets));
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
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('attendance_date', todayStr)
        .maybeSingle();

      if (!attError && attData) {
        setTodayAttendance(attData);
        localStorage.setItem('pwa_today_attendance', JSON.stringify(attData));
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
  };

  useEffect(() => {
    if (user) {
      loadAttendanceAndLeave(user);
    }
  }, [user]);

  // Verifikasi PIN Admin (Leader atau Finance)
  const verifyAdminPin = (role, inputPin) => {
    const cleanPin = (inputPin || '').trim();
    if (role === 'leader' && cleanPin === adminPins.leader) {
      setAdminRole('leader');
      return { success: true, role: 'leader' };
    }
    if (role === 'finance' && cleanPin === adminPins.finance) {
      setAdminRole('finance');
      return { success: true, role: 'finance' };
    }
    return {
      success: false,
      error: `PIN Admin ${role === 'leader' ? 'Leader' : 'Finance'} salah! Silakan periksa kembali atau ubah via Supabase Table Editor.`,
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

  // Login method
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
        localStorage.setItem('pwa_presensi_user', JSON.stringify(data));
        await loadAttendanceAndLeave(data);
        return { success: true, user: data };
      }

      // Demo login
      const matchedDemo = Object.values(DEMO_USERS).find(
        (u) => u.phone === phone.trim() && u.pin === pin.trim()
      );

      if (matchedDemo) {
        const demo = { ...matchedDemo };
        setUser(demo);
        localStorage.setItem('pwa_presensi_user', JSON.stringify(demo));
        return { success: true, user: demo };
      }

      // Check admin login
      if (phone === '081234567890' && pin === '654321') {
        const demoAdmin = {
          id: 'demo-adm-001',
          employee_id: 'ADM_0001',
          full_name: 'Admin HQ',
          phone: '081234567890',
          pin: '654321',
          role: 'admin',
          position: 'Area Store Manager',
          branch: '3 Pillar HQ',
        };
        setUser(demoAdmin);
        localStorage.setItem('pwa_presensi_user', JSON.stringify(demoAdmin));
        return { success: true, user: demoAdmin };
      }

      return {
        success: false,
        error: error?.message || 'Nomor HP atau PIN salah.',
      };
    } catch (err) {
      const matchedDemo = Object.values(DEMO_USERS).find(
        (u) => u.phone === phone.trim() && u.pin === pin.trim()
      );
      if (matchedDemo) {
        setUser(matchedDemo);
        localStorage.setItem('pwa_presensi_user', JSON.stringify(matchedDemo));
        return { success: true, user: matchedDemo };
      }
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
      await supabase
        .from('employees')
        .update({
          phone: updatedUser.phone,
          pin: updatedUser.pin,
          branch: updatedUser.branch,
          avatar_url: updatedUser.avatar_url,
        })
        .eq('id', user.id);
    } catch (err) {
      console.warn('Could not sync update to Supabase:', err);
    }

    setUser(updatedUser);
    localStorage.setItem('pwa_presensi_user', JSON.stringify(updatedUser));
    return { success: true, user: updatedUser };
  };

  // Record attendance check-in / check-out
  const recordAttendance = async ({ type, photoUrl, coords, outletName }) => {
    if (!user) return { success: false, error: 'Belum login.' };

    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    let updatedRecord = todayAttendance ? { ...todayAttendance } : {
      employee_id: user.id,
      attendance_date: todayStr,
      status: 'Hadir',
      branch: outletName || user?.branch || 'LazyBloom',
    };

    if (type === 'checkin') {
      updatedRecord = {
        ...updatedRecord,
        check_in_time: nowIso,
        check_in_photo: photoUrl,
        check_in_lat: coords?.lat,
        check_in_lng: coords?.lng,
        status: 'Hadir',
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

    try {
      await supabase
        .from('attendance')
        .upsert(updatedRecord, { onConflict: 'employee_id, attendance_date' });
    } catch (err) {
      console.warn('Supabase upsert attendance error:', err);
    }

    setTodayAttendance(updatedRecord);
    localStorage.setItem('pwa_today_attendance', JSON.stringify(updatedRecord));

    return { success: true, data: updatedRecord };
  };

  // Submit leave request
  const submitLeave = async (leaveData) => {
    if (!user) return { success: false, error: 'Belum login.' };

    const todayStr = new Date().toISOString().split('T')[0];
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
