import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { listSiteFolders, listTenants } from '@/lib/tenant-queries';
import { lastSiteActions } from '@/lib/admin/activity';
import { operationSummary } from '@/lib/admin/queries';
import { usageByTenant } from '@/lib/admin/usage-history';
import { byLastAction } from '@/lib/admin/site-list';
import { Clients } from './clients';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect('/admin/login?returnTo=/admin');
  const [tenants, folders, summary, actions, usage] = await Promise.all([
    listTenants(),
    listSiteFolders(),
    operationSummary(),
    lastSiteActions(),
    usageByTenant(),
  ]);
  return (
    <main className="admin-page admin-clients-page">
      <Clients
        tenants={tenants
          .map(({ id, slug, name, status, folderId, updatedAt }) => ({
            slug,
            name,
            status,
            folderId,
            updatedAt,
            lastAction: actions.get(id) ?? null,
          }))
          .sort(byLastAction)}
        folders={folders}
        summary={summary}
        usage={usage}
      />
    </main>
  );
}
