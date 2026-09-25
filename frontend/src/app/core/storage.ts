/** Acesso seguro ao Web Storage (modo privado / bloqueado não quebra a app). */
export function safeGet(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(storage: 'local' | 'session', key: string, value: string): void {
  try {
    (storage === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* ignora */
  }
}

export function safeRemove(storage: 'local' | 'session', key: string): void {
  try {
    (storage === 'local' ? localStorage : sessionStorage).removeItem(key);
  } catch {
    /* ignora */
  }
}

export function safeGetJson<T>(storage: 'local' | 'session', key: string): T | null {
  const raw = safeGet(storage, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
