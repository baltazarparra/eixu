import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { lintPage } from '@/lib/taste/lint';
import { lintSite } from '@/lib/taste/site';
import { listImages } from '@/lib/images/queries';
import { generationState } from '@/lib/sites/generation';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import { Workspace, type PageState } from './workspace';

export const dynamic = 'force-dynamic';

export default async function TenantWorkspace({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const siteFindings = lintSite(pages, images, 'publish');
  const history = (await db()`
    select role, content from chat_messages
    where tenant_id = ${tenant.id} and channel = 'site' order by created_at asc limit 60
  `) as { role: string; content: string }[];

  const pageStates: PageState[] = pages.map((page) => {
    const findings = [
      ...lintPage(page, tenant.brand.design),
      ...siteFindings.filter((f) => f.page === `/${page.slug}`),
    ];
    return {
      slug: page.slug,
      type: page.type,
      title: page.title,
      blocks: page.blocks.length,
      published: Boolean(page.publishedBlocks),
      publishedAt: page.publishedAt,
      dirty:
        Boolean(page.publishedBlocks) &&
        JSON.stringify(page.publishedBlocks) !== JSON.stringify(page.blocks),
      errors: findings.filter((f) => f.level === 'error').map((f) => f.message),
      warnings: findings
        .filter((f) => f.level === 'warn')
        .map((f) => f.message),
    };
  });

  return (
    <Workspace
      initial={{
        tenant: {
          slug: tenant.slug,
          name: tenant.name,
          hasDesign: Boolean(tenant.brand.design),
        },
        pages: pageStates,
        generation: generationState(tenant, pages, images, siteFindings),
      }}
      history={history}
    />
  );
}
