import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatFixture,
  chatRequest,
  readChunks,
} from './helpers/chat-fixture.mjs';

await test('publicar, eu autorizo executa no servidor sem chamar o modelo', async () => {
  const f = await chatFixture({
    publicationResult: {
      published: ['/'],
      blocked: [],
      url: 'https://stream-fixture.eixu.com.br',
      warnings: [
        {
          page: '/',
          rule: 'landing-prova',
          level: 'warn',
          message: 'Sem prova',
        },
      ],
    },
  });
  const chunks = await readChunks(
    await f.POST(chatRequest('publicar, eu autorizo')),
  );
  const text = chunks
    .filter((item) => item.type === 'text-delta')
    .map((item) => item.delta)
    .join('');
  assert.match(text, /Publicado: https:\/\/stream-fixture.eixu.com.br/);
  assert.match(text, /recomendações continuam/);
  assert.equal(f.publicationCalls.length, 1);
  assert.equal(f.publicationCalls[0].tenantId, 'fixture');
  assert.deepEqual(f.modelCalls, []);
  assert.deepEqual(f.turns, []);
  assert.equal(f.writes.at(-1).text, text);
  assert.equal(chunks.at(-1).type, 'finish');
});

await test('publicação direta mantém autenticação, cliente e exclusão mútua com geração', async () => {
  const anonymous = await chatFixture({ authenticated: false });
  assert.equal(
    (await anonymous.POST(chatRequest('publicar, eu autorizo'))).status,
    401,
  );
  assert.deepEqual(anonymous.publicationCalls, []);
  const running = await chatFixture({
    running: { id: 'run', status: 'running' },
  });
  assert.equal(
    (await running.POST(chatRequest('publique o site'))).status,
    409,
  );
  assert.deepEqual(running.publicationCalls, []);
  const missing = await chatFixture();
  const body = await chatRequest('publique o site').json();
  body.tenant = 'outro-cliente';
  const response = await missing.POST(
    new Request('https://fixture.test/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(missing.publicationCalls, []);
});

await test('erro técnico não vira recibo de sucesso', async () => {
  const f = await chatFixture({
    publicationResult: {
      published: [],
      blocked: [
        { page: '/', preflight: 'ERRO [props-invalidas] Bloco inválido' },
      ],
      url: 'https://fixture.test',
    },
  });
  const chunks = await readChunks(await f.POST(chatRequest('publicar')));
  const text = chunks
    .filter((item) => item.type === 'text-delta')
    .map((item) => item.delta)
    .join('');
  assert.match(text, /erro técnico.*props-invalidas/);
  assert.doesNotMatch(text, /Publicado:/);
  assert.deepEqual(f.modelCalls, []);
});
