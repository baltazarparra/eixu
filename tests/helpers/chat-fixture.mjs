import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { loadModule } from './load-module.mjs';

/** HTTP e SDK reais, com estado isolado e provedor determinístico. Sem rede paga. */
export async function chatFixture({
  delay = 0,
  authenticated = true,
  running = null,
} = {}) {
  const starts = [];
  const state = {
    tenant: {
      slug: 'stream-fixture',
      name: 'Teste de andamento',
      hasDesign: true,
    },
    errors: [],
    warnings: [],
    pages: [],
    generation: {
      next: 'composicao',
      photos: 6,
      coveredScenes: 6,
      targetScenes: 6,
      nextScene: null,
      organicPages: 0,
      reviewRounds: 0,
      reviewComplete: false,
      blockingErrors: 0,
    },
  };
  const tenant = {
    id: 'fixture',
    ...state.tenant,
    // Direção válida de verdade: a fase só abre com o estado que pressupõe,
    // e a checagem passou a viver no módulo compartilhado com o runner.
    brand: {
      design: {
        version: 2,
        concept: 'Fixture',
        signatureElement: 'linha',
        displayFont: 'sans',
        bodyFont: 'sans',
        heroComposition: 'split',
        navigation: 'bar',
        rhythm: 'regular',
        imageTreatment: 'documental',
        surfaceStyle: 'flat',
        motif: 'grid',
      },
    },
    brief: {},
    dials: {},
    imageGuide: {},
  };
  const turns = [];
  const writes = [];
  const modelCalls = [];
  let executions = 0;
  const tools = {
    build_site: tool({
      inputSchema: z.object({ title: z.string().min(2) }),
      execute: async () => {
        executions += 1;
        state.pages = ['', 'servicos', 'contato', 'obrigado'].map((slug) => ({
          slug,
          title: slug || 'Início',
          type: slug === 'obrigado' ? 'thank_you' : 'page',
          blocks: 6,
          dirty: true,
          published: false,
          publishedAt: null,
          errors: [],
          warnings: [],
        }));
        Object.assign(state.generation, { next: 'revisao', organicPages: 3 });
        return {
          ok: true,
          pages: state.pages.map((page) => ({ page: `/${page.slug}` })),
        };
      },
    }),
    review_pages: tool({
      inputSchema: z.object({}),
      execute: async () => {
        executions += 1;
        Object.assign(state.generation, {
          next: 'pronto',
          reviewRounds: 1,
          reviewComplete: true,
        });
        return {
          complete: true,
          visual: 'complete',
          review: { complete: true, errors: 0, findings: [] },
        };
      },
    }),
  };
  const { POST } = await loadModule('app/api/chat/route.ts', {
    '@/lib/auth': { isAuthenticated: async () => authenticated },
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          if (parts.join('').includes('chat_messages'))
            writes.push({
              role: parts.join('').includes("'assistant'")
                ? 'assistant'
                : 'user',
              text: values[1],
            });
          return [];
        },
    },
    '@/lib/tenant-queries': {
      getTenantBySlug: async (slug) =>
        slug === state.tenant.slug ? tenant : null,
      listPages: async () => state.pages,
    },
    '@/lib/images/queries': { listImages: async () => [] },
    '@/lib/generation/runs': {
      activeRun: async () => running,
      expireStaleRun: async (run) => run,
    },
    '@/lib/generation/runner': { markPhase: async () => undefined },
    '@/lib/generation/start': {
      startGeneration: async (input) => {
        starts.push(input.tenant.slug);
        return { ok: true, run: { id: 'run-fixture' }, phase: 'Composição' };
      },
    },
    '@/lib/admin/state': { workspaceState: () => structuredClone(state) },
    '@/lib/taste/prompt': {
      systemPrompt: () => 'Fixture sintética de streaming.',
    },
    '@/lib/ai/tools': { buildTools: () => tools },
    '@/lib/ai/agent': {
      siteAgent: ({ phase }) => {
        turns.push(phase);
        let step = 0;
        return new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doStream: async (options) => {
              modelCalls.push(options);
              step += 1;
              const invalid = phase === 'composicao' && step === 1;
              const toolName =
                phase === 'revisao' ? 'review_pages' : 'build_site';
              const chunks = [
                { type: 'stream-start', warnings: [] },
                { type: 'reasoning-start', id: `r${step}` },
                {
                  type: 'reasoning-delta',
                  id: `r${step}`,
                  delta: 'Raciocínio sintético que não deve ser exibido.',
                },
                { type: 'reasoning-end', id: `r${step}` },
                {
                  type: 'tool-call',
                  toolCallId: `call-${phase}-${step}`,
                  toolName,
                  input: JSON.stringify(
                    invalid
                      ? { title: 1 }
                      : toolName === 'build_site'
                        ? { title: 'Fixture' }
                        : {},
                  ),
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
                  usage: {
                    inputTokens: {
                      total: 20,
                      noCache: 20,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                    outputTokens: { total: 10, text: 5, reasoning: 5 },
                  },
                },
              ];
              return {
                stream: ReadableStream.from(
                  (async function* () {
                    for (const chunk of chunks) {
                      yield chunk;
                      if (chunk.type === 'reasoning-delta' && delay)
                        await new Promise((resolve) =>
                          setTimeout(resolve, delay),
                        );
                    }
                  })(),
                ),
              };
            },
          }),
          tools,
          stopWhen: isStepCount(phase === 'composicao' ? 2 : 1),
        });
      },
    },
  });
  return {
    POST,
    state,
    writes,
    turns,
    modelCalls,
    starts,
    executions: () => executions,
  };
}

export function chatRequest(text, phase) {
  return new Request('http://fixture.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenant: 'stream-fixture',
      phase,
      messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text }] }],
    }),
  });
}

export async function readChunks(response) {
  return (await response.text())
    .split('\n')
    .filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
    .map((line) => JSON.parse(line.slice(6)));
}
