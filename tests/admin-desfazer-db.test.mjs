import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { localPostgres } from './helpers/local-postgres.mjs';
import { loadModule } from './helpers/load-module.mjs';
import { editTenant, editPages } from './helpers/page-edit-fixture.mjs';

await test(
  'histórico do rascunho, retenção e desfazer com SQL e driver Neon reais',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const tenant = { ...editTenant, id: randomUUID(), slug: randomUUID() };
    t.after(async () => {
      try {
        await database.query('delete from tenants where id = $1', [tenant.id]);
      } finally {
        await database.close();
      }
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    await database.query(
      'insert into tenants (id, slug, name) values ($1, $2, $3)',
      [tenant.id, tenant.slug, tenant.name],
    );
    const first = editPages()[0];
    const { rows } = await database.query(
      "insert into pages (tenant_id, slug, type, title, blocks) values ($1, '', 'page', 'Início', $2::jsonb) returning id",
      [tenant.id, JSON.stringify(first.blocks)],
    );
    const pageId = rows[0].id;
    const queries = await loadModule('lib/tenant-queries.ts', {
      '@/lib/db': database,
    });
    const revisions = await loadModule('lib/sites/revisions.ts', {
      '@/lib/db': database,
    });
    const edits = await loadModule('lib/sites/edits.ts', {
      '@/lib/db': database,
      '@/lib/sites/revisions': revisions,
    });

    // Vinte e cinco escritas: a retenção precisa cortar no SQL real.
    for (let round = 0; round < 25; round += 1) {
      const page = await queries.getPage(tenant.id, '');
      const blocks = structuredClone(page.blocks);
      blocks[2].props.title = `Como escolher ${round}`;
      const saved = await edits.savePageEdit({
        tenant,
        page,
        blocks,
        brand: tenant.brand,
      });
      assert.equal(saved.changed, true);
      assert.equal(saved.undoAvailable, true);
    }
    const kept = await database.query(
      'select count(*)::int as total from page_revisions where page_id = $1',
      [pageId],
    );
    assert.equal(kept.rows[0].total, revisions.MAX_PAGE_REVISIONS);

    const current = await queries.getPage(tenant.id, '');
    assert.equal(current.blocks[2].props.title, 'Como escolher 24');
    const undone = await edits.undoPageEdit({
      tenant,
      page: current,
      brand: tenant.brand,
    });
    assert.equal(undone.ok, true);
    const restored = await queries.getPage(tenant.id, '');
    assert.equal(restored.blocks[2].props.title, 'Como escolher 23');

    // Escrita concorrente: o desfazer recusa quando a página mudou no meio.
    const stale = structuredClone(restored);
    await database.query('update pages set blocks = $2::jsonb where id = $1', [
      pageId,
      JSON.stringify(first.blocks),
    ]);
    await assert.rejects(
      edits.undoPageEdit({ tenant, page: stale, brand: tenant.brand }),
      /durante o desfazer/,
    );
    const withUndo = await revisions.pagesWithUndo(tenant.id);
    assert.deepEqual(withUndo, ['']);
  },
);
