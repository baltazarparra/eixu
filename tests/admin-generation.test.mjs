import test from 'node:test';
import assert from 'node:assert/strict';
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

await test('feed distingue cliente novo de tentativa anterior às execuções no servidor', async () => {
  const fresh = await generationFeedFixture();
  assert.equal((await fresh.read()).everRan, false);

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
      isStopping: async () => false,
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
        return {
          id: 'tenant-1',
          slug: 'fixture',
          name: 'Fixture',
          brand: { design: { version: 2 } },
          brief: social,
          dials: {},
          imageGuide: {},
        };
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
      savedProgressMessage: () => 'Progresso salvo: recibo sintético.',
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
            steps: [{ text, providerMetadata: {} }],
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
      '@/lib/generation/runs': {
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
        finishRun: async (_id, status, error) =>
          Object.assign(f.run, { status, error }),
      },
      '@/lib/generation/runner': f,
      '@/lib/generation/dispatch': {
        dispatchStep: async (input) => dispatches.push(input),
      },
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
