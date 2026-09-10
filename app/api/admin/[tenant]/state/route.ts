import { isAuthenticated } from '@/lib/auth';
import { isDesignProfile } from '@/lib/design/profile';
import { generationState } from '@/lib/sites/generation';
import { lintPage } from '@/lib/taste/lint';
import { lintSite } from '@/lib/taste/site';
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
  const siteFindings = lintSite(pages, images, 'publish');
  const design = isDesignProfile(tenant.brand.design)
    ? tenant.brand.design
    : undefined;

  return Response.json({
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      brand: tenant.brand,
      dials: tenant.dials,
      hasDesign: Boolean(design),
    },
    generation: generationState(tenant, pages, images, siteFindings),
    pages: pages.map((page) => {
      const findings = [
        ...lintPage(page, design),
        ...siteFindings.filter((f) => f.page === `/${page.slug}`),
      ];
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
