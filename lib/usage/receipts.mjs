import { createHash } from 'node:crypto';
import { z } from 'zod';

const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
export const receiptSchema = z
  .object({
    source: z.enum(['codex', 'claude', 'external']),
    externalId: z.string().min(1).max(240),
    model: z.string().min(1).max(160),
    kind: z.enum(['desenvolvimento', 'ia-runtime', 'servico-externo']),
    occurredAt: z.iso.datetime({ offset: true }),
    inputTokens: counter,
    outputTokens: counter,
    totalTokens: counter,
    cacheReadTokens: counter,
    cacheWriteTokens: counter,
    reasoningTokens: counter,
    // Só custo atribuído pelo fornecedor. Preço de tabela não é fatura.
    costUsd: z.number().min(0).max(1_000_000).nullable(),
  })
  .strict();

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function sum(...values) {
  return values.every((value) => value !== null)
    ? values.reduce((a, b) => a + b, 0)
    : null;
}
function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Só extrai contadores. Conteúdo de mensagens nunca sai do arquivo local. */
export function parseReceipts(text, source) {
  const receipts = new Map();
  const warnings = new Set();
  let session = null;
  let model = 'não informado';
  let previous = null;
  let turn = null;
  let forked = false;
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      // Um escritor pode estar no meio da última linha. Nunca ignora corrupção no meio.
      if (index === lines.length - 1 && !text.endsWith('\n')) {
        warnings.add(
          'Última linha incompleta; sincronize novamente após o término.',
        );
        continue;
      }
      throw new Error(`JSON inválido na linha ${index + 1}.`);
    }
    let receipt;
    if (source === 'external') {
      receipt = receiptSchema.parse(event);
      if (receipt.source !== 'external')
        throw new Error('Recibo externo exige source=external.');
    } else if (source === 'codex') {
      const payload = event.payload;
      if (event.type === 'session_meta') {
        session = payload.id ?? payload.session_id;
        forked = Boolean(payload.forked_from_id || payload.forked_from);
      }
      if (event.type === 'turn_context') {
        model = payload.model ?? 'não informado';
        turn = payload.turn_id ?? turn;
      }
      if (event.type !== 'event_msg') continue;
      if (payload.type === 'task_started') turn = payload.turn_id ?? null;
      if (payload.type !== 'token_count' || !payload.info) continue;
      if (!session) throw new Error('Log Codex sem identidade da sessão.');
      if (forked)
        throw new Error(
          'Sessão bifurcada exige recibos externos com atribuição explícita; o histórico pode conter consumo herdado.',
        );
      const total = payload.info.total_token_usage;
      const usage = payload.info.last_token_usage;
      if (!total || !usage) {
        warnings.add(
          'Evento Codex sem contadores completos não foi importado.',
        );
        continue;
      }
      const signature = hash(total);
      if (signature === previous) continue;
      previous = signature;
      receipt = {
        source,
        externalId: `${session}:${hash([turn, total])}`,
        model,
        kind: 'desenvolvimento',
        occurredAt: event.timestamp,
        inputTokens: count(usage.input_tokens),
        outputTokens: count(usage.output_tokens),
        totalTokens: count(usage.total_tokens),
        cacheReadTokens: count(usage.cached_input_tokens),
        cacheWriteTokens: count(usage.cache_write_input_tokens),
        reasoningTokens: count(usage.reasoning_output_tokens),
        costUsd: null,
      };
    } else if (source === 'claude') {
      if (event.type !== 'assistant' || !event.message?.usage) continue;
      const message = event.message;
      const usage = message.usage;
      if (!message.id || !event.sessionId)
        throw new Error('Log Claude sem identidade da sessão/mensagem.');
      const input = sum(
        count(usage.input_tokens),
        count(usage.cache_read_input_tokens),
        count(usage.cache_creation_input_tokens),
      );
      const output = count(usage.output_tokens);
      receipt = {
        source,
        externalId: message.id,
        model: message.model ?? 'não informado',
        kind: 'desenvolvimento',
        occurredAt: event.timestamp,
        inputTokens: input,
        outputTokens: output,
        totalTokens: sum(input, output),
        cacheReadTokens: count(usage.cache_read_input_tokens),
        cacheWriteTokens: count(usage.cache_creation_input_tokens),
        reasoningTokens: count(usage.output_tokens_details?.thinking_tokens),
        costUsd: null,
      };
    } else throw new Error('Origem inválida.');
    receipt = receiptSchema.parse(receipt);
    const old = receipts.get(receipt.externalId);
    // Claude repete uma mensagem por bloco e pode completar seus contadores depois.
    // Preserve o instante inicial e recuse identidades inconsistentes.
    if (old) {
      if (old.model !== receipt.model || old.kind !== receipt.kind)
        throw new Error('Identidade de recibo inconsistente.');
      for (const field of [
        'inputTokens',
        'outputTokens',
        'totalTokens',
        'cacheReadTokens',
        'cacheWriteTokens',
        'reasoningTokens',
      ]) {
        if (
          old[field] !== null &&
          (receipt[field] === null || receipt[field] < old[field])
        )
          receipt[field] = old[field];
      }
      receipt.occurredAt = old.occurredAt;
    }
    receipts.set(receipt.externalId, receipt);
  }
  if (!receipts.size)
    warnings.add('Nenhum recibo reconhecido; isso não comprova consumo zero.');
  if (source !== 'external')
    warnings.add(
      'Custos monetários não vêm destes logs; permanecem não informados. Ferramentas e subagentes em outros arquivos precisam de seus próprios recibos.',
    );
  return { receipts: [...receipts.values()], warnings: [...warnings] };
}
