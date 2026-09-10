import { isAuthenticated } from '@/lib/auth';
import { lintPage } from '@/lib/taste/lint';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

export const dynamic = 'force-dynamic';

/**
 * Estado do site para o painel: páginas, contagem de blocos, pre-flight e
 * publicação. O workspace consulta depois de cada ação do agente, em vez de
 * recarregar a tela inteira.
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

  const pages = await listPages(tenant.id);
  return Response.json({
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      brand: tenant.brand,
      dials: tenant.dials,
    },
    pages: pages.map((page) => {
      const findings = lintPage(page, tenant.brand.design);
      return {
        slug: page.slug,
        type: page.type,
        title: page.title,
        blocks: page.blocks.length,
        published: Boolean(page.publishedBlocks),
        publishedAt: page.publishedAt,
        // Rascunho difere do publicado quando o agente mexeu depois da publicação.
        dirty:
          Boolean(page.publishedBlocks) &&
          JSON.stringify(page.publishedBlocks) !== JSON.stringify(page.blocks),
        errors: findings
          .filter((f) => f.level === 'error')
          .map((f) => f.message),
        warnings: findings
          .filter((f) => f.level === 'warn')
          .map((f) => f.message),
      };
    }),
  });
}
