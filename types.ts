// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Type Definitions
// Single source of truth untuk seluruh aplikasi.
// Setiap kali struktur data berubah, UBAH DI SINI DULU.
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// TRANSACTION TYPES (eksplisit, tidak pakai string matching!)
// ───────────────────────────────────────────────────────────────

/**
 * Tipe transaksi eksplisit. Setiap entry HARUS punya salah satu type ini.
 * Ini menggantikan logika `note.includes('MODAL')` dari v16 yang rapuh.
 */
export type TransactionType =
  | 'PURCHASE'            // Pembelian rongsok dari supplier (pengeluaran utama)
  | 'CAPITAL_INJECTION'   // Injeksi modal (menambah kas, bukan pemasukan operasional)
  | 'EXPENSE'             // Biaya operasional (bensin, makan, dll)
  | 'INCOME'              // Pemasukan lain (setor ke pengepul, pemasukan non-operasional)
  | 'OPENING_BALANCE'     // Saldo pembuka hari (override manual)

/**
 * Arah arus kas dari setiap tipe transaksi.
 * Digunakan oleh calculations.ts untuk menghitung sisa kas.
 */
export const TX_FLOW: Record<TransactionType, 'IN' | 'OUT' | 'NEUTRAL'> = {
  PURCHASE: 'OUT',
  CAPITAL_INJECTION: 'IN',
  EXPENSE: 'OUT',
  INCOME: 'IN',
  OPENING_BALANCE: 'NEUTRAL', // bukan arus, tapi override langsung
};

// ───────────────────────────────────────────────────────────────
// MONEY & WEIGHT (integer storage, zero floating-point error)
// ───────────────────────────────────────────────────────────────

/**
 * Rupiah disimpan sebagai integer (satuan: rupiah, bukan sen).
 * TIDAK PERNAH float. Kalau ada pecahan, round dulu.
 */
export type Rupiah = number & { readonly __brand: 'Rupiah' };

/**
 * Berat disimpan sebagai integer gram (1 kg = 1000 gram).
 * Tampilan ke user tetap dalam kg dengan 3 desimal.
 */
export type Gram = number & { readonly __brand: 'Gram' };

// ───────────────────────────────────────────────────────────────
// PRODUCT (Katalog barang rongsok)
// ───────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  /** Harga per kg dalam rupiah (integer) */
  pricePerKg: Rupiah;
  /** Icon emoji atau URL */
  icon?: string;
  /** Urutan tampilan (optional) */
  sortOrder?: number;
  /** Untuk soft delete tanpa hilangkan dari history */
  archived?: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// ───────────────────────────────────────────────────────────────
// CUSTOMER (Supplier rongsok)
// ───────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  /** Total pembelian dari customer ini (rupiah) — di-update otomatis */
  totalPurchaseAmount?: Rupiah;
  /** Total berat yang pernah dibeli (gram) */
  totalPurchaseWeight?: Gram;
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────────────────────────────────────────────
// TRANSACTION ITEM (baris dalam struk)
// ───────────────────────────────────────────────────────────────

export interface TransactionItem {
  productId: string;
  /** Snapshot nama produk saat transaksi (supaya tetap valid kalau produk dihapus) */
  productName: string;
  /** Harga per kg SAAT transaksi (snapshot) */
  pricePerKg: Rupiah;
  /** Kuantitas dalam gram */
  qtyGrams: Gram;
  /** Subtotal dalam rupiah = round((qtyGrams × pricePerKg) / 1000) */
  subtotal: Rupiah;
}

// ───────────────────────────────────────────────────────────────
// TRANSACTION (entry utama di database)
// ───────────────────────────────────────────────────────────────

/**
 * Satu transaksi = satu entry di Firestore collection `transactions`.
 * Menggantikan sistem v16 yang memisah `dailyStats` dan `history`.
 * 
 * Keuntungan single collection:
 * - Tidak ada lagi bug "transaksi hilang saat tutup buku"
 * - Editing past transaction langsung ter-reflect (tidak perlu rollover chain)
 * - Query by date range jadi sederhana
 */
export interface Transaction {
  id: string;
  type: TransactionType;
  /** Tanggal transaksi (ISO 8601, UTC) */
  timestamp: string;
  /** Tanggal bisnis (YYYY-MM-DD) — dipakai untuk grup "hari ini", "kemarin" */
  businessDate: string;
  /** Jumlah total dalam rupiah (integer). Selalu positif, arah ditentukan oleh `type`. */
  amount: Rupiah;
  /** Catatan bebas dari user */
  note: string;
  /** Untuk PURCHASE: items detail. Untuk type lain: kosong/undefined */
  items?: TransactionItem[];
  /** Untuk PURCHASE: customer yang bersangkutan */
  customerId?: string;
  customerName?: string; // snapshot
  /** Untuk CAPITAL_INJECTION & EXPENSE: sumber dana (opsional) */
  source?: string;
  /** ID user yang input (untuk audit trail) */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Soft-delete untuk jejak audit */
  deletedAt?: string;
}

// ───────────────────────────────────────────────────────────────
// DAILY SNAPSHOT (hasil kalkulasi harian, TIDAK disimpan permanen)
// ───────────────────────────────────────────────────────────────

/**
 * Ringkasan kalkulasi untuk satu hari bisnis.
 * CATATAN: Objek ini SELALU diturunkan dari transactions[] secara real-time,
 * TIDAK pernah disimpan ke database. Ini membuat editing past transaction
 * otomatis ter-reflect tanpa perlu "recalculate chain".
 */
export interface DailySnapshot {
  businessDate: string; // YYYY-MM-DD
  
  /** Modal awal (dari carry-over hari sebelumnya atau OPENING_BALANCE override) */
  openingBalance: Rupiah;
  
  /** Total injeksi modal hari ini */
  capitalInjection: Rupiah;
  
  /** Total pembelian rongsok hari ini */
  totalPurchase: Rupiah;
  
  /** Total biaya operasional hari ini */
  totalExpense: Rupiah;
  
  /** Total pemasukan lain hari ini (INCOME) */
  totalOtherIncome: Rupiah;
  
  /**
   * Sisa Kas = openingBalance + capitalInjection + totalOtherIncome - totalPurchase - totalExpense
   * Rumus fix, TIDAK BISA menghasilkan nilai berbeda untuk data yang sama.
   */
  sisaKas: Rupiah;
  
  /** Total berat yang dibeli hari ini (gram) */
  totalWeightGrams: Gram;
  
  /** Jumlah transaksi PURCHASE hari ini */
  purchaseCount: number;
  
  /** Semua transaksi hari ini (referensi, untuk tampilan) */
  transactions: Transaction[];
}

// ───────────────────────────────────────────────────────────────
// OPENING BALANCE OVERRIDE
// ───────────────────────────────────────────────────────────────

/**
 * Override modal awal untuk tanggal tertentu.
 * Kalau ada, override ini dipakai sebagai modal awal dan carry-over dimulai dari sini.
 * Disimpan sebagai transaksi tipe OPENING_BALANCE.
 */

// ───────────────────────────────────────────────────────────────
// NOTES
// ───────────────────────────────────────────────────────────────

export type NoteCategory = 'Umum' | 'Keuangan' | 'Tugas Penting' | 'Ide Bisnis';

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  /** Warna background card (hex) */
  color: string;
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────────────────────────────────────────────
// SETTINGS (single document di Firestore)
// ───────────────────────────────────────────────────────────────

export interface AppFeatures {
  showStockPurchase: boolean;
  showCustomerModule: boolean;
  showAIChat: boolean;
  showNotes: boolean;
  showTaxModule: boolean;
  autoBackup: boolean;
  appTheme: 'dark' | 'light' | 'nature';
}

export interface AppSettings {
  storeName: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptLogo: string; // base64 atau URL
  receiptColor: string; // hex
  currency: string; // default 'IDR'
  features: AppFeatures;
}

export const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'CV. Timika Jaya Sejahtera',
  receiptHeader: 'Jl. Poros sp2-sp5, pertigaan gym masuk, sebelah kanan jalan, samping batako (gerbang hitam)',
  receiptFooter: 'Perhatikan kembali struk dan tunai yang diterima, sesuaikan!\nTerima kasih atas kerja samanya.',
  receiptLogo: '',
  receiptColor: '#EAB308',
  currency: 'IDR',
  features: {
    showStockPurchase: true,
    showCustomerModule: true,
    showAIChat: true,
    showNotes: true,
    showTaxModule: true,
    autoBackup: true,
    appTheme: 'dark',
  },
};

// ───────────────────────────────────────────────────────────────
// BACKUP FILE FORMAT
// ───────────────────────────────────────────────────────────────

export interface BackupFile {
  /** Format version. v17 = 2. v16 backup file = 1 (butuh migrasi). */
  schemaVersion: number;
  /** AppId yang memproduksi backup ini */
  appId: string;
  /** ISO timestamp saat backup dibuat */
  timestamp: string;
  /** Metadata toko */
  storeName: string;
  /** Semua data */
  settings: AppSettings;
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  notes: Note[];
}

// ───────────────────────────────────────────────────────────────
// LEGACY V16 FORMAT (untuk migrasi)
// ───────────────────────────────────────────────────────────────

/** 
 * Format v16 yang lama. Hanya dipakai sebagai "input" di migrator.
 * Fields: any karena format v16 tidak konsisten.
 */
export interface LegacyV16Backup {
  appId: string;
  timestamp: string;
  storeName?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptLogo?: string;
  receiptColor?: string;
  currency?: string;
  products?: any[];
  customers?: any[];
  dailyStats?: {
    sales?: number;
    transactions?: number;
    capital?: number;
    overrideCapital?: number;
    expenses?: any[];
    incomes?: any[];
  };
  history?: any[];
  features?: any;
}

// ───────────────────────────────────────────────────────────────
// AUTH
// ───────────────────────────────────────────────────────────────

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

// ───────────────────────────────────────────────────────────────
// UI STATE (dialog system, bukan data)
// ───────────────────────────────────────────────────────────────

export type DialogType = 'alert' | 'confirm' | 'error' | 'success';

export interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

// ───────────────────────────────────────────────────────────────
// APP IDENTITY
// ───────────────────────────────────────────────────────────────

export const APP_ID = 'masdeen-finance-v17';
export const APP_VERSION = '17.0.0';
export const APP_NAME = 'MasDeen Finance';
export const DEVELOPER_NAME = 'Deni Antoro';
export const OFFICIAL_LABEL = 
  'Dikembangkan secara resmi dan keamanan yang terintegritas/terverifikasi resmi oleh Deni Antoro.';
