// ═══════════════════════════════════════════════════════════════
// OperasionalModule — Manajemen biaya operasional
// 
// Scope: HANYA biaya non-pembelian (bensin, gaji, listrik, makan, dll)
// TIDAK termasuk pembelian rongsok — itu di POSModule.
// 
// Fitur:
// - Tambah biaya baru (nama + jumlah, support expression)
// - Edit biaya existing
// - Hapus biaya
// - Filter by date range
// - Statistik bulanan
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Receipt, Plus, TrendingDown, Calendar, Search, X,
  Edit3, Trash2, BarChart3,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { MoneyInput } from '../ui/MoneyInput';
import { formatRupiah } from '../../lib/money';
import { 
  todayBusinessDate, formatBusinessDateID, 
  transactionsInRange, activeTransactions,
} from '../../lib/calculations';
import type { Transaction, Rupiah } from '../../lib/types';

export interface OperasionalModuleProps {
  transactions: Transaction[];
  onCreateExpense: (note: string, amount: Rupiah, timestamp?: string) => Promise<void>;
  onUpdateExpense: (txId: string, updates: { note?: string; amount?: Rupiah; timestamp?: string }) => Promise<void>;
  onDeleteExpense: (txId: string) => Promise<void>;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';

export function OperasionalModule({
  transactions,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
}: OperasionalModuleProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DateFilter>('month');
  
  // Ambil semua transaksi EXPENSE aktif
  const expenses = useMemo(() => {
    return activeTransactions(transactions).filter(tx => tx.type === 'EXPENSE');
  }, [transactions]);
  
  // Apply date filter
  const filteredByDate = useMemo(() => {
    if (filter === 'all') return expenses;
    
    const today = todayBusinessDate();
    let startDate = today;
    
    if (filter === 'today') {
      startDate = today;
    } else if (filter === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().slice(0, 10);
    } else if (filter === 'month') {
      const d = new Date();
      d.setDate(1);
      startDate = d.toISOString().slice(0, 10);
    }
    
    return transactionsInRange(expenses, startDate, today);
  }, [expenses, filter]);
  
  // Apply search filter
  const finalList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredByDate;
    return filteredByDate.filter(tx => 
      tx.note.toLowerCase().includes(q)
    );
  }, [filteredByDate, search]);
  
  // Stats
  const stats = useMemo(() => {
    const total = filteredByDate.reduce((sum, tx) => sum + tx.amount, 0);
    const count = filteredByDate.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    
    // Group by day untuk chart nanti
    const byDay: Record<string, number> = {};
    for (const tx of filteredByDate) {
      byDay[tx.businessDate] = (byDay[tx.businessDate] || 0) + tx.amount;
    }
    
    return { total, count, avg, byDay };
  }, [filteredByDate]);
  
  // Group by date untuk tampilan
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of finalList) {
      if (!map.has(tx.businessDate)) map.set(tx.businessDate, []);
      map.get(tx.businessDate)!.push(tx);
    }
    // Sort desc by date
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [finalList]);
  
  return (
    <>
      <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
              Operasional
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Biaya <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Operasional</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Bensin, gaji, listrik, makan, dan pengeluaran non-pembelian lainnya
            </p>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-yellow-600/20"
          >
            <Plus size={16} />
            <span className="text-sm">Tambah Biaya</span>
          </button>
        </div>
        
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-red-600/15 text-red-400 border border-red-600/20 flex items-center justify-center">
                <TrendingDown size={13} />
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total</span>
            </div>
            <div className="text-sm md:text-lg font-black text-red-400 font-mono">
              {formatRupiah(stats.total)}
            </div>
          </div>
          
          <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-yellow-600/15 text-yellow-400 border border-yellow-600/20 flex items-center justify-center">
                <Receipt size={13} />
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Transaksi</span>
            </div>
            <div className="text-sm md:text-lg font-black text-white font-mono">
              {stats.count}
            </div>
          </div>
          
          <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/15 text-blue-400 border border-blue-600/20 flex items-center justify-center">
                <BarChart3 size={13} />
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Rata-rata</span>
            </div>
            <div className="text-sm md:text-lg font-black text-white font-mono">
              {formatRupiah(stats.avg)}
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Date filter */}
          <div className="flex gap-1 p-1 bg-black/40 border border-yellow-600/15 rounded-xl">
            {([
              { id: 'today', label: 'Hari Ini' },
              { id: 'week', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'all', label: 'Semua' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === opt.id
                    ? 'bg-yellow-500 text-black'
                    : 'text-gray-500 hover:text-yellow-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          
          {/* Search */}
          <div className="relative flex-1">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari biaya..."
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        
        {/* List */}
        {grouped.length === 0 ? (
          <div className="text-center py-16 bg-[#080808]/60 border border-yellow-600/10 rounded-3xl">
            <Receipt size={40} className="mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500 text-sm">
              {search ? 'Tidak ada biaya yang cocok' : 'Belum ada biaya operasional'}
            </p>
            {!search && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/20 transition-colors"
              >
                + Tambah biaya pertama
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, txs]) => {
              const dayTotal = txs.reduce((sum, tx) => sum + tx.amount, 0);
              return (
                <div key={date} className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl overflow-hidden">
                  {/* Date header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-yellow-600/10">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-yellow-500/60" />
                      <span className="text-xs font-bold text-yellow-400">
                        {formatBusinessDateID(date)}
                      </span>
                      <span className="text-[10px] text-gray-500">· {txs.length} biaya</span>
                    </div>
                    <span className="text-sm font-bold text-red-400 font-mono">
                      {formatRupiah(dayTotal)}
                    </span>
                  </div>
                  
                  {/* Items */}
                  <div className="divide-y divide-white/5">
                    {txs.map(tx => (
                      <ExpenseRow
                        key={tx.id}
                        tx={tx}
                        onEdit={() => setEditingTx(tx)}
                        onDelete={() => onDeleteExpense(tx.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Add/Edit modal */}
      <ExpenseFormModal
        isOpen={showAddModal || !!editingTx}
        editing={editingTx}
        onClose={() => {
          setShowAddModal(false);
          setEditingTx(null);
        }}
        onSubmit={async (note, amount) => {
          if (editingTx) {
            await onUpdateExpense(editingTx.id, { note, amount });
            setEditingTx(null);
          } else {
            await onCreateExpense(note, amount);
            setShowAddModal(false);
          }
        }}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function ExpenseRow({ 
  tx, onEdit, onDelete 
}: { 
  tx: Transaction; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  const time = new Date(tx.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">
          {tx.note || '(tanpa nama)'}
        </div>
        <div className="text-[10px] text-gray-600 font-mono mt-0.5">
          {time}
        </div>
      </div>
      
      <div className="text-sm font-mono font-bold text-red-400">
        −{formatRupiah(tx.amount)}
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center"
          title="Edit"
        >
          <Edit3 size={11} />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
          title="Hapus"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Expense form modal ───────────────────────────────────────

interface ExpenseFormModalProps {
  isOpen: boolean;
  editing: Transaction | null;
  onClose: () => void;
  onSubmit: (note: string, amount: Rupiah) => Promise<void>;
}

function ExpenseFormModal({ isOpen, editing, onClose, onSubmit }: ExpenseFormModalProps) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState<Rupiah>(0 as Rupiah);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Reset state saat modal dibuka dengan editing data
  useMemo(() => {
    if (isOpen) {
      if (editing) {
        setNote(editing.note);
        setAmount(editing.amount);
      } else {
        setNote('');
        setAmount(0 as Rupiah);
      }
      setError('');
    }
  }, [isOpen, editing]);
  
  const handleSubmit = async () => {
    setError('');
    if (!note.trim()) {
      setError('Nama biaya wajib diisi');
      return;
    }
    if (amount <= 0) {
      setError('Jumlah harus lebih dari 0');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(note.trim(), amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit Biaya Operasional' : 'Tambah Biaya Operasional'}
      size="md"
    >
      <div className="space-y-4">
        {/* Note */}
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Nama / Keterangan Biaya *
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Bensin motor, Gaji karyawan, Makan siang"
            className="w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500"
            autoFocus={!editing}
          />
        </div>
        
        {/* Amount */}
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Jumlah *
          </label>
          <MoneyInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
          />
          <p className="text-[10px] text-gray-600 mt-1.5">
            💡 Tip: bisa pakai expression seperti "50000 + 25000" atau "15000 * 3"
          </p>
        </div>
        
        {/* Error */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}
        
        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10 transition-all disabled:opacity-40"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !note.trim() || amount <= 0}
            className="py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-black rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:from-yellow-300 hover:to-yellow-500 transition-all"
          >
            {isSubmitting ? 'Menyimpan...' : (editing ? 'Simpan Perubahan' : 'Tambah')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
