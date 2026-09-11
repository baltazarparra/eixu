import { cache } from 'react';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';

// Deduplicação apenas dentro do render autenticado, sem cache entre sessões.
export const adminTenant = cache(getTenantBySlug);
export const railClients = cache(async () => {
  const rows =
    (await db()`select slug, name, status from tenants order by updated_at desc, slug asc`) as {
      slug: string;
      name: string;
      status: string;
    }[];
  return rows.map((row) => ({
    slug: String(row.slug),
    name: String(row.name),
    status: String(row.status),
  }));
});

export async function operationSummary() {
  const [row] = (await db()`select
    (select count(*) from leads where created_at >= now() - interval '30 days') as leads,
    (select count(*) from generation_runs where status in ('queued', 'running', 'stopping')) as running`) as {
    leads: number;
    running: number;
  }[];
  return { leads30d: Number(row.leads), running: Number(row.running) };
}
