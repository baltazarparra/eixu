export const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function canonicalTenantOrigin(slug) {
  if (!TENANT_SLUG_PATTERN.test(slug)) return null;
  return `https://${slug}.eixu.com.br`;
}

/** Resolve um caminho somente dentro do host canônico, inclusive contra barras invertidas. */
export function tenantRedirectUrl(slug, value, fallback = '/obrigado') {
  const origin = canonicalTenantOrigin(slug);
  if (!origin) return null;
  const fallbackUrl = new URL(fallback, origin);
  if (typeof value !== 'string' || value.length > 2_048)
    return fallbackUrl.toString();
  try {
    const target = new URL(value, origin);
    return value.startsWith('/') && target.origin === origin
      ? target.toString()
      : fallbackUrl.toString();
  } catch {
    return fallbackUrl.toString();
  }
}

export function matchesTenantOrigin(origin, slug, options = {}) {
  if (!origin) return options.allowMissing === true;
  return origin === canonicalTenantOrigin(slug);
}

export function tenantCorsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
