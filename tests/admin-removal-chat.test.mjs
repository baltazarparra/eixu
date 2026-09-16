import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolLoopAgent, isStepCount } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { pageEditFixture, editPages } from './helpers/page-edit-fixture.mjs';
import { loadModule } from './helpers/load-module.mjs';

async function removalChat({
  changeBeforeConfirm = false,
  otherOperator = false,
  auditFails = false,
  concurrentConfirm = false,
  attributionOnly = false,
} = {}) {
  const f = await pageEditFixture('remova essa foto da seção');
  const messages = [];
  const activity = [];
  let modelCalls = 0;
  const operator = { id: 'user-1', name: 'Operador', login: 'operador@eixu' };
  const colleague = { id: 'user-2', name: 'Colega', login: 'colega@eixu' };
  let activeUser = operator;
  const sql =
    () =>
    async (parts, ...values) => {
      const statement = parts.join('?');
      if (statement.includes('from chat_messages pending')) {
        const latest = [...messages]
          .reverse()
          .find(
            (message) =>
              message.channel === 'edit-pending' &&
              message.userId === values[3],
          );
        if (!latest) return [];
        return [
          {
            id: latest.id,
            content: latest.content,
            next_turn: !messages.some(
              (message) =>
                message.id > latest.id &&
                message.channel === 'site' &&
                message.role === 'user' &&
                message.userId === values[1],
            ),
          },
        ];
      }
      if (statement.includes('update chat_messages pending')) {
        const pending = messages.find((message) => message.id === values[0]);
        if (
          !pending ||
          pending.tenantId !== values[1] ||
          pending.userId !== values[2] ||
          pending.content !== values[3] ||
          messages.some(
            (message) =>
              message.role === 'user' &&
              message.channel === 'site' &&
              message.userId === values[5] &&
              message.id > pending.id &&
              (values[6] === null || message.id < values[6]),
          )
        )
          return [];
        pending.content = '{"status":"consumed"}';
        return [{ id: pending.id }];
      }
      if (statement.includes('insert into chat_messages')) {
        const message = {
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
          content:
            statement.includes("'edit-pending'") &&
            statement.includes('consumed')
              ? '{"status":"consumed"}'
              : values[1],
          userId: statement.includes("'edit-pending'")
            ? values.at(-1)
            : values[2],
          actorType: statement.includes("'edit-pending'")
            ? null
            : statement.includes("'agent'")
              ? 'agent'
              : statement.includes("'user'") && statement.includes('actor_type')
                ? 'user'
                : null,
          actorName: values[3] ?? null,
        };
        messages.push(message);
        if (statement.includes('returning id')) return [{ id: message.id }];
      }
      return [];
    };
  const { POST } = await loadModule('app/api/chat/route.ts', {
    '@/lib/auth': {
      currentUser: async () => activeUser,
    },
    '@/lib/admin/activity': {
      recordActivity: async (entry) => {
        activity.push(entry);
        if (auditFails && entry.action === 'page.edit')
          throw new Error('Falha sintética de auditoria');
      },
      recordAgentTool: async () => undefined,
    },
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
    '@/lib/ai/tools': {
      buildTools: (_tenant, context) =>
        context.conversationOnly ? {} : f.tools,
    },
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
  const send = async (text, user = operator) => {
    activeUser = user;
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
  const first = await send(
    attributionOnly
      ? 'Remova a assinatura EIXU do site e o rodapé do cliente.'
      : 'remova essa foto da seção',
  );
  if (attributionOnly) return { f, messages, activity, modelCalls, first };
  assert.match(first, /pedido atual não autoriza esse tamanho/);
  assert.equal(f.writes.length, 0);
  const pending = messages.find(
    (message) => message.channel === 'edit-pending',
  );
  assert.ok(pending);
  assert.equal(JSON.parse(pending.content).blockId, 'faq');
  assert.equal(pending.userId, operator.id);
  let colleagueResponse;
  if (otherOperator) {
    colleagueResponse = await send(
      'Confirmo que pode remover a seção inteira com tudo dentro.',
      colleague,
    );
    assert.equal(f.writes.length, 0);
  }
  if (changeBeforeConfirm)
    f.pages[0].blocks[2].props.title = 'Título alterado em outra aba';
  const confirmation =
    'Confirmo que pode remover a seção inteira com tudo dentro.';
  const responses = concurrentConfirm
    ? await Promise.all([send(confirmation), send(confirmation)])
    : [await send(confirmation)];
  return {
    f,
    messages,
    activity,
    modelCalls,
    second: responses[0],
    responses,
    colleagueResponse,
  };
}

await test('pedido para remover a assinatura recebe explicação e preserva o rodapé', async () => {
  const { f, messages, activity, modelCalls, first } = await removalChat({
    attributionOnly: true,
  });
  assert.match(first, /assinatura.*eixu\.com\.br/i);
  assert.match(first, /Nenhuma alteração foi salva/);
  assert.equal(modelCalls, 0);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.pages[0].blocks, editPages()[0].blocks);
  assert.deepEqual(f.pages[0].publishedBlocks, editPages()[0].publishedBlocks);
  assert.deepEqual(
    activity.map((entry) => entry.action),
    ['chat.message'],
  );
  assert.deepEqual(
    messages
      .filter((message) => message.channel === 'site')
      .map((message) => message.role),
    ['user', 'assistant'],
  );
});

await test('confirmação natural remove o bloco recusado sem repetir o modelo', async () => {
  const { f, messages, activity, modelCalls, second } = await removalChat();
  assert.match(second, /Alterações salvas no rascunho/);
  assert.match(second, /data-preview-update/);
  assert.equal(modelCalls, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(
    f.pages[0].blocks.some((block) => block.id === 'faq'),
    false,
  );
  assert.deepEqual(f.pages[0].publishedBlocks, editPages()[0].publishedBlocks);
  assert.deepEqual(
    messages
      .filter((message) => message.channel === 'site')
      .map((message) => message.actorType),
    ['user', 'agent', 'user', 'agent'],
  );
  assert.ok(
    messages
      .filter((message) => message.channel === 'site')
      .every((message) => message.actorName === 'Operador'),
  );
  assert.deepEqual(
    activity.map((entry) => entry.action),
    ['chat.message', 'chat.message', 'page.edit'],
  );
  assert.equal(activity[2].actor.id, 'user-1');
  assert.equal(activity[2].resourceId, f.pages[0].id);
});

await test('confirmação antiga não remove bloco após mudança da página', async () => {
  const { f, activity, modelCalls, second } = await removalChat({
    changeBeforeConfirm: true,
  });
  assert.match(second, /A página mudou desde a pergunta/);
  assert.equal(modelCalls, 1);
  assert.equal(f.writes.length, 0);
  assert.equal(
    f.pages[0].blocks.some((block) => block.id === 'faq'),
    true,
  );
  assert.deepEqual(
    activity.map((entry) => entry.action),
    ['chat.message', 'chat.message'],
  );
});

await test('outro operador não pode confirmar a remoção pendente', async () => {
  const { f, messages, activity, modelCalls, second, colleagueResponse } =
    await removalChat({ otherOperator: true });
  assert.doesNotMatch(colleagueResponse, /Alterações salvas no rascunho/);
  assert.match(second, /Alterações salvas no rascunho/);
  assert.equal(f.writes.length, 1);
  assert.equal(modelCalls, 2);
  assert.deepEqual(
    messages
      .filter((message) => message.channel === 'edit-pending')
      .map((message) => message.userId),
    ['user-1'],
  );
  assert.equal(
    activity.filter((entry) => entry.action === 'page.edit').length,
    1,
  );
});

await test('falha da auditoria não transforma edição salva em falsa recusa', async () => {
  const { f, second } = await removalChat({ auditFails: true });
  assert.equal(f.writes.length, 1);
  assert.match(second, /Alterações salvas no rascunho/);
  assert.match(second, /registro desta edição na atividade falhou/);
  assert.doesNotMatch(second, /Nenhuma alteração foi salva/);
});

await test('duas confirmações concorrentes reivindicam o lote uma vez só', async () => {
  const { f, responses, activity } = await removalChat({
    concurrentConfirm: true,
  });
  assert.equal(
    responses.filter((response) =>
      /Alterações salvas no rascunho/.test(response),
    ).length,
    1,
  );
  assert.equal(f.writes.length, 1);
  assert.equal(
    activity.filter((entry) => entry.action === 'page.edit').length,
    1,
  );
});
