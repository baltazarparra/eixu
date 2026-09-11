import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { chatHistory, lastMessageId } from '@/lib/ai/history';
import { workspaceState } from '@/lib/admin/state';
import { listImages } from '@/lib/images/queries';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import { Workspace } from './workspace';

export const dynamic = 'force-dynamic';

export default async function TenantWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ imagem?: string | string[] }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const [history, lastId] = await Promise.all([
    chatHistory(tenant.id, 'site'),
    lastMessageId(tenant.id),
  ]);
  const { imagem } = await searchParams;
  const imageRequest =
    typeof imagem === 'string' && /^[1-9]\d{0,8}$/.test(imagem)
      ? `Quero atualizar a imagem #${imagem}: `
      : '';
  return (
    <Workspace
      initial={workspaceState(tenant, pages, images)}
      history={history}
      lastMessageId={lastId}
      imageRequest={imageRequest}
    />
  );
}
