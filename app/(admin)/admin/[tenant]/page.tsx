import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { lintPage } from '@/lib/taste/lint';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import { Workspace, type PageState } from './workspace';

export const dynamic = 'force-dynamic';

export default async function TenantWorkspace({ params }: { params: Promise<{ tenant: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const pages = await listPages(tenant.id);
  const history = (await db()`
    select role, content from chat_messages
    where tenant_id = ${tenant.id} order by created_at asc limit 60
  `) as { role: string; content: string }[];

  const pageStates: PageState[] = pages.map((page) => {
    const findings = lintPage(page);
    return {
      slug: page.slug,
      type: page.type,
      title: page.title,
      blocks: page.blocks.length,
      published: Boolean(page.publishedBlocks),
      publishedAt: page.publishedAt,
      dirty: Boolean(page.publishedBlocks) && JSON.stringify(page.publishedBlocks) !== JSON.stringify(page.blocks),
      errors: findings.filter((f) => f.level === 'error').map((f) => f.message),
      warnings: findings.filter((f) => f.level === 'warn').map((f) => f.message),
    };
  });

  return (
    <Workspace
      initial={{ tenant: { slug: tenant.slug, name: tenant.name }, pages: pageStates }}
      history={history}
    />
  );
}
