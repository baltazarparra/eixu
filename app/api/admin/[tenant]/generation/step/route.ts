import { after } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getRun, claimStep } from '@/lib/generation/runs';
import { runReservedStep } from '@/lib/generation/step';
import { verifyStepToken } from '@/lib/generation/token';
import { getTenantBySlug } from '@/lib/tenant-queries';

export const maxDuration = 800;

/**
 * Entrada HTTP autenticada para desenvolvimento e chamadas já em trânsito.
 * Em produção a fila privada recebe as novas etapas. A resposta HTTP sai
 * antes do trabalho; ambas as entradas usam a mesma reserva e executor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const token = request.headers.get('x-eixu-run');
  const authorizedStep = await verifyStepToken(token);
  if (!authorizedStep && !(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const body = authorizedStep
    ? null
    : ((await request.json().catch(() => null)) as {
        run?: unknown;
        hop?: unknown;
      } | null);
  const runId = authorizedStep?.runId ?? body?.run;
  const hop = authorizedStep?.hop ?? body?.hop;
  if (
    typeof runId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(runId) ||
    typeof hop !== 'number' ||
    !Number.isSafeInteger(hop) ||
    hop < 0
  )
    return new Response('Execução ou etapa inválida', { status: 400 });
  const run = runId ? await getRun(runId) : null;
  if (!run || run.tenantId !== tenant.id)
    return new Response('Execução não encontrada', { status: 404 });
  if (hop < run.hops) return Response.json({ duplicate: true });
  if (hop > run.hops)
    return new Response('Etapa fora de sequência', { status: 409 });
  if (!['queued', 'running', 'stopping'].includes(run.status))
    return Response.json({ run }, { status: 409 });

  // A leitura acima só explica recusas. O banco decide quem pode trabalhar;
  // quem perde a reserva não agenda callback nem encerra o run do vencedor.
  const claimed = await claimStep(run.id, hop);
  if (!claimed) return Response.json({ duplicate: true });
  after(() => runReservedStep(claimed, slug));

  return Response.json({ run: claimed }, { status: 202 });
}
