import type { Client } from '@neondatabase/serverless';
import { transaction } from '@/lib/db';

type LockedTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
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
    // Operações do Studio bloqueiam primeiro o projeto. A exclusão segue a
    // mesma ordem para não criar ciclo entre a FK do tenant e o projeto.
    if (mode === 'delete')
      await connection.query(
        `select id from studio_projects where tenant_id = $1 for update`,
        [tenantId],
      );
    const lock = mode === 'upload' ? 'FOR KEY SHARE' : 'FOR UPDATE';
    const result = await connection.query<{
      id: string;
      slug: string;
      name: string;
      status: string;
    }>(
      `SELECT id, slug, name, status
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
      },
      connection,
    );
  });
}
