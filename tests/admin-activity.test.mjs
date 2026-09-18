import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-module.mjs';

void test('atividade preserva autoria, cliente e chave idempotente', async () => {
  const writes = [];
  const activity = await loadModule('lib/admin/activity.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          writes.push({ sql: parts.join('?'), values });
          return [];
        },
    },
  });
  const actor = {
    id: '0dc054a8-6697-45f1-b772-972e7b0513d0',
    name: 'Baltz',
    login: 'baltz@eixu',
  };
  const tenant = {
    id: '629f0df1-d88c-4e0c-87e7-7939981078da',
    slug: 'fixture',
    name: 'Fixture',
  };

  await activity.recordActivity({
    actor,
    tenant,
    action: 'studio.turn.start',
    summary: 'Baltz iniciou um turno',
    resourceType: 'studio_run',
    resourceId: 'run-1',
    operationId: 'studio-run:run-1',
  });

  assert.deepEqual(writes[0].values.slice(0, 7), [
    actor.id,
    'user',
    actor.name,
    actor.login,
    tenant.id,
    tenant.slug,
    tenant.name,
  ]);
  assert.equal(writes[0].values[7], 'studio.turn.start');
  assert.equal(writes[0].values[12], 'studio-run:run-1');
  assert.match(writes[0].sql, /on conflict \(operation_id\) do nothing/i);
});

void test('listagem normaliza datas e respeita o limite máximo', async () => {
  const calls = [];
  const activity = await loadModule('lib/admin/activity.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          calls.push({ sql: parts.join('?'), values });
          return [
            {
              id: 9,
              actor_type: 'agent',
              actor_name: 'Studio',
              actor_login: null,
              tenant_id: null,
              tenant_slug: 'fixture',
              tenant_name: 'Fixture',
              action: 'studio.turn.finish',
              result: 'success',
              summary: 'Turno concluído',
              created_at: new Date('2026-09-18T12:00:00.000Z'),
            },
          ];
        },
    },
  });

  const rows = await activity.listActivity({
    tenantSlug: 'fixture',
    limit: 500,
  });
  assert.equal(calls[0].values.at(-1), 200);
  assert.equal(rows[0].actorType, 'agent');
  assert.equal(rows[0].createdAt, '2026-09-18T12:00:00.000Z');
});
