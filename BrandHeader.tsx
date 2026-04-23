// ═══════════════════════════════════════════════════════════════
// BrandHeader — Header dengan brand & "verified" badge
// 
// Dipakai di: sidebar (desktop), top bar (mobile)
// ═══════════════════════════════════════════════════════════════

import { BadgeCheck } from 'lucide-react';
import { DEVELOPER_NAME } from '../../lib/types';

export interface BrandHeaderProps {
  storeName: string;
  variant?: 'sidebar' | 'topbar';
}

export function BrandHeader({ storeName, variant = 'sidebar' }: BrandHeaderProps) {
  if (variant === 'topbar') {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <LogoMark size={32} />
          <div className="flex flex-col min-w-0">
            <h1 className="text-[10px] font-bold tracking-[0.2em] uppercase truncate bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">
              {storeName}
            </h1>
            <p className="text-[7px] text-yellow-500/60 uppercase tracking-[0.3em] font-bold">
              MasDeen Finance
            </p>
          </div>
        </div>
        <VerifiedBadge size="sm" />
      </div>
    );
  }
  
  // Sidebar variant
  return (
    <div className="flex flex-col items-center gap-4 p-5 border-b border-yellow-600/20">
      <LogoMark size={52} />
      
      <div className="text-center">
        <h1 className="text-xs font-bold tracking-[0.2em] uppercase bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent text-glow leading-tight">
          {storeName}
        </h1>
        <div className="flex items-center gap-1.5 mt-1 justify-center">
          <div className="h-px w-3 bg-gradient-to-r from-transparent to-yellow-500/40" />
          <p className="text-[8px] text-yellow-500/70 uppercase tracking-[0.3em] font-bold">
            MasDeen Finance
          </p>
          <div className="h-px w-3 bg-gradient-to-l from-transparent to-yellow-500/40" />
        </div>
      </div>
      
      <VerifiedBadge size="md" />
    </div>
  );
}

function VerifiedBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const isSm = size === 'sm';
  return (
    <div className={`flex flex-col items-center gap-1 bg-black/50 rounded-lg border border-blue-500/20 ${isSm ? 'px-2 py-1' : 'px-3 py-2 w-full'}`}>
      <div className="flex items-center gap-1">
        <span className={`font-bold text-white uppercase tracking-wider ${isSm ? 'text-[8px]' : 'text-[9px]'}`}>
          {DEVELOPER_NAME}
        </span>
        <BadgeCheck size={isSm ? 10 : 12} className="text-blue-400" />
      </div>
      {!isSm && (
        <div className="bg-blue-500/10 px-2 py-0.5 rounded text-[7px] font-bold text-blue-300 tracking-wider">
          ✓ Official Verified
        </div>
      )}
    </div>
  );
}

/**
 * Compact logo mark untuk inline use.
 */
function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-600/20 to-transparent rounded-full blur-sm" />
      <div className="absolute inset-[2px] bg-gradient-to-b from-[#0a0a0a] to-black rounded-full border border-yellow-500/30" />
      <svg viewBox="0 0 100 100" className="w-[60%] h-[60%] relative z-10">
        <defs>
          <linearGradient id={`g-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#854D0E" />
          </linearGradient>
        </defs>
        <path
          d="M 30 15 L 50 15 C 75 15 85 35 85 50 C 85 65 75 85 50 85 L 30 85 Z"
          fill="none"
          stroke={`url(#g-${size})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
