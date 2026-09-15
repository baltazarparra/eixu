import type { Tenant } from '@/lib/types';

/** Só o estado publicado pode responder nas superfícies abertas ao visitante. */
export function isTenantPublic<T extends Pick<Tenant, 'status'>>(
  tenant: T | null | undefined,
): tenant is T & { status: 'published' } {
  return tenant?.status === 'published';
}
