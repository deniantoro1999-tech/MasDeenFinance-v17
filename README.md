# MasDeen Finance v17

> **Super Smart POS & Finance System** untuk CV. Timika Jaya Sejahterah  
> Sistem manajemen keuangan toko rongsok dengan kalkulasi 100% akurat.  
> Dikembangkan secara resmi oleh **Deni Antoro**.

---

## ✨ Fitur Utama

### 📊 Dashboard
- Ringkasan kas harian real-time
- Rumus perhitungan transparan (Modal + Injeksi - Pembelian - Biaya = Sisa Kas)
- Quick actions untuk injeksi modal, biaya, pemasukan
- Tutup hari & rollover otomatis

### 🛒 Kasir POS
- Katalog produk rongsok (Besi, Aki, Alma, Kuningan, dll)
- **Inline calculator di QtyInput** — ketik `10 + 5.5 + 2` → otomatis 17.5 kg
- Edit harga per item (untuk nego)
- Pilih supplier
- Cetak struk / PDF / share WhatsApp

### 📅 Daily Report
- Detail transaksi per hari
- Navigator tanggal antar hari
- Tutup buku manual

### 💰 Operasional
- CRUD biaya operasional
- Filter per periode
- Stats: total, jumlah, rata-rata

### 👥 Customers (Supplier)
- CRUD supplier
- Riwayat transaksi per supplier
- Top supplier ranking

### 📈 Reports
- Chart tren harian (Area Chart)
- Pie chart komposisi produk
- Top 5 supplier
- Export Excel, PDF, Word

### 💸 Pajak
- Default: PPh Final UMKM 0.5% (sesuai status CV. Timika Jaya Sejahterah)
- Preset lain: PPh 22, PPN, Custom
- Breakdown per bulan
- Warning otomatis kalau omzet > Rp 4.8M (batas UMKM)

### 🤖 MasDeen AI
- Chat dengan Gemini AI untuk analisis keuangan
- Context auto-built dari data transaksi
- Markdown rendering
- Fallback graceful kalau API key belum diset

### 📝 Notes
- Catatan dengan kategori (Umum, Keuangan, Tugas, Ide)
- 5 warna card
- Search & filter

### ⚙️ Settings
- Informasi toko + struk
- **Pilih tema: Dark / Light / Nature**
- Pengaturan pajak
- Feature flags (hidup-matikan modul)
- Backup & restore (JSON)
- Migrasi otomatis dari v16 (legacy data)

---

## 🚀 Setup & Install

### Prerequisite
- Node.js 18+
- npm atau pnpm
- Akun Firebase (Auth + Firestore)
- (Opsional) API Key Gemini untuk AI features

### Langkah Install

```bash
# 1. Install dependencies
npm install

# 2. Setup Firebase
# - Buat project di https://console.firebase.google.com
# - Enable Authentication (Google + Email/Password)
# - Enable Firestore Database
# - Copy config ke firebase-applet-config.json:
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "firestoreDatabaseId": "(default)"
}

# 3. (Opsional) Setup Gemini AI
# Tambahkan ke .env:
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# 4. Setup Firestore Security Rules (firestore.rules)
# Lihat file firestore.rules untuk template yang aman

# 5. Run dev server
npm run dev
# → buka http://localhost:3000

# 6. Build untuk production
npm run build
npm run preview
```

---

## 🏗️ Arsitektur

```
src/
├── main.tsx                       # Entry point + apply theme
├── App.tsx                        # Root component (wiring)
├── firebase.ts                    # Firebase config
├── index.css                      # Global styles + theme + receipt CSS
│
├── lib/                           # Business logic (no UI)
│   ├── types.ts                   # Type definitions (single source of truth)
│   ├── money.ts                   # Integer money math (anti floating-point)
│   ├── parser.ts                  # Safe expression parser (no eval!)
│   ├── calculations.ts            # Carry-over, daily snapshots, period summary
│   ├── design-tokens.ts           # Z-index, colors, spacing
│   ├── firestore-paths.ts         # Centralized DB paths
│   ├── firestore-service.ts       # CRUD untuk semua collection
│   ├── backup-service.ts          # Export/import JSON + migrator v16
│   ├── export-service.ts          # Excel, PDF, Word export
│   ├── receipt-service.ts         # Print thermal, PDF struk, WA share
│   └── ai-service.ts              # Gemini AI integration
│
├── hooks/
│   ├── useAuth.ts                 # Authentication state
│   ├── useFirestoreSync.ts        # Real-time data sync
│   └── useDialog.ts               # Unified alert/confirm
│
├── components/
│   ├── auth/
│   │   └── LoginScreen.tsx        # Login (Google + Email/HP)
│   ├── layout/
│   │   ├── AppShell.tsx           # Main container
│   │   ├── Sidebar.tsx            # Desktop nav
│   │   ├── BottomNav.tsx          # Mobile nav + drawer
│   │   ├── BrandHeader.tsx        # Brand + verified badge
│   │   └── LoadingScreen.tsx      # Splash screen
│   ├── ui/
│   │   ├── Modal.tsx              # Universal modal
│   │   ├── Dialog.tsx             # Alert/Confirm
│   │   ├── QtyInput.tsx           # Smart qty input
│   │   └── MoneyInput.tsx         # Money input dengan format live
│   └── modules/
│       ├── DashboardModule.tsx
│       ├── POSModule.tsx
│       ├── DailyReportModule.tsx
│       ├── OperasionalModule.tsx
│       ├── CustomersModule.tsx
│       ├── ReportsModule.tsx
│       ├── TaxModule.tsx
│       ├── AIModule.tsx
│       ├── NotesModule.tsx
│       └── SettingsModule.tsx
```

### 🎯 Filosofi Desain

**1. Integer Money Math**  
Semua uang disimpan sebagai integer rupiah, berat sebagai integer gram.
`0.1 + 0.2 = 0.30000000000000004` TIDAK PERNAH terjadi di aplikasi ini.

**2. Single Source of Truth**  
Collection `transactions` adalah satu-satunya tempat data. Semua kalkulasi
(daily snapshot, carry-over, period summary) DITURUNKAN dari sini real-time.

**3. Service Layer Pattern**  
UI tidak pernah import Firebase langsung. Semua lewat `*Service`. Kalau
suatu hari ganti backend, cukup edit 1 file.

**4. Design Tokens Terpusat**  
Z-index, warna, durasi animasi semua di `design-tokens.ts`. Mau ganti tema?
Edit 1 file, semua komponen ikut.

**5. Type-Safe Transactions**  
Eksplisit: `'PURCHASE' | 'CAPITAL_INJECTION' | 'EXPENSE' | 'INCOME' | 'OPENING_BALANCE'`.
TIDAK ada string matching `note.includes('MODAL')` rapuh seperti v16.

---

## 🧪 Testing

Aplikasi ini dilengkapi 121+ test case otomatis:

```bash
# Run math layer tests (Sesi 1)
npx tsx test-runner.ts

# Run end-to-end business simulation (Sesi 5)
npx tsx test-e2e.ts

# Run POS scenarios (Sesi 4)
npx tsx test-pos-scenarios.ts

# Run reports & tax (Sesi 6)
npx tsx test-reports-tax.ts

# Run migrator (Sesi 2)
npx tsx test-migrator-standalone.ts
```

**Hasil:** semua hijau ✓

---

## 📋 Migrasi dari v16

Kalau Anda punya backup v16 lama:

1. Buka aplikasi v17 baru
2. Login dengan akun Anda
3. Pergi ke **Settings → Backup & Restore → Import**
4. Pilih file backup v16 (.json)
5. Sistem otomatis deteksi format dan migrasi
6. Review warning yang muncul (terutama transaksi PENJUALAN yang dikonversi ke INCOME)

Migrator bekerja konservatif — data ambigu di-flag untuk review manual,
bukan di-guess.

---

## 📞 Support

**Developer:** Deni Antoro  
**Versi:** 17.0.0  
**License:** Proprietary — CV. Timika Jaya Sejahterah

---

> *"Dikembangkan secara resmi dan keamanan yang terintegritas/terverifikasi resmi oleh Deni Antoro."*
