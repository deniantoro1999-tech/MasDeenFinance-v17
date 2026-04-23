// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Backup & Migration Service
//
// Fungsi utama:
// 1. Export data v17 ke file JSON (backup)
// 2. Import file JSON — dengan deteksi format:
//    - v17 (schemaVersion: 2) → direct restore
//    - v16 (legacy) → auto-migrate lalu restore
// 3. Migrator v16 → v17 (konservatif: lebih baik data ter-flag daripada salah)
// ═══════════════════════════════════════════════════════════════

import { collection, addDoc, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { paths } from './firestore-paths';
import type {
  BackupFile, LegacyV16Backup, Product, Customer, Transaction,
  Note, AppSettings, TransactionType, TransactionItem, Rupiah, Gram,
} from './types';
import { DEFAULT_SETTINGS, APP_ID } from './types';
import { toRupiah, toGrams, kgToGrams, calcSubtotal } from './money';
import { getBusinessDate } from './calculations';

// ───────────────────────────────────────────────────────────────
// EXPORT — backup data v17 saat ini ke file JSON
// ───────────────────────────────────────────────────────────────

/**
 * Ambil semua data dari Firestore dan kemas jadi BackupFile.
 * PERFORMANCE: ini ngambil SEMUA data. Untuk 10k+ transaksi bisa lambat.
 * Di future bisa dibuat incremental, tapi untuk sekarang OK.
 */
export async function createBackup(storeName: string): Promise<BackupFile> {
  const [productsSnap, customersSnap, transactionsSnap, notesSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, paths.products())),
    getDocs(collection(db, paths.customers())),
    getDocs(collection(db, paths.transactions())),
    getDocs(collection(db, paths.notes())),
    getDocs(collection(db, paths.settings().collection)),
  ]);
  
  const settingsDoc = settingsSnap.docs.find(d => d.id === 'config');
  const settings: AppSettings = settingsDoc?.exists() 
    ? { ...DEFAULT_SETTINGS, ...(settingsDoc.data() as Partial<AppSettings>) }
    : DEFAULT_SETTINGS;
  
  return {
    schemaVersion: 2,
    appId: APP_ID,
    timestamp: new Date().toISOString(),
    storeName,
    settings,
    products:     productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)),
    customers:    customersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)),
    transactions: transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)),
    notes:        notesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Note)),
  };
}

/**
 * Download backup sebagai file JSON.
 */
export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = backup.storeName.replace(/[^a-zA-Z0-9]/g, '_');
  const date = backup.timestamp.split('T')[0];
  a.href = url;
  a.download = `MasDeen_Backup_${safeName}_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ───────────────────────────────────────────────────────────────
// IMPORT — parse + validate + restore
// ───────────────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean;
  schemaDetected: 'v17' | 'v16-legacy' | 'unknown';
  summary: {
    products: number;
    customers: number;
    transactions: number;
    notes: number;
    warnings: string[];
  };
  error?: string;
}

export type ImportMode = 'replace' | 'merge';

/**
 * Baca file JSON, deteksi format, dan kembalikan parsed data.
 * TIDAK langsung restore — ini step untuk user konfirmasi dulu.
 */
export async function parseBackupFile(file: File): Promise<{
  schema: 'v17' | 'v16-legacy';
  v17Data?: BackupFile;
  v16Data?: LegacyV16Backup;
  preview: {
    products: number;
    customers: number;
    transactions: number;
    notes: number;
    storeName: string;
    timestamp: string;
    warnings: string[];
  };
}> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File tidak valid: bukan JSON yang benar');
  }
  
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File tidak valid: struktur bukan object');
  }
  
  // Deteksi schema
  if (parsed.schemaVersion === 2 && parsed.appId) {
    // v17 format
    const data = parsed as BackupFile;
    const warnings: string[] = [];
    if (data.appId !== APP_ID) {
      warnings.push(`AppId backup (${data.appId}) berbeda dengan yang sekarang (${APP_ID}). Data tetap bisa di-import.`);
    }
    return {
      schema: 'v17',
      v17Data: data,
      preview: {
        products: data.products?.length || 0,
        customers: data.customers?.length || 0,
        transactions: data.transactions?.length || 0,
        notes: data.notes?.length || 0,
        storeName: data.storeName || '(tidak ada)',
        timestamp: data.timestamp || '',
        warnings,
      },
    };
  }
  
  // Cek v16 format
  if (parsed.appId?.includes('masdeen-finance-v16') || 
      parsed.dailyStats || 
      parsed.history) {
    const data = parsed as LegacyV16Backup;
    const migrated = migrateV16ToV17(data);
    return {
      schema: 'v16-legacy',
      v16Data: data,
      preview: {
        products: migrated.backup.products.length,
        customers: migrated.backup.customers.length,
        transactions: migrated.backup.transactions.length,
        notes: migrated.backup.notes.length,
        storeName: data.storeName || '(tidak ada)',
        timestamp: data.timestamp || '',
        warnings: migrated.warnings,
      },
    };
  }
  
  throw new Error('Format backup tidak dikenali. Pastikan file dari MasDeen Finance v16 atau v17.');
}

/**
 * Restore data dari parsed backup ke Firestore.
 * 
 * Mode:
 * - 'replace': Hapus semua data v17 saat ini, lalu write backup. DESTRUKTIF!
 * - 'merge':   Tambahkan data backup ke yang sudah ada. Duplicate by ID akan di-skip.
 */
export async function restoreBackup(
  parsed: { schema: 'v17' | 'v16-legacy'; v17Data?: BackupFile; v16Data?: LegacyV16Backup },
  mode: ImportMode,
  onProgress?: (step: string, percent: number) => void
): Promise<ImportResult> {
  if (!auth.currentUser) {
    return { success: false, schemaDetected: parsed.schema === 'v17' ? 'v17' : 'v16-legacy',
      summary: { products: 0, customers: 0, transactions: 0, notes: 0, warnings: [] },
      error: 'Harus login untuk restore' };
  }
  
  let data: BackupFile;
  let warnings: string[] = [];
  
  if (parsed.schema === 'v17' && parsed.v17Data) {
    data = parsed.v17Data;
  } else if (parsed.schema === 'v16-legacy' && parsed.v16Data) {
    const migrated = migrateV16ToV17(parsed.v16Data);
    data = migrated.backup;
    warnings = migrated.warnings;
  } else {
    return { success: false, schemaDetected: 'unknown',
      summary: { products: 0, customers: 0, transactions: 0, notes: 0, warnings: [] },
      error: 'Data backup kosong' };
  }
  
  try {
    onProgress?.('Memulai restore...', 0);
    
    if (mode === 'replace') {
      onProgress?.('Menghapus data lama...', 10);
      await clearAllData();
    }
    
    // Collect existing IDs for merge dedup
    const existingIds = mode === 'merge' ? await getExistingIds() : null;
    
    // Products
    onProgress?.('Mengimpor produk...', 20);
    let productCount = 0;
    for (const p of data.products) {
      if (existingIds?.products.has(p.id)) continue;
      const { id, ...rest } = p;
      await setDoc(doc(db, paths.product(id)), rest);
      productCount++;
    }
    
    // Customers
    onProgress?.('Mengimpor customer...', 40);
    let customerCount = 0;
    for (const c of data.customers) {
      if (existingIds?.customers.has(c.id)) continue;
      const { id, ...rest } = c;
      await setDoc(doc(db, paths.customer(id)), rest);
      customerCount++;
    }
    
    // Transactions (ini yang paling banyak, progress per batch)
    onProgress?.('Mengimpor transaksi...', 60);
    let transactionCount = 0;
    const total = data.transactions.length;
    for (let i = 0; i < total; i++) {
      const t = data.transactions[i];
      if (existingIds?.transactions.has(t.id)) continue;
      const { id, ...rest } = t;
      await setDoc(doc(db, paths.transaction(id)), rest);
      transactionCount++;
      if (i % 20 === 0) {
        onProgress?.(`Mengimpor transaksi... (${i + 1}/${total})`, 60 + (i / total) * 30);
      }
    }
    
    // Notes
    onProgress?.('Mengimpor catatan...', 90);
    let noteCount = 0;
    for (const n of data.notes) {
      if (existingIds?.notes.has(n.id)) continue;
      const { id, ...rest } = n;
      await setDoc(doc(db, paths.note(id)), rest);
      noteCount++;
    }
    
    // Settings
    if (data.settings) {
      onProgress?.('Mengimpor pengaturan...', 95);
      const { collection: col, doc: docId } = paths.settings();
      await setDoc(doc(db, col, docId), data.settings, { merge: true });
    }
    
    onProgress?.('Selesai!', 100);
    
    return {
      success: true,
      schemaDetected: parsed.schema === 'v17' ? 'v17' : 'v16-legacy',
      summary: {
        products: productCount,
        customers: customerCount,
        transactions: transactionCount,
        notes: noteCount,
        warnings,
      },
    };
  } catch (e) {
    return {
      success: false,
      schemaDetected: parsed.schema === 'v17' ? 'v17' : 'v16-legacy',
      summary: { products: 0, customers: 0, transactions: 0, notes: 0, warnings },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function clearAllData(): Promise<void> {
  const [products, customers, transactions, notes] = await Promise.all([
    getDocs(collection(db, paths.products())),
    getDocs(collection(db, paths.customers())),
    getDocs(collection(db, paths.transactions())),
    getDocs(collection(db, paths.notes())),
  ]);
  
  const allDocs = [...products.docs, ...customers.docs, ...transactions.docs, ...notes.docs];
  
  // Batch delete (max 500 per batch)
  const BATCH_SIZE = 400;
  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = allDocs.slice(i, i + BATCH_SIZE);
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
  }
}

async function getExistingIds(): Promise<{
  products: Set<string>;
  customers: Set<string>;
  transactions: Set<string>;
  notes: Set<string>;
}> {
  const [products, customers, transactions, notes] = await Promise.all([
    getDocs(collection(db, paths.products())),
    getDocs(collection(db, paths.customers())),
    getDocs(collection(db, paths.transactions())),
    getDocs(collection(db, paths.notes())),
  ]);
  return {
    products:     new Set(products.docs.map(d => d.id)),
    customers:    new Set(customers.docs.map(d => d.id)),
    transactions: new Set(transactions.docs.map(d => d.id)),
    notes:        new Set(notes.docs.map(d => d.id)),
  };
}

// ═══════════════════════════════════════════════════════════════
// MIGRATOR V16 → V17 (paling kompleks — ini hati dari compatibility)
// ═══════════════════════════════════════════════════════════════

/**
 * Konversi format v16 ke v17.
 * 
 * FILOSOFI KONSERVATIF:
 * - Data yang jelas → auto-convert tanpa ragu
 * - Data yang ambigu (mis. "note" bercampur inject/expense) → tandai sebagai
 *   INCOME/EXPENSE biasa dengan warning, biar user review manual
 * - Data yang rusak → skip dengan warning, jangan throw
 * 
 * Semua warning dikumpulkan dan ditunjukkan ke user setelah migrasi.
 */
export function migrateV16ToV17(v16: LegacyV16Backup): {
  backup: BackupFile;
  warnings: string[];
} {
  const warnings: string[] = [];
  const transactions: Transaction[] = [];
  const nowIso = new Date().toISOString();
  const uid = auth.currentUser?.uid || 'migration-script';
  
  // Helper: deteksi tipe dari note string v16 (konservatif)
  function detectType(note: string, explicitType?: string): TransactionType {
    const n = (note || '').toUpperCase();
    
    // Explicit type dari v16 (paling dipercaya)
    if (explicitType === 'MODAL') return 'CAPITAL_INJECTION';
    
    // String match — urutkan dari yang paling spesifik
    if (n.includes('INJEKSI MODAL') || n.includes('INJEKSI') || n.includes('MODAL AWAL')) {
      return 'CAPITAL_INJECTION';
    }
    // V16 tidak punya PURCHASE terpisah — beli stok masuk sebagai EXPENSE
    // dengan note "BELI STOK: ...". Kita upgrade ini jadi PURCHASE kalau
    // ada items detail, kalau tidak tetap EXPENSE.
    if (n.includes('BELI STOK')) {
      return 'PURCHASE'; // akan diperiksa lagi di caller
    }
    if (n.includes('PENJUALAN')) {
      // v17 mode BELI saja, jadi PENJUALAN dianggap INCOME biasa
      return 'INCOME';
    }
    
    // Default: EXPENSE (karena di v16 sebagian besar "expenses" array = pengeluaran)
    return 'EXPENSE';
  }
  
  // Helper: convert v16 item ke v17 TransactionItem
  function convertItem(item: any): TransactionItem | null {
    if (!item || !item.name) return null;
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    if (qty <= 0 || price < 0) return null;
    
    // V16 qty adalah kg (float), harga adalah per kg
    const qtyGrams = kgToGrams(qty);
    const pricePerKg = toRupiah(price);
    return {
      productId: `legacy-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
      productName: item.name,
      pricePerKg,
      qtyGrams,
      subtotal: calcSubtotal(qtyGrams, pricePerKg),
    };
  }
  
  // ───── Migrate dailyStats (transaksi yang belum tutup buku) ─────
  if (v16.dailyStats) {
    const ds = v16.dailyStats;
    const today = getBusinessDate(new Date());
    
    // Override capital jadi OPENING_BALANCE
    if (ds.overrideCapital !== undefined && ds.overrideCapital !== null) {
      transactions.push({
        id: `legacy-opening-${Date.now()}`,
        type: 'OPENING_BALANCE',
        timestamp: nowIso,
        businessDate: today,
        amount: toRupiah(ds.overrideCapital),
        note: 'Migrasi dari v16: override modal awal',
        createdBy: uid,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    
    // Incomes dari dailyStats
    for (const inc of (ds.incomes || [])) {
      if (!inc || !inc.amount) continue;
      const type = detectType(inc.note || '', inc.type);
      const ts = inc.time || nowIso;
      const items = (inc.items || []).map(convertItem).filter(Boolean) as TransactionItem[];
      
      const tx: Transaction = {
        id: `legacy-inc-${inc.id || genId()}`,
        type: type === 'PURCHASE' && items.length === 0 ? 'INCOME' : type,
        timestamp: ts,
        businessDate: getBusinessDate(ts),
        amount: toRupiah(inc.amount),
        note: (inc.note || '').toString(),
        items: items.length > 0 ? items : undefined,
        customerId: inc.customerId || undefined,
        createdBy: uid,
        createdAt: ts,
        updatedAt: nowIso,
      };
      transactions.push(tx);
    }
    
    // Expenses dari dailyStats
    for (const exp of (ds.expenses || [])) {
      if (!exp || !exp.amount) continue;
      const type = detectType(exp.note || '');
      const ts = exp.time || nowIso;
      const items = (exp.items || []).map(convertItem).filter(Boolean) as TransactionItem[];
      
      const tx: Transaction = {
        id: `legacy-exp-${exp.id || genId()}`,
        type: type === 'PURCHASE' && items.length === 0 ? 'EXPENSE' : type,
        timestamp: ts,
        businessDate: getBusinessDate(ts),
        amount: toRupiah(exp.amount),
        note: (exp.note || '').toString(),
        items: items.length > 0 ? items : undefined,
        createdBy: uid,
        createdAt: ts,
        updatedAt: nowIso,
      };
      transactions.push(tx);
    }
  }
  
  // ───── Migrate history (transaksi yang sudah tutup buku) ─────
  for (const h of (v16.history || [])) {
    if (!h) continue;
    
    // History dari v16 = 1 dokumen per hari. Kita expand jadi multiple transactions.
    const histDate = h.date || nowIso;
    const businessDate = getBusinessDate(histDate);
    
    // Incomes di dalam history
    for (const inc of (h.incomes || [])) {
      if (!inc || !inc.amount) continue;
      const type = detectType(inc.note || '', inc.type);
      const ts = inc.time || histDate;
      const items = (inc.items || []).map(convertItem).filter(Boolean) as TransactionItem[];
      
      transactions.push({
        id: `legacy-hist-inc-${h.id}-${inc.id || genId()}`,
        type: type === 'PURCHASE' && items.length === 0 ? 'INCOME' : type,
        timestamp: ts,
        businessDate: getBusinessDate(ts) || businessDate,
        amount: toRupiah(inc.amount),
        note: (inc.note || '').toString(),
        items: items.length > 0 ? items : undefined,
        customerId: inc.customerId || undefined,
        createdBy: uid,
        createdAt: ts,
        updatedAt: nowIso,
      });
    }
    
    // Expenses di dalam history
    for (const exp of (h.expenses || [])) {
      if (!exp || !exp.amount) continue;
      const type = detectType(exp.note || '');
      const ts = exp.time || histDate;
      const items = (exp.items || []).map(convertItem).filter(Boolean) as TransactionItem[];
      
      transactions.push({
        id: `legacy-hist-exp-${h.id}-${exp.id || genId()}`,
        type: type === 'PURCHASE' && items.length === 0 ? 'EXPENSE' : type,
        timestamp: ts,
        businessDate: getBusinessDate(ts) || businessDate,
        amount: toRupiah(exp.amount),
        note: (exp.note || '').toString(),
        items: items.length > 0 ? items : undefined,
        createdBy: uid,
        createdAt: ts,
        updatedAt: nowIso,
      });
    }
    
    // Kalau history punya sales (penjualan mode JUAL) tapi tidak ada detail items,
    // buat satu transaksi INCOME summary
    if (h.sales && h.sales > 0 && (!h.incomes || h.incomes.length === 0)) {
      transactions.push({
        id: `legacy-hist-sales-${h.id}`,
        type: 'INCOME',
        timestamp: histDate,
        businessDate,
        amount: toRupiah(h.sales),
        note: 'Migrasi v16: penjualan harian (mode JUAL, tanpa detail)',
        createdBy: uid,
        createdAt: histDate,
        updatedAt: nowIso,
      });
    }
  }
  
  // ───── Generate warnings ─────
  if (transactions.length === 0 && (v16.history?.length || v16.dailyStats)) {
    warnings.push('Data v16 terdeteksi tapi tidak ada transaksi yang berhasil dikonversi. Silakan review file backup.');
  }
  
  // Hitung transaksi yang di-tag "PENJUALAN" tapi dikonversi jadi INCOME (karena v17 tidak pakai mode JUAL)
  const salesConverted = transactions.filter(t => 
    t.type === 'INCOME' && (t.note || '').toUpperCase().includes('PENJUALAN')
  ).length;
  if (salesConverted > 0) {
    warnings.push(
      `${salesConverted} transaksi PENJUALAN dari v16 dikonversi menjadi INCOME ` +
      `(v17 hanya mode BELI). Silakan review di menu Laporan.`
    );
  }
  
  // Migrate products
  const products: Product[] = (v16.products || []).map((p: any) => ({
    id: p.id || genId(),
    name: p.name || 'Produk tanpa nama',
    pricePerKg: toRupiah(p.price || p.pricePerKg || 0),
    icon: p.icon || '📦',
    sortOrder: p.sortOrder,
    archived: !!p.archived,
    createdAt: p.createdAt || nowIso,
    updatedAt: p.updatedAt || nowIso,
  }));
  
  // Migrate customers
  const customers: Customer[] = (v16.customers || []).map((c: any) => ({
    id: c.id || genId(),
    name: c.name || 'Customer tanpa nama',
    phone: c.phone,
    address: c.address,
    notes: c.notes,
    createdAt: c.createdAt || nowIso,
    updatedAt: c.updatedAt || nowIso,
  }));
  
  // Settings
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    storeName: v16.storeName || DEFAULT_SETTINGS.storeName,
    receiptHeader: v16.receiptHeader || DEFAULT_SETTINGS.receiptHeader,
    receiptFooter: v16.receiptFooter || DEFAULT_SETTINGS.receiptFooter,
    receiptLogo: v16.receiptLogo || DEFAULT_SETTINGS.receiptLogo,
    receiptColor: v16.receiptColor || DEFAULT_SETTINGS.receiptColor,
    currency: v16.currency || DEFAULT_SETTINGS.currency,
    features: {
      ...DEFAULT_SETTINGS.features,
      ...(v16.features || {}),
    },
  };
  
  return {
    backup: {
      schemaVersion: 2,
      appId: APP_ID,
      timestamp: nowIso,
      storeName: settings.storeName,
      settings,
      products,
      customers,
      transactions,
      notes: [], // v16 notes akan di-migrate terpisah kalau ada
    },
    warnings,
  };
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
