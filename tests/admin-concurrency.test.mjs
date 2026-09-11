import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { loadModule } from './helpers/load-module.mjs';
import { localPostgres } from './helpers/local-postgres.mjs';

const urlA = 'https://www.instagram.com/fixture.a/';
const urlB = 'https://www.instagram.com/fixture.b/';
const deferred = () => Promise.withResolvers();
const html = (name, image = false) =>
  `<meta property="og:title" content="${name} (@fixture) · Instagram photos and videos"><meta name="description" content="100 Followers - ${name} on Instagram: &quot;Bio ${name}&quot;">${image ? '<meta property="og:image" content="https://cdn.test/avatar.png">' : ''}`;

await test(
  'concorrência com Postgres real, Blob e rede simulados',
  {
    skip: !process.env.EIXU_TEST_POSTGRES_URL,
  },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const fixtureIds = [];
    t.after(async () => {
      try {
        for (const id of fixtureIds)
          await database.query('DELETE FROM tenants WHERE id = $1', [id]);
      } finally {
        await database.close();
      }
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    const locks = await loadModule('lib/tenant-lock.ts', {
      '@/lib/db': database,
    });
    const files = new Map();
    const hooks = {};
    const blobs = {
      put: async (pathname) => {
        await hooks.put?.(pathname);
        const url = `https://blob.test/${pathname}`;
        files.set(url, pathname);
        return { url, pathname };
      },
      list: async ({ prefix }) => {
        await hooks.list?.(prefix);
        return {
          blobs: [...files]
            .filter(([, path]) => path.startsWith(prefix))
            .map(([url]) => ({ url })),
          hasMore: false,
        };
      },
      del: async (urls) => {
        await hooks.del?.();
        for (const url of [urls].flat()) files.delete(url);
      },
    };
    const blobFiles = await loadModule('lib/blob/tenant-files.ts', {
      '@vercel/blob': blobs,
      '@/lib/tenant-lock': locks,
    });
    const social = await loadModule('lib/ai/social.ts', {
      '@/lib/db': database,
      '@vercel/blob': blobs,
      '@/lib/blob/tenant-files': blobFiles,
    });
    const queries = await loadModule('lib/tenant-queries.ts', {
      '@/lib/db': database,
    });
    const actions = await loadModule('app/(admin)/admin/actions.ts', {
      '@/lib/db': database,
      '@/lib/tenant-lock': locks,
      '@/lib/blob/tenant-files': blobFiles,
      '@/lib/tenant-queries': queries,
      '@/lib/ai/social': social,
      '@/lib/auth': { isAuthenticated: async () => true },
      'next/navigation': {
        redirect: () => {
          throw new Error('Redirecionamento inesperado');
        },
      },
      'next/server': {
        after: () => {
          throw new Error('after inesperado');
        },
      },
      'next/cache': { revalidatePath: () => {} },
    });
    const { normalizeSocialUrl } = await loadModule('lib/social-profile.ts');
    async function fixture() {
      const slug = `fixture-${randomUUID()}`;
      const {
        rows: [row],
      } = await database.query(
        'INSERT INTO tenants (slug, name, brief) VALUES ($1, $2, $3) RETURNING id',
        [slug, 'Fixture', JSON.stringify({ intake: { socialUrl: urlA } })],
      );
      fixtureIds.push(row.id);
      return queries.getTenantBySlug(slug);
    }
    const setUrl = (id, url) =>
      database.query(
        "UPDATE tenants SET brief = jsonb_set(brief, '{intake,socialUrl}', $2::jsonb) WHERE id = $1",
        [id, JSON.stringify(url)],
      );
    const mark = (tenant, url) =>
      social.markSocialReading(tenant.id, normalizeSocialUrl(url));
    const current = async (tenant) =>
      (await queries.getTenantBySlug(tenant.slug))?.brief.social;
    function remove(tenant, confirmation = '') {
      const form = new FormData();
      form.set('slug', tenant.slug);
      form.set('confirm', confirmation);
      return actions.deleteTenantAction(null, form);
    }
    const png = await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#fff' },
    })
      .png()
      .toBuffer();
    const imageDeps = {
      fetch: async (url) =>
        url.includes('cdn.test')
          ? new Response(png, { headers: { 'content-type': 'image/png' } })
          : new Response(html('Fixture', true)),
      lookup: async () => ({ address: '203.0.113.2', family: 4 }),
      describe: async () => 'Avatar sintético',
    };
    async function waitLocked(mode) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const {
          rows: [row],
        } = await database.query(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE $1) AS waiting",
          [`%${mode}%`],
        );
        if (row.waiting) return;
        await delay(10);
      }
      assert.fail(`A operação não aguardou o lock ${mode}`);
    }

    await t.test(
      'geração de cenas exclui concorrente do mesmo tenant e libera o lock após falha',
      { timeout: 10_000 },
      async () => {
        const { withSceneGenerationLock } = await loadModule(
          'lib/images/generation-lock.ts',
          {
            '@/lib/db': database,
          },
        );
        const tenant = await fixture();
        const entered = deferred(),
          release = deferred();
        const first = withSceneGenerationLock(tenant.id, async () => {
          // O upload real usa outra conexão e precisa coexistir com o advisory lock.
          await locks.withTenantLock(tenant.id, 'upload', async () => {});
          entered.resolve();
          await release.promise;
          throw new Error('Geração interrompida');
        });
        const failed = assert.rejects(first, /Geração interrompida/);
        await entered.promise;
        try {
          assert.equal(
            await withSceneGenerationLock(tenant.id, async () =>
              assert.fail('Concorrente entrou'),
            ),
            null,
          );
          assert.equal(
            await withSceneGenerationLock(
              randomUUID(),
              async () => 'outro tenant',
            ),
            'outro tenant',
          );
        } finally {
          release.resolve();
          await failed;
        }
        assert.equal(
          await withSceneGenerationLock(tenant.id, async () => 'retomado'),
          'retomado',
        );
        assert.equal(
          await withSceneGenerationLock(tenant.id, async () => 'após commit'),
          'após commit',
        );
      },
    );

    for (const nextUrl of [urlB, urlA])
      await t.test(
        `resposta antiga não vence uma leitura nova de ${nextUrl === urlA ? 'mesma URL' : 'outra URL'}`,
        async () => {
          const tenant = await fixture();
          const old = await mark(tenant, urlA);
          const entered = deferred(),
            release = deferred();
          const pending = social.syncSocialProfile(tenant, old, {
            fetch: async () => {
              entered.resolve();
              await release.promise;
              return new Response(html('Antiga'));
            },
          });
          await entered.promise;
          try {
            await setUrl(tenant.id, nextUrl);
            const latest = await mark(tenant, nextUrl);
            await social.syncSocialProfile(tenant, latest, {
              fetch: async () => new Response(html('Nova')),
            });
            release.resolve();
            assert.equal(await pending, null);
            const saved = await current(tenant);
            assert.equal(saved.name, 'Nova');
            assert.equal(saved.readId, latest.readId);
          } finally {
            release.resolve();
            await pending;
          }
        },
      );

    await t.test(
      'remoção invalida a leitura e um clear atrasado preserva a URL nova',
      async () => {
        const tenant = await fixture();
        const old = await mark(tenant, urlA);
        const entered = deferred(),
          release = deferred();
        const pending = social.syncSocialProfile(tenant, old, {
          fetch: async () => {
            entered.resolve();
            await release.promise;
            return new Response(html('Antiga'));
          },
        });
        await entered.promise;
        try {
          await setUrl(tenant.id, '');
          await social.clearSocialProfile(tenant.id);
          release.resolve();
          assert.equal(await pending, null);
          assert.equal(await current(tenant), undefined);
          await setUrl(tenant.id, urlB);
          const latest = await mark(tenant, urlB);
          await social.clearSocialProfile(tenant.id);
          assert.equal((await current(tenant)).readId, latest.readId);
        } finally {
          release.resolve();
          await pending;
        }
      },
    );

    await t.test(
      'avatar igual é reutilizado sem novo Blob ou chamada de visão',
      async () => {
        const tenant = await fixture();
        const first = await social.syncSocialProfile(
          tenant,
          await mark(tenant, urlA),
          imageDeps,
        );
        const count = files.size;
        const second = await social.syncSocialProfile(
          tenant,
          await mark(tenant, urlA),
          {
            ...imageDeps,
            describe: () => {
              assert.fail('A visão não deve repetir');
            },
          },
        );
        assert.equal(second.avatarUrl, first.avatarUrl);
        assert.equal(files.size, count);
        await setUrl(tenant.id, '');
        await social.clearSocialProfile(tenant.id);
        assert.equal(files.has(first.avatarUrl), false);
      },
    );

    await t.test(
      'resposta descartada depois do upload remove só o próprio avatar',
      async () => {
        const tenant = await fixture();
        const entered = deferred(),
          release = deferred();
        const pending = social.syncSocialProfile(
          tenant,
          await mark(tenant, urlA),
          {
            ...imageDeps,
            describe: async () => {
              entered.resolve();
              await release.promise;
              return 'Antigo';
            },
          },
        );
        await entered.promise;
        try {
          await setUrl(tenant.id, urlB);
          const latest = await social.syncSocialProfile(
            tenant,
            await mark(tenant, urlB),
            imageDeps,
          );
          release.resolve();
          assert.equal(await pending, null);
          const owned = [...files].filter(([, path]) =>
            path.startsWith(`tenants/${tenant.slug}/`),
          );
          assert.deepEqual(
            owned.map(([url]) => url),
            [latest.avatarUrl],
          );
          assert.equal((await current(tenant)).avatarUrl, latest.avatarUrl);
        } finally {
          release.resolve();
          await pending;
        }
      },
    );

    await t.test(
      'exclusão aguarda put em andamento e limpa o arquivo antes de concluir',
      async () => {
        const tenant = await fixture();
        const entered = deferred(),
          release = deferred();
        hooks.put = async () => {
          entered.resolve();
          await release.promise;
        };
        const upload = blobFiles.putTenantBlob(
          tenant.id,
          'media/fixture.png',
          png,
          { access: 'public' },
        );
        await entered.promise;
        let completed = false;
        const deletion = remove(tenant).then((value) => {
          completed = true;
          return value;
        });
        try {
          await waitLocked('FOR UPDATE');
          assert.equal(completed, false);
          delete hooks.put;
          release.resolve();
          const blob = await upload;
          assert.equal((await deletion).ok, true);
          assert.equal(files.has(blob.url), false);
          assert.equal(await queries.getTenantBySlug(tenant.slug), null);
        } finally {
          delete hooks.put;
          release.resolve();
          await Promise.allSettled([upload, deletion]);
        }
      },
    );

    await t.test(
      'upload que chega durante a exclusão é recusado; outro tenant continua',
      async () => {
        const tenant = await fixture(),
          other = await fixture();
        const entered = deferred(),
          release = deferred();
        hooks.list = async (prefix) => {
          if (prefix.includes(tenant.slug)) {
            entered.resolve();
            await release.promise;
          }
        };
        const deletion = remove(tenant);
        await entered.promise;
        const upload = blobFiles.putTenantBlob(
          tenant.id,
          'media/tardio.png',
          png,
          { access: 'public' },
        );
        const rejected = assert.rejects(
          upload,
          /Cliente não encontrado ou já excluído/,
        );
        try {
          await waitLocked('FOR KEY SHARE');
          const unrelated = await blobFiles.putTenantBlob(
            other.id,
            'media/fixture.png',
            png,
            { access: 'public' },
          );
          assert.ok(files.has(unrelated.url));
          release.resolve();
          assert.equal((await deletion).ok, true);
          await rejected;
          assert.equal(
            [...files.values()].some((path) =>
              path.startsWith(`tenants/${tenant.slug}/`),
            ),
            false,
          );
        } finally {
          delete hooks.list;
          release.resolve();
          await Promise.allSettled([deletion, rejected]);
        }
      },
    );

    await t.test(
      'falha no Blob preserva cadastro e libera o lock para repetição',
      async () => {
        const tenant = await fixture();
        await blobFiles.putTenantBlob(tenant.id, 'media/fixture.png', png, {
          access: 'public',
        });
        hooks.del = () => {
          throw new Error('Falha simulada');
        };
        try {
          assert.equal((await remove(tenant)).ok, false);
          assert.ok(await queries.getTenantBySlug(tenant.slug));
        } finally {
          delete hooks.del;
        }
        assert.equal((await remove(tenant)).ok, true);
      },
    );

    await t.test(
      'confirmação é conferida no estado atual, dentro do lock',
      async () => {
        const tenant = await fixture();
        await database.query(
          "UPDATE tenants SET status = 'published' WHERE id = $1",
          [tenant.id],
        );
        assert.equal((await remove(tenant)).ok, false);
        assert.ok(await queries.getTenantBySlug(tenant.slug));
        assert.equal((await remove(tenant, tenant.slug)).ok, true);
      },
    );
  },
);
