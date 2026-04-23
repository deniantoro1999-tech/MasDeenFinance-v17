// ═══════════════════════════════════════════════════════════════
// LoginScreen — Welcome + Auth UI
// 
// Dua mode:
// - Google Sign-In (popup)
// - Email/No. HP + password (dengan auto-register flow)
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, ShieldCheck, AlertCircle, Phone, Mail, Lock, LogIn } from 'lucide-react';
import { APP_NAME, OFFICIAL_LABEL } from '../../lib/types';

export interface LoginScreenProps {
  isLoading: boolean;
  error: string | null;
  onGoogleLogin: () => void;
  onEmailLogin: (identifier: string, password: string) => void;
  onEmailRegister: (identifier: string, password: string) => void;
  onClearError: () => void;
}

export function LoginScreen({
  isLoading,
  error,
  onGoogleLogin,
  onEmailLogin,
  onEmailRegister,
  onClearError,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    if (mode === 'login') onEmailLogin(identifier, password);
    else onEmailRegister(identifier, password);
  };
  
  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(234,179,8,0.08)_0%,transparent_60%)]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-800/5 rounded-full blur-3xl" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-block mb-4"
          >
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-yellow-600/30 to-transparent rounded-full blur-xl" />
              <div className="absolute inset-1 bg-gradient-to-b from-[#0a0a0a] to-black rounded-full border border-yellow-500/30" />
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full p-5">
                <defs>
                  <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FEF08A" />
                    <stop offset="50%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#854D0E" />
                  </linearGradient>
                </defs>
                <path
                  d="M 30 15 L 50 15 C 75 15 85 35 85 50 C 85 65 75 85 50 85 L 30 85 Z"
                  fill="none"
                  stroke="url(#logoGrad)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>
          
          <h1 className="text-3xl font-black tracking-[0.2em] uppercase bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent text-glow mb-1">
            {APP_NAME.replace(' ', '')}
          </h1>
          <p className="text-[10px] text-yellow-500/70 uppercase tracking-[0.3em] font-bold">
            Super Smart POS
          </p>
        </div>
        
        {/* Card */}
        <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/20 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-900/10">
          {/* Mode switcher */}
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); onClearError(); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                  mode === m
                    ? 'bg-gradient-to-b from-yellow-500 to-yellow-700 text-black shadow-lg shadow-yellow-600/20'
                    : 'text-gray-500 hover:text-yellow-500'
                }`}
              >
                {m === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            ))}
          </div>
          
          {/* Error display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3 mb-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs"
            >
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </motion.div>
          )}
          
          {/* Google login */}
          <button
            onClick={onGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 mb-4 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Masuk dengan Google
          </button>
          
          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-yellow-600/20" />
            <span className="text-[10px] text-yellow-600/60 uppercase tracking-widest font-bold">Atau</span>
            <div className="flex-1 h-px bg-yellow-600/20" />
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/60">
                {/^\d+$/.test(identifier) ? <Phone size={15} /> : <Mail size={15} />}
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email atau No. HP"
                className="w-full pl-11 pr-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 transition-colors"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            
            <div className="relative">
              <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/60" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Sandi"
                className="w-full pl-11 pr-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 transition-colors"
                disabled={isLoading}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !identifier || !password}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-yellow-600/20"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {mode === 'login' ? 'Masuk' : 'Daftar Sekarang'}
            </button>
          </form>
          
          {mode === 'register' && (
            <p className="mt-3 text-[10px] text-gray-500 text-center">
              Kata sandi minimal 6 karakter
            </p>
          )}
        </div>
        
        {/* Watermark */}
        <div className="mt-6 flex items-start gap-2 px-4 text-[9px] text-gray-600 leading-relaxed">
          <ShieldCheck size={11} className="text-yellow-600/60 flex-shrink-0 mt-0.5" />
          <p>{OFFICIAL_LABEL}</p>
        </div>
      </motion.div>
    </div>
  );
}
