import { adminTenant } from '@/lib/admin/queries';
import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getGuide, listImages } from '@/lib/images/queries';
import { imageUsage } from '@/lib/images/usage';
import { listPages } from '@/lib/tenant-queries';
import { ImagesLibrary } from './images-library';

export const dynamic = 'force-dynamic';

export default async function ImagesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}/imagens`)}`,
    );
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();

  const [images, guide, pages] = await Promise.all([
    listImages(tenant.id),
    getGuide(tenant.id),
    listPages(tenant.id),
  ]);

  return (
    <ImagesLibrary
      key={tenant.slug}
      tenant={{ slug: tenant.slug, name: tenant.name }}
      initial={{
        guide,
        images,
        logoUrl: tenant.brand.logoUrl ?? null,
        usage: imageUsage(tenant, pages, images),
      }}
    />
  );
}
