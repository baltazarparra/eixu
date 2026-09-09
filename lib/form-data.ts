/**
 * `FormData.get` devolve `string | File | null`. Ler direto com `String()`
 * transformaria um arquivo em "[object Object]". Este helper normaliza.
 */
export function text(form: FormData, key: string, fallback = ''): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : fallback;
}

export function checked(form: FormData, key: string): boolean {
  return text(form, key) === 'on';
}
