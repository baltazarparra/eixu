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
  type GenerationRun,
} from '@/lib/generation/runs';
import { phaseBlocker, phaseInstructions } from '@/lib/generation/context';
import {
  progressMarker,
  reviewRound,
  stalled,
  REVIEW_ROUNDS,
} from '@/lib/generation/marker';
import { listImages } from '@/lib/images/queries';
import {
  currentReview,
  reviewFingerprint,
  type ReviewReceipt,
} from '@/lib/review/state';
import { generationState } from '@/lib/sites/generation';
import {
  PHASE_LABEL,
  PHASE_MESSAGE,
  PHASE_STEPS,
  type Phase,
} from '@/lib/taste/phases';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import type { Tenant } from '@/lib/types';

/** Teto de fases-passo encadeadas. Cenas e revisão repetem a mesma fase. */
export const MAX_HOPS = 14;

/** Quanto o runner espera entre consultas ao pedido de pausa. */
const STOP_POLL_MS = 5_000;

export type StepOutcome =
  | { kind: 'continue'; phase: Phase }
  | { kind: 'done' }
  | { kind: 'paused' }
  | { kind: 'failed'; error: string };

/** Uma etapa que repete a anterior sem produzir nada para de verdade. */
function stallMessage(phase: Phase): string {
  return phase === 'revisao'
    ? 'A revisão terminou sem alterar o rascunho nem registrar leitura. Leia a última resposta no chat e ajuste por lá, ou use Tentar novamente.'
    : `A etapa "${PHASE_LABEL[phase]}" não avançou. Leia a última resposta no chat e continue de lá.`;
}

/** Teto de rodadas: a revisão não fecha sozinha e o operador decide o resto. */
function reviewCapMessage(
  blockingErrors: number,
  review: ReviewReceipt | null,
): string {
  const errors = Math.max(blockingErrors, review?.errors ?? 0);
  const situation = !review
    ? 'a conferência do rascunho atual não completou'
    : !review.complete || review.visual !== 'complete'
      ? 'a captura ou a crítica visual não completou; confira a prévia autenticada'
      : `${errors} pendência(s) continuam`;
  return `A revisão não fechou em ${REVIEW_ROUNDS} rodadas: ${situation}. Leia a última resposta no chat, ajuste por lá ou use Tentar novamente para abrir novas rodadas.`;
}

/** O SDK aborta o turno com este erro ao estourar o tempo total. */
function isTimeout(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'TimeoutError';
}

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
export async function markPhase(tenantId: string, phase: Phase): Promise<void> {
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

/**
 * O cadastro redireciona para o painel e a geração do cliente novo começa
 * sozinha, enquanto a leitura do perfil social ainda roda em `after()`. Um
 * perfil em leitura entra no prompt como lacuna: sem esta espera, o briefing
 * nasceria sem o Instagram que o operador acabou de informar.
 */
const SOCIAL_WAIT_MS = 20_000;
const SOCIAL_POLL_MS = 2_000;

const socialPending = (tenant: Tenant): boolean =>
  (tenant.brief.social as { status?: string } | undefined)?.status === 'lendo';

async function awaitSocialReading(
  slug: string,
  tenant: Tenant,
): Promise<Tenant> {
  const deadline = Date.now() + SOCIAL_WAIT_MS;
  let current = tenant;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, SOCIAL_POLL_MS));
    current = (await getTenantBySlug(slug)) ?? current;
    if (!socialPending(current)) return current;
  }
  // Esgotado o tempo, a fase segue: o prompt já trata perfil não lido como
  // lacuna declarada, e prender a execução seria pior que o briefing sem ele.
  return current;
}

/** Rótulo curto do que a fase produziu, para a linha do tempo do painel. */
function outcomeLabel(
  phase: Phase,
  tenant: Tenant,
  state: ReturnType<typeof generationState>,
  review: ReviewReceipt | null,
): string {
  if (phase === 'cenas')
    return `${state.coveredScenes} de ${state.targetScenes} cenas disponíveis`;
  if (phase === 'composicao')
    return `${state.organicPages} páginas orgânicas montadas`;
  if (phase === 'revisao') {
    if (state.reviewComplete) return 'Revisão concluída sem erros';
    if (!review) return 'Revisão do rascunho atual pendente';
    if (!review.complete || review.visual !== 'complete')
      return 'Captura ou crítica visual pendente';
    return `Revisão com ${Math.max(state.blockingErrors, review.errors)} pendência(s)`;
  }
  return tenant.brand.design ? 'Direção de arte definida' : 'Briefing revisado';
}

/**
 * Decide o fim do turno pelo estado gravado. Uma fase que repete a si mesma só
 * continua quando o marcador mostra trabalho novo; a revisão ainda respeita o
 * teto de rodadas, porque o operador precisa entrar em algum momento.
 */
function settleOutcome(input: {
  phase: Phase;
  marker: string;
  state: ReturnType<typeof generationState>;
  fingerprint: string;
  review: ReviewReceipt | null;
  stopRequested: boolean;
}): StepOutcome {
  const { phase, marker, state, fingerprint, stopRequested } = input;
  if (stopRequested) return { kind: 'paused' };
  if (state.next === 'pronto') return { kind: 'done' };
  if (state.next !== phase) return { kind: 'continue', phase: state.next };
  const next = progressMarker(phase, state, fingerprint, marker);
  if (stalled(marker, next))
    return { kind: 'failed', error: stallMessage(phase) };
  if (reviewRound(next) > REVIEW_ROUNDS)
    return {
      kind: 'failed',
      error: reviewCapMessage(state.blockingErrors, input.review),
    };
  return { kind: 'continue', phase };
}

/**
 * Executa o salto já reservado pela rota e devolve o que fazer em seguida. Não
 * depende de conexão do navegador: o painel lê o andamento pelos eventos.
 */
export async function executeStep(run: GenerationRun): Promise<StepOutcome> {
  if (run.status === 'stopping') return { kind: 'paused' };
  const tenantRow =
    await db()`select slug from tenants where id = ${run.tenantId}`;
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

  // Cenas e revisão repetem o nome da fase: o marcador carrega a cobertura ou
  // a leitura e a assinatura do rascunho, para distinguir avanço real de
  // etapa parada. A revisão observa, corrige e confere; ler o nome da fase
  // como repetição encerrava a geração logo depois do primeiro turno dela.
  const progress = progressMarker(
    phase,
    state,
    reviewFingerprint(tenant, pages, images),
    run.progress,
  );
  const round = reviewRound(progress);
  const stop = stalled(run.progress, progress)
    ? stallMessage(phase)
    : round > REVIEW_ROUNDS
      ? reviewCapMessage(
          state.blockingErrors,
          currentReview(tenant, pages, images),
        )
      : null;
  if (stop) {
    // Sem este registro, a parada aparecia só no cabeçalho do painel: a linha
    // do tempo terminava numa ferramenta concluída, sem dizer o que houve.
    await recordEvent({
      runId: run.id,
      tenantId: tenant.id,
      phase,
      kind: 'error',
      label: stop,
    });
    return { kind: 'failed', error: stop };
  }

  if (run.hops > MAX_HOPS)
    return {
      kind: 'failed',
      error:
        'A geração passou do limite de etapas sem concluir. Confira o chat e retome pelo ponto salvo.',
    };

  await saveProgress(run.id, phase, progress);
  await recordEvent({
    runId: run.id,
    tenantId: tenant.id,
    phase,
    kind: 'phase_start',
    label: round
      ? `${PHASE_LABEL[phase]} · rodada ${round} de ${REVIEW_ROUNDS}`
      : PHASE_LABEL[phase],
    ...(round ? { payload: { round } } : {}),
  });

  await markPhase(tenant.id, phase);
  await persistMessage(tenant.id, 'user', PHASE_MESSAGE[phase]);

  let ready = tenant;
  if (phase === 'briefing' && socialPending(tenant)) {
    await recordEvent({
      runId: run.id,
      tenantId: tenant.id,
      phase,
      kind: 'note',
      label: 'Aguardando a leitura do perfil de rede social',
    });
    ready = await awaitSocialReading(slug, tenant);
  }

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
  let timedOut = false;
  let spoken = '';
  let usage: Record<string, unknown> | undefined;
  try {
    const tools = buildTools(ready, {
      origin: run.origin,
      cookie: `eixu_admin=${await createSessionToken()}`,
      phase,
    });
    const agent = siteAgent({
      tenantId: tenant.id,
      tools,
      phase,
      shouldStop: () => stopRequested,
      instructions: phaseInstructions({
        tenant: ready,
        pages,
        images,
        phase,
        round,
      }),
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
            : describeTool(
                name,
                event.toolCall.input,
                output,
                'output-available',
              ),
          payload: { ok: !failed },
        }).catch(() => undefined);
      },
    });
    steps = result.steps.length;
    // O painel perdeu a contagem quando a geração saiu do navegador: o recibo
    // do stream não existe aqui. Só números e nome do modelo entram no evento.
    usage = {
      ...usageRecord(result.usage, model, phase, steps, startedAt),
      costUsd: sumGatewayCosts(
        result.steps.map((step) => step.providerMetadata?.gateway?.cost),
      ),
    };
    console.info('[generation] usage', {
      tenantId: tenant.id,
      runId: run.id,
      ...usage,
    });
    // O texto do último passo não é o turno inteiro: uma etapa que explica e
    // depois chama ferramenta perdia a explicação no histórico.
    spoken = result.steps
      .map((step) => step.text.trim())
      .filter(Boolean)
      .join('\n\n');
    const last = result.text.trim();
    if (last && !spoken.endsWith(last))
      spoken = [spoken, last].filter(Boolean).join('\n\n');
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
    // Tempo esgotado não apaga o que as ferramentas já salvaram: o turno
    // termina como qualquer outro e o progresso decide a continuação.
    if (!isTimeout(error)) {
      await recordEvent({
        runId: run.id,
        tenantId: tenant.id,
        phase,
        kind: 'error',
        label: `A etapa ${PHASE_LABEL[phase]} falhou`,
        payload: { error: message },
      });
      return { kind: 'failed', error: message };
    }
    timedOut = true;
  } finally {
    clearInterval(watcher);
  }

  const [freshPages, freshImages] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const fresh = (await getTenantBySlug(slug)) ?? tenant;
  const after = generationState(fresh, freshPages, freshImages);
  const review = currentReview(fresh, freshPages, freshImages);
  // A próxima fase é decidida aqui, não no salto seguinte: assim o recibo do
  // chat e o motivo no painel contam a mesma história, e uma etapa que não
  // produziu nada para com o motivo em vez de parecer interrompida.
  const outcome = settleOutcome({
    phase,
    marker: progress,
    state: after,
    fingerprint: reviewFingerprint(fresh, freshPages, freshImages),
    review,
    stopRequested,
  });
  const receipt = savedProgressMessage(
    workspaceState(fresh, freshPages, freshImages),
    outcome.kind === 'continue',
  );
  const fallback = timedOut
    ? `Este turno excedeu o tempo limite. ${receipt}`
    : steps >= PHASE_STEPS[phase]
      ? `Este turno atingiu o limite de passos. ${receipt}`
      : receipt;
  const needsReceipt =
    timedOut ||
    steps >= PHASE_STEPS[phase] ||
    outcome.kind === 'failed' ||
    outcome.kind === 'paused';
  const text = [
    spoken,
    !spoken || needsReceipt ? fallback : '',
    outcome.kind === 'failed' ? outcome.error : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  await persistMessage(tenant.id, 'assistant', text);
  await recordEvent({
    runId: run.id,
    tenantId: tenant.id,
    phase,
    kind: 'phase_end',
    label: outcomeLabel(phase, fresh, after, review),
    payload: {
      steps,
      next: after.next,
      ...(usage ? { usage } : {}),
      ...(timedOut ? { timeout: true } : {}),
    },
  });
  if (outcome.kind === 'failed')
    await recordEvent({
      runId: run.id,
      tenantId: tenant.id,
      phase,
      kind: 'error',
      label: outcome.error,
    });
  return outcome;
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
