/**
 * Konfigurasi 3 Outlet di bawah naungan 3 Pillar Management
 * 1. Deru Ombak (Pilar Hijau)
 * 2. LazyBloom (Pilar Oranye)
 * 3. Sea Cafe / segacafe (Pilar Biru)
 */

export const DEFAULT_OUTLETS = [
  {
    id: 'lazybloom',
    name: 'LazyBloom',
    altName: 'LazyBloom Cafe',
    pillarColor: '#EA580C', // Oranye
    accentColor: 'orange',
    badgeBg: 'bg-orange-500',
    badgeText: 'text-orange-600',
    badgeBorder: 'border-orange-500',
    badgeLight: 'bg-orange-50 text-orange-700 border-orange-200',
    description: 'beachfront Coffe & Eatery',
    address: 'Jl. Ir Moh Hatta No. 12, Candiareng',
    coords: {
      lat: -6.2088,
      lng: 106.8456,
      radiusMeters: 50,
    },
  },
  {
    id: 'deru_ombak',
    name: 'Deru Ombak',
    altName: 'Deru Ombak Eatery',
    pillarColor: '#166534', // Hijau
    accentColor: 'green',
    badgeBg: 'bg-emerald-700',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-700',
    badgeLight: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'beachfront Coffe & Eatery',
    address: 'Kawasan Wisata Bahari Blok A3, Pantai Indah',
    coords: {
      lat: -6.2105,
      lng: 106.8480,
      radiusMeters: 50,
    },
  },
  {
    id: 'sea_cafe',
    name: 'Sea Cafe',
    altName: 'segacafe',
    pillarColor: '#0284C7', // Biru Segacafe
    accentColor: 'blue',
    badgeBg: 'bg-sky-600',
    badgeText: 'text-sky-600',
    badgeBorder: 'border-sky-600',
    badgeLight: 'bg-sky-50 text-sky-800 border-sky-200',
    description: 'beachfront Coffe & Eatery',
    address: 'Jl. Dermaga Pelabuhan No. 8, Sea Cafe Area',
    coords: {
      lat: -6.2050,
      lng: 106.8420,
      radiusMeters: 50,
    },
  },
];

export let OUTLETS = [...DEFAULT_OUTLETS];

// Muat koordinat kustom dari storage jika ada
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('pwa_outlets_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      OUTLETS = DEFAULT_OUTLETS.map((d) => {
        const found = parsed.find((p) => p.id === d.id);
        return found ? { ...d, ...found, coords: { ...d.coords, ...found.coords } } : d;
      });
    }
  } catch (e) {
    console.warn('Could not load custom outlets config:', e);
  }
}

export function saveOutletsConfig(newOutlets) {
  OUTLETS = newOutlets;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('pwa_outlets_config', JSON.stringify(newOutlets));
    } catch (e) {
      console.warn('Failed to persist outlets config:', e);
    }
  }
}

export function getOutletByName(name) {
  if (!name) return OUTLETS[0];
  const clean = name.toLowerCase().trim();
  return (
    OUTLETS.find(
      (o) =>
        o.name.toLowerCase() === clean ||
        o.altName?.toLowerCase() === clean ||
        o.id === clean
    ) || OUTLETS[0]
  );
}
