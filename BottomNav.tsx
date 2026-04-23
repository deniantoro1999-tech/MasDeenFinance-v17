// ═══════════════════════════════════════════════════════════════
// BottomNav — Mobile-only navigation (hidden di desktop)
// 
// 5 slot utama: Dashboard, POS, Report, AI, More.
// Menu "More" buka drawer ke fitur lain.
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, ShoppingCart, BarChart3, Sparkles, 
  Menu as MenuIcon, X, Users, Wallet, Calculator, StickyNote, 
  Settings as SettingsIcon, LogOut, ShieldCheck,
} from 'lucide-react';
import { Z_INDEX } from '../../lib/design-tokens';
import { OFFICIAL_LABEL } from '../../lib/types';
import type { AppFeatures } from '../../lib/types';
import type { RouteId } from './Sidebar';

export interface BottomNavProps {
  active: RouteId;
  onNavigate: (route: RouteId) => void;
  features: AppFeatures;
  userName?: string;
  userEmail?: string;
  onLogout: () => void;
}

interface NavSlot {
  id: RouteId;
  label: string;
  icon: typeof LayoutDashboard;
  featureFlag?: keyof AppFeatures;
}

// 4 slot primary + 1 "more" = 5 total di bottom
const PRIMARY_SLOTS: NavSlot[] = [
  { id: 'dashboard', label: 'Home',   icon: LayoutDashboard },
  { id: 'pos',       label: 'Kasir',  icon: ShoppingCart, featureFlag: 'showStockPurchase' },
  { id: 'report',    label: 'Hari',   icon: BarChart3 },
  { id: 'ai',        label: 'AI',     icon: Sparkles, featureFlag: 'showAIChat' },
];

// Sisa fitur dalam drawer "More"
const MORE_SLOTS: NavSlot[] = [
  { id: 'operasional', label: 'Operasional',     icon: Wallet },
  { id: 'customers',   label: 'Pelanggan',       icon: Users, featureFlag: 'showCustomerModule' },
  { id: 'reports',     label: 'Laporan Detail',  icon: BarChart3 },
  { id: 'tax',         label: 'Pajak',           icon: Calculator, featureFlag: 'showTaxModule' },
  { id: 'notes',       label: 'Catatan',         icon: StickyNote, featureFlag: 'showNotes' },
  { id: 'settings',    label: 'Pengaturan',      icon: SettingsIcon },
];

export function BottomNav({ active, onNavigate, features, userName, userEmail, onLogout }: BottomNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const primary = PRIMARY_SLOTS.filter(s => !s.featureFlag || features[s.featureFlag]);
  const more = MORE_SLOTS.filter(s => !s.featureFlag || features[s.featureFlag]);
  
  // Cek apakah route aktif ada di primary atau more
  const isInPrimary = primary.some(s => s.id === active);
  
  const handleNav = (id: RouteId) => {
    onNavigate(id);
    setDrawerOpen(false);
  };
  
  return (
    <>
      {/* Bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[#020202]/95 backdrop-blur-xl border-t border-yellow-600/20 no-print"
        style={{ zIndex: Z_INDEX.bottomNav }}
      >
        <div className="grid grid-cols-5">
          {primary.map(slot => {
            const Icon = slot.icon;
            const isActive = active === slot.id;
            return (
              <button
                key={slot.id}
                onClick={() => handleNav(slot.id)}
                className={`flex flex-col items-center gap-1 py-3 transition-all relative ${
                  isActive ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-500'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomNavActive"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-b"
                  />
                )}
                <Icon size={20} />
                <span className="text-[10px] font-semibold tracking-wide">{slot.label}</span>
              </button>
            );
          })}
          
          {/* More button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center gap-1 py-3 transition-all relative ${
              !isInPrimary ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-500'
            }`}
          >
            {!isInPrimary && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-b" />
            )}
            <MenuIcon size={20} />
            <span className="text-[10px] font-semibold tracking-wide">Menu</span>
          </button>
        </div>
      </nav>
      
      {/* More drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm no-print"
            style={{ zIndex: Z_INDEX.modalOverlay }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-yellow-600/30 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Grab handle */}
              <div className="w-12 h-1 bg-yellow-600/30 rounded-full mx-auto mb-5" />
              
              {/* User info */}
              {userEmail && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/50 border border-yellow-600/20 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-bold">
                    {(userName || userEmail)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white truncate">{userName || 'User'}</div>
                    <div className="text-xs text-gray-500 truncate">{userEmail}</div>
                  </div>
                </div>
              )}
              
              {/* Menu grid */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {more.map(slot => {
                  const Icon = slot.icon;
                  const isActive = active === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => handleNav(slot.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                        isActive
                          ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400'
                          : 'bg-black/40 border-yellow-600/10 text-gray-400 hover:bg-yellow-500/5 hover:border-yellow-600/30'
                      }`}
                    >
                      <Icon size={22} />
                      <span className="text-[10px] font-bold text-center">{slot.label}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Logout */}
              {userEmail && (
                <button
                  onClick={() => { onLogout(); setDrawerOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-950/30 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-950/50 transition-all mb-4"
                >
                  <LogOut size={14} />
                  Keluar dari Aplikasi
                </button>
              )}
              
              {/* Watermark */}
              <div className="pt-4 border-t border-yellow-600/10">
                <div className="flex items-start gap-1.5 mb-1">
                  <ShieldCheck size={10} className="text-yellow-600/60 flex-shrink-0 mt-0.5" />
                  <span className="text-[8px] font-bold text-yellow-600/70 uppercase tracking-wider">
                    Official Verified
                  </span>
                </div>
                <p className="text-[9px] text-gray-600 leading-relaxed">
                  {OFFICIAL_LABEL}
                </p>
              </div>
              
              {/* Close button */}
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
