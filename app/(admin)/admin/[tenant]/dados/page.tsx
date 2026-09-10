import { notFound, redirect } from 'next/navigation';
import { AdminHeader } from '@/components/admin/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { intakeSchema } from '@/lib/tenant-intake';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const tenant = await getTenantBySlug((await params).tenant);
  if (!tenant) notFound();
  const intake = intakeSchema.safeParse(tenant.brief.intake);
  return (
    <>
      <AdminHeader tenant={tenant} active="dados" />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Dados do cliente
        </h1>
        <p className="mt-3 mb-8 max-w-2xl text-sm text-[var(--color-muted)]">
          Mantenha contatos e briefing atualizados. O agente usa essas
          informações nas próximas edições.
        </p>
        <SettingsForm
          tenant={{
            slug: tenant.slug,
            name: tenant.name,
            whatsapp: tenant.whatsapp,
            contactEmail: tenant.contactEmail,
            logoUrl: tenant.brand.logoUrl,
          }}
          intake={intake.success ? intake.data : {}}
        />
      </main>
    </>
  );
}
