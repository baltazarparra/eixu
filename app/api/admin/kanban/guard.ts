import { isAuthenticated } from '@/lib/auth';
import { tenantFromHost } from '@/lib/tenant-host';

export const PRIVATE_HEADERS = {
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex',
} as const;

export async function guardKanbanRequest(
  request: Request,
  mutation = false,
): Promise<Response | null> {
  if (!(await isAuthenticated()))
    return Response.json(
      {
        error: 'Sua sessão expirou. Entre novamente no painel.',
        code: 'SESSION_EXPIRED',
      },
      { status: 401, headers: PRIVATE_HEADERS },
    );

  // O proxy deixa /api/* passar também em subdomínios de clientes.
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  if (tenantFromHost(host) || tenantFromHost(url.host))
    return Response.json(
      {
        error: 'Área interna indisponível neste endereço.',
        code: 'HOST_FORBIDDEN',
      },
      { status: 403, headers: PRIVATE_HEADERS },
    );

  if (mutation) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== url.origin)
      return Response.json(
        { error: 'Origem inválida.', code: 'ORIGIN_FORBIDDEN' },
        { status: 403, headers: PRIVATE_HEADERS },
      );
  }
  return null;
}
