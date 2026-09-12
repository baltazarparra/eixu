import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToModelMessages } from 'ai';
import { createJiti } from 'jiti';
import { z } from 'zod';
import { loadModule } from './helpers/load-module.mjs';
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { contextMessages } = await j.import('../lib/ai/context.ts');
const { reviewFingerprint, currentReview } = await j.import(
  '../lib/review/state.ts',
);
const {
  nextPhase,
  compositionReadyToFinish,
  reviewConferenceDue,
  reviewReadyToFinish,
  PHASE_STEPS,
  REVIEW_CALLS_PER_TURN,
} = await j.import('../lib/taste/phases.ts');
const { reviewSchemaFor, resolveReviewReferences } = await j.import(
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

await test('conferência é forçada no último passo só quando ainda há leitura', () => {
  const read = { toolResults: [{ toolName: 'review_pages' }] };
  const edit = { toolResults: [{ toolName: 'update_block' }] };
  const last = PHASE_STEPS.revisao - 1;
  assert.equal(reviewConferenceDue([read, edit], last), true);
  assert.equal(reviewConferenceDue([read, edit], last - 1), false);
  // Forçar a quarta leitura só produzia recusa e queimava o passo reservado.
  assert.equal(
    reviewConferenceDue(Array(REVIEW_CALLS_PER_TURN).fill(read), last),
    false,
  );
});

await test('revisão encerra na conferência atual sem erros, mantendo espaço para refinamento', () => {
  const output = {
    complete: true,
    visual: 'complete',
    review: { complete: true, errors: 0, findings: [{ nivel: 'warn' }] },
  };
  const result = { toolName: 'review_pages', output };
  const first = { toolResults: [result] };
  assert.equal(reviewReadyToFinish([first]), true);
  assert.equal(reviewReadyToFinish([first, first]), true);
  assert.equal(
    reviewReadyToFinish([
      {
        toolResults: [
          {
            ...result,
            output: { ...output, review: { ...output.review, findings: [] } },
          },
        ],
      },
    ]),
    true,
  );
  for (const invalid of [
    { error: 'indisponível' },
    { ...output, visual: 'unavailable' },
    { ...output, review: { ...output.review, errors: 1 } },
    { ...output, review: { ...output.review, complete: false } },
  ]) {
    assert.equal(
      reviewReadyToFinish([
        first,
        { toolResults: [{ ...result, output: invalid }] },
      ]),
      false,
    );
  }
  assert.equal(
    reviewReadyToFinish([
      first,
      {
        toolResults: [
          result,
          { toolName: 'update_block', output: { ok: true } },
        ],
      },
    ]),
    false,
  );
});

await test('crítico anuncia caminhos existentes sem enum e resolve as referências', () => {
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
    schema.safeParse({
      findings: [{ ...finding, blockId: null }],
      strengths: [],
    }).success,
    true,
  );
  // O enum de caminhos derrubava a requisição inteira no provedor: os caminhos
  // vão na descrição do campo e a conferência acontece depois da resposta.
  const json = z.toJSONSchema(schema, { io: 'output' });
  const page = json.properties.findings.items.properties.page;
  assert.equal(page.enum, undefined);
  assert.match(page.description, /\//);

  const resolved = resolveReviewReferences(pages, [
    { ...finding, page: 'home' },
    { ...finding, blockId: 'hero.split' },
    { ...finding, page: '/inexistente' },
  ]);
  assert.equal(resolved.findings.length, 2);
  assert.equal(resolved.findings[0].page, '/');
  assert.equal(resolved.findings[1].blockId, null);
  assert.equal(resolved.unlinked, 1);
  assert.equal(resolved.unresolved, 1);
  assert.equal(resolved.unresolvedFindings.length, 1);
  assert.equal(resolved.unresolvedFindings[0].page, '/inexistente');
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
  assert.equal(compositionReadyToFinish([saved]), true);
  assert.equal(
    compositionReadyToFinish([
      {
        ...saved,
        output: { ...saved.output, publicationPending: [{ level: 'error' }] },
      },
    ]),
    false,
  );
  assert.equal(
    compositionReadyToFinish([
      saved,
      { toolName: 'repair_site', output: { ok: false } },
    ]),
    false,
  );
  assert.equal(
    compositionReadyToFinish([{ toolName: 'lint_site', output: { ok: true } }]),
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

await test('recibo é invalidado por conteúdo, SEO, marca, contato e imagem usada, mas ignora acervo alheio', () => {
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
  // Uma imagem no acervo que não aparece nesta página não muda seus pixels.
  assert.ok(
    currentReview(fixture, pages, [{ ...images[0], status: 'rejeitada' }]),
  );
  const pageWithImage = [
    {
      ...pages[0],
      blocks: [
        ...pages[0].blocks,
        {
          id: 'foto',
          type: 'media.image',
          props: { src: images[0].url, alt: 'Inspiração' },
        },
      ],
    },
  ];
  const imageFixture = structuredClone(fixture);
  imageFixture.brief.generation.review = {
    fingerprint: reviewFingerprint(imageFixture, pageWithImage, images),
    complete: true,
    errors: 0,
    visual: 'complete',
  };
  assert.equal(
    currentReview(imageFixture, pageWithImage, [
      { ...images[0], status: 'rejeitada' },
    ]),
    null,
  );
  assert.equal(
    reviewFingerprint(tenant, pages, images),
    reviewFingerprint({ ...tenant, brand: {}, brief: {} }, pages, images),
  );
});

await test('páginas montadas encerram a geração sem depender do recibo visual', () => {
  const state = {
    hasDesign: true,
    coveredScenes: 4,
    targetScenes: 4,
    organicPages: 3,
    blockingErrors: 0,
    reviewRounds: 9,
  };
  assert.equal(nextPhase(state), 'pronto');
  assert.equal(nextPhase({ ...state, reviewComplete: false }), 'pronto');
  assert.equal(nextPhase({ ...state, reviewComplete: true }), 'pronto');
});

for (const mode of [
  'complete',
  'overflow',
  'navigation-error',
  'missing-view',
  'critic-error',
  'material-error',
  'language-error',
])
  await test(`revisão real orquestra capturas e crítico: ${mode}`, async () => {
    const fixture = structuredClone(tenant);
    if (mode === 'critic-error')
      fixture.brief.generation = {
        review: {
          version: 2,
          fingerprint: 'recibo-anterior',
          complete: true,
          errors: 1,
          visual: 'complete',
          reviewedAt: '2026-09-11T12:00:00.000Z',
          findings: [
            {
              id: 'visual-anterior',
              pagina: '/',
              nivel: 'error',
              regra: 'hierarquia',
              evidencia: 'Título ilegível no celular',
              correcao: 'Recompor o título',
              status: 'open',
            },
          ],
          pages: {
            '/': {
              fingerprint: 'pagina-anterior',
              visual: 'complete',
              viewports: { desktop: true, mobile: true },
              errors: 1,
              reviewedAt: '2026-09-11T12:00:00.000Z',
              findings: [],
            },
          },
        },
      };
    let criticCalls = 0;
    const { buildTools } = await loadModule('lib/ai/tools.ts', {
      '@/lib/db': {
        // Reproduz o merge do SQL: a gravação mexe só na chave generation e
        // conta a rodada a partir do que está no banco, não de um snapshot.
        db:
          () =>
          async (parts, ...values) => {
            if (!parts.join('').includes("'{generation}'")) return [];
            const previous = fixture.brief.generation ?? {};
            fixture.brief.generation = {
              ...previous,
              ...JSON.parse(values[0]),
              reviewRounds: Number(previous.reviewRounds ?? 0) + 1,
            };
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
              navigation: {
                compact: viewport === 'mobile',
                opened: true,
                closed: true,
                issues:
                  mode === 'navigation-error' && viewport === 'mobile'
                    ? ['Abrir o menu desloca o conteúdo da página.']
                    : [],
              },
              menuJpeg:
                viewport === 'mobile'
                  ? Buffer.from('synthetic menu pixels')
                  : undefined,
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
            findings: ['material-error', 'language-error'].includes(mode)
              ? [
                  {
                    page: '/',
                    blockId: 'hero',
                    level: 'error',
                    criterion:
                      mode === 'language-error'
                        ? 'linguagem-simples'
                        : 'factualidade',
                    evidence:
                      mode === 'language-error'
                        ? 'Ação em inglês sem explicação'
                        : 'Promessa sem fonte',
                    correction:
                      mode === 'language-error'
                        ? 'Escrever a ação em português simples'
                        : 'Remover a promessa',
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
    if (mode === 'critic-error') {
      assert.equal(result.reviewedPages.length, 0);
      assert.ok(
        result.review.findings.some(
          (finding) => finding.id === 'visual-anterior',
        ),
        'falha técnica não resolve um achado visual anterior',
      );
    }
    assert.doesNotMatch(
      JSON.stringify(result),
      /synthetic pixels|base64|"jpeg"/,
    );
    if (mode === 'complete') {
      const reused = await tools.review_pages.execute({});
      assert.equal(reused.reviewedPages.length, 0);
      assert.equal(reused.reusedPages.join(','), '/');
      assert.match(
        (await tools.review_pages.execute({})).error,
        /2 leituras neste turno/,
      );
      assert.equal(criticCalls, 1);
    }
  });
