import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 404 de verdade. Reescrever para uma rota inexistente devolveria a página de
 * erro com status 200, e um soft 404 confunde tanto rastreador quanto operador.
 */
function notFound(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex',
    },
  });
}

import { tenantFromHost } from '@/lib/tenant-host';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const path = url.pathname;

  // `/s/*` é o alvo interno da reescrita. Já está resolvido: segue direto.
  // Em produção só chega aqui por reescrita; o acesso direto pelo domínio
  // principal fica bloqueado.
  if (path.startsWith('/s/')) {
    const viaRewrite = request.headers.get('x-eixu-rewrite') === '1';
    const viaPreview = url.searchParams.has('__tenant');
    if (!viaRewrite && !viaPreview) return notFound();
    return NextResponse.next();
  }

  const slug = tenantFromHost(host) ?? url.searchParams.get('__tenant');
  if (!slug) return NextResponse.next();
  if (
    path.startsWith('/api/') ||
    path.startsWith('/go/') ||
    path.startsWith('/_next/')
  ) {
    return NextResponse.next();
  }
  // O painel existe só no domínio principal. No subdomínio de um cliente ele
  // não deve nem aparecer.
  if (path.startsWith('/admin')) return notFound();

  const target = new URL(`/s/${slug}${path === '/' ? '' : path}`, request.url);
  target.search = url.search;
  const headers = new Headers(request.headers);
  headers.set('x-eixu-rewrite', '1');
  headers.set('x-eixu-tenant', slug);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|og.png).*)'],
};
