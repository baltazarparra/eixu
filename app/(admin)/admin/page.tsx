import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { listTenants } from '@/lib/tenant-queries';
import { logoutAction } from './actions';
import { Clients } from './clients';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const tenants = await listTenants();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
      <header className="mb-12 flex items-center justify-between border-b py-6">
        <span className="text-sm font-semibold tracking-[0.12em]">
          EIXU{' '}
          <span className="ml-2 font-normal tracking-normal text-[var(--color-muted)]">
            Sites
          </span>
        </span>
        <form action={logoutAction}>
          <button className="admin-secondary">Sair</button>
        </form>
      </header>
      <Clients
        tenants={tenants.map(
          ({ slug, name, status, pageCount, leadCount }) => ({
            slug,
            name,
            status,
            pageCount,
            leadCount,
          }),
        )}
      />
    </main>
  );
}
