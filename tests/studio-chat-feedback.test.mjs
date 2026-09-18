import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModuleGraph } from './helpers/load-module.mjs';

void test('chat distingue os artefatos e não exibe o payload de um erro técnico', () => {
  const { Message, chatErrorMessage } = loadModuleGraph(
    'app/(admin)/admin/[tenant]/chat-parts.tsx',
    { '@/components/admin/session': { useAdminSession: () => null } },
  );
  const html = renderToStaticMarkup(
    createElement(Message, {
      message: {
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
      },
    }),
  );
  assert.match(html, /Contexto do projeto registrado/);
  assert.match(html, /Direção de arte registrada/);
  assert.match(html, /data-state="failed"/);
  assert.doesNotMatch(
    html,
    /AI_InvalidToolInputError|private-fixture-content|record_artifact/,
  );
  assert.doesNotMatch(
    chatErrorMessage('Step "checkpoint" failed after 3 retries'),
    /revise os dados/,
  );
});
