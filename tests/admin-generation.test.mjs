import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';
import { chatFixture, chatRequest, readChunks } from './helpers/chat-fixture.mjs';

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
  const token = await createStepToken(run);
  assert.equal(await verifyStepToken(token), run);
  assert.equal(await verifyStepToken(null), null);
  assert.equal(await verifyStepToken('lixo'), null);
  const [id, expires, signature] = token.split('.');
  assert.equal(await verifyStepToken(`${id}.${expires}.${signature}x`), null);
  assert.equal(
    await verifyStepToken(`${id}.${Date.now() - 1000}.${signature}`),
    null,
  );
  // Assinatura de outro run não serve para este.
  const other = await createStepToken('11111111-1111-4111-8111-111111111111');
  assert.equal(
    await verifyStepToken(`${id}.${expires}.${other.split('.')[2]}`),
    null,
  );
});

await test('chat recusa turno novo enquanto a geração roda, sem gravar mensagem', async () => {
  const f = await chatFixture({
    running: { id: 'run-1', status: 'running', phase: 'composicao' },
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
  stopAfter = null,
  text = 'Etapa concluída.',
} = {}) {
  const events = [];
  const messages = [];
  const runs = new Map();
  let calls = 0;
  const run = {
    id: 'run-1',
    tenantId: 'tenant-1',
    status: 'queued',
    phase: null,
    phaseStartedAt: null,
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    hops: 0,
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
      startPhase: async (id, phase, expectedHops) => {
        const current = runs.get(id);
        if (current.hops !== expectedHops) return null;
        current.hops += 1;
        current.phase = phase;
        current.status = 'running';
        current.phaseStartedAt = new Date().toISOString();
        return { ...current };
      },
      saveProgress: async (id, progress) => {
        runs.get(id).progress = progress;
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
      getTenantBySlug: async () => ({
        id: 'tenant-1',
        slug: 'fixture',
        name: 'Fixture',
        brand: { design: { version: 2 } },
        brief: {},
        dials: {},
        imageGuide: {},
      }),
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
      phaseInstructions: () => 'Instruções sintéticas.',
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
      siteAgent: ({ shouldStop }) => ({
        generate: async ({ onToolExecutionStart, onToolExecutionEnd }) => {
          calls += 1;
          onToolExecutionStart({
            toolCall: { toolName: 'build_site', input: {} },
          });
          onToolExecutionEnd({
            toolCall: { toolName: 'build_site', input: {} },
            toolOutput: { type: 'tool-result', output: { ok: true, pages: [1, 2, 3] } },
          });
          if (stopAfter && calls >= stopAfter) shouldStop?.();
          return {
            text,
            steps: [{ text, providerMetadata: {} }],
            usage: {},
          };
        },
      }),
    },
  });
  return { ...runner, run, runs, events, messages, calls: () => calls };
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
});

await test('etapa já reivindicada por outra invocação não roda de novo', async () => {
  const f = await runnerFixture({ states: [{ next: 'composicao' }] });
  f.run.hops = 3; // o banco já avançou; este despacho é repetido
  const outcome = await f.executeStep({ ...f.run, hops: 0 });
  assert.equal(outcome.kind, 'claimed');
  assert.equal(f.calls(), 0);
  assert.equal(f.events.length, 0);
});

await test('etapa sem avanço encerra a execução em vez de repetir para sempre', async () => {
  const f = await runnerFixture({ states: [{ next: 'cenas', coveredScenes: 3 }] });
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
  const outcome = await f.executeStep({ ...f.run, hops: 14 });
  assert.equal(outcome.kind, 'failed');
  assert.match(outcome.error, /limite de etapas/);
  assert.equal(f.calls(), 0);
});

await test('resultado da etapa fecha o run com o estado correspondente', async () => {
  const f = await runnerFixture({ states: [{ next: 'composicao' }] });
  await f.settleRun(f.run, { kind: 'done' });
  assert.equal(f.runs.get('run-1').status, 'done');
  await f.settleRun(f.run, { kind: 'paused' });
  assert.equal(f.runs.get('run-1').status, 'paused');
  await f.settleRun(f.run, { kind: 'failed', error: 'motivo' });
  assert.equal(f.runs.get('run-1').status, 'failed');
  assert.equal(f.runs.get('run-1').error, 'motivo');
  // Reivindicação perdida não mexe no run: quem assumiu a etapa decide.
  f.runs.get('run-1').status = 'running';
  await f.settleRun(f.run, { kind: 'claimed' });
  assert.equal(f.runs.get('run-1').status, 'running');
});
