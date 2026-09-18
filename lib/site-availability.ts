import { db } from '@/lib/db';
import { tenantFromRow } from '@/lib/tenant-queries';
import type { Tenant } from '@/lib/types';

/**
 * A API central só aceita tráfego de um tenant cujo release ativo e o estado
 * administrativo concordam. O domínio sozinho não prova publicação.
 */
export async function publicTenantBySlug(slug: string): Promise<Tenant | null> {
  const rows = (await db()`
    select tenant.*
    from tenants tenant
    join studio_projects project on project.tenant_id = tenant.id
    join studio_releases release on release.id = project.active_release_id
    where tenant.slug = ${slug}
      and tenant.status = 'published'
      and project.status = 'published'
      and release.status = 'active'
    limit 1
  `) as Record<string, unknown>[];
  return rows[0] ? tenantFromRow(rows[0]) : null;
}
