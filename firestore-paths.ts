// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Firestore Path Helpers
// 
// SEMUA path ke Firestore terpusat di file ini. Jangan pernah
// hardcode path di komponen! Kalau suatu hari struktur database
// berubah, cukup edit file ini.
// ═══════════════════════════════════════════════════════════════

import { APP_ID } from './types';

const ROOT = `artifacts/${APP_ID}/public/data`;

export const paths = {
  // Collections
  products:     () => `${ROOT}/products`,
  customers:    () => `${ROOT}/customers`,
  transactions: () => `${ROOT}/transactions`, // NEW di v17: single collection
  notes:        () => `${ROOT}/notes`,
  backups:      () => `${ROOT}/backups`,
  
  // Single documents
  settings:     () => ({ collection: `${ROOT}/settings`, doc: 'config' }),
  
  // Specific document helpers
  product:      (id: string) => `${paths.products()}/${id}`,
  customer:     (id: string) => `${paths.customers()}/${id}`,
  transaction:  (id: string) => `${paths.transactions()}/${id}`,
  note:         (id: string) => `${paths.notes()}/${id}`,
  backup:       (id: string) => `${paths.backups()}/${id}`,
};

/**
 * Path untuk data v16 lama (untuk migrasi / import).
 * JANGAN WRITE ke sini — hanya READ untuk import.
 */
export const legacyV16Paths = {
  root:         () => `artifacts/masdeen-finance-v16/public/data`,
  products:     () => `artifacts/masdeen-finance-v16/public/data/products`,
  customers:    () => `artifacts/masdeen-finance-v16/public/data/customers`,
  history:      () => `artifacts/masdeen-finance-v16/public/data/history`,
  dailyStats:   () => `artifacts/masdeen-finance-v16/public/data/daily_stats/current_day`,
  notes:        () => `artifacts/masdeen-finance-v16/public/data/notes`,
  settings:     () => ({ collection: `artifacts/masdeen-finance-v16/public/data/settings`, doc: 'config' }),
};
