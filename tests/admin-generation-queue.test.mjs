import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

const runId = '0eb4847d-0f93-48be-ac16-2e76bb0a645e';

await test('despacho na Vercel não volta à rota HTTP após quatro etapas', async () => {
  const sent = [];
  let httpCalls = 0;
  const { dispatchStep } = await loadModule(
    'lib/generation/dispatch.ts',
    {
      '@vercel/queue': {
        send: async (...args) => {
          sent.push(args);
          return { messageId: `message-${sent.length}` };
        },
      },
      '@/lib/generation/token': {
        createStepToken: async () => 'fixture-token',
      },
    },
    {
      process: { env: { VERCEL: '1' } },
      fetch: async () => {
        httpCalls++;
        return new Response('INFINITE_LOOP_DETECTED', { status: 508 });
      },
    },
  );
  for (let hop = 0; hop < 6; hop++)
    await dispatchStep({
      origin: 'https://fixture.test',
      slug: 'fixture',
      runId,
      hop,
    });
  assert.equal(httpCalls, 0);
  assert.equal(sent.length, 6);
  assert.equal(
    new Set(sent.map(([, , options]) => options.idempotencyKey)).size,
    6,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(sent[5][1])), {
    slug: 'fixture',
    runId,
    hop: 5,
  });
});

await test('falha na fila não recai na recursão HTTP e conserva a chave do salto', async () => {
  const keys = [];
  const { dispatchStep } = await loadModule(
    'lib/generation/dispatch.ts',
    {
      '@vercel/queue': {
        send: async (_topic, _message, options) => {
          keys.push(options.idempotencyKey);
          throw new Error('Fila indisponível');
        },
      },
    },
    {
      process: { env: { VERCEL: '1' } },
      fetch: () => assert.fail('Falha da fila não autoriza recursão HTTP'),
    },
  );
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      dispatchStep({
        origin: 'https://fixture.test',
        slug: 'fixture',
        runId,
        hop: 3,
      }),
      /Fila indisponível/,
    );
  assert.deepEqual(keys, [`${runId}:3`, `${runId}:3`]);
});

await test('desenvolvimento local mantém a chamada HTTP assinada e limitada', async () => {
  const requests = [];
  const { dispatchStep } = await loadModule(
    'lib/generation/dispatch.ts',
    {
      '@vercel/queue': {
        send: () => assert.fail('Testes locais não escrevem na fila remota'),
      },
      '@/lib/generation/token': {
        createStepToken: async (id, hop) => `${id}.${hop}.signed`,
      },
    },
    {
      process: { env: {} },
      fetch: async (url, init) => {
        requests.push({ url, init });
        return new Response(null, { status: 202 });
      },
    },
  );
  await dispatchStep({
    origin: 'http://localhost:3000',
    slug: 'fixture',
    runId,
    hop: 2,
  });
  assert.equal(
    requests[0].url,
    'http://localhost:3000/api/admin/fixture/generation/step',
  );
  assert.equal(requests[0].init.headers['x-eixu-run'], `${runId}.2.signed`);
  assert.equal(requests[0].init.method, 'POST');
  assert.ok(requests[0].init.signal);
});

async function consumerFixture({
  beforeStep = async () => {},
  failDispatch = false,
} = {}) {
  const active = ['queued', 'running', 'stopping'];
  const run = {
    id: runId,
    tenantId: 'tenant',
    status: 'queued',
    hops: 0,
    phase: 'briefing',
    origin: 'https://fixture.test',
  };
  const phases = ['briefing', 'cenas', 'composicao', 'revisao'];
  const pending = [],
    events = [],
    executed = [];
  const store = {
    ACTIVE_STATUS: active,
    getRun: async (id) => (id === run.id ? structuredClone(run) : null),
    claimStep: async (_id, hop) => {
      if (run.hops !== hop || !active.includes(run.status)) return null;
      run.hops++;
      if (run.status !== 'stopping') run.status = 'running';
      return structuredClone(run);
    },
    failReservedStep: async (_id, hops, error) => {
      if (run.hops !== hops || !active.includes(run.status)) return false;
      Object.assign(run, { status: 'failed', error });
      return true;
    },
    recordEvent: async (event) => events.push(event),
  };
  const { dispatchStep } = await loadModule(
    'lib/generation/dispatch.ts',
    {
      '@vercel/queue': {
        send: async (_topic, message) => {
          if (failDispatch) throw new Error('Fila indisponível');
          pending.push(structuredClone(message));
          return { messageId: 'fixture' };
        },
      },
    },
    { process: { env: { VERCEL: '1' } } },
  );
  const worker = await loadModule('lib/generation/step.ts', {
    '@/lib/generation/runs': store,
    '@/lib/generation/dispatch': { dispatchStep },
    '@/lib/generation/runner': {
      executeStep: async (claimed) => {
        if (claimed.status === 'stopping') return { kind: 'paused' };
        await beforeStep(run);
        executed.push(phases[claimed.hops - 1]);
        return claimed.hops === phases.length
          ? { kind: 'done' }
          : { kind: 'continue', phase: phases[claimed.hops] };
      },
      settleRun: async (_run, outcome) => {
        if (outcome.kind !== 'continue') run.status = outcome.kind;
      },
    },
  });
  let consume, options;
  await loadModule('app/api/queues/generation/route.ts', {
    '@vercel/queue': {
      handleCallback: (callback, config) => {
        consume = callback;
        options = config;
        return async () => new Response(null);
      },
    },
    '@/lib/generation/runs': store,
    '@/lib/generation/step': worker,
    '@/lib/tenant-queries': {
      getTenantBySlug: async (slug) => ({
        id: slug === 'fixture' ? 'tenant' : 'another',
      }),
    },
  });
  const message = (hop) => ({ runId, slug: 'fixture', hop });
  return { run, executed, events, pending, consume, options, message };
}

await test('fila conduz as quatro fases, inclusive a revisão, sem navegador', async () => {
  const f = await consumerFixture();
  f.pending.push(f.message(0));
  while (f.pending.length) await f.consume(f.pending.shift());
  assert.deepEqual(f.executed, ['briefing', 'cenas', 'composicao', 'revisao']);
  assert.equal(f.run.status, 'done');
  assert.equal(f.run.hops, 4);
});

await test('duplicatas simultâneas aguardam o trabalho sem repetir reserva nem modelo', async () => {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  const f = await consumerFixture({
    beforeStep: async () => {
      entered.resolve();
      await release.promise;
    },
  });
  let acknowledged = false;
  const first = f.consume(f.message(0)).then(() => {
    acknowledged = true;
  });
  await entered.promise;
  await f.consume(f.message(0));
  assert.equal(
    acknowledged,
    false,
    'a fila só confirma depois da etapa e da continuação',
  );
  assert.equal(f.run.hops, 1);
  release.resolve();
  await first;
  assert.deepEqual(f.executed, ['briefing']);
  assert.equal(f.pending.length, 1);
});

await test('fila recusa outro tenant, mensagem inválida e salto futuro; pausa não gera', async () => {
  const f = await consumerFixture();
  await f.consume({ ...f.message(0), slug: 'other' });
  await f.consume(f.message(1));
  await assert.rejects(f.consume({ ...f.message(0), hop: -1 }));
  assert.equal(f.run.hops, 0);
  assert.deepEqual(f.executed, []);
  f.run.status = 'stopping';
  await f.consume(f.message(0));
  assert.equal(f.run.status, 'paused');
  assert.deepEqual(f.executed, []);
  assert.equal(f.pending.length, 0);
});

await test('falha de entrega fica no painel e na linha do tempo com progresso preservado', async () => {
  const f = await consumerFixture({ failDispatch: true });
  await f.consume(f.message(0));
  assert.equal(f.run.status, 'failed');
  assert.match(f.run.error, /progresso está salvo/);
  assert.equal(f.events[0].kind, 'error');
  assert.deepEqual(f.executed, ['briefing']);
  await f.consume(f.message(0));
  assert.deepEqual(f.executed, ['briefing']);
});

await test('resposta perdida do envio não encerra a reserva seguinte', async () => {
  const f = await consumerFixture({
    beforeStep: async (run) => {
      run.hops++;
    },
    failDispatch: true,
  });
  await f.consume(f.message(0));
  assert.equal(f.run.status, 'running');
  assert.equal(f.run.hops, 2);
  assert.equal(f.events.length, 0);
});

await test('recibo com revisão pendente não promete despacho bem-sucedido', async () => {
  const { savedProgressMessage } = await loadModule('lib/ai/chat-progress.ts');
  const text = savedProgressMessage(
    {
      generation: {
        next: 'revisao',
        coveredScenes: 6,
        targetScenes: 6,
        photos: 8,
      },
      pages: [1, 2, 3, 4],
    },
    true,
  );
  assert.match(text, /revisão visual.*pendente/);
  assert.match(text, /Acompanhe pelo painel/);
  assert.doesNotMatch(text, /começa em seguida|Use Continuar/);
});

await test('recibo conta cenas só antes da composição e não chama site pronto de incompleto', () => {
  return loadModule('lib/ai/chat-progress.ts').then(
    ({ savedProgressMessage }) => {
      const scenes = savedProgressMessage({
        generation: { next: 'cenas', coveredScenes: 2, targetScenes: 6, photos: 2 },
        pages: [],
      });
      assert.match(scenes, /^Progresso salvo: 2 de 6 cenas e 0 páginas\./);
      const done = savedProgressMessage({
        generation: { next: 'pronto', coveredScenes: 3, targetScenes: 6, photos: 9 },
        pages: [1, 2, 3, 4, 5],
      });
      assert.match(done, /^Progresso salvo: 5 páginas e 9 fotos na biblioteca\./);
      assert.match(done, /concluída sem erros/);
      assert.doesNotMatch(done, /3 de 6|Use Continuar/);
    },
  );
});

await test('falha do primeiro envio distingue recusa de resposta perdida após reserva', async () => {
  for (const delivered of [false, true]) {
    const run = { id: runId, hops: 0, status: 'queued' };
    const { startGeneration } = await loadModule('lib/generation/start.ts', {
      '@/lib/generation/runs': {
        activeRun: async () => null,
        expireStaleRun: async (value) => value,
        createRun: async () => structuredClone(run),
        recordEvent: async () => {},
        getRun: async () => structuredClone(run),
        failReservedStep: async (_id, hop, error) => {
          if (run.hops !== hop) return false;
          Object.assign(run, { status: 'failed', error });
          return true;
        },
      },
      '@/lib/generation/dispatch': {
        dispatchStep: async () => {
          if (delivered) Object.assign(run, { status: 'running', hops: 1 });
          throw new Error('Conexão perdida');
        },
      },
      '@/lib/images/queries': { listImages: async () => [] },
      '@/lib/tenant-queries': { listPages: async () => [] },
      '@/lib/sites/generation': {
        generationState: () => ({ next: 'revisao' }),
      },
    });
    const result = await startGeneration({
      tenant: { id: 'tenant', slug: 'fixture' },
      origin: 'https://fixture.test',
    });
    assert.equal(result.ok, delivered);
    assert.equal(run.status, delivered ? 'running' : 'failed');
    if (delivered) assert.equal(result.run.hops, 1);
    else {
      assert.equal(result.status, 502);
      assert.match(result.error, /Tentar novamente/);
    }
  }
});
