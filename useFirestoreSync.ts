// ═══════════════════════════════════════════════════════════════
// useFirestoreSync — Real-time data sync dari Firestore
// 
// Hook tunggal yang subscribe ke SEMUA collection yang diperlukan
// aplikasi dan expose sebagai state React.
// 
// Keuntungan:
// - Satu useEffect untuk setup listener, cleanup otomatis
// - Edit data di satu device → langsung terupdate di device lain
// - Offline: Firestore otomatis serve dari cache, data tetap terlihat
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import {
  productsService, customersService, transactionsService,
  notesService, settingsService, initializeIfEmpty,
} from '../lib/firestore-service';
import type { Product, Customer, Transaction, Note, AppSettings } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';

export interface FirestoreSyncState {
  isReady: boolean;        // true setelah initial load semua collection
  error: string | null;
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  notes: Note[];
  settings: AppSettings;
}

/**
 * Subscribe ke semua data Firestore. Hanya aktif saat user login.
 * Kalau user logout, semua data direset ke kosong.
 */
export function useFirestoreSync(isAuthenticated: boolean): FirestoreSyncState {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  
  // Track loaded flags untuk isReady
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  useEffect(() => {
    if (!isAuthenticated) {
      // Reset state saat logout
      setProducts([]);
      setCustomers([]);
      setTransactions([]);
      setNotes([]);
      setSettings(DEFAULT_SETTINGS);
      setProductsLoaded(false);
      setCustomersLoaded(false);
      setTransactionsLoaded(false);
      setNotesLoaded(false);
      setSettingsLoaded(false);
      return;
    }
    
    const unsubs: Unsubscribe[] = [];
    
    const handleError = (e: Error) => {
      console.error('[FirestoreSync]', e);
      setError(e.message);
    };
    
    // Products
    unsubs.push(productsService.subscribe(
      (items) => { setProducts(items); setProductsLoaded(true); },
      handleError
    ));
    
    // Customers
    unsubs.push(customersService.subscribe(
      (items) => { setCustomers(items); setCustomersLoaded(true); },
      handleError
    ));
    
    // Transactions
    unsubs.push(transactionsService.subscribe(
      (items) => { setTransactions(items); setTransactionsLoaded(true); },
      handleError
    ));
    
    // Notes
    unsubs.push(notesService.subscribe(
      (items) => { setNotes(items); setNotesLoaded(true); },
      handleError
    ));
    
    // Settings
    unsubs.push(settingsService.subscribe(
      (s) => { setSettings(s); setSettingsLoaded(true); },
      handleError
    ));
    
    // Cek apakah install baru, seed default catalog kalau iya
    initializeIfEmpty().catch(e => console.warn('Init check failed:', e));
    
    return () => {
      unsubs.forEach(u => u());
    };
  }, [isAuthenticated]);
  
  const isReady = !isAuthenticated || (
    productsLoaded && customersLoaded && transactionsLoaded && 
    notesLoaded && settingsLoaded
  );
  
  return {
    isReady,
    error,
    products,
    customers,
    transactions,
    notes,
    settings,
  };
}
