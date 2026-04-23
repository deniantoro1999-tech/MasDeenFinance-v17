// ═══════════════════════════════════════════════════════════════
// Sidebar — Desktop-only navigation (hidden di mobile)
// 
// Fixed width, full height. Scroll internal kalau nav panjang.
// Watermark developer di bottom.
// ═══════════════════════════════════════════════════════════════

import {
  LayoutDashboard, ShoppingCart, BarChart3, Users, 
  Wallet, Calculator, Sparkles, StickyNote, Settings as SettingsIcon,
  LogOut, ShieldCheck,
} from 'lucide-react';
import { BrandHeader } from './BrandHeader';
import { Z_INDEX } from '../../lib/design-tokens';
import { OFFICIAL_LABEL } from '../../lib/types';
import type { AppFeatures } from '../../lib/types';

export type RouteId = 
  | 'dashboard' | 'pos' | 'report' | 'operasional' 
  | 'customers' | 'reports' | 'tax' | 'ai' | 'notes' | 'settings';

export interface SidebarProps {
  active: RouteId;
  onNavigate: (route: RouteId) => void;
  storeName: string;
  features: AppFeatures;
  userName?: string;
  userEmail?: string;
  onLogout: () => void;
}

interface NavItem {
  id: RouteId;
  label: string;
  icon: typeof LayoutDashboard;
  featureFlag?: keyof AppFeatures;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'pos',         label: 'Kasir POS',      icon: ShoppingCart, featureFlag: 'showStockPurchase' },
  { id: 'report',      label: 'Laporan Hari',   icon: BarChart3 },
  { id: 'operasional', label: 'Operasional',    icon: Wallet },
  { id: 'customers',   label: 'Pelanggan',      icon: Users,        featureFlag: 'showCustomerModule' },
  { id: 'reports',     label: 'Laporan Detail', icon: BarChart3 },
  { id: 'tax',         label: 'Pajak',          icon: Calculator,   featureFlag: 'showTaxModule' },
  { id: 'ai',          label: 'MasDeen AI',     icon: Sparkles,     featureFlag: 'showAIChat' },
  { id: 'notes',       label: 'Catatan',        icon: StickyNote,   featureFlag: 'showNotes' },
  { id: 'settings',    label: 'Pengaturan',     icon: SettingsIcon },
];

export function Sidebar({ active, onNavigate, storeName, features, userName, userEmail, onLogout }: SidebarProps) {
  const items = NAV_ITEMS.filter(item => !item.featureFlag || features[item.featureFlag]);
  
  return (
    <aside
      className="hidden md:flex flex-col w-64 bg-[#020202] border-r border-yellow-600/15 h-screen sticky top-0 no-print"
      style={{ zIndex: Z_INDEX.sidebar }}
    >
      {/* Brand */}
      <BrandHeader storeName={storeName} variant="sidebar" />
      
      {/* Nav items (scrollable kalau overflow) */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group
                ${isActive
                  ? 'bg-gradient-to-r from-yellow-600/20 to-transparent text-yellow-400 border border-yellow-600/40 shadow-lg shadow-yellow-900/10'
                  : 'text-gray-400 hover:bg-white/5 hover:text-yellow-400 border border-transparent'
                }
              `}
            >
              <Icon size={17} className={isActive ? 'text-yellow-400' : 'text-gray-500 group-hover:text-yellow-400'} />
              <span className="font-medium text-sm tracking-wide">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>
      
      {/* User info + Logout */}
      {userEmail && (
        <div className="p-3 border-t border-yellow-600/10">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-black/50 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
              {(userName || userEmail)[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{userName || 'User'}</div>
              <div className="text-[10px] text-gray-500 truncate">{userEmail}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-all text-xs font-medium"
          >
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      )}
      
      {/* Watermark (HARDCODED sesuai requirement user) */}
      <div className="p-4 border-t border-yellow-600/15 bg-black/30">
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
    </aside>
  );
}
