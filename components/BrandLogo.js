'use client';

import React, { useState } from 'react';

/**
 * Komponen Logo 3 Pillar Management (Deru Ombak, LazyBloom, segacafe)
 */
export default function BrandLogo({
  variant = 'badge', // 'badge' | 'header' | 'full'
  size = 'md',       // 'sm' | 'md' | 'lg'
  className = '',
  showText = true,
}) {
  const [imageError, setImageError] = useState(false);

  // Ukuran logo badge
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-12 h-12 rounded-2xl',
    lg: 'w-16 h-16 rounded-3xl',
  };

  const renderBadge = () => {
    if (!imageError) {
      return (
        <div
          className={`relative overflow-hidden flex items-center justify-center shadow-md border-2 border-white/90 bg-white mx-auto ${sizeClasses[size]} ${className}`}
        >
          <img
            src="/logo.png"
            alt="3 Pillar Management"
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // Fallback if image fails
    return (
      <div
        className={`bg-[#EA580C] text-white flex items-center justify-center shadow-md mx-auto ${sizeClasses[size]} ${className}`}
      >
        <span className="font-black text-xs">3P</span>
      </div>
    );
  };

  const renderHeader = () => (
    <div className={`flex items-center justify-center gap-2.5 ${className}`}>
      {/* Mini logo icon beside header if desired */}
      <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs border border-white/80 shrink-0">
        <img
          src="/logo.png"
          alt="3 Pillar Logo"
          className="w-full h-full object-cover"
        />
      </div>
      <h1
        className={`font-black tracking-wider flex items-center drop-shadow-sm select-none ${
          size === 'sm'
            ? 'text-base sm:text-lg'
            : size === 'lg'
            ? 'text-2xl sm:text-3xl'
            : 'text-xl sm:text-2xl'
        }`}
      >
        <span className="text-[#2563EB]">3</span>
        <span className="text-[#F97316] ml-1.5">PILLAR MANAGEMENT</span>
      </h1>
    </div>
  );

  if (variant === 'badge') return renderBadge();
  if (variant === 'header') return renderHeader();

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {renderBadge()}
      {showText && renderHeader()}
    </div>
  );
}
