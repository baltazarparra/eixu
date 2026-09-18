import { createUIMessageStreamResponse } from 'ai';
import { getRun } from 'workflow/api';
import { currentUser } from '@/lib/auth';
import { studioRunByWorkflowId } from '@/lib/studio/runs';
import { studioUIMessageStream } from '@/lib/studio/ui-stream';

export const maxDuration = 800;

function startIndex(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get('startIndex') ?? '0';
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!(await currentUser()))
    return new Response('Não autorizado', { status: 401 });
  const index = startIndex(request);
  if (index === null)
    return Response.json({ error: 'Cursor inválido.' }, { status: 400 });
  const { runId: workflowRunId } = await params;
  const studioRun = await studioRunByWorkflowId(workflowRunId);
  if (!studioRun)
    return Response.json(
      { error: 'Execução não encontrada.' },
      { status: 404 },
    );
  try {
    const workflowRun = getRun(workflowRunId);
    if (!(await workflowRun.exists))
      return Response.json(
        { error: 'Stream não encontrado.' },
        { status: 404 },
      );
    return createUIMessageStreamResponse({
      stream: studioUIMessageStream(workflowRun, index),
      headers: {
        'x-workflow-run-id': workflowRunId,
        'x-studio-run-id': studioRun.id,
      },
    });
  } catch {
    return Response.json({ error: 'Stream indisponível.' }, { status: 404 });
  }
}
