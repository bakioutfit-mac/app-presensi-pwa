/**
 * Utility penanganan tanggal dan zona waktu Indonesia (WIB / Asia/Jakarta).
 * Mencegah bug pemotongan tanggal UTC (new Date().toISOString()) yang menyebabkan
 * presensi sebelum jam 07:00 WIB mundur ke hari kemarin.
 */

/**
 * Mendapatkan string tanggal format YYYY-MM-DD sesuai zona waktu Asia/Jakarta (WIB)
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} Contoh: "2026-09-10"
 */
export const getLocalDateString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (e) {
    // Fallback jika Intl timeZone tidak didukung
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

/**
 * Melakukan parsing string YYYY-MM-DD ke objek Date lokal tanpa pergeseran timezone UTC
 * @param {string|Date} dateStr
 * @returns {Date}
 */
export const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string' && dateStr.includes('-') && !dateStr.includes('T')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const monthIndex = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      return new Date(year, monthIndex, day);
    }
  }
  return new Date(dateStr);
};

/**
 * Format tanggal Indonesia lengkap, misal: "Kamis, 10 Sep 2026"
 * @param {string|Date} date
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export const formatIndonesianDate = (date, options = {}) => {
  const d = parseLocalDate(date);
  if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
  const defaultOpts = {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  };
  return d.toLocaleDateString('id-ID', defaultOpts);
};

/**
 * Format periode bulan dan tahun dari tanggal string, misal: "September 2026"
 * @param {string|Date} dateStr
 * @returns {string}
 */
export const getPeriodFromDate = (dateStr) => {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return '';
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};


