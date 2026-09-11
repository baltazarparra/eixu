import { after } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { executeStep, settleRun } from '@/lib/generation/runner';
import { getRun, finishRun } from '@/lib/generation/runs';
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
  const authorizedRunId = await verifyStepToken(token);
  if (!authorizedRunId && !(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const runId =
    authorizedRunId ??
    ((await request.json().catch(() => ({}))) as { run?: string }).run;
  const run = runId ? await getRun(runId) : null;
  if (!run || run.tenantId !== tenant.id)
    return new Response('Execução não encontrada', { status: 404 });
  if (!['queued', 'running', 'stopping'].includes(run.status))
    return Response.json({ run }, { status: 409 });

  const origin = run.origin;
  after(async () => {
    try {
      const outcome = await executeStep(run);
      await settleRun(run, outcome);
      if (outcome.kind !== 'continue') return;
      await dispatchStep({ origin, slug, runId: run.id });
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

  return Response.json({ run }, { status: 202 });
}
