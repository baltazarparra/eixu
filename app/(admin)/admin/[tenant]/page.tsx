import { adminTenant } from '@/lib/admin/queries';
import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { chatHistory, messageCursor } from '@/lib/ai/history';
import { workspaceState } from '@/lib/admin/state';
import { listImages } from '@/lib/images/queries';
import { pagesWithUndo } from '@/lib/sites/revisions';
import { listPages } from '@/lib/tenant-queries';
import { premiumWorkspaceState } from '@/lib/premium/queries';
import { Workspace } from './workspace';

export const dynamic = 'force-dynamic';

export default async function TenantWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{
    imagem?: string | string[];
    pedido?: string | string[];
  }>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(`/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}`)}`);
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();

  const [pages, images, undoPages, premium] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
    pagesWithUndo(tenant.id),
    premiumWorkspaceState(tenant),
  ]);
  const premiumActive =
    premium.maintenanceMode === 'premium' &&
    premium.publicRuntime === 'premium';
  const history = premiumActive ? [] : await chatHistory(tenant.id, 'site');
  const initial = workspaceState(tenant, pages, images, undoPages, premium);
  const { imagem, pedido } = await searchParams;
  const imageRequest =
    typeof imagem === 'string' && /^[1-9]\d{0,8}$/.test(imagem)
      ? `Quero atualizar a imagem #${imagem}: `
      : typeof pedido === 'string'
        ? pedido.slice(0, 2000)
        : '';
  return (
    <Workspace
      key={tenant.slug}
      initial={initial}
      history={history}
      lastMessageId={messageCursor(history)}
      imageRequest={imageRequest}
    />
  );
}
