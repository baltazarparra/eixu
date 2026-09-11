import {
  activeRun,
  createRun,
  expireStaleRun,
  finishRun,
  recordEvent,
  type GenerationRun,
} from '@/lib/generation/runs';
import { dispatchStep } from '@/lib/generation/dispatch';
import { listImages } from '@/lib/images/queries';
import { generationState } from '@/lib/sites/generation';
import { PHASE_LABEL } from '@/lib/taste/phases';
import { listPages } from '@/lib/tenant-queries';
import type { Tenant } from '@/lib/types';

export type StartResult =
  | { ok: true; run: GenerationRun; phase: string }
  | { ok: false; status: number; error: string; run?: GenerationRun };

/**
 * Abre a execução e dispara a primeira etapa. O painel e o chat entram pelo
 * mesmo caminho: o botão Continuar e a palavra "continuar" digitada fazem a
 * mesma coisa, e nenhum dos dois depende da aba continuar aberta.
 */
export async function startGeneration(input: {
  tenant: Tenant;
  origin: string;
}): Promise<StartResult> {
  const { tenant, origin } = input;
  const existing = await expireStaleRun(await activeRun(tenant.id));
  if (existing)
    return {
      ok: false,
      status: 409,
      error: 'A geração deste cliente já está em andamento.',
      run: existing,
    };

  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const state = generationState(tenant, pages, images);
  if (state.next === 'pronto')
    return {
      ok: false,
      status: 409,
      error: 'A geração deste cliente já está concluída.',
    };

  const run = await createRun({
    tenantId: tenant.id,
    origin,
    phase: state.next,
  });
  if (!run)
    return {
      ok: false,
      status: 409,
      error: 'A geração deste cliente já está em andamento.',
    };

  await recordEvent({
    runId: run.id,
    tenantId: tenant.id,
    phase: state.next,
    kind: 'note',
    label: `Geração iniciada em ${PHASE_LABEL[state.next]}`,
  });

  try {
    await dispatchStep({
      origin,
      slug: tenant.slug,
      runId: run.id,
      hop: run.hops,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'A etapa não pôde ser iniciada.';
    await finishRun(run.id, 'failed', message);
    return { ok: false, status: 502, error: message };
  }

  return { ok: true, run, phase: PHASE_LABEL[state.next] };
}
