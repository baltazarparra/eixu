import { dispatchStep } from '@/lib/generation/dispatch';
import { executeStep, settleRun } from '@/lib/generation/runner';
import {
  failReservedStep,
  recordEvent,
  type GenerationRun,
} from '@/lib/generation/runs';

/** Só o dono da reserva executa e entrega o próximo salto. */
export async function runReservedStep(
  run: GenerationRun,
  slug: string,
): Promise<void> {
  try {
    const outcome = await executeStep(run);
    await settleRun(run, outcome);
    if (outcome.kind !== 'continue') return;
    await dispatchStep({
      origin: run.origin,
      slug,
      runId: run.id,
      hop: run.hops,
    });
  } catch (error) {
    console.error('[generation] encadeamento interrompido', {
      runId: run.id,
      error: error instanceof Error ? error.message : String(error),
    });
    const message =
      'Não foi possível continuar a geração. O progresso está salvo; use Tentar novamente para retomar.';
    // A fila pode ter aceitado o envio mesmo se a resposta se perdeu. Nesse
    // caso, não encerra uma etapa seguinte que já conquistou sua reserva.
    if (await failReservedStep(run.id, run.hops, message))
      await recordEvent({
        runId: run.id,
        tenantId: run.tenantId,
        phase: run.phase ?? '',
        kind: 'error',
        label: message,
      });
  }
}
