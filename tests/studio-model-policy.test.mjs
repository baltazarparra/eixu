import assert from 'node:assert/strict';
import test from 'node:test';
import { STUDIO_MODELS, studioModelPolicy } from '../lib/studio/models.ts';

void test('todos os papéis usam Gemini 3.8 Flash no esforço máximo suportado', () => {
  assert.deepEqual(studioModelPolicy('assistant'), {
    family: 'gemini',
    model: STUDIO_MODELS.gemini,
    reasoning: 'high',
    maxOutputTokens: 16_384,
    maxSteps: 12,
    maxTotalSteps: 12,
  });
  assert.equal(studioModelPolicy('build').family, 'gemini');
  assert.equal(studioModelPolicy('build').reasoning, 'high');
  assert.equal(studioModelPolicy('diagnostic').reasoning, 'high');
  assert.equal(studioModelPolicy('batch').family, 'gemini');
  assert.equal(studioModelPolicy('batch').reasoning, 'high');
});

void test('só a edição continua além de um segmento do agente', () => {
  const edit = studioModelPolicy('edit');
  assert.equal(edit.maxSteps, 48);
  assert.equal(edit.maxTotalSteps, 150);
  for (const role of [
    'assistant',
    'batch',
    'context',
    'art_direction',
    'build',
    'refine',
    'critic',
    'diagnostic',
  ]) {
    const policy = studioModelPolicy(role);
    assert.equal(policy.maxTotalSteps, policy.maxSteps, role);
  }
});
