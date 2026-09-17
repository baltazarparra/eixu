import { receiptSchema } from './receipts.mjs';

/** A transação e a credencial pertencem ao operador, nunca ao app Premium. */
export async function importReceipts(
  connection,
  { tenant, lifecycle, receipts },
) {
  if (!['generator', 'converting', 'premium'].includes(lifecycle))
    throw new Error('Informe a fase real do trabalho.');
  if (!tenant || receipts.length > 20_000)
    throw new Error(
      'Cliente obrigatório; limite de 20.000 recibos por arquivo.',
    );
  const parsed = receipts.map((receipt) => receiptSchema.parse(receipt));
  await connection.query('BEGIN');
  try {
    const { rows } = await connection.query(
      'select id from tenants where slug = $1 for key share',
      [tenant],
    );
    if (rows.length !== 1) throw new Error('Cliente não encontrado.');
    const tenantId = rows[0].id;
    for (const receipt of parsed) {
      const result = await connection.query(
        `
        insert into ai_usage (
          tenant_id, operation_id, step, kind, model, status, source, lifecycle, external_id,
          input_tokens, output_tokens, total_tokens, cache_read_tokens, cache_write_tokens,
          reasoning_tokens, cost_usd, created_at, finished_at
        ) values ($1, $2, 0, $3, $4, 'recorded', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
        on conflict (source, external_id) where external_id is not null do update set
          input_tokens = greatest(ai_usage.input_tokens, excluded.input_tokens),
          output_tokens = greatest(ai_usage.output_tokens, excluded.output_tokens),
          total_tokens = greatest(ai_usage.total_tokens, excluded.total_tokens),
          cache_read_tokens = greatest(ai_usage.cache_read_tokens, excluded.cache_read_tokens),
          cache_write_tokens = greatest(ai_usage.cache_write_tokens, excluded.cache_write_tokens),
          reasoning_tokens = greatest(ai_usage.reasoning_tokens, excluded.reasoning_tokens),
          cost_usd = coalesce(excluded.cost_usd, ai_usage.cost_usd)
        where ai_usage.tenant_id = excluded.tenant_id
          and ai_usage.lifecycle = excluded.lifecycle
          and ai_usage.model = excluded.model and ai_usage.kind = excluded.kind
          and (ai_usage.cost_usd is null or excluded.cost_usd is null or ai_usage.cost_usd = excluded.cost_usd)
        returning id
      `,
        [
          tenantId,
          `${receipt.source}:${receipt.externalId}`,
          receipt.kind,
          receipt.model,
          receipt.source,
          lifecycle,
          receipt.externalId,
          receipt.inputTokens,
          receipt.outputTokens,
          receipt.totalTokens,
          receipt.cacheReadTokens,
          receipt.cacheWriteTokens,
          receipt.reasoningTokens,
          receipt.costUsd,
          receipt.occurredAt,
        ],
      );
      if (result.rows.length !== 1)
        throw new Error(
          'Recibo já atribuído a outro cliente, fase, modelo ou custo; importação cancelada.',
        );
    }
    await connection.query('COMMIT');
    return { tenant, lifecycle, receipts: parsed.length };
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  }
}
