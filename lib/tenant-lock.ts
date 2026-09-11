import type { Client } from '@neondatabase/serverless';
import { transaction } from '@/lib/db';

type LockedTenant = { id: string; slug: string; name: string; status: string };

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
    const { rows } = await connection.query<LockedTenant>(
      `SELECT id, slug, name, status FROM tenants WHERE id = $1 ${lock}`,
      [tenantId],
    );
    if (!rows[0]) throw new TenantRemovedError();
    return run(rows[0], connection);
  });
}
