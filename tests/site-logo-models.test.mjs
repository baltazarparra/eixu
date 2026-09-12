import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

await test('upgrade de leitura/crítica de logo preserva o agente e os overrides explícitos', async () => {
  const policy = (env) =>
    loadModule('lib/ai/models.ts', {}, { process: { env } });
  const defaults = await policy({});
  assert.equal(defaults.productModel(), 'google/gemini-3.8-flash');
  assert.equal(defaults.productModel('critic'), 'google/gemini-3.8-flash');
  assert.equal(
    defaults.productModel('logo-critic'),
    'anthropic/claude-sonnet-5',
  );
  assert.equal(defaults.LOGO_IMAGE_MODEL, 'openai/gpt-image-2');
  for (const [env, expected] of [
    [{ EIXU_MODEL: 'operator/agent' }, 'operator/agent'],
    [
      { EIXU_MODEL: 'operator/agent', EIXU_CRITIC_MODEL: 'operator/critic' },
      'operator/critic',
    ],
    [
      {
        EIXU_CRITIC_MODEL: 'operator/critic',
        EIXU_LOGO_CRITIC_MODEL: 'operator/logo',
      },
      'operator/logo',
    ],
  ])
    assert.equal((await policy(env)).productModel('logo-critic'), expected);
});
