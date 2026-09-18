import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { adminTenant } from '@/lib/admin/queries';
import { listImages } from '@/lib/images/queries';
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
  return (
    <ImagesLibrary
      tenant={{ slug: tenant.slug, name: tenant.name }}
      initial={{
        images: await listImages(tenant.id),
        logoUrl: tenant.brand.logoUrl ?? null,
      }}
    />
  );
}
