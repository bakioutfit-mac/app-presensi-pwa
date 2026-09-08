'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import LoginCard from '@/components/LoginCard';
import HomeDashboard from '@/components/HomeDashboard';
import BrandLogo from '@/components/BrandLogo';
import { Loader2 } from 'lucide-react';

export default function MainPage() {
  const { user, loading } = useAuth();

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

  if (!user) {
    return <LoginCard />;
  }

  return <HomeDashboard />;
}
