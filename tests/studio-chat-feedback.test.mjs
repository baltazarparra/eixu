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

void test('a resposta do agente chega formatada, sem marcação crua nem HTML do modelo', () => {
  const { Message } = loadModuleGraph(
    'app/(admin)/admin/[tenant]/chat-parts.tsx',
    { '@/components/admin/session': { useAdminSession: () => null } },
  );
  const render = (role, text) =>
    renderToStaticMarkup(
      createElement(Message, {
        message: {
          id: `fixture-${role}`,
          role,
          parts: [{ type: 'text', text }],
        },
      }),
    );

  const html = render(
    'assistant',
    [
      'A imagem do **Hero** agora ocupa a **largura total da tela**.',
      '',
      '### O que foi alterado',
      '',
      '1. Composição full width (`components/Hero.tsx`)',
      '2. Sobreposição editorial',
      '',
      'Primeira linha',
      'e a continuação.',
      '',
      '<script>alert(1)</script>',
      '',
      '![captura](https://exemplo.invalido/captura.png)',
      '',
      '[abrir](javascript:alert)',
    ].join('\n'),
  );
  assert.doesNotMatch(html, /\*\*|###|`/);
  assert.match(html, /<strong>Hero<\/strong>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<code>components\/Hero\.tsx<\/code>/);
  assert.match(html, /Primeira linha<br\s*\/?>/);
  // Título do modelo nunca compete com a estrutura da página.
  assert.match(
    html,
    /<h5 class="admin-bubble-heading">O que foi alterado<\/h5>/,
  );
  assert.doesNotMatch(html, /<h1|<h2/);
  // Texto do modelo não injeta HTML, não carrega imagem remota e não vira link ativo perigoso.
  assert.doesNotMatch(html, /<script|<img|javascript:/);

  // O operador escreve texto puro: a mensagem dele continua literal.
  const typed = render('user', '**mantenha isto literal**');
  assert.match(typed, /\*\*mantenha isto literal\*\*/);
  assert.match(typed, /whitespace-pre-wrap/);
});
