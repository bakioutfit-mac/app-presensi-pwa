import { supabase } from './supabase';

/**
 * Format angka atau string angka ke format Rupiah standar Indonesia:
 * Contoh: 10000 -> "Rp 10.000", 3500000 -> "Rp 3.500.000"
 */
export function formatRupiah(value) {
  if (value === null || value === undefined || value === '') return '';
  const numStr = typeof value === 'string' ? value.replace(/\D/g, '') : String(value);
  if (!numStr) return '';
  const num = Number(numStr);
  return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Parsing string berformat Rupiah ke angka integer murni:
 * Contoh: "Rp 10.000" -> 10000
 */
export function parseRupiah(str) {
  if (str === null || str === undefined) return 0;
  const clean = String(str).replace(/\D/g, '');
  return clean ? Number(clean) : 0;
}

/**
 * Komponen Input Nominal Rupiah Otomatis (dengan prefix "Rp " dan pemisah ribuan ".")
 */
export function CurrencyInput({
  value,
  onChange,
  className = '',
  placeholder = 'Rp 0',
  disabled = false,
  required = false,
  id,
  name,
}) {
  const displayVal = value !== undefined && value !== null && value !== '' && Number(value) !== 0
    ? formatRupiah(value)
    : value === 0
    ? 'Rp 0'
    : '';

  const handleChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const num = rawVal ? Number(rawVal) : 0;
    if (onChange) onChange(num);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      name={name}
      value={displayVal}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
    />
  );
}

/**
 * Muat Paket Gaji Karyawan dari Supabase (admin_settings) dan localStorage
 */
export async function fetchEmployeeSalaries() {
  let localData = {};
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('pwa_employee_salaries');
    if (saved) {
      try {
        localData = JSON.parse(saved);
      } catch (e) {
        console.warn('Parse local salary error:', e);
      }
    }
  }

  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('description')
      .eq('role', 'employee_salaries')
      .single();

    if (data && data.description) {
      const remoteData = JSON.parse(data.description);
      const merged = { ...localData, ...remoteData };
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa_employee_salaries', JSON.stringify(merged));
      }
      return merged;
    }
  } catch (err) {
    console.warn('Fetch remote salary packages fallback to local:', err);
  }

  return localData;
}

/**
 * Simpan Paket Gaji Karyawan ke Supabase (admin_settings) dan localStorage
 */
export async function saveEmployeeSalaries(salariesMap) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pwa_employee_salaries', JSON.stringify(salariesMap));
    window.dispatchEvent(new Event('pwa_salary_package_updated'));
  }

  try {
    await supabase.from('admin_settings').upsert(
      {
        role: 'employee_salaries',
        pin: '000000',
        name: 'Paket Gaji Karyawan',
        description: JSON.stringify(salariesMap),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'role' }
    );
    return { success: true };
  } catch (err) {
    console.warn('Save remote salary packages fallback:', err);
    return { success: false, error: err };
  }
}
