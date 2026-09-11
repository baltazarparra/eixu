import { isAuthenticated } from '@/lib/auth';
import { activeRun, recordEvent, requestStop } from '@/lib/generation/runs';
import { getTenantBySlug } from '@/lib/tenant-queries';

/**
 * Pausa entre etapas. Uma ferramenta já iniciada pode terminar e salvar: o
 * pedido não desfaz escrita, só impede a próxima etapa de começar.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const run = await activeRun(tenant.id);
  if (!run)
    return Response.json(
      { error: 'Não há geração em andamento para pausar.' },
      { status: 409 },
    );

  await requestStop(run.id);
  await recordEvent({
    runId: run.id,
    tenantId: tenant.id,
    phase: run.phase ?? 'briefing',
    kind: 'note',
    label: 'Pausa pedida: a etapa atual termina e a próxima não começa',
  });
  return Response.json({ ok: true });
}
