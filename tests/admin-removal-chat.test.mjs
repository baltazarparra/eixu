import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolLoopAgent, isStepCount } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { pageEditFixture, editPages } from './helpers/page-edit-fixture.mjs';
import { loadModule } from './helpers/load-module.mjs';

async function removalChat({ changeBeforeConfirm = false } = {}) {
  const f = await pageEditFixture('remova essa foto da seção');
  const messages = [];
  let modelCalls = 0;
  const sql =
    () =>
    async (parts, ...values) => {
      const statement = parts.join('?');
      if (statement.includes('from chat_messages pending')) {
        const latest = [...messages]
          .reverse()
          .find((message) => message.channel === 'edit-pending');
        if (!latest) return [];
        return [
          {
            content: latest.content,
            next_turn: !messages.some(
              (message) =>
                message.id > latest.id &&
                message.channel === 'site' &&
                message.role === 'user',
            ),
          },
        ];
      }
      if (statement.includes('insert into chat_messages')) {
        messages.push({
          id: messages.length + 1,
          tenantId: values[0],
          role: statement.includes("'assistant'")
            ? 'assistant'
            : statement.includes("'system'")
              ? 'system'
              : 'user',
          channel: statement.includes("'edit-pending'")
            ? 'edit-pending'
            : 'site',
          content: values[1] ?? '{"status":"consumed"}',
        });
      }
      return [];
    };
  const { POST } = await loadModule('app/api/chat/route.ts', {
    '@/lib/auth': { isAuthenticated: async () => true },
    '@/lib/db': { db: sql },
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
    '@/lib/sites/edits': f.mocks['@/lib/sites/edits'],
    '@/lib/ai/tools': { buildTools: () => f.tools },
    '@/lib/ai/agent': {
      siteAgent: ({ tools }) => {
        modelCalls += 1;
        return new ToolLoopAgent({
          tools,
          stopWhen: isStepCount(1),
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: 'wrong-size',
                    toolName: 'edit_page',
                    input: JSON.stringify({
                      page: '',
                      revision: f.instructions.match(
                        /"revision":"([a-f0-9]+)"/,
                      )?.[1],
                      operations: [{ op: 'remove', block: 'faq' }],
                    }),
                  });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
                    usage: {
                      inputTokens: {
                        total: 20,
                        noCache: 20,
                        cacheRead: 0,
                        cacheWrite: 0,
                      },
                      outputTokens: { total: 10, text: 10, reasoning: 0 },
                    },
                  });
                  controller.close();
                },
              }),
            }),
          }),
        });
      },
    },
  });
  const send = async (text) => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant: f.tenant.slug,
          page: '',
          messages: [
            {
              id: `user-${messages.length + 1}`,
              role: 'user',
              parts: [{ type: 'text', text }],
            },
          ],
        }),
      }),
    );
    assert.equal(response.status, 200);
    return response.text();
  };
  const first = await send('remova essa foto da seção');
  assert.match(first, /pedido atual não autoriza esse tamanho/);
  assert.equal(f.writes.length, 0);
  const pending = messages.find(
    (message) => message.channel === 'edit-pending',
  );
  assert.ok(pending);
  assert.equal(JSON.parse(pending.content).blockId, 'faq');
  if (changeBeforeConfirm)
    f.pages[0].blocks[2].props.title = 'Título alterado em outra aba';
  const second = await send(
    'Confirmo que pode remover a seção inteira com tudo dentro.',
  );
  return { f, messages, modelCalls, second };
}

await test('confirmação natural remove o bloco recusado sem repetir o modelo', async () => {
  const { f, modelCalls, second } = await removalChat();
  assert.match(second, /Alterações salvas no rascunho/);
  assert.match(second, /data-preview-update/);
  assert.equal(modelCalls, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(
    f.pages[0].blocks.some((block) => block.id === 'faq'),
    false,
  );
  assert.deepEqual(f.pages[0].publishedBlocks, editPages()[0].publishedBlocks);
});

await test('confirmação antiga não remove bloco após mudança da página', async () => {
  const { f, modelCalls, second } = await removalChat({
    changeBeforeConfirm: true,
  });
  assert.match(second, /A página mudou desde a pergunta/);
  assert.equal(modelCalls, 1);
  assert.equal(f.writes.length, 0);
  assert.equal(
    f.pages[0].blocks.some((block) => block.id === 'faq'),
    true,
  );
});
