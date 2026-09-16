import {
  currentLogoAsset,
  currentDarkLogoAsset,
} from '@/lib/images/logo-schema';
import { logoStudioSummary } from '@/lib/images/logo-studio-state';
import { usageSummary } from '@/lib/admin/usage-history';
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
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}/dados`)}`,
    );
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  const intake = intakeForForm(tenant.brief.intake);
  // O cadastro não carrega mais o histórico: só o resumo do cartão do rail.
  const [counts, usage] = await Promise.all([
    countTenantData(tenant.id),
    usageSummary(tenant.id),
  ]);
  return (
    <main className="admin-page admin-settings-page">
      <SettingsForm
        key={tenant.slug}
        tenant={{
          slug: tenant.slug,
          name: tenant.name,
          status: tenant.status,
          maintenanceMode: tenant.maintenanceMode,
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
        usage={usage}
      />
    </main>
  );
}
