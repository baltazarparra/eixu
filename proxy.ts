import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Hosts que servem o institucional. O projeto raiz na Vercel tem o domínio
 * wildcard `*.eixu.com.br` atribuído: qualquer subdomínio sem projeto próprio
 * cai aqui e não deve receber conteúdo.
 */
const ALLOWED_HOSTS = new Set([
  'eixu.com.br',
  'www.eixu.com.br',
  'localhost',
  '127.0.0.1',
]);

function isAllowedHost(host: string): boolean {
  const hostname = host.toLowerCase().split(':')[0];
  if (ALLOWED_HOSTS.has(hostname)) return true;
  // Produção, preview e URLs de deployment da Vercel.
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
}

export function proxy(request: NextRequest) {
  if (isAllowedHost(request.headers.get('host') ?? '')) return NextResponse.next();
  // 404 de verdade. Reescrever para uma rota inexistente devolveria a página de
  // erro com status 200, e um soft 404 confunde tanto rastreador quanto operador.
  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex',
    },
  });
}

export const config = {
  // Os assets de `public/` não passam pelo proxy: em host não autorizado não há
  // documento para acompanhá-los, e cada invocação evitada é uma a menos.
  matcher: ['/((?!_next/static|_next/image|favicon[.]svg|og[.]png|cases/[^/]+[.]webp).*)'],
};
