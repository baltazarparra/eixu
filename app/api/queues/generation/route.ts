import { handleCallback } from '@vercel/queue';
import { z } from 'zod';
import { ACTIVE_STATUS, claimStep, getRun } from '@/lib/generation/runs';
import { runReservedStep } from '@/lib/generation/step';
import { getTenantBySlug } from '@/lib/tenant-queries';

export const maxDuration = 800;

const stepMessage = z.object({
  runId: z.uuid(),
  slug: z.string().min(1).max(80),
  hop: z.number().int().nonnegative(),
});

/** O trigger torna esta função privada; o SDK recebe a mensagem pela fila. */
export const POST = handleCallback(
  async (message: unknown) => {
    const { runId, slug, hop } = stepMessage.parse(message);
    const [run, tenant] = await Promise.all([
      getRun(runId),
      getTenantBySlug(slug),
    ]);
    if (!run || !tenant || run.tenantId !== tenant.id) return;
    if (hop !== run.hops || !ACTIVE_STATUS.includes(run.status)) return;
    const claimed = await claimStep(run.id, hop);
    if (!claimed) return;
    // A confirmação da fila espera o trabalho e o envio seguinte; after()
    // aqui confirmaria a mensagem antes de a geração sequer terminar.
    await runReservedStep(claimed, slug);
  },
  {
    visibilityTimeoutSeconds: 840,
    retry: (_error, metadata) =>
      metadata.deliveryCount >= 5
        ? { acknowledge: true }
        : { afterSeconds: 30 },
  },
);
