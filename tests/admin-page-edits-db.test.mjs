import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { localPostgres } from './helpers/local-postgres.mjs';
import { loadModule } from './helpers/load-module.mjs';
import { editTenant, editPages } from './helpers/page-edit-fixture.mjs';

await test(
  'edição atômica e isolamento com SQL e driver Neon reais em PostgreSQL local',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const other = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const tenant = { ...editTenant, id: randomUUID(), slug: randomUUID() };
    const foreign = { ...editTenant, id: randomUUID(), slug: randomUUID() };
    t.after(async () => {
      try {
        await database.query('delete from tenants where id = any($1)', [
          [tenant.id, foreign.id],
        ]);
      } finally {
        await other.close();
        await database.close();
      }
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    for (const current of [tenant, foreign]) {
      await database.query(
        'insert into tenants (id, slug, name) values ($1, $2, $3)',
        [current.id, current.slug, current.name],
      );
      const page = editPages()[0];
      await database.query(
        "insert into pages (tenant_id, slug, type, title, blocks, published_blocks) values ($1, '', 'page', 'Início', $2::jsonb, $2::jsonb)",
        [current.id, JSON.stringify(page.blocks)],
      );
    }
    const queriesA = await loadModule('lib/tenant-queries.ts', {
      '@/lib/db': database,
    });
    const queriesB = await loadModule('lib/tenant-queries.ts', {
      '@/lib/db': other,
    });
    let readers = 0;
    let release;
    const barrier = new Promise((resolve) => {
      release = resolve;
    });
    const wrap = (queries) => ({
      ...queries,
      getPage: async (...args) => {
        const page = await queries.getPage(...args);
        if (++readers === 2) release();
        await barrier;
        return page;
      },
    });
    const a = await loadModule('lib/ai/tools.ts', {
      '@/lib/db': database,
      '@/lib/sites/edits': await loadModule('lib/sites/edits.ts', {
        '@/lib/db': database,
      }),
      '@/lib/tenant-queries': wrap(queriesA),
    });
    const b = await loadModule('lib/ai/tools.ts', {
      '@/lib/db': other,
      '@/lib/sites/edits': await loadModule('lib/sites/edits.ts', {
        '@/lib/db': other,
      }),
      '@/lib/tenant-queries': wrap(queriesB),
    });
    const { pageRevision } = await loadModule('lib/ai/page-edits.ts');
    const revision = pageRevision(await queriesA.getPage(tenant.id, ''));
    const toolsA = a.buildTools(tenant, { editPolicy: { kind: 'edit' } });
    const toolsB = b.buildTools(tenant, { editPolicy: { kind: 'edit' } });
    const change = (value) => ({
      page: '',
      revision,
      operations: [{ op: 'set', block: 'intro', path: 'title', value }],
    });
    const results = await Promise.all([
      toolsA.edit_page.execute(change('Escolhas da primeira aba')),
      toolsB.edit_page.execute(change('Escolhas da segunda aba')),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.match(results.find((r) => r.error).error, /durante a edição/);
    const saved = await queriesA.getPage(tenant.id, '');
    assert.deepEqual(saved.publishedBlocks, editPages()[0].blocks);
    assert.deepEqual(
      (await queriesA.getPage(foreign.id, '')).blocks,
      editPages()[0].blocks,
    );

    const rejected = await toolsA.edit_page.execute({
      page: '',
      revision: pageRevision(saved),
      operations: [
        { op: 'set', block: 'intro', path: 'title', value: 'Não deve salvar' },
        {
          op: 'set',
          block: 'faq',
          path: 'items.100.q',
          value: 'Item inexistente',
        },
      ],
    });
    assert.ok(rejected.error);
    assert.deepEqual(
      (await queriesA.getPage(tenant.id, '')).blocks,
      saved.blocks,
    );
    const ownRevision = pageRevision(await queriesA.getPage(tenant.id, ''));
    const missing = await toolsA.edit_page.execute({
      page: foreign.slug,
      revision: ownRevision,
      operations: [{ op: 'remove', block: 'intro' }],
    });
    assert.ok(missing.error);
  },
);
