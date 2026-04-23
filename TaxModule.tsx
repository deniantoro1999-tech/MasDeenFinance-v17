// ═══════════════════════════════════════════════════════════════
// TaxModule — Perhitungan pajak untuk toko rongsok
// 
// Pendekatan fleksibel:
// - User pilih jenis pajak di Settings (PPh Final UMKM 0.5%, PPh 22,
//   PPN, atau Custom %)
// - Di sini tampilkan hasil hitungan berdasarkan periode yang dipilih
// - Tampilkan breakdown per bulan
// - Export PDF untuk lapor SPT
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calculator, Info, Calendar, Download,
  TrendingUp, FileText, AlertCircle, ShoppingBag,
} from 'lucide-react';
import { formatRupiah } from '../../lib/money';
import {
  transactionsInRange, todayBusinessDate, activeTransactions,
  formatBusinessDateID,
} from '../../lib/calculations';
import type { Transaction, Rupiah } from '../../lib/types';
import { toRupiah } from '../../lib/money';

// ───────────────────────────────────────────────────────────────
// TAX TYPES & PRESETS
// ───────────────────────────────────────────────────────────────

export type TaxBasis = 'purchase' | 'expense' | 'total_outflow';

export interface TaxConfig {
  /** Nama pajak (misal "PPh Final UMKM 0.5%") */
  name: string;
  /** Tarif dalam desimal (0.5% = 0.005) */
  rate: number;
  /** Basis perhitungan: apa yang dikenakan pajak */
  basis: TaxBasis;
  /** Deskripsi singkat */
  description?: string;
}

export const TAX_PRESETS: Record<string, TaxConfig> = {
  PPH_FINAL_UMKM: {
    name: 'PPh Final UMKM',
    rate: 0.005, // 0.5%
    basis: 'purchase',
    description: 'PP 55/2022: 0.5% dari omzet untuk UMKM dengan peredaran bruto < Rp 4.8 M/tahun',
  },
  PPH_22: {
    name: 'PPh Pasal 22',
    rate: 0.0025, // 0.25%
    basis: 'purchase',
    description: '0.25% dari nilai pembelian barang dari pedagang pengumpul',
  },
  PPN: {
    name: 'PPN',
    rate: 0.11, // 11%
    basis: 'purchase',
    description: '11% untuk Pengusaha Kena Pajak (PKP)',
  },
  CUSTOM: {
    name: 'Custom',
    rate: 0.01,
    basis: 'purchase',
    description: 'Tarif custom yang diatur sendiri',
  },
};

export interface TaxModuleProps {
  transactions: Transaction[];
  /** Config pajak dari Settings (kalau belum diset, pakai default) */
  taxConfig?: TaxConfig;
  storeName: string;
  onExportPDF?: (data: TaxReportData) => Promise<void>;
}

export interface TaxReportData {
  config: TaxConfig;
  period: { start: string; end: string };
  monthlyBreakdown: MonthlyTax[];
  totalBase: Rupiah;
  totalTax: Rupiah;
}

interface MonthlyTax {
  month: string; // YYYY-MM
  monthLabel: string; // "Januari 2026"
  base: Rupiah;
  tax: Rupiah;
  transactionCount: number;
}

// ───────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ───────────────────────────────────────────────────────────────

export function TaxModule({
  transactions,
  taxConfig = TAX_PRESETS.PPH_FINAL_UMKM,
  storeName,
  onExportPDF,
}: TaxModuleProps) {
  // Period: default tahun ini
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [isExporting, setIsExporting] = useState(false);
  
  // Hitung breakdown bulanan
  const report = useMemo((): TaxReportData => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const rangeTxs = transactionsInRange(transactions, startDate, endDate);
    
    // Group by month
    const monthMap = new Map<string, { base: number; count: number }>();
    
    for (const tx of rangeTxs) {
      const month = tx.businessDate.slice(0, 7); // YYYY-MM
      const existing = monthMap.get(month) || { base: 0, count: 0 };
      
      let contribution = 0;
      
      if (taxConfig.basis === 'purchase' && tx.type === 'PURCHASE') {
        contribution = tx.amount;
      } else if (taxConfig.basis === 'expense' && tx.type === 'EXPENSE') {
        contribution = tx.amount;
      } else if (taxConfig.basis === 'total_outflow' && (tx.type === 'PURCHASE' || tx.type === 'EXPENSE')) {
        contribution = tx.amount;
      }
      
      if (contribution > 0) {
        existing.base += contribution;
        existing.count++;
        monthMap.set(month, existing);
      }
    }
    
    // Convert to array + compute tax
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const monthlyBreakdown: MonthlyTax[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const data = monthMap.get(key) || { base: 0, count: 0 };
      monthlyBreakdown.push({
        month: key,
        monthLabel: `${months[m - 1]} ${year}`,
        base: toRupiah(data.base),
        tax: toRupiah(data.base * taxConfig.rate),
        transactionCount: data.count,
      });
    }
    
    const totalBase = monthlyBreakdown.reduce((s, m) => s + m.base, 0);
    const totalTax = monthlyBreakdown.reduce((s, m) => s + m.tax, 0);
    
    return {
      config: taxConfig,
      period: { start: startDate, end: endDate },
      monthlyBreakdown,
      totalBase: toRupiah(totalBase),
      totalTax: toRupiah(totalTax),
    };
  }, [transactions, year, taxConfig]);
  
  // Cek threshold UMKM (4.8 miliar)
  const umkmThreshold = 4_800_000_000;
  const isOverUMKM = taxConfig.name.includes('UMKM') && report.totalBase > umkmThreshold;
  
  const handleExport = async () => {
    if (!onExportPDF) return;
    setIsExporting(true);
    try {
      await onExportPDF(report);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Available years (dari data transaksi)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const tx of activeTransactions(transactions)) {
      years.add(parseInt(tx.businessDate.slice(0, 4), 10));
    }
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);
  
  return (
    <div className="p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
            Pajak
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Perhitungan <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Pajak</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ringkasan pajak untuk pelaporan SPT Tahunan
          </p>
        </div>
        
        {onExportPDF && (
          <button
            onClick={handleExport}
            disabled={isExporting || report.totalBase === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-bold rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-yellow-600/20"
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span className="text-sm">Export PDF</span>
          </button>
        )}
      </div>
      
      {/* Tax config info */}
      <div className="bg-gradient-to-br from-blue-600/10 via-[#0a0a0a] to-[#0a0a0a] border border-blue-500/30 rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Info size={18} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white text-sm">{taxConfig.name}</h3>
              <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 rounded-md text-[10px] font-bold text-blue-300 font-mono">
                {(taxConfig.rate * 100).toFixed(2)}%
              </span>
            </div>
            {taxConfig.description && (
              <p className="text-xs text-gray-400 leading-relaxed">{taxConfig.description}</p>
            )}
            <p className="text-[10px] text-gray-500 mt-2">
              💡 Ubah jenis pajak di <strong className="text-yellow-500">Pengaturan → Pajak</strong>
            </p>
          </div>
        </div>
      </div>
      
      {/* Warning kalau over UMKM threshold */}
      {isOverUMKM && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-950/30 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3"
        >
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-300 text-sm mb-1">Peringatan: Omzet Melebihi Batas UMKM</h4>
            <p className="text-xs text-red-300/80 leading-relaxed">
              Omzet {formatRupiah(report.totalBase)} telah melebihi batas UMKM 
              (Rp 4.800.000.000). PPh Final 0.5% tidak berlaku lagi — Anda wajib 
              menggunakan skema pajak badan normal. Konsultasikan dengan konsultan pajak.
            </p>
          </div>
        </motion.div>
      )}
      
      {/* Year selector */}
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-yellow-500/60" />
        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tahun Pajak:</span>
        <div className="flex gap-1">
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                year === y
                  ? 'bg-yellow-500 text-black'
                  : 'bg-black/40 border border-yellow-600/20 text-gray-500 hover:text-yellow-500'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          icon={ShoppingBag}
          label="Dasar Pengenaan Pajak"
          value={formatRupiah(report.totalBase)}
          subtitle={`${report.monthlyBreakdown.reduce((s, m) => s + m.transactionCount, 0)} transaksi`}
        />
        <SummaryCard
          icon={Calculator}
          label={`Tarif ${(taxConfig.rate * 100).toFixed(2)}%`}
          value={`${(taxConfig.rate * 100).toFixed(2)}%`}
          subtitle={taxConfig.name}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Total Pajak Terutang"
          value={formatRupiah(report.totalTax)}
          subtitle={`Tahun ${year}`}
          tone="gold"
        />
      </div>
      
      {/* Monthly breakdown table */}
      <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-3xl overflow-hidden">
        <div className="p-4 md:p-5 border-b border-yellow-600/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-yellow-400" />
            <h3 className="font-bold text-yellow-400 text-sm uppercase tracking-wider">
              Breakdown Per Bulan — {year}
            </h3>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/30">
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-bold">Bulan</th>
                <th className="px-4 py-3 text-right font-bold">Transaksi</th>
                <th className="px-4 py-3 text-right font-bold">DPP</th>
                <th className="px-4 py-3 text-right font-bold">Pajak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {report.monthlyBreakdown.map(m => (
                <tr 
                  key={m.month} 
                  className={`transition-colors ${
                    m.base > 0 ? 'hover:bg-yellow-500/5' : 'opacity-40'
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-white font-medium">
                    {m.monthLabel}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                    {m.transactionCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-right font-mono">
                    {formatRupiah(m.base)}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-400 text-right font-mono font-bold">
                    {formatRupiah(m.tax)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gradient-to-r from-yellow-600/10 to-transparent border-t-2 border-yellow-500/30">
              <tr>
                <td className="px-4 py-3 text-sm font-black text-yellow-400 uppercase tracking-wider">
                  Total {year}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right font-mono font-bold">
                  {report.monthlyBreakdown.reduce((s, m) => s + m.transactionCount, 0)}
                </td>
                <td className="px-4 py-3 text-sm text-white text-right font-mono font-black">
                  {formatRupiah(report.totalBase)}
                </td>
                <td className="px-4 py-3 text-base text-yellow-400 text-right font-mono font-black">
                  {formatRupiah(report.totalTax)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      {/* Disclaimer */}
      <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={13} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            <strong>Disclaimer:</strong> Perhitungan ini adalah estimasi berdasarkan 
            data transaksi yang tercatat di sistem. Hasil akhir untuk pelaporan SPT 
            wajib diverifikasi oleh konsultan pajak atau dengan peraturan perpajakan 
            terbaru. Aplikasi ini bukan pengganti nasihat pajak profesional.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, subtitle, tone = 'neutral',
}: {
  icon: typeof Calculator;
  label: string;
  value: string;
  subtitle?: string;
  tone?: 'neutral' | 'gold';
}) {
  const toneClass = tone === 'gold'
    ? 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
    : 'bg-blue-600/15 text-blue-400 border-blue-600/20';
  
  return (
    <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${toneClass}`}>
        <Icon size={15} />
      </div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">
        {label}
      </div>
      <div className={`text-base md:text-lg font-black font-mono ${tone === 'gold' ? 'text-yellow-400' : 'text-white'}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] text-gray-600 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
