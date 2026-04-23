// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Receipt Service
// 
// Menangani 3 cara output struk:
// 1. Print langsung ke thermal printer 58mm via window.print()
// 2. Generate PDF struk untuk download
// 3. Convert struk ke gambar PNG + share ke WhatsApp
// 
// PELAJARAN PENTING dari v16:
// - Lebar kertas thermal 58mm = area cetak 44-48mm (printer punya margin)
// - Font HARUS monospace, ukuran 9-11px maksimal
// - HINDARI element transform/animation yang bikin printer bingung
// - Pakai @media print untuk reset semua style yang konflik
// ═══════════════════════════════════════════════════════════════

import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import * as htmlToImage from 'html-to-image';
import { formatRupiah, formatRupiahPlain, gramsToKg } from './money';
import type { Transaction, AppSettings } from './types';
import { OFFICIAL_LABEL } from './types';

// ───────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────

export interface ReceiptContext {
  transaction: Transaction;
  settings: AppSettings;
  cashierName?: string;
}

// ═══════════════════════════════════════════════════════════════
// 1. PRINT LANGSUNG (window.print)
// ═══════════════════════════════════════════════════════════════

/**
 * Cetak struk langsung via printer thermal.
 * 
 * Cara kerja:
 * 1. Inject HTML struk ke hidden div dengan class .receipt-print-only
 * 2. Trigger window.print()
 * 3. CSS @media print akan menyembunyikan semua kecuali container struk
 * 4. Setelah dialog print ditutup, hapus div
 * 
 * PENTING: User harus set "Page size: 58mm" di dialog print
 */
export function printReceiptDirect(ctx: ReceiptContext): void {
  // Hapus dulu kalau ada bekas dari print sebelumnya
  const existing = document.getElementById('receipt-print-target');
  if (existing) existing.remove();
  
  // Build HTML struk
  const html = buildReceiptHTML(ctx);
  
  // Inject ke DOM
  const container = document.createElement('div');
  container.id = 'receipt-print-target';
  container.className = 'receipt-print-only';
  container.innerHTML = html;
  document.body.appendChild(container);
  
  // Tunggu sebentar supaya browser render dulu, baru print
  setTimeout(() => {
    window.print();
    // Cleanup setelah dialog ditutup
    setTimeout(() => {
      const el = document.getElementById('receipt-print-target');
      if (el) el.remove();
    }, 500);
  }, 100);
}

/**
 * Build HTML struk dengan inline styles (supaya printable independen).
 * Lebar 44mm aman untuk kertas 58mm (margin printer biasanya 5-7mm tiap sisi).
 */
function buildReceiptHTML(ctx: ReceiptContext): string {
  const { transaction: tx, settings, cashierName } = ctx;
  
  const time = new Date(tx.timestamp).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const noteId = tx.id.slice(-8).toUpperCase();
  
  // Items HTML
  const itemsHTML = (tx.items || []).map(item => `
    <div style="margin-bottom: 1.5mm;">
      <div style="font-weight: bold;">${escapeHTML(item.productName.toUpperCase())}</div>
      <div style="display: flex; justify-content: space-between;">
        <span>${gramsToKg(item.qtyGrams).toLocaleString('id-ID', { maximumFractionDigits: 3 })} kg x ${formatRupiahPlain(item.pricePerKg)}</span>
        <span>${formatRupiahPlain(item.subtotal)}</span>
      </div>
    </div>
  `).join('');
  
  return `
    <div class="receipt-container" style="
      width: 44mm;
      margin: 0 auto;
      padding: 2mm 0 8mm 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 9px;
      line-height: 1.5;
      color: #000;
      background: #fff;
      box-sizing: border-box;
      word-wrap: break-word;
      overflow: hidden;
      text-transform: uppercase;
    ">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 3mm;">
        <h1 style="font-size: 12px; line-height: 1.2; margin: 0 0 1mm; font-weight: 900; word-break: break-word;">
          ${escapeHTML(settings.storeName)}
        </h1>
        <div style="font-size: 8px; line-height: 1.4; white-space: pre-wrap;">
          ${escapeHTML(settings.receiptHeader)}
        </div>
      </div>
      
      <div style="border-top: 1px dashed #000; margin: 3mm 0;"></div>
      
      <!-- Transaction info -->
      <div style="margin-bottom: 3mm;">
        <div>NO: #${noteId}</div>
        <div>TGL: ${time}</div>
        ${cashierName ? `<div>KASIR: ${escapeHTML(cashierName.toUpperCase())}</div>` : ''}
        ${tx.customerName ? `<div>SUPPLIER: ${escapeHTML(tx.customerName.toUpperCase())}</div>` : ''}
      </div>
      
      <div style="text-align: center; font-weight: bold; margin: 3mm 0;">
        STRUK PEMBELIAN
      </div>
      
      <div style="border-top: 1px dashed #000; margin: 3mm 0;"></div>
      
      <!-- Items -->
      <div>
        ${itemsHTML || `<div style="text-align: center; font-style: italic;">${escapeHTML(tx.note || 'Tanpa item')}</div>`}
      </div>
      
      <div style="border-top: 1px dashed #000; margin: 3mm 0;"></div>
      
      <!-- Total -->
      <div style="font-weight: 900; font-size: 11px; display: flex; justify-content: space-between;">
        <span>TOTAL</span>
        <span>${formatRupiah(tx.amount)}</span>
      </div>
      
      <div style="border-top: 1px dashed #000; margin: 3mm 0;"></div>
      
      <!-- Footer -->
      <div style="text-align: center; margin-top: 5mm; font-size: 8px; line-height: 1.6; padding-bottom: 5mm;">
        <div style="white-space: pre-wrap;">${escapeHTML(settings.receiptFooter)}</div>
        <div style="font-size: 6px; margin-top: 3mm; line-height: 1.4;">
          ${escapeHTML(OFFICIAL_LABEL)}
        </div>
      </div>
    </div>
  `;
}

function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════════════════════
// 2. DOWNLOAD PDF
// ═══════════════════════════════════════════════════════════════

/**
 * Generate PDF struk dengan jsPDF.
 * Format kertas 58mm × auto-height.
 */
export function downloadReceiptPDF(ctx: ReceiptContext): void {
  const { transaction: tx, settings, cashierName } = ctx;
  
  // Estimasi tinggi: header (~25mm) + items (~8mm per item) + footer (~30mm)
  const itemsCount = tx.items?.length || 1;
  const estimatedHeight = 70 + (itemsCount * 8);
  
  const doc = new jsPDF({
    unit: 'mm',
    format: [58, estimatedHeight],
  });
  
  let y = 5;
  const centerX = 29;
  const leftX = 4;
  const rightX = 54;
  
  // Header — store name
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  const storeNameLines = doc.splitTextToSize(settings.storeName.toUpperCase(), 50);
  doc.text(storeNameLines, centerX, y, { align: 'center' });
  y += storeNameLines.length * 4;
  
  // Header — address
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  const headerLines = doc.splitTextToSize(settings.receiptHeader, 50);
  doc.text(headerLines, centerX, y, { align: 'center' });
  y += headerLines.length * 3;
  
  y += 2;
  drawDashedLine(doc, leftX, y, rightX);
  y += 4;
  
  // Transaction info
  doc.setFontSize(8);
  doc.text(`NO: #${tx.id.slice(-8).toUpperCase()}`, leftX, y);
  y += 3.5;
  doc.text(`TGL: ${new Date(tx.timestamp).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })}`, leftX, y);
  y += 3.5;
  
  if (cashierName) {
    doc.text(`KASIR: ${cashierName.toUpperCase()}`, leftX, y);
    y += 3.5;
  }
  if (tx.customerName) {
    doc.text(`SUPPLIER: ${tx.customerName.toUpperCase()}`, leftX, y);
    y += 3.5;
  }
  
  y += 2;
  doc.setFont('courier', 'bold');
  doc.text('STRUK PEMBELIAN', centerX, y, { align: 'center' });
  y += 4;
  
  drawDashedLine(doc, leftX, y, rightX);
  y += 4;
  
  // Items
  if (tx.items && tx.items.length > 0) {
    for (const item of tx.items) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      const nameLines = doc.splitTextToSize(item.productName.toUpperCase(), 50);
      doc.text(nameLines, leftX, y);
      y += nameLines.length * 3.5;
      
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      const qtyText = `${gramsToKg(item.qtyGrams).toLocaleString('id-ID', { maximumFractionDigits: 3 })} kg x ${formatRupiahPlain(item.pricePerKg)}`;
      doc.text(qtyText, leftX, y);
      doc.text(formatRupiahPlain(item.subtotal), rightX, y, { align: 'right' });
      y += 5;
    }
  } else {
    doc.setFont('courier', 'italic');
    doc.setFontSize(8);
    doc.text(tx.note || '-', centerX, y, { align: 'center' });
    y += 5;
  }
  
  drawDashedLine(doc, leftX, y, rightX);
  y += 4;
  
  // Total
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', leftX, y);
  doc.text(formatRupiah(tx.amount), rightX, y, { align: 'right' });
  y += 5;
  
  drawDashedLine(doc, leftX, y, rightX);
  y += 4;
  
  // Footer
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  const footerLines = doc.splitTextToSize(settings.receiptFooter, 50);
  doc.text(footerLines, centerX, y, { align: 'center' });
  y += footerLines.length * 3 + 3;
  
  doc.setFontSize(5);
  const labelLines = doc.splitTextToSize(OFFICIAL_LABEL, 50);
  doc.text(labelLines, centerX, y, { align: 'center' });
  
  // Save
  const noteId = tx.id.slice(-8);
  doc.save(`Struk_${noteId}.pdf`);
}

function drawDashedLine(doc: jsPDF, x1: number, y: number, x2: number): void {
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.setLineWidth(0.1);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0); // reset
}

// ═══════════════════════════════════════════════════════════════
// 3. SHARE KE WHATSAPP
// ═══════════════════════════════════════════════════════════════

/**
 * Share struk ke WhatsApp dengan dua opsi:
 * 1. Kalau browser support Web Share API + image: share gambar struk + caption
 * 2. Fallback: download gambar + buka WhatsApp Web dengan caption text saja
 * 
 * Browser support:
 * - Chrome/Edge mobile: full support (image + text)
 * - Safari iOS: image support
 * - Desktop browsers: biasanya text only
 */
export async function shareReceiptToWhatsApp(ctx: ReceiptContext): Promise<void> {
  const { transaction: tx } = ctx;
  
  // Step 1: render struk ke offscreen container untuk capture
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '0';
  container.style.background = '#ffffff';
  container.style.padding = '10px';
  container.innerHTML = buildReceiptHTML(ctx);
  document.body.appendChild(container);
  
  const receiptEl = container.querySelector('.receipt-container') as HTMLElement;
  if (!receiptEl) {
    container.remove();
    throw new Error('Gagal render struk');
  }
  
  let dataUrl: string;
  try {
    // Capture as PNG
    dataUrl = await htmlToImage.toPng(receiptEl, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: {
        width: '44mm',
        margin: '0',
        padding: '10px',
      },
    });
  } finally {
    container.remove();
  }
  
  // Build caption text
  const caption = buildWhatsAppCaption(ctx);
  
  // Coba Web Share API (mobile)
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `Struk_${tx.id.slice(-8)}.png`, { type: 'image/png' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Struk Pembelian',
        text: caption,
      });
      return;
    }
  } catch (e) {
    console.log('[Receipt] Web Share API not available, fallback to download + WA Web');
  }
  
  // Fallback: download gambar + buka WhatsApp Web dengan text
  saveAs(dataUrl, `Struk_${tx.id.slice(-8)}.png`);
  
  // Buka WhatsApp dengan caption (user tinggal attach gambar)
  const waUrl = `https://wa.me/?text=${encodeURIComponent(caption)}`;
  window.open(waUrl, '_blank');
}

function buildWhatsAppCaption(ctx: ReceiptContext): string {
  const { transaction: tx, settings } = ctx;
  
  const noteId = tx.id.slice(-8).toUpperCase();
  const time = new Date(tx.timestamp).toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  
  let text = `*STRUK PEMBELIAN*\n`;
  text += `*${settings.storeName}*\n`;
  text += `═══════════════════\n`;
  text += `No: ${noteId}\n`;
  text += `Tgl: ${time}\n`;
  if (tx.customerName) {
    text += `Supplier: ${tx.customerName}\n`;
  }
  text += `───────────────────\n`;
  
  if (tx.items && tx.items.length > 0) {
    for (const item of tx.items) {
      text += `• ${item.productName}\n`;
      text += `  ${gramsToKg(item.qtyGrams)} kg × ${formatRupiah(item.pricePerKg)}\n`;
      text += `  = ${formatRupiah(item.subtotal)}\n`;
    }
  } else {
    text += `${tx.note || '-'}\n`;
  }
  
  text += `───────────────────\n`;
  text += `*TOTAL: ${formatRupiah(tx.amount)}*\n`;
  text += `═══════════════════\n`;
  text += `Terima kasih atas kerja samanya 🙏\n\n`;
  text += `_${OFFICIAL_LABEL}_`;
  
  return text;
}

// ═══════════════════════════════════════════════════════════════
// CSS untuk @media print
// 
// EXPORT ini supaya bisa di-inject ke index.css atau global styles.
// Atau bisa juga langsung paste ke index.css manual di Sesi 8.
// ═══════════════════════════════════════════════════════════════

export const RECEIPT_PRINT_CSS = `
/* Class untuk container yang HANYA tampil saat print */
.receipt-print-only {
  display: none;
}

@media print {
  /* Reset semua di body, hanya tampilkan struk */
  body * {
    visibility: hidden !important;
  }
  
  .receipt-print-only,
  .receipt-print-only * {
    visibility: visible !important;
  }
  
  .receipt-print-only {
    display: block !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
  
  /* Page setup untuk thermal 58mm */
  @page {
    size: 58mm auto;
    margin: 0;
  }
  
  /* Disable semua animasi & transform yang bikin printer bingung */
  * {
    transform: none !important;
    animation: none !important;
    transition: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
  
  /* Reset background biar tidak kena CSS dark mode */
  html, body, #root {
    background: white !important;
    color: black !important;
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: auto !important;
    overflow: visible !important;
  }
  
  /* Override Tailwind classes yang clip print */
  .h-screen, .min-h-screen, .overflow-hidden, .overflow-y-auto {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  
  /* Hide elements dengan class 'no-print' */
  .no-print {
    display: none !important;
  }
}
`.trim();
