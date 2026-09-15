import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import {
  ACTIVE_STATUS,
  activeRun,
  expireStaleRun,
  recordEvent,
  requestStop,
} from '@/lib/generation/runs';
import { getTenantBySlug } from '@/lib/tenant-queries';

/**
 * Pausa entre etapas. Uma ferramenta já iniciada pode terminar e salvar: o
 * pedido não desfaz escrita, só impede a próxima etapa de começar.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const run = await expireStaleRun(await activeRun(tenant.id));
  if (!run || !ACTIVE_STATUS.includes(run.status))
    return Response.json(
      { error: 'Não há geração em andamento para pausar.' },
      { status: 409 },
    );

  await requestStop(run.id, user);
  await recordEvent({
    runId: run.id,
    tenantId: tenant.id,
    phase: run.phase ?? 'briefing',
    kind: 'note',
    workerHeartbeat: false,
    label: 'Pausa pedida: a etapa atual termina e a próxima não começa',
  });
  await recordActivity({
    actor: user,
    tenant,
    action: 'generation.stop',
    summary: `${user.name} pediu a pausa da geração de ${tenant.name}`,
    resourceType: 'generation_run',
    resourceId: run.id,
    operationId: `generation:stop:${run.id}:${user.id}`,
  });
  return Response.json({ ok: true });
}
