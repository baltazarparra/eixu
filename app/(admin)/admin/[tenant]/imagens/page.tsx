import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getGuide, listImages } from '@/lib/images/queries';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { ImagesLibrary } from './images-library';

export const dynamic = 'force-dynamic';

export default async function ImagesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // A decisão sobre candidatas acontece na conversa do site; aqui é acervo.
  const [images, guide] = await Promise.all([
    listImages(tenant.id, 'aprovada'),
    getGuide(tenant.id),
  ]);

  return (
    <ImagesLibrary
      tenant={{ slug: tenant.slug, name: tenant.name }}
      initial={{ guide, images, logoUrl: tenant.brand.logoUrl ?? null }}
    />
  );
}
