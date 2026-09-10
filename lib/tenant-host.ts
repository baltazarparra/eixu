const RESERVED = new Set(['www', 'admin', 'api', 'app']);

export function tenantFromHost(host: string): string | null {
  const hostname = host.toLowerCase().split(':')[0];
  const suffix = hostname.endsWith('.localhost')
    ? '.localhost'
    : hostname.endsWith('.eixu.com.br')
      ? '.eixu.com.br'
      : null;
  if (!suffix) return null;
  const slug = hostname.slice(0, -suffix.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED.has(slug)
    ? slug
    : null;
}
