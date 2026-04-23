// ═══════════════════════════════════════════════════════════════
// POSModule — Kasir / Point of Sale (mode BELI saja)
// 
// Layout:
// - Desktop (md+): Split pane 65% katalog | 35% cart (sticky)
// - Mobile: Katalog scroll, cart sticky di bawah (tapi di atas bottom nav)
// 
// Flow:
// 1. User pilih customer (opsional)
// 2. Klik produk dari katalog → masuk cart (default 1 kg)
// 3. Edit qty (dengan inline calculator: "10+5.5" → 15.5)
// 4. Edit harga per kg (kalau beda dari default katalog)
// 5. Tekan Bayar → transaksi tercatat di Firestore
// 6. Opsi: cetak struk, PDF, WhatsApp
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart, Plus, Minus, Trash2, User, X, Check, 
  Package, Loader2, Printer, FileDown, Share2, Receipt,
  ShoppingBag, UserPlus, ChevronDown, Search, Calculator,
} from 'lucide-react';
import { QtyInput } from '../ui/QtyInput';
import { MoneyInput } from '../ui/MoneyInput';
import { Modal } from '../ui/Modal';
import { formatRupiah, formatWeight, calcSubtotal, kgToGrams, toRupiah } from '../../lib/money';
import type {
  Product, Customer, TransactionItem, Rupiah, Gram,
} from '../../lib/types';

// ───────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────

/**
 * CartItem = TransactionItem + UI tracking (unique cart ID supaya
 * bisa ada produk sama 2x di cart tapi dengan harga berbeda)
 */
interface CartItem extends TransactionItem {
  cartId: string;
}

export interface POSModuleProps {
  products: Product[];
  customers: Customer[];
  onCheckout: (items: TransactionItem[], customerId: string | null, customerName: string | null) => Promise<string | null>;
  onAddCustomer?: () => void;
}

export function POSModule({ products, customers, onCheckout, onAddCustomer }: POSModuleProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  
  // ─── Filter produk berdasarkan search ─────────────────────────
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const active = products.filter(p => !p.archived);
    if (!q) return active;
    return active.filter(p => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);
  
  // ─── Cart totals (derived, pakai integer math) ────────────────
  const cartTotals = useMemo(() => {
    let totalAmount = 0;
    let totalWeight = 0;
    for (const item of cart) {
      totalAmount += item.subtotal;
      totalWeight += item.qtyGrams;
    }
    return { 
      total: toRupiah(totalAmount), 
      totalWeight: totalWeight as Gram,
      count: cart.length,
    };
  }, [cart]);
  
  // ─── Cart mutations ───────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    // Default qty = 1 kg
    const defaultQty = kgToGrams(1);
    const newItem: CartItem = {
      cartId: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      productName: product.name,
      pricePerKg: product.pricePerKg,
      qtyGrams: defaultQty,
      subtotal: calcSubtotal(defaultQty, product.pricePerKg),
    };
    setCart(prev => [...prev, newItem]);
  }, []);
  
  const updateQty = useCallback((cartId: string, qtyGrams: Gram) => {
    setCart(prev => prev.map(item => {
      if (item.cartId !== cartId) return item;
      return {
        ...item,
        qtyGrams,
        subtotal: calcSubtotal(qtyGrams, item.pricePerKg),
      };
    }));
  }, []);
  
  const updatePrice = useCallback((cartId: string, pricePerKg: Rupiah) => {
    setCart(prev => prev.map(item => {
      if (item.cartId !== cartId) return item;
      return {
        ...item,
        pricePerKg,
        subtotal: calcSubtotal(item.qtyGrams, pricePerKg),
      };
    }));
  }, []);
  
  const removeItem = useCallback((cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  }, []);
  
  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
  }, []);
  
  // ─── Checkout ─────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    
    // Validasi: semua item harus punya qty > 0
    const invalid = cart.find(item => item.qtyGrams <= 0);
    if (invalid) {
      alert(`Qty tidak valid untuk ${invalid.productName}`);
      return;
    }
    
    setIsProcessing(true);
    try {
      // Strip cartId sebelum kirim ke service
      const items: TransactionItem[] = cart.map(({ cartId, ...rest }) => rest);
      const txId = await onCheckout(
        items, 
        selectedCustomer?.id || null,
        selectedCustomer?.name || null
      );
      
      if (txId) {
        setLastTransactionId(txId);
        setCart([]);
        setSelectedCustomer(null);
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      alert('Gagal memproses transaksi. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // ─── RENDER ───────────────────────────────────────────────────
  return (
    <>
      <div className="md:grid md:grid-cols-[65fr_35fr] md:min-h-screen">
        {/* ═══════ KATALOG (kiri di desktop, atas di mobile) ═══════ */}
        <section className="p-4 md:p-6 md:overflow-y-auto md:max-h-screen custom-scrollbar">
          {/* Header */}
          <div className="mb-4">
            <div className="text-[10px] text-yellow-500/70 uppercase tracking-[0.3em] font-bold mb-1">
              Kasir POS
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4">
              Pilih <span className="bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 bg-clip-text text-transparent">Barang</span>
            </h1>
            
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/50 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari barang..."
                className="w-full pl-11 pr-4 py-2.5 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 transition-colors text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          
          {/* Grid produk */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {products.length === 0 
                  ? 'Belum ada produk. Tambahkan di menu Pengaturan.' 
                  : 'Tidak ada produk yang cocok'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </section>
        
        {/* ═══════ CART (kanan di desktop, sticky bottom di mobile) ═══════ */}
        {/* Desktop version */}
        <aside className="hidden md:flex md:flex-col bg-[#080808] border-l border-yellow-600/20 md:h-screen md:sticky md:top-0">
          <CartContent
            cart={cart}
            cartTotals={cartTotals}
            selectedCustomer={selectedCustomer}
            isProcessing={isProcessing}
            onUpdateQty={updateQty}
            onUpdatePrice={updatePrice}
            onRemoveItem={removeItem}
            onOpenCustomerPicker={() => setShowCustomerPicker(true)}
            onClearCustomer={() => setSelectedCustomer(null)}
            onCheckout={handleCheckout}
            onClearCart={clearCart}
          />
        </aside>
        
        {/* Mobile version: sticky dari bawah, di atas bottom nav */}
        <MobileCartDrawer
          cart={cart}
          cartTotals={cartTotals}
          selectedCustomer={selectedCustomer}
          isProcessing={isProcessing}
          onUpdateQty={updateQty}
          onUpdatePrice={updatePrice}
          onRemoveItem={removeItem}
          onOpenCustomerPicker={() => setShowCustomerPicker(true)}
          onClearCustomer={() => setSelectedCustomer(null)}
          onCheckout={handleCheckout}
          onClearCart={clearCart}
        />
      </div>
      
      {/* Customer picker modal */}
      <CustomerPickerModal
        isOpen={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        customers={customers}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setShowCustomerPicker(false);
        }}
        onAddNew={onAddCustomer}
      />
      
      {/* Success modal setelah checkout */}
      <SuccessModal
        isOpen={!!lastTransactionId}
        transactionId={lastTransactionId || ''}
        onClose={() => setLastTransactionId(null)}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="group bg-[#0a0a0a]/80 backdrop-blur-xl border border-yellow-600/15 rounded-2xl p-3 md:p-4 text-left hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all relative overflow-hidden"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/0 to-yellow-600/0 group-hover:from-yellow-600/10 group-hover:to-transparent transition-all" />
      
      <div className="relative">
        <div className="text-2xl md:text-3xl mb-2">{product.icon || '📦'}</div>
        <div className="font-bold text-white text-sm md:text-[13px] truncate mb-1">
          {product.name}
        </div>
        <div className="text-[10px] md:text-xs text-yellow-500 font-mono font-semibold">
          {formatRupiah(product.pricePerKg)}/kg
        </div>
      </div>
      
      {/* + badge at corner */}
      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Plus size={10} className="text-yellow-400" />
      </div>
    </motion.button>
  );
}

// ─── Cart Content (shared desktop & mobile) ────────────────────

interface CartContentProps {
  cart: CartItem[];
  cartTotals: { total: Rupiah; totalWeight: Gram; count: number };
  selectedCustomer: Customer | null;
  isProcessing: boolean;
  onUpdateQty: (cartId: string, qtyGrams: Gram) => void;
  onUpdatePrice: (cartId: string, pricePerKg: Rupiah) => void;
  onRemoveItem: (cartId: string) => void;
  onOpenCustomerPicker: () => void;
  onClearCustomer: () => void;
  onCheckout: () => void;
  onClearCart: () => void;
}

function CartContent(props: CartContentProps) {
  const {
    cart, cartTotals, selectedCustomer, isProcessing,
    onUpdateQty, onUpdatePrice, onRemoveItem,
    onOpenCustomerPicker, onClearCustomer, onCheckout, onClearCart,
  } = props;
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-yellow-600/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-yellow-400" />
            <h3 className="font-black text-yellow-400 text-sm uppercase tracking-wider">
              Keranjang Beli
            </h3>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {cart.length} item
          </span>
        </div>
        
        {/* Customer selector */}
        <button
          onClick={onOpenCustomerPicker}
          className="w-full mt-3 flex items-center justify-between px-3 py-2 bg-black/40 border border-yellow-600/20 rounded-xl text-left hover:border-yellow-500/40 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <User size={13} className="text-yellow-500/60 flex-shrink-0" />
            <span className="text-xs text-white truncate">
              {selectedCustomer?.name || 'Pilih Supplier (opsional)'}
            </span>
          </div>
          {selectedCustomer ? (
            <button
              onClick={(e) => { e.stopPropagation(); onClearCustomer(); }}
              className="text-gray-500 hover:text-red-400 flex-shrink-0 ml-2"
            >
              <X size={12} />
            </button>
          ) : (
            <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
          )}
        </button>
      </div>
      
      {/* Items list (scrollable) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 space-y-2">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Keranjang kosong</p>
            <p className="text-[11px] text-gray-600 mt-1">Tap produk di kiri untuk menambahkan</p>
          </div>
        ) : (
          <AnimatePresence>
            {cart.map(item => (
              <CartItemCard
                key={item.cartId}
                item={item}
                onUpdateQty={onUpdateQty}
                onUpdatePrice={onUpdatePrice}
                onRemove={onRemoveItem}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
      
      {/* Footer total & checkout */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-yellow-600/15 bg-[#050505]">
          {/* Summary */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Total Berat</span>
              <span className="font-mono">{formatWeight(cartTotals.totalWeight)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Jumlah Item</span>
              <span className="font-mono">{cartTotals.count} item</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-yellow-600/10">
              <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Bayar</span>
              <span className="text-xl font-black text-yellow-400 font-mono" style={{ textShadow: '0 0 10px rgba(234, 179, 8, 0.3)' }}>
                {formatRupiah(cartTotals.total)}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={onCheckout}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-yellow-600/20 text-sm"
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Bayar
            </button>
            <button
              onClick={onClearCart}
              disabled={isProcessing}
              className="px-3 py-3 bg-red-950/40 border border-red-600/20 hover:bg-red-950/60 text-red-400 rounded-xl transition-all disabled:opacity-40"
              title="Kosongkan keranjang"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mobile cart drawer (sticky bottom) ────────────────────────

function MobileCartDrawer(props: CartContentProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Kalau cart kosong, jangan tampilkan
  if (props.cart.length === 0) return null;
  
  return (
    <div className="md:hidden fixed bottom-16 left-0 right-0 bg-[#080808] border-t border-yellow-600/30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-30">
      {/* Collapsed summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart size={18} className="text-yellow-400" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 text-black rounded-full flex items-center justify-center text-[9px] font-black">
              {props.cart.length}
            </span>
          </div>
          <span className="text-xs text-gray-400">Keranjang</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-black text-yellow-400 font-mono">
            {formatRupiah(props.cartTotals.total)}
          </span>
          <ChevronDown size={14} className={`text-yellow-500/60 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-yellow-600/15"
          >
            <div className="max-h-[60vh] overflow-y-auto">
              <CartContent {...props} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Cart item card dengan QtyInput inline calculator ──────────

interface CartItemCardProps {
  item: CartItem;
  onUpdateQty: (cartId: string, qtyGrams: Gram) => void;
  onUpdatePrice: (cartId: string, pricePerKg: Rupiah) => void;
  onRemove: (cartId: string) => void;
}

function CartItemCard({ item, onUpdateQty, onUpdatePrice, onRemove }: CartItemCardProps) {
  const [editingPrice, setEditingPrice] = useState(false);
  
  const decrement = () => {
    // Kurang 0.5 kg (500 gram), minimal 0
    const newQty = Math.max(0, item.qtyGrams - 500) as Gram;
    onUpdateQty(item.cartId, newQty);
  };
  
  const increment = () => {
    // Tambah 0.5 kg
    const newQty = (item.qtyGrams + 500) as Gram;
    onUpdateQty(item.cartId, newQty);
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.2 }}
      className="bg-[#0a0a0a]/60 border border-yellow-600/15 rounded-2xl p-3"
    >
      {/* Top: name + remove */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">
            {item.productName}
          </div>
          <button
            onClick={() => setEditingPrice(!editingPrice)}
            className="text-[10px] text-yellow-500/80 hover:text-yellow-400 font-mono flex items-center gap-1 mt-0.5"
          >
            {formatRupiah(item.pricePerKg)}/kg
            <span className="text-[8px] opacity-60">{editingPrice ? '(tutup)' : '(ubah)'}</span>
          </button>
        </div>
        <button
          onClick={() => onRemove(item.cartId)}
          className="w-6 h-6 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 flex items-center justify-center flex-shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>
      
      {/* Editable price (kalau di-toggle) */}
      <AnimatePresence>
        {editingPrice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-2"
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">
              Harga per kg
            </div>
            <MoneyInput
              value={item.pricePerKg}
              onChange={(newPrice) => onUpdatePrice(item.cartId, newPrice)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Qty controls */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={decrement}
          className="w-8 h-8 rounded-lg bg-black/40 border border-yellow-600/20 text-yellow-500 hover:bg-yellow-500/10 flex items-center justify-center flex-shrink-0"
        >
          <Minus size={12} />
        </button>
        <QtyInput
          value={item.qtyGrams}
          onChange={(newQty) => onUpdateQty(item.cartId, newQty)}
          className="flex-1"
        />
        <button
          onClick={increment}
          className="w-8 h-8 rounded-lg bg-black/40 border border-yellow-600/20 text-yellow-500 hover:bg-yellow-500/10 flex items-center justify-center flex-shrink-0"
        >
          <Plus size={12} />
        </button>
      </div>
      
      {/* Subtotal */}
      <div className="flex justify-between items-center pt-2 border-t border-yellow-600/10">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Subtotal</span>
        <span className="text-sm font-black text-yellow-400 font-mono">
          {formatRupiah(item.subtotal)}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Customer picker modal ─────────────────────────────────────

interface CustomerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSelect: (c: Customer) => void;
  onAddNew?: () => void;
}

function CustomerPickerModal({ isOpen, onClose, customers, onSelect, onAddNew }: CustomerPickerModalProps) {
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(q));
  }, [customers, search]);
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pilih Supplier"
      size="md"
    >
      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama supplier..."
          className="w-full pl-11 pr-4 py-2.5 bg-black/40 border border-yellow-600/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500 text-sm"
          autoFocus
        />
      </div>
      
      {/* Add new button */}
      {onAddNew && (
        <button
          onClick={() => {
            onAddNew();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-3 mb-3 bg-yellow-500/5 border border-yellow-500/20 border-dashed rounded-xl hover:bg-yellow-500/10 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <UserPlus size={16} className="text-yellow-400" />
          </div>
          <span className="text-sm font-semibold text-yellow-400">Tambah Supplier Baru</span>
        </button>
      )}
      
      {/* List */}
      <div className="max-h-80 overflow-y-auto space-y-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            {customers.length === 0 ? 'Belum ada supplier' : 'Tidak ada yang cocok'}
          </div>
        ) : (
          filtered.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-yellow-500/5 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                {c.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                {c.phone && (
                  <div className="text-[11px] text-gray-500 font-mono">{c.phone}</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

// ─── Success modal setelah checkout ────────────────────────────

interface SuccessModalProps {
  isOpen: boolean;
  transactionId: string;
  onClose: () => void;
}

function SuccessModal({ isOpen, transactionId, onClose }: SuccessModalProps) {
  // TODO Sesi 7: integrasi dengan receipt-service untuk print/PDF/WA
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      closeOnBackdrop={false}
      size="sm"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1 }}
        className="flex justify-center mb-4"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
          <Check size={36} className="text-emerald-400" />
        </div>
      </motion.div>
      
      <h3 className="text-xl font-black text-white text-center mb-1">
        Transaksi Berhasil
      </h3>
      <p className="text-sm text-gray-400 text-center mb-1">
        Pembelian telah tercatat
      </p>
      <p className="text-[10px] text-gray-600 text-center font-mono mb-6">
        ID: {transactionId.slice(-12).toUpperCase()}
      </p>
      
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button
          onClick={() => { /* TODO: print */ onClose(); }}
          className="flex flex-col items-center gap-1 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 hover:bg-yellow-500/15 transition-all"
        >
          <Printer size={18} />
          <span className="text-[10px] font-bold uppercase">Cetak</span>
        </button>
        <button
          onClick={() => { /* TODO: PDF */ onClose(); }}
          className="flex flex-col items-center gap-1 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 hover:bg-yellow-500/15 transition-all"
        >
          <FileDown size={18} />
          <span className="text-[10px] font-bold uppercase">PDF</span>
        </button>
        <button
          onClick={() => { /* TODO: WA */ onClose(); }}
          className="flex flex-col items-center gap-1 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 hover:bg-yellow-500/15 transition-all"
        >
          <Share2 size={18} />
          <span className="text-[10px] font-bold uppercase">WhatsApp</span>
        </button>
      </div>
      
      <button
        onClick={onClose}
        className="w-full py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-black uppercase tracking-wider rounded-xl"
      >
        Selesai
      </button>
    </Modal>
  );
}
