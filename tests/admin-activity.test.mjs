import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-module.mjs';

await test('atividade guarda snapshots do usuário e do cliente', async () => {
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
    action: 'tenant.settings.update',
    summary: 'Baltz atualizou os dados de Fixture',
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
  await activity.recordAgentTool({
    requestedBy: actor,
    tenant,
    tool: 'read_current_site',
    callId: 'read-1',
    output: { ok: true },
  });
  assert.equal(writes.length, 1, 'leitura não polui a trilha de ações');
  await activity.recordAgentTool({
    requestedBy: actor,
    tenant,
    tool: 'update_block',
    callId: 'write-1',
    output: { ok: true },
  });
  assert.equal(writes[1].values[1], 'agent');
  assert.equal(writes[1].values[7], 'agent.update_block');
  assert.equal(writes[1].values[12], 'tool:write-1');
});
