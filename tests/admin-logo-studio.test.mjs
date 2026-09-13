import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';
import { logoAssetFor } from './helpers/logo-fixture.mjs';
const { runLogoStudio, shouldRunLogoStudio, logoAutoApplyGate } =
  await loadModule('lib/images/logo-studio.ts');
const source =
  'https://test.public.blob.vercel-storage.com/tenants/demo/logo/123-marca.png';
const tenant = {
  id: 'tenant-1',
  slug: 'demo',
  name: 'Marca',
  brief: { intake: { oferta: 'Teste' }, social: { status: 'ok' } },
  brand: { logoUrl: source, logoRevision: 'rev-1' },
};

function fixture(options = {}) {
  const events = [],
    receipts = [],
    writes = [],
    inserted = [];
  let claimed = false,
    replacements = 0,
    derives = 0;
  const deps = {
    fetch: async () => ({
      bytes: Buffer.from('synthetic source'),
      contentType: 'image/png',
    }),
    claim: async (_id, _url, state) => {
      if (claimed) return false;
      claimed = true;
      writes.push(structuredClone(state));
      return true;
    },
    revision: async () => ({ ...tenant.brand }),
    prepare: async () => ({
      asset: logoAssetFor(source),
      master: Buffer.from('clean master'),
    }),
    setDerived: async () => true,
    list: async () => [],
    insert: async (value) => {
      inserted.push(value);
      return { seq: 12 };
    },
    generate: async (input) => {
      assert.equal(input.reference.toString(), 'clean master');
      assert.equal(input.variants, 2);
      if (options.throwGenerate) throw new Error('geração falhou');
      return {
        images: ['fiel', 'ousada'].map((variant, i) => ({
          id: `img-${i}`,
          seq: 13 + i,
          variant,
          bytes: Buffer.from(variant),
          url: `https://assets.test/${variant}.png`,
          width: 500,
          height: 140,
        })),
        failures: [],
      };
    },
    critique: async (input) => ({
      nota: 8.4,
      aprovado: true,
      nome_correto: true,
      fidelidade_original: 8,
      variante: input.variant,
      ...options.critique,
    }),
    replace: async (_id, old, url, revision) => {
      replacements++;
      assert.equal(old, source);
      assert.equal(revision, 'rev-1');
      return options.changed ? null : { logoUrl: url, logoRevision: 'rev-2' };
    },
    derive: async () => {
      derives++;
    },
    finish: async (_id, state) => {
      writes.push(structuredClone(state));
      return true;
    },
  };
  return {
    deps,
    events,
    receipts,
    writes,
    inserted,
    replacements: () => replacements,
    derives: () => derives,
    input: {
      tenant: structuredClone(tenant),
      trigger: 'briefing',
      onEvent: async (e) => events.push(e),
      persistReceipt: async (text) => receipts.push(text),
    },
  };
}

await test('estúdio preserva o original, aplica só fiel e registra reversão no chat', async () => {
  const f = fixture();
  const result = await runLogoStudio(f.input, f.deps);
  assert.equal(result.status, 'done');
  assert.equal(result.applied.seq, 13);
  assert.equal(result.original.seq, 12);
  assert.equal(result.recommended, 13);
  assert.equal(f.replacements(), 1);
  assert.equal(f.derives(), 1);
  assert.equal(f.inserted[0].model, 'upload');
  assert.equal(f.inserted[0].width, 1024);
  assert.match(f.receipts[0], /volta para a #12/);
  assert.match(f.receipts[0], /só muda ao publicar/);
  assert.deepEqual(
    f.events.map((e) => e.kind),
    ['start', 'end'],
  );
  assert.equal(f.input.tenant.brief.social.status, 'ok');
  const again = await runLogoStudio(f.input, f.deps);
  assert.equal(again.status, 'skipped');
  assert.equal(f.replacements(), 1);
});

await test('gates recusam nota, fidelidade, grafia, origem gerada, chat e flag desligada', async () => {
  const good = {
    variant: 'fiel',
    aprovado: true,
    nomeCorreto: true,
    score: 8,
    fidelidade: 7,
  };
  assert.equal(
    logoAutoApplyGate({ tenant, proposal: good, trigger: 'briefing' }),
    undefined,
  );
  for (const change of [
    { score: 7.9 },
    { fidelidade: 6.9 },
    { nomeCorreto: false },
    { aprovado: false },
    { variant: 'ousada' },
    { score: null },
    { fidelidade: null },
  ])
    assert.ok(
      logoAutoApplyGate({
        tenant,
        proposal: { ...good, ...change },
        trigger: 'briefing',
      }),
    );
  assert.ok(logoAutoApplyGate({ tenant, proposal: good, trigger: 'chat' }));
  assert.ok(
    logoAutoApplyGate({
      tenant,
      proposal: good,
      trigger: 'briefing',
      enabled: false,
    }),
  );
  assert.ok(
    logoAutoApplyGate({
      tenant: {
        ...tenant,
        brand: { logoUrl: 'https://assets.test/generated.png' },
      },
      proposal: good,
      trigger: 'briefing',
    }),
  );
  for (const invalid of [
    source.replace('https:', 'http:'),
    source.replace('test.public.blob.vercel-storage.com', 'external.test'),
    source.replace('/123-', '/asset/123-'),
    source.replace('/demo/', '/other/'),
  ])
    assert.ok(
      logoAutoApplyGate({
        tenant: { ...tenant, brand: { logoUrl: invalid } },
        proposal: good,
        trigger: 'briefing',
      }),
    );
  const f = fixture({ critique: { nota: 7 } });
  const result = await runLogoStudio(f.input, f.deps);
  assert.equal(result.applied, undefined);
  assert.equal(f.replacements(), 0);
  assert.equal(result.recommended, 13);
  assert.match(result.gate, /abaixo de 8/);
});

await test('mudança concorrente mantém propostas, sem sobrescrever a escolha manual', async () => {
  const f = fixture({ changed: true });
  const result = await runLogoStudio(f.input, f.deps);
  assert.equal(result.applied, undefined);
  assert.equal(result.status, 'done');
  assert.equal(f.derives(), 0);
  assert.match(result.gate, /operador/);
});

await test('original rejeitado antigo não é usado como caminho de reversão', async () => {
  const f = fixture();
  f.deps.list = async () => [
    { seq: 1, kind: 'logo', status: 'rejeitada', url: source },
  ];
  const state = await runLogoStudio(f.input, f.deps);
  assert.equal(state.original.seq, 12);
  assert.equal(f.inserted.length, 1);
  assert.match(f.receipts[0], /volta para a #12/);
});

await test('falha e cancelamento nunca rejeitam; original continua disponível', async () => {
  const f = fixture({ throwGenerate: true });
  const result = await runLogoStudio(f.input, f.deps);
  assert.equal(result.status, 'failed');
  assert.equal(result.original.seq, 12);
  assert.equal(f.replacements(), 0);
  assert.equal(f.receipts.length, 1);
  const controller = new AbortController();
  controller.abort();
  const cancelled = fixture();
  const stopped = await runLogoStudio(
    { ...cancelled.input, signal: controller.signal },
    cancelled.deps,
  );
  assert.equal(stopped.status, 'failed');
  assert.equal(cancelled.inserted.length, 0);
});

await test('idempotência reconhece hash, aplicação concluída e lease vencido', () => {
  const state = {
    status: 'running',
    sourceHash: 'hash',
    startedAt: new Date().toISOString(),
    proposals: [],
  };
  const current = { ...tenant, brief: { logoStudio: state } };
  assert.equal(shouldRunLogoStudio(current, 'hash'), false);
  assert.equal(
    shouldRunLogoStudio(
      {
        ...current,
        brief: {
          logoStudio: { ...state, startedAt: '2000-01-01T00:00:00.000Z' },
        },
      },
      'hash',
    ),
    true,
  );
  assert.equal(
    shouldRunLogoStudio(
      { ...current, brief: { logoStudio: { ...state, status: 'done' } } },
      'hash',
    ),
    false,
  );
  assert.equal(shouldRunLogoStudio({ ...current, brand: {} }, 'hash'), false);
});

await test('consulta do estúdio mescla só sua chave e condiciona conclusão à reserva', async () => {
  const calls = [];
  const { claimLogoStudio, finishLogoStudio } = await loadModule(
    'lib/images/logo-studio-queries.ts',
    {
      '@/lib/db': {
        db:
          () =>
          async (parts, ...values) => {
            calls.push({ sql: parts.join('?'), values });
            return [{ id: tenant.id }];
          },
      },
    },
  );
  const state = {
    status: 'running',
    sourceHash: 'hash',
    startedAt: new Date().toISOString(),
    proposals: [],
  };
  await claimLogoStudio(tenant.id, source, state);
  await finishLogoStudio(tenant.id, { ...state, status: 'done' });
  for (const call of calls) {
    assert.match(call.sql, /coalesce\(brief, '\{\}'::jsonb\) \|\|/);
    const patch = JSON.parse(
      call.values.find(
        (value) => typeof value === 'string' && value.startsWith('{'),
      ),
    );
    assert.deepEqual(Object.keys(patch), ['logoStudio']);
  }
  assert.match(calls[1].sql, /logoStudio,startedAt/);
});
