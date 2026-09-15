import { KanbanError } from '@/lib/kanban/service';
import { PRIVATE_HEADERS } from '@/app/api/admin/kanban/guard';

export function privateJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

export function kanbanFailure(
  error: unknown,
  requestId = crypto.randomUUID(),
): Response {
  if (error instanceof KanbanError)
    return privateJson(
      {
        error: error.message,
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
        ...(error.currentRevision !== undefined
          ? { currentRevision: error.currentRevision }
          : {}),
      },
      error.status,
    );

  console.error('[kanban] falha', {
    requestId,
    error: error instanceof Error ? error.name : 'Unknown',
  });
  return privateJson(
    {
      error: 'Não foi possível carregar ou salvar o quadro. Tente novamente.',
      code: 'INTERNAL_ERROR',
      requestId,
    },
    500,
  );
}
