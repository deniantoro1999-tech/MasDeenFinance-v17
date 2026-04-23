// ═══════════════════════════════════════════════════════════════
// SettingsModule — Pengaturan aplikasi lengkap
// 
// Bagian-bagian:
// 1. Informasi Toko (nama, header/footer struk)
// 2. Tampilan Tema (Dark/Light/Nature)
// 3. Pajak (preset PPh UMKM aktif default)
// 4. Fitur Flags (hidup-matikan modul)
// 5. Backup & Restore (JSON file)
// 6. Zona Bahaya (reset data)
// 7. Watermark + developer info
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Settings as SettingsIcon, Store, Printer, Palette, Calculator,
  Download, Upload, RotateCcw, ShieldCheck, AlertTriangle, Check,
  Moon, Sun, Leaf, ChevronRight, Info, Save, DatabaseBackup,
  Loader2, FileSpreadsheet, Sparkles, Users, StickyNote as NoteIcon,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { AppSettings, AppFeatures, BackupFile } from '../../lib/types';
import { DEVELOPER_NAME, OFFICIAL_LABEL, APP_VERSION } from '../../lib/types';

// ───────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────

export type TaxType = 'PPH_FINAL_UMKM' | 'PPH_22' | 'PPN' | 'CUSTOM';

export interface SettingsModuleProps {
  settings: AppSettings;
  onSaveSettings: (updates: Partial<AppSettings>) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
  onResetAllData: () => Promise<void>;
  // Tax config sementara disimpan di settings extension (kalau belum ada, default PPh UMKM)
  taxType?: TaxType;
  taxRate?: number;
  onUpdateTax?: (type: TaxType, rate: number) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function SettingsModule({
  settings,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onResetAllData,
  taxType = 'PPH_FINAL_UMKM',
  taxRate = 0.005,
  onUpdateTax,
}: SettingsModuleProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetDouble, setShowResetDouble] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const showSaved = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 2500);
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportBackup();
      showSaved('Backup berhasil diunduh');
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      await onImportBackup(file);
      showSaved('Data berhasil dipulihkan');
    } catch (err) {
      showSaved(err instanceof Error ? `Gagal: ${err.message}` : 'Gagal import');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };
  
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onResetAllData();
      setShowResetConfirm(false);
      setShowResetDouble(false);
      showSaved('Data berhasil direset');
    } finally {
      setIsResetting(false);
    }
  };
  
  return (
    <>
      <div className="p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div>
          <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
            Pengaturan
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Konfigurasi</span> Aplikasi
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kustomisasi tampilan, struk, pajak, backup, dan fitur aplikasi
          </p>
        </div>
        
        {/* Saved indicator */}
        {savedMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm"
          >
            <Check size={14} />
            {savedMessage}
          </motion.div>
        )}
        
        {/* Section 1: Informasi Toko */}
        <SettingsSection icon={Store} title="Informasi Toko" iconColor="text-blue-400">
          <TextField
            label="Nama Toko"
            value={settings.storeName}
            onChange={(v) => onSaveSettings({ storeName: v })}
            onBlur={() => showSaved('Nama toko tersimpan')}
          />
          
          <TextareaField
            label="Header Struk"
            hint="Alamat toko, nomor telepon, dll. Tampil di bagian atas struk."
            value={settings.receiptHeader}
            rows={3}
            onChange={(v) => onSaveSettings({ receiptHeader: v })}
            onBlur={() => showSaved('Header struk tersimpan')}
          />
          
          <TextareaField
            label="Footer Struk"
            hint="Pesan terima kasih, disclaimer, dll."
            value={settings.receiptFooter}
            rows={3}
            onChange={(v) => onSaveSettings({ receiptFooter: v })}
            onBlur={() => showSaved('Footer struk tersimpan')}
          />
        </SettingsSection>
        
        {/* Section 2: Tampilan Tema */}
        <SettingsSection icon={Palette} title="Tampilan Tema" iconColor="text-yellow-400">
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-3 block">
              Pilih Tema Aplikasi
            </label>
            <div className="grid grid-cols-3 gap-3">
              <ThemeCard
                icon={Moon}
                label="Dark"
                description="Hitam & Emas"
                active={settings.features.appTheme === 'dark'}
                onClick={() => onSaveSettings({
                  features: { ...settings.features, appTheme: 'dark' }
                })}
                preview={['#020202', '#EAB308', '#F59E0B']}
              />
              <ThemeCard
                icon={Sun}
                label="Light"
                description="Putih & Emas"
                active={settings.features.appTheme === 'light'}
                onClick={() => onSaveSettings({
                  features: { ...settings.features, appTheme: 'light' }
                })}
                preview={['#FAFAFA', '#EAB308', '#854D0E']}
              />
              <ThemeCard
                icon={Leaf}
                label="Nature"
                description="Hijau & Emas"
                active={settings.features.appTheme === 'nature'}
                onClick={() => onSaveSettings({
                  features: { ...settings.features, appTheme: 'nature' }
                })}
                preview={['#0A1F14', '#10B981', '#EAB308']}
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-3">
              💡 Tema akan diterapkan ke seluruh aplikasi. Perubahan akan terlihat setelah refresh halaman.
            </p>
          </div>
        </SettingsSection>
        
        {/* Section 3: Pajak */}
        <SettingsSection icon={Calculator} title="Pengaturan Pajak" iconColor="text-emerald-400">
          {onUpdateTax && (
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-3 block">
                Jenis Pajak
              </label>
              <div className="space-y-2">
                <TaxOption
                  type="PPH_FINAL_UMKM"
                  name="PPh Final UMKM"
                  rate={0.005}
                  description="0.5% dari omzet — untuk UMKM dengan peredaran bruto < Rp 4.8 M/tahun (PP 55/2022)"
                  selected={taxType === 'PPH_FINAL_UMKM'}
                  onClick={() => onUpdateTax('PPH_FINAL_UMKM', 0.005)}
                  recommended
                />
                <TaxOption
                  type="PPH_22"
                  name="PPh Pasal 22"
                  rate={0.0025}
                  description="0.25% untuk pembelian dari pedagang pengumpul"
                  selected={taxType === 'PPH_22'}
                  onClick={() => onUpdateTax('PPH_22', 0.0025)}
                />
                <TaxOption
                  type="PPN"
                  name="PPN"
                  rate={0.11}
                  description="11% untuk Pengusaha Kena Pajak (PKP)"
                  selected={taxType === 'PPN'}
                  onClick={() => onUpdateTax('PPN', 0.11)}
                />
                <TaxOption
                  type="CUSTOM"
                  name="Custom Rate"
                  rate={taxRate}
                  description="Atur persentase pajak sendiri"
                  selected={taxType === 'CUSTOM'}
                  onClick={() => onUpdateTax('CUSTOM', taxRate)}
                  isCustom
                  customValue={taxRate * 100}
                  onCustomChange={(pct) => onUpdateTax('CUSTOM', pct / 100)}
                />
              </div>
              <div className="mt-3 p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl flex items-start gap-2">
                <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-300/80 leading-relaxed">
                  <strong className="text-blue-300">CV. Timika Jaya Sejahterah</strong> menggunakan 
                  PPh Final UMKM 0.5% (setelan default). Ubah hanya jika status perpajakan berubah 
                  atau atas saran konsultan pajak.
                </p>
              </div>
            </div>
          )}
        </SettingsSection>
        
        {/* Section 4: Fitur Flags */}
        <SettingsSection icon={SettingsIcon} title="Fitur Aplikasi" iconColor="text-purple-400">
          <p className="text-[11px] text-gray-500 mb-3">
            Aktifkan atau matikan modul sesuai kebutuhan. Modul yang dimatikan akan disembunyikan dari navigasi.
          </p>
          <div className="space-y-2">
            <FeatureToggle
              label="Kasir POS"
              description="Modul pembelian rongsok dengan katalog dan cart"
              checked={settings.features.showStockPurchase}
              onChange={(v) => onSaveSettings({
                features: { ...settings.features, showStockPurchase: v }
              })}
              locked
            />
            <FeatureToggle
              label="Manajemen Pelanggan"
              description="CRUD supplier dengan riwayat transaksi"
              checked={settings.features.showCustomerModule}
              icon={Users}
              onChange={(v) => onSaveSettings({
                features: { ...settings.features, showCustomerModule: v }
              })}
            />
            <FeatureToggle
              label="MasDeen AI"
              description="Chat asisten AI untuk analisis keuangan"
              checked={settings.features.showAIChat}
              icon={Sparkles}
              onChange={(v) => onSaveSettings({
                features: { ...settings.features, showAIChat: v }
              })}
            />
            <FeatureToggle
              label="Modul Pajak"
              description="Perhitungan pajak PPh/PPN untuk SPT"
              checked={settings.features.showTaxModule}
              icon={Calculator}
              onChange={(v) => onSaveSettings({
                features: { ...settings.features, showTaxModule: v }
              })}
            />
            <FeatureToggle
              label="Catatan"
              description="Memo & catatan bisnis dengan kategori"
              checked={settings.features.showNotes}
              icon={NoteIcon}
              onChange={(v) => onSaveSettings({
                features: { ...settings.features, showNotes: v }
              })}
            />
            <FeatureToggle
              label="Auto Backup"
              description="Otomatis backup ke cloud setiap hari"
              checked={settings.features.autoBackup}
              icon={DatabaseBackup}
              onChange={(v) => onSaveSettings({
                features: { ...settings.features, autoBackup: v }
              })}
            />
          </div>
        </SettingsSection>
        
        {/* Section 5: Backup & Restore */}
        <SettingsSection icon={DatabaseBackup} title="Backup & Restore" iconColor="text-cyan-400">
          <p className="text-[11px] text-gray-500 mb-3">
            Export data ke file JSON untuk backup manual, atau import file backup untuk memulihkan data.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600/15 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/25 rounded-xl transition-all disabled:opacity-40"
            >
              {isExporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <div className="text-left">
                <div className="text-sm font-bold">Export Backup</div>
                <div className="text-[10px] opacity-70">Download file .json</div>
              </div>
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600/15 border border-blue-600/30 text-blue-400 hover:bg-blue-600/25 rounded-xl transition-all disabled:opacity-40"
            >
              {isImporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              <div className="text-left">
                <div className="text-sm font-bold">Import Backup</div>
                <div className="text-[10px] opacity-70">Restore dari file .json</div>
              </div>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
          
          <div className="mt-3 p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl flex items-start gap-2">
            <Info size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              <strong>Tips keamanan:</strong> Simpan file backup di tempat aman (Google Drive, 
              hard disk eksternal). Backup manual adalah jaring pengaman terakhir kalau terjadi 
              masalah pada akun cloud.
            </p>
          </div>
        </SettingsSection>
        
        {/* Section 6: Danger Zone */}
        <div className="bg-red-950/20 backdrop-blur-xl border border-red-500/30 rounded-3xl p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-black text-red-300 text-sm uppercase tracking-wider">
                Zona Bahaya
              </h3>
              <p className="text-[10px] text-red-400/60">
                Aksi tidak dapat dibatalkan
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-bold rounded-xl transition-all"
          >
            <RotateCcw size={14} />
            Reset Semua Data
          </button>
        </div>
        
        {/* Watermark */}
        <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-600/10 border border-yellow-600/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={16} className="text-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
                  Integrity Verified
                </span>
                <span className="text-[9px] text-gray-600 font-mono">v{APP_VERSION}</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
                {OFFICIAL_LABEL}
              </p>
              <p className="text-[10px] text-gray-600">
                MasDeen Finance · Developed by {DEVELOPER_NAME} · © 2026
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Reset confirmation modals */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        showCloseButton={false}
        closeOnBackdrop={!isResetting}
        size="sm"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">Reset Semua Data?</h3>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Semua transaksi, produk, pelanggan, dan catatan akan <strong className="text-red-300">dihapus permanen</strong>.
            Yakin ingin melanjutkan?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10"
            >
              Batal
            </button>
            <button
              onClick={() => { setShowResetConfirm(false); setShowResetDouble(true); }}
              className="py-3 bg-red-600/20 border border-red-500/40 text-red-300 font-bold rounded-xl hover:bg-red-600/30"
            >
              Lanjut
            </button>
          </div>
        </div>
      </Modal>
      
      <Modal
        isOpen={showResetDouble}
        onClose={() => setShowResetDouble(false)}
        showCloseButton={false}
        closeOnBackdrop={!isResetting}
        size="sm"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center mb-4 animate-pulse">
            <AlertTriangle size={28} className="text-red-300" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">Konfirmasi Terakhir</h3>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Ini adalah peringatan kedua dan terakhir. <strong className="text-red-300">Data yang dihapus TIDAK dapat dipulihkan</strong> kecuali Anda punya file backup.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowResetDouble(false)}
              disabled={isResetting}
              className="py-3 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl hover:bg-emerald-600/30 disabled:opacity-40"
            >
              Batal (Aman)
            </button>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-500 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reset Semua
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SettingsSection({
  icon: Icon,
  title,
  iconColor,
  children,
}: {
  icon: typeof SettingsIcon;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-3xl p-5 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-xl bg-black/50 border border-yellow-600/20 flex items-center justify-center ${iconColor}`}>
          <Icon size={15} />
        </div>
        <h3 className="font-black text-white text-sm md:text-base uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white focus:outline-none focus:border-yellow-500"
      />
    </div>
  );
}

function TextareaField({
  label, hint, value, rows = 3, onChange, onBlur,
}: {
  label: string;
  hint?: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        className="w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white focus:outline-none focus:border-yellow-500 resize-none text-sm"
      />
      {hint && (
        <p className="text-[10px] text-gray-600 mt-1">{hint}</p>
      )}
    </div>
  );
}

function ThemeCard({
  icon: Icon, label, description, active, onClick, preview,
}: {
  icon: typeof Moon;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  preview: string[]; // 3 colors
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-3 md:p-4 rounded-2xl border-2 transition-all ${
        active
          ? 'border-yellow-400 bg-yellow-500/10'
          : 'border-white/10 bg-black/30 hover:border-yellow-600/30'
      }`}
    >
      {active && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
          <Check size={12} className="text-black" />
        </div>
      )}
      
      <div className={`mb-3 ${active ? 'text-yellow-400' : 'text-gray-400'}`}>
        <Icon size={20} />
      </div>
      
      <div className={`text-sm font-bold mb-0.5 ${active ? 'text-white' : 'text-gray-300'}`}>
        {label}
      </div>
      <div className="text-[9px] text-gray-500 mb-3">
        {description}
      </div>
      
      {/* Color preview */}
      <div className="flex gap-1">
        {preview.map((color, i) => (
          <div
            key={i}
            className="flex-1 h-4 rounded"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </button>
  );
}

function TaxOption({
  type, name, rate, description, selected, onClick, recommended,
  isCustom, customValue, onCustomChange,
}: {
  type: TaxType;
  name: string;
  rate: number;
  description: string;
  selected: boolean;
  onClick: () => void;
  recommended?: boolean;
  isCustom?: boolean;
  customValue?: number;
  onCustomChange?: (pct: number) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-3 rounded-xl border transition-all ${
        selected
          ? 'bg-emerald-500/10 border-emerald-500/40'
          : 'bg-black/30 border-white/10 hover:border-yellow-600/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Radio indicator */}
        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
          selected ? 'border-emerald-400 bg-emerald-500/20' : 'border-gray-600'
        }`}>
          {selected && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`font-bold text-sm ${selected ? 'text-white' : 'text-gray-300'}`}>
              {name}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-yellow-500/20 border border-yellow-500/30 text-yellow-300">
              {isCustom ? `${(customValue || 0).toFixed(2)}%` : `${(rate * 100).toFixed(2)}%`}
            </span>
            {recommended && (
              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 uppercase tracking-wider">
                Default
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {description}
          </p>
          
          {/* Custom rate input */}
          {isCustom && selected && onCustomChange && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <label className="text-[9px] text-gray-400 uppercase font-bold mb-1 block">
                Tarif Custom (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={customValue?.toFixed(2) || '0'}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0 && v <= 100) {
                    onCustomChange(v);
                  }
                }}
                className="w-24 px-2 py-1 bg-black/60 border border-yellow-600/30 rounded text-white text-sm focus:outline-none focus:border-yellow-500 font-mono"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureToggle({
  label, description, checked, onChange, icon: Icon, locked,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: typeof SettingsIcon;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-black/30 border border-white/5 rounded-xl">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            checked 
              ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
              : 'bg-white/5 text-gray-600 border border-white/10'
          }`}>
            <Icon size={13} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            {label}
            {locked && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 uppercase font-bold">
                Wajib
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-500">{description}</div>
        </div>
      </div>
      
      <button
        onClick={() => !locked && onChange(!checked)}
        disabled={locked}
        className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
          checked 
            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' 
            : 'bg-gray-800 border border-white/5'
        } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
