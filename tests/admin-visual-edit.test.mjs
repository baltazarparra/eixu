import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import {
  recognitionFixture,
  recognitionOperations,
  recognitionRequest,
} from './helpers/recognition-fixture.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { pageRevision } = await j.import('../lib/ai/page-edits.ts');
const { editPolicyFor, asksRemoval } = await j.import(
  '../lib/ai/edit-policy.ts',
);
const { createEditReceipt } = await j.import('../lib/ai/edit-receipt.ts');
const { completeChatStream } = await j.import('../lib/ai/chat-stream.ts');
const { readUIMessageStream } = await import('ai');

await test('pedido real ajusta a imagem sem recompor a seção nem tocar nas outras páginas', async () => {
  const f = await recognitionFixture();
  const before = structuredClone(f.pages);
  const policy = editPolicyFor(recognitionRequest, f.pages);
  assert.equal(policy.visualOnly, true);
  assert.equal(policy.removal, false);
  assert.deepEqual(policy.targets, [{ page: '', block: 'recognition' }]);
  assert.equal(f.tools.set_brand, undefined);
  assert.equal(f.tools.confirm_evidence, undefined);
  assert.equal(f.tools.update_image, undefined);
  const result = await f.tools.edit_page.execute({
    page: '',
    revision: pageRevision(f.pages[0]),
    operations: recognitionOperations,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.pages[1], before[1]);
  assert.deepEqual(f.pages[0].publishedBlocks, before[0].publishedBlocks);
  assert.deepEqual(
    f.pages[0].blocks.map((b) => [b.id, b.type, b.props.layout]),
    before[0].blocks.map((b) => [b.id, b.type, b.props.layout]),
  );
  const block = f.pages[0].blocks.find((b) => b.id === 'recognition');
  const original = before[0].blocks.find((b) => b.id === 'recognition');
  assert.deepEqual(block.props.items.slice(1), original.props.items.slice(1));
  const { imagePresentation, ...first } = block.props.items[0];
  assert.deepEqual(first, original.props.items[0]);
  assert.equal(imagePresentation.fit, 'natural');
  assert.match(result.summary.join(' '), /moldura da imagem removida/);
  assert.doesNotMatch(
    result.summary.join(' '),
    /confirmamos|evidência registrada|sincroniza/i,
  );
});

await test('reconstrução, mudança de layout, perda de texto e edição de outra seção são recusadas com o lote inteiro', async () => {
  for (const operation of [
    { op: 'set', block: 'recognition', path: 'layout', value: 'service-lens' },
    {
      op: 'set',
      block: 'recognition',
      path: 'items.1.title',
      value: 'Título inventado',
    },
    { op: 'unset', block: 'recognition', path: 'items.0.caption' },
    {
      op: 'set',
      block: 'hero',
      path: 'presentation.background',
      value: '#ffffff',
    },
    { op: 'move', block: 'recognition', position: { relation: 'end' } },
    { op: 'remove', block: 'recognition' },
    {
      op: 'replace_block',
      block: 'recognition',
      replacement: {
        type: 'editorial.text',
        props: {
          title: 'Reconhecimento',
          body: 'Uma troca indevida do conteúdo do operador.',
        },
      },
    },
  ]) {
    const f = await recognitionFixture();
    const before = structuredClone(f.pages);
    const result = await f.tools.edit_page.execute({
      page: '',
      revision: pageRevision(f.pages[0]),
      operations: [recognitionOperations[0], operation],
    });
    assert.ok(result.error, JSON.stringify(operation));
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.pages, before);
  }
});

await test('restrição de escopo e remoção de decoração não autorizam apagar textos', () => {
  for (const request of [
    'Mova apenas os selos para baixo do título',
    'Mova os selos sem apagar nada',
    'Não remova os selos',
    'Remova as bordas da imagem',
    'Quero somente aumentar a imagem',
    recognitionRequest,
  ])
    assert.equal(asksRemoval(request), false, request);
  assert.equal(asksRemoval('Remova os selos sem mexer no restante'), true);
});

await test('o stream e o histórico exibem o recibo real mesmo quando o modelo inventa sincronização ou sucesso', async () => {
  const receipt = createEditReceipt();
  receipt.observe(
    'edit_page',
    { page: '' },
    { error: 'O pedido mudaria o layout. Nenhuma alteração salva.' },
  );
  receipt.observe(
    'lint_site',
    {},
    {
      findings: [
        {
          level: 'error',
          message: 'O selo não está sustentado pela evidência informada.',
        },
      ],
    },
  );
  const persisted = [];
  const chunks = [
    { type: 'start' },
    { type: 'start-step' },
    { type: 'text-start', id: 'final' },
    {
      type: 'text-delta',
      id: 'final',
      delta:
        'Confirmamos pela sua imagem que a comprovação está salva. O validador ainda não sincronizou.',
    },
    { type: 'text-end', id: 'final' },
    { type: 'finish-step' },
    { type: 'finish', finishReason: 'stop' },
  ];
  const output = [];
  for await (const chunk of completeChatStream(ReadableStream.from(chunks), {
    receipt: () => receipt.text(),
    summary: async () => 'fallback',
    persist: async (text) => persisted.push(text),
  }))
    output.push(chunk);
  const messages = [];
  for await (const message of readUIMessageStream({
    stream: ReadableStream.from(output),
  }))
    messages.push(message);
  const visible = messages
    .at(-1)
    .parts.filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('');
  assert.match(visible, /Nenhuma alteração foi salva/);
  assert.match(visible, /O selo não está sustentado/);
  assert.doesNotMatch(visible, /Confirmamos|sincroniz/);
  assert.deepEqual(persisted, [visible]);
});

await test('pergunta sem operação preserva texto e metadados do modelo', async () => {
  const receipt = createEditReceipt();
  const metadata = { fixture: { signature: 'preservada' } };
  const parts = [
    { type: 'start' },
    { type: 'text-start', id: 'ask', providerMetadata: metadata },
    {
      type: 'text-delta',
      id: 'ask',
      delta: 'Qual das duas imagens você quer ajustar?',
    },
    { type: 'text-end', id: 'ask' },
    { type: 'finish' },
  ];
  const out = [];
  for await (const chunk of completeChatStream(ReadableStream.from(parts), {
    receipt: () => receipt.text(),
    summary: async () => 'fallback',
    persist: async () => {},
  }))
    out.push(chunk);
  assert.deepEqual(out, parts);
});

await test('alvo ausente ou duplicado não autoriza escolher ou editar várias seções', async () => {
  const f = await recognitionFixture();
  assert.deepEqual(
    editPolicyFor(
      recognitionRequest.replace('Reconhecimento comprovado', 'Outro bloco'),
      f.pages,
    ).targets,
    [],
  );
  f.pages[0].blocks.push({
    ...structuredClone(f.pages[0].blocks[2]),
    id: 'duplicate',
  });
  assert.deepEqual(editPolicyFor(recognitionRequest, f.pages).targets, []);
});

await test('recibo não esconde resultados de pedidos mistos e invalida consulta anterior à escrita', () => {
  const receipt = createEditReceipt();
  receipt.observe('lint_site', {}, { findings: [] });
  receipt.observe(
    'edit_page',
    { page: '' },
    { ok: true, changed: true, summary: ['Imagem ajustada.'] },
  );
  assert.doesNotMatch(receipt.text(), /não encontrou bloqueios/);
  receipt.observe('publish_site', {}, { published: ['/'], blocked: [] });
  assert.equal(receipt.text(), undefined);
});

await test('erro fatal não exibe nem persiste sucesso que ficou no buffer', async () => {
  const receipt = createEditReceipt();
  receipt.observe('edit_page', { page: '' }, { error: 'Pedido recusado.' });
  const parts = [
    { type: 'start' },
    { type: 'text-start', id: 'stale' },
    { type: 'text-delta', id: 'stale', delta: 'Tudo foi salvo.' },
    { type: 'text-end', id: 'stale' },
    { type: 'error', errorText: 'Interrompido' },
    { type: 'finish', finishReason: 'error' },
  ];
  const out = [];
  for await (const chunk of completeChatStream(ReadableStream.from(parts), {
    receipt: () => receipt.text(),
    summary: async () => assert.fail('Não deve concluir'),
    persist: async () => assert.fail('Não deve persistir o sucesso inventado'),
  }))
    out.push(chunk);
  assert.ok(out.some((chunk) => chunk.type === 'error'));
  assert.ok(!out.some((chunk) => chunk.type === 'text-delta'));
});
