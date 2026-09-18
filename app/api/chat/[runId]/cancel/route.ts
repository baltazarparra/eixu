import { getRun } from 'workflow/api';
import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { getTenantBySlug } from '@/lib/tenant-queries';
import {
  finishStudioRun,
  requestStudioRunCancellation,
  studioRunById,
} from '@/lib/studio/runs';
import {
  parseBoundedPublicJson,
  PublicInputTooLargeError,
} from '@/lib/public-input.mjs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const operator = await currentUser();
  if (!operator) return new Response('Não autorizado', { status: 401 });
  const { runId } = await params;
  let body: { tenant?: unknown };
  try {
    body = (await parseBoundedPublicJson(request, 8_000)) as {
      tenant?: unknown;
    };
  } catch (error) {
    return Response.json(
      { error: 'Pedido de cancelamento inválido.' },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  if (typeof body.tenant !== 'string')
    return Response.json({ error: 'Cliente inválido.' }, { status: 400 });
  const tenant = await getTenantBySlug(body.tenant);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  const existing = await studioRunById(runId);
  if (!existing || existing.tenantId !== tenant.id)
    return Response.json(
      { error: 'Execução não encontrada.' },
      { status: 404 },
    );
  if (['succeeded', 'failed', 'cancelled'].includes(existing.status))
    return Response.json({ status: existing.status });

  const run = await requestStudioRunCancellation({
    runId,
    tenantId: tenant.id,
  });
  if (!run)
    return Response.json(
      { error: 'Execução não encontrada.' },
      { status: 404 },
    );
  if (['succeeded', 'failed', 'cancelled'].includes(run.status))
    return Response.json({ status: run.status });
  if (run?.workflowRunId)
    await getRun(run.workflowRunId)
      .cancel({ cancelReason: `Cancelado pelo operador ${operator.login}` })
      .catch(() => undefined);
  await finishStudioRun({
    runId,
    status: 'cancelled',
    error: 'Cancelado pelo operador.',
  });
  await recordActivity({
    actor: operator,
    tenant,
    action: 'studio.turn.cancel',
    summary: `${operator.name} cancelou um turno do estúdio`,
    resourceType: 'studio_run',
    resourceId: runId,
    operationId: `studio-run-cancel:${runId}`,
  }).catch(() => undefined);
  return Response.json({ status: 'cancelled' });
}
