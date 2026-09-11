import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { listTenants } from '@/lib/tenant-queries';
import { operationSummary } from '@/lib/admin/queries';
import { Clients } from './clients';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const [tenants, summary] = await Promise.all([
    listTenants(),
    operationSummary(),
  ]);
  return (
    <main className="admin-page admin-clients-page">
      <Clients
        tenants={tenants.map(
          ({ slug, name, status, pageCount, leadCount, updatedAt }) => ({
            slug,
            name,
            status,
            pageCount,
            leadCount,
            updatedAt,
          }),
        )}
        summary={summary}
      />
    </main>
  );
}
