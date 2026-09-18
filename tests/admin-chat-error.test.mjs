import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { chatErrorMessage } = await j.import(
  '../app/(admin)/admin/[tenant]/chat-parts.tsx',
);
const { CHAT_INTERRUPTED } = await j.import('../lib/ai/chat-stream.ts');

/**
 * Uma requisição que cai no transporte rejeita com o texto do navegador, que
 * chegava cru ao painel: o operador lia "Load failed" e não sabia se a edição
 * tinha sido salva. O servidor já tem contrato para o caso equivalente em
 * CHAT_INTERRUPTED; o cliente não tinha nenhum.
 */
await test('quedas de conexão viram mensagem acionável, não a string do navegador', () => {
  const quedas = [
    'Load failed',
    'TypeError: Load failed',
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'The operation timed out',
    'The operation was aborted',
  ];
  for (const bruto of quedas) {
    const texto = chatErrorMessage(bruto);
    assert.notEqual(texto, bruto, `"${bruto}" não pode chegar cru à tela`);
    assert.match(texto, /conex/i);
    assert.match(
      texto,
      /confira a prévia|recarregue/i,
      `"${bruto}" precisa dizer o que fazer`,
    );
    assert.doesNotMatch(
      texto,
      /\b(load failed|failed to fetch|networkerror)\b/i,
      'a frase do navegador não pode sobrar no texto traduzido',
    );
  }
});

await test('a mensagem não afirma que salvou nem que perdeu', () => {
  const texto = chatErrorMessage('Load failed');
  // O servidor pode ter concluído a escrita depois da queda: prometer
  // qualquer um dos dois lados mandaria o operador repetir ou confiar à toa.
  assert.match(texto, /pode ter sido salva/i);
  assert.ok(
    CHAT_INTERRUPTED.includes('painel'),
    'o contrato do servidor também manda conferir o estado salvo',
  );
});

await test('o erro do gateway e os demais textos seguem como antes', () => {
  assert.match(
    chatErrorMessage('rate limit exceeded'),
    /AI Gateway recusou a chamada/,
  );
  const especifico = 'Bloco nav-1 inválido: presentation.background';
  assert.equal(chatErrorMessage(especifico), especifico);
});
