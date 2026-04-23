// ═══════════════════════════════════════════════════════════════
// Dialog — Alert / Confirm / Success / Error
// 
// Menggantikan 5 jenis modal terpisah di v16.
// Dipakai bersama hook useDialog.
// ═══════════════════════════════════════════════════════════════

import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Modal } from './Modal';
import type { DialogState } from '../../lib/types';

export interface DialogProps {
  state: DialogState;
  onClose: () => void;
}

const ICONS = {
  alert:   { Icon: Info,           color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  success: { Icon: CheckCircle2,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  error:   { Icon: AlertCircle,    color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  confirm: { Icon: AlertTriangle,  color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
};

export function Dialog({ state, onClose }: DialogProps) {
  const { type, title, message, onConfirm, onCancel, confirmLabel, cancelLabel } = state;
  const icon = ICONS[type] || ICONS.alert;
  const { Icon, color, bg, border } = icon;
  
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };
  
  const handleCancel = () => {
    onCancel?.();
    onClose();
  };
  
  return (
    <Modal
      isOpen={state.isOpen}
      onClose={type === 'confirm' ? handleCancel : onClose}
      showCloseButton={false}
      closeOnBackdrop={type !== 'confirm'}
      size="sm"
    >
      {/* Icon */}
      <div className="flex justify-center mb-5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${bg} ${border}`}>
          <Icon size={28} className={color} />
        </div>
      </div>
      
      {/* Title & Message */}
      <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
      <p className="text-sm text-gray-400 text-center leading-relaxed mb-6 whitespace-pre-wrap">{message}</p>
      
      {/* Actions */}
      <div className="flex flex-col gap-2">
        {type === 'confirm' ? (
          <>
            <button
              onClick={handleConfirm}
              className="w-full py-3 rounded-xl bg-gradient-to-b from-yellow-400 to-yellow-600 text-black font-bold hover:from-yellow-300 hover:to-yellow-500 transition-all shadow-lg shadow-yellow-600/20"
            >
              {confirmLabel || 'Ya, Lanjutkan'}
            </button>
            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-xl bg-white/5 text-gray-400 font-medium hover:bg-white/10 border border-white/10 transition-all"
            >
              {cancelLabel || 'Batal'}
            </button>
          </>
        ) : (
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
              type === 'error' ? 'bg-red-600 hover:bg-red-500 text-white' :
              'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            Tutup
          </button>
        )}
      </div>
    </Modal>
  );
}
