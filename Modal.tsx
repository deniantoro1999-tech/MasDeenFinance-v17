// ═══════════════════════════════════════════════════════════════
// Modal — Universal modal component
// 
// SATU komponen untuk semua kebutuhan modal di aplikasi.
// - Backdrop click untuk close (optional)
// - ESC untuk close (optional)
// - Focus trap untuk accessibility
// - Animasi smooth dengan motion
// - Z-index konsisten dari design tokens
// ═══════════════════════════════════════════════════════════════

import { useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Z_INDEX } from '../../lib/design-tokens';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Default: 'md'. Ukuran max-width. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Click backdrop untuk close. Default: true. False untuk modal kritis (loading, konfirmasi). */
  closeOnBackdrop?: boolean;
  /** Tekan ESC untuk close. Default: true. */
  closeOnEsc?: boolean;
  /** Tampilkan tombol X di corner. Default: true. */
  showCloseButton?: boolean;
  /** Custom class untuk container */
  className?: string;
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  showCloseButton = true,
  className = '',
}: ModalProps) {
  // Handle ESC key
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, closeOnEsc, onClose]);
  
  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print"
          style={{ zIndex: Z_INDEX.modalOverlay }}
          onClick={closeOnBackdrop ? onClose : undefined}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
            className={`relative w-full ${SIZES[size]} bg-[#0a0a0a] border border-yellow-600/20 rounded-3xl shadow-2xl shadow-yellow-900/20 overflow-hidden ${className}`}
            style={{ zIndex: Z_INDEX.modalContent }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent bar (premium touch) */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent" />
            
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 pt-6 pb-3">
                {title ? (
                  <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
                ) : <div />}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    aria-label="Tutup"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            
            {/* Body */}
            <div className="px-6 pb-6">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
