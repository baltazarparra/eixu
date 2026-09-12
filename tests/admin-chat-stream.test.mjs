import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { readUIMessageStream } from 'ai';
import {
  chatFixture,
  chatRequest,
  readChunks,
} from './helpers/chat-fixture.mjs';

const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { completeChatStream } = await jiti.import('../lib/ai/chat-stream.ts');
const { isProgressQuestion } = await jiti.import('../lib/ai/chat-progress.ts');

await test('pergunta de andamento lê estado e persiste resposta sem executar o agente', async () => {
  const f = await chatFixture();
  const chunks = await readChunks(await f.POST(chatRequest('travou?')));
  const text = chunks
    .filter((part) => part.type === 'text-delta')
    .map((part) => part.delta)
    .join('');
  assert.match(text, /6 de 6 cenas/);
  assert.match(text, /composição.*pendente/);
  assert.deepEqual(f.turns, []);
  assert.equal(f.executions(), 0);
  assert.deepEqual(
    f.writes.map((row) => row.role),
    ['user', 'assistant'],
  );
  assert.equal(f.writes[1].text, text);
  for (const command of [
    'travou? continue',
    'publique o site',
    'não terminou, corrija',
    'mude o status do formulário',
  ])
    assert.equal(isProgressQuestion(command), false);
  for (const question of [
    'Travou?',
    'a geração parou?',
    'Qual é o andamento?',
    'Como está o site?',
  ])
    assert.equal(isProgressQuestion(question), true);
});

await test('consulta de andamento mantém autenticação antes de ler ou escrever', async () => {
  const f = await chatFixture({ authenticated: false });
  assert.equal((await f.POST(chatRequest('travou?'))).status, 401);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.turns, []);
});

await test('SDK recupera schema inválido, salva e entrega recibo antes do fim do stream', async () => {
  const f = await chatFixture();
  const chunks = await readChunks(
    await f.POST(chatRequest('Monte as páginas.', 'composicao')),
  );
  assert.equal(f.executions(), 1);
  assert.equal(f.modelCalls.length, 2);
  assert.equal(f.state.generation.next, 'pronto');
  assert.ok(chunks.some((part) => part.type === 'tool-input-error'));
  assert.ok(chunks.some((part) => part.type === 'tool-output-available'));
  assert.ok(!chunks.some((part) => part.type === 'error'));
  assert.ok(!JSON.stringify(chunks).includes('A geração não concluiu'));
  const messages = [];
  for await (const message of readUIMessageStream({
    stream: ReadableStream.from(chunks),
  }))
    messages.push(message);
  const text = messages
    .at(-1)
    .parts.filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
  assert.match(text, /4 páginas/);
  assert.match(text, /Site gerado.*Confira a prévia/);
  assert.equal(f.writes.at(-1).text, text);
  assert.equal(chunks.at(-1).type, 'finish');
  const review = await readChunks(
    await f.POST(chatRequest('Revise.', 'revisao')),
  );
  assert.ok(
    review.some(
      (part) => part.type === 'text-delta' && /Site gerado/.test(part.delta),
    ),
  );
});

await test('texto anterior à ferramenta ganha recibo; resposta final existente é preservada', async () => {
  for (const finalText of [false, true]) {
    const chunks = [
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: 'intro' },
      { type: 'text-delta', id: 'intro', delta: 'Vou verificar.' },
      { type: 'text-end', id: 'intro' },
      {
        type: 'tool-input-available',
        toolCallId: 'test',
        toolName: 'get_page',
        input: {},
      },
      { type: 'tool-output-available', toolCallId: 'test', output: {} },
    ];
    if (finalText)
      chunks.push(
        { type: 'text-start', id: 'final' },
        {
          type: 'text-delta',
          id: 'final',
          delta: 'Conferido, ainda há ajustes.',
        },
        { type: 'text-end', id: 'final' },
      );
    chunks.push({
      type: 'finish',
      finishReason: finalText ? 'stop' : 'tool-calls',
    });
    let saved;
    let summaries = 0;
    const output = [];
    for await (const chunk of completeChatStream(ReadableStream.from(chunks), {
      summary: async () => {
        summaries += 1;
        return 'Progresso confirmado.';
      },
      persist: async (text) => {
        saved = text;
      },
    }))
      output.push(chunk);
    assert.equal(summaries, finalText ? 0 : 1);
    assert.match(
      saved,
      finalText ? /Conferido, ainda há ajustes/ : /Progresso confirmado/,
    );
  }
});

await test('fim prematuro e erro fatal não recebem recibo de conclusão', async () => {
  for (const chunks of [
    [{ type: 'start' }],
    [
      { type: 'start' },
      { type: 'error', errorText: 'Falha' },
      { type: 'finish', finishReason: 'error' },
    ],
  ]) {
    const output = [];
    for await (const chunk of completeChatStream(ReadableStream.from(chunks), {
      summary: async () => {
        assert.fail('Não pode resumir como concluído');
      },
      persist: async () => {},
    }))
      output.push(chunk);
    assert.ok(output.some((part) => part.type === 'error'));
  }
});
