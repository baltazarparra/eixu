import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

const tenant = {
  id: 'fixture',
  slug: 'fixture',
  brand: {
    design: {
      version: 2,
      concept: 'Oficina sintética',
      signatureElement: 'Bancada',
      displayFont: 'sans',
      bodyFont: 'sans',
      heroComposition: 'split',
      navigation: 'bar',
      rhythm: 'alternating',
      imageTreatment: 'framed',
      surfaceStyle: 'flat',
      motif: 'none',
    },
  },
  brief: {},
  dials: {},
};
const input = {
  scenes: [
    {
      request: 'Profissional trabalhando em uma bancada da oficina.',
      role: 'hero',
      targetBlock: 'hero.split',
    },
  ],
};

async function fixture() {
  const active = new Set(),
    images = new Map(),
    calls = [];
  const hooks = {};
  const lock = await loadModule('lib/images/generation-lock.ts', {
    '@/lib/db': {
      transaction: async (run) => {
        let held;
        try {
          return await run({
            query: async (_sql, [key]) => {
              if (active.has(key)) return { rows: [{ acquired: false }] };
              active.add(key);
              held = key;
              return { rows: [{ acquired: true }] };
            },
          });
        } finally {
          if (held) active.delete(held);
        }
      },
    },
  });
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/images/generation-lock': lock,
    '@/lib/images/queries': {
      getGuide: async () => {
        await hooks.guide?.();
        return hooks.noGuide ? null : {};
      },
      guideIsEmpty: (guide) => !guide,
      listImages: async (id) => {
        await hooks.library?.();
        return images.get(id) ?? [];
      },
    },
    '@/lib/images/site-assets': {
      prepareSiteImages: async (client, scenes) => {
        calls.push({ id: client.id, scenes });
        await hooks.generate?.();
        images.set(client.id, [{ status: 'candidata' }]);
        return { ok: true };
      },
    },
  });
  return {
    calls,
    hooks,
    images,
    active,
    tools: (id = tenant.id, phase = 'cenas') =>
      buildTools({ ...tenant, id }, phase ? { phase } : {}).prepare_site_images,
  };
}

await test('chamadas paralelas no mesmo turno reservam orçamento antes de qualquer await', async () => {
  const f = await fixture();
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  f.hooks.guide = async () => {
    entered.resolve();
    await release.promise;
  };
  const tool = f.tools();
  const first = tool.execute(input);
  await entered.promise;
  try {
    assert.match((await tool.execute(input)).error, /Orçamento/);
    assert.equal(f.calls.length, 0);
  } finally {
    release.resolve();
  }
  assert.equal((await first).ok, true);
  assert.equal(f.calls.length, 1);
});

await test('requisições distintas do mesmo tenant não geram em paralelo; outro tenant avança', async () => {
  const f = await fixture();
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  f.hooks.generate = async () => {
    entered.resolve();
    await release.promise;
  };
  const first = f.tools().execute(input);
  await entered.promise;
  try {
    assert.match((await f.tools().execute(input)).error, /em andamento/);
    f.hooks.generate = undefined;
    assert.equal((await f.tools('other').execute(input)).ok, true);
  } finally {
    release.resolve();
  }
  await first;
  assert.deepEqual(
    f.calls.map((call) => call.id),
    ['fixture', 'other'],
  );
  assert.equal(f.active.size, 0);
});

await test('candidata posterior ao snapshot da rota impede nova geração e libera o lock', async () => {
  const f = await fixture();
  const stale = f.tools();
  f.images.set('fixture', [{ status: 'candidata' }]);
  assert.match((await stale.execute(input)).error, /aguardando decisão/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.active.size, 0);
  f.images.set('fixture', []);
  assert.equal((await stale.execute(input)).ok, true);
});

await test('validação sem geração devolve orçamento; falha após tentar gerar o consome', async () => {
  const f = await fixture();
  const tool = f.tools();
  f.hooks.noGuide = true;
  assert.match((await tool.execute(input)).error, /guia de imagem/);
  f.hooks.noGuide = false;
  f.hooks.generate = () => {
    throw new Error('Falha sintética do provedor');
  };
  assert.match((await tool.execute(input)).error, /Falha/);
  assert.match((await tool.execute(input)).error, /Orçamento/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.active.size, 0);
});

await test('chat livre preserva oito cenas por turno, inclusive em chamadas paralelas', async () => {
  const f = await fixture();
  const free = f.tools('fixture', null);
  const results = await Promise.all([
    free.execute({ scenes: Array(6).fill(input.scenes[0]) }),
    free.execute({ scenes: Array(3).fill(input.scenes[0]) }),
  ]);
  assert.equal(results[0].ok, true);
  assert.match(results[1].error, /Orçamento/);
  assert.equal(
    (await free.execute({ scenes: Array(2).fill(input.scenes[0]) })).ok,
    true,
  );
  assert.match((await free.execute(input)).error, /Orçamento/);
  assert.equal(
    f.calls.reduce((sum, call) => sum + call.scenes.length, 0),
    8,
  );
});
