import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStudioVercelBypassSecret,
  hasStudioCandidateProtection,
  hasStudioVercelBypass,
  studioSameOriginRedirect,
  studioVercelBypassHeaders,
  withTemporaryStudioVercelBypass,
} from '../lib/studio/vercel-protection.ts';

void test('o bypass temporário é aleatório e aceito pela API da Vercel', () => {
  const first = createStudioVercelBypassSecret();
  const second = createStudioVercelBypassSecret();
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{32}$/);
});

void test('a proteção cobre candidatos de produção e exige o bypass exato', () => {
  const secret = createStudioVercelBypassSecret();
  const project = {
    ssoProtection: {
      deploymentType: 'prod_deployment_urls_and_all_previews',
    },
    protectionBypass: {
      [secret]: { scope: 'automation-bypass' },
    },
  };
  assert.equal(hasStudioCandidateProtection(project), true);
  for (const deploymentType of ['preview', 'all', undefined])
    assert.equal(
      hasStudioCandidateProtection({ ssoProtection: { deploymentType } }),
      false,
    );
  assert.equal(hasStudioVercelBypass(project, secret), true);
  assert.deepEqual(studioVercelBypassHeaders(secret), {
    'x-vercel-protection-bypass': secret,
  });
  assert.throws(() => studioVercelBypassHeaders('inválido'), /inválido/);
});

void test('o bypass temporário é revogado depois do smoke', async () => {
  const updates = [];
  const result = await withTemporaryStudioVercelBypass(
    async (body) => {
      updates.push(body);
      if ('generate' in body)
        return {
          protectionBypass: {
            [body.generate.secret]: { scope: 'automation-bypass' },
          },
        };
      return { protectionBypass: {} };
    },
    async (headers) => {
      assert.match(headers['x-vercel-protection-bypass'], /^[a-f0-9]{32}$/);
      return 'ok';
    },
  );
  assert.equal(result, 'ok');
  assert.equal(updates.length, 2);
  assert.equal(updates[0].generate.secret, updates[1].revoke.secret);
});

void test('o bypass temporário também é revogado quando o smoke falha', async () => {
  const updates = [];
  await assert.rejects(
    withTemporaryStudioVercelBypass(
      async (body) => {
        updates.push(body);
        if ('generate' in body)
          return {
            protectionBypass: {
              [body.generate.secret]: { scope: 'automation-bypass' },
            },
          };
        return { protectionBypass: {} };
      },
      async () => {
        throw new Error('smoke indisponível');
      },
    ),
    /smoke indisponível/,
  );
  assert.equal(updates.length, 2);
  assert.equal(updates[0].generate.secret, updates[1].revoke.secret);
});

void test('falha incerta ao criar o bypass dispara revogação compensatória', async () => {
  const updates = [];
  await assert.rejects(
    withTemporaryStudioVercelBypass(
      async (body) => {
        updates.push(body);
        if ('generate' in body) throw new Error('resposta perdida');
        return { protectionBypass: {} };
      },
      async () => assert.fail('o smoke não deve iniciar'),
    ),
    /resposta perdida/,
  );
  assert.equal(updates.length, 2);
  assert.equal(updates[0].generate.secret, updates[1].revoke.secret);
});

void test('o smoke mantém o bypass dentro da origem do deployment', () => {
  assert.equal(
    studioSameOriginRedirect(
      'https://candidate.vercel.app/inicio',
      '/sobre',
      'https://candidate.vercel.app',
    ),
    'https://candidate.vercel.app/sobre',
  );
  assert.throws(
    () =>
      studioSameOriginRedirect(
        'https://candidate.vercel.app/inicio',
        'https://example.com/captura',
        'https://candidate.vercel.app',
      ),
    /outra origem/,
  );
});
