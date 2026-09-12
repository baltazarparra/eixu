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
const { phaseInstructions } = await jiti.import('../lib/generation/context.ts');

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

await test('prompt recebe a rodada, a última leitura e o teto sem prometer continuação', () => {
  const input = {
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
  };
  const second = phaseInstructions({ ...input, round: 2 });
  assert.match(second, /Rodada 2 de 3/);
  assert.match(second, /Comece por review_pages no rascunho atual/);
  assert.match(second, /"errors":2/);
  assert.match(
    phaseInstructions({ ...input, round: 3 }),
    /última rodada desta execução/,
  );
  assert.doesNotMatch(
    phaseInstructions(input),
    /pode abrir outra rodada automaticamente/,
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
} = {}) {
  const events = [];
  const messages = [];
  const runs = new Map();
  const prompts = [];
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
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          if (parts.join('').includes('chat_messages'))
            messages.push({ role: values[1], text: values[2] });
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
        return tenant;
      },
      listPages: async () => [],
    },
    '@/lib/images/queries': { listImages: async () => [] },
    '@/lib/sites/generation': {
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
        generation: { coveredScenes: 5, targetScenes: 5, next: 'revisao' },
        pages: [],
      }),
    },
    '@/lib/ai/chat-progress': {
      savedProgressMessage: (_state, running) =>
        `Progresso salvo: recibo sintético. ${running ? 'Continua.' : 'Parado.'}`,
    },
    '@/lib/auth': { createSessionToken: async () => 'token' },
    '@/lib/ai/tools': { buildTools: () => ({}) },
    '@/lib/ai/agent': {
      siteAgent: () => ({
        generate: async ({ onToolExecutionStart, onToolExecutionEnd }) => {
          calls += 1;
          await onGenerate();
          onToolExecutionStart({
            toolCall: { toolName: 'build_site', input: {} },
          });
          onToolExecutionEnd({
            toolCall: { toolName: 'build_site', input: {} },
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

await test('revisão sem texto do agente registra o resumo do turno antes do recibo', async () => {
  // A conferência limpa encerra o laço no passo da ferramenta: o histórico
  // recebia só "Progresso salvo", sem dizer o que a revisão fez.
  const f = await runnerFixture({
    states: [
      { next: 'revisao', reviewRounds: 4 },
      { next: 'pronto', reviewRounds: 5, reviewComplete: true },
    ],
    text: '',
    stepCount: 3,
    toolResults: [
      [
        {
          toolName: 'review_pages',
          output: { visual: 'complete', review: { complete: true } },
        },
      ],
      [
        { toolName: 'update_block', output: { ok: true } },
        { toolName: 'lint_page' },
      ],
      [
        {
          toolName: 'review_pages',
          output: { visual: 'complete', review: { complete: true } },
        },
      ],
    ],
  });
  const outcome = await f.executeStep(f.run);
  assert.equal(outcome.kind, 'done');
  const reply = f.messages[1].text;
  assert.match(
    reply,
    /^A revisão fez 2 leituras do rascunho renderizado e aplicou 1 ajuste\./,
  );
  assert.match(reply, /Progresso salvo: recibo sintético\. Parado\./);
});

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
  const f = await runnerFixture({
    states: [{ next: 'revisao', reviewRounds: 1 }],
    text: '',
    stepCount: result.steps.length,
    toolResults: result.steps.map((step) => step.toolResults),
  });
  assert.equal((await f.executeStep(f.run)).kind, 'failed');
  assert.match(f.messages[1].text, /fez 0 leituras.*aplicou 0 ajustes/);
  assert.match(
    f.messages[1].text,
    /sem alterar o rascunho nem registrar leitura/,
  );
});

await test('resumo conta leituras completas com achados e só edições confirmadas', async () => {
  const refusedReads = [
    { error: 'Limite de leituras atingido.' },
    { visual: 'unavailable', review: { complete: false } },
    { visual: 'disabled', review: { complete: false } },
    { visual: 'complete', review: { complete: false } },
    null,
  ];
  const edits = [
    'update_block',
    'insert_block',
    'move_block',
    'remove_block',
    'set_blocks',
    'set_seo',
  ];
  const results = [
    ...refusedReads.map((output) => ({ toolName: 'review_pages', output })),
    // Encontrar erros não significa falha de leitura: o recibo visual completou.
    {
      toolName: 'review_pages',
      output: {
        complete: false,
        visual: 'complete',
        review: { complete: true, errors: 2 },
      },
    },
    {
      toolName: 'review_pages',
      output: {
        complete: true,
        visual: 'complete',
        review: { complete: true, errors: 0 },
      },
    },
    ...edits.flatMap((toolName) => [
      { toolName, output: { error: 'Tentativa recusada.' } },
      { toolName, output: { ok: false } },
      { toolName, output: null },
      { toolName, output: { ok: true } },
    ]),
    { toolName: 'lint_page', output: { ok: true } },
  ];
  const f = await runnerFixture({
    states: [
      { next: 'revisao', reviewRounds: 1 },
      { next: 'pronto', reviewRounds: 2, reviewComplete: true },
    ],
    text: '',
    toolResults: [results],
  });
  assert.equal((await f.executeStep(f.run)).kind, 'done');
  assert.match(f.messages[1].text, /fez 2 leituras.*aplicou 6 ajustes/);
  assert.match(f.messages[1].text, /Progresso salvo: recibo sintético/);
});

await test('a etapa grava linha do tempo, mensagens e aponta a próxima fase', async () => {
  const f = await runnerFixture({
    states: [{ next: 'composicao' }, { next: 'revisao' }],
  });
  const outcome = await f.executeStep(f.run);

  assert.equal(outcome.kind, 'continue');
  assert.equal(outcome.phase, 'revisao');
  assert.equal(
    f.events.map((event) => event.kind).join(','),
    'phase_start,tool_start,tool_end,phase_end',
  );
  assert.equal(f.events[1].tool, 'build_site');
  assert.match(f.events[2].label, /Projeto salvo/);
  // O histórico do painel continua coerente mesmo sem navegador aberto.
  assert.equal(f.messages.map((row) => row.role).join(','), 'user,assistant');
  assert.equal(f.messages[1].text, 'Etapa concluída.');
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

await test('revisão que esgota o turno abre uma rodada nova em vez de interromper', async () => {
  const revisao = (reviewRounds) => ({ next: 'revisao', reviewRounds });
  const f = await runnerFixture({
    // Uma leitura registrada por turno: a fase repete o nome, o marcador não.
    states: [revisao(0), revisao(1), revisao(2), revisao(3)],
    text: '',
    stepCount: 32,
  });

  const first = await f.executeStep(f.run);
  assert.equal(first.kind, 'continue');
  assert.equal(first.phase, 'revisao');
  // O marcador é gravado no início do salto: rodada 1, nenhuma leitura ainda.
  assert.match(f.run.progress, /^revisao:1:0:/);
  assert.match(f.messages[1].text, /limite de passos/);
  assert.match(f.messages[1].text, /Continua\./);
  assert.equal(f.events[0].label, 'Revisão · rodada 1 de 3');

  const second = await f.executeStep(f.run);
  assert.equal(second.kind, 'continue');
  assert.match(f.run.progress, /^revisao:2:1:/);
  assert.ok(
    f.events.some((event) => event.label === 'Revisão · rodada 2 de 3'),
    'a rodada precisa aparecer na linha do tempo',
  );

  // Terceira rodada é o teto: a decisão sai no fim do turno, com o motivo no
  // painel e no chat, em vez de um salto seguinte recusado sem explicação.
  const third = await f.executeStep(f.run);
  assert.equal(third.kind, 'failed');
  assert.match(third.error, /não fechou em 3 rodadas/);
  assert.match(f.messages.at(-1).text, /não fechou em 3 rodadas/);
  assert.match(f.messages.at(-1).text, /Parado\./);
  assert.equal(f.events.at(-1).kind, 'error');
  assert.equal(f.calls(), 3);
});

await test('revisão sem leitura nem alteração encerra com o motivo registrado', async () => {
  const f = await runnerFixture({
    states: [{ next: 'revisao', reviewRounds: 2 }],
    text: '',
  });
  const outcome = await f.executeStep(f.run);
  assert.equal(outcome.kind, 'failed');
  assert.match(outcome.error, /sem alterar o rascunho nem registrar leitura/);
  assert.equal(f.events.at(-1).kind, 'error');
  assert.match(f.events.at(-1).label, /sem alterar o rascunho/);
  // O turno rodou: a parada é do resultado, não uma recusa antes da chamada.
  assert.equal(f.calls(), 1);
});

await test('tempo esgotado preserva o progresso salvo e decide pela evidência', async () => {
  // SDK instalado de verdade, sem rede: o modelo respeita o sinal que o
  // ToolLoopAgent gera. O runner precisa reconhecer a exceção original.
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
  const advanced = await runnerFixture({
    states: [
      { next: 'revisao', reviewRounds: 0 },
      { next: 'revisao', reviewRounds: 1 },
    ],
    onGenerate: timeout,
  });
  const outcome = await advanced.executeStep(advanced.run);
  assert.equal(outcome.kind, 'continue');
  assert.match(advanced.messages[1].text, /excedeu o tempo limite/);
  assert.equal(advanced.events.at(-1).kind, 'phase_end');
  assert.equal(advanced.events.at(-1).payload.timeout, true);

  const stuck = await runnerFixture({
    states: [{ next: 'composicao' }],
    onGenerate: timeout,
  });
  assert.equal((await stuck.executeStep(stuck.run)).kind, 'failed');
});

await test('pausa do operador tem prioridade sobre timeout com progresso salvo', async () => {
  const f = await runnerFixture({
    states: [{ next: 'revisao' }, { next: 'revisao', reviewRounds: 1 }],
    stopping: true,
    onGenerate: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5100));
      throw new DOMException('Tempo esgotado', 'TimeoutError');
    },
  });
  assert.equal((await f.executeStep(f.run)).kind, 'paused');
  assert.equal(f.events.at(-1).kind, 'stopped');
  assert.equal(
    f.events.some((event) => event.kind === 'error'),
    false,
  );
});

await test('alteração do rascunho permite rodada seguinte mesmo sem nova leitura', async () => {
  const f = await runnerFixture({
    states: [
      { next: 'revisao', draft: 'Antes' },
      { next: 'revisao', draft: 'Depois' },
      { next: 'pronto', reviewComplete: true },
    ],
  });
  assert.equal((await f.executeStep(f.run)).kind, 'continue');
  assert.equal((await f.executeStep(f.run)).kind, 'done');
  assert.equal(
    f.events.filter((event) => event.kind === 'phase_start').at(-1).payload
      .round,
    2,
  );
});

await test('texto parcial no limite mantém o recibo da continuação real', async () => {
  const f = await runnerFixture({
    states: [{ next: 'revisao' }, { next: 'revisao', reviewRounds: 1 }],
    text: 'Ajustei a página inicial.',
    stepCount: 32,
  });
  assert.equal((await f.executeStep(f.run)).kind, 'continue');
  assert.match(f.messages.at(-1).text, /Ajustei a página inicial/);
  assert.match(f.messages.at(-1).text, /limite de passos/);
  assert.match(f.messages.at(-1).text, /Continua\./);
});

await test('teto distingue erros visuais de revisão incompleta e permite concluir na última rodada', async () => {
  for (const [review, expected] of [
    [{ complete: true, visual: 'complete', errors: 2 }, /2 pendência/],
    [
      { complete: false, visual: 'unavailable', errors: 1 },
      /captura ou a crítica visual não completou/,
    ],
  ]) {
    const f = await runnerFixture({
      states: [
        { next: 'revisao', reviewRounds: 2 },
        { next: 'revisao', reviewRounds: 3, review },
      ],
    });
    f.run.progress = 'revisao:2:1:anterior';
    const outcome = await f.executeStep(f.run);
    assert.equal(outcome.kind, 'failed');
    assert.match(outcome.error, expected);
    assert.match(f.messages.at(-1).text, /Parado\./);
    const label = f.events.find((event) => event.kind === 'phase_end').label;
    assert.doesNotMatch(label, /0 pendência/);
    assert.match(
      label,
      review.complete ? /2 pendência/ : /Captura ou crítica visual pendente/,
    );
  }
  const complete = await runnerFixture({
    states: [
      { next: 'revisao', reviewRounds: 2 },
      { next: 'pronto', reviewComplete: true },
    ],
  });
  complete.run.progress = 'revisao:2:1:anterior';
  assert.equal((await complete.executeStep(complete.run)).kind, 'done');
  assert.equal(
    complete.events.some((event) => event.kind === 'error'),
    false,
  );
});

await test('guarda recusa a quarta rodada e falha comum continua sendo erro', async () => {
  const capped = await runnerFixture({
    states: [{ next: 'revisao', reviewRounds: 3 }],
  });
  capped.run.progress = 'revisao:3:2:anterior';
  assert.equal((await capped.executeStep(capped.run)).kind, 'failed');
  assert.equal(capped.calls(), 0);
  assert.equal(capped.events.at(-1).kind, 'error');
  const failed = await runnerFixture({
    states: [{ next: 'revisao' }, { next: 'revisao', reviewRounds: 1 }],
    onGenerate: () => {
      throw new Error('Falha sintética do provedor');
    },
  });
  assert.equal((await failed.executeStep(failed.run)).kind, 'failed');
  assert.equal(failed.events.at(-1).kind, 'error');
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
    states: [{ next: 'composicao' }, { next: 'revisao' }, { next: 'pronto' }],
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
    'o token anterior não assume a revisão',
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
