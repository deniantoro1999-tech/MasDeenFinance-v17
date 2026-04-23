// ═══════════════════════════════════════════════════════════════
// CustomersModule — CRUD Supplier rongsok
// 
// Fitur:
// - List semua supplier dengan total pembelian
// - Tambah/edit/hapus supplier
// - Lihat riwayat transaksi per supplier
// - Search by nama atau nomor HP
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Users, Plus, Search, X, Edit3, Trash2, Phone, MapPin,
  Package, TrendingUp, UserPlus, StickyNote as NoteIcon,
  ChevronRight,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { formatRupiah, formatWeight } from '../../lib/money';
import { computeCustomerStats } from '../../lib/calculations';
import type { Customer, Transaction } from '../../lib/types';

export interface CustomersModuleProps {
  customers: Customer[];
  transactions: Transaction[];
  onCreateCustomer: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
}

export function CustomersModule({
  customers,
  transactions,
  onCreateCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}: CustomersModuleProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  
  // Filter & enrich customers dengan stats
  const enrichedList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter(c => {
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || 
               (c.phone || '').includes(q);
      })
      .map(c => ({
        ...c,
        stats: computeCustomerStats(transactions, c.id),
      }))
      .sort((a, b) => b.stats.totalAmount - a.stats.totalAmount);
  }, [customers, transactions, search]);
  
  const overallStats = useMemo(() => {
    const total = enrichedList.reduce((sum, c) => sum + c.stats.totalAmount, 0);
    const weight = enrichedList.reduce((sum, c) => sum + c.stats.totalWeight, 0);
    return { 
      customerCount: customers.length,
      total, 
      weight,
    };
  }, [enrichedList, customers.length]);
  
  return (
    <>
      <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="text-[10px] md:text-xs text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
              Pelanggan
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Daftar <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Supplier</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Kelola data pemasok rongsok & riwayat transaksi mereka
            </p>
          </div>
          
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-yellow-600/20"
          >
            <UserPlus size={16} />
            <span className="text-sm">Tambah Supplier</span>
          </button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Users} label="Total Supplier" value={String(overallStats.customerCount)} />
          <StatCard icon={TrendingUp} label="Total Pembelian" value={formatRupiah(overallStats.total)} tone="gold" />
          <StatCard icon={Package} label="Total Berat" value={formatWeight(overallStats.weight)} />
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor HP..."
            className="w-full pl-11 pr-4 py-2.5 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        {/* List */}
        {enrichedList.length === 0 ? (
          <div className="text-center py-16 bg-[#080808]/60 border border-yellow-600/10 rounded-3xl">
            <Users size={40} className="mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500 text-sm">
              {search ? 'Tidak ada supplier yang cocok' : 'Belum ada supplier terdaftar'}
            </p>
            {!search && (
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="mt-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/20 transition-colors"
              >
                + Tambah supplier pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enrichedList.map(c => (
              <CustomerCard
                key={c.id}
                customer={c}
                onClick={() => setDetailCustomer(c)}
                onEdit={() => { setEditing(c); setShowForm(true); }}
                onDelete={() => onDeleteCustomer(c.id)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Form modal */}
      <CustomerFormModal
        isOpen={showForm}
        editing={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSubmit={async (data) => {
          if (editing) {
            await onUpdateCustomer(editing.id, data);
          } else {
            await onCreateCustomer(data);
          }
          setShowForm(false);
          setEditing(null);
        }}
      />
      
      {/* Detail modal */}
      <CustomerDetailModal
        customer={detailCustomer}
        transactions={transactions}
        onClose={() => setDetailCustomer(null)}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function StatCard({ 
  icon: Icon, label, value, tone = 'neutral' 
}: { 
  icon: typeof Users; 
  label: string; 
  value: string; 
  tone?: 'neutral' | 'gold'; 
}) {
  const toneClass = tone === 'gold' 
    ? 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
    : 'bg-blue-600/15 text-blue-400 border-blue-600/20';
  
  return (
    <div className="bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-3 md:p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border mb-2 ${toneClass}`}>
        <Icon size={13} />
      </div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">{label}</div>
      <div className="text-sm md:text-base font-black text-white font-mono">{value}</div>
    </div>
  );
}

interface CustomerCardProps {
  customer: Customer & { stats: { totalAmount: number; totalWeight: number; count: number } };
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CustomerCard({ customer, onClick, onEdit, onDelete }: CustomerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-[#080808]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl overflow-hidden hover:border-yellow-500/40 transition-all"
    >
      <button
        onClick={onClick}
        className="w-full text-left p-4"
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-black text-base flex-shrink-0">
            {customer.name[0].toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate">{customer.name}</div>
            {customer.phone && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Phone size={10} />
                <span className="font-mono truncate">{customer.phone}</span>
              </div>
            )}
          </div>
          
          <ChevronRight size={16} className="text-gray-600 group-hover:text-yellow-500 transition-colors flex-shrink-0" />
        </div>
        
        {/* Stats */}
        {customer.stats.count > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-yellow-600/10">
            <div>
              <div className="text-[9px] text-gray-600 uppercase font-bold">Transaksi</div>
              <div className="text-sm font-bold text-white font-mono">{customer.stats.count}</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-600 uppercase font-bold">Total Beli</div>
              <div className="text-xs font-bold text-yellow-400 font-mono truncate">
                {formatRupiah(customer.stats.totalAmount)}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-gray-600 uppercase font-bold">Berat</div>
              <div className="text-xs font-bold text-white font-mono">
                {formatWeight(customer.stats.totalWeight)}
              </div>
            </div>
          </div>
        )}
      </button>
      
      {/* Actions (hover reveal) */}
      <div className="flex items-center gap-1 px-4 pb-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold"
        >
          <Edit3 size={11} />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold"
        >
          <Trash2 size={11} />
          Hapus
        </button>
      </div>
    </motion.div>
  );
}

// ─── Customer form modal ──────────────────────────────────────

interface CustomerFormModalProps {
  isOpen: boolean;
  editing: Customer | null;
  onClose: () => void;
  onSubmit: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

function CustomerFormModal({ isOpen, editing, onClose, onSubmit }: CustomerFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useMemo(() => {
    if (isOpen) {
      setName(editing?.name || '');
      setPhone(editing?.phone || '');
      setAddress(editing?.address || '');
      setNotes(editing?.notes || '');
      setError('');
    }
  }, [isOpen, editing]);
  
  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Nama wajib diisi');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
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
      title={editing ? 'Edit Supplier' : 'Tambah Supplier Baru'}
      size="md"
    >
      <div className="space-y-4">
        <FormField label="Nama Lengkap *">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Pak Budi"
            className="w-full px-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500"
            autoFocus={!editing}
          />
        </FormField>
        
        <FormField label="Nomor HP (opsional)">
          <div className="relative">
            <Phone size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/60" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full pl-11 pr-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 font-mono"
            />
          </div>
        </FormField>
        
        <FormField label="Alamat (opsional)">
          <div className="relative">
            <MapPin size={13} className="absolute left-4 top-3.5 text-yellow-500/60" />
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat lengkap"
              rows={2}
              className="w-full pl-11 pr-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 resize-none"
            />
          </div>
        </FormField>
        
        <FormField label="Catatan (opsional)">
          <div className="relative">
            <NoteIcon size={13} className="absolute left-4 top-3.5 text-yellow-500/60" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan tentang supplier ini"
              rows={2}
              className="w-full pl-11 pr-4 py-3 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 resize-none"
            />
          </div>
        </FormField>
        
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
            disabled={isSubmitting || !name.trim()}
            className="py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-black rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:from-yellow-300 hover:to-yellow-500"
          >
            {isSubmitting ? 'Menyimpan...' : (editing ? 'Simpan' : 'Tambah')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Customer detail modal (show history) ─────────────────────

interface CustomerDetailModalProps {
  customer: Customer | null;
  transactions: Transaction[];
  onClose: () => void;
}

function CustomerDetailModal({ customer, transactions, onClose }: CustomerDetailModalProps) {
  const customerTxs = useMemo(() => {
    if (!customer) return [];
    return transactions
      .filter(tx => tx.customerId === customer.id && !tx.deletedAt)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [customer, transactions]);
  
  const stats = useMemo(() => {
    if (!customer) return null;
    return computeCustomerStats(transactions, customer.id);
  }, [customer, transactions]);
  
  if (!customer) return null;
  
  return (
    <Modal
      isOpen={!!customer}
      onClose={onClose}
      title="Detail Supplier"
      size="lg"
    >
      {/* Customer info */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-black text-xl flex-shrink-0">
          {customer.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-white">{customer.name}</h3>
          {customer.phone && (
            <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-1 font-mono">
              <Phone size={12} className="text-yellow-500/70" />
              {customer.phone}
            </div>
          )}
          {customer.address && (
            <div className="flex items-start gap-1.5 text-sm text-gray-500 mt-1">
              <MapPin size={12} className="text-yellow-500/70 mt-0.5 flex-shrink-0" />
              <span>{customer.address}</span>
            </div>
          )}
          {customer.notes && (
            <div className="flex items-start gap-1.5 text-sm text-gray-500 mt-1">
              <NoteIcon size={12} className="text-yellow-500/70 mt-0.5 flex-shrink-0" />
              <span className="italic">{customer.notes}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Stats */}
      {stats && stats.count > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-black/40 border border-yellow-600/15 rounded-xl p-3 text-center">
            <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Transaksi</div>
            <div className="text-lg font-black text-white font-mono">{stats.count}</div>
          </div>
          <div className="bg-black/40 border border-yellow-600/15 rounded-xl p-3 text-center">
            <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Total</div>
            <div className="text-sm font-black text-yellow-400 font-mono">
              {formatRupiah(stats.totalAmount)}
            </div>
          </div>
          <div className="bg-black/40 border border-yellow-600/15 rounded-xl p-3 text-center">
            <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Berat</div>
            <div className="text-sm font-black text-white font-mono">
              {formatWeight(stats.totalWeight)}
            </div>
          </div>
        </div>
      )}
      
      {/* History */}
      <div>
        <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">
          Riwayat Transaksi ({customerTxs.length})
        </h4>
        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
          {customerTxs.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              Belum ada transaksi dengan supplier ini
            </div>
          ) : (
            customerTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-black/30 border border-white/5 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {tx.items?.map(i => i.productName).join(', ') || tx.note || '—'}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {new Date(tx.timestamp).toLocaleString('id-ID', { 
                      dateStyle: 'short', 
                      timeStyle: 'short' 
                    })}
                  </div>
                </div>
                <div className="text-sm font-black text-yellow-400 font-mono">
                  {formatRupiah(tx.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
