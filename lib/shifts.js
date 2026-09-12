/**
 * Konfigurasi Shift Resmi Outlet 3 Pillar Management
 * Berlaku Seragam untuk Seluruh Outlet (LazyBloom, Deru Ombak, Sea Cafe)
 *
 * Aturan Operasional:
 * 1. Shift Middle (11:00 - 20:00): Berlaku untuk SEMUA HARI (Senin s/d Minggu)
 * 2. Shift Weekday (12:00 - 21:00): Berlaku untuk Senin s/d Kamis
 * 3. Shift Weekend 1 (09:00 - 18:00): Berlaku untuk Jumat s/d Minggu
 * 4. Shift Weekend 2 (13:00 - 22:00): Berlaku untuk Jumat s/d Minggu
 */

export const STANDARD_OUTLET_SHIFTS = [
  { id: 'shift_middle', name: 'Shift Middle (11:00 - 20:00)', startTime: '11:00', endTime: '20:00', scope: 'Semua Hari (Senin - Minggu)' },
  { id: 'shift_weekday', name: 'Shift Weekday (12:00 - 21:00)', startTime: '12:00', endTime: '21:00', scope: 'Senin - Kamis' },
  { id: 'shift_weekend_1', name: 'Shift Weekend 1 (09:00 - 18:00)', startTime: '09:00', endTime: '18:00', scope: 'Jumat - Minggu' },
  { id: 'shift_weekend_2', name: 'Shift Weekend 2 (13:00 - 22:00)', startTime: '13:00', endTime: '22:00', scope: 'Jumat - Minggu' },
  { id: 'shift_tukar', name: 'Tukar Shift Antar Rekan', startTime: null, endTime: null, scope: 'Kondisional' },
  { id: 'shift_tugas_luar', name: 'Tugas Khusus / Lapangan', startTime: null, endTime: null, scope: 'Kondisional' },
];

export const DEFAULT_OUTLET_SHIFTS = {
  lazybloom: STANDARD_OUTLET_SHIFTS,
  deru_ombak: STANDARD_OUTLET_SHIFTS,
  sea_cafe: STANDARD_OUTLET_SHIFTS,
};

/**
 * Mengambil daftar shift resmi outlet (seragam untuk semua outlet)
 */
export function getOutletShifts(branchName) {
  // Cek kustomisasi dari storage jika ada
  if (typeof window !== 'undefined') {
    try {
      const custom = localStorage.getItem('pwa_custom_shifts');
      if (custom) {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading custom shifts:', e);
    }
  }

  return STANDARD_OUTLET_SHIFTS;
}

/**
 * Simpan konfigurasi kustom jam shift ke localStorage
 */
export function saveCustomOutletShifts(branchName, shiftsArray) {
  if (!Array.isArray(shiftsArray) || typeof window === 'undefined') return;
  try {
    localStorage.setItem('pwa_custom_shifts', JSON.stringify(shiftsArray));
  } catch (e) {
    console.warn('Failed to save custom shifts:', e);
  }
}
