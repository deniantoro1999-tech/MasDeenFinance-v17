// ═══════════════════════════════════════════════════════════════
// ReportsModule — Laporan keuangan lengkap
// 
// Fitur:
// - Filter periode (7 hari, 30 hari, bulan ini, custom range)
// - Summary cards (total pembelian, biaya, sisa kas)
// - Chart tren harian (line chart)
// - Chart komposisi per produk (pie chart)
// - Top supplier
// - Export Excel, PDF, Word
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3, TrendingDown, TrendingUp, Wallet, Package,
  Download, FileSpreadsheet, FileText, Calendar, Filter,
  ShoppingBag, Users,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatRupiah, formatWeight, gramsToKg } from '../../lib/money';
import {
  computePeriodSummary, todayBusinessDate,
  formatBusinessDateID, transactionsInRange, activeTransactions,
} from '../../lib/calculations';
import type { Transaction, Customer } from '../../lib/types';

export interface ReportsModuleProps {
  transactions: Transaction[];
  customers: Customer[];
  storeName: string;
  onExportExcel: (range: { start: string; end: string }) => Promise<void>;
  onExportPDF: (range: { start: string; end: string }) => Promise<void>;
  onExportWord: (range: { start: string; end: string }) => Promise<void>;
}

type DateRangePreset = '7d' | '30d' | 'month' | 'custom';

export function ReportsModule({
  transactions,
  customers,
  storeName,
  onExportExcel,
  onExportPDF,
  onExportWord,
}: ReportsModuleProps) {
  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customStart, setCustomStart] = useState(todayBusinessDate());
  const [customEnd, setCustomEnd] = useState(todayBusinessDate());
  const [isExporting, setIsExporting] = useState<string | null>(null);
  
  // Compute date range dari preset
  const { startDate, endDate } = useMemo(() => {
    const today = todayBusinessDate();
    const end = today;
    let start = today;
    
    if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      start = d.toISOString().slice(0, 10);
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(1);
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    
    return { startDate: start, endDate: end };
  }, [preset, customStart, customEnd]);
  
  const summary = useMemo(
    () => computePeriodSummary(transactions, startDate, endDate),
    [transactions, startDate, endDate]
  );
  
  // Chart data: tren harian
  const dailyChartData = useMemo(() => {
    return summary.dailySnapshots.map(d => ({
      date: d.businessDate.slice(5), // MM-DD
      fullDate: formatBusinessDateID(d.businessDate),
      pembelian: d.totalPurchase,
      biaya: d.totalExpense,
      sisaKas: d.sisaKas,
    }));
  }, [summary]);
  
  // Chart data: komposisi produk
  const productComposition = useMemo(() => {
    const productMap = new Map<string, { amount: number; weight: number }>();
    const rangeTxs = transactionsInRange(transactions, startDate, endDate);
    
    for (const tx of rangeTxs) {
      if (tx.type !== 'PURCHASE' || !tx.items) continue;
      for (const item of tx.items) {
        const prev = productMap.get(item.productName) || { amount: 0, weight: 0 };
        productMap.set(item.productName, {
          amount: prev.amount + item.subtotal,
          weight: prev.weight + item.qtyGrams,
        });
      }
    }
    
    return Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8); // Top 8 produk
  }, [transactions, startDate, endDate]);
  
  // Top suppliers (by total amount)
  const topSuppliers = useMemo(() => {
    const rangeTxs = transactionsInRange(transactions, startDate, endDate);
    const supplierMap = new Map<string, { name: string; amount: number; count: number; weight: number }>();
    
    for (const tx of rangeTxs) {
      if (tx.type !== 'PURCHASE' || !tx.customerId) continue;
      const prev = supplierMap.get(tx.customerId);
      const weight = tx.items?.reduce((s, it) => s + it.qtyGrams, 0) || 0;
      if (prev) {
        prev.amount += tx.amount;
        prev.count++;
        prev.weight += weight;
      } else {
        supplierMap.set(tx.customerId, {
          name: tx.customerName || customers.find(c => c.id === tx.customerId)?.name || 'Unknown',
          amount: tx.amount,
          count: 1,
          weight,
        });
      }
    }
    
    return Array.from(supplierMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions, startDate, endDate, customers]);
  
  const handleExport = async (format: 'excel' | 'pdf' | 'word') => {
    setIsExporting(format);
    try {
      const range = { start: startDate, end: endDate };
      if (format === 'excel') await onExportExcel(range);
      else if (format === 'pdf') await onExportPDF(range);
      else if (format === 'word') await onExportWord(range);
    } finally {
      setIsExporting(null);
    }
  };
  
  const PIE_COLORS = ['#EAB308', '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F', '#F97316', '#FB923C'];
  
  return (
    <div className="p-4 md:p-8 space-y-5 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
            Laporan Detail
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Analisis <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Keuangan</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatBusinessDateID(startDate)} sampai {formatBusinessDateID(endDate)}
          </p>
        </div>
        
        {/* Export buttons */}
        <div className="grid grid-cols-3 gap-2">
          <ExportButton
            icon={FileSpreadsheet}
            label="Excel"
            loading={isExporting === 'excel'}
            onClick={() => handleExport('excel')}
            color="emerald"
          />
          <ExportButton
            icon={FileText}
            label="PDF"
            loading={isExporting === 'pdf'}
            onClick={() => handleExport('pdf')}
            color="red"
          />
          <ExportButton
            icon={FileText}
            label="Word"
            loading={isExporting === 'word'}
            onClick={() => handleExport('word')}
            color="blue"
          />
        </div>
      </div>
      
      {/* Date preset filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex gap-1 p-1 bg-black/40 border border-yellow-600/15 rounded-xl">
          {([
            { id: '7d', label: '7 Hari' },
            { id: '30d', label: '30 Hari' },
            { id: 'month', label: 'Bulan Ini' },
            { id: 'custom', label: 'Custom' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setPreset(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                preset === opt.id
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-500 hover:text-yellow-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        
        {preset === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-black/40 border border-yellow-600/20 rounded-lg text-white text-xs focus:outline-none focus:border-yellow-500"
            />
            <span className="text-gray-500 text-xs">sampai</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-black/40 border border-yellow-600/20 rounded-lg text-white text-xs focus:outline-none focus:border-yellow-500"
            />
          </div>
        )}
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          icon={ShoppingBag} 
          label="Total Pembelian" 
          value={formatRupiah(summary.totalPurchase)} 
          subtitle={`${summary.purchaseCount} transaksi`}
          tone="gold"
        />
        <StatCard 
          icon={TrendingDown} 
          label="Total Biaya" 
          value={formatRupiah(summary.totalExpense)} 
          tone="red"
        />
        <StatCard 
          icon={Package} 
          label="Total Berat" 
          value={formatWeight(summary.totalWeightGrams)} 
        />
        <StatCard 
          icon={Wallet} 
          label="Kas Akhir" 
          value={formatRupiah(summary.closingBalance)} 
          subtitle={summary.closingBalance >= summary.openingBalance ? 'Naik' : 'Turun'}
          tone={summary.closingBalance >= summary.openingBalance ? 'green' : 'red'}
        />
      </div>
      
      {/* Chart: Trend harian */}
      {dailyChartData.length > 0 && (
        <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-3xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-yellow-400" />
            <h3 className="font-bold text-yellow-400 text-sm uppercase tracking-wider">
              Tren Harian
            </h3>
          </div>
          
          <div className="h-72 -mx-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="gradPembelian" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EAB308" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#EAB308" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBiaya" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#64748B" style={{ fontSize: '10px' }} />
                <YAxis 
                  stroke="#64748B" 
                  style={{ fontSize: '10px' }} 
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => formatRupiah(value)}
                  labelFormatter={(label: string, payload: any[]) => {
                    return payload?.[0]?.payload?.fullDate || label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area 
                  type="monotone" 
                  dataKey="pembelian" 
                  stroke="#EAB308" 
                  strokeWidth={2}
                  fill="url(#gradPembelian)"
                  name="Pembelian"
                />
                <Area 
                  type="monotone" 
                  dataKey="biaya" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  fill="url(#gradBiaya)"
                  name="Biaya"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      {/* Bottom section: Pie chart + Top suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Komposisi Produk */}
        {productComposition.length > 0 && (
          <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package size={16} className="text-yellow-400" />
              <h3 className="font-bold text-yellow-400 text-sm uppercase tracking-wider">
                Komposisi Pembelian
              </h3>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productComposition}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                  >
                    {productComposition.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0a',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => formatRupiah(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend manual */}
            <div className="mt-3 space-y-1.5">
              {productComposition.slice(0, 5).map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-gray-300 truncate">{p.name}</span>
                  </div>
                  <span className="text-yellow-400 font-mono font-bold flex-shrink-0">
                    {formatRupiah(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Top Suppliers */}
        {topSuppliers.length > 0 && (
          <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-3xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-yellow-400" />
              <h3 className="font-bold text-yellow-400 text-sm uppercase tracking-wider">
                Top 5 Supplier
              </h3>
            </div>
            
            <div className="space-y-2">
              {topSuppliers.map((s, i) => {
                const pct = (s.amount / summary.totalPurchase) * 100;
                return (
                  <div key={i} className="p-3 bg-black/40 border border-yellow-600/10 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-black text-xs flex-shrink-0">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm truncate">{s.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {s.count}x beli · {formatWeight(s.weight)}
                        </div>
                      </div>
                      <div className="text-sm font-black text-yellow-400 font-mono flex-shrink-0">
                        {formatRupiah(s.amount)}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-black/60 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Empty state */}
      {summary.transactionCount === 0 && (
        <div className="text-center py-16 bg-[#080808]/60 border border-yellow-600/10 rounded-3xl">
          <BarChart3 size={40} className="mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm">Tidak ada transaksi di periode ini</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, subtitle, tone = 'neutral',
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  subtitle?: string;
  tone?: 'neutral' | 'gold' | 'green' | 'red';
}) {
  const toneClass = {
    neutral: 'bg-blue-600/15 text-blue-400 border-blue-600/20',
    gold: 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20',
    green: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20',
    red: 'bg-red-600/15 text-red-400 border-red-600/20',
  }[tone];
  
  return (
    <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-3 md:p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border mb-2 ${toneClass}`}>
        <Icon size={13} />
      </div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">{label}</div>
      <div className="text-sm md:text-base font-black text-white font-mono truncate">{value}</div>
      {subtitle && (
        <div className="text-[10px] text-gray-600 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

function ExportButton({
  icon: Icon, label, loading, onClick, color,
}: {
  icon: typeof FileText;
  label: string;
  loading: boolean;
  onClick: () => void;
  color: 'emerald' | 'red' | 'blue';
}) {
  const colorClass = {
    emerald: 'bg-emerald-600/15 border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/25',
    red: 'bg-red-600/15 border-red-600/30 text-red-400 hover:bg-red-600/25',
    blue: 'bg-blue-600/15 border-blue-600/30 text-blue-400 hover:bg-blue-600/25',
  }[color];
  
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${colorClass}`}
    >
      {loading ? (
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon size={13} />
      )}
      <span>{label}</span>
    </button>
  );
}
