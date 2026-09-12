import { cache } from 'react';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';

// Deduplicação apenas dentro do render autenticado, sem cache entre sessões.
export const adminTenant = cache(getTenantBySlug);
export async function operationSummary() {
  const [row] = (await db()`select
    (select count(*) from leads where created_at >= now() - interval '30 days') as leads,
    (select count(*) from generation_runs where status in ('queued', 'running', 'stopping')) as running`) as {
    leads: number;
    running: number;
  }[];
  return { leads30d: Number(row.leads), running: Number(row.running) };
}
