import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-module.mjs';

const { actionLabel, actorLabel, byLastAction, lastTouch } = await loadModule(
  'lib/admin/site-list.ts',
);

void test('a última ação mantém autoria humana e identifica o agente', () => {
  assert.equal(actionLabel('agent.checkpoint.saved'), 'checkpoint.saved');
  assert.equal(actionLabel('studio.turn.start'), 'studio.turn.start');
  assert.equal(
    actorLabel({ actorType: 'agent', actorName: 'Baltz' }),
    'Agente · a pedido de Baltz',
  );
  assert.equal(actorLabel({ actorType: 'system', actorName: null }), 'Sistema');
  assert.equal(actorLabel({ actorType: 'user', actorName: 'Baltz' }), 'Baltz');
});

void test('a gestão ordena clientes pela mesma data exibida', () => {
  const recent = {
    updatedAt: '2026-09-01T12:00:00Z',
    lastAction: { at: '2026-09-18T12:00:00Z' },
  };
  const untouched = { updatedAt: '2026-09-10T12:00:00Z' };
  assert.equal(lastTouch(untouched), untouched.updatedAt);
  assert.deepEqual([untouched, recent].sort(byLastAction), [recent, untouched]);
});
