// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — AI Service (Gemini integration)
// 
// CATATAN KEAMANAN:
// - API key SEHARUSNYA tidak di-expose ke client.
// - Best practice: proxy lewat backend (Express di package.json).
// - Tapi untuk MVP, kita pakai langsung di client dengan env var.
// - Production: migrate ke backend proxy di iterasi berikutnya.
// 
// CATATAN BIAYA:
// - Setiap call = 1 unit quota Gemini.
// - Context built by AIModule sudah optimized (ringkas data penting saja).
// - Kalau quota abis, tampilkan fallback friendly.
// ═══════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import type { ChatMessage } from '../components/modules/AIModule';

// ───────────────────────────────────────────────────────────────
// MODEL CONFIGURATION
// ───────────────────────────────────────────────────────────────

export const AI_MODELS = {
  FLASH: 'gemini-2.5-flash',     // Cepat & murah (default)
  PRO: 'gemini-2.5-pro',         // Lebih pintar tapi lebih lambat
} as const;

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];

// ───────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
Anda adalah MasDeen AI, asisten keuangan pintar untuk toko rongsok CV. Timika Jaya Sejahtera.

TUGAS ANDA:
- Menganalisis data keuangan toko rongsok dan memberikan insight yang berguna
- Menjawab dalam Bahasa Indonesia yang hangat dan profesional
- Memberikan saran bisnis yang praktis dan realistis
- Menggunakan data yang disediakan sebagai satu-satunya sumber kebenaran

GAYA JAWABAN:
- Singkat dan to-the-point (maksimal 3-4 paragraf pendek)
- Gunakan angka spesifik dari data (bukan perkiraan samar)
- Pakai format Markdown untuk readability (bold, list, headings)
- Kalau ada angka rupiah, format dengan pemisah titik (Rp 1.250.000)
- Kalau data tidak cukup untuk menjawab, katakan dengan jujur

JANGAN:
- Mengarang data yang tidak ada di context
- Memberikan saran investasi spesifik atau nasihat hukum/pajak detail
- Bersikap terlalu optimis atau terlalu pesimis tanpa dasar data
- Menjawab di luar topik keuangan/bisnis toko ini

Contoh jawaban yang baik:
**Performa bulan ini lebih baik 12% dibanding bulan lalu.**
Total pembelian Rp 15.500.000 (vs Rp 13.850.000 bulan lalu). Yang mendorong kenaikan:
- Peningkatan pembelian besi super (+30%)
- Supplier baru Pak Agus (kontribusi Rp 2.1 juta)

Saran: pertahankan hubungan dengan supplier baru, dan coba promosi khusus untuk kuningan yang pembeliannya turun.
`.trim();

// ───────────────────────────────────────────────────────────────
// SERVICE
// ───────────────────────────────────────────────────────────────

export interface AIServiceConfig {
  apiKey: string;
  model?: AIModel;
}

export class AIService {
  private client: GoogleGenAI | null = null;
  private model: AIModel;
  private _isAvailable: boolean = false;
  
  constructor(config?: AIServiceConfig) {
    this.model = config?.model || AI_MODELS.FLASH;
    
    if (config?.apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this._isAvailable = true;
      } catch (e) {
        console.warn('[AI] Failed to initialize Gemini:', e);
        this._isAvailable = false;
      }
    } else {
      console.warn('[AI] No API key provided. AI features disabled.');
      this._isAvailable = false;
    }
  }
  
  get isAvailable(): boolean {
    return this._isAvailable;
  }
  
  setModel(model: AIModel): void {
    this.model = model;
  }
  
  /**
   * Kirim chat message dengan context data keuangan.
   * 
   * @param userMessage - Pertanyaan user
   * @param context - Ringkasan data keuangan (dibuild oleh AIModule)
   * @param history - Riwayat chat sebelumnya (untuk conversational memory)
   * @returns Jawaban AI dalam bentuk string (bisa mengandung Markdown)
   */
  async ask(
    userMessage: string,
    context: string,
    history: ChatMessage[] = []
  ): Promise<string> {
    if (!this.client) {
      throw new Error('AI service tidak tersedia. API key belum dikonfigurasi.');
    }
    
    // Build conversation history untuk Gemini
    // Format: array of { role, parts: [{ text }] }
    const contents = [];
    
    // System instruction + context
    contents.push({
      role: 'user',
      parts: [{
        text: `${SYSTEM_PROMPT}\n\n---\n\n${context}\n\n---\n\nJawab pertanyaan berikut berdasarkan data di atas.`,
      }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Siap, saya akan menjawab berdasarkan data keuangan yang Anda berikan.' }],
    });
    
    // History chat (max 10 pesan terakhir untuk hemat token)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
    
    // Current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });
    
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });
      
      const text = response.text;
      if (!text) {
        throw new Error('AI tidak memberikan jawaban. Coba rumuskan ulang pertanyaan.');
      }
      
      return text;
    } catch (e: any) {
      // Specific error handling
      if (e?.message?.includes('API_KEY')) {
        throw new Error('API key Gemini tidak valid. Periksa konfigurasi.');
      }
      if (e?.message?.includes('quota') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error('Kuota AI hari ini sudah habis. Silakan coba lagi besok atau hubungi admin.');
      }
      if (e?.message?.includes('SAFETY')) {
        throw new Error('Pertanyaan diblokir oleh safety filter. Coba rumuskan ulang.');
      }
      
      console.error('[AI] Error:', e);
      throw new Error(e?.message || 'Terjadi error saat memanggil AI. Coba lagi.');
    }
  }
  
  /**
   * Fetch financial news singkat (untuk notifikasi dashboard).
   * Fallback kalau gagal: data hardcoded.
   */
  async fetchFinancialNews(): Promise<Array<{ id: string; title: string; message: string }>> {
    if (!this.client) {
      return this._fallbackNews();
    }
    
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{
          role: 'user',
          parts: [{
            text: 'Berikan 3 berita singkat terkini mengenai ekonomi dan keuangan di Indonesia dalam format JSON array of objects dengan properti: id (string), title (string), message (string singkat max 120 karakter). Output HANYA JSON, tanpa markdown atau teks lain.',
          }],
        }],
        config: {
          temperature: 0.5,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      });
      
      const text = response.text?.trim() || '[]';
      // Strip potential markdown fences
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (!Array.isArray(parsed)) return this._fallbackNews();
      
      return parsed.slice(0, 3).map((item: any, i: number) => ({
        id: item.id || `news-${i}`,
        title: String(item.title || 'Berita').slice(0, 100),
        message: String(item.message || '').slice(0, 200),
      }));
    } catch (e) {
      console.warn('[AI] Failed to fetch news, using fallback:', e);
      return this._fallbackNews();
    }
  }
  
  private _fallbackNews() {
    return [
      {
        id: 'fallback-1',
        title: 'Industri Daur Ulang Indonesia',
        message: 'Permintaan logam bekas tetap tinggi, harga besi tua stabil di kisaran Rp 5-6 ribu per kg.',
      },
      {
        id: 'fallback-2',
        title: 'UMKM Digital',
        message: 'Pemerintah dorong UMKM catat keuangan digital untuk akses pembiayaan lebih mudah.',
      },
      {
        id: 'fallback-3',
        title: 'Kurs Rupiah',
        message: 'Rupiah menguat terhadap dolar AS, berdampak positif untuk industri ekspor.',
      },
    ];
  }
}

// ───────────────────────────────────────────────────────────────
// FACTORY
// ───────────────────────────────────────────────────────────────

let _instance: AIService | null = null;

/**
 * Dapatkan singleton AI service.
 * Baca API key dari environment variable.
 */
export function getAIService(): AIService {
  if (!_instance) {
    // Di Vite, env var diakses via import.meta.env
    const apiKey = 
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      '';
    
    _instance = new AIService(apiKey ? { apiKey } : undefined);
  }
  return _instance;
}
