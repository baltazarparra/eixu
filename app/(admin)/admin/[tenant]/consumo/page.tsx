import { notFound, redirect } from 'next/navigation';
import { usageFilters, usageHistory } from '@/lib/admin/usage-history';
import { UsageHistoryPanel } from '@/components/admin/usage-history';
import { adminTenant } from '@/lib/admin/queries';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export default async function ConsumptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}/consumo`)}`,
    );
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  const filters = usageFilters(await searchParams);
  const data = await usageHistory(tenant.id, filters);
  return (
    <main className="admin-page admin-consumption-page">
      <UsageHistoryPanel
        data={data}
        filters={filters}
        slug={tenant.slug}
        name={tenant.name}
      />
    </main>
  );
}
