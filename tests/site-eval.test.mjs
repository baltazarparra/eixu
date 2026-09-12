import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';
import { runEvaluationPhases } from '../scripts/lib/eval-site-flow.mjs';

const { nextPhase } = await loadModule('lib/taste/phases.ts');
const { scenePlan } = await loadModule('lib/images/scene-plan.ts');

// A vibe acompanha a composição: o plano de cenas só sustenta a abertura que
// a faixa da vibe permite, e atelier acrescenta a vaga do detalhe.
for (const [layout, vibe] of [
  ['split', 'comercial'],
  ['cover', 'ousado'],
  ['poster', 'ousado'],
  ['editorial', 'moderno'],
  ['offset', 'artistico'],
  ['atelier', 'artistico'],
])
  await test(`avaliação ${layout} termina na composição gerando as cenas sem aprovação`, async () => {
    const state = {
      hasDesign: false,
      coveredScenes: 0,
      targetScenes: scenePlan({ heroComposition: layout }, 3, vibe).length,
      organicPages: 0,
      blockingErrors: 0,
      reviewRounds: 0,
      reviewComplete: false,
    };
    const calls = [],
      images = [];
    const result = await runEvaluationPhases({
      readSnapshot: async () => ({ images }),
      nextPhase: () => nextPhase(state),
      runPhase: async (_snapshot, phase) => {
        calls.push(phase);
        if (phase === 'briefing') state.hasDesign = true;
        if (phase === 'cenas') {
          images.push({ status: 'disponivel' });
          state.coveredScenes += 1;
        }
        if (phase === 'composicao') state.organicPages = 3;
        if (phase === 'revisao') {
          state.reviewRounds += 1;
          state.reviewComplete = true;
        }
      },
    });
    assert.equal(result.completed, true);
    assert.equal(result.next, 'pronto');
    assert.equal(calls.at(-1), 'composicao');
    assert.equal(result.attempts, state.targetScenes + 2);
    assert.equal(images.length, state.targetScenes);
  });

for (const reason of ['phase-budget', 'phase-error'])
  await test(`avaliação informa execução incompleta por ${reason}`, async () => {
    let calls = 0;
    const result = await runEvaluationPhases({
      readSnapshot: async () => ({
        images: [],
      }),
      nextPhase: () => 'revisao',
      runPhase: async () => {
        calls += 1;
        if (reason === 'phase-error') throw new Error('Sintético');
      },
      maxPhases: 14,
    });
    assert.equal(result.completed, false);
    assert.equal(result.reason, reason);
    assert.equal(
      calls,
      reason === 'phase-budget' ? 14 : reason === 'phase-error' ? 1 : 0,
    );
  });
