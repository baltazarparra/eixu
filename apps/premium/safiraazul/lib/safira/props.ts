/**
 * Leitura segura das props dos blocos.
 *
 * O conteúdo chega de `content/site.json` depois de receber os valores que o
 * operador publicou pelo CMS, então cada campo é `unknown` até ser conferido.
 * Um campo ausente devolve vazio e a seção decide se ainda faz sentido; nunca
 * derruba a página do cliente.
 */

type Props = Record<string, unknown>;

export function str(props: Props | undefined, key: string): string {
  const value = props?.[key];
  return typeof value === 'string' ? value : '';
}

export function list(props: Props | undefined, key: string): Props[] {
  const value = props?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Props => Boolean(item) && typeof item === 'object',
  );
}

export function strings(props: Props | undefined, key: string): string[] {
  const value = props?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export type Link = { href: string; label: string };

export function link(props: Props | undefined, key: string): Link | null {
  const value = props?.[key];
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Props;
  const href = typeof candidate.href === 'string' ? candidate.href : '';
  const label = typeof candidate.label === 'string' ? candidate.label : '';
  return href && label ? { href, label } : null;
}

export function links(props: Props | undefined, key: string): Link[] {
  return list(props, key)
    .map((item) => ({
      href: typeof item.href === 'string' ? item.href : '',
      label: typeof item.label === 'string' ? item.label : '',
    }))
    .filter((item) => item.href && item.label);
}

/** Numeração das fichas e dos passos: 01, 02, 03… */
export function ordinal(index: number): string {
  return String(index + 1).padStart(2, '0');
}
