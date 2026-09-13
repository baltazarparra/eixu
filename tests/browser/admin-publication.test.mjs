import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { createJiti } from 'jiti';
import { handoffFixture } from '../helpers/admin-handoff-fixture.mjs';
import { loadModule } from '../helpers/load-module.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { landingFixture } = await j.import('../helpers/landing-data.ts');
const { workspaceState } = await j.import('../../lib/admin/state.ts');

await test(
  'botão publica com prova pendente em desktop/mobile e preserva o gate técnico',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 90_000 },
  async () => {
    const f = landingFixture();
    f.tenant.brief = {
      ...f.tenant.brief,
      evidence: [],
      intake: { ...f.tenant.brief.intake, evidence: [] },
    };
    const writes = [];
    const sql = Object.assign(
      (parts, ...values) => ({ sql: parts.join('?'), values }),
      { transaction: async (batch) => writes.push(...batch) },
    );
    const { publishSite } = await loadModule('lib/sites/publish.ts', {
      '@/lib/db': { db: () => sql },
      '@/lib/tenant-queries': { listPages: async () => f.pages },
      '@/lib/images/queries': { listImages: async () => f.images },
      '@/lib/design/uniqueness': {
        compositionConflict: async () => null,
        compositionConflictMessage: () => '',
      },
    });
    const { POST } = await loadModule(
      'app/api/admin/[tenant]/publish/route.ts',
      {
        '@/lib/auth': { isAuthenticated: async () => true },
        '@/lib/tenant-queries': {
          getTenantBySlug: async (slug) =>
            slug === f.tenant.slug ? f.tenant : null,
        },
        '@/lib/sites/publish': { publishSite },
      },
    );
    const fixture = await handoffFixture({
      publish: (request) =>
        POST(request, { params: Promise.resolve({ tenant: f.tenant.slug }) }),
    });
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      fixture.data.site = workspaceState(f.tenant, f.pages, f.images);
      const beforeBrief = structuredClone(f.tenant.brief);
      const beforeBlocks = structuredClone(
        f.pages.map((entry) => entry.blocks),
      );
      await mkdir('outputs/publication/browser', { recursive: true });
      for (const [width, height] of [
        [1440, 1000],
        [390, 844],
      ]) {
        await page.setViewport({
          width,
          height,
          isMobile: width < 500,
          hasTouch: width < 500,
        });
        await page.goto(`${fixture.base}/admin/${fixture.data.tenant.slug}`, {
          waitUntil: 'networkidle0',
        });
        await page.waitForSelector('.admin-bar-decide .admin-primary');
        assert.equal(
          await page.$eval(
            '.admin-bar-decide .admin-primary',
            (node) => node.disabled,
          ),
          false,
        );
        const published = page.waitForResponse((response) =>
          response.url().endsWith('/publish'),
        );
        await page.click('.admin-bar-decide .admin-primary');
        const result = await (await published).json();
        assert.equal(result.blocked.length, 0);
        assert.equal(result.published.length, 2);
        assert.ok(
          result.warnings.some((finding) => finding.rule === 'landing-prova'),
        );
        await page.waitForFunction(() =>
          document
            .querySelector('.admin-notice')
            ?.textContent.includes('Publicado.'),
        );
        await page.screenshot({
          path: `outputs/publication/browser/${width}.png`,
          fullPage: true,
        });
      }
      assert.equal(
        writes.length,
        6,
        'dois snapshots de página e tenant por publicação',
      );
      assert.deepEqual(f.tenant.brief, beforeBrief);
      assert.deepEqual(
        f.pages.map((entry) => entry.blocks),
        beforeBlocks,
      );
      f.pages[0].blocks[0].props.desconhecido = true;
      fixture.data.site = workspaceState(f.tenant, f.pages, f.images);
      await page.reload({ waitUntil: 'networkidle0' });
      assert.equal(
        await page.$eval(
          '.admin-bar-decide .admin-primary',
          (node) => node.disabled,
        ),
        true,
      );
      const blocked = await POST(
        new Request('https://fixture.test/publish', {
          method: 'POST',
          body: '{}',
        }),
        { params: Promise.resolve({ tenant: f.tenant.slug }) },
      );
      assert.equal((await blocked.json()).published.length, 0);
      assert.equal(writes.length, 6, 'a recusa técnica não escreve snapshots');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await fixture.server.close();
    }
  },
);
