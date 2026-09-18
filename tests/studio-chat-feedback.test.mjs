import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModuleGraph } from './helpers/load-module.mjs';

void test('etapas aparecem só no widget, preservando respostas e ocultando payloads técnicos', () => {
  const { Message, ChatActivity, chatErrorMessage } = loadModuleGraph(
    'app/(admin)/admin/[tenant]/chat-parts.tsx',
    { '@/components/admin/session': { useAdminSession: () => null } },
  );
  const message = {
    id: 'fixture',
    role: 'assistant',
    parts: [
      ...['context', 'art_direction'].map((kind) => ({
        type: 'tool-record_artifact',
        toolCallId: kind,
        state: 'output-available',
        input: { kind },
        output: { ok: true },
      })),
      {
        type: 'tool-record_artifact',
        toolCallId: 'invalid',
        state: 'output-error',
        input: { kind: 'validation' },
        errorText:
          'AI_InvalidToolInputError: Invalid input for tool record_artifact. Value: {"payload":"private-fixture-content"}',
      },
    ],
  };
  assert.equal(renderToStaticMarkup(createElement(Message, { message })), '');

  message.parts.unshift({ type: 'text', text: 'Vou ajustar o projeto.' });
  message.parts.push({
    type: 'text',
    text: 'A prévia está pronta para revisão.',
  });
  const html = renderToStaticMarkup(createElement(Message, { message }));
  assert.match(html, /Vou ajustar o projeto\./);
  assert.match(html, /A prévia está pronta para revisão\./);
  assert.doesNotMatch(
    html,
    /admin-tools|Contexto do projeto registrado|Direção de arte registrada/,
  );
  assert.doesNotMatch(
    html,
    /AI_InvalidToolInputError|private-fixture-content|record_artifact/,
  );

  for (const [kind, label] of [
    ['context', 'Organizando o contexto do projeto'],
    ['art_direction', 'Definindo a direção de arte'],
    ['validation', 'Registrando as verificações do projeto'],
  ]) {
    const pending = {
      ...message,
      parts: [
        ...message.parts,
        {
          type: 'tool-record_artifact',
          toolCallId: 'pending',
          state: 'input-available',
          input: { kind },
        },
      ],
    };
    const activity = renderToStaticMarkup(
      createElement(ChatActivity, { messages: [pending] }),
    );
    const combined =
      renderToStaticMarkup(createElement(Message, { message: pending })) +
      activity;
    assert.equal(combined.split(label).length - 1, 1);
    assert.match(activity, /data-chat-activity/);
  }

  assert.doesNotMatch(
    chatErrorMessage(message.parts.find((part) => part.errorText).errorText),
    /AI_InvalidToolInputError|private-fixture-content/,
  );
  assert.doesNotMatch(
    chatErrorMessage('Step "checkpoint" failed after 3 retries'),
    /revise os dados/,
  );
});
