import { mockLogoAssets, logoAssetFor } from './helpers/logo-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createJiti } from 'jiti';
import { localPostgres } from './helpers/local-postgres.mjs';
import { loadModule } from './helpers/load-module.mjs';
import { direction } from './helpers/reference-fixture.mjs';

await test(
  'aplicação, escolha manual e ajustes concorrentes do logo com SQL real',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL, timeout: 60000 },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const other = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const id = randomUUID();
    const foreignId = randomUUID();
    t.after(async () => {
      try {
        await database.query('delete from tenants where id = any($1)', [
          [id, foreignId],
        ]);
      } finally {
        await other.close();
        await database.close();
      }
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    const original = 'https://blob.test/original.png';
    const replacement = 'https://blob.test/novo.png';
    const manual = 'https://blob.test/manual.png';
    const oldBrand = {
      vibe: 'comercial',
      paper: '#ffffff',
      ink: '#14161a',
      logoUrl: original,
      logoDarkUrl: 'https://blob.test/original-branca.png',
      logoFit: { source: original },
      logoAsset: logoAssetFor(original),
      logoDarkAsset: logoAssetFor('https://blob.test/original-branca.png'),
    };
    for (const tenantId of [id, foreignId])
      await database.query(
        'insert into tenants (id, slug, name, brand, published_snapshot) values ($1, $2, $3, $4::jsonb, $5::jsonb)',
        [
          tenantId,
          tenantId,
          'Fixture',
          JSON.stringify(oldBrand),
          JSON.stringify({ brand: oldBrand }),
        ],
      );
    const queries = await loadModule('lib/tenant-queries.ts', {
      '@/lib/db': database,
    });
    const manualQueries = await loadModule('lib/tenant-queries.ts', {
      '@/lib/db': other,
    });
    const current = () => queries.getTenantBySlug(id);
    const { tenantDraftSnapshot } = await loadModule('lib/sites/snapshot.ts');
    const scheduled = [];
    let inserted = 0;
    let critic = async () => ({ aprovado: true });
    const png = await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect x="40" y="40" width="120" height="40" fill="#111111"/></svg>',
      ),
    )
      .png()
      .toBuffer();
    const application = await loadModule('lib/images/logo-apply.ts', {
      'next/server': { after: (callback) => scheduled.push(callback) },
      '@/lib/tenant-queries': queries,
      '@/lib/images/logo': {
        fetchReferenceRaw: async () => ({
          bytes: png,
          contentType: 'image/png',
        }),
      },
      '@/lib/images/logo-asset': mockLogoAssets(),
      '@/lib/blob/tenant-files': {
        putTenantBlob: async (_tenantId, pathname) => ({
          url: `https://blob.test/${pathname}`,
          pathname,
        }),
      },
      '@/lib/images/queries': {
        insertImage: async () => ({ id: `derived-${++inserted}` }),
      },
      '@/lib/images/logo-critic': { critiqueLogo: async () => critic() },
    });
    const { buildTools } = await loadModule('lib/ai/tools.ts', {
      '@/lib/db': database,
      '@/lib/tenant-queries': queries,
      '@/lib/images/logo-apply': application,
      '@/lib/images/queries': {
        getImageByNumber: async () => ({
          seq: 2,
          kind: 'logo',
          status: 'disponivel',
          url: replacement,
        }),
      },
      // Confere a marca entregue ao publicador; os gates e a transação de
      // publicação são exercitados em admin-publish e admin-generation-db.
      '@/lib/sites/publish': {
        publishSite: async (tenant) => tenantDraftSnapshot(tenant),
      },
    });

    await t.test(
      'troca limpa derivados anteriores no banco e no mesmo chat',
      async () => {
        const tools = buildTools(await current(), {
          lastUserText: 'volta para a #2 e publique',
        });
        const applied = await tools.set_site_logo.execute({ image: '#2' });
        assert.equal(applied.ok, true, JSON.stringify(applied));
        for (const brand of [
          (await current()).brand,
          (await tools.publish_site.execute({})).brand,
        ]) {
          assert.equal(brand.logoUrl, replacement);
          assert.equal(brand.logoFit, undefined);
          assert.equal(brand.logoAsset, undefined);
          assert.equal(brand.logoDarkAsset, undefined);
          assert.equal(brand.logoDarkUrl, undefined);
        }
        await tools.set_brand.execute({ accent: '#225588' });
        assert.equal((await current()).brand.logoDarkUrl, undefined);
        assert.equal((await current()).brand.accent, '#225588');
      },
    );

    await t.test(
      'escolha na mesma requisição invalida o callback ainda não iniciado',
      async () => {
        await manualQueries.setBrandLogoDark(id, manual);
        await scheduled.shift()();
        assert.equal(inserted, 0);
        assert.equal((await current()).brand.logoDarkUrl, manual);
      },
    );

    for (const choice of [manual, null])
      await t.test(
        `escolha manual ${choice ? 'de imagem' : 'de remoção'} durante a crítica prevalece`,
        async () => {
          // A troca garante uma derivação nova, sem fit/variante reaproveitados.
          await queries.setBrandLogo(id, original);
          await application.applyBrandLogo(await current(), replacement);
          let reachCritic;
          let releaseCritic;
          const reached = new Promise((resolve) => {
            reachCritic = resolve;
          });
          const released = new Promise((resolve) => {
            releaseCritic = resolve;
          });
          critic = async () => {
            reachCritic();
            await released;
            return { aprovado: true };
          };
          const worker = scheduled.shift()();
          try {
            await Promise.race([
              reached,
              worker.then(() => {
                throw new Error(
                  'A derivação terminou antes de chegar ao crítico.',
                );
              }),
            ]);
            await manualQueries.setBrandLogoDark(id, choice);
          } finally {
            releaseCritic();
            await worker;
          }
          assert.equal(
            (await current()).brand.logoDarkUrl,
            choice ?? undefined,
          );
          assert.equal((await current()).brand.logoFit.source, replacement);
        },
      );

    await t.test(
      'reaplicação preserva a escolha, mas invalida a versão anterior inclusive após A-B-A',
      async () => {
        const applied = await queries.setBrandLogo(id, replacement);
        await manualQueries.setBrandLogoDark(id, manual);
        const reapplied = await queries.setBrandLogo(id, replacement);
        assert.equal(reapplied.logoDarkUrl, manual);
        assert.equal(reapplied.logoFit.source, replacement);
        assert.notEqual(reapplied.logoRevision, applied.logoRevision);
        assert.equal(
          await queries.setBrandLogoDerived(
            id,
            replacement,
            { darkUrl: 'stale' },
            applied.logoRevision,
          ),
          false,
        );
        await queries.setBrandLogo(id, original);
        await queries.setBrandLogo(id, replacement);
        assert.equal(
          await queries.setBrandLogoDerived(
            id,
            replacement,
            { darkUrl: 'stale' },
            reapplied.logoRevision,
          ),
          false,
        );
        assert.equal((await current()).brand.logoDarkUrl, undefined);
      },
    );

    await t.test(
      'set_brand e set_design preservam escolhas mais recentes de outra conexão',
      async () => {
        const j = createJiti(import.meta.url, {
          alias: { '@': process.cwd() },
        });
        const { designProfileInputSchema } = await j.import(
          '../lib/design/profile.ts',
        );
        const designInput = designProfileInputSchema.parse({
          ...direction,
          structure: 'comercial-atendimento',
          displayFont: 'humanist',
          bodyFont: 'humanist',
          heroComposition: 'split',
          radius: 'md',
          density: 5,
        });
        for (const [toolName, input] of [
          ['set_brand', { accent: '#335577' }],
          ['set_design', designInput],
        ]) {
          const tools = buildTools(await current());
          await manualQueries.setBrandLogoDark(id, manual);
          const selected = (await current()).brand;
          await manualQueries.setBrandLogoDerived(
            id,
            selected.logoUrl,
            { asset: logoAssetFor(selected.logoUrl) },
            selected.logoRevision,
          );
          const before = (await current()).brand;
          const result = await tools[toolName].execute(input);
          assert.equal(result.error, undefined, JSON.stringify(result));
          const saved = (await current()).brand;
          assert.equal(saved.logoDarkUrl, manual);
          assert.equal(saved.logoRevision, before.logoRevision);
          assert.deepEqual(saved.logoAsset, before.logoAsset);
          assert.equal(
            (await tools.publish_site.execute({})).brand.logoDarkUrl,
            manual,
          );
        }
      },
    );

    await t.test(
      'derivação atual grava e ajustes de cor não apagam a variante que acabou de chegar',
      async () => {
        const tools = buildTools(await current());
        const applied = (await current()).brand;
        assert.equal(
          await manualQueries.setBrandLogoDerived(
            id,
            replacement,
            { darkUrl: 'https://blob.test/approved.png' },
            applied.logoRevision,
          ),
          true,
        );
        await tools.set_brand.execute({ accent: '#123456' });
        assert.equal(
          (await current()).brand.logoDarkUrl,
          'https://blob.test/approved.png',
        );
        assert.equal(
          (await tools.publish_site.execute({})).brand.logoDarkUrl,
          'https://blob.test/approved.png',
        );
      },
    );

    await t.test(
      'auto-aplicação é atômica e recusa A-B-A ou mudança manual da versão escura',
      async () => {
        const before = await queries.setBrandLogo(id, original);
        await manualQueries.setBrandLogoDark(id, manual);
        assert.equal(
          await queries.replaceBrandLogoIfSource(
            id,
            original,
            replacement,
            before.logoRevision,
          ),
          null,
        );
        const currentBrand = (await current()).brand;
        const applied = await queries.replaceBrandLogoIfSource(
          id,
          original,
          replacement,
          currentBrand.logoRevision,
        );
        assert.equal(applied.logoUrl, replacement);
        assert.equal(applied.logoAsset, undefined);
        assert.equal(applied.logoDarkAsset, undefined);
        assert.equal(
          await queries.replaceBrandLogoIfSource(id, original, replacement),
          null,
        );
      },
    );

    await t.test(
      'reserva do estúdio impede cobrança duplicada e um job antigo não conclui a nova reserva',
      async () => {
        const a = await loadModule('lib/images/logo-studio-queries.ts', {
          '@/lib/db': database,
        });
        const b = await loadModule('lib/images/logo-studio-queries.ts', {
          '@/lib/db': other,
        });
        await database.query(
          'update tenants set brief = $2::jsonb where id = $1',
          [
            id,
            JSON.stringify({
              intake: { offer: 'Fixture' },
              social: { status: 'done' },
            }),
          ],
        );
        const state = {
          status: 'running',
          sourceHash: 'aabbccddeeff',
          startedAt: new Date().toISOString(),
          proposals: [],
        };
        const claims = await Promise.all([
          a.claimLogoStudio(id, replacement, state),
          b.claimLogoStudio(id, replacement, state),
        ]);
        assert.equal(claims.filter(Boolean).length, 1);
        const newer = {
          ...state,
          sourceHash: 'bbccddeeff00',
          startedAt: new Date(Date.now() + 1).toISOString(),
        };
        assert.equal(await b.claimLogoStudio(id, replacement, newer), true);
        assert.equal(
          await a.finishLogoStudio(id, { ...state, status: 'done' }),
          false,
        );
        assert.equal(
          await b.finishLogoStudio(id, { ...newer, status: 'done' }),
          true,
        );
        const brief = (await current()).brief;
        assert.deepEqual(brief.intake, { offer: 'Fixture' });
        assert.deepEqual(brief.social, { status: 'done' });
        assert.equal(brief.logoStudio.sourceHash, newer.sourceHash);
        assert.equal(await a.claimLogoStudio(id, replacement, newer), false);
        const stale = {
          ...newer,
          status: 'running',
          startedAt: '2000-01-01T00:00:00.000Z',
        };
        await database.query(
          'update tenants set brief = brief || $2::jsonb where id = $1',
          [id, JSON.stringify({ logoStudio: stale })],
        );
        assert.equal(
          await a.claimLogoStudio(id, replacement, {
            ...newer,
            startedAt: new Date().toISOString(),
          }),
          true,
        );
        assert.equal(
          await a.claimLogoStudio(foreignId, replacement, state),
          false,
        );
      },
    );

    await t.test(
      'URLs aninhadas nos assets publicados impedem exclusão por correspondência exata',
      async () => {
        const images = await loadModule('lib/images/queries.ts', {
          '@/lib/db': database,
        });
        assert.equal(
          await images.referenceReason(id, oldBrand.logoAsset.nav.url),
          'logo',
        );
        assert.equal(
          await images.referenceReason(id, oldBrand.logoAsset.icon.png512),
          'logo',
        );
        assert.equal(
          await images.referenceReason(
            id,
            `${oldBrand.logoAsset.icon.png512}.other`,
          ),
          null,
        );
      },
    );

    // Escritas só no tenant alvo e no rascunho, sem tocar apresentação pública.
    assert.deepEqual(
      (await queries.getTenantBySlug(foreignId)).brand,
      oldBrand,
    );
    assert.deepEqual((await current()).publishedSnapshot, { brand: oldBrand });
    await queries.setBrandLogo(id, null);
    const removed = (await current()).brand;
    for (const key of [
      'logoUrl',
      'logoDarkUrl',
      'logoFit',
      'logoAsset',
      'logoDarkAsset',
    ])
      assert.equal(removed[key], undefined);
  },
);
