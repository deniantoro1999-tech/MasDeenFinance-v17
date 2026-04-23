// ═══════════════════════════════════════════════════════════════
// QtyInput — Smart weight input dengan inline calculator
// 
// Feature signature dari prompt awal user:
// "kalau user ketik 10 + 5.5 + 2, otomatis jadi 17.5"
// 
// Value disimpan sebagai gram (integer), tapi user melihat & mengetik
// dalam kg (float). Konversi di sini, storage di luar selalu integer.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { Calculator } from 'lucide-react';
import { evalExpression, hasMathOperator } from '../../lib/parser';
import { kgToGrams, gramsToKg, formatWeightPlain } from '../../lib/money';
import type { Gram } from '../../lib/types';

export interface QtyInputProps {
  /** Value dalam gram (integer storage) */
  value: Gram | number;
  /** Callback saat user commit perubahan. Terima gram (integer). */
  onChange: (grams: Gram) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Autofocus saat mount */
  autoFocus?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Tambahan class */
  className?: string;
  /** Label kecil di kanan (default: "kg") */
  unit?: string;
}

export function QtyInput({
  value,
  onChange,
  placeholder = '0',
  autoFocus = false,
  disabled = false,
  className = '',
  unit = 'kg',
}: QtyInputProps) {
  // Local state untuk teks yang diketik user (bisa expression, bisa angka)
  const [text, setText] = useState(() => formatWeightPlain(value));
  const [error, setError] = useState(false);
  const [isCalc, setIsCalc] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Sync ke props value saat berubah dari luar
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(formatWeightPlain(value));
    }
  }, [value]);
  
  // Deteksi calculator mode untuk icon indicator
  useEffect(() => {
    setIsCalc(hasMathOperator(text));
  }, [text]);
  
  const commit = () => {
    const trimmed = text.trim();
    
    // Empty → 0
    if (!trimmed) {
      onChange(0 as Gram);
      setText('0');
      setError(false);
      return;
    }
    
    // Mengandung operator → pakai expression parser
    if (hasMathOperator(trimmed)) {
      const result = evalExpression(trimmed);
      if (result.ok && result.value >= 0) {
        const grams = kgToGrams(result.value);
        onChange(grams);
        setText(formatWeightPlain(grams));
        setError(false);
      } else {
        // Error → flash merah, rollback ke value lama
        setError(true);
        setTimeout(() => {
          setText(formatWeightPlain(value));
          setError(false);
        }, 800);
      }
      return;
    }
    
    // Plain number (handle koma Indonesia sebagai desimal)
    const normalized = trimmed.replace(',', '.');
    const num = parseFloat(normalized);
    
    if (isNaN(num) || num < 0) {
      setError(true);
      setTimeout(() => {
        setText(formatWeightPlain(value));
        setError(false);
      }, 800);
      return;
    }
    
    const grams = kgToGrams(num);
    onChange(grams);
    setText(formatWeightPlain(grams));
    setError(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setText(formatWeightPlain(value));
            e.currentTarget.blur();
          }
        }}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        className={`
          w-full px-3 py-2.5 pr-12 bg-black/40 border rounded-xl 
          text-center font-mono font-semibold text-yellow-400 text-base
          focus:outline-none transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error 
            ? 'border-red-500 bg-red-950/30 text-red-400 animate-pulse' 
            : isCalc 
              ? 'border-yellow-500 bg-yellow-500/5' 
              : 'border-yellow-600/30 focus:border-yellow-500'
          }
        `}
      />
      
      {/* Unit label + calculator icon */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
        {isCalc && !error && (
          <Calculator size={12} className="text-yellow-500 animate-pulse" />
        )}
        <span className={`text-xs font-medium ${error ? 'text-red-500' : 'text-gray-500'}`}>
          {unit}
        </span>
      </div>
    </div>
  );
}
