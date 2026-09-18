import assert from 'node:assert/strict';
import test from 'node:test';
import { STUDIO_MODELS, studioModelPolicy } from '../lib/studio/models.ts';

void test('roteamento usa Terra no cotidiano e Sol nos passes de alta complexidade', () => {
  assert.deepEqual(studioModelPolicy('assistant'), {
    family: 'terra',
    model: STUDIO_MODELS.terra,
    reasoning: 'medium',
    maxOutputTokens: 16_384,
    maxSteps: 12,
  });
  assert.equal(studioModelPolicy('build').family, 'sol');
  assert.equal(studioModelPolicy('build').reasoning, 'high');
  assert.equal(studioModelPolicy('diagnostic').reasoning, 'xhigh');
  assert.equal(studioModelPolicy('batch').family, 'luna');
  assert.equal(studioModelPolicy('batch').reasoning, 'low');
});
