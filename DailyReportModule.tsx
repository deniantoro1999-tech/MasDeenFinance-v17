// ═══════════════════════════════════════════════════════════════
// DailyReportModule — Laporan & Tutup Buku Hari Ini
// 
// Beda dengan Dashboard:
// - Dashboard = ringkasan cepat + quick actions
// - DailyReport = detail lengkap transaksi hari ini + tutup buku
// 
// Flow tutup buku:
// 1. User review semua transaksi hari ini
// 2. Cek total sisa kas
// 3. Tekan "Tutup Hari" → sisa kas otomatis jadi modal awal besok
//    (ini sudah otomatis via calculations.ts — sebenarnya tutup buku
//     hanya "pemberitahuan sistem", data tidak perlu diubah)
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, Printer, Download, Check, Trash2, Edit3,
  Wallet, PlusCircle, TrendingDown, Receipt, Package,
  ShoppingBag, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import { formatRupiah, formatRupiahSigned, formatWeight, gramsToKg } from '../../lib/money';
import {
  computeDailySnapshot, todayBusinessDate, formatBusinessDateIDFull,
  prevBusinessDate, nextBusinessDate, getBusinessDatesWithActivity,
} from '../../lib/calculations';
import type { Transaction, TransactionType } from '../../lib/types';

export interface DailyReportModuleProps {
  transactions: Transaction[];
  onDeleteTransaction: (txId: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onPrintReceipt?: (tx: Transaction) => void;
  onDownloadReceipt?: (tx: Transaction) => void;
  onCloseDay: () => void;
}

export function DailyReportModule({
  transactions,
  onDeleteTransaction,
  onEditTransaction,
  onPrintReceipt,
  onDownloadReceipt,
  onCloseDay,
}: DailyReportModuleProps) {
  const [selectedDate, setSelectedDate] = useState(todayBusinessDate());
  
  const snapshot = useMemo(
    () => computeDailySnapshot(transactions, selectedDate),
    [transactions, selectedDate]
  );
  
  const availableDates = useMemo(
    () => getBusinessDatesWithActivity(transactions).reverse(), // newest first
    [transactions]
  );
  
  const isToday = selectedDate === todayBusinessDate();
  
  // Group transaksi berdasarkan tipe
  const grouped = useMemo(() => {
    const result: Record<TransactionType, Transaction[]> = {
      OPENING_BALANCE: [],
      CAPITAL_INJECTION: [],
      PURCHASE: [],
      EXPENSE: [],
      INCOME: [],
    };
    for (const tx of snapshot.transactions) {
      result[tx.type].push(tx);
    }
    return result;
  }, [snapshot]);
  
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
            Laporan Harian
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Laporan <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Kas</span>
          </h1>
          <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Calendar size={13} />
            <span>{formatBusinessDateIDFull(selectedDate)}</span>
          </div>
        </div>
        
        {/* Date navigator */}
        <DateNavigator
          currentDate={selectedDate}
          availableDates={availableDates}
          onChange={setSelectedDate}
        />
      </div>
      
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Wallet} label="Modal Awal" value={formatRupiah(snapshot.openingBalance)} />
        <SummaryCard icon={PlusCircle} label="Injeksi" value={formatRupiah(snapshot.capitalInjection)} tone="green" />
        <SummaryCard icon={TrendingDown} label="Pembelian" value={formatRupiah(snapshot.totalPurchase)} tone="red" />
        <SummaryCard icon={Receipt} label="Biaya" value={formatRupiah(snapshot.totalExpense)} tone="red" />
      </div>
      
      {/* Big Sisa Kas */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-yellow-600/15 via-[#0a0a0a] to-[#0a0a0a] backdrop-blur-xl border border-yellow-600/30 rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex items-center gap-2 text-yellow-500/80 text-xs uppercase tracking-[0.2em] font-bold mb-2">
            <Wallet size={13} />
            Sisa Kas {isToday ? 'Hari Ini' : 'pada Tanggal Ini'}
          </div>
          <div className={`text-3xl md:text-4xl font-black font-mono ${
            snapshot.sisaKas >= 0 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {formatRupiahSigned(snapshot.sisaKas)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {snapshot.purchaseCount} pembelian · {formatWeight(snapshot.totalWeightGrams)}
          </div>
        </div>
        
        {isToday && (
          <button
            onClick={onCloseDay}
            className="relative flex items-center gap-2 px-5 py-3 bg-black/40 border border-yellow-600/40 hover:border-yellow-500 hover:bg-yellow-500/10 text-yellow-400 rounded-xl transition-all font-bold text-sm"
          >
            <Check size={14} />
            Tutup Buku Hari Ini
          </button>
        )}
      </motion.div>
      
      {/* Sections per tipe transaksi */}
      <TransactionSection
        title="Modal & Pemasukan"
        icon={PlusCircle}
        tone="green"
        transactions={[
          ...grouped.OPENING_BALANCE,
          ...grouped.CAPITAL_INJECTION,
          ...grouped.INCOME,
        ]}
        onDelete={onDeleteTransaction}
        onEdit={onEditTransaction}
      />
      
      <TransactionSection
        title="Pembelian Rongsok"
        icon={ShoppingBag}
        tone="gold"
        transactions={grouped.PURCHASE}
        onDelete={onDeleteTransaction}
        onEdit={onEditTransaction}
        onPrint={onPrintReceipt}
        onDownload={onDownloadReceipt}
        showItems
      />
      
      <TransactionSection
        title="Biaya Operasional"
        icon={Receipt}
        tone="red"
        transactions={grouped.EXPENSE}
        onDelete={onDeleteTransaction}
        onEdit={onEditTransaction}
      />
      
      {/* Empty state */}
      {snapshot.transactions.length === 0 && (
        <div className="text-center py-12 bg-[#080808]/60 border border-yellow-600/10 rounded-3xl">
          <FileText size={40} className="mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm">
            Belum ada transaksi pada tanggal ini
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

interface DateNavigatorProps {
  currentDate: string;
  availableDates: string[];
  onChange: (date: string) => void;
}

function DateNavigator({ currentDate, availableDates, onChange }: DateNavigatorProps) {
  const [showList, setShowList] = useState(false);
  const today = todayBusinessDate();
  
  const goPrev = () => {
    const idx = availableDates.indexOf(currentDate);
    if (idx >= 0 && idx < availableDates.length - 1) {
      onChange(availableDates[idx + 1]); // reversed, next = older
    } else {
      onChange(prevBusinessDate(currentDate));
    }
  };
  
  const goNext = () => {
    const idx = availableDates.indexOf(currentDate);
    if (idx > 0) {
      onChange(availableDates[idx - 1]);
    } else {
      const next = nextBusinessDate(currentDate);
      if (next <= today) onChange(next);
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goPrev}
        className="w-10 h-10 bg-black/40 border border-yellow-600/20 hover:border-yellow-500 rounded-xl flex items-center justify-center text-yellow-400 transition-colors"
        aria-label="Tanggal sebelumnya"
      >
        ◀
      </button>
      
      <div className="relative">
        <button
          onClick={() => setShowList(!showList)}
          className="px-4 py-2 bg-black/40 border border-yellow-600/20 hover:border-yellow-500 rounded-xl text-sm text-yellow-400 font-semibold transition-colors flex items-center gap-2 min-w-[140px] justify-center"
        >
          {currentDate === today ? 'Hari Ini' : currentDate}
          <ChevronDown size={12} className={showList ? 'rotate-180' : ''} />
        </button>
        
        {showList && availableDates.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowList(false)} />
            <div className="absolute top-full right-0 mt-1 w-48 bg-[#0a0a0a] border border-yellow-600/30 rounded-xl shadow-2xl z-20 max-h-64 overflow-y-auto">
              <button
                onClick={() => { onChange(today); setShowList(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-yellow-500/10 text-yellow-400 border-b border-yellow-600/10"
              >
                Hari Ini
              </button>
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => { onChange(date); setShowList(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-yellow-500/10 ${
                    currentDate === date ? 'bg-yellow-500/10 text-yellow-400 font-semibold' : 'text-gray-400'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      
      <button
        onClick={goNext}
        disabled={currentDate >= today}
        className="w-10 h-10 bg-black/40 border border-yellow-600/20 hover:border-yellow-500 rounded-xl flex items-center justify-center text-yellow-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Tanggal berikutnya"
      >
        ▶
      </button>
    </div>
  );
}

function SummaryCard({ 
  icon: Icon, label, value, tone = 'neutral' 
}: { 
  icon: typeof Wallet; 
  label: string; 
  value: string; 
  tone?: 'neutral' | 'green' | 'red'; 
}) {
  const toneClass = {
    neutral: 'bg-yellow-600/10 text-yellow-400 border-yellow-600/20',
    green: 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20',
    red: 'bg-red-600/10 text-red-400 border-red-600/20',
  }[tone];
  
  return (
    <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-3 md:p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border mb-2 ${toneClass}`}>
        <Icon size={14} />
      </div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">{label}</div>
      <div className="text-sm md:text-base font-black text-white font-mono">{value}</div>
    </div>
  );
}

interface TransactionSectionProps {
  title: string;
  icon: typeof Wallet;
  tone: 'green' | 'red' | 'gold';
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
  onPrint?: (tx: Transaction) => void;
  onDownload?: (tx: Transaction) => void;
  showItems?: boolean;
}

function TransactionSection({
  title, icon: Icon, tone, transactions,
  onDelete, onEdit, onPrint, onDownload, showItems,
}: TransactionSectionProps) {
  const [expanded, setExpanded] = useState(true);
  
  if (transactions.length === 0) return null;
  
  const toneHeader = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    gold: 'text-yellow-400',
  }[tone];
  
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
  return (
    <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-3xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 md:p-5"
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className={toneHeader} />
          <h3 className={`font-bold text-sm uppercase tracking-wider ${toneHeader}`}>
            {title} ({transactions.length})
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-sm ${toneHeader}`}>
            {formatRupiah(total)}
          </span>
          {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-yellow-600/10 p-3 space-y-2">
          {transactions.map(tx => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onDelete={onDelete}
              onEdit={onEdit}
              onPrint={onPrint}
              onDownload={onDownload}
              showItems={showItems}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TransactionRowProps {
  tx: Transaction;
  onDelete: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
  onPrint?: (tx: Transaction) => void;
  onDownload?: (tx: Transaction) => void;
  showItems?: boolean;
}

function TransactionRow({ tx, onDelete, onEdit, onPrint, onDownload, showItems }: TransactionRowProps) {
  const [showDetail, setShowDetail] = useState(false);
  
  const time = new Date(tx.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const sign = tx.type === 'PURCHASE' || tx.type === 'EXPENSE' ? '-' : '+';
  const amountColor = tx.type === 'PURCHASE' || tx.type === 'EXPENSE' ? 'text-red-400' : 'text-emerald-400';
  
  return (
    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] text-gray-500 font-mono">{time}</span>
            {tx.customerName && (
              <span className="text-[10px] text-yellow-500/60 font-semibold truncate">
                · {tx.customerName}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {tx.note || tx.items?.[0]?.productName || '—'}
          </div>
          {showItems && tx.items && tx.items.length > 0 && (
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="text-[10px] text-yellow-500/70 hover:text-yellow-500 mt-0.5 flex items-center gap-1"
            >
              {tx.items.length} item · {showDetail ? 'Sembunyikan' : 'Lihat detail'}
            </button>
          )}
        </div>
        
        <div className={`font-mono font-bold text-sm ${amountColor}`}>
          {sign} {formatRupiah(tx.amount)}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onPrint && tx.type === 'PURCHASE' && (
            <button
              onClick={() => onPrint(tx)}
              className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 flex items-center justify-center"
              title="Cetak struk"
            >
              <Printer size={11} />
            </button>
          )}
          {onDownload && tx.type === 'PURCHASE' && (
            <button
              onClick={() => onDownload(tx)}
              className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 flex items-center justify-center"
              title="Download PDF"
            >
              <Download size={11} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(tx)}
              className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center"
              title="Edit"
            >
              <Edit3 size={11} />
            </button>
          )}
          <button
            onClick={() => onDelete(tx.id)}
            className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
            title="Hapus"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      
      {/* Expanded items detail */}
      {showDetail && tx.items && tx.items.length > 0 && (
        <div className="border-t border-white/5 p-3 bg-black/30 space-y-1">
          {tx.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex-1 min-w-0">
                <span className="text-gray-300 font-semibold truncate">{item.productName}</span>
                <div className="text-[10px] text-gray-600 font-mono">
                  {gramsToKg(item.qtyGrams)} kg × {formatRupiah(item.pricePerKg)}/kg
                </div>
              </div>
              <span className="text-yellow-400 font-mono font-bold">
                {formatRupiah(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
