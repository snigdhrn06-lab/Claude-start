// Safe arithmetic evaluator shared by client (live preview) and server (authoritative).
// Supports numbers, + - * / ^ %, parentheses, unary minus and named variables. No eval().
const OPS = { '+': [1, 'L'], '-': [1, 'L'], '*': [2, 'L'], '/': [2, 'L'], '^': [3, 'R'] };

export function tokenize(src) {
  const out = [];
  const s = String(src || '').replace(/[,₹$\s]/g, (c) => (c === ',' ? '' : c === ' ' ? ' ' : ''));
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new Error('Invalid number');
      i = j;
      if (s[i] === '%') { out.push({ t: 'num', v: n / 100 }); i++; } else out.push({ t: 'num', v: n });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i; while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      out.push({ t: 'var', v: s.slice(i, j) }); i = j; continue;
    }
    if (c in OPS) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

export function evaluate(src, vars = {}) {
  const tokens = tokenize(src);
  if (!tokens.length) throw new Error('Empty expression');
  if (tokens.length > 200) throw new Error('Expression too long');
  const output = []; const stack = [];
  let prev = null;
  for (const tk of tokens) {
    if (tk.t === 'num') output.push(tk.v);
    else if (tk.t === 'var') {
      if (!(tk.v in vars)) throw new Error(`Unknown variable "${tk.v}"`);
      output.push(Number(vars[tk.v]));
    } else if (tk.t === 'op') {
      let op = tk.v;
      if (op === '-' && (!prev || prev.t === 'op' || prev.t === '(')) { output.push(0); op = '-u'; }
      const [p, a] = op === '-u' ? [4, 'R'] : OPS[op];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top === '(') break;
        const tp = top === '-u' ? 4 : OPS[top][0];
        if (tp > p || (tp === p && a === 'L')) output.push(stack.pop()); else break;
      }
      stack.push(op);
    } else if (tk.t === '(') stack.push('(');
    else if (tk.t === ')') {
      while (stack.length && stack[stack.length - 1] !== '(') output.push(stack.pop());
      if (!stack.length) throw new Error('Mismatched parentheses');
      stack.pop();
    }
    prev = tk;
  }
  while (stack.length) { const o = stack.pop(); if (o === '(') throw new Error('Mismatched parentheses'); output.push(o); }
  const st = [];
  for (const x of output) {
    if (typeof x === 'number') { st.push(x); continue; }
    const b = st.pop(); const a = st.pop();
    if (a === undefined || b === undefined) throw new Error('Incomplete expression');
    if (x === '+') st.push(a + b); else if (x === '-' || x === '-u') st.push(a - b);
    else if (x === '*') st.push(a * b); else if (x === '/') { if (b === 0) throw new Error('Division by zero'); st.push(a / b); }
    else if (x === '^') st.push(Math.pow(a, b));
  }
  if (st.length !== 1 || !Number.isFinite(st[0])) throw new Error('Incomplete expression');
  return st[0];
}
