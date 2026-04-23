// ═══════════════════════════════════════════════════════════════
// useAuth — Firebase Authentication React hook
// 
// Menangani: Google sign-in, email/password login, phone-as-email,
//            auto-register, logout, state user.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  User,
} from 'firebase/auth';
import { auth } from '../firebase';
import type { AppUser } from '../lib/types';

function toAppUser(u: User | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    isAnonymous: u.isAnonymous,
  };
}

/**
 * Normalisasi input login:
 * - Kalau hanya angka (no. HP) → konversi jadi email palsu "<nomor>@masdeen.app"
 * - Kalau email beneran → pakai apa adanya
 */
function normalizeLoginIdentifier(input: string): string {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}@masdeen.app`;
  }
  return trimmed;
}

export interface UseAuthResult {
  user: AppUser | null;
  isReady: boolean;        // true setelah onAuthStateChanged pertama kali selesai
  isLoading: boolean;      // true saat login/register sedang jalan
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (identifier: string, password: string) => Promise<void>;
  registerWithEmail: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(toAppUser(u));
      setIsReady(true);
    });
    return unsub;
  }, []);
  
  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      // Pesan spesifik untuk iframe/popup blocker
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user') {
        setError('Popup login diblokir. Buka aplikasi di tab baru (Open in New Tab), lalu coba lagi.');
      } else {
        setError(e?.message || 'Gagal login dengan Google');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const loginWithEmail = useCallback(async (identifier: string, password: string) => {
    if (!identifier || !password) {
      setError('Email/No. HP dan kata sandi wajib diisi');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const email = normalizeLoginIdentifier(identifier);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      if (e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential') {
        setError('Akun tidak ditemukan atau kata sandi salah. Kalau belum punya akun, silakan daftar.');
      } else if (e?.code === 'auth/wrong-password') {
        setError('Kata sandi salah');
      } else if (e?.code === 'auth/invalid-email') {
        setError('Format email tidak valid');
      } else {
        setError(e?.message || 'Gagal login');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const registerWithEmail = useCallback(async (identifier: string, password: string) => {
    if (!identifier || !password) {
      setError('Email/No. HP dan kata sandi wajib diisi');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const email = normalizeLoginIdentifier(identifier);
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        setError('Email/No. HP ini sudah terdaftar. Silakan login.');
      } else if (e?.code === 'auth/weak-password') {
        setError('Kata sandi terlalu lemah (minimal 6 karakter)');
      } else {
        setError(e?.message || 'Gagal mendaftar');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e: any) {
      setError(e?.message || 'Gagal logout');
    }
  }, []);
  
  const clearError = useCallback(() => setError(null), []);
  
  return {
    user, isReady, isLoading, error,
    loginWithGoogle, loginWithEmail, registerWithEmail, logout, clearError,
  };
}
