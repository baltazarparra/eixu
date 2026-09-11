import { after } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { executeStep, settleRun } from '@/lib/generation/runner';
import { getRun, claimStep, finishRun } from '@/lib/generation/runs';
import { dispatchStep } from '@/lib/generation/dispatch';
import { verifyStepToken } from '@/lib/generation/token';
import { getTenantBySlug } from '@/lib/tenant-queries';

export const maxDuration = 800;

/**
 * Uma fase por invocação, encadeada pela própria rota. O laço vivia no
 * navegador: recarregar a página matava a sequência no meio, sem aviso.
 * A resposta sai antes do trabalho; o painel acompanha pelos eventos.
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
  const origin = claimed.origin;
  after(async () => {
    try {
      const outcome = await executeStep(claimed);
      await settleRun(claimed, outcome);
      if (outcome.kind !== 'continue') return;
      await dispatchStep({ origin, slug, runId: run.id, hop: claimed.hops });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha inesperada ao encadear a etapa.';
      console.error('[generation] encadeamento interrompido', {
        runId: run.id,
        error: message,
      });
      await finishRun(run.id, 'failed', message).catch(() => undefined);
    }
  });

  return Response.json({ run: claimed }, { status: 202 });
}
