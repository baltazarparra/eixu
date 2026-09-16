import type { Client } from '@neondatabase/serverless';
import { transaction } from '@/lib/db';

type LockedTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
  maintenanceMode: 'generator' | 'converting' | 'premium';
};

export class TenantRemovedError extends Error {
  constructor() {
    super('Cliente não encontrado ou já excluído.');
  }
}

/**
 * Uploads podem coexistir, mas a exclusão aguarda todos os puts e impede novos.
 * O lock dura até o commit, inclusive durante a chamada ao Blob. Depois da
 * exclusão, quem aguardava recebe zero linhas e não chega a escrever arquivos.
 */
export function withTenantLock<T>(
  tenantId: string,
  mode: 'upload' | 'delete',
  run: (tenant: LockedTenant, connection: Client) => Promise<T>,
): Promise<T> {
  return transaction(async (connection) => {
    const lock = mode === 'upload' ? 'FOR KEY SHARE' : 'FOR UPDATE';
    const result = await connection.query<{
      id: string;
      slug: string;
      name: string;
      status: string;
      maintenance_mode: LockedTenant['maintenanceMode'];
    }>(
      `SELECT id, slug, name, status, maintenance_mode
       FROM tenants WHERE id = $1 ${lock}`,
      [tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new TenantRemovedError();
    return run(
      {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        maintenanceMode: row.maintenance_mode ?? 'generator',
      },
      connection,
    );
  });
}
