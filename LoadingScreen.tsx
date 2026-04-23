// ═══════════════════════════════════════════════════════════════
// LoadingScreen — Premium splash screen
// 
// Dipakai saat: first load aplikasi, restore data, sync besar.
// Durasi bisa dikustomisasi via prop.
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Cloud, Sparkles } from 'lucide-react';
import { Z_INDEX } from '../../lib/design-tokens';
import { APP_NAME } from '../../lib/types';

export interface LoadingScreenProps {
  /** Callback saat splash selesai */
  onComplete?: () => void;
  /** Durasi dalam ms. Default 1500. */
  duration?: number;
  /** Custom subtitle */
  subtitle?: string;
}

export function LoadingScreen({
  onComplete,
  duration = 1500,
  subtitle = 'Super Smart POS & Finance System',
}: LoadingScreenProps) {
  useEffect(() => {
    if (!onComplete) return;
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);
  
  return (
    <div
      className="fixed inset-0 bg-[#020202] flex flex-col items-center justify-center overflow-hidden"
      style={{ zIndex: Z_INDEX.splash }}
    >
      {/* Radial glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.15)_0%,transparent_50%)] animate-pulse" />
      
      {/* Decorative rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.3 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute w-96 h-96 border border-yellow-500/20 rounded-full"
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
          className="absolute w-[32rem] h-[32rem] border border-yellow-500/10 rounded-full"
        />
      </div>
      
      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center px-6"
      >
        {/* Logo SVG premium */}
        <motion.div
          initial={{ rotateY: -90 }}
          animate={{ rotateY: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-8"
        >
          <PremiumLogo />
        </motion.div>
        
        {/* Brand name dengan glow */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl md:text-5xl font-black tracking-[0.25em] uppercase bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent text-glow animate-glow mb-3 text-center"
        >
          {APP_NAME.replace(' ', '')}
        </motion.h1>
        
        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-yellow-500/70 text-xs md:text-sm font-bold tracking-[0.4em] uppercase mb-12 text-center"
        >
          {subtitle}
        </motion.p>
        
        {/* Feature badges */}
        <div className="flex flex-col gap-3 items-center">
          {[
            { Icon: ShieldCheck, color: 'text-emerald-400', label: 'Keamanan Tingkat Tinggi', delay: 0.9 },
            { Icon: Cloud,       color: 'text-blue-400',    label: 'Real-time Cloud Backup', delay: 1.1 },
            { Icon: Sparkles,    color: 'text-yellow-400',  label: 'Powered by MasDeenAI',   delay: 1.3 },
          ].map(({ Icon, color, label, delay }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay }}
              className="flex items-center gap-3 text-gray-400 text-[10px] md:text-xs uppercase tracking-widest font-bold"
            >
              <Icon size={14} className={color} />
              {label}
            </motion.div>
          ))}
        </div>
      </motion.div>
      
      {/* Progress bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ duration: duration / 1000, ease: 'easeInOut' }}
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
      />
    </div>
  );
}

/**
 * Logo SVG premium dengan gradient emas multi-stop.
 * Inspirasi dari v16 tapi lebih refined.
 */
function PremiumLogo() {
  return (
    <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
      {/* Aura glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-600/30 via-yellow-400/20 to-transparent rounded-full blur-2xl animate-pulse" />
      
      {/* Ring */}
      <div className="absolute inset-2 bg-gradient-to-b from-[#0a0a0a] to-black rounded-full border border-yellow-500/30 shadow-[inset_0_0_30px_rgba(234,179,8,0.15)]" />
      
      {/* Logo mark */}
      <svg viewBox="0 0 100 100" className="w-[65%] h-[65%] relative z-10 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]">
        <defs>
          <linearGradient id="mdGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="30%" stopColor="#F59E0B" />
            <stop offset="70%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <linearGradient id="mdShine" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>
        {/* D shape */}
        <path
          d="M 30 15 L 50 15 C 75 15 85 35 85 50 C 85 65 75 85 50 85 L 30 85 Z"
          fill="none"
          stroke="url(#mdGold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Internal strokes forming 'F' */}
        <path
          d="M 60 5 L 60 95 M 75 30 C 75 15 45 15 45 30 C 45 50 75 50 75 70 C 75 85 45 85 45 70"
          fill="none"
          stroke="url(#mdShine)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
