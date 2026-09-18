import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

function messageRow(overrides = {}) {
  return {
    id: 1,
    role: 'user',
    content: 'Crie o site usando os dados cadastrados.',
    message_uid: 'message-1',
    parts: [{ type: 'text', text: 'Crie o site usando os dados cadastrados.' }],
    metadata: {},
    actor_type: 'user',
    actor_name: 'Operador de teste',
    actor_login: 'fixture',
    ...overrides,
  };
}

function messagesWithDatabase(query) {
  return loadModuleGraph('lib/studio/messages.ts', {
    '@/lib/db': { db: () => query },
  });
}

void test('cliente sem conversa carrega histórico vazio', async () => {
  const { studioMessages } = messagesWithDatabase(async () => []);

  assert.deepEqual(await studioMessages('tenant'), []);
});

void test('histórico existente mantém ordem, partes e autoria', async () => {
  const question = messageRow();
  const answer = messageRow({
    id: 2,
    message_uid: 'message-2',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Vou analisar os dados do cliente.' }],
    metadata: { runId: 'run-1' },
    actor_type: 'agent',
  });
  const { studioMessages } = messagesWithDatabase(async () => [
    answer,
    question,
  ]);

  const messages = await studioMessages('tenant');

  assert.deepEqual(
    messages.map((message) => message.id),
    ['message-1', 'message-2'],
  );
  assert.deepEqual(messages[0].parts, question.parts);
  assert.deepEqual(messages[1].parts, answer.parts);
  assert.equal(messages[0].metadata.author.type, 'user');
  assert.equal(messages[1].metadata.author.type, 'agent');
  assert.equal(messages[1].metadata.runId, 'run-1');
});

void test('histórico preenchido continua validado pelo AI SDK real', async () => {
  const { studioMessages } = messagesWithDatabase(async () => [
    messageRow({ parts: [{ type: 'text', text: 123 }] }),
  ]);

  await assert.rejects(studioMessages('tenant'), {
    name: 'AI_TypeValidationError',
  });
});

void test('falha de banco não é confundida com conversa vazia', async () => {
  const failure = new Error('Banco indisponível');
  const { studioMessages } = messagesWithDatabase(async () => {
    throw failure;
  });

  await assert.rejects(studioMessages('tenant'), (error) => error === failure);
});
