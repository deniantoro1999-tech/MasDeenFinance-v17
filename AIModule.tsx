// ═══════════════════════════════════════════════════════════════
// AIModule — MasDeen AI Assistant (powered by Gemini)
// 
// Fitur:
// - Chat dengan AI tentang data keuangan toko
// - AI punya konteks: transaksi hari ini, minggu ini, bulan ini
// - Suggested questions (quick prompts)
// - Streaming response (kalau supported)
// - History chat persist di session (tidak di DB, supaya privasi)
// 
// CATATAN: Integrasi Gemini real ada di ai-service.ts.
// Komponen ini hanya UI — logika call API di service.
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Send, Loader2, User, Bot, Lightbulb,
  TrendingUp, BarChart3, Clock, AlertCircle, RefreshCw,
  MessageSquare, Wand2,
} from 'lucide-react';
import Markdown from 'react-markdown';
import {
  computeDailySnapshot, computePeriodSummary,
  todayBusinessDate, prevBusinessDate,
} from '../../lib/calculations';
import { formatRupiah, formatWeight } from '../../lib/money';
import type { Transaction } from '../../lib/types';

// ───────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  error?: boolean;
}

export interface AIModuleProps {
  transactions: Transaction[];
  storeName: string;
  /** Callback untuk kirim pertanyaan ke AI. Kembalikan jawaban string atau stream. */
  onAskAI: (
    userMessage: string, 
    context: string,
    history: ChatMessage[]
  ) => Promise<string>;
  /** Tampilkan indikator kalau AI tidak tersedia (API key belum diset) */
  isAIAvailable?: boolean;
}

// ───────────────────────────────────────────────────────────────
// SUGGESTED QUESTIONS
// ───────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  {
    icon: TrendingUp,
    text: 'Bagaimana performa toko bulan ini dibanding bulan lalu?',
    color: 'text-emerald-400',
  },
  {
    icon: BarChart3,
    text: 'Barang apa yang paling banyak dibeli minggu ini?',
    color: 'text-yellow-400',
  },
  {
    icon: Lightbulb,
    text: 'Apa saran untuk meningkatkan arus kas?',
    color: 'text-blue-400',
  },
  {
    icon: AlertCircle,
    text: 'Apakah ada pola pengeluaran yang perlu diperhatikan?',
    color: 'text-orange-400',
  },
];

// ───────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ───────────────────────────────────────────────────────────────

export function AIModule({ transactions, storeName, onAskAI, isAIAvailable = true }: AIModuleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-scroll ke bawah saat ada pesan baru
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
  // ─── Build context untuk AI ──────────────────────────────────
  // Berikan AI ringkasan data keuangan supaya jawaban relevan
  const context = useMemo(() => {
    const today = todayBusinessDate();
    
    // Hari ini
    const todaySnap = computeDailySnapshot(transactions, today);
    
    // 7 hari terakhir
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekSummary = computePeriodSummary(transactions, weekStartStr, today);
    
    // 30 hari terakhir
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 29);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthSummary = computePeriodSummary(transactions, monthStartStr, today);
    
    // Kemarin untuk perbandingan
    const yesterday = prevBusinessDate(today);
    const yesterdaySnap = computeDailySnapshot(transactions, yesterday);
    
    return `
RINGKASAN DATA KEUANGAN ${storeName}:

HARI INI (${today}):
- Modal Awal: ${formatRupiah(todaySnap.openingBalance)}
- Pembelian: ${formatRupiah(todaySnap.totalPurchase)} (${todaySnap.purchaseCount} transaksi)
- Biaya Operasional: ${formatRupiah(todaySnap.totalExpense)}
- Injeksi Modal: ${formatRupiah(todaySnap.capitalInjection)}
- Sisa Kas: ${formatRupiah(todaySnap.sisaKas)}
- Total Berat Dibeli: ${formatWeight(todaySnap.totalWeightGrams)}

KEMARIN (${yesterday}):
- Pembelian: ${formatRupiah(yesterdaySnap.totalPurchase)}
- Biaya: ${formatRupiah(yesterdaySnap.totalExpense)}
- Sisa Kas: ${formatRupiah(yesterdaySnap.sisaKas)}

7 HARI TERAKHIR:
- Total Pembelian: ${formatRupiah(weekSummary.totalPurchase)}
- Total Biaya: ${formatRupiah(weekSummary.totalExpense)}
- Total Berat: ${formatWeight(weekSummary.totalWeightGrams)}
- Jumlah Transaksi Pembelian: ${weekSummary.purchaseCount}

30 HARI TERAKHIR:
- Total Pembelian: ${formatRupiah(monthSummary.totalPurchase)}
- Total Biaya: ${formatRupiah(monthSummary.totalExpense)}
- Total Injeksi Modal: ${formatRupiah(monthSummary.totalCapitalInjection)}
- Rata-rata Pembelian per Hari: ${formatRupiah(Math.round(monthSummary.totalPurchase / 30))}
- Total Berat Dibeli: ${formatWeight(monthSummary.totalWeightGrams)}
    `.trim();
  }, [transactions, storeName]);
  
  // ─── Kirim pertanyaan ───────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await onAskAI(trimmed, context, messages);
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-e`,
        role: 'assistant',
        content: err instanceof Error 
          ? `Maaf, terjadi error: ${err.message}. Coba lagi sebentar.`
          : 'Maaf, AI sedang tidak tersedia. Coba lagi sebentar.',
        timestamp: new Date().toISOString(),
        error: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter untuk kirim, Shift+Enter untuk newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };
  
  const clearChat = () => {
    setMessages([]);
  };
  
  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-screen max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-yellow-600/15 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/30 to-yellow-700/30 rounded-full blur-md" />
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-b from-[#0a0a0a] to-black border border-yellow-500/40 flex items-center justify-center">
              <Sparkles size={18} className="text-yellow-400" />
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
              MasDeen <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">AI</span>
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Powered by Gemini
            </p>
          </div>
        </div>
        
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/5 rounded-lg transition-colors"
          >
            <RefreshCw size={11} />
            Chat Baru
          </button>
        )}
      </div>
      
      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6"
      >
        {messages.length === 0 ? (
          <EmptyState
            isAvailable={isAIAvailable}
            onQuickAsk={sendMessage}
          />
        ) : (
          <div className="space-y-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <LoadingBubble />}
          </div>
        )}
      </div>
      
      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="p-3 md:p-4 border-t border-yellow-600/15 bg-[#050505]/80 backdrop-blur flex-shrink-0"
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAIAvailable ? 'Tanyakan apa saja tentang keuangan toko...' : 'AI tidak tersedia'}
              disabled={isLoading || !isAIAvailable}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-black/40 border border-yellow-600/20 rounded-2xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 resize-none disabled:opacity-50 text-sm max-h-32"
              style={{ minHeight: '44px' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isAIAvailable}
            className="w-11 h-11 flex items-center justify-center bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-yellow-600/20 flex-shrink-0"
            aria-label="Kirim"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <p className="text-[9px] text-gray-600 mt-2 text-center">
          💡 AI menjawab berdasarkan data keuangan toko. Tekan Enter untuk kirim, Shift+Enter untuk baris baru.
        </p>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function EmptyState({
  isAvailable,
  onQuickAsk,
}: {
  isAvailable: boolean;
  onQuickAsk: (q: string) => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="relative w-20 h-20 mb-6"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/40 to-yellow-700/40 rounded-full blur-xl animate-pulse" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-b from-[#0a0a0a] to-black border-2 border-yellow-500/40 flex items-center justify-center">
          <Sparkles size={32} className="text-yellow-400" />
        </div>
      </motion.div>
      
      <h2 className="text-xl md:text-2xl font-black text-white mb-2">
        Halo! Saya MasDeen AI
      </h2>
      <p className="text-sm text-gray-400 max-w-md mb-8">
        Asisten pintar untuk menganalisis keuangan toko Anda. 
        Tanyakan apa saja tentang pembelian, pengeluaran, atau tren bisnis.
      </p>
      
      {!isAvailable && (
        <div className="mb-6 p-3 bg-red-950/30 border border-red-500/30 rounded-xl max-w-md">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-xs font-bold text-red-300 mb-1">AI Belum Tersedia</p>
              <p className="text-[11px] text-red-300/80">
                API key Gemini belum dikonfigurasi. Hubungi developer atau 
                setup di environment variables.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isAvailable && (
        <>
          <div className="flex items-center gap-2 text-[10px] text-yellow-500/70 uppercase tracking-widest font-bold mb-3">
            <Wand2 size={11} />
            Coba Tanyakan
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl w-full">
            {SUGGESTED_QUESTIONS.map((q, i) => {
              const Icon = q.icon;
              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onQuickAsk(q.text)}
                  className="flex items-start gap-3 p-3 bg-[#0a0a0a]/80 border border-yellow-600/15 rounded-xl hover:border-yellow-500/40 hover:bg-yellow-500/5 transition-all text-left"
                >
                  <Icon size={14} className={`${q.color} flex-shrink-0 mt-0.5`} />
                  <span className="text-xs text-gray-300 leading-relaxed">
                    {q.text}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  
  const time = new Date(message.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser 
          ? 'bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10'
          : 'bg-gradient-to-br from-yellow-500 to-yellow-700 border border-yellow-400/40'
      }`}>
        {isUser ? <User size={14} className="text-gray-300" /> : <Bot size={14} className="text-black" />}
      </div>
      
      {/* Bubble */}
      <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 text-white'
            : message.error
              ? 'bg-red-950/30 border border-red-500/30 text-red-200'
              : 'bg-[#0a0a0a]/80 border border-white/10 text-gray-200'
        }`}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none 
                          prose-headings:text-yellow-400 prose-headings:font-bold 
                          prose-p:text-gray-200 prose-p:leading-relaxed
                          prose-strong:text-white prose-strong:font-bold
                          prose-a:text-yellow-400
                          prose-code:text-yellow-300 prose-code:bg-black/40 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px]
                          prose-pre:bg-black/60 prose-pre:border prose-pre:border-yellow-600/20
                          prose-ul:text-gray-200 prose-li:text-gray-200 prose-li:my-0.5
                          prose-ol:text-gray-200">
              <Markdown>{message.content}</Markdown>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <Clock size={9} className="text-gray-600" />
          <span className="text-[9px] text-gray-600 font-mono">{time}</span>
        </div>
      </div>
    </motion.div>
  );
}

function LoadingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 border border-yellow-400/40 flex items-center justify-center flex-shrink-0">
        <Bot size={14} className="text-black" />
      </div>
      <div className="bg-[#0a0a0a]/80 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-gray-500">MasDeen AI sedang berpikir...</span>
      </div>
    </motion.div>
  );
}
