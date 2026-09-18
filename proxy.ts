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
  const host = request.headers.get('host') ?? '';
  // Cada site publicado pertence ao próprio projeto Vercel. Se o wildcard do
  // projeto raiz receber um subdomínio sem vínculo, nunca sirva um renderer ou
  // conteúdo residual da plataforma.
  if (tenantFromHost(host)) return notFound();
  return NextResponse.next();
}

export const config = {
  // Workflow expõe seus handlers em `/.well-known/workflow/`. Eles precisam
  // chegar diretamente ao runtime, sem resolução de tenant ou rewrite.
  matcher: ['/((?!_next/static|_next/image|og.png|[.]well-known/workflow/).*)'],
};
