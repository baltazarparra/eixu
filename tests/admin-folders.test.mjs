import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { folderNameSchema, folderAssignmentsSchema } = await j.import(
  '../lib/admin/site-folders.ts',
);
const FOLDER_ID = '11111111-1111-4111-8111-111111111111';

await test('nomes de pasta são compactos, legíveis e limitados', () => {
  assert.equal(folderNameSchema.parse('  Equipe   Baltz  '), 'Equipe Baltz');
  assert.equal(folderNameSchema.safeParse('   ').success, false);
  assert.equal(folderNameSchema.safeParse('a'.repeat(41)).success, false);
  assert.equal(folderNameSchema.safeParse('Equipe\nBaltz').success, false);
});

await test('movimentação valida UUIDs, slugs e seleção sem duplicatas', () => {
  const assignment = {
    slug: 'clinica-vertice',
    fromFolderId: null,
    toFolderId: FOLDER_ID,
  };
  assert.equal(folderAssignmentsSchema.safeParse([assignment]).success, true);
  assert.equal(
    folderAssignmentsSchema.safeParse([assignment, assignment]).success,
    false,
  );
  assert.equal(
    folderAssignmentsSchema.safeParse([
      { ...assignment, toFolderId: 'pasta-invalida' },
    ]).success,
    false,
  );
});

async function actionsFixture({ stale = false } = {}) {
  const writes = [];
  const refreshed = [];
  const activities = [];
  const {
    createSiteFolderAction,
    renameSiteFolderAction,
    deleteSiteFolderAction,
    moveSitesToFolderAction,
  } = await loadModule('app/(admin)/admin/actions.ts', {
    '@/lib/auth': {
      currentUser: async () => ({
        id: 'user-1',
        name: 'Operador',
        login: 'operador@eixu',
      }),
    },
    '@/lib/admin/activity': {
      recordActivity: async (activity) => activities.push(activity),
    },
    '@/lib/sites-maintenance': {
      sitesAreInMaintenance: async () => false,
    },
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          const sql = parts.join('?');
          writes.push({ sql, values });
          if (/insert into site_folders/i.test(sql))
            return [{ id: FOLDER_ID, name: values[0] }];
          if (/update site_folders/i.test(sql))
            return [
              {
                id: FOLDER_ID,
                name: values[0],
                site_count: 2,
              },
            ];
          if (/delete from site_folders/i.test(sql))
            return [{ id: FOLDER_ID, name: 'Projetos Baltz' }];
          if (/with requested as/i.test(sql))
            return stale
              ? []
              : JSON.parse(values[0]).map(({ slug }) => ({ slug }));
          return [];
        },
    },
    'next/cache': { revalidatePath: (path) => refreshed.push(path) },
    'next/navigation': {
      redirect: () => {
        throw new Error('Redirecionamento inesperado');
      },
    },
  });
  return {
    createSiteFolderAction,
    renameSiteFolderAction,
    deleteSiteFolderAction,
    moveSitesToFolderAction,
    writes,
    refreshed,
    activities,
  };
}

await test('criação de pasta normaliza o nome e atualiza a listagem', async () => {
  const fixture = await actionsFixture();
  const form = new FormData();
  form.set('name', '  Projetos   Baltz ');
  const result = await fixture.createSiteFolderAction(form);
  assert.equal(result.ok, true);
  assert.equal(result.folder.name, 'Projetos Baltz');
  assert.deepEqual(fixture.refreshed, ['/admin']);
  assert.equal(fixture.activities[0].action, 'folder.create');
});

await test('pasta pode ser renomeada e excluída sem excluir seus sites', async () => {
  const fixture = await actionsFixture();
  const rename = new FormData();
  rename.set('folderId', FOLDER_ID);
  rename.set('name', '  Projetos   ativos ');
  const renamed = await fixture.renameSiteFolderAction(rename);
  assert.equal(renamed.ok, true);
  assert.equal(renamed.folder.name, 'Projetos ativos');

  const remove = new FormData();
  remove.set('folderId', FOLDER_ID);
  const removed = await fixture.deleteSiteFolderAction(remove);
  assert.equal(removed.ok, true);
  assert.match(removed.message, /sites ficaram em Sem pasta/i);
  assert.deepEqual(
    fixture.activities.map((activity) => activity.action),
    ['folder.rename', 'folder.delete'],
  );
});

await test('movimentação em lote compara a pasta anterior e grava uma vez', async () => {
  const fixture = await actionsFixture();
  const form = new FormData();
  form.set(
    'assignments',
    JSON.stringify([
      {
        slug: 'clinica-vertice',
        fromFolderId: null,
        toFolderId: FOLDER_ID,
      },
      {
        slug: 'otica-lumen',
        fromFolderId: null,
        toFolderId: FOLDER_ID,
      },
    ]),
  );
  const result = await fixture.moveSitesToFolderAction(form);
  assert.equal(result.ok, true);
  assert.equal(result.moved, 2);
  assert.equal(fixture.writes.length, 1);
  assert.match(fixture.writes[0].sql, /is not distinct from/i);
  assert.deepEqual(fixture.refreshed, ['/admin']);
  assert.equal(fixture.activities[0].action, 'folder.move_sites');
});

await test('conflito entre sessões não move parte do lote', async () => {
  const fixture = await actionsFixture({ stale: true });
  const form = new FormData();
  form.set(
    'assignments',
    JSON.stringify([
      {
        slug: 'clinica-vertice',
        fromFolderId: null,
        toFolderId: FOLDER_ID,
      },
    ]),
  );
  const result = await fixture.moveSitesToFolderAction(form);
  assert.equal(result.ok, false);
  assert.equal(result.moved, 0);
  assert.match(result.message, /outra sessão/i);
});

await test('schema preserva sites ao excluir pasta e impede nomes duplicados', async () => {
  const schema = await readFile('db/schema.sql', 'utf8');
  assert.match(schema, /create table if not exists site_folders/i);
  assert.match(
    schema,
    /folder_id uuid references site_folders\(id\) on delete set null/i,
  );
  assert.match(schema, /unique index[^;]+lower\(btrim\(name\)\)/i);
});
