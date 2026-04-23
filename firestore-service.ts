// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Firestore Service
// 
// SEMUA operasi Firestore (create, read, update, delete) terpusat
// di sini. Komponen UI TIDAK boleh import firestore langsung —
// mereka harus pakai fungsi-fungsi di file ini.
// 
// Keuntungan:
// - Kalau suatu hari ganti backend (Supabase, custom API), cukup
//   ubah file ini. UI tidak perlu diutak-atik.
// - Validasi terpusat: setiap write divalidasi sebelum masuk DB.
// - Error handling konsisten (satu fungsi, bukan scatter).
// ═══════════════════════════════════════════════════════════════

import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, getDoc, getDocs, query, where, Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { paths } from './firestore-paths';
import type {
  Product, Customer, Transaction, Note, AppSettings,
  TransactionType, TransactionItem, Rupiah, Gram,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import { getBusinessDate } from './calculations';
import { toRupiah, toGrams, calcSubtotal } from './money';

// ───────────────────────────────────────────────────────────────
// ERROR HANDLING
// ───────────────────────────────────────────────────────────────

export class FirestoreError extends Error {
  constructor(
    public operation: string,
    public path: string,
    public originalError: unknown
  ) {
    super(`Firestore ${operation} failed at ${path}: ${
      originalError instanceof Error ? originalError.message : String(originalError)
    }`);
    this.name = 'FirestoreError';
  }
}

function wrapError(operation: string, path: string, error: unknown): never {
  console.error(`[Firestore] ${operation} @ ${path}`, error);
  throw new FirestoreError(operation, path, error);
}

function requireUser(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function nowISO(): string {
  return new Date().toISOString();
}

function genId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ───────────────────────────────────────────────────────────────
// VALIDATION (dijalankan SEBELUM write ke DB)
// ───────────────────────────────────────────────────────────────

function validateProduct(p: Partial<Product>): string | null {
  if (!p.name || typeof p.name !== 'string' || !p.name.trim()) return 'Nama produk wajib diisi';
  if (typeof p.pricePerKg !== 'number' || p.pricePerKg < 0) return 'Harga per kg tidak valid';
  return null;
}

function validateCustomer(c: Partial<Customer>): string | null {
  if (!c.name || typeof c.name !== 'string' || !c.name.trim()) return 'Nama customer wajib diisi';
  return null;
}

function validateTransaction(t: Partial<Transaction>): string | null {
  if (!t.type) return 'Tipe transaksi wajib diisi';
  const validTypes: TransactionType[] = ['PURCHASE', 'CAPITAL_INJECTION', 'EXPENSE', 'INCOME', 'OPENING_BALANCE'];
  if (!validTypes.includes(t.type)) return `Tipe transaksi tidak valid: ${t.type}`;
  if (typeof t.amount !== 'number' || !isFinite(t.amount)) return 'Jumlah tidak valid';
  if (t.amount < 0 && t.type !== 'OPENING_BALANCE') return 'Jumlah tidak boleh negatif';
  // OPENING_BALANCE boleh 0 atau positif (set modal awal hari)
  if (!t.timestamp) return 'Timestamp wajib diisi';
  if (!t.businessDate) return 'Business date wajib diisi';
  if (t.type === 'PURCHASE') {
    if (!t.items || !Array.isArray(t.items) || t.items.length === 0) {
      return 'Pembelian harus punya minimal 1 item';
    }
    for (const item of t.items) {
      if (!item.productId || !item.productName) return 'Item harus punya produk';
      if (typeof item.qtyGrams !== 'number' || item.qtyGrams <= 0) return 'Qty harus lebih dari 0';
      if (typeof item.pricePerKg !== 'number' || item.pricePerKg < 0) return 'Harga item tidak valid';
    }
  }
  return null;
}

function validateNote(n: Partial<Note>): string | null {
  if (!n.title || !n.title.trim()) return 'Judul catatan wajib diisi';
  if (!n.content || !n.content.trim()) return 'Isi catatan wajib diisi';
  return null;
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════

export const productsService = {
  subscribe(callback: (products: Product[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const path = paths.products();
    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const items: Product[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
          // Sort: not archived first, then by sortOrder, then name
          items.sort((a, b) => {
            if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
            const so = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
            if (so !== 0) return so;
            return a.name.localeCompare(b.name);
          });
          callback(items);
        },
        (err) => onError?.(new FirestoreError('subscribe', path, err))
      );
    } catch (e) { wrapError('subscribe', path, e); }
  },
  
  async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const err = validateProduct(product);
    if (err) throw new Error(err);
    const path = paths.products();
    try {
      const data = {
        ...product,
        pricePerKg: toRupiah(product.pricePerKg),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      const docRef = await addDoc(collection(db, path), data);
      return docRef.id;
    } catch (e) { wrapError('create', path, e); }
  },
  
  async update(id: string, updates: Partial<Product>): Promise<void> {
    const path = paths.product(id);
    try {
      const data: any = { ...updates, updatedAt: nowISO() };
      if (updates.pricePerKg !== undefined) data.pricePerKg = toRupiah(updates.pricePerKg);
      delete data.id;
      await updateDoc(doc(db, path), data);
    } catch (e) { wrapError('update', path, e); }
  },
  
  async archive(id: string): Promise<void> {
    return productsService.update(id, { archived: true });
  },
  
  async unarchive(id: string): Promise<void> {
    return productsService.update(id, { archived: false });
  },
  
  async delete(id: string): Promise<void> {
    // HATI-HATI: hapus permanen akan bikin transaksi lama kehilangan link produk.
    // Snapshot productName di item tetap ada, jadi data histori tetap valid.
    const path = paths.product(id);
    try {
      await deleteDoc(doc(db, path));
    } catch (e) { wrapError('delete', path, e); }
  },
  
  /** Bulk create default catalog for new installs */
  async seedDefaultCatalog(): Promise<void> {
    const defaults: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
      { name: 'Besi Tua',      pricePerKg: 5500 as Rupiah,  icon: '🔩', sortOrder: 1 },
      { name: 'Besi Super',    pricePerKg: 6500 as Rupiah,  icon: '⚙️', sortOrder: 2 },
      { name: 'Aki Bekas',     pricePerKg: 18000 as Rupiah, icon: '🔋', sortOrder: 3 },
      { name: 'Alma Blok',     pricePerKg: 22000 as Rupiah, icon: '🧱', sortOrder: 4 },
      { name: 'Alma Panci',    pricePerKg: 28000 as Rupiah, icon: '🍳', sortOrder: 5 },
      { name: 'Kuningan',      pricePerKg: 75000 as Rupiah, icon: '🟡', sortOrder: 6 },
      { name: 'Tembaga',       pricePerKg: 95000 as Rupiah, icon: '🟠', sortOrder: 7 },
      { name: 'Kaleng',        pricePerKg: 2500 as Rupiah,  icon: '🥫', sortOrder: 8 },
      { name: 'Seng',          pricePerKg: 4000 as Rupiah,  icon: '🪣', sortOrder: 9 },
      { name: 'Stainless',     pricePerKg: 15000 as Rupiah, icon: '✨', sortOrder: 10 },
    ];
    for (const p of defaults) {
      await productsService.create(p);
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════

export const customersService = {
  subscribe(callback: (customers: Customer[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const path = paths.customers();
    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const items: Customer[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
          items.sort((a, b) => a.name.localeCompare(b.name));
          callback(items);
        },
        (err) => onError?.(new FirestoreError('subscribe', path, err))
      );
    } catch (e) { wrapError('subscribe', path, e); }
  },
  
  async create(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const err = validateCustomer(customer);
    if (err) throw new Error(err);
    const path = paths.customers();
    try {
      const data = { ...customer, createdAt: nowISO(), updatedAt: nowISO() };
      const docRef = await addDoc(collection(db, path), data);
      return docRef.id;
    } catch (e) { wrapError('create', path, e); }
  },
  
  async update(id: string, updates: Partial<Customer>): Promise<void> {
    const path = paths.customer(id);
    try {
      const data: any = { ...updates, updatedAt: nowISO() };
      delete data.id;
      await updateDoc(doc(db, path), data);
    } catch (e) { wrapError('update', path, e); }
  },
  
  async delete(id: string): Promise<void> {
    const path = paths.customer(id);
    try {
      await deleteDoc(doc(db, path));
    } catch (e) { wrapError('delete', path, e); }
  },
};

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS (inti aplikasi)
// ═══════════════════════════════════════════════════════════════

export const transactionsService = {
  subscribe(callback: (transactions: Transaction[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const path = paths.transactions();
    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const items: Transaction[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
          // Sort descending by timestamp (terbaru di atas)
          items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          callback(items);
        },
        (err) => onError?.(new FirestoreError('subscribe', path, err))
      );
    } catch (e) { wrapError('subscribe', path, e); }
  },
  
  /**
   * Create transaction dengan auto-generation businessDate & ID.
   * 
   * PENTING: Fungsi ini adalah SATU-SATUNYA cara bikin transaksi.
   * Validasi + normalisasi data terjadi di sini.
   */
  async create(input: {
    type: TransactionType;
    amount: number;
    note: string;
    timestamp?: string; // kalau null, pakai sekarang
    items?: TransactionItem[];
    customerId?: string;
    customerName?: string;
    source?: string;
  }): Promise<string> {
    const uid = requireUser();
    const timestamp = input.timestamp || nowISO();
    const businessDate = getBusinessDate(timestamp);
    
    // Normalize amount ke integer rupiah
    let amount = toRupiah(input.amount);
    
    // Untuk PURCHASE, hitung ulang amount dari items (jangan percaya input user)
    let normalizedItems: TransactionItem[] | undefined;
    if (input.type === 'PURCHASE' && input.items) {
      normalizedItems = input.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        pricePerKg: toRupiah(item.pricePerKg),
        qtyGrams: toGrams(item.qtyGrams),
        subtotal: calcSubtotal(item.qtyGrams, item.pricePerKg),
      }));
      // Override amount dengan sum of subtotals
      amount = normalizedItems.reduce((sum, it) => sum + it.subtotal, 0) as Rupiah;
    }
    
    const transaction: Omit<Transaction, 'id'> = {
      type: input.type,
      amount,
      note: (input.note || '').trim(),
      timestamp,
      businessDate,
      items: normalizedItems,
      customerId: input.customerId,
      customerName: input.customerName,
      source: input.source,
      createdBy: uid,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    
    // Clean undefined fields (Firestore tidak suka undefined)
    Object.keys(transaction).forEach(k => {
      if ((transaction as any)[k] === undefined) delete (transaction as any)[k];
    });
    
    const err = validateTransaction(transaction);
    if (err) throw new Error(err);
    
    const path = paths.transactions();
    try {
      const docRef = await addDoc(collection(db, path), transaction);
      return docRef.id;
    } catch (e) { wrapError('create', path, e); }
  },
  
  /**
   * Update transaction. Hanya field yang diizinkan yang bisa diubah.
   * ID, createdBy, createdAt TIDAK boleh diubah.
   */
  async update(id: string, updates: Partial<Transaction>): Promise<void> {
    const path = paths.transaction(id);
    try {
      const allowed: Partial<Transaction> = {};
      // Whitelist field yang boleh diedit
      if (updates.amount !== undefined) allowed.amount = toRupiah(updates.amount);
      if (updates.note !== undefined) allowed.note = updates.note.trim();
      if (updates.timestamp !== undefined) {
        allowed.timestamp = updates.timestamp;
        allowed.businessDate = getBusinessDate(updates.timestamp);
      }
      if (updates.items !== undefined) {
        allowed.items = updates.items.map(item => ({
          ...item,
          pricePerKg: toRupiah(item.pricePerKg),
          qtyGrams: toGrams(item.qtyGrams),
          subtotal: calcSubtotal(item.qtyGrams, item.pricePerKg),
        }));
        // Recalc total
        allowed.amount = allowed.items.reduce((sum, it) => sum + it.subtotal, 0) as Rupiah;
      }
      if (updates.customerId !== undefined) allowed.customerId = updates.customerId;
      if (updates.customerName !== undefined) allowed.customerName = updates.customerName;
      if (updates.source !== undefined) allowed.source = updates.source;
      
      (allowed as any).updatedAt = nowISO();
      
      await updateDoc(doc(db, path), allowed as any);
    } catch (e) { wrapError('update', path, e); }
  },
  
  /**
   * Soft delete — set deletedAt, jangan hapus dari DB.
   * Ini jejak audit untuk compliance.
   */
  async softDelete(id: string): Promise<void> {
    const path = paths.transaction(id);
    try {
      await updateDoc(doc(db, path), {
        deletedAt: nowISO(),
        updatedAt: nowISO(),
      });
    } catch (e) { wrapError('softDelete', path, e); }
  },
  
  /** Pulihkan transaksi yang di-soft-delete */
  async restore(id: string): Promise<void> {
    const path = paths.transaction(id);
    try {
      await updateDoc(doc(db, path), {
        deletedAt: null,
        updatedAt: nowISO(),
      });
    } catch (e) { wrapError('restore', path, e); }
  },
  
  /** Hapus permanen — HANYA untuk admin, biasanya tidak dipakai */
  async hardDelete(id: string): Promise<void> {
    const path = paths.transaction(id);
    try {
      await deleteDoc(doc(db, path));
    } catch (e) { wrapError('hardDelete', path, e); }
  },
};

// ═══════════════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════════════

export const notesService = {
  subscribe(callback: (notes: Note[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const path = paths.notes();
    try {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          const items: Note[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Note));
          items.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
          callback(items);
        },
        (err) => onError?.(new FirestoreError('subscribe', path, err))
      );
    } catch (e) { wrapError('subscribe', path, e); }
  },
  
  async create(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const err = validateNote(note);
    if (err) throw new Error(err);
    const path = paths.notes();
    try {
      const data = { ...note, createdAt: nowISO(), updatedAt: nowISO() };
      const docRef = await addDoc(collection(db, path), data);
      return docRef.id;
    } catch (e) { wrapError('create', path, e); }
  },
  
  async update(id: string, updates: Partial<Note>): Promise<void> {
    const path = paths.note(id);
    try {
      const data: any = { ...updates, updatedAt: nowISO() };
      delete data.id;
      await updateDoc(doc(db, path), data);
    } catch (e) { wrapError('update', path, e); }
  },
  
  async delete(id: string): Promise<void> {
    const path = paths.note(id);
    try {
      await deleteDoc(doc(db, path));
    } catch (e) { wrapError('delete', path, e); }
  },
};

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

export const settingsService = {
  subscribe(callback: (settings: AppSettings) => void, onError?: (err: Error) => void): Unsubscribe {
    const { collection: col, doc: docId } = paths.settings();
    const path = `${col}/${docId}`;
    try {
      return onSnapshot(
        doc(db, col, docId),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<AppSettings>;
            // Merge dengan default untuk handle field baru yang belum ada di DB
            callback({
              ...DEFAULT_SETTINGS,
              ...data,
              features: { ...DEFAULT_SETTINGS.features, ...(data.features || {}) },
            } as AppSettings);
          } else {
            callback(DEFAULT_SETTINGS);
          }
        },
        (err) => onError?.(new FirestoreError('subscribe', path, err))
      );
    } catch (e) { wrapError('subscribe', path, e); }
  },
  
  async save(settings: Partial<AppSettings>): Promise<void> {
    const { collection: col, doc: docId } = paths.settings();
    const path = `${col}/${docId}`;
    try {
      await setDoc(doc(db, col, docId), settings, { merge: true });
    } catch (e) { wrapError('save', path, e); }
  },
  
  async get(): Promise<AppSettings> {
    const { collection: col, doc: docId } = paths.settings();
    try {
      const snap = await getDoc(doc(db, col, docId));
      if (!snap.exists()) return DEFAULT_SETTINGS;
      const data = snap.data() as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        features: { ...DEFAULT_SETTINGS.features, ...(data.features || {}) },
      } as AppSettings;
    } catch (e) { wrapError('get', `${col}/${docId}`, e); }
  },
};

// ═══════════════════════════════════════════════════════════════
// INITIAL SETUP
// ═══════════════════════════════════════════════════════════════

/**
 * Cek apakah ini instalasi baru (no products yet).
 * Kalau iya, seed default catalog.
 */
export async function initializeIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, paths.products()));
    if (snap.empty) {
      console.log('[Init] Instalasi baru terdeteksi, seeding default catalog...');
      await productsService.seedDefaultCatalog();
    }
  } catch (e) {
    console.warn('[Init] Gagal cek/seed catalog:', e);
    // Jangan throw — app tetap bisa jalan tanpa seed
  }
}
