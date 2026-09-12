import { adminTenant } from '@/lib/admin/queries';
import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { countTenantData } from '@/lib/tenant-queries';
import { intakeSchema } from '@/lib/tenant-intake';
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
  const intake = intakeSchema.safeParse(tenant.brief.intake);
  const counts = await countTenantData(tenant.id);
  return (
    <>
      <main className="admin-page admin-settings-page">
        <div className="admin-page-heading">
          <div>
            <h1>Dados do cliente</h1>
            <p className="mt-3 mb-8 max-w-2xl text-sm text-[var(--color-muted)]">
              Mantenha contatos e briefing atualizados. O agente usa essas
              informações nas próximas edições.
            </p>
          </div>
        </div>
        <SettingsForm
          key={tenant.slug}
          tenant={{
            slug: tenant.slug,
            name: tenant.name,
            status: tenant.status,
            contactEmail: tenant.contactEmail,
            logoUrl: tenant.brand.logoUrl,
            logoDarkUrl: tenant.brand.logoDarkUrl,
            paper: tenant.brand.paper,
            // O achado de composição usa o papel real do cabeçalho; aqui a
            // prévia avisa pelo papel da marca, que é o caso comum.
            logoIssue: logoIssueText(tenant.brand),
            vibe: vibeOf(tenant.brand),
            pageCount: counts.pages,
            leadCount: counts.leads,
            imageCount: counts.images,
          }}
          intake={intake.success ? intake.data : {}}
          contacts={tenant.contacts}
          social={parseSocialRecord(tenant.brief.social)}
        />
      </main>
    </>
  );
}
