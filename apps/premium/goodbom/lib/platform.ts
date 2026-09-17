function configuration() {
  const token = process.env.EIXU_PREMIUM_TOKEN;
  if (!token) throw new Error('EIXU_PREMIUM_TOKEN não configurado.');
  return {
    token,
    base: process.env.EIXU_PLATFORM_URL || 'https://eixu.com.br',
  };
}

/** O segredo fica nesta chamada server-side e nunca entra no HTML do site. */
export async function platformFetch(
  path: string,
  request: Request,
  init: RequestInit,
) {
  const { token, base } = configuration();
  const host = request.headers.get('host') ?? new URL(request.url).host;
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-eixu-site-host', host);
  return fetch(new URL(path, base), {
    ...init,
    headers,
    cache: 'no-store',
  });
}
