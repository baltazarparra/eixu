import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';
import { generationFeedFixture } from './helpers/generation-feed-fixture.mjs';
import {
  chatFixture,
  chatRequest,
  readChunks,
} from './helpers/chat-fixture.mjs';

const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { isResumeRequest, isProgressQuestion } = await jiti.import(
  '../lib/ai/chat-progress.ts',
);
const { createStepToken, verifyStepToken } = await jiti.import(
  '../lib/generation/token.ts',
);
const { progressMarker, reviewRound, stalled } = await jiti.import(
  '../lib/generation/marker.ts',
);
const { reviewFingerprint } = await jiti.import('../lib/review/state.ts');
const { creationProgress } = await jiti.import('../lib/generation/progress.ts');
const { phaseInstructions } = await jiti.import('../lib/generation/context.ts');

await test('progresso da criação soma etapas feitas e unidades medidas, sem estimativa', () => {
  const event = (id, kind, tool = null) => ({
    id,
    phase: 'revisao',
    kind,
    tool,
    label: '',
    payload: {},
    createdAt: new Date(0).toISOString(),
  });
  const state = (next, extra = {}) => ({
    generation: { next, coveredScenes: 2, targetScenes: 5, ...extra },
    pages: [],
  });

  const briefing = creationProgress(state('briefing'), 'briefing', []);
  assert.equal(briefing.fraction, 0);
  assert.equal(briefing.position, 1);
  assert.deepEqual(
    briefing.stages.map((stage) => stage.state),
    ['active', 'todo'],
  );
  assert.equal(briefing.detail, null, 'o briefing não tem unidade medida');

  const cenas = creationProgress(state('cenas'), 'cenas', []);
  assert.equal(cenas.position, 2);
  assert.ok(Math.abs(cenas.fraction - 1.2 / 2) < 1e-9);
  assert.equal(cenas.detail, '2 de 5 cenas prontas');
  assert.deepEqual(
    cenas.stages.map((stage) => [stage.state, stage.fill]),
    [
      ['done', 1],
      ['active', 0.2],
    ],
  );

  // A fase de páginas já passou pelas cenas: metade da etapa "Criar" está feita.
  const composicao = creationProgress(
    state('composicao', { coveredScenes: 5 }),
    'composicao',
    [],
  );
  assert.equal(composicao.fraction, 0.75);
  assert.equal(composicao.detail, 'montando as páginas');

  // Parada, a próxima etapa aparece ativa, sem unidades de uma fase que não roda.
  const paused = creationProgress(state('cenas'), null, []);
  assert.equal(paused.stage.id, 'criar');
  assert.equal(paused.detail, null);

  const revisao = creationProgress(
    {
      generation: { next: 'revisao', coveredScenes: 5, targetScenes: 5 },
      pages: [{}, {}, {}],
    },
    'revisao',
    [event(1, 'phase_start'), event(2, 'tool_end', 'review_pages')],
  );
  assert.equal(revisao.stages[1].fill, 1);
  assert.ok(Math.abs(revisao.fraction - 1) < 1e-9);
  assert.equal(revisao.detail, null);

  const done = creationProgress(state('pronto'), null, []);
  assert.equal(done.done, true);
  assert.equal(done.fraction, 1);
  assert.deepEqual(
    done.stages.map((stage) => stage.state),
    ['done', 'done'],
  );
});

await test('marcador distingue leitura, alteração de rascunho e repetição sem trabalho', () => {
  const state = { coveredScenes: 3, reviewRounds: 7 };
  const first = progressMarker('revisao', state, 'a'.repeat(64), null);
  assert.equal(first, 'revisao:1:7:aaaaaaaaaaaaaaaa');
  const repeat = progressMarker('revisao', state, 'a'.repeat(64), first);
  assert.equal(reviewRound(repeat), 2);
  assert.equal(stalled(first, repeat), true);
  for (const next of [
    progressMarker(
      'revisao',
      { ...state, reviewRounds: 8 },
      'a'.repeat(64),
      first,
    ),
    progressMarker('revisao', state, 'b'.repeat(64), first),
  ])
    assert.equal(stalled(first, next), false);
  assert.equal(progressMarker('cenas', state, '', null), 'cenas:3');
  assert.equal(stalled('cenas:2', 'cenas:3'), false);
  assert.equal(stalled('composicao', 'composicao'), true);
  assert.equal(stalled(null, first), false);
  // Execuções que estavam em revisão antes deste patch podem continuar.
  assert.equal(stalled('revisao', first), false);
  for (const marker of [
    null,
    'revisao',
    'cenas:3',
    'revisao:NaN',
    'revisao:-1',
  ])
    assert.equal(reviewRound(marker), 0);
});

await test('prompt de análise solicitada não reabre a geração', () => {
  const instructions = phaseInstructions({
    tenant: {
      id: 'fixture',
      slug: 'fixture',
      name: 'Fixture',
      brand: {},
      dials: {},
      imageGuide: {},
      brief: { generation: { review: { errors: 2 } } },
    },
    pages: [],
    images: [],
    phase: 'revisao',
  });
  assert.match(
    instructions,
    /Análise solicitada pelo operador, fora da geração/,
  );
  assert.match(instructions, /Comece por review_pages no rascunho atual/);
  assert.match(instructions, /"errors":2/);
  assert.doesNotMatch(
    instructions,
    /pode abrir outra rodada automaticamente|Rodada \d de 3/,
  );
});

await test('feed distingue cliente novo de tentativa anterior às execuções no servidor', async () => {
  const fresh = await generationFeedFixture();
  const freshFeed = await fresh.read();
  assert.equal(freshFeed.everRan, false);
  assert.ok(
    Math.abs(Date.now() - new Date(freshFeed.serverTime).getTime()) < 5000,
  );

  const legacy = await generationFeedFixture({
    brief: {
      generation: { phase: 'briefing', updatedAt: '2026-09-10T12:00:00Z' },
    },
  });
  const feed = await legacy.read();
  assert.equal(feed.state.generation.next, 'briefing');
  assert.equal(feed.state.pages.length, 0);
  assert.equal(feed.run, null);
  assert.equal(feed.everRan, true);
});

await test('histórico já carregado também impede início automático, independentemente do cursor', async () => {
  const fixture = await generationFeedFixture({
    messages: [
      {
        id: 'saved-7',
        role: 'user',
        parts: [{ type: 'text', text: 'Ainda vou completar o briefing.' }],
      },
    ],
  });
  for (const cursor of [0, 7, 99]) {
    const feed = await fixture.read(cursor);
    assert.equal(feed.everRan, true);
    assert.equal(feed.messages.length, cursor === 0 ? 1 : 0);
  }
});

await test('execução antiga continua impedindo início automático depois de sair do painel', async () => {
  const fixture = await generationFeedFixture({
    recent: { status: 'failed', finishedAt: '2026-09-10T12:00:00Z' },
  });
  const feed = await fixture.read();
  assert.equal(feed.run, null);
  assert.equal(feed.everRan, true);
});

await test('retomar digitado é reconhecido sem capturar pedidos compostos', () => {
  for (const text of [
    'continuar',
    'Continuar',
    'continue.',
    'pode continuar',
    'vamos continuar',
    'retomar',
    'prossiga',
    'segue',
    'continuar a geração',
    'termina o site',
  ])
    assert.equal(isResumeRequest(text), true, text);

  // Pedido com conteúdo próprio continua sendo trabalho do agente.
  for (const text of [
    'continue e troque o hero',
    'continuar com o logo',
    'não continue',
    'quero um logo mais moderno',
    'travou?',
    'publique o site',
  ])
    assert.equal(isResumeRequest(text), false, text);

  // As duas detecções não se sobrepõem.
  for (const text of ['travou?', 'status', 'qual o andamento'])
    assert.equal(isResumeRequest(text), false, text);
  for (const text of ['continuar', 'prossiga'])
    assert.equal(isProgressQuestion(text), false, text);
});

await test('token da etapa autoriza um run e recusa adulteração ou validade vencida', async () => {
  const run = '0eb4847d-0f93-48be-ac16-2e76bb0a645e';
  const token = await createStepToken(run, 0);
  assert.deepEqual(await verifyStepToken(token), { runId: run, hop: 0 });
  assert.equal(await verifyStepToken(null), null);
  assert.equal(await verifyStepToken('lixo'), null);
  const [id, hop, expires, signature] = token.split('.');
  assert.equal(
    await verifyStepToken(`${id}.${hop}.${expires}.${signature}x`),
    null,
  );
  assert.equal(
    await verifyStepToken(`${id}.${hop}.${Date.now() - 1000}.${signature}`),
    null,
  );
  assert.equal(await verifyStepToken(`${id}.1.${expires}.${signature}`), null);
  // Assinatura de outro run não serve para este.
  const other = await createStepToken(
    '11111111-1111-4111-8111-111111111111',
    0,
  );
  assert.equal(
    await verifyStepToken(`${id}.${hop}.${expires}.${other.split('.')[3]}`),
    null,
  );
});

await test('chat recusa turno novo enquanto a geração roda, sem gravar mensagem', async () => {
  const f = await chatFixture({
    running: {
      id: '0eb4847d-0f93-48be-ac16-2e76bb0a645e',
      status: 'running',
      phase: 'composicao',
    },
  });
  const response = await f.POST(chatRequest('muda a cor do hero'));
  assert.equal(response.status, 409);
  assert.match(await response.text(), /em andamento/);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.turns, []);
  assert.equal(f.executions(), 0);
});

await test('"continuar" digitado abre a execução em etapas, não um turno de edição', async () => {
  const f = await chatFixture();
  const chunks = await readChunks(await f.POST(chatRequest('continuar')));
  const text = chunks
    .filter((part) => part.type === 'text-delta')
    .map((part) => part.delta)
    .join('');
  assert.match(text, /Retomando a geração/);
  assert.deepEqual(f.starts, ['stream-fixture']);
  // Nenhum passo do agente: o caminho errado custava 16 passos e minutos.
  assert.deepEqual(f.turns, []);
  assert.equal(f.executions(), 0);
  assert.deepEqual(
    f.writes.map((row) => row.role),
    ['user', 'assistant'],
  );
  assert.equal(f.writes[1].text, text);
});

/** Runner com banco, agente e estado em memória: só a orquestração é real. */
async function runnerFixture({
  states,
  onGenerate = async () => {},
  text = 'Etapa concluída.',
  /** Passos do turno; o limite da fase muda o recibo persistido. */
  stepCount = 1,
  /** Resultados de ferramenta por passo, para o resumo do turno silencioso. */
  toolResults = [],
  stopping = false,
  /** Perfil social ainda em leitura na primeira consulta ao cliente. */
  socialReading = false,
  logoStudio,
  /** Resposta do estúdio quando a etapa de cenas chama o lote direto. */
  sceneTool,
} = {}) {
  const events = [];
  const messages = [];
  const runs = new Map();
  const prompts = [];
  let delivery = null;
  let calls = 0;
  let tenantReads = 0;
  const run = {
    id: '0eb4847d-0f93-48be-ac16-2e76bb0a645e',
    tenantId: 'tenant-1',
    status: 'running',
    phase: null,
    phaseStartedAt: null,
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    hops: 1,
    progress: null,
    origin: 'https://eixu.test',
  };
  runs.set(run.id, run);

  const runner = await loadModule('lib/generation/runner.ts', {
    '@/lib/images/logo-studio': {
      shouldRunLogoStudio: () => Boolean(logoStudio),
      runLogoStudio: logoStudio ?? (async () => ({ status: 'skipped' })),
    },
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          if (parts.join('').includes('chat_messages'))
            messages.push({ role: values[1], text: values[2] });
          if (
            parts.join('').includes('update tenants') &&
            typeof values[0] === 'string' &&
            values[0].startsWith('{')
          )
            delivery = JSON.parse(values[0]).delivery ?? delivery;
          if (parts.join('').includes('select slug'))
            return [{ slug: 'fixture' }];
          return [];
        },
    },
    '@/lib/generation/runs': {
      saveProgress: async (id, phase, progress) => {
        Object.assign(runs.get(id), { phase, progress });
      },
      recordEvent: async (event) => {
        events.push(event);
      },
      heartbeat: async () => undefined,
      isStopping: async () => stopping,
      finishRun: async (id, status, error) => {
        Object.assign(runs.get(id), { status, error: error ?? null });
      },
    },
    '@/lib/tenant-queries': {
      getTenantBySlug: async () => {
        tenantReads += 1;
        // A leitura do perfil, disparada pelo cadastro, termina entre a
        // primeira consulta e a releitura feita pela espera.
        const social = socialReading
          ? { social: { status: tenantReads <= 1 ? 'lendo' : 'ok' } }
          : {};
        const state = states[Math.min(calls, states.length - 1)];
        const tenant = {
          id: 'tenant-1',
          slug: 'fixture',
          name: 'Fixture',
          brand: { design: { version: 2 } },
          brief: { ...social, draft: state.draft ?? 'Rascunho inicial' },
          dials: {},
          imageGuide: {},
        };
        if (state.review)
          tenant.brief.generation = {
            review: {
              ...state.review,
              fingerprint: reviewFingerprint(tenant, [], []),
            },
          };
        if (delivery)
          tenant.brief.generation = { ...tenant.brief.generation, delivery };
        return tenant;
      },
      listPages: async () => {
        const state = states[Math.min(calls, states.length - 1)];
        return state.draft
          ? [
              {
                id: 'page-1',
                slug: '',
                title: 'Início',
                type: 'page',
                blocks: [
                  {
                    id: 'copy',
                    type: 'editorial.text',
                    props: { text: state.draft },
                  },
                ],
                seo: {},
                meta: {},
              },
            ]
          : [];
      },
    },
    '@/lib/images/queries': { listImages: async () => [] },
    '@/lib/sites/generation': {
      plannedScenes: () => [
        {
          role: 'hero',
          targetBlock: 'hero.cover',
          ratio: '16:9',
          hint: 'Abertura.',
          request: 'Abertura do cliente, com assunto concreto no enquadramento.',
        },
      ],
      generationState: () => {
        const state = states[Math.min(calls, states.length - 1)];
        return {
          next: 'composicao',
          coveredScenes: 5,
          targetScenes: 5,
          organicPages: 3,
          reviewRounds: 0,
          reviewComplete: false,
          blockingErrors: 0,
          photos: 5,
          nextScene: null,
          ...state,
          ...(delivery ? { next: 'pronto' } : {}),
        };
      },
    },
    '@/lib/generation/context': {
      phaseBlocker: () => null,
      phaseInstructions: (input) => {
        prompts.push(input.tenant);
        return 'Instruções sintéticas.';
      },
    },
    '@/lib/admin/state': {
      workspaceState: () => ({
        generation: {
          coveredScenes: 5,
          targetScenes: 5,
          next: delivery ? 'pronto' : 'revisao',
        },
        pages: [],
      }),
    },
    '@/lib/ai/chat-progress': {
      savedProgressMessage: (state, running) =>
        `Progresso salvo: recibo sintético. ${state.generation.next === 'pronto' ? 'Site gerado.' : running ? 'Continua.' : 'Parado.'}`,
    },
    '@/lib/auth': { createSessionToken: async () => 'token' },
    '@/lib/ai/tools': {
      buildTools: () =>
        sceneTool ? { prepare_site_images: { execute: sceneTool } } : {},
    },
    '@/lib/ai/agent': {
      siteAgent: () => ({
        generate: async ({ onToolExecutionStart, onToolExecutionEnd }) => {
          calls += 1;
          await onGenerate();
          await onToolExecutionStart({
            toolCall: {
              toolName: 'build_site',
              toolCallId: 'synthetic-build',
              input: {},
            },
          });
          await onToolExecutionEnd({
            toolCall: {
              toolName: 'build_site',
              toolCallId: 'synthetic-build',
              input: {},
            },
            toolOutput: {
              type: 'tool-result',
              output: { ok: true, pages: [1, 2, 3] },
            },
          });
          return {
            text,
            steps: Array.from({ length: stepCount }, (_, index) => ({
              text: index === stepCount - 1 ? text : '',
              toolResults: toolResults[index] ?? [],
              providerMetadata: {},
            })),
            usage: {},
          };
        },
      }),
    },
  });
  return {
    ...runner,
    run,
    runs,
    events,
    messages,
    prompts,
    calls: () => calls,
  };
}

await test('edição recusada pela ferramenta real não vira ajuste no resumo do SDK', async () => {
  let writes = 0;
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db: () => async () => {
        writes += 1;
        return [];
      },
    },
    '@/lib/tenant-queries': {
      getPage: async () => ({
        id: 'page-1',
        slug: '',
        blocks: [
          {
            id: 'nav',
            type: 'nav.bar',
            props: { logoText: 'Teste', links: [] },
          },
        ],
      }),
    },
  });
  const tools = buildTools(
    {
      id: 'fixture',
      slug: 'fixture',
      name: 'Fixture',
      brand: {},
      brief: {},
      dials: {},
      imageGuide: {},
    },
    { phase: 'revisao' },
  );
  const result = await new ToolLoopAgent({
    model: new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'rejected-edit',
            toolName: 'update_block',
            input: JSON.stringify({
              page: '',
              block: 'inexistente',
              props: { logoText: 'Novo' },
            }),
          },
        ],
        finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
        warnings: [],
      }),
    }),
    tools: { update_block: tools.update_block },
    stopWhen: stepCountIs(1),
  }).generate({ prompt: 'Teste sintético sem rede.' });
  assert.equal(writes, 0);
  assert.match(result.steps[0].toolResults[0].output.error, /Nenhum bloco/);
});

await test('a etapa grava linha do tempo, mensagens e aponta a próxima fase', async () => {
  const f = await runnerFixture({
    states: [{ next: 'composicao' }, { next: 'pronto' }],
  });
  const outcome = await f.executeStep(f.run);

  assert.equal(outcome.kind, 'done');
  assert.equal(f.calls(), 1);
  assert.equal((await f.executeStep(f.run)).kind, 'done');
  assert.equal(f.calls(), 1, 'recarregar não abre conferência');
  assert.equal(
    f.events.map((event) => event.kind).join(','),
    'phase_start,tool_start,tool_end,phase_end',
  );
  assert.equal(f.events[1].tool, 'build_site');
  assert.match(f.events[2].label, /Projeto salvo/);
  // O histórico do painel continua coerente mesmo sem navegador aberto.
  assert.equal(f.messages.map((row) => row.role).join(','), 'assistant');
  assert.match(
    f.messages[0].text,
    /Etapa concluída.*\n\nProgresso salvo.*Site gerado/,
  );
  assert.equal(f.run.hops, 1);
  assert.equal(f.run.progress, 'composicao');
  // O painel perdeu a contagem quando a geração saiu do navegador: sem o
  // recibo no evento, a parte cara do trabalho ficava fora do consumo.
  const usage = f.events.at(-1).payload.usage;
  assert.equal(usage.steps, 1);
  assert.equal(usage.phase, 'composicao');
  assert.equal(typeof usage.durationMs, 'number');
  assert.equal(usage.costUsd, undefined);
});

await test('briefing espera a leitura do perfil social antes de montar o prompt', async () => {
  const f = await runnerFixture({
    states: [{ next: 'briefing' }, { next: 'cenas' }],
    socialReading: true,
  });
  const outcome = await f.executeStep(f.run);

  assert.equal(outcome.kind, 'continue');
  assert.ok(
    f.events.some(
      (event) => event.kind === 'note' && /leitura do perfil/.test(event.label),
    ),
    'a espera precisa aparecer na linha do tempo',
  );
  // O prompt recebe o cliente relido: perfil em leitura entra como lacuna, e
  // o cadastro redireciona para o painel antes de a leitura terminar.
  assert.equal(f.prompts.at(-1).brief.social.status, 'ok');
});

await test('etapa sem avanço encerra a execução em vez de repetir para sempre', async () => {
  const f = await runnerFixture({
    states: [{ next: 'cenas', coveredScenes: 3 }],
  });
  f.run.progress = 'cenas:3';
  const outcome = await f.executeStep(f.run);
  assert.equal(outcome.kind, 'failed');
  assert.match(outcome.error, /não avançou/);
  assert.equal(f.calls(), 0);
});

await test('checkpoint legado de revisão termina sem chamar o modelo', async () => {
  const f = await runnerFixture({
    states: [{ next: 'pronto', reviewRounds: 3 }],
  });
  f.run.phase = 'revisao';
  f.run.progress = 'revisao:3:2:anterior';
  assert.equal((await f.executeStep(f.run)).kind, 'done');
  assert.equal(f.calls(), 0);
  assert.equal(f.events.length, 0);
});

await test('falha após salvar páginas conclui; composição não salva continua com erro', async () => {
  const timeout = () =>
    new ToolLoopAgent({
      model: new MockLanguageModelV4({
        doGenerate: ({ abortSignal }) =>
          new Promise((_, reject) => {
            const guard = setTimeout(
              () => reject(new Error('SDK não abortou')),
              1000,
            );
            const abort = () => {
              clearTimeout(guard);
              reject(abortSignal.reason);
            };
            if (abortSignal.aborted) abort();
            else abortSignal.addEventListener('abort', abort, { once: true });
          }),
      }),
      timeout: { totalMs: 25 },
      maxRetries: 0,
    }).generate({ prompt: 'Teste sintético sem rede.' });
  const f = await runnerFixture({
    states: [{ next: 'composicao' }, { next: 'pronto' }],
    onGenerate: timeout,
  });
  assert.equal((await f.executeStep(f.run)).kind, 'done');
  assert.match(f.messages[0].text, /excedeu o tempo limite/);
  assert.match(f.messages[0].text, /Site gerado/);
  assert.equal(f.events.at(-1).payload.timeout, true);
  const saved = await runnerFixture({
    states: [{ next: 'composicao' }, { next: 'pronto' }],
    onGenerate: () => {
      throw new Error('Provedor falhou depois de gravar');
    },
  });
  assert.equal((await saved.executeStep(saved.run)).kind, 'done');
  assert.match(saved.messages[0].text, /Site gerado/);

  for (const onGenerate of [
    timeout,
    () => {
      throw new Error('Falha sintética');
    },
  ]) {
    const failed = await runnerFixture({
      states: [{ next: 'composicao' }],
      onGenerate,
    });
    assert.equal((await failed.executeStep(failed.run)).kind, 'failed');
  }
});

await test('pausa do operador interrompe composição ainda incompleta', async () => {
  const f = await runnerFixture({
    states: [{ next: 'composicao' }],
    stopping: true,
    onGenerate: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5100));
      throw new DOMException('Tempo esgotado', 'TimeoutError');
    },
  });
  assert.equal((await f.executeStep(f.run)).kind, 'paused');
  assert.equal(f.events.at(-1).kind, 'stopped');
  assert.equal(
    f.events.some((e) => e.kind === 'error'),
    false,
  );
});

await test('estado concluído encerra sem gastar uma etapa', async () => {
  const f = await runnerFixture({ states: [{ next: 'pronto' }] });
  assert.equal((await f.executeStep(f.run)).kind, 'done');
  assert.equal(f.calls(), 0);
});

await test('teto de etapas protege contra execução infinita', async () => {
  const f = await runnerFixture({ states: [{ next: 'composicao' }] });
  const outcome = await f.executeStep({ ...f.run, hops: 15 });
  assert.equal(outcome.kind, 'failed');
  assert.match(outcome.error, /limite de etapas/);
  assert.equal(f.calls(), 0);
});

await test('resultado da etapa fecha o run com o estado correspondente', async () => {
  const f = await runnerFixture({ states: [{ next: 'composicao' }] });
  await f.settleRun(f.run, { kind: 'done' });
  assert.equal(f.runs.get(f.run.id).status, 'done');
  await f.settleRun(f.run, { kind: 'paused' });
  assert.equal(f.runs.get(f.run.id).status, 'paused');
  await f.settleRun(f.run, { kind: 'failed', error: 'motivo' });
  assert.equal(f.runs.get(f.run.id).status, 'failed');
  assert.equal(f.runs.get(f.run.id).error, 'motivo');
});

async function stepRouteFixture(input = {}) {
  const f = await runnerFixture(input);
  Object.assign(f.run, { hops: 0, status: 'queued' });
  const jobs = [],
    dispatches = [];
  const store = {
    getRun: async () => structuredClone(f.run),
    claimStep: async (_id, hop) => {
      if (
        f.run.hops !== hop ||
        !['queued', 'running', 'stopping'].includes(f.run.status)
      )
        return null;
      f.run.hops++;
      if (f.run.status !== 'stopping') f.run.status = 'running';
      return structuredClone(f.run);
    },
    failReservedStep: async (_id, hops, error) => {
      if (
        f.run.hops !== hops ||
        !['queued', 'running', 'stopping'].includes(f.run.status)
      )
        return false;
      Object.assign(f.run, { status: 'failed', error });
      return true;
    },
    recordEvent: async (event) => f.events.push(event),
  };
  const step = await loadModule('lib/generation/step.ts', {
    '@/lib/generation/runs': store,
    '@/lib/generation/runner': f,
    '@/lib/generation/dispatch': {
      dispatchStep: async (input) => dispatches.push(input),
    },
  });
  const { POST } = await loadModule(
    'app/api/admin/[tenant]/generation/step/route.ts',
    {
      'next/server': { after: (callback) => jobs.push(callback) },
      '@/lib/auth': { isAuthenticated: async () => false },
      '@/lib/generation/token': { verifyStepToken },
      '@/lib/tenant-queries': {
        getTenantBySlug: async (slug) => ({
          id: slug === 'fixture' ? f.run.tenantId : 'other',
        }),
      },
      '@/lib/generation/runs': store,
      '@/lib/generation/step': step,
    },
  );
  const post = async (hop, slug = 'fixture') =>
    POST(
      new Request('https://eixu.test/api/admin/fixture/generation/step', {
        method: 'POST',
        headers: { 'x-eixu-run': await createStepToken(f.run.id, hop) },
      }),
      { params: Promise.resolve({ tenant: slug }) },
    );
  return { ...f, jobs, dispatches, post, POST };
}

await test('repetir o despacho durante uma chamada ativa não encerra nem assume outro salto', async () => {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  const f = await stepRouteFixture({
    states: [{ next: 'briefing' }, { next: 'composicao' }, { next: 'pronto' }],
    onGenerate: async () => {
      entered.resolve();
      await release.promise;
    },
  });
  assert.equal((await f.post(0)).status, 202);
  const firstJob = f.jobs.shift()();
  await entered.promise;
  try {
    assert.equal((await f.post(0)).status, 200);
    assert.equal(f.run.status, 'running');
    assert.equal(f.calls(), 1);
    assert.equal(f.jobs.length, 0);
  } finally {
    release.resolve();
    await firstJob;
  }
  assert.equal(f.dispatches[0].hop, 1);
  assert.equal((await f.post(1)).status, 202);
  assert.equal(
    (await f.post(0)).status,
    200,
    'o token anterior não assume a composição',
  );
  await f.jobs.shift()();
  assert.equal(f.run.status, 'done');
  assert.equal(f.calls(), 2);
  assert.equal(
    (await f.post(1)).status,
    200,
    'repetição após conclusão também é inofensiva',
  );
  assert.equal(f.run.status, 'done');
});

await test('dois despachos simultâneos agendam só um callback e preservam autenticação/tenant', async () => {
  const f = await stepRouteFixture({
    states: [{ next: 'composicao' }, { next: 'pronto' }],
  });
  assert.equal((await f.post(0, 'other')).status, 404);
  assert.equal((await f.post(1)).status, 409);
  const denied = await f.POST(
    new Request('https://eixu.test/step', { method: 'POST' }),
    { params: Promise.resolve({ tenant: 'fixture' }) },
  );
  assert.equal(denied.status, 401);
  const responses = await Promise.all([f.post(0), f.post(0)]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 202],
  );
  assert.equal(f.jobs.length, 1);
  assert.equal(f.run.hops, 1);
  await f.jobs[0]();
  assert.equal(f.calls(), 1);
  assert.equal(f.run.status, 'done');
});

await test('pausa recebida antes do próximo salto não abre chamada paga', async () => {
  const f = await stepRouteFixture({ states: [{ next: 'composicao' }] });
  f.run.status = 'stopping';
  assert.equal((await f.post(0)).status, 202);
  await f.jobs[0]();
  assert.equal(f.calls(), 0);
  assert.equal(f.run.status, 'paused');
});

await test('briefing aguarda estúdio paralelo, eventos e recibo sem depender dele para concluir', async () => {
  for (const status of ['done', 'failed']) {
    let started = false;
    let finishLogo;
    const completed = new Promise((resolve) => {
      finishLogo = resolve;
    });
    const f = await runnerFixture({
      states: [{ next: 'briefing' }, { next: 'cenas' }],
      logoStudio: async (input) => {
        started = true;
        await input.onEvent({ kind: 'start', label: 'Modernizando o logo' });
        await completed;
        await input.persistReceipt('Recibo do logo sintético.');
        await input.onEvent({
          kind: 'end',
          label: 'Estúdio concluído',
          payload: { status },
        });
        return { status };
      },
      onGenerate: async () => {
        assert.equal(started, true);
        finishLogo();
      },
    });
    const outcome = await f.executeStep(f.run);
    assert.equal(outcome.kind, 'continue');
    const events = f.events.filter((event) => event.tool === 'logo_studio');
    assert.deepEqual(
      events.map((event) => event.kind),
      ['tool_start', 'tool_end'],
    );
    assert.equal(events[0].payload.callId, events[1].payload.callId);
    assert.ok(
      f.messages.some(
        (message) => message.text === 'Recibo do logo sintético.',
      ),
    );
    assert.equal(
      f.events.find((event) => event.kind === 'phase_end').payload.logoStudio,
      status,
    );
  }
});

await test(
  'pausa aborta o estúdio mesmo depois de o agente terminar o briefing',
  { timeout: 10_000 },
  async () => {
    let cancelled = false;
    const f = await runnerFixture({
      states: [{ next: 'briefing' }, { next: 'cenas' }],
      stopping: true,
      logoStudio: async ({ signal }) => {
        await new Promise((resolve) =>
          signal.addEventListener('abort', resolve, { once: true }),
        );
        cancelled = signal.aborted;
        return { status: 'failed' };
      },
    });
    assert.equal((await f.executeStep(f.run)).kind, 'paused');
    assert.equal(cancelled, true);
    assert.equal(f.events.at(-1).payload.stopReason, 'paused');
    assert.equal(f.events.at(-1).payload.logoStudio, 'failed');
  },
);

await test('recusa do estúdio no lote direto chega ao chat e à linha do tempo', async () => {
  const refusal =
    'signature.composition exibe 4:3. A proporção 16:9 seria recortada; envie 4:3 ou omita o campo.';
  const f = await runnerFixture({
    states: [{ next: 'cenas', coveredScenes: 0, targetScenes: 5, photos: 0 }],
    sceneTool: async () => ({ error: refusal }),
  });
  const outcome = await f.executeStep(f.run);

  assert.equal(outcome.kind, 'failed');
  const end = f.events.find((event) => event.kind === 'tool_end');
  assert.equal(end.payload.ok, false, 'a recusa não pode ficar como sucesso');
  assert.ok(
    f.events.some(
      (event) => event.kind === 'note' && event.label === refusal,
    ),
    'a linha do tempo precisa do motivo real',
  );
  // Sem isso o operador lia só que nada foi preenchido, sem o que corrigir.
  assert.match(f.messages[0].text, /signature\.composition exibe 4:3/);
});
