// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Root Application
// 
// File ini menyatukan SEMUA yang sudah dibangun:
// - Auth (useAuth)
// - Data sync (useFirestoreSync)
// - Dialog system (useDialog)
// - 10 modules (Dashboard, POS, DailyReport, dll)
// - Layout (AppShell)
// - Loading & login screens
// - Backup/restore
// - Receipt printing
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useDialog } from './hooks/useDialog';

// Layout
import { AppShell } from './components/layout/AppShell';
import { LoadingScreen } from './components/layout/LoadingScreen';
import type { RouteId } from './components/layout/Sidebar';

// Auth
import { LoginScreen } from './components/auth/LoginScreen';

// Modules
import { DashboardModule } from './components/modules/DashboardModule';
import { POSModule } from './components/modules/POSModule';
import { DailyReportModule } from './components/modules/DailyReportModule';
import { OperasionalModule } from './components/modules/OperasionalModule';
import { CustomersModule } from './components/modules/CustomersModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { TaxModule, TAX_PRESETS } from './components/modules/TaxModule';
import type { TaxConfig } from './components/modules/TaxModule';
import { AIModule } from './components/modules/AIModule';
import type { ChatMessage } from './components/modules/AIModule';
import { NotesModule } from './components/modules/NotesModule';
import { SettingsModule } from './components/modules/SettingsModule';
import type { TaxType } from './components/modules/SettingsModule';

// UI primitives
import { Modal } from './components/ui/Modal';
import { MoneyInput } from './components/ui/MoneyInput';

// Services
import {
  productsService, customersService, transactionsService,
  notesService, settingsService,
} from './lib/firestore-service';
import {
  createBackup, downloadBackup, parseBackupFile, restoreBackup,
} from './lib/backup-service';
import {
  exportToExcel, exportToPDF, exportToWord,
} from './lib/export-service';
import {
  printReceiptThermal, downloadReceiptPDF,
} from './lib/receipt-service';
import { getAIService } from './lib/ai-service';

// Types
import type {
  Transaction, TransactionItem, Rupiah, AppSettings,
} from './lib/types';

// ═══════════════════════════════════════════════════════════════
// QUICK ADD MODAL
// ═══════════════════════════════════════════════════════════════

interface QuickAddState {
  isOpen: boolean;
  type: 'CAPITAL_INJECTION' | 'EXPENSE' | 'INCOME' | null;
}

function QuickAddModal({
  state, onClose, onSubmit,
}: {
  state: QuickAddState;
  onClose: () => void;
  onSubmit: (note: string, amount: Rupiah) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState<Rupiah>(0 as Rupiah);
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    if (state.isOpen) {
      setNote('');
      setAmount(0 as Rupiah);
    }
  }, [state.isOpen]);
  
  const config = {
    CAPITAL_INJECTION: { title: 'Tambah Injeksi Modal', placeholder: 'Misal: Tambah modal dari rekening' },
    EXPENSE: { title: 'Tambah Biaya Operasional', placeholder: 'Misal: Bensin motor' },
    INCOME: { title: 'Tambah Pemasukan Lain', placeholder: 'Misal: Setor ke pengepul' },
  }[state.type || 'EXPENSE'];
  
  const handleSubmit = async () => {
    if (!note.trim() || amount <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit(note.trim(), amount);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={state.isOpen} onClose={onClose} title={config.title} size="md">
      <div className="space-y-4">
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Keterangan *
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={config.placeholder}
            className="w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Jumlah *
          </label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10 disabled:opacity-40"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !note.trim() || amount <= 0}
            className="py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-black rounded-xl disabled:opacity-40 hover:from-yellow-300 hover:to-yellow-500"
          >
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const auth = useAuth();
  const data = useFirestoreSync(!!auth.user);
  const dialog = useDialog();
  const [route, setRoute] = useState<RouteId>('dashboard');
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(TAX_PRESETS.PPH_FINAL_UMKM);
  const [taxTypeState, setTaxTypeState] = useState<TaxType>('PPH_FINAL_UMKM');
  const [quickAdd, setQuickAdd] = useState<QuickAddState>({ isOpen: false, type: null });
  
  useEffect(() => {
    const settings: any = data.settings;
    if (settings?.taxType && TAX_PRESETS[settings.taxType as keyof typeof TAX_PRESETS]) {
      const preset = TAX_PRESETS[settings.taxType as keyof typeof TAX_PRESETS];
      setTaxTypeState(settings.taxType);
      setTaxConfig({ ...preset, rate: settings.taxRate ?? preset.rate });
    }
  }, [data.settings]);
  
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);
  
  // Apply theme dari settings ke <body>
  useEffect(() => {
    const theme = data.settings.features.appTheme || 'dark';
    document.body.classList.remove('theme-light', 'theme-nature');
    if (theme !== 'dark') {
      document.body.classList.add(`theme-${theme}`);
    }
    localStorage.setItem('masdeen_theme', theme);
  }, [data.settings.features.appTheme]);
  
  // ─── HANDLERS ──────────────────────────────────────────────
  
  const handleCheckout = useCallback(async (
    items: TransactionItem[],
    customerId: string | null,
    customerName: string | null
  ): Promise<string | null> => {
    try {
      const total = items.reduce((s, it) => s + it.subtotal, 0);
      const itemNames = items.map(i => i.productName).join(', ');
      const id = await transactionsService.create({
        type: 'PURCHASE',
        amount: total,
        note: itemNames.length > 60 ? itemNames.slice(0, 60) + '...' : itemNames,
        items,
        customerId: customerId || undefined,
        customerName: customerName || undefined,
      });
      return id;
    } catch (err) {
      dialog.showError('Gagal Menyimpan', err instanceof Error ? err.message : 'Error tidak diketahui');
      return null;
    }
  }, [dialog]);
  
  const handleQuickAdd = useCallback(async (note: string, amount: Rupiah) => {
    if (!quickAdd.type) return;
    try {
      await transactionsService.create({
        type: quickAdd.type, amount, note,
      });
      dialog.showSuccess('Tersimpan',
        `${quickAdd.type === 'CAPITAL_INJECTION' ? 'Injeksi modal' : 
          quickAdd.type === 'EXPENSE' ? 'Biaya operasional' : 'Pemasukan'} berhasil ditambahkan`);
    } catch (err) {
      dialog.showError('Gagal', err instanceof Error ? err.message : 'Error');
    }
  }, [quickAdd.type, dialog]);
  
  const handleDeleteTransaction = useCallback((txId: string) => {
    dialog.showConfirm(
      'Hapus Transaksi?',
      'Transaksi akan disembunyikan dari semua perhitungan.',
      async () => {
        try {
          await transactionsService.softDelete(txId);
          dialog.showSuccess('Terhapus', 'Transaksi berhasil dihapus');
        } catch (err) {
          dialog.showError('Gagal', err instanceof Error ? err.message : 'Error');
        }
      }
    );
  }, [dialog]);
  
  const handleCloseDay = useCallback(() => {
    dialog.showConfirm(
      'Tutup Buku Hari Ini?',
      'Sisa kas akhir hari ini akan otomatis menjadi modal awal hari berikutnya.',
      () => {
        dialog.showSuccess(
          'Hari Berhasil Ditutup',
          'Sisa kas hari ini sudah dicatat. Modal awal besok otomatis diisi dari saldo akhir hari ini.'
        );
      }
    );
  }, [dialog]);
  
  const handleCreateExpense = useCallback(async (note: string, amount: Rupiah, timestamp?: string) => {
    await transactionsService.create({ type: 'EXPENSE', amount, note, timestamp });
  }, []);
  
  const handleUpdateExpense = useCallback(async (txId: string, updates: any) => {
    await transactionsService.update(txId, updates);
  }, []);
  
  const handleDeleteExpense = useCallback(async (txId: string) => {
    return new Promise<void>((resolve) => {
      dialog.showConfirm('Hapus Biaya?', 'Biaya akan disembunyikan.', async () => {
        await transactionsService.softDelete(txId);
        resolve();
      });
    });
  }, [dialog]);
  
  const handleCreateCustomer = useCallback(async (d: any) => {
    await customersService.create(d);
    dialog.showSuccess('Tersimpan', 'Supplier baru ditambahkan');
  }, [dialog]);
  
  const handleUpdateCustomer = useCallback(async (id: string, updates: any) => {
    await customersService.update(id, updates);
    dialog.showSuccess('Tersimpan', 'Data supplier diubah');
  }, [dialog]);
  
  const handleDeleteCustomer = useCallback(async (id: string) => {
    return new Promise<void>((resolve) => {
      dialog.showConfirm(
        'Hapus Supplier?',
        'Data supplier akan dihapus, tapi riwayat transaksi tetap tersimpan.',
        async () => { await customersService.delete(id); resolve(); }
      );
    });
  }, [dialog]);
  
  const handleCreateNote = useCallback(async (n: any) => {
    await notesService.create(n);
  }, []);
  
  const handleUpdateNote = useCallback(async (id: string, updates: any) => {
    await notesService.update(id, updates);
  }, []);
  
  const handleDeleteNote = useCallback(async (id: string) => {
    return new Promise<void>((resolve) => {
      dialog.showConfirm('Hapus Catatan?', 'Catatan akan dihapus permanen.', async () => {
        await notesService.delete(id);
        resolve();
      });
    });
  }, [dialog]);
  
  const handleSaveSettings = useCallback(async (updates: Partial<AppSettings>) => {
    try {
      await settingsService.save(updates);
    } catch (err) {
      dialog.showError('Gagal Menyimpan', err instanceof Error ? err.message : 'Error');
    }
  }, [dialog]);
  
  const handleUpdateTax = useCallback(async (type: TaxType, rate: number) => {
    setTaxTypeState(type);
    const preset = TAX_PRESETS[type];
    setTaxConfig({ ...preset, rate });
    try {
      await settingsService.save({ taxType: type, taxRate: rate } as any);
    } catch (err) {
      console.warn('Failed to persist tax config:', err);
    }
  }, []);
  
  const handleExportBackup = useCallback(async () => {
    const backup = await createBackup(data.settings.storeName);
    downloadBackup(backup);
  }, [data.settings.storeName]);
  
  const handleImportBackup = useCallback(async (file: File) => {
    const parsed = await parseBackupFile(file);
    return new Promise<void>((resolve, reject) => {
      const summary = `${parsed.preview.products} produk, ${parsed.preview.customers} customer, ${parsed.preview.transactions} transaksi.`;
      const warnText = parsed.preview.warnings.length > 0
        ? `\n\n⚠️ ${parsed.preview.warnings[0]}` : '';
      
      dialog.showConfirm(
        parsed.schema === 'v16-legacy' ? 'Import dari v16' : 'Import Backup v17',
        `Akan import: ${summary}${warnText}\n\nMode: REPLACE — data saat ini dihapus. Lanjutkan?`,
        async () => {
          const result = await restoreBackup(parsed, 'replace');
          if (result.success) {
            dialog.showSuccess('Import Berhasil',
              `${result.summary.products} produk, ${result.summary.customers} customer, ${result.summary.transactions} transaksi berhasil diimpor.`);
            resolve();
          } else {
            dialog.showError('Import Gagal', result.error || 'Error');
            reject(new Error(result.error));
          }
        },
        { onCancel: () => reject(new Error('Dibatalkan')) }
      );
    });
  }, [dialog]);
  
  const handleResetAllData = useCallback(async () => {
    for (const tx of data.transactions) await transactionsService.hardDelete(tx.id);
    for (const c of data.customers) await customersService.delete(c.id);
    for (const p of data.products) await productsService.delete(p.id);
    for (const n of data.notes) await notesService.delete(n.id);
  }, [data]);
  
  const handleExportExcel = useCallback(async (range: { start: string; end: string }) => {
    await exportToExcel({ transactions: data.transactions, customers: data.customers, storeName: data.settings.storeName, range });
  }, [data]);
  
  const handleExportPDF = useCallback(async (range: { start: string; end: string }) => {
    await exportToPDF({ transactions: data.transactions, customers: data.customers, storeName: data.settings.storeName, range });
  }, [data]);
  
  const handleExportWord = useCallback(async (range: { start: string; end: string }) => {
    await exportToWord({ transactions: data.transactions, customers: data.customers, storeName: data.settings.storeName, range });
  }, [data]);
  
  const handlePrintReceipt = useCallback((tx: Transaction) => {
    printReceiptThermal({ transaction: tx, settings: data.settings });
  }, [data.settings]);
  
  const handleDownloadReceipt = useCallback(async (tx: Transaction) => {
    await downloadReceiptPDF({ transaction: tx, settings: data.settings });
  }, [data.settings]);
  
  const handleAskAI = useCallback(async (
    userMessage: string, context: string, history: ChatMessage[]
  ): Promise<string> => {
    const ai = getAIService();
    return await ai.ask(userMessage, context, history);
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  
  if (showSplash) {
    return <LoadingScreen onComplete={() => setShowSplash(false)} duration={1500} />;
  }
  
  if (!auth.isReady) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!auth.user) {
    return (
      <LoginScreen
        isLoading={auth.isLoading}
        error={auth.error}
        onGoogleLogin={auth.loginWithGoogle}
        onEmailLogin={auth.loginWithEmail}
        onEmailRegister={auth.registerWithEmail}
        onClearError={auth.clearError}
      />
    );
  }
  
  if (!data.isReady) {
    return (
      <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
        <p className="text-yellow-500/70 text-xs uppercase tracking-widest font-bold">
          Memuat data Anda...
        </p>
      </div>
    );
  }
  
  const aiService = getAIService();
  
  return (
    <>
      <AppShell
        activeRoute={route}
        onNavigate={setRoute}
        storeName={data.settings.storeName}
        features={data.settings.features}
        user={auth.user}
        onLogout={auth.logout}
        dialog={dialog.dialog}
        onCloseDialog={dialog.closeDialog}
      >
        {route === 'dashboard' && (
          <DashboardModule
            transactions={data.transactions}
            features={data.settings.features}
            onNavigate={setRoute}
            onCloseDay={handleCloseDay}
            onQuickAdd={(type) => setQuickAdd({ isOpen: true, type })}
          />
        )}
        
        {route === 'pos' && (
          <POSModule
            products={data.products}
            customers={data.customers}
            onCheckout={handleCheckout}
            onAddCustomer={() => setRoute('customers')}
          />
        )}
        
        {route === 'report' && (
          <DailyReportModule
            transactions={data.transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onPrintReceipt={handlePrintReceipt}
            onDownloadReceipt={handleDownloadReceipt}
            onCloseDay={handleCloseDay}
          />
        )}
        
        {route === 'operasional' && (
          <OperasionalModule
            transactions={data.transactions}
            onCreateExpense={handleCreateExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}
        
        {route === 'customers' && (
          <CustomersModule
            customers={data.customers}
            transactions={data.transactions}
            onCreateCustomer={handleCreateCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}
        
        {route === 'reports' && (
          <ReportsModule
            transactions={data.transactions}
            customers={data.customers}
            storeName={data.settings.storeName}
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            onExportWord={handleExportWord}
          />
        )}
        
        {route === 'tax' && (
          <TaxModule
            transactions={data.transactions}
            taxConfig={taxConfig}
            storeName={data.settings.storeName}
          />
        )}
        
        {route === 'ai' && (
          <AIModule
            transactions={data.transactions}
            storeName={data.settings.storeName}
            onAskAI={handleAskAI}
            isAIAvailable={aiService.isAvailable}
          />
        )}
        
        {route === 'notes' && (
          <NotesModule
            notes={data.notes}
            onCreateNote={handleCreateNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
          />
        )}
        
        {route === 'settings' && (
          <SettingsModule
            settings={data.settings}
            onSaveSettings={handleSaveSettings}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onResetAllData={handleResetAllData}
            taxType={taxTypeState}
            taxRate={taxConfig.rate}
            onUpdateTax={handleUpdateTax}
          />
        )}
      </AppShell>
      
      <QuickAddModal
        state={quickAdd}
        onClose={() => setQuickAdd({ isOpen: false, type: null })}
        onSubmit={handleQuickAdd}
      />
    </>
  );
}
