import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-module.mjs';

const { LIFECYCLE_LABELS, usageFilters, usageLabel } = await loadModule(
  'lib/admin/usage-history.ts',
);

void test('filtros de consumo limitam paginação e datas inválidas', () => {
  assert.equal(usageFilters({ period: 'all', usagePage: '-1' }).page, 1);
  assert.equal(
    usageFilters({ period: 'all', usagePage: '999999999' }).page,
    1_000_000,
  );
  assert.ok(usageFilters({ start: ['2026-09-01'], end: '2026-09-15' }).error);
  assert.ok(usageFilters({ start: '2026-09-16', end: '2026-09-15' }).error);
  assert.equal(usageFilters({ periodo: 'tudo' }).periodo, 'tudo');
});

void test('histórico apresenta papéis do Studio sem nomenclatura do gerador', () => {
  assert.equal(LIFECYCLE_LABELS.studio, 'Studio');
  assert.equal(usageLabel('art_direction', null), 'Direção de arte');
  assert.equal(
    usageLabel('build', 'build:step-3'),
    'Construção · build:step-3',
  );
});
