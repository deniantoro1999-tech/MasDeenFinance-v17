// ═══════════════════════════════════════════════════════════════
// useDialog — Unified alert/confirm system
// 
// MASALAH v16: 5 layer modal dengan z-index berbeda (50, 100, 300,
//              9999, 99999). Tumpang tindih, kadang hilang.
// 
// SOLUSI v17: SATU dialog state terpusat. Hanya satu modal aktif
//             pada satu waktu. Tidak ada lagi konflik z-index.
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import type { DialogState, DialogType } from '../lib/types';

const CLOSED_STATE: DialogState = {
  isOpen: false,
  type: 'alert',
  title: '',
  message: '',
};

export interface UseDialogResult {
  dialog: DialogState;
  showAlert: (title: string, message: string) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showConfirm: (
    title: string, 
    message: string, 
    onConfirm: () => void,
    options?: { onCancel?: () => void; confirmLabel?: string; cancelLabel?: string }
  ) => void;
  closeDialog: () => void;
}

export function useDialog(): UseDialogResult {
  const [dialog, setDialog] = useState<DialogState>(CLOSED_STATE);
  
  const show = useCallback((state: Partial<DialogState> & Pick<DialogState, 'type' | 'title' | 'message'>) => {
    setDialog({ ...CLOSED_STATE, ...state, isOpen: true });
  }, []);
  
  const showAlert = useCallback((title: string, message: string) => {
    show({ type: 'alert', title, message });
  }, [show]);
  
  const showSuccess = useCallback((title: string, message: string) => {
    show({ type: 'success', title, message });
  }, [show]);
  
  const showError = useCallback((title: string, message: string) => {
    show({ type: 'error', title, message });
  }, [show]);
  
  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { onCancel?: () => void; confirmLabel?: string; cancelLabel?: string }
  ) => {
    show({ 
      type: 'confirm', 
      title, 
      message, 
      onConfirm, 
      onCancel: options?.onCancel,
      confirmLabel: options?.confirmLabel,
      cancelLabel: options?.cancelLabel,
    });
  }, [show]);
  
  const closeDialog = useCallback(() => {
    setDialog(CLOSED_STATE);
  }, []);
  
  return { dialog, showAlert, showSuccess, showError, showConfirm, closeDialog };
}
