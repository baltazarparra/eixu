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
  });
  assert.equal(studioModelPolicy('build').family, 'gemini');
  assert.equal(studioModelPolicy('build').reasoning, 'high');
  assert.equal(studioModelPolicy('diagnostic').reasoning, 'high');
  assert.equal(studioModelPolicy('batch').family, 'gemini');
  assert.equal(studioModelPolicy('batch').reasoning, 'high');
});
