import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { SITE_STRUCTURES } = await j.import('../lib/design/structures.ts');
const { scenePlan } = await j.import('../lib/images/scene-plan.ts');

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
/** As cinco vagas que o plano deste cliente pede, como a etapa agora envia. */
const planInput = {
  scenes: [
    { request: 'Abertura na bancada.', role: 'hero', targetBlock: 'hero.split' },
    {
      request: 'Aplicação do serviço em detalhe.',
      role: 'protagonista',
      targetBlock: 'feature.explorer',
    },
    {
      request: 'Equipe conferindo o resultado.',
      role: 'protagonista',
      targetBlock: 'feature.explorer',
    },
    {
      request: 'Cena da página interna de serviços.',
      role: 'subpagina',
      targetBlock: 'narrative.split',
    },
    {
      request: 'Cena da página interna de contato.',
      role: 'subpagina',
      targetBlock: 'media.image',
    },
  ],
};

/** Um cliente v5 da estrutura, como o briefing entrega para a etapa de cenas. */
function brandFor(structure) {
  return {
    vibe: structure.vibe,
    design: {
      version: 5,
      structure: structure.key,
      structureRationale: 'A jornada corresponde ao objetivo deste cliente.',
      concept: 'Direção construída para o assunto do negócio',
      signatureElement: 'Composição que relaciona cenas e critérios',
      displayFont: 'sans',
      bodyFont: 'sans',
      heroComposition: structure.openings[0].split(':')[1],
      navigation: 'bar',
      rhythm: 'alternating',
      imageTreatment: 'framed',
      surfaceStyle: 'flat',
      motif: 'none',
    },
  };
}

async function fixture(brand = tenant.brand) {
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
      buildTools({ ...tenant, id, brand }, phase ? { phase } : {})
        .prepare_site_images,
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
  const first = tool.execute(planInput);
  await entered.promise;
  try {
    // Cinco vagas já reservadas: outro lote de cinco estoura o turno antes de
    // qualquer await, sem chegar a gerar nada.
    assert.match((await tool.execute(planInput)).error, /Orçamento/);
    assert.equal(f.calls.length, 0);
  } finally {
    release.resolve();
  }
  assert.equal((await first).ok, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].scenes.length, 5);
});

await test('a etapa gera o plano inteiro numa chamada e recusa vaga fora dele', async () => {
  const f = await fixture();
  const tool = f.tools();
  assert.equal((await tool.execute(planInput)).ok, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].scenes.length, 5);

  // Bloco que não é vaga em aberto continua recusado dentro do lock.
  const other = await fixture();
  const rejected = await other.tools().execute({
    scenes: [
      {
        request: 'Cena para um bloco que o plano não pede.',
        role: 'apoio',
        targetBlock: 'editorial.resources',
      },
    ],
  });
  assert.match(rejected.error, /não é uma vaga em aberto/);
  assert.equal(other.calls.length, 0);
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

await test('foto posterior ao snapshot preenche a vaga sem duplicar geração e libera o lock', async () => {
  const f = await fixture();
  const stale = f.tools();
  f.images.set('fixture', [
    {
      status: 'candidata',
      kind: 'foto',
      model: 'openai/gpt-image-2',
      blobPath: 'tenants/fixture/gerado/1.webp',
      url: 'https://assets.test/1.webp',
      ratio: '4:5',
      targetBlock: 'hero.split',
    },
  ]);
  // A vaga do hero já foi coberta por outra requisição: nada é gerado de novo.
  assert.match((await stale.execute(input)).error, /não é uma vaga em aberto/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.active.size, 0);
  f.images.set('fixture', []);
  assert.equal((await stale.execute(input)).ok, true);
});

await test('validação sem geração devolve orçamento; falha após tentar gerar o consome', async () => {
  const f = await fixture();
  const tool = f.tools();
  f.hooks.noGuide = true;
  assert.match((await tool.execute(planInput)).error, /guia de imagem/);
  f.hooks.noGuide = false;
  f.hooks.generate = () => {
    throw new Error('Falha sintética do provedor');
  };
  // A tentativa paga consome as cinco vagas do turno; um lote novo de cinco
  // já não cabe no orçamento.
  assert.match((await tool.execute(planInput)).error, /Falha/);
  assert.match((await tool.execute(planInput)).error, /Orçamento/);
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

await test('o lote da etapa cobre o plano de cada estrutura na proporção da assinatura', async () => {
  for (const structure of Object.values(SITE_STRUCTURES)) {
    const brand = brandFor(structure);
    const f = await fixture(brand);
    // O mesmo lote que o runner monta a partir do plano, com a proporção que
    // a vaga pede. A assinatura 16:9 e 4:5 caía no 4:3 do tipo e a etapa
    // inteira era recusada antes de gerar qualquer cena.
    const plan = scenePlan(brand.design, 3, structure.vibe);
    const result = await f.tools().execute({
      scenes: plan.map((slot, index) => ({
        request: `Cena ${index + 1} do cliente, com assunto concreto e enquadramento próprio.`,
        role: slot.role,
        targetBlock: slot.targetBlock,
        ratio: slot.ratio,
      })),
    });
    assert.equal(result.ok, true, `${structure.key}: ${result.error}`);
    assert.deepEqual(
      f.calls[0].scenes.map((scene) => scene.ratio),
      plan.map((slot) => slot.ratio),
      structure.key,
    );
    const signature = f.calls[0].scenes.filter(
      (scene) => scene.targetBlock === 'signature.composition',
    );
    assert.equal(signature.length, 2, structure.key);
    assert.ok(
      signature.every((scene) => scene.ratio === structure.signatureRatio),
      structure.key,
    );
  }
});
