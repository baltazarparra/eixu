import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { loadModuleGraph } from './helpers/load-module.mjs';

void test('integrações atendem a release ativa enquanto o rascunho muda', async () => {
  // Este SELECT usa somente SQL comum; SQLite executa os joins e filtros reais.
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      create table tenants (id text, slug text, status text);
      create table studio_projects (id text, tenant_id text, active_release_id text, status text);
      create table studio_releases (id text, project_id text, status text);
      insert into tenants values ('tenant', 'fixture', 'published');
      insert into studio_projects values ('project', 'tenant', 'release', 'published');
      insert into studio_releases values ('release', 'project', 'active');
    `);
    const { publicTenantBySlug } = loadModuleGraph('lib/site-availability.ts', {
      '@/lib/db': {
        db:
          () =>
          async (parts, ...values) =>
            database.prepare(parts.join('?')).all(...values),
      },
      '@/lib/tenant-queries': { tenantFromRow: (row) => row },
    });
    for (const status of [
      'published',
      'building',
      'ready',
      'failed',
      'draft',
    ]) {
      database.prepare('update studio_projects set status = ?').run(status);
      assert.equal((await publicTenantBySlug('fixture'))?.id, 'tenant', status);
    }
    assert.equal(await publicTenantBySlug('outro'), null);
    for (const mutation of [
      "update studio_projects set status = 'archived'",
      "update tenants set status = 'archived'",
      "update tenants set status = 'draft'",
      'update studio_projects set active_release_id = null',
      "update studio_releases set status = 'failed'",
      "update studio_releases set project_id = 'outro'",
    ]) {
      database.exec(`
        update tenants set status = 'published';
        update studio_projects set status = 'published', active_release_id = 'release';
        update studio_releases set status = 'active', project_id = 'project';
      `);
      database.exec(mutation);
      assert.equal(await publicTenantBySlug('fixture'), null, mutation);
    }
  } finally {
    database.close();
  }
});
