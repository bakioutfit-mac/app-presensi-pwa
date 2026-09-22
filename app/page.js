'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import LoginCard from '@/components/LoginCard';
import HomeDashboard from '@/components/HomeDashboard';
import BrandLogo from '@/components/BrandLogo';
import { Loader2 } from 'lucide-react';

// Lazy-load dashboard admin agar bundle login & staf tetap sangat ringan
const AdminLeaderDashboard = dynamic(() => import('@/components/AdminLeaderDashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen text-xs text-slate-500 font-semibold gap-2">
      <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
      <span>Memuat Dashboard Leader...</span>
    </div>
  ),
  ssr: false,
});

const AdminFinanceDashboard = dynamic(() => import('@/components/AdminFinanceDashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen text-xs text-slate-500 font-semibold gap-2">
      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
      <span>Memuat Dashboard Finance...</span>
    </div>
  ),
  ssr: false,
});

const AdminOwnerDashboard = dynamic(() => import('@/components/AdminOwnerDashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen text-xs text-slate-500 font-semibold gap-2">
      <Loader2 className="w-4 h-4 animate-spin text-[#EA580C]" />
      <span>Memuat Dashboard Owner...</span>
    </div>
  ),
  ssr: false,
});

export default function MainPage() {
  const { user, loading, adminRole, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#E2E6EA] space-y-3">
        <BrandLogo variant="badge" size="md" className="animate-pulse" />
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
          <span>Memuat 3 Pillar Management...</span>
        </div>
      </div>
    );
  }

  // Jika Akun Owner aktif
  if (adminRole === 'owner') {
    return (
      <div className="min-h-screen max-w-[430px] mx-auto px-4 py-6 bg-slate-50">
        <AdminOwnerDashboard onBack={logout} />
      </div>
    );
  }

  // Jika Akun Admin Leader aktif
  if (adminRole === 'leader') {
    return (
      <div className="min-h-screen max-w-[430px] mx-auto px-4 py-6 bg-slate-50">
        <AdminLeaderDashboard onBack={logout} />
      </div>
    );
  }

  // Jika Akun Admin Finance aktif
  if (adminRole === 'finance') {
    return (
      <div className="min-h-screen max-w-[430px] mx-auto px-4 py-6 bg-slate-50">
        <AdminFinanceDashboard onBack={logout} />
      </div>
    );
  }

  if (!user) {
    return <LoginCard />;
  }

  return <HomeDashboard />;
}
