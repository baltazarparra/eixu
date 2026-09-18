import { notFound, redirect } from 'next/navigation';
import { adminTenant } from '@/lib/admin/queries';
import { usageSummary } from '@/lib/admin/usage-history';
import { isAuthenticated } from '@/lib/auth';
import { countTenantData } from '@/lib/tenant-queries';
import { intakeForForm } from '@/lib/tenant-intake';
import { studioDirectionOf } from '@/lib/studio/directions';
import { SettingsForm } from '@/app/(admin)/admin/[tenant]/dados/settings-form';

export const dynamic = 'force-dynamic';

export default async function StudioDataPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(`/studio/${slug}/dados`)}`,
    );
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  const [counts, usage] = await Promise.all([
    countTenantData(tenant.id),
    usageSummary(tenant.id),
  ]);
  return (
    <main className="admin-page admin-settings-page">
      <SettingsForm
        key={tenant.slug}
        basePath="/studio"
        tenant={{
          slug: tenant.slug,
          name: tenant.name,
          status: tenant.status,
          contactEmail: tenant.contactEmail,
          logoUrl: tenant.brand.logoUrl,
          direction: studioDirectionOf(tenant.brand),
          primary: tenant.brand.accent ?? '#1f6feb',
          secondary: tenant.brand.accentAlt ?? '#dbeafe',
          highlight: tenant.brand.highlight ?? tenant.brand.accent ?? '#1f6feb',
          pageCount: counts.pages,
          leadCount: counts.leads,
          imageCount: counts.images,
        }}
        intake={intakeForForm(tenant.brief.intake) ?? {}}
        contacts={tenant.contacts}
        usage={usage}
      />
    </main>
  );
}
