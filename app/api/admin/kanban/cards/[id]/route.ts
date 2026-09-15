import { z } from 'zod';
import { readKanbanCard } from '@/lib/kanban/queries';
import { guardKanbanRequest } from '@/app/api/admin/kanban/guard';
import { kanbanFailure, privateJson } from '@/app/api/admin/kanban/responses';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await guardKanbanRequest(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return privateJson(
      { error: 'Cartão inválido.', code: 'VALIDATION_ERROR' },
      400,
    );
  try {
    const detail = await readKanbanCard(id);
    return detail
      ? privateJson(detail)
      : privateJson(
          { error: 'Cartão não encontrado.', code: 'NOT_FOUND' },
          404,
        );
  } catch (error) {
    return kanbanFailure(error);
  }
}
