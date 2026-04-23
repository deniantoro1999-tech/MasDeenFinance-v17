// ═══════════════════════════════════════════════════════════════
// MoneyInput — Input rupiah dengan live format
// 
// User mengetik: "1250000"
// Tampil live:   "Rp 1.250.000"
// 
// Juga support expression: "500000 + 250000" → Rp 750.000
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { Calculator } from 'lucide-react';
import { evalExpression, hasMathOperator } from '../../lib/parser';
import { toRupiah, formatRupiahPlain } from '../../lib/money';
import type { Rupiah } from '../../lib/types';

export interface MoneyInputProps {
  value: Rupiah | number;
  onChange: (rupiah: Rupiah) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  showPrefix?: boolean;
}

export function MoneyInput({
  value,
  onChange,
  placeholder = '0',
  autoFocus = false,
  disabled = false,
  className = '',
  showPrefix = true,
}: MoneyInputProps) {
  const [text, setText] = useState(() => formatRupiahPlain(value));
  const [error, setError] = useState(false);
  const [isCalc, setIsCalc] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(formatRupiahPlain(value));
    }
  }, [value]);
  
  useEffect(() => {
    setIsCalc(hasMathOperator(text));
  }, [text]);
  
  // Format live: tambah titik ribuan saat user mengetik angka biasa
  const handleInputChange = (raw: string) => {
    if (hasMathOperator(raw)) {
      // Biarkan expression mode — tidak format
      setText(raw);
    } else {
      // Angka biasa — format live
      const digits = raw.replace(/\D/g, '');
      if (!digits) {
        setText('');
      } else {
        setText(parseInt(digits, 10).toLocaleString('id-ID'));
      }
    }
  };
  
  const commit = () => {
    const trimmed = text.trim();
    
    if (!trimmed) {
      onChange(0 as Rupiah);
      setText('0');
      setError(false);
      return;
    }
    
    if (hasMathOperator(trimmed)) {
      const result = evalExpression(trimmed);
      if (result.ok && result.value >= 0) {
        const rupiah = toRupiah(result.value);
        onChange(rupiah);
        setText(formatRupiahPlain(rupiah));
        setError(false);
      } else {
        setError(true);
        setTimeout(() => {
          setText(formatRupiahPlain(value));
          setError(false);
        }, 800);
      }
      return;
    }
    
    // Plain number
    const digits = trimmed.replace(/\D/g, '');
    const num = parseInt(digits, 10);
    
    if (isNaN(num) || num < 0) {
      setError(true);
      setTimeout(() => {
        setText(formatRupiahPlain(value));
        setError(false);
      }, 800);
      return;
    }
    
    const rupiah = toRupiah(num);
    onChange(rupiah);
    setText(formatRupiahPlain(rupiah));
    setError(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      {showPrefix && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500 font-bold text-sm pointer-events-none">
          Rp
        </span>
      )}
      
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setText(formatRupiahPlain(value));
            e.currentTarget.blur();
          }
        }}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        className={`
          w-full py-3 bg-black/40 border rounded-xl
          font-mono font-semibold text-white text-right
          focus:outline-none transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${showPrefix ? 'pl-12 pr-10' : 'px-4 pr-10'}
          ${error 
            ? 'border-red-500 bg-red-950/30 animate-pulse' 
            : isCalc 
              ? 'border-yellow-500 bg-yellow-500/5' 
              : 'border-yellow-600/30 focus:border-yellow-500'
          }
        `}
      />
      
      {isCalc && !error && (
        <Calculator size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
