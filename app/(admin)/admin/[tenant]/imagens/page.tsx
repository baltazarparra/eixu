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
  // As rejeitadas continuam listadas num filtro próprio, porque a recusa de
  // uma imagem em uso não apaga nada e o operador precisa enxergá-la.
  const [all, guide] = await Promise.all([
    listImages(tenant.id),
    getGuide(tenant.id),
  ]);
  const images = all.filter((image) => image.status !== 'candidata');

  return (
    <ImagesLibrary
      tenant={{ slug: tenant.slug, name: tenant.name }}
      initial={{ guide, images, logoUrl: tenant.brand.logoUrl ?? null }}
    />
  );
}
