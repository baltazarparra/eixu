import { isAuthenticated } from '@/lib/auth';
import { workspaceState } from '@/lib/admin/state';
import { listImages } from '@/lib/images/queries';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

export const dynamic = 'force-dynamic';

/**
 * Estado do site para o painel: páginas, contagem de blocos, pre-flight,
 * publicação e progresso da geração. O workspace consulta depois de cada ação
 * do agente, em vez de recarregar a tela inteira.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  return Response.json(workspaceState(tenant, pages, images));
}
