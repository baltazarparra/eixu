import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { chatHistory } from '@/lib/ai/history';
import { workspaceState } from '@/lib/admin/state';
import { listImages } from '@/lib/images/queries';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import { Workspace } from './workspace';

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
  const history = await chatHistory(tenant.id, 'site');
  return (
    <Workspace
      initial={workspaceState(tenant, pages, images)}
      history={history}
    />
  );
}
