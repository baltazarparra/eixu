import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolLoopAgent, isStepCount } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { pageEditFixture, editPages } from './helpers/page-edit-fixture.mjs';
import { loadModule } from './helpers/load-module.mjs';

for (const mode of ['model', 'receipt', 'ambiguous'])
  await test(`rota de edição: ${mode}`, async () => {
    const withFinal = mode === 'model';
    const f = await pageEditFixture(
      'Troque o título Como escolher para Escolhas do projeto',
    );
    const persisted = [];
    let calls = 0;
    const { POST } = await loadModule('app/api/chat/route.ts', {
      '@/lib/auth': { isAuthenticated: async () => true },
      '@/lib/db': {
        db:
          () =>
          async (_parts, ...values) => {
            persisted.push(values[1]);
            return [];
          },
      },
      '@/lib/tenant-queries': {
        getTenantBySlug: async (slug) =>
          slug === f.tenant.slug ? f.tenant : null,
        listPages: async () => structuredClone(f.pages),
      },
      '@/lib/images/queries': { listImages: async () => [] },
      '@/lib/generation/runs': {
        activeRun: async () => null,
        expireStaleRun: async () => null,
      },
      '@/lib/ai/tools': { buildTools: () => f.tools },
      '@/lib/ai/agent': {
        siteAgent: ({ tools, instructions }) => {
          assert.notEqual(
            mode,
            'ambiguous',
            'Ambiguidade literal deve perguntar sem chamar o modelo',
          );
          // A página enviada no pedido é a interna, não a home: não pode editar
          // o mesmo texto na página errada nem precisar de uma nova leitura.
          const snapshotText = instructions
            .split('Leitura feita pelo servidor neste turno.')[1]
            .split('\n')[1];
          const snapshot = JSON.parse(snapshotText);
          assert.equal(snapshot.slug, '/materiais');
          return new ToolLoopAgent({
            tools,
            instructions,
            stopWhen: isStepCount(withFinal ? 2 : 1),
            model: new MockLanguageModelV4({
              doStream: async () => {
                const first = ++calls === 1;
                const content = first
                  ? [
                      {
                        type: 'tool-call',
                        toolCallId: 'edit-1',
                        toolName: 'edit_page',
                        input: JSON.stringify({
                          page: 'materiais',
                          revision: snapshot.revision,
                          operations: [
                            {
                              op: 'replace_text',
                              from: 'Como escolher',
                              to: 'Escolhas do projeto',
                              block: 'intro',
                            },
                          ],
                        }),
                      },
                    ]
                  : [
                      { type: 'text-start', id: 'final' },
                      {
                        type: 'text-delta',
                        id: 'final',
                        delta:
                          'Troquei o título no rascunho de Materiais. Confira a prévia.',
                      },
                      { type: 'text-end', id: 'final' },
                    ];
                const chunks = [
                  { type: 'stream-start', warnings: [] },
                  ...content,
                  {
                    type: 'finish',
                    finishReason: {
                      unified: first ? 'tool-calls' : 'stop',
                      raw: first ? 'tool-calls' : 'stop',
                    },
                    usage: {
                      inputTokens: {
                        total: 20,
                        noCache: 20,
                        cacheRead: 0,
                        cacheWrite: 0,
                      },
                      outputTokens: { total: 10, text: 10, reasoning: 0 },
                    },
                  },
                ];
                return {
                  stream: new ReadableStream({
                    start(controller) {
                      for (const chunk of chunks) controller.enqueue(chunk);
                      controller.close();
                    },
                  }),
                };
              },
            }),
          });
        },
      },
    });
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant: f.tenant.slug,
          page: 'materiais',
          messages: [
            {
              id: 'request',
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text:
                    mode === 'ambiguous'
                      ? 'Troque "Ver materiais" por "Ver opções".'
                      : 'Troque o título Como escolher para Escolhas do projeto',
                },
              ],
            },
          ],
        }),
      }),
    );
    assert.equal(response.status, 200);
    const stream = await response.text();
    if (mode === 'ambiguous') {
      assert.match(stream, /aparece 2 vezes/);
      assert.equal(f.writes.length, 0);
      assert.equal(calls, 0);
      assert.equal(persisted.length, 2);
      return;
    }
    assert.match(stream, /tool-output-available/);
    assert.match(stream, /data-preview-update/);
    assert.ok(
      stream.indexOf('data-preview-update') >
        stream.indexOf('tool-output-available'),
    );
    assert.match(
      stream,
      withFinal
        ? /Troquei o título no rascunho/
        : /Alterações salvas no rascunho de/,
    );
    assert.match(stream, /"saved":"draft"/);
    assert.equal(f.writes.length, 1);
    assert.equal(calls, withFinal ? 2 : 1);
    assert.deepEqual(f.pages[0], editPages()[0]);
    assert.equal(f.pages[1].blocks[2].props.title, 'Escolhas do projeto');
    assert.deepEqual(
      f.pages[1].publishedBlocks,
      editPages()[1].publishedBlocks,
    );
    assert.equal(persisted.length, 2);
  });
