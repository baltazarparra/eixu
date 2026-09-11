import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToModelMessages } from 'ai';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { contextMessages } = await j.import('../lib/ai/context.ts');
const { reviewFingerprint, currentReview } = await j.import(
  '../lib/review/state.ts',
);
const { nextPhase, compositionReadyForReview } = await j.import(
  '../lib/taste/phases.ts',
);
const { reviewSchemaFor, validateReviewReferences } = await j.import(
  '../lib/review/critic.ts',
);

const tenant = {
  id: 'fixture',
  slug: 'fixture',
  name: 'Fixture',
  brand: {},
  dials: {},
  brief: {},
  imageGuide: {},
};
const pages = [
  {
    id: 'p',
    slug: '',
    title: 'Início',
    type: 'page',
    blocks: [
      {
        id: 'hero',
        type: 'hero.split',
        props: { headline: 'Conteúdo confirmado' },
      },
    ],
    seo: {},
    meta: {},
  },
];
const images = [
  {
    id: 'image',
    url: 'https://assets.test/foto.webp',
    status: 'disponivel',
    alt: 'Inspiração',
  },
];

await test('crítico recebe caminhos e IDs existentes no schema de saída', () => {
  const schema = reviewSchemaFor(pages);
  const finding = {
    page: '/',
    blockId: 'hero',
    level: 'warn',
    criterion: 'abertura',
    evidence: 'Título ocupa muitas linhas.',
    correction: 'Reduza o título preservando a oferta.',
  };
  assert.equal(
    schema.safeParse({ findings: [finding], strengths: [] }).success,
    true,
  );
  assert.equal(
    schema.safeParse({ findings: [{ ...finding, page: '' }], strengths: [] })
      .success,
    false,
  );
  assert.throws(
    () =>
      validateReviewReferences(pages, [{ ...finding, blockId: 'hero.split' }]),
    /bloco/,
  );
  assert.equal(
    schema.safeParse({
      findings: [{ ...finding, blockId: null }],
      strengths: [],
    }).success,
    true,
  );
});

await test('composição transfere avisos para revisão e mantém erros e recusas no reparo', () => {
  const saved = {
    toolName: 'build_site',
    output: {
      ok: true,
      pages: [{ page: '/' }],
      pendencias: [{ level: 'warn', rule: 'imagem-proporcao' }],
    },
  };
  assert.equal(compositionReadyForReview([saved]), true);
  assert.equal(
    compositionReadyForReview([
      {
        ...saved,
        output: { ...saved.output, publicationPending: [{ level: 'error' }] },
      },
    ]),
    false,
  );
  assert.equal(
    compositionReadyForReview([
      saved,
      { toolName: 'repair_site', output: { ok: false } },
    ]),
    false,
  );
  assert.equal(
    compositionReadyForReview([
      { toolName: 'lint_site', output: { ok: true } },
    ]),
    false,
  );
});

await test('ferramentas de um passo preservam alterações concorrentes e retomam após recusa', async () => {
  const { serialTools } = await j.import('../lib/ai/serial-tools.ts');
  let state = { title: 'Antes', description: 'Preservada' };
  const tools = serialTools({
    edit: {
      execute: async (patch) => {
        const snapshot = { ...state };
        await new Promise((resolve) => setTimeout(resolve, 10));
        state = { ...snapshot, ...patch };
      },
    },
    fail: {
      execute: async () => {
        throw new Error('Recusa');
      },
    },
  });
  await Promise.all([
    tools.edit.execute({ title: 'Depois' }),
    tools.edit.execute({ description: 'Atualizada' }),
  ]);
  assert.deepEqual(state, { title: 'Depois', description: 'Atualizada' });
  await assert.rejects(tools.fail.execute({}), /Recusa/);
  await tools.edit.execute({ title: 'Corrigido' });
  assert.equal(state.title, 'Corrigido');
  const aborted = AbortSignal.abort();
  await assert.rejects(
    tools.edit.execute({ title: 'Não deve gravar' }, { abortSignal: aborted }),
    { name: 'AbortError' },
  );
  assert.equal(state.title, 'Corrigido');
});

await test('contexto recente conserva resultado, anexo e assinatura do provedor sem alteração', async () => {
  const conversation = [
    {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: 'Preserve o rodapé.' }],
    },
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-get_page',
          toolCallId: 'call',
          state: 'output-available',
          input: { page: '' },
          output: pages[0],
          callProviderMetadata: {
            google: { thoughtSignature: 'synthetic-signature' },
          },
        },
      ],
    },
    {
      id: 'u2',
      role: 'user',
      parts: [{ type: 'text', text: 'Corrija só o título.' }],
    },
  ];
  const result = contextMessages(conversation);
  assert.deepEqual(result, conversation);
  const converted = await convertToModelMessages(result);
  assert.match(JSON.stringify(converted), /synthetic-signature/);
  assert.match(JSON.stringify(converted), /Conteúdo confirmado/);
});

await test('recibos antigos preservam pendências sem transformar ok em qualidade aprovada', () => {
  const result = contextMessages(
    [
      {
        id: 'u',
        role: 'user',
        parts: [{ type: 'text', text: 'Não invente serviços.' }],
      },
      {
        id: 'a',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_site',
            toolCallId: 'old',
            state: 'output-available',
            input: {},
            output: {
              ok: true,
              pendencias: [
                { rule: 'inbound', message: 'Falta página de consideração' },
              ],
            },
          },
        ],
      },
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Continue.' }] },
    ],
    { recentTurns: 1 },
  );
  assert.match(JSON.stringify(result), /Falta página de consideração/);
  assert.match(JSON.stringify(result), /Não invente serviços/);
  assert.doesNotMatch(JSON.stringify(result), /concluída/);
});

await test('recibo é invalidado por conteúdo, SEO, marca, contato e imagem, mas não pela ordem das chaves', () => {
  const fixture = structuredClone(tenant);
  fixture.brief.generation = {
    review: {
      fingerprint: reviewFingerprint(fixture, pages, images),
      complete: true,
      errors: 0,
      visual: 'complete',
    },
  };
  assert.ok(currentReview(fixture, pages, images));
  assert.ok(
    currentReview(
      {
        ...fixture,
        brief: {
          ...fixture.brief,
          generation: { ...fixture.brief.generation, updatedAt: 'agora' },
        },
      },
      pages,
      images,
    ),
  );
  for (const edited of [
    { ...fixture, name: 'Outro nome' },
    { ...fixture, brand: { accent: '#ffffff' } },
    { ...fixture, contacts: { phones: [{ number: '5511999990000' }] } },
    { ...fixture, brief: { ...fixture.brief, constraints: ['Não instalar'] } },
  ])
    assert.equal(currentReview(edited, pages, images), null);
  assert.equal(
    currentReview(
      fixture,
      [{ ...pages[0], seo: { title: 'Novo SEO' } }],
      images,
    ),
    null,
  );
  assert.equal(
    currentReview(fixture, [{ ...pages[0], blocks: [] }], images),
    null,
  );
  assert.equal(
    currentReview(fixture, pages, [{ ...images[0], status: 'rejeitada' }]),
    null,
  );
  assert.equal(
    reviewFingerprint(tenant, pages, images),
    reviewFingerprint({ ...tenant, brand: {}, brief: {} }, pages, images),
  );
});

await test('revisão antiga, incompleta ou desatualizada nunca encerra a geração', () => {
  const state = {
    hasDesign: true,
    coveredScenes: 4,
    targetScenes: 4,
    organicPages: 3,
    blockingErrors: 0,
    reviewRounds: 9,
  };
  assert.equal(nextPhase(state), 'revisao');
  assert.equal(nextPhase({ ...state, reviewComplete: false }), 'revisao');
  assert.equal(nextPhase({ ...state, reviewComplete: true }), 'pronto');
});

for (const mode of [
  'complete',
  'overflow',
  'missing-view',
  'critic-error',
  'material-error',
])
  await test(`revisão real orquestra capturas e crítico: ${mode}`, async () => {
    const fixture = structuredClone(tenant);
    let criticCalls = 0;
    const { buildTools } = await loadModule('lib/ai/tools.ts', {
      '@/lib/db': {
        db:
          () =>
          async (_parts, ...values) => {
            Object.assign(fixture.brief, JSON.parse(values[0]));
            return [];
          },
      },
      '@/lib/tenant-queries': {
        getTenantBySlug: async () => structuredClone(fixture),
        listPages: async () => pages,
      },
      '@/lib/images/queries': { listImages: async () => images },
      '@/lib/taste/lint': { lintPage: () => [] },
      '@/lib/taste/site': {
        lintSite: () => [],
        inboundSchema: (await j.import('../lib/taste/site.ts')).inboundSchema,
      },
      '@/lib/taste/metrics': {
        structuralFindings: () => [],
        siteMetrics: () => ({ pages: [] }),
      },
      '@/lib/review/capture': {
        capturePages: async () =>
          ['desktop', 'mobile']
            .slice(0, mode === 'missing-view' ? 1 : 2)
            .map((viewport) => ({
              page: '/',
              viewport,
              width: 390,
              scrollWidth: mode === 'overflow' ? 600 : 390,
              overflow: mode === 'overflow',
              brokenImages: 0,
              jpeg: Buffer.from('synthetic pixels'),
            })),
      },
      '@/lib/review/critic': {
        critiquePages: async (_tenant, _pages, shots) => {
          criticCalls += 1;
          assert.equal(shots.length, 2);
          if (mode === 'critic-error') throw new Error('Falha sintética');
          return {
            strengths: ['Hierarquia coerente'],
            findings:
              mode === 'material-error'
                ? [
                    {
                      page: '/',
                      blockId: 'hero',
                      level: 'error',
                      criterion: 'factualidade',
                      evidence: 'Promessa sem fonte',
                      correction: 'Remover a promessa',
                    },
                  ]
                : [],
          };
        },
      },
    });
    const tools = buildTools(fixture, { origin: 'https://fixture.test' });
    const result = await tools.review_pages.execute({});
    assert.equal(result.error, undefined);
    assert.equal(result.complete, mode === 'complete');
    assert.equal(
      fixture.brief.generation.review.complete,
      !['missing-view', 'critic-error'].includes(mode),
    );
    assert.equal(result.review.errors > 0, mode !== 'complete');
    assert.equal(criticCalls, mode === 'missing-view' ? 0 : 1);
    assert.doesNotMatch(
      JSON.stringify(result),
      /synthetic pixels|base64|"jpeg"/,
    );
    if (mode === 'complete') {
      await tools.review_pages.execute({});
      await tools.review_pages.execute({});
      assert.match(
        (await tools.review_pages.execute({})).error,
        /Três revisões/,
      );
      assert.equal(criticCalls, 3);
    }
  });
