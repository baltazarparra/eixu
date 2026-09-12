import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { adminTenant } from '@/lib/admin/queries';
import { TenantFrame } from '@/components/admin/navigation';

export default async function TenantLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: ReactNode;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(`/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}`)}`);
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  return (
    <TenantFrame
      tenant={{ slug: tenant.slug, name: tenant.name, status: tenant.status }}
    >
      {children}
    </TenantFrame>
  );
}
