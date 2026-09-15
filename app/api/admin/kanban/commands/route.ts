import { kanbanCommandSchema } from '@/lib/kanban/schema';
import { executeKanbanCommand, KanbanError } from '@/lib/kanban/service';
import { guardKanbanRequest } from '@/app/api/admin/kanban/guard';
import { kanbanFailure, privateJson } from '@/app/api/admin/kanban/responses';

const MAX_BODY_BYTES = 32 * 1024;

async function readCommand(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
    throw new BodyTooLarge();
  if (!request.body) throw new SyntaxError('Corpo ausente');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) throw new BodyTooLarge();
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

class BodyTooLarge extends Error {}

export async function POST(request: Request): Promise<Response> {
  const denied = await guardKanbanRequest(request, true);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await readCommand(request);
  } catch (error) {
    return error instanceof BodyTooLarge
      ? privateJson(
          { error: 'Pedido muito grande.', code: 'VALIDATION_ERROR' },
          413,
        )
      : privateJson(
          { error: 'Pedido inválido.', code: 'VALIDATION_ERROR' },
          400,
        );
  }
  const parsed = kanbanCommandSchema.safeParse(body);
  if (!parsed.success)
    return privateJson(
      {
        error: 'Confira os dados e tente novamente.',
        code: 'VALIDATION_ERROR',
        fields: Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.'),
            issue.message,
          ]),
        ),
      },
      400,
    );

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const result = await executeKanbanCommand(parsed.data);
    console.info('[kanban] comando', {
      requestId,
      type: parsed.data.type,
      durationMs: Date.now() - startedAt,
      result: 'ok',
    });
    return privateJson(result);
  } catch (error) {
    console.info('[kanban] comando', {
      requestId,
      type: parsed.data.type,
      durationMs: Date.now() - startedAt,
      result: error instanceof KanbanError ? error.code : 'INTERNAL_ERROR',
    });
    return kanbanFailure(error, requestId);
  }
}
