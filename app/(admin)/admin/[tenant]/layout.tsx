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
  if (!(await isAuthenticated())) redirect('/admin/login');
  const tenant = await adminTenant((await params).tenant);
  if (!tenant) notFound();
  return (
    <TenantFrame
      tenant={{ slug: tenant.slug, name: tenant.name, status: tenant.status }}
    >
      {children}
    </TenantFrame>
  );
}
