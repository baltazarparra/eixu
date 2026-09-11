import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { mergeSavedMessages } = await jiti.import(
  '../lib/admin/chat-messages.ts',
);
const msg = (id, role, text) => ({ id, role, parts: [{ type: 'text', text }] });

await test('recibos reconciliam o stream sem duplicar bolhas nem perder ferramentas', () => {
  const user = msg('live-user', 'user', 'continuar');
  const assistant = {
    ...msg('live-assistant', 'assistant', 'Retomando a geração.'),
    metadata: { usage: { totalTokens: 30 } },
  };
  assistant.parts.push({
    type: 'tool-build_site',
    toolCallId: 'call-1',
    state: 'output-available',
    input: {},
    output: { ok: true },
    providerMetadata: { signature: 'preservar' },
  });
  const saved = [
    msg('saved-1', 'user', 'continuar'),
    msg('saved-2', 'assistant', 'Retomando a geração.'),
    msg('saved-3', 'user', 'Gere as cenas que faltam no plano.'),
  ];
  const merged = mergeSavedMessages([user, assistant], saved);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged[1].parts, assistant.parts);
  assert.deepEqual(merged[1].metadata, assistant.metadata);
  assert.equal(assistant.id, 'live-assistant');
  assert.deepEqual(mergeSavedMessages(merged, saved), merged);
});

await test('textos iguais em turnos diferentes mantêm cada mensagem', () => {
  const current = [
    msg('saved-1', 'user', 'continuar'),
    msg('u2', 'user', 'continuar'),
    msg('u3', 'user', 'continuar'),
  ];
  const merged = mergeSavedMessages(current, [
    msg('saved-2', 'user', 'continuar'),
    msg('saved-3', 'user', 'continuar'),
  ]);
  assert.deepEqual(
    merged.map((row) => row.id),
    ['saved-1', 'saved-2', 'saved-3'],
  );
});
