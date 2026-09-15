import {
  currentLogoAsset,
  currentDarkLogoAsset,
} from '@/lib/images/logo-schema';
import { logoStudioSummary } from '@/lib/images/logo-studio-state';
import { usageFilters, usageHistory } from '@/lib/admin/usage-history';
import { UsageHistoryPanel } from '@/components/admin/usage-history';
import { adminTenant } from '@/lib/admin/queries';
import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { countTenantData } from '@/lib/tenant-queries';
import { intakeForForm } from '@/lib/tenant-intake';
import { parseSocialRecord } from '@/lib/social-profile';
import { vibeOf } from '@/lib/design/vibes';
import { logoIssueText } from '@/lib/images/logo-fit';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';
export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}/dados`)}`,
    );
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  const intake = intakeForForm(tenant.brief.intake);
  const filters = usageFilters(await searchParams);
  const [counts, consumption] = await Promise.all([
    countTenantData(tenant.id),
    usageHistory(tenant.id, filters),
  ]);
  return (
    <>
      <main className="admin-page admin-settings-page">
        <div className="admin-page-heading">
          <div>
            <h1>Dados do cliente</h1>
            <p className="mt-3 mb-8 max-w-2xl text-sm text-[var(--color-muted)]">
              Acompanhe o consumo de IA e mantenha contatos e história
              atualizados para as próximas edições.
            </p>
          </div>
        </div>
        <UsageHistoryPanel
          data={consumption}
          filters={filters}
          slug={tenant.slug}
        />
        <SettingsForm
          key={tenant.slug}
          tenant={{
            slug: tenant.slug,
            name: tenant.name,
            status: tenant.status,
            contactEmail: tenant.contactEmail,
            logoUrl: tenant.brand.logoUrl,
            logoDarkUrl: tenant.brand.logoDarkUrl,
            logoPreviewUrl: currentLogoAsset(tenant.brand)?.nav.url,
            logoDarkPreviewUrl: currentDarkLogoAsset(tenant.brand)?.nav.url,
            logoSvgUrl: currentLogoAsset(tenant.brand)?.svg?.url,
            logoStudioSummary: logoStudioSummary(tenant.brief, tenant.brand),
            paper: tenant.brand.paper,
            // O achado de composição usa o papel real do cabeçalho; aqui a
            // prévia avisa pelo papel da marca, que é o caso comum.
            logoIssue: logoIssueText(tenant.brand),
            vibe: vibeOf(tenant.brand),
            pageCount: counts.pages,
            leadCount: counts.leads,
            imageCount: counts.images,
          }}
          intake={intake ?? {}}
          contacts={tenant.contacts}
          social={parseSocialRecord(tenant.brief.social)}
        />
      </main>
    </>
  );
}
