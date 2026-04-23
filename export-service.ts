// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Export Service
// 
// Menangani export laporan ke:
// - Excel (.xlsx) via xlsx library
// - PDF via jsPDF + autoTable
// - Word (.docx) via docx library
// 
// Filosofi: UI tidak pernah import library export langsung.
// Mereka panggil fungsi di file ini. Kalau library diganti,
// cukup edit di sini.
// ═══════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel,
} from 'docx';

import type { Transaction, Customer, Rupiah } from './types';
import { OFFICIAL_LABEL } from './types';
import { formatRupiah, formatWeight, gramsToKg } from './money';
import {
  computePeriodSummary, formatBusinessDateID,
  activeTransactions,
} from './calculations';

// ───────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ───────────────────────────────────────────────────────────────

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildFilename(storeName: string, range: { start: string; end: string }, ext: string): string {
  return `Laporan_${safeFilename(storeName)}_${range.start}_sampai_${range.end}.${ext}`;
}

function typeLabel(type: Transaction['type']): string {
  return {
    PURCHASE: 'Pembelian',
    EXPENSE: 'Biaya Operasional',
    CAPITAL_INJECTION: 'Injeksi Modal',
    INCOME: 'Pemasukan',
    OPENING_BALANCE: 'Modal Awal',
  }[type];
}

// ═══════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export interface ExportParams {
  transactions: Transaction[];
  customers: Customer[];
  storeName: string;
  range: { start: string; end: string };
}

export async function exportToExcel(params: ExportParams): Promise<void> {
  const { transactions, customers, storeName, range } = params;
  const summary = computePeriodSummary(transactions, range.start, range.end);
  
  const wb = XLSX.utils.book_new();
  
  // ─── Sheet 1: Summary ─────────────────────────────────────
  const summarySheet = [
    ['LAPORAN KEUANGAN'],
    [storeName],
    [`Periode: ${formatBusinessDateID(range.start)} - ${formatBusinessDateID(range.end)}`],
    [''],
    ['RINGKASAN'],
    ['Saldo Awal Periode', summary.openingBalance],
    ['Total Injeksi Modal', summary.totalCapitalInjection],
    ['Total Pemasukan Lain', summary.totalIncome],
    ['Total Pembelian', summary.totalPurchase],
    ['Total Biaya Operasional', summary.totalExpense],
    ['Saldo Akhir Periode', summary.closingBalance],
    [''],
    ['STATISTIK'],
    ['Jumlah Transaksi', summary.transactionCount],
    ['Jumlah Pembelian', summary.purchaseCount],
    ['Total Berat Dibeli (kg)', gramsToKg(summary.totalWeightGrams)],
  ];
  
  const ws1 = XLSX.utils.aoa_to_sheet(summarySheet);
  ws1['!cols'] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');
  
  // ─── Sheet 2: Detail Transaksi ───────────────────────────
  const activeTxs = activeTransactions(transactions).filter(
    tx => tx.businessDate >= range.start && tx.businessDate <= range.end
  ).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  const detailHeader = [
    'Tanggal', 'Waktu', 'Tipe', 'Keterangan', 'Supplier', 
    'Berat (kg)', 'Harga/kg', 'Jumlah',
  ];
  const detailRows = activeTxs.map(tx => {
    const d = new Date(tx.timestamp);
    const dateStr = tx.businessDate;
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const weight = tx.items?.reduce((s, it) => s + it.qtyGrams, 0) || 0;
    const avgPrice = weight > 0 && tx.items 
      ? Math.round(tx.amount / gramsToKg(weight)) 
      : '';
    
    return [
      dateStr,
      timeStr,
      typeLabel(tx.type),
      tx.note || '',
      tx.customerName || '',
      weight > 0 ? gramsToKg(weight) : '',
      avgPrice,
      tx.amount,
    ];
  });
  
  const ws2 = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
  ws2['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 30 }, 
    { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Detail Transaksi');
  
  // ─── Sheet 3: Detail Items Pembelian ─────────────────────
  const itemsHeader = ['Tanggal', 'Nota ID', 'Supplier', 'Produk', 'Berat (kg)', 'Harga/kg', 'Subtotal'];
  const itemsRows: any[] = [];
  for (const tx of activeTxs) {
    if (tx.type !== 'PURCHASE' || !tx.items) continue;
    for (const item of tx.items) {
      itemsRows.push([
        tx.businessDate,
        tx.id.slice(-8).toUpperCase(),
        tx.customerName || '-',
        item.productName,
        gramsToKg(item.qtyGrams),
        item.pricePerKg,
        item.subtotal,
      ]);
    }
  }
  
  const ws3 = XLSX.utils.aoa_to_sheet([itemsHeader, ...itemsRows]);
  ws3['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, 
    { wch: 10 }, { wch: 12 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Detail Item');
  
  // ─── Sheet 4: Per Hari ───────────────────────────────────
  const dailyHeader = [
    'Tanggal', 'Modal Awal', 'Injeksi', 'Pembelian', 'Biaya', 
    'Pemasukan Lain', 'Sisa Kas', 'Berat (kg)', 'Trx',
  ];
  const dailyRows = summary.dailySnapshots.map(d => [
    d.businessDate,
    d.openingBalance,
    d.capitalInjection,
    d.totalPurchase,
    d.totalExpense,
    d.totalOtherIncome,
    d.sisaKas,
    gramsToKg(d.totalWeightGrams),
    d.transactions.length,
  ]);
  
  const ws4 = XLSX.utils.aoa_to_sheet([dailyHeader, ...dailyRows]);
  ws4['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, 'Rekap Harian');
  
  // Generate & download
  const filename = buildFilename(storeName, range, 'xlsx');
  XLSX.writeFile(wb, filename);
}

// ═══════════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportToPDF(params: ExportParams): Promise<void> {
  const { transactions, storeName, range } = params;
  const summary = computePeriodSummary(transactions, range.start, range.end);
  
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // ─── Header ──────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN KEUANGAN', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(13);
  doc.text(storeName, pageWidth / 2, 28, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Periode: ${formatBusinessDateID(range.start)} - ${formatBusinessDateID(range.end)}`,
    pageWidth / 2, 35, { align: 'center' }
  );
  
  // Line divider
  doc.setDrawColor(200);
  doc.line(15, 40, pageWidth - 15, 40);
  
  // ─── Summary box ─────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RINGKASAN KAS', 15, 50);
  
  autoTable(doc, {
    startY: 54,
    head: [['Komponen', 'Jumlah']],
    body: [
      ['Saldo Awal Periode', formatRupiah(summary.openingBalance)],
      ['(+) Injeksi Modal', formatRupiah(summary.totalCapitalInjection)],
      ['(+) Pemasukan Lain', formatRupiah(summary.totalIncome)],
      ['(-) Pembelian Rongsok', formatRupiah(summary.totalPurchase)],
      ['(-) Biaya Operasional', formatRupiah(summary.totalExpense)],
      ['SALDO AKHIR PERIODE', formatRupiah(summary.closingBalance)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [234, 179, 8], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Highlight baris terakhir (saldo akhir)
      if (data.row.index === 5) {
        data.cell.styles.fillColor = [254, 240, 138];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  
  // ─── Stats ───────────────────────────────────────────────
  const statsY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('STATISTIK OPERASIONAL', 15, statsY);
  
  autoTable(doc, {
    startY: statsY + 4,
    body: [
      ['Jumlah Transaksi', String(summary.transactionCount)],
      ['Jumlah Pembelian', String(summary.purchaseCount)],
      ['Total Berat Dibeli', formatWeight(summary.totalWeightGrams)],
    ],
    theme: 'plain',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 100, fontStyle: 'bold' },
      1: { cellWidth: 70, halign: 'right' },
    },
  });
  
  // ─── Detail Transaksi (sheet kedua) ──────────────────────
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAIL TRANSAKSI', pageWidth / 2, 20, { align: 'center' });
  
  const activeTxs = activeTransactions(transactions).filter(
    tx => tx.businessDate >= range.start && tx.businessDate <= range.end
  ).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  const detailData = activeTxs.slice(0, 200).map(tx => {
    const d = new Date(tx.timestamp);
    return [
      tx.businessDate,
      d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      typeLabel(tx.type).slice(0, 15),
      (tx.note || tx.items?.[0]?.productName || '-').slice(0, 30),
      tx.customerName?.slice(0, 15) || '-',
      formatRupiah(tx.amount),
    ];
  });
  
  autoTable(doc, {
    startY: 26,
    head: [['Tanggal', 'Jam', 'Tipe', 'Keterangan', 'Supplier', 'Jumlah']],
    body: detailData,
    theme: 'striped',
    headStyles: { fillColor: [234, 179, 8], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 15 },
      2: { cellWidth: 27 },
      3: { cellWidth: 55 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30, halign: 'right' },
    },
  });
  
  if (activeTxs.length > 200) {
    const y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`... dan ${activeTxs.length - 200} transaksi lainnya. Export ke Excel untuk list lengkap.`, 15, y);
  }
  
  // ─── Footer di setiap halaman ───────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);
    doc.text(OFFICIAL_LABEL, pageWidth / 2, 285, { align: 'center' });
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 15, 290, { align: 'right' });
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 15, 290);
  }
  
  // Save
  const filename = buildFilename(storeName, range, 'pdf');
  doc.save(filename);
}

// ═══════════════════════════════════════════════════════════════
// WORD (DOCX) EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportToWord(params: ExportParams): Promise<void> {
  const { transactions, storeName, range } = params;
  const summary = computePeriodSummary(transactions, range.start, range.end);
  
  const doc = new Document({
    sections: [{
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'LAPORAN KEUANGAN', bold: true, size: 36 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: storeName, size: 26, bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: `Periode: ${formatBusinessDateID(range.start)} - ${formatBusinessDateID(range.end)}`,
            size: 20,
          })],
        }),
        new Paragraph({ children: [new TextRun('')] }),
        
        // Summary heading
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Ringkasan Kas', bold: true })],
        }),
        
        // Summary table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            buildSummaryRow('Saldo Awal Periode', formatRupiah(summary.openingBalance)),
            buildSummaryRow('(+) Injeksi Modal', formatRupiah(summary.totalCapitalInjection)),
            buildSummaryRow('(+) Pemasukan Lain', formatRupiah(summary.totalIncome)),
            buildSummaryRow('(-) Pembelian Rongsok', formatRupiah(summary.totalPurchase)),
            buildSummaryRow('(-) Biaya Operasional', formatRupiah(summary.totalExpense)),
            buildSummaryRow('SALDO AKHIR PERIODE', formatRupiah(summary.closingBalance), true),
          ],
        }),
        
        new Paragraph({ children: [new TextRun('')] }),
        
        // Stats heading
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Statistik', bold: true })],
        }),
        new Paragraph({
          children: [new TextRun(`Jumlah Transaksi: ${summary.transactionCount}`)],
        }),
        new Paragraph({
          children: [new TextRun(`Jumlah Pembelian: ${summary.purchaseCount}`)],
        }),
        new Paragraph({
          children: [new TextRun(`Total Berat Dibeli: ${formatWeight(summary.totalWeightGrams)}`)],
        }),
        
        new Paragraph({ children: [new TextRun('')] }),
        
        // Official label
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: OFFICIAL_LABEL,
            italics: true,
            size: 16,
            color: '666666',
          })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: `Dicetak: ${new Date().toLocaleString('id-ID')}`,
            italics: true,
            size: 14,
            color: '888888',
          })],
        }),
      ],
    }],
  });
  
  const blob = await Packer.toBlob(doc);
  const filename = buildFilename(storeName, range, 'docx');
  saveAs(blob, filename);
}

function buildSummaryRow(label: string, value: string, bold: boolean = false): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 60, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold })],
        })],
      }),
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: value, bold })],
        })],
      }),
    ],
  });
}
