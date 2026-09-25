/** Utilidades compartilhadas pelas telas de administração. */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SYMBOLS = '@#$%&*!?';

/** Senha aleatória forte (12 caracteres, com número e símbolo). */
export function generatePassword(length = 12): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  const chars = Array.from(buf, (n) => ALPHABET[n % ALPHABET.length]);
  const extra = new Uint32Array(3);
  crypto.getRandomValues(extra);
  chars[extra[0] % length] = String(2 + (extra[1] % 8));
  chars[(extra[0] + 5) % length] = SYMBOLS[extra[2] % SYMBOLS.length];
  return chars.join('');
}

export const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/20';
