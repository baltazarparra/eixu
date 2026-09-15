import { readKanbanBoard } from '@/lib/kanban/queries';
import { guardKanbanRequest } from '@/app/api/admin/kanban/guard';
import { kanbanFailure, privateJson } from '@/app/api/admin/kanban/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const denied = await guardKanbanRequest(request);
  if (denied) return denied;
  try {
    return privateJson(await readKanbanBoard());
  } catch (error) {
    return kanbanFailure(error);
  }
}
