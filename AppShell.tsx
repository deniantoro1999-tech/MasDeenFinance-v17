// ═══════════════════════════════════════════════════════════════
// AppShell — Container layout utama
// 
// Strukturnya:
// ┌─────────────────────────────────────────┐
// │ ┌──────┬──────────────────────────────┐ │
// │ │      │                              │ │
// │ │ Side │   Main content (route view)  │ │
// │ │ bar  │                              │ │
// │ │      │                              │ │
// │ └──────┴──────────────────────────────┘ │
// │ [BottomNav - mobile only]               │
// └─────────────────────────────────────────┘
// 
// Modal & Dialog di-render di root level, TIDAK di dalam main content,
// supaya tidak terpengaruh overflow/stacking main content.
// ═══════════════════════════════════════════════════════════════

import { ReactNode } from 'react';
import { Sidebar, RouteId } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Dialog } from '../ui/Dialog';
import type { AppFeatures, DialogState, AppUser } from '../../lib/types';

export interface AppShellProps {
  children: ReactNode;
  
  // Navigation
  activeRoute: RouteId;
  onNavigate: (route: RouteId) => void;
  
  // Brand
  storeName: string;
  features: AppFeatures;
  
  // User
  user: AppUser | null;
  onLogout: () => void;
  
  // Dialog state (unified — hanya 1 dialog aktif)
  dialog: DialogState;
  onCloseDialog: () => void;
}

export function AppShell({
  children,
  activeRoute,
  onNavigate,
  storeName,
  features,
  user,
  onLogout,
  dialog,
  onCloseDialog,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#020202] text-white">
      {/* Global ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-yellow-600/3 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-yellow-800/3 rounded-full blur-3xl" />
      </div>
      
      {/* Main layout: sidebar + content */}
      <div className="relative flex min-h-screen">
        {/* Desktop Sidebar */}
        <Sidebar
          active={activeRoute}
          onNavigate={onNavigate}
          storeName={storeName}
          features={features}
          userName={user?.displayName ?? undefined}
          userEmail={user?.email ?? undefined}
          onLogout={onLogout}
        />
        
        {/* Main content area — scrollable, pas bawah kasi padding untuk bottom nav */}
        <main className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
          {children}
        </main>
      </div>
      
      {/* Mobile Bottom Nav */}
      <BottomNav
        active={activeRoute}
        onNavigate={onNavigate}
        features={features}
        userName={user?.displayName ?? undefined}
        userEmail={user?.email ?? undefined}
        onLogout={onLogout}
      />
      
      {/* Unified Dialog — render di root level, TIDAK di dalam main.
          Ini key untuk mencegah UI tumpang tindih di v16. */}
      <Dialog state={dialog} onClose={onCloseDialog} />
    </div>
  );
}
