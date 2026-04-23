// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Design Tokens
// 
// SEMUA nilai desain yang berulang (warna, z-index, timing) 
// terpusat di file ini. JANGAN hardcode di komponen.
// 
// Pelajaran dari v16: z-index tersebar (50, 100, 300, 9999, 99999)
// → tumpang tindih tidak terprediksi. Kita perbaiki di sini.
// ═══════════════════════════════════════════════════════════════

/**
 * Z-index berjenjang. Angka lebih tinggi = di atas.
 * 
 * ATURAN: setiap komponen WAJIB import dari sini, JANGAN hardcode.
 */
export const Z_INDEX = {
  base: 0,           // default content
  dropdown: 10,      // select dropdown, popover
  sticky: 20,        // sticky header/footer saat scroll
  bottomNav: 30,     // mobile bottom nav
  sidebar: 40,       // desktop sidebar
  modalOverlay: 100, // backdrop dialog
  modalContent: 110, // isi dialog
  toast: 200,        // notifikasi singkat
  loadingOverlay: 300, // full-screen loading (backup, restore)
  splash: 9999,      // splash screen saat load awal
} as const;

/**
 * Warna theme — ambil dari variabel CSS yang sudah ada di index.css
 * (--primary, --bg-main, dll).
 * 
 * Untuk Tailwind class kita tetap pakai `text-yellow-500` dst,
 * tapi yang dinamis (inline style, chart) pakai dari sini.
 */
export const COLORS = {
  // Primary brand (emas)
  gold: {
    100: '#FEF08A',
    300: '#FDE047',
    500: '#EAB308',
    600: '#CA8A04',
    700: '#A16207',
    800: '#854D0E',
    900: '#713F12',
  },
  // Background
  bg: {
    main: '#020202',      // hampir hitam pekat (dari v16 index.css)
    card: '#080808',
    elevated: '#0F0F0F',
    hover: '#161616',
  },
  // Status
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  // Text
  text: {
    primary: '#E2E8F0',
    secondary: '#94A3B8',
    muted: '#64748B',
    subtle: '#475569',
  },
} as const;

/**
 * Timing untuk animasi. Konsistensi timing = kesan "premium".
 * Dari v16 saya lihat ada mix antara 0.3s, 1s, 2s, 3.5s — tidak konsisten.
 */
export const DURATION = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 800,
  splash: 1500,
} as const;

/**
 * Spacing & sizing yang sering dipakai.
 */
export const SIZE = {
  sidebarWidth: '16rem',     // 256px
  bottomNavHeight: '4rem',    // 64px
  headerHeight: '4rem',
  mobileBreakpoint: '768px',
} as const;

/**
 * Class Tailwind yang sering dipakai (untuk konsistensi).
 * Dipakai sebagai fragment, contoh: `className={TW.glassCard}`
 */
export const TW = {
  // Premium glass card effect (signature v17)
  glassCard: 'bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/20 rounded-2xl',
  
  // Dark card (lebih solid dari glass)
  darkCard: 'bg-[#0F0F0F] border border-yellow-600/15 rounded-2xl',
  
  // Gold button (primary CTA)
  goldButton: 'bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-700 text-black font-bold hover:from-yellow-300 hover:to-yellow-600 shadow-lg shadow-yellow-600/20',
  
  // Ghost button (secondary)
  ghostButton: 'border border-yellow-600/40 text-yellow-500 hover:bg-yellow-500/10 hover:border-yellow-500',
  
  // Danger button
  dangerButton: 'bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60',
  
  // Input field (konsisten semua form)
  input: 'w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 transition-colors',
  
  // Text dengan glow emas (signature)
  goldText: 'bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent',
  
  // Hover lift (card yang respond ke hover)
  hoverLift: 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-yellow-900/20',
} as const;
