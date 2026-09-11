/**
 * Konfigurasi Tarif Lembur per Posisi / Jabatan
 * Standar Flat: Rp 15.000 / Jam untuk staf operasional (Barista, Kasir, Kitchen, dsb.)
 * Posisi Tertentu (Supervisor): Rp 20.000 / Jam
 */

export const DEFAULT_OVERTIME_RATES = {
  'Barista': 15000,
  'Kasir': 15000,
  'Kitchen Crew': 15000,
  'Floor Staff': 15000,
  'Tim Belanja': 15000,
  'Tim Marketing': 15000,
  'Supervisor': 20000,
  'Staff': 15000,
};

/**
 * Mendapatkan tarif lembur per jam berdasarkan posisi staf
 * @param {string} position
 * @returns {number} Tarif lembur per jam (IDR)
 */
export function getOvertimeRateByPosition(position) {
  if (!position) return 15000;
  const posLower = position.trim().toLowerCase();
  
  if (posLower.includes('supervisor') || posLower.includes('spv')) {
    return 20000;
  }
  
  for (const [key, rate] of Object.entries(DEFAULT_OVERTIME_RATES)) {
    if (posLower === key.toLowerCase()) {
      return rate;
    }
  }

  // Jika nama posisi mengandung kata kunci
  if (posLower.includes('barista')) return 15000;
  if (posLower.includes('kasir')) return 15000;
  if (posLower.includes('kitchen')) return 15000;
  if (posLower.includes('floor')) return 15000;
  if (posLower.includes('belanja')) return 15000;
  if (posLower.includes('marketing')) return 15000;

  return 15000;
}
