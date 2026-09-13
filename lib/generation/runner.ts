import { randomUUID } from 'node:crypto';
import { siteAgent } from '@/lib/ai/agent';
import { savedProgressMessage } from '@/lib/ai/chat-progress';
import {
  HARNESS_VERSION,
  LOGO_STUDIO_TIMEOUT_MS,
  productModel,
} from '@/lib/ai/models';
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
import { progressMarker, stalled } from '@/lib/generation/marker';
import type { GenerationDelivery } from '@/lib/generation/delivery';
import { listImages } from '@/lib/images/queries';
import { reviewFingerprint } from '@/lib/review/state';
import { sceneCoverage } from '@/lib/images/scene-plan';
import { generationState, plannedScenes } from '@/lib/sites/generation';
import { availablePhotos } from '@/lib/taste/metrics';
import {
  PHASE_LABEL,
  PHASE_MESSAGE,
  PHASE_STEPS,
  type Phase,
} from '@/lib/taste/phases';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import type { LogoStudioState, Tenant } from '@/lib/types';
import { runLogoStudio, shouldRunLogoStudio } from '@/lib/images/logo-studio';

/** Teto de fases-passo encadeadas. Cenas podem precisar de lotes adicionais. */
export const MAX_HOPS = 14;
export const GENERATION_FLOW_VERSION = 'admin-v4-human-review';

/** Quanto o runner espera entre consultas ao pedido de pausa. */
const STOP_POLL_MS = 5_000;

export type StepOutcome =
  | { kind: 'continue'; phase: Phase }
  | { kind: 'done' }
  | { kind: 'paused' }
  | { kind: 'failed'; error: string };

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * O planejamento novo já traz os pedidos semânticos. Quando todos existem, o
 * runner pode abrir o estúdio diretamente e elimina um turno de coordenação.
 * Perfis antigos continuam no agente até serem recompostos.
 */
function directSceneBatch(
  tenant: Tenant,
  images: Awaited<ReturnType<typeof listImages>>,
) {
  const { missing } = sceneCoverage(
    plannedScenes(tenant),
    availablePhotos(images),
  );
  if (!missing.length || missing.some((scene) => !scene.request)) return null;
  return {
    scenes: missing.map((scene) => ({
      request: scene.request!,
      role: scene.role,
      targetBlock: scene.targetBlock,
      ratio: scene.ratio,
    })),
  };
}

/** Uma etapa que repete a anterior sem produzir nada para de verdade. */
function stallMessage(phase: Phase): string {
  return `A etapa "${PHASE_LABEL[phase]}" não avançou. Leia a última resposta no chat e continue de lá.`;
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

/** Guarda a entrega sem sobrescrever o recibo visual, a fase ou suas pendências. */
async function markDelivered(tenant: Tenant): Promise<Tenant> {
  const delivery: GenerationDelivery = {
    completedAt: new Date().toISOString(),
  };
  await db()`
    update tenants
    set brief = jsonb_set(
          coalesce(brief, '{}'::jsonb), '{generation}',
          coalesce(brief -> 'generation', '{}'::jsonb)
            || ${JSON.stringify({ delivery })}::jsonb, true
        ), updated_at = now()
    where id = ${tenant.id}
  `;
  return {
    ...tenant,
    brief: {
      ...tenant.brief,
      generation: {
        ...(tenant.brief.generation as Record<string, unknown> | undefined),
        delivery,
      },
    },
  };
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
): string {
  if (phase === 'cenas')
    return `${state.coveredScenes} de ${state.targetScenes} cenas disponíveis`;
  if (phase === 'composicao')
    return `${state.organicPages} páginas orgânicas montadas`;
  return tenant.brand.design ? 'Direção de arte definida' : 'Briefing revisado';
}

/**
 * Decide o fim do turno pelo estado gravado. Uma fase que repete a si mesma só
 * continua quando o marcador mostra trabalho novo. Páginas geradas encerram
 * a execução; a revisão humana começa na prévia.
 */
function settleOutcome(input: {
  phase: Phase;
  marker: string;
  state: ReturnType<typeof generationState>;
  fingerprint: string;
  stopRequested: boolean;
}): StepOutcome {
  const { phase, marker, state, fingerprint, stopRequested } = input;
  if (stopRequested) return { kind: 'paused' };
  if (state.next === 'pronto') return { kind: 'done' };
  if (state.next !== phase) return { kind: 'continue', phase: state.next };
  const next = progressMarker(phase, state, fingerprint, marker);
  if (stalled(marker, next))
    return { kind: 'failed', error: stallMessage(phase) };
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

  // O marcador legado continua legível ao retomar execuções anteriores.
  // A próxima fase vem do conteúdo persistido, nunca do checkpoint antigo.
  const progress = progressMarker(
    phase,
    state,
    reviewFingerprint(tenant, pages, images),
    run.progress,
  );
  const stop = stalled(run.progress, progress) ? stallMessage(phase) : null;
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
  const model = productModel();
  const sceneBatch =
    phase === 'cenas' ? directSceneBatch(tenant, images) : null;
  await recordEvent({
    runId: run.id,
    tenantId: tenant.id,
    phase,
    kind: 'phase_start',
    label: PHASE_LABEL[phase],
    payload: {
      flowVersion: GENERATION_FLOW_VERSION,
      harnessVersion: HARNESS_VERSION,
      deployment: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      model: sceneBatch ? 'image-pipeline' : model,
      queueMs:
        run.hops === 1
          ? Math.max(0, Date.now() - new Date(run.startedAt).getTime())
          : 0,
    },
  });

  await markPhase(tenant.id, phase);

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
  const logoAbort = new AbortController();
  let logoJob: Promise<LogoStudioState> | undefined;
  let logoResult: LogoStudioState | undefined;
  const watcher = setInterval(() => {
    void isStopping(run.id)
      .then((stopping) => {
        if (stopping) {
          stopRequested = true;
          logoAbort.abort();
        }
        // Mesmo laço mantém o sinal de vida: uma composição passa minutos
        // sem evento de ferramenta e seria dada como órfã.
        return heartbeat(run.id);
      })
      .catch(() => undefined);
  }, STOP_POLL_MS);

  const startedAt = Date.now();
  let steps = 0;
  let timedOut = false;
  let phaseError: string | null = null;
  let spoken = '';
  let usage: Record<string, unknown> | undefined;
  const toolStartedAt = new Map<string, number>();
  try {
    const tools = buildTools(ready, {
      origin: run.origin,
      cookie: `eixu_admin=${await createSessionToken()}`,
      phase,
      onCurrentSiteProgress: async (progress) => {
        await recordEvent({
          runId: run.id,
          tenantId: tenant.id,
          phase,
          kind: 'note',
          tool: 'read_current_site',
          label: progress.label,
          payload: { ...progress },
        });
      },
      onReferenceProgress: async (progress) => {
        await recordEvent({
          runId: run.id,
          tenantId: tenant.id,
          phase,
          kind: 'note',
          tool: 'read_reference',
          label: progress.label,
          payload: { ...progress },
        });
      },
    });
    const recordToolStart = async (
      name: string,
      input: unknown,
      callId: string,
    ) => {
      toolStartedAt.set(callId, Date.now());
      await recordEvent({
        runId: run.id,
        tenantId: tenant.id,
        phase,
        kind: 'tool_start',
        tool: name,
        label: describeTool(name, input, undefined, 'pending'),
        payload: { callId },
      }).catch(() => undefined);
    };
    const recordToolEnd = async (
      name: string,
      input: unknown,
      output: unknown,
      callId: string,
      failed = false,
    ) => {
      const toolStarted = toolStartedAt.get(callId);
      toolStartedAt.delete(callId);
      await recordEvent({
        runId: run.id,
        tenantId: tenant.id,
        phase,
        kind: 'tool_end',
        tool: name,
        label: failed
          ? 'Esta tentativa foi recusada. O agente pode corrigir e tentar novamente.'
          : describeTool(name, input, output, 'output-available'),
        payload: {
          ok: !failed,
          callId,
          ...(toolStarted === undefined
            ? {}
            : { durationMs: Date.now() - toolStarted }),
        },
      }).catch(() => undefined);
    };

    if (sceneBatch) {
      const callId = randomUUID();
      await recordToolStart('prepare_site_images', sceneBatch, callId);
      const sceneTool = tools.prepare_site_images as unknown as {
        execute?: (
          input: NonNullable<typeof sceneBatch>,
          ...args: unknown[]
        ) => Promise<unknown>;
      };
      if (!sceneTool.execute)
        throw new Error('Ferramenta de imagens indisponível no runner.');
      const output = await sceneTool.execute(sceneBatch);
      // `safe` devolve a recusa como resultado. Sem ler esse campo, o painel
      // dizia só que nada foi preenchido e o motivo real não chegava a lugar
      // nenhum: a etapa parava sem o operador saber o que corrigir.
      const refusal = (output as { error?: string } | null)?.error;
      await recordToolEnd(
        'prepare_site_images',
        sceneBatch,
        output,
        callId,
        Boolean(refusal),
      );
      if (refusal)
        await recordEvent({
          runId: run.id,
          tenantId: tenant.id,
          phase,
          kind: 'note',
          label: refusal,
        }).catch(() => undefined);
      steps = 1;
      const generated = Array.isArray(
        (output as { imagens?: unknown[] } | null)?.imagens,
      )
        ? (output as { imagens: unknown[] }).imagens.length
        : 0;
      spoken = generated
        ? `${plural(generated, 'imagem foi criada', 'imagens foram criadas')} e já estão disponíveis na biblioteca.`
        : refusal
          ? `O estúdio recusou o lote de cenas: ${refusal}`
          : 'O estúdio terminou sem preencher uma nova vaga; a pendência ficou registrada.';
    } else {
      if (
        phase === 'briefing' &&
        shouldRunLogoStudio(ready, ready.brand.logoAsset?.sourceHash ?? '')
      ) {
        const callId = randomUUID();
        const logoStartedAt = Date.now();
        logoJob = runLogoStudio({
          tenant: ready,
          trigger: 'briefing',
          signal: AbortSignal.any([
            logoAbort.signal,
            AbortSignal.timeout(LOGO_STUDIO_TIMEOUT_MS),
          ]),
          persistReceipt: (text) =>
            persistMessage(tenant.id, 'assistant', text),
          onEvent: (event) =>
            recordEvent({
              runId: run.id,
              tenantId: tenant.id,
              phase,
              kind:
                event.kind === 'start'
                  ? 'tool_start'
                  : event.kind === 'end'
                    ? 'tool_end'
                    : 'note',
              tool: 'logo_studio',
              label: event.label,
              payload: {
                ...event.payload,
                callId,
                ...(event.kind === 'end'
                  ? { durationMs: Date.now() - logoStartedAt }
                  : {}),
              },
            }).then(() => undefined),
        });
      }
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
        }),
      });
      const result = await agent.generate({
        messages: [{ role: 'user', content: PHASE_MESSAGE[phase] }],
        onToolExecutionStart: async (event) => {
          const name = event.toolCall.toolName;
          const callId = event.toolCall.toolCallId;
          await recordToolStart(name, event.toolCall.input, callId);
        },
        onToolExecutionEnd: async (event) => {
          const name = event.toolCall.toolName;
          const callId = event.toolCall.toolCallId;
          const failed = event.toolOutput.type === 'tool-error';
          const output = failed ? undefined : event.toolOutput.output;
          await recordToolEnd(
            name,
            event.toolCall.input,
            output,
            callId,
            failed,
          );
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
    }
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
    if (!isTimeout(error)) phaseError = message;
    timedOut = isTimeout(error);
  } finally {
    if (stopRequested) logoAbort.abort();
    if (logoJob) logoResult = await logoJob.catch(() => undefined);
    clearInterval(watcher);
  }

  const [freshPages, freshImages] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  let fresh = (await getTenantBySlug(slug)) ?? tenant;
  let after = generationState(fresh, freshPages, freshImages);
  if (!stopRequested && after.next === 'pronto' && phase === 'composicao') {
    fresh = await markDelivered(fresh);
    after = generationState(fresh, freshPages, freshImages);
  }
  // A ferramenta pode ter gravado o projeto antes de o provedor falhar.
  // A entrega persistida prevalece; sem páginas concluídas, o erro continua real.
  if (phaseError && after.next !== 'pronto') {
    await recordEvent({
      runId: run.id,
      tenantId: tenant.id,
      phase,
      kind: 'error',
      label: `A etapa ${PHASE_LABEL[phase]} falhou`,
      payload: { error: phaseError },
    });
    return { kind: 'failed', error: phaseError };
  }
  // A próxima fase é decidida aqui, não no salto seguinte: assim o recibo do
  // chat e o motivo no painel contam a mesma história, e uma etapa que não
  // produziu nada para com o motivo em vez de parecer interrompida.
  const outcome = settleOutcome({
    phase,
    marker: progress,
    state: after,
    fingerprint: reviewFingerprint(fresh, freshPages, freshImages),
    stopRequested,
  });
  const silent = !spoken;
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
    outcome.kind === 'done' ||
    timedOut ||
    steps >= PHASE_STEPS[phase] ||
    outcome.kind === 'failed' ||
    outcome.kind === 'paused';
  const text = [
    spoken,
    silent || needsReceipt ? fallback : '',
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
    label: outcomeLabel(phase, fresh, after),
    payload: {
      steps,
      next: after.next,
      ...(logoResult ? { logoStudio: logoResult.status } : {}),
      ...(usage ? { usage } : {}),
      ...(timedOut ? { timeout: true } : {}),
      flowVersion: GENERATION_FLOW_VERSION,
      stopReason: outcome.kind,
      ...(sceneBatch
        ? {
            costCoverage:
              'Imagens e crítico de imagem são registrados pelos serviços, fora do total do coordenador.',
          }
        : {}),
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
      phase: run.phase ?? 'composicao',
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
