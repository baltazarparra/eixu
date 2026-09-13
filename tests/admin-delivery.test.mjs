import test from 'node:test';
import assert from 'node:assert/strict';
import { tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const phases = await j.import('../lib/taste/phases.ts');
const serial = await j.import('../lib/ai/serial-tools.ts');
const { currentDelivery } = await j.import('../lib/generation/delivery.ts');
const { reviewFingerprint, currentReview } = await j.import(
  '../lib/review/state.ts',
);
const { workspaceState } = await j.import('../lib/admin/state.ts');
const { savedProgressMessage } = await j.import('../lib/ai/chat-progress.ts');

await test('lote recusado força reparo no loop real, salva e encerra sem conferir', async () => {
  for (const paused of [false, true]) {
    let calls = 0;
    let repairs = 0;
    const rejected = {
      ok: false,
      pages: [
        {
          page: '/obrigado',
          preflight:
            'ERRO [hero-subtexto] Subtexto tem 21 palavras. Limite 20.',
          blocks: [{ index: 1, type: 'hero.statement' }],
        },
      ],
    };
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        calls++;
        if (calls === 2) {
          assert.deepEqual(options.toolChoice, {
            type: 'tool',
            toolName: 'repair_site',
          });
          assert.deepEqual(
            options.tools.map((tool) => tool.name),
            ['repair_site'],
          );
        }
        return {
          content: [
            {
              type: 'tool-call',
              toolCallId: `draft-${calls}`,
              toolName: calls === 1 ? 'build_site' : 'repair_site',
              input: '{}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
          usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } },
          warnings: [],
        };
      },
    });
    const { siteAgent } = await loadModule('lib/ai/agent.ts', {
      './models': {
        productModel: () => model,
        modelSettings: () => ({}),
        TURN_TIMEOUT_MS: 1000,
      },
      './usage': { gatewayOptions: () => ({}) },
      './serial-tools': serial,
      '../taste/phases': phases,
    });
    const result = await siteAgent({
      tenantId: 'fixture',
      phase: 'composicao',
      instructions: 'Monte e corrija o lote.',
      shouldStop: () => paused,
      tools: {
        build_site: tool({
          inputSchema: z.object({}),
          execute: async () => rejected,
        }),
        repair_site: tool({
          inputSchema: z.object({}),
          execute: async () => {
            repairs++;
            return { ok: true, pages: [{ page: '/' }, { page: '/obrigado' }] };
          },
        }),
      },
    }).generate({ prompt: 'Gere o site.' });
    assert.equal(result.steps.length, paused ? 1 : 2);
    assert.equal(repairs, paused ? 0 : 1);
  }
  for (const output of [
    { ok: true, pages: [{ page: '/', preflight: '', blocks: [] }] },
    { ok: false, error: 'Banco indisponível' },
    null,
  ]) {
    assert.equal(
      phases.compositionRepairDue([{ toolName: 'build_site', output }]),
      false,
    );
  }
});

await test('loop real para na falha visual e não faz edições nem outra chamada', async () => {
  for (const output of [
    { visual: 'unavailable', complete: false },
    { visual: 'disabled', complete: false },
    { error: 'Serviço indisponível' },
  ]) {
    let calls = 0,
      reads = 0,
      edits = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        calls++;
        assert.deepEqual(options.toolChoice, {
          type: 'tool',
          toolName: 'review_pages',
        });
        return {
          content: [
            {
              type: 'tool-call',
              toolCallId: `read-${calls}`,
              toolName: 'review_pages',
              input: '{}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
          usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } },
          warnings: [],
        };
      },
    });
    const { siteAgent } = await loadModule('lib/ai/agent.ts', {
      './models': {
        productModel: () => model,
        modelSettings: () => ({}),
        TURN_TIMEOUT_MS: 1000,
      },
      './usage': { gatewayOptions: () => ({}) },
      './serial-tools': serial,
      '../taste/phases': phases,
    });
    const result = await siteAgent({
      tenantId: 'fixture',
      instructions: 'Conferir uma vez.',
      phase: 'revisao',
      tools: {
        review_pages: tool({
          inputSchema: z.object({}),
          execute: async () => {
            reads++;
            return output;
          },
        }),
        update_block: tool({
          inputSchema: z.object({}),
          execute: async () => {
            edits++;
            return { ok: true };
          },
        }),
      },
    }).generate({ prompt: 'Revise o site.' });
    assert.equal(result.steps.length, 1);
    assert.equal(calls, 1);
    assert.equal(reads, 1);
    assert.equal(edits, 0);
  }
});

await test('erros conhecidos permitem reparo; segunda conferência termina mesmo com pendências', () => {
  const read = (output) => ({
    toolResults: [{ toolName: 'review_pages', output }],
  });
  const edit = {
    toolResults: [{ toolName: 'update_block', output: { ok: true } }],
  };
  for (const output of [
    { preflightOnly: true, visual: 'unavailable', complete: false },
    {
      visual: 'complete',
      complete: false,
      review: { complete: true, errors: 1, findings: [] },
    },
  ]) {
    assert.equal(phases.reviewTurnFinished([read(output)]), false);
    assert.equal(phases.reviewTurnFinished([read(output), edit]), false);
    assert.equal(
      phases.reviewTurnFinished([read(output), edit, read(output)]),
      true,
    );
    assert.equal(
      phases.reviewReadyToFinish([read(output), edit, read(output)]),
      false,
    );
  }
});

await test('entrega persiste após edição sem aprovar revisão nem apagar erros', () => {
  const tenant = {
    id: 'fixture',
    slug: 'fixture',
    name: 'Fixture',
    brand: {},
    brief: {},
    dials: {},
    imageGuide: {},
  };
  const pages = [
    {
      id: 'p1',
      slug: '',
      title: 'Início',
      type: 'page',
      blocks: [],
      seo: {},
      meta: {},
      publishedBlocks: null,
    },
  ];
  const fingerprint = reviewFingerprint(tenant, pages, []);
  const receipt = {
    version: 2,
    fingerprint,
    complete: false,
    visual: 'unavailable',
    errors: 1,
    findings: [
      {
        pagina: '/',
        nivel: 'error',
        regra: 'critica-indisponivel',
        correcao: 'Confira a prévia.',
      },
    ],
    pages: {},
  };
  tenant.brief.generation = {
    review: receipt,
    delivery: { fingerprint, completedAt: new Date().toISOString() },
  };
  assert.ok(currentDelivery(tenant, pages, []));
  assert.equal(currentReview(tenant, pages, []), null);
  const state = workspaceState(tenant, pages, []);
  assert.equal(state.review.complete, false);
  assert.equal(state.review.errors, 1);
  assert.equal(state.review.findings[0].rule, 'critica-indisponivel');
  assert.ok(
    state.pages[0].errors.length > 0,
    'entrega não remove erros do pre-flight',
  );
  const base = {
    hasDesign: true,
    organicPages: 3,
    reviewComplete: false,
    reviewRounds: 0,
    blockingErrors: 1,
    delivered: true,
  };
  assert.equal(phases.nextPhase(base), 'pronto');
  assert.equal(phases.nextPhase({ ...base, delivered: false }), 'pronto');
  assert.equal(
    phases.nextPhase({
      ...base,
      delivered: false,
      organicPages: 0,
      coveredScenes: 0,
      targetScenes: 5,
    }),
    'cenas',
  );
  const text = savedProgressMessage({
    ...state,
    generation: { ...state.generation, next: 'pronto' },
  });
  assert.match(text, /Site gerado.*Confira a prévia/);
  assert.doesNotMatch(text, /foi concluída sem erros|Use Continuar/);
  const edited = [{ ...pages[0], title: 'Alterado' }];
  assert.ok(currentDelivery(tenant, edited, []));
  assert.equal(
    workspaceState(tenant, edited, []).review.findings.length,
    0,
    'recibo antigo não aparece como leitura atual',
  );
});

await test('estado real entrega rascunho inválido com pendências sem voltar à composição', () => {
  const tenant = {
    id: 'fixture',
    slug: 'fixture',
    name: 'Fixture',
    dials: {},
    imageGuide: {},
    brand: {
      design: {
        version: 2,
        concept: 'Fixture',
        signatureElement: 'Foto',
        displayFont: 'geist',
        bodyFont: 'geist',
        heroComposition: 'split',
        navigation: 'bar',
        rhythm: 'alternating',
        imageTreatment: 'framed',
        surfaceStyle: 'flat',
        motif: 'none',
      },
    },
    brief: {},
  };
  const pages = ['', 'servicos', 'contato'].map((slug) => ({
    id: slug || 'home',
    slug,
    title: slug || 'Início',
    type: 'page',
    blocks: [],
    seo: {},
    meta: {},
    publishedBlocks: null,
  }));
  tenant.brief.generation = {
    delivery: {
      fingerprint: reviewFingerprint(tenant, pages, []),
      completedAt: new Date().toISOString(),
    },
  };
  const state = workspaceState(tenant, pages, []);
  assert.equal(state.generation.next, 'pronto');
  assert.equal(state.generation.reviewComplete, false);
  assert.ok(state.generation.blockingErrors > 0);
  assert.ok(state.pages.every((page) => page.errors.length > 0));
  assert.equal(
    workspaceState({ ...tenant, brief: {} }, pages, []).generation.next,
    'cenas',
  );
});

await test('composição no SDK real salva e termina sem chamar review_pages', async () => {
  let calls = 0,
    writes = 0,
    reviews = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls++;
      assert.equal(
        options.tools.some((tool) => tool.name === 'review_pages'),
        false,
      );
      return {
        content: [
          {
            type: 'tool-call',
            toolCallId: 'build',
            toolName: 'build_site',
            input: '{}',
          },
        ],
        finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
        usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } },
        warnings: [],
      };
    },
  });
  const { siteAgent } = await loadModule('lib/ai/agent.ts', {
    './models': {
      productModel: () => model,
      modelSettings: () => ({}),
      TURN_TIMEOUT_MS: 1000,
    },
    './usage': { gatewayOptions: () => ({}) },
    './serial-tools': serial,
    '../taste/phases': phases,
  });
  const result = await siteAgent({
    tenantId: 'fixture',
    phase: 'composicao',
    instructions: 'Monte o site.',
    tools: {
      build_site: tool({
        inputSchema: z.object({}),
        execute: async () => {
          writes++;
          return {
            ok: true,
            pages: ['', 'servicos', 'contato'],
            pendencias: [{ level: 'warn' }],
          };
        },
      }),
      review_pages: tool({
        inputSchema: z.object({}),
        execute: async () => {
          reviews++;
          throw new Error('Crítico indisponível');
        },
      }),
    },
  }).generate({ prompt: 'Gere as páginas.' });
  assert.equal(result.steps.length, 1);
  assert.equal(calls, 1);
  assert.equal(writes, 1);
  assert.equal(reviews, 0);
});

await test('páginas legadas sem recibo visual permanecem concluídas após edição e recarga', () => {
  const tenant = {
    id: 'fixture',
    slug: 'fixture',
    name: 'Fixture',
    brand: {},
    dials: {},
    imageGuide: {},
    brief: { generation: { phase: 'revisao', reviewRounds: 3 } },
  };
  const pages = ['', 'servicos', 'contato'].map((slug) => ({
    id: slug || 'home',
    slug,
    title: slug || 'Início',
    type: 'page',
    blocks: [
      {
        id: 'text',
        type: 'editorial.text',
        props: { title: 'Sobre', body: 'Conteúdo salvo.' },
      },
    ],
    seo: {},
    meta: {},
    publishedBlocks: null,
  }));
  for (const currentPages of [
    pages,
    pages.map((page) => ({ ...page, title: 'Editado' })),
  ]) {
    const state = workspaceState(tenant, currentPages, []);
    assert.equal(state.generation.next, 'pronto');
    assert.equal(state.generation.reviewComplete, false);
    assert.ok(
      state.generation.blockingErrors > 0,
      'publicação mantém suas validações',
    );
    assert.doesNotMatch(
      savedProgressMessage(state),
      /pendente|Continuar|Conferir/,
    );
  }
  const delivered = {
    ...tenant,
    brief: {
      generation: { delivery: { completedAt: new Date().toISOString() } },
    },
  };
  assert.equal(
    workspaceState(delivered, [pages[0]], []).generation.next,
    'pronto',
  );
  assert.equal(
    currentDelivery(delivered, []),
    null,
    'sem páginas, a entrega não mantém um site vazio concluído',
  );
});
