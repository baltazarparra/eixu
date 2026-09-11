import { siteAgent } from '@/lib/ai/agent';
import { savedProgressMessage } from '@/lib/ai/chat-progress';
import { productModel } from '@/lib/ai/models';
import { buildTools } from '@/lib/ai/tools';
import { sumGatewayCosts, usageRecord } from '@/lib/ai/usage';
import { workspaceState } from '@/lib/admin/state';
import { createSessionToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { describeTool } from '@/lib/generation/labels';
import {
  finishRun,
  isStopping,
  heartbeat,
  recordEvent,
  saveProgress,
  startPhase,
  type GenerationRun,
} from '@/lib/generation/runs';
import { phaseBlocker, phaseInstructions } from '@/lib/generation/context';
import { listImages } from '@/lib/images/queries';
import { generationState } from '@/lib/sites/generation';
import {
  PHASE_LABEL,
  PHASE_MESSAGE,
  PHASE_STEPS,
  type Phase,
} from '@/lib/taste/phases';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import type { Tenant } from '@/lib/types';

/** Teto de fases-passo encadeadas. A etapa de cenas repete a mesma fase. */
export const MAX_HOPS = 14;

/** Quanto o runner espera entre consultas ao pedido de pausa. */
const STOP_POLL_MS = 5_000;

export type StepOutcome =
  | { kind: 'continue'; phase: Phase }
  | { kind: 'done' }
  | { kind: 'paused' }
  | { kind: 'claimed' }
  | { kind: 'failed'; error: string };

async function persistMessage(
  tenantId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  await db()`
    insert into chat_messages (tenant_id, role, content, channel)
    values (${tenantId}, ${role}, ${content}, 'site')
  `;
}

/**
 * Só a chave da fase. O merge `brief || {generation}` sobrescrevia o objeto
 * inteiro e apagava o recibo de revisão gravado por outra execução.
 */
export async function markPhase(
  tenantId: string,
  phase: Phase,
): Promise<void> {
  await db()`
    update tenants
    set brief = jsonb_set(
          jsonb_set(
            jsonb_set(
              coalesce(brief, '{}'::jsonb),
              '{generation}',
              coalesce(brief -> 'generation', '{}'::jsonb),
              true
            ),
            '{generation,phase}', to_jsonb(${phase}::text), true
          ),
          '{generation,updatedAt}', to_jsonb(now()), true
        ),
        updated_at = now()
    where id = ${tenantId}
  `;
}

/** Rótulo curto do que a fase produziu, para a linha do tempo do painel. */
function outcomeLabel(phase: Phase, tenant: Tenant, state: ReturnType<typeof generationState>): string {
  if (phase === 'cenas')
    return `${state.coveredScenes} de ${state.targetScenes} cenas disponíveis`;
  if (phase === 'composicao')
    return `${state.organicPages} páginas orgânicas montadas`;
  if (phase === 'revisao')
    return state.reviewComplete
      ? 'Revisão concluída sem erros'
      : `Revisão com ${state.blockingErrors} pendência(s)`;
  return tenant.brand.design ? 'Direção de arte definida' : 'Briefing revisado';
}

/**
 * Executa uma fase inteira no servidor e devolve o que fazer em seguida. Não
 * depende de conexão do navegador: o painel lê o andamento pelos eventos.
 */
export async function executeStep(run: GenerationRun): Promise<StepOutcome> {
  const tenantRow = await db()`select slug from tenants where id = ${run.tenantId}`;
  const slug = (tenantRow as { slug: string }[])[0]?.slug;
  if (!slug) return { kind: 'failed', error: 'Cliente não encontrado.' };

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { kind: 'failed', error: 'Cliente não encontrado.' };

  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const state = generationState(tenant, pages, images);
  if (state.next === 'pronto') return { kind: 'done' };

  const phase = state.next;
  const blocker = phaseBlocker(phase, tenant, pages);
  if (blocker) return { kind: 'failed', error: blocker };

  // A etapa de cenas repete o nome da fase a cada foto: o marcador inclui a
  // cobertura para distinguir avanço real de etapa parada.
  const progress =
    phase === 'cenas' ? `${phase}:${state.coveredScenes}` : phase;
  if (run.progress === progress)
    return {
      kind: 'failed',
      error: `A etapa "${PHASE_LABEL[phase]}" não avançou. Leia a última resposta no chat e continue de lá.`,
    };

  if (run.hops >= MAX_HOPS)
    return {
      kind: 'failed',
      error:
        'A geração passou do limite de etapas sem concluir. Confira o chat e retome pelo ponto salvo.',
    };

  const started = await startPhase(run.id, phase, run.hops);
  if (!started) {
    // Outra invocação já assumiu esta etapa: encadeamento repetido não abre
    // uma segunda execução paga da mesma fase.
    console.warn('[generation] etapa já reivindicada', {
      runId: run.id,
      hops: run.hops,
    });
    return { kind: 'claimed' };
  }
  await saveProgress(run.id, progress);
  await recordEvent({
    runId: run.id,
    tenantId: tenant.id,
    phase,
    kind: 'phase_start',
    label: PHASE_LABEL[phase],
  });

  await markPhase(tenant.id, phase);
  await persistMessage(tenant.id, 'user', PHASE_MESSAGE[phase]);

  let stopRequested = false;
  const watcher = setInterval(() => {
    void isStopping(run.id)
      .then((stopping) => {
        if (stopping) stopRequested = true;
        // Mesmo laço mantém o sinal de vida: uma composição passa minutos
        // sem evento de ferramenta e seria dada como órfã.
        return heartbeat(run.id);
      })
      .catch(() => undefined);
  }, STOP_POLL_MS);

  const model = productModel();
  const startedAt = Date.now();
  let steps = 0;
  try {
    const tools = buildTools(tenant, {
      origin: run.origin,
      cookie: `eixu_admin=${await createSessionToken()}`,
      phase,
    });
    const agent = siteAgent({
      tenantId: tenant.id,
      tools,
      phase,
      shouldStop: () => stopRequested,
      instructions: phaseInstructions({ tenant, pages, images, phase }),
    });
    const result = await agent.generate({
      messages: [{ role: 'user', content: PHASE_MESSAGE[phase] }],
      onToolExecutionStart: (event) => {
        const name = event.toolCall.toolName;
        void recordEvent({
          runId: run.id,
          tenantId: tenant.id,
          phase,
          kind: 'tool_start',
          tool: name,
          label: describeTool(name, event.toolCall.input, undefined, 'pending'),
        }).catch(() => undefined);
      },
      onToolExecutionEnd: (event) => {
        const name = event.toolCall.toolName;
        const failed = event.toolOutput.type === 'tool-error';
        const output = failed ? undefined : event.toolOutput.output;
        void recordEvent({
          runId: run.id,
          tenantId: tenant.id,
          phase,
          kind: 'tool_end',
          tool: name,
          label: failed
            ? 'Esta tentativa foi recusada. O agente pode corrigir e tentar novamente.'
            : describeTool(name, event.toolCall.input, output, 'output-available'),
          payload: { ok: !failed },
        }).catch(() => undefined);
      },
    });
    steps = result.steps.length;
    console.info('[generation] usage', {
      tenantId: tenant.id,
      runId: run.id,
      ...usageRecord(result.usage, model, phase, steps, startedAt),
      costUsd: sumGatewayCosts(
        result.steps.map((step) => step.providerMetadata?.gateway?.cost),
      ),
    });

    const [freshPages, freshImages] = await Promise.all([
      listPages(tenant.id),
      listImages(tenant.id),
    ]);
    const fresh = (await getTenantBySlug(slug)) ?? tenant;
    const after = generationState(fresh, freshPages, freshImages);
    // O texto do último passo não é o turno inteiro: uma etapa que explica e
    // depois chama ferramenta perdia a explicação no histórico.
    const spoken = result.steps
      .map((step) => step.text.trim())
      .filter(Boolean)
      .join('\n\n');
    const receipt = savedProgressMessage(
      workspaceState(fresh, freshPages, freshImages),
    );
    const text =
      result.text.trim() && spoken.endsWith(result.text.trim())
        ? spoken
        : [spoken, result.text.trim()].filter(Boolean).join('\n\n') ||
          (steps >= PHASE_STEPS[phase]
            ? `Este turno atingiu o limite de passos. ${receipt}`
            : receipt);
    await persistMessage(tenant.id, 'assistant', text);
    await recordEvent({
      runId: run.id,
      tenantId: tenant.id,
      phase,
      kind: 'phase_end',
      label: outcomeLabel(phase, fresh, after),
      payload: { steps, next: after.next },
    });

    if (stopRequested) return { kind: 'paused' };
    if (after.next === 'pronto') return { kind: 'done' };
    return { kind: 'continue', phase: after.next };
  } catch (error) {
    if (stopRequested) {
      await recordEvent({
        runId: run.id,
        tenantId: tenant.id,
        phase,
        kind: 'stopped',
        label: 'Geração pausada pelo operador',
      });
      return { kind: 'paused' };
    }
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message.slice(0, 200)}`
        : 'Falha inesperada na geração.';
    console.error('[generation] falha na fase', {
      tenantId: tenant.id,
      runId: run.id,
      phase,
      error: message,
    });
    await recordEvent({
      runId: run.id,
      tenantId: tenant.id,
      phase,
      kind: 'error',
      label: `A etapa ${PHASE_LABEL[phase]} falhou`,
      payload: { error: message },
    });
    return { kind: 'failed', error: message };
  } finally {
    clearInterval(watcher);
  }
}

/** Fecha o run conforme o resultado da fase. */
export async function settleRun(
  run: GenerationRun,
  outcome: StepOutcome,
): Promise<void> {
  if (outcome.kind === 'done') {
    await finishRun(run.id, 'done');
    await recordEvent({
      runId: run.id,
      tenantId: run.tenantId,
      phase: run.phase ?? 'revisao',
      kind: 'note',
      label: 'Geração concluída',
    });
    return;
  }
  if (outcome.kind === 'paused') {
    await finishRun(run.id, 'paused');
    return;
  }
  if (outcome.kind === 'failed') {
    await finishRun(run.id, 'failed', outcome.error);
  }
}
