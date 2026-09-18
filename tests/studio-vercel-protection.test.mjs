import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasStudioPreviewProtection,
  hasStudioVercelBypass,
  studioSameOriginRedirect,
  studioVercelBypassHeaders,
  studioVercelBypassSecret,
} from '../lib/studio/vercel-protection.ts';

const master = '0123456789abcdef0123456789abcdef';

void test('o bypass é determinístico e isolado por projeto', () => {
  const first = studioVercelBypassSecret('prj_cliente_a', master);
  assert.equal(first, studioVercelBypassSecret('prj_cliente_a', master));
  assert.notEqual(first, studioVercelBypassSecret('prj_cliente_b', master));
  assert.match(first, /^[a-f0-9]{64}$/);
});

void test('o segredo mestre curto ou o projeto vazio são recusados', () => {
  assert.throws(
    () => studioVercelBypassSecret('prj_cliente', 'curto'),
    /ao menos 32 bytes/,
  );
  assert.throws(() => studioVercelBypassSecret(' ', master), /obrigatório/);
});

void test('a proteção exige preview e o bypass de automação exato', () => {
  const secret = studioVercelBypassSecret('prj_cliente', master);
  const project = {
    ssoProtection: { deploymentType: 'preview' },
    protectionBypass: {
      [secret]: { scope: 'automation-bypass' },
    },
  };
  assert.equal(hasStudioPreviewProtection(project), true);
  assert.equal(hasStudioVercelBypass(project, secret), true);
  assert.deepEqual(studioVercelBypassHeaders('prj_cliente', master), {
    'x-vercel-protection-bypass': secret,
  });
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
