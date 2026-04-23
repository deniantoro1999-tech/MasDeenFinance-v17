// ═══════════════════════════════════════════════════════════════
// NotesModule — Catatan dengan kategori & warna
// 
// Fitur:
// - Tambah/edit/hapus catatan
// - 4 kategori: Umum, Keuangan, Tugas Penting, Ide Bisnis
// - 5 warna card untuk visual organization
// - Search by judul/isi
// - Filter by kategori
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  StickyNote, Plus, Search, X, Edit3, Trash2, Calendar,
  Filter,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { Note, NoteCategory } from '../../lib/types';

export interface NotesModuleProps {
  notes: Note[];
  onCreateNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

const CATEGORIES: NoteCategory[] = ['Umum', 'Keuangan', 'Tugas Penting', 'Ide Bisnis'];
const ALL_CATEGORIES = ['Semua', ...CATEGORIES] as const;
type FilterCategory = typeof ALL_CATEGORIES[number];

const COLORS = [
  { value: '#1a1a1a', label: 'Hitam',  classes: 'bg-neutral-900 border-neutral-700' },
  { value: '#1e3a8a', label: 'Biru',   classes: 'bg-blue-950 border-blue-800' },
  { value: '#14532d', label: 'Hijau',  classes: 'bg-emerald-950 border-emerald-800' },
  { value: '#713f12', label: 'Emas',   classes: 'bg-yellow-950 border-yellow-800' },
  { value: '#701a75', label: 'Ungu',   classes: 'bg-fuchsia-950 border-fuchsia-800' },
];

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  'Umum': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  'Keuangan': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Tugas Penting': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Ide Bisnis': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

export function NotesModule({
  notes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: NotesModuleProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FilterCategory>('Semua');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter(n => {
      const matchCat = category === 'Semua' || n.category === category;
      const matchSearch = !q || 
        n.title.toLowerCase().includes(q) || 
        n.content.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [notes, search, category]);
  
  return (
    <>
      <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
              Catatan
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Memo & <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Ide</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {notes.length} catatan · {filtered.length} ditampilkan
            </p>
          </div>
          
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-yellow-600/20"
          >
            <Plus size={16} />
            <span className="text-sm">Tambah Catatan</span>
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Category filter */}
          <div className="flex gap-1 p-1 bg-black/40 border border-yellow-600/15 rounded-xl overflow-x-auto">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  category === cat
                    ? 'bg-yellow-500 text-black'
                    : 'text-gray-500 hover:text-yellow-500'
                }`}
              >
                {cat}
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
              placeholder="Cari catatan..."
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
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#080808]/60 border border-yellow-600/10 rounded-3xl">
            <StickyNote size={40} className="mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500 text-sm">
              {notes.length === 0 
                ? 'Belum ada catatan' 
                : 'Tidak ada yang cocok dengan filter'
              }
            </p>
            {notes.length === 0 && (
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="mt-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/20 transition-colors"
              >
                + Buat catatan pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {filtered.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={() => { setEditing(note); setShowForm(true); }}
                  onDelete={() => onDeleteNote(note.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {/* Form modal */}
      <NoteFormModal
        isOpen={showForm}
        editing={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSubmit={async (data) => {
          if (editing) {
            await onUpdateNote(editing.id, data);
          } else {
            await onCreateNote(data);
          }
          setShowForm(false);
          setEditing(null);
        }}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = new Date(note.updatedAt || note.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  
  const categoryClass = CATEGORY_COLORS[note.category] || CATEGORY_COLORS['Umum'];
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative rounded-2xl overflow-hidden transition-all hover:shadow-xl hover:shadow-yellow-900/10"
      style={{
        backgroundColor: note.color || '#1a1a1a',
        borderWidth: '1px',
        borderColor: 'rgba(234, 179, 8, 0.15)',
        borderStyle: 'solid',
      }}
    >
      <div className="p-4">
        {/* Category badge */}
        <div className="flex items-center justify-between mb-2">
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-wider ${categoryClass}`}>
            {note.category}
          </span>
          <span className="text-[9px] text-gray-500 font-mono flex items-center gap-1">
            <Calendar size={9} />
            {date}
          </span>
        </div>
        
        {/* Title */}
        <h3 className="font-bold text-white text-base mb-1.5 leading-snug line-clamp-2">
          {note.title}
        </h3>
        
        {/* Content preview */}
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4 mb-3">
          {note.content}
        </p>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold"
          >
            <Edit3 size={11} />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────

interface NoteFormModalProps {
  isOpen: boolean;
  editing: Note | null;
  onClose: () => void;
  onSubmit: (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

function NoteFormModal({ isOpen, editing, onClose, onSubmit }: NoteFormModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('Umum');
  const [color, setColor] = useState(COLORS[0].value);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useMemo(() => {
    if (isOpen) {
      setTitle(editing?.title || '');
      setContent(editing?.content || '');
      setNoteCategory(editing?.category || 'Umum');
      setColor(editing?.color || COLORS[0].value);
      setError('');
    }
  }, [isOpen, editing]);
  
  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) {
      setError('Judul catatan wajib diisi');
      return;
    }
    if (!content.trim()) {
      setError('Isi catatan wajib diisi');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        category: noteCategory,
        color,
      });
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
      title={editing ? 'Edit Catatan' : 'Catatan Baru'}
      size="md"
    >
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Judul *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul singkat"
            className="w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500"
            autoFocus={!editing}
            maxLength={100}
          />
        </div>
        
        {/* Content */}
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Isi Catatan *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis catatan di sini..."
            rows={6}
            className="w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 resize-none font-mono text-sm"
            maxLength={2000}
          />
          <div className="text-[9px] text-gray-600 text-right mt-1">
            {content.length}/2000
          </div>
        </div>
        
        {/* Category */}
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Kategori
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setNoteCategory(cat)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                  noteCategory === cat
                    ? CATEGORY_COLORS[cat].replace('/20', '/30').replace('/30', '/60')
                    : 'bg-black/30 border-white/10 text-gray-500 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        
        {/* Color picker */}
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
            Warna Card
          </label>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={`w-10 h-10 rounded-xl border-2 transition-all ${
                  color === c.value
                    ? 'border-yellow-400 scale-110 shadow-lg shadow-yellow-500/20'
                    : 'border-white/10 hover:border-white/30'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10 disabled:opacity-40"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-black rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:from-yellow-300 hover:to-yellow-500"
          >
            {isSubmitting ? 'Menyimpan...' : (editing ? 'Simpan' : 'Tambah')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
