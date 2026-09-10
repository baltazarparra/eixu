import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { getGuide, listImages } from '@/lib/images/queries';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { ImagesWorkspace } from './images-workspace';

export const dynamic = 'force-dynamic';

export default async function ImagesPage({ params }: { params: Promise<{ tenant: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const [images, guide, rows] = await Promise.all([
    listImages(tenant.id),
    getGuide(tenant.id),
    db()`
      select role, content from chat_messages
      where tenant_id = ${tenant.id} and channel = 'imagens'
      order by created_at asc limit 60
    `,
  ]);
  const history = rows as { role: string; content: string }[];

  return (
    <ImagesWorkspace
      tenant={{ slug: tenant.slug, name: tenant.name }}
      initial={{ guide, images, logoUrl: tenant.brand.logoUrl ?? null }}
      history={history}
    />
  );
}
