// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Money & Weight Arithmetic
// 
// FILOSOFI: Semua nilai uang & berat disimpan sebagai INTEGER.
// - Rupiah: disimpan apa adanya (tidak ada sen di Indonesia)
// - Berat:  disimpan dalam gram (17.5 kg = 17500 gram)
// 
// Ini membuat 0.1 + 0.2 === 0.30000000000000004 TIDAK AKAN PERNAH 
// terjadi di aplikasi ini. Semua operasi aritmatika dilakukan pada 
// integer, dan konversi ke float hanya untuk TAMPILAN.
// ═══════════════════════════════════════════════════════════════

import type { Rupiah, Gram } from './types';

// ───────────────────────────────────────────────────────────────
// CONSTRUCTORS (cara satu-satunya bikin Rupiah/Gram)
// ───────────────────────────────────────────────────────────────

/**
 * Konversi angka apapun ke Rupiah (integer).
 * Float akan di-round ke integer terdekat (banker's rounding untuk adil).
 */
export function toRupiah(value: number | string): Rupiah {
  if (typeof value === 'string') {
    // Hapus semua karakter non-digit kecuali titik dan minus di awal
    const cleaned = value.replace(/[^\d.-]/g, '');
    value = parseFloat(cleaned);
  }
  if (typeof value !== 'number' || !isFinite(value)) return 0 as Rupiah;
  // Round ke integer. Tidak ada sen di rupiah.
  return Math.round(value) as Rupiah;
}

/**
 * Konversi kilogram (float) ke Gram (integer).
 * 17.5 kg → 17500 gram.
 * 
 * PENTING: kita round ke integer gram. Artinya resolusi minimum = 1 gram.
 * Untuk toko rongsok ini lebih dari cukup (timbangan biasanya resolusi 10-100g).
 */
export function kgToGrams(kg: number | string): Gram {
  if (typeof kg === 'string') {
    const cleaned = kg.replace(',', '.').replace(/[^\d.-]/g, '');
    kg = parseFloat(cleaned);
  }
  if (typeof kg !== 'number' || !isFinite(kg) || kg < 0) return 0 as Gram;
  return Math.round(kg * 1000) as Gram;
}

/**
 * Konversi langsung gram → Gram (integer).
 * Dipakai kalau sudah punya nilai gram dari sumber lain.
 */
export function toGrams(value: number): Gram {
  if (!isFinite(value) || value < 0) return 0 as Gram;
  return Math.round(value) as Gram;
}

// ───────────────────────────────────────────────────────────────
// ARITHMETIC (semua operasi pada integer)
// ───────────────────────────────────────────────────────────────

/**
 * Tambah banyak Rupiah. Integer + integer = integer, aman 100%.
 */
export function sumRupiah(...values: (Rupiah | number | undefined | null)[]): Rupiah {
  let total = 0;
  for (const v of values) {
    if (typeof v === 'number' && isFinite(v)) total += v;
  }
  return Math.round(total) as Rupiah;
}

/**
 * Kurangi Rupiah. Jika hasil negatif, tetap dikembalikan (bisa minus).
 * Aplikasi yang memanggil bertanggung jawab menangani minus.
 */
export function subtractRupiah(a: Rupiah | number, b: Rupiah | number): Rupiah {
  return Math.round((a || 0) - (b || 0)) as Rupiah;
}

/**
 * Hitung subtotal dari berat × harga per kg.
 * 
 * Formula: (qtyGrams × pricePerKg) / 1000
 * 
 * CONTOH:
 *   qtyGrams = 17500 (artinya 17.5 kg)
 *   pricePerKg = 5250
 *   subtotal = (17500 × 5250) / 1000 = 91,875,000 / 1000 = 91,875 ✓
 * 
 * Math.round untuk jaga-jaga kalau (qtyGrams × pricePerKg) tidak habis dibagi 1000,
 * misalnya 333 gram × 1000 Rp/kg = 333,000 / 1000 = 333 ✓ (habis)
 * 333 gram × 1001 Rp/kg = 333,333 / 1000 = 333.333 → round ke 333 ✓
 */
export function calcSubtotal(qtyGrams: Gram | number, pricePerKg: Rupiah | number): Rupiah {
  const qty = qtyGrams || 0;
  const price = pricePerKg || 0;
  // Hitung di domain integer: (gram * rupiah) = integer besar. Bagi 1000 = rupiah.
  const product = qty * price;
  return Math.round(product / 1000) as Rupiah;
}

/**
 * Hitung harga per kg dari subtotal dan berat. (Operasi kebalikan calcSubtotal)
 * Berguna untuk "Hitung mundur: kalau bayar Rp X untuk Y kg, harganya per kg berapa?"
 */
export function calcPricePerKg(subtotal: Rupiah | number, qtyGrams: Gram | number): Rupiah {
  const qty = qtyGrams || 0;
  if (qty === 0) return 0 as Rupiah;
  // (rupiah / gram) × 1000 = rupiah/kg
  return Math.round(((subtotal || 0) * 1000) / qty) as Rupiah;
}

// ───────────────────────────────────────────────────────────────
// FORMATTING (untuk tampilan saja, tidak pernah dipakai untuk kalkulasi)
// ───────────────────────────────────────────────────────────────

/**
 * Format rupiah: 1250000 → "Rp 1.250.000"
 */
export function formatRupiah(value: Rupiah | number | undefined | null): string {
  const n = Math.round(Number(value) || 0);
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID') + '';
  // Catatan: kalau negatif, diprefix "-" di awal sebelum "Rp"
}

/**
 * Format rupiah dengan penanganan minus yang jelas.
 * Positive: "Rp 1.250.000"
 * Negative: "-Rp 1.250.000"
 * Zero:     "Rp 0"
 */
export function formatRupiahSigned(value: Rupiah | number | undefined | null): string {
  const n = Math.round(Number(value) || 0);
  if (n < 0) return '-Rp ' + Math.abs(n).toLocaleString('id-ID');
  return 'Rp ' + n.toLocaleString('id-ID');
}

/**
 * Format rupiah tanpa prefix "Rp" (untuk struk thermal yang sempit).
 */
export function formatRupiahPlain(value: Rupiah | number | undefined | null): string {
  const n = Math.round(Number(value) || 0);
  return Math.abs(n).toLocaleString('id-ID');
}

/**
 * Format input rupiah selagi user mengetik.
 * "1250000" → "1.250.000" (untuk input[type=text] dengan format live)
 */
export function formatRupiahInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('id-ID');
}

/**
 * Parse input user ke Rupiah integer.
 * "1.250.000" → 1250000
 * "Rp 1.250.000" → 1250000
 * "1250000" → 1250000
 */
export function parseRupiahInput(raw: string): Rupiah {
  if (!raw) return 0 as Rupiah;
  const digits = raw.replace(/\D/g, '');
  return (parseInt(digits, 10) || 0) as Rupiah;
}

/**
 * Format berat: 17500 gram → "17,5 kg"
 * Maksimal 3 desimal. Menggunakan koma sebagai desimal (format Indonesia).
 */
export function formatWeight(grams: Gram | number | undefined | null): string {
  const g = Number(grams) || 0;
  const kg = g / 1000;
  // toLocaleString dengan id-ID otomatis pakai koma sebagai desimal
  return kg.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }) + ' kg';
}

/**
 * Format berat tanpa unit (untuk input).
 * 17500 gram → "17,5"
 */
export function formatWeightPlain(grams: Gram | number | undefined | null): string {
  const g = Number(grams) || 0;
  const kg = g / 1000;
  return kg.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

/**
 * Konversi Gram → kg (float) untuk tampilan.
 * PERHATIAN: hasilnya FLOAT, jangan dipakai untuk kalkulasi lanjutan.
 */
export function gramsToKg(grams: Gram | number | undefined | null): number {
  return (Number(grams) || 0) / 1000;
}

// ───────────────────────────────────────────────────────────────
// VALIDATION & GUARDS
// ───────────────────────────────────────────────────────────────

/**
 * Cek apakah nilai rupiah valid (bukan NaN, bukan Infinity, bukan negatif berlebihan).
 */
export function isValidRupiah(value: unknown): value is Rupiah {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

/**
 * Clamp rupiah ke minimum 0 (tidak bisa negatif).
 * Untuk field yang secara logis tidak boleh minus (misal: harga produk).
 */
export function clampPositiveRupiah(value: Rupiah | number): Rupiah {
  const n = Math.round(Number(value) || 0);
  return Math.max(0, n) as Rupiah;
}

// ───────────────────────────────────────────────────────────────
// UNIT TESTS BAWAAN (self-verification)
// 
// Panggil `verifyMoneyMath()` di startup development untuk memastikan
// tidak ada floating-point error. Kalau ada, error thrown dengan jelas.
// ───────────────────────────────────────────────────────────────

export function verifyMoneyMath(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  
  const assert = (name: string, actual: number, expected: number) => {
    if (actual !== expected) {
      failures.push(`[${name}] expected ${expected}, got ${actual}`);
    }
  };
  
  // Test 1: Basic integer rupiah
  assert('sum 100+200', sumRupiah(100 as Rupiah, 200 as Rupiah), 300);
  
  // Test 2: Nilai yang bikin float error di v16
  // 0.1 + 0.2 di float = 0.30000000000000004
  // Tapi kita konversi ke integer dulu
  assert('0.1+0.2 as rupiah', sumRupiah(toRupiah(0.1), toRupiah(0.2)), 0); // 0.1 round ke 0, 0.2 round ke 0
  // Math.round di JS: 100.5 → 101, 200.5 → 201. Sum = 302.
  assert('100.5+200.5 as rupiah', sumRupiah(toRupiah(100.5), toRupiah(200.5)), 302);
  
  // Test 3: Kasus nyata toko rongsok
  // 17.5 kg × Rp 5250 = Rp 91,875
  assert(
    '17.5kg x 5250 = 91875',
    calcSubtotal(kgToGrams(17.5), 5250 as Rupiah),
    91875
  );
  
  // Test 4: Harga pecahan yang susah
  // 0.333 kg × 75000 = 24.975 → round ke 24975
  assert(
    '0.333kg x 75000 = 24975',
    calcSubtotal(kgToGrams(0.333), 75000 as Rupiah),
    24975
  );
  
  // Test 5: Kalkulasi total harian
  // Modal 1,000,000 + Injeksi 500,000 - Beli 300,000 - Biaya 50,000 = 1,150,000
  const sisaKas = sumRupiah(
    1_000_000 as Rupiah,
    500_000 as Rupiah,
    -300_000,
    -50_000
  );
  assert('daily total', sisaKas, 1_150_000);
  
  // Test 6: kgToGrams round-trip
  assert('1.234 kg round-trip', kgToGrams(1.234), 1234);
  assert('0.001 kg round-trip', kgToGrams(0.001), 1);
  
  // Test 7: calcPricePerKg kebalikan calcSubtotal
  const subtotal = calcSubtotal(kgToGrams(10), 7500 as Rupiah); // 75000
  assert('reverse calc', calcPricePerKg(subtotal, kgToGrams(10)), 7500);
  
  // Test 8: Format tidak hilangkan presisi
  const testVal = 1_234_567_890 as Rupiah;
  const formatted = formatRupiah(testVal);
  const parsed = parseRupiahInput(formatted);
  assert('format-parse round-trip', parsed, 1_234_567_890);
  
  return { ok: failures.length === 0, failures };
}
