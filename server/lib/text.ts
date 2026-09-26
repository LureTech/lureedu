/** Utilitários de texto: normalização para busca e geração de slugs (iguais ao TextUtils do Java). */

/** Remove acentos e passa para minúsculas ("Gestão" → "gestao"). */
export function normalize(value: string | null | undefined): string {
  if (value == null) return '';
  return value.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

/** "Call de Vendas: Fechamento!" → "call-de-vendas-fechamento". */
export function slugify(value: string, maxLength: number): string {
  let slug = normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-+)|(-+$)/g, '');
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength).replace(/(^-+)|(-+$)/g, '');
  }
  return slug;
}

/** Slug único: se {@code base} já existir, tenta base-2, base-3… */
export async function uniqueSlug(
  title: string,
  maxLength: number,
  fallback: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let base = slugify(title, maxLength - 4);
  if (base === '') base = fallback;
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

/** Trim; string vazia vira null. */
export function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t === '' ? null : t;
}

export function trimToEmpty(value: string | null | undefined): string {
  return value == null ? '' : value.trim();
}

export function excerpt(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const t = value.trim().replace(/\s+/g, ' ');
  if (t === '') return null;
  return t.length <= max ? t : `${t.substring(0, max - 1).trimEnd()}…`;
}
