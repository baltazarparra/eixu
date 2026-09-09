import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Hosts que servem o site institucional da EIXU, não sites de clientes. */
const RESERVED = new Set(['www', 'admin', 'api', 'app']);

/**
 * Extrai o slug do tenant a partir do host.
 * Produção: `cliente.eixu.com.br`. Desenvolvimento: `cliente.localhost:3000`.
 * Preview da Vercel: `?__tenant=slug` porque não há wildcard de domínio.
 */
function tenantFromHost(host: string): string | null {
  const hostname = host.split(':')[0];
  if (hostname.endsWith('.localhost')) {
    const slug = hostname.replace('.localhost', '');
    return RESERVED.has(slug) ? null : slug;
  }
  const parts = hostname.split('.');
  // eixu.com.br tem 3 partes; um subdomínio de tenant tem 4.
  if (parts.length < 4) return null;
  const slug = parts[0];
  return RESERVED.has(slug) ? null : slug;
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const path = url.pathname;

  // `/s/*` é o alvo interno da reescrita. Já está resolvido: segue direto.
  // Em produção só chega aqui por reescrita; o acesso direto pelo domínio
  // principal fica bloqueado abaixo.
  if (path.startsWith('/s/')) {
    const viaRewrite = request.headers.get('x-eixu-rewrite') === '1';
    const viaPreview = url.searchParams.has('__tenant');
    if (!viaRewrite && !viaPreview) return NextResponse.rewrite(new URL('/404', request.url));
    return NextResponse.next();
  }

  const slug = tenantFromHost(host) ?? url.searchParams.get('__tenant');
  if (!slug) return NextResponse.next();
  if (path.startsWith('/api/') || path.startsWith('/go/') || path.startsWith('/_next/')) {
    return NextResponse.next();
  }
  if (path.startsWith('/admin')) {
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  const target = new URL(`/s/${slug}${path === '/' ? '' : path}`, request.url);
  target.search = url.search;
  const headers = new Headers(request.headers);
  headers.set('x-eixu-rewrite', '1');
  headers.set('x-eixu-tenant', slug);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|og.png).*)'],
};
