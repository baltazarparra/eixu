import { notFound, redirect } from 'next/navigation';
import { adminTenant } from '@/lib/admin/queries';
import { isAuthenticated } from '@/lib/auth';
import { listImages } from '@/lib/images/queries';
import { ImagesLibrary } from '@/app/(admin)/admin/[tenant]/imagens/images-library';

export const dynamic = 'force-dynamic';

export default async function StudioImagesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(`/studio/${slug}/imagens`)}`,
    );
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  return (
    <ImagesLibrary
      basePath="/studio"
      tenant={{ slug: tenant.slug, name: tenant.name }}
      initial={{
        images: await listImages(tenant.id),
        logoUrl: tenant.brand.logoUrl ?? null,
      }}
    />
  );
}
