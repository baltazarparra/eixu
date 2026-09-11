import { send } from '@vercel/queue';
import { createStepToken } from '@/lib/generation/token';

/**
 * Cada etapa precisa de uma invocação própria. Na Vercel a fila entrega o
 * próximo salto: recursão HTTP pela mesma rota é bloqueada com 508. Fora da
 * plataforma, o servidor local mantém o transporte HTTP autenticado.
 */
export async function dispatchStep(input: {
  origin: string;
  slug: string;
  runId: string;
  hop: number;
}): Promise<void> {
  if (process.env.VERCEL === '1') {
    await send(
      'eixu-generation-steps',
      {
        slug: input.slug,
        runId: input.runId,
        hop: input.hop,
      },
      {
        idempotencyKey: `${input.runId}:${input.hop}`,
        retentionSeconds: 3600,
      },
    );
    return;
  }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const response = await fetch(
    `${input.origin}/api/admin/${input.slug}/generation/step`,
    {
      method: 'POST',
      headers: {
        'x-eixu-run': await createStepToken(input.runId, input.hop),
        ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok && response.status !== 202)
    throw new Error(`A etapa não pôde ser iniciada (${response.status}).`);
}
