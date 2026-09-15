import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { listSiteFolders, listTenants } from '@/lib/tenant-queries';
import { operationSummary } from '@/lib/admin/queries';
import { Clients } from './clients';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect('/admin/login?returnTo=/admin');
  const [tenants, folders, summary] = await Promise.all([
    listTenants(),
    listSiteFolders(),
    operationSummary(),
  ]);
  return (
    <main className="admin-page admin-clients-page">
      <Clients
        tenants={tenants.map(
          ({
            slug,
            name,
            status,
            folderId,
            pageCount,
            leadCount,
            updatedAt,
          }) => ({
            slug,
            name,
            status,
            folderId,
            pageCount,
            leadCount,
            updatedAt,
          }),
        )}
        folders={folders}
        summary={summary}
      />
    </main>
  );
}
