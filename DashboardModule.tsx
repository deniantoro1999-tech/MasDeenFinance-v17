// ═══════════════════════════════════════════════════════════════
// DashboardModule — Ringkasan kas harian
// 
// Menampilkan:
// - Stats cards: Modal Awal, Injeksi, Pembelian, Biaya, Sisa Kas
// - Rumus kas transparan (user bisa lihat cara hitungnya)
// - Total berat dibeli hari ini
// - Daftar transaksi terbaru
// - Quick actions
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Wallet, Plus, TrendingDown, TrendingUp, Package, 
  ShoppingCart, Calendar, ArrowRight, Banknote, Coins,
  PlusCircle, Receipt, Eye, ChevronRight,
} from 'lucide-react';
import { formatRupiah, formatRupiahSigned, formatWeight } from '../../lib/money';
import {
  computeDailySnapshot, todayBusinessDate, formatBusinessDateIDFull,
} from '../../lib/calculations';
import type { Transaction, AppFeatures } from '../../lib/types';
import type { RouteId } from '../layout/Sidebar';

export interface DashboardModuleProps {
  transactions: Transaction[];
  features: AppFeatures;
  onNavigate: (route: RouteId) => void;
  onCloseDay: () => void;
  onQuickAdd: (type: 'CAPITAL_INJECTION' | 'EXPENSE' | 'INCOME') => void;
}

export function DashboardModule({
  transactions,
  features,
  onNavigate,
  onCloseDay,
  onQuickAdd,
}: DashboardModuleProps) {
  const today = todayBusinessDate();
  
  // Hitung snapshot hari ini (memoized — cuma re-compute kalau transactions berubah)
  const snapshot = useMemo(
    () => computeDailySnapshot(transactions, today),
    [transactions, today]
  );
  
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-3"
      >
        <div>
          <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
            Dashboard
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Ringkasan <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Hari Ini</span>
          </h1>
          <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Calendar size={13} />
            <span>{formatBusinessDateIDFull(today)}</span>
          </div>
        </div>
        
        {features.showStockPurchase && (
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-yellow-600/20"
          >
            <ShoppingCart size={16} />
            <span className="text-sm">Buka Kasir</span>
            <ArrowRight size={14} />
          </button>
        )}
      </motion.div>
      
      {/* Big Stats: Sisa Kas (featured) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-yellow-600/15 via-[#0a0a0a] to-[#0a0a0a] backdrop-blur-xl border border-yellow-600/30 rounded-3xl p-6 md:p-8 relative overflow-hidden"
      >
        {/* Decorative bg */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-yellow-700/10 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-yellow-500/80 text-xs uppercase tracking-[0.2em] font-bold mb-2">
              <Coins size={13} />
              Sisa Kas Saat Ini
            </div>
            <div className={`text-3xl md:text-5xl font-black font-mono tracking-tight ${
              snapshot.sisaKas >= 0 ? 'text-yellow-400' : 'text-red-400'
            }`}
              style={{ textShadow: '0 0 20px rgba(234, 179, 8, 0.3)' }}
            >
              {formatRupiahSigned(snapshot.sisaKas)}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {snapshot.purchaseCount} pembelian · {formatWeight(snapshot.totalWeightGrams)}
            </div>
          </div>
          
          <button
            onClick={onCloseDay}
            className="flex items-center gap-2 px-4 py-2.5 bg-black/40 border border-yellow-600/30 hover:border-yellow-500 hover:bg-yellow-500/10 text-yellow-400 rounded-xl transition-all text-sm font-bold"
          >
            Tutup Hari & Rollover
            <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
      
      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={Wallet}
          label="Modal Awal"
          value={formatRupiah(snapshot.openingBalance)}
          tone="neutral"
          delay={0.15}
        />
        <StatCard
          icon={PlusCircle}
          label="Injeksi Modal"
          value={formatRupiah(snapshot.capitalInjection)}
          tone="green"
          delay={0.2}
          onClick={() => onQuickAdd('CAPITAL_INJECTION')}
        />
        <StatCard
          icon={TrendingDown}
          label="Pembelian"
          value={formatRupiah(snapshot.totalPurchase)}
          tone="red"
          delay={0.25}
        />
        <StatCard
          icon={Receipt}
          label="Biaya Operasional"
          value={formatRupiah(snapshot.totalExpense)}
          tone="red"
          delay={0.3}
          onClick={() => onQuickAdd('EXPENSE')}
        />
      </div>
      
      {/* Rumus Kas (transparency) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/20 rounded-3xl p-5 md:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-yellow-400 text-sm uppercase tracking-wider flex items-center gap-2">
            <Banknote size={15} />
            Rumus Perhitungan Kas
          </h3>
        </div>
        
        <div className="space-y-2 font-mono text-sm">
          <FormulaRow label="Modal Awal" value={snapshot.openingBalance} />
          <FormulaRow label="+ Injeksi Modal" value={snapshot.capitalInjection} tone="green" />
          <FormulaRow label="+ Pemasukan Lain" value={snapshot.totalOtherIncome} tone="green" />
          <FormulaRow label="− Pembelian Rongsok" value={-snapshot.totalPurchase} tone="red" />
          <FormulaRow label="− Biaya Operasional" value={-snapshot.totalExpense} tone="red" />
          
          <div className="pt-3 mt-2 border-t border-yellow-600/30">
            <div className={`flex items-center justify-between font-bold text-base ${
              snapshot.sisaKas >= 0 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              <span>= Sisa Kas</span>
              <span>{formatRupiahSigned(snapshot.sisaKas)}</span>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <QuickAction
          icon={PlusCircle}
          label="Injeksi Modal"
          tone="green"
          onClick={() => onQuickAdd('CAPITAL_INJECTION')}
        />
        <QuickAction
          icon={TrendingDown}
          label="Biaya Operasional"
          tone="red"
          onClick={() => onQuickAdd('EXPENSE')}
        />
        <QuickAction
          icon={TrendingUp}
          label="Pemasukan Lain"
          tone="blue"
          onClick={() => onQuickAdd('INCOME')}
        />
        <QuickAction
          icon={Eye}
          label="Laporan Hari"
          tone="gold"
          onClick={() => onNavigate('report')}
        />
      </motion.div>
      
      {/* Transaksi Terbaru */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/20 rounded-3xl p-5 md:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-yellow-400 text-sm uppercase tracking-wider flex items-center gap-2">
            <Package size={15} />
            Transaksi Hari Ini ({snapshot.transactions.length})
          </h3>
          {snapshot.transactions.length > 0 && (
            <button
              onClick={() => onNavigate('report')}
              className="text-xs text-yellow-500/60 hover:text-yellow-500 flex items-center gap-1"
            >
              Lihat Semua
              <ChevronRight size={12} />
            </button>
          )}
        </div>
        
        {snapshot.transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <Package size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada transaksi hari ini</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {snapshot.transactions
              .slice()
              .reverse()
              .slice(0, 10)
              .map(tx => <TransactionRow key={tx.id} tx={tx} />)}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

interface StatCardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: 'neutral' | 'green' | 'red';
  delay?: number;
  onClick?: () => void;
}

function StatCard({ icon: Icon, label, value, tone, delay = 0, onClick }: StatCardProps) {
  const toneClass = {
    neutral: 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20',
    green: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20',
    red: 'bg-red-600/15 text-red-400 border-red-600/20',
  }[tone];
  
  const Wrapper = onClick ? 'button' : 'div';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Wrapper
        onClick={onClick}
        className={`w-full text-left bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-4 md:p-5 transition-all ${
          onClick ? 'hover:border-yellow-600/40 hover:-translate-y-0.5 cursor-pointer' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${toneClass}`}>
            <Icon size={16} />
          </div>
          {onClick && <Plus size={12} className="text-gray-600" />}
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">
          {label}
        </div>
        <div className="text-base md:text-lg font-black text-white font-mono">
          {value}
        </div>
      </Wrapper>
    </motion.div>
  );
}

interface FormulaRowProps {
  label: string;
  value: number;
  tone?: 'green' | 'red';
}

function FormulaRow({ label, value, tone }: FormulaRowProps) {
  const colorClass = tone === 'green' ? 'text-emerald-400' :
                     tone === 'red' ? 'text-red-400' : 'text-gray-300';
  return (
    <div className={`flex items-center justify-between ${colorClass}`}>
      <span>{label}</span>
      <span>{formatRupiahSigned(value)}</span>
    </div>
  );
}

interface QuickActionProps {
  icon: typeof PlusCircle;
  label: string;
  tone: 'green' | 'red' | 'blue' | 'gold';
  onClick: () => void;
}

function QuickAction({ icon: Icon, label, tone, onClick }: QuickActionProps) {
  const toneClass = {
    green: 'border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/10 hover:border-emerald-500',
    red: 'border-red-600/30 text-red-400 hover:bg-red-600/10 hover:border-red-500',
    blue: 'border-blue-600/30 text-blue-400 hover:bg-blue-600/10 hover:border-blue-500',
    gold: 'border-yellow-600/30 text-yellow-400 hover:bg-yellow-600/10 hover:border-yellow-500',
  }[tone];
  
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 bg-black/40 border rounded-2xl transition-all ${toneClass}`}
    >
      <Icon size={20} />
      <span className="text-[11px] font-bold uppercase tracking-wider text-center">{label}</span>
    </button>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const typeConfig = {
    PURCHASE:          { color: 'text-red-400',     bg: 'bg-red-500/10',     sign: '-' },
    EXPENSE:           { color: 'text-red-400',     bg: 'bg-red-500/10',     sign: '-' },
    CAPITAL_INJECTION: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', sign: '+' },
    INCOME:            { color: 'text-emerald-400', bg: 'bg-emerald-500/10', sign: '+' },
    OPENING_BALANCE:   { color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  sign: '=' },
  }[tx.type];
  
  const typeLabel = {
    PURCHASE: 'Pembelian',
    EXPENSE: 'Biaya',
    CAPITAL_INJECTION: 'Injeksi Modal',
    INCOME: 'Pemasukan',
    OPENING_BALANCE: 'Modal Awal',
  }[tx.type];
  
  const time = new Date(tx.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${typeConfig.bg} border border-white/5`}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[9px] font-bold uppercase text-gray-500 tracking-wider">
            {typeLabel}
          </span>
          <span className="text-[10px] text-gray-600">·</span>
          <span className="text-[10px] text-gray-500 font-mono">{time}</span>
        </div>
        <div className="text-sm font-semibold text-white truncate">
          {tx.note || (tx.items?.[0]?.productName ?? '—')}
        </div>
      </div>
      <div className={`font-bold font-mono text-sm ${typeConfig.color}`}>
        {typeConfig.sign} {formatRupiah(tx.amount)}
      </div>
    </div>
  );
}
