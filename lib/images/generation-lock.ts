import { transaction } from '@/lib/db';

/**
 * Uma geração por tenant, inclusive entre instâncias serverless. O advisory
 * lock não conflita com os locks de linha usados pelos uploads da própria
 * geração. A transação libera o lock no sucesso, na falha ou na desconexão.
 * Retorna null imediatamente quando outra requisição já está gerando.
 */
export function withSceneGenerationLock<T>(
  tenantId: string,
  run: () => Promise<T>,
): Promise<T | null> {
  return transaction(async (connection) => {
    const { rows } = await connection.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, 0)) AS acquired',
      [`eixu:scene-generation:${tenantId}`],
    );
    if (!rows[0]?.acquired) return null;
    return run();
  });
}
