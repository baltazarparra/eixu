import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { handoffFixture } from '../helpers/admin-handoff-fixture.mjs';
import { loadModule } from '../helpers/load-module.mjs';

await test(
  'acervo: seleção múltipla, upload real até os adaptadores, falha parcial, recarga e uso no chat',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'eixu-upload-'));
    let seq = 0;
    let failUpload = false;
    const stored = [];
    const { UploadError } = await loadModule('lib/blob/tenant-files.ts');
    const { uploadLibraryImage } = await loadModule('lib/images/upload.ts', {
      '@vercel/blob': { del: async () => {} },
      '@/lib/blob/tenant-files': {
        UploadError,
        putTenantBlob: async (tenantId, pathname, bytes) => {
          assert.equal(tenantId, 'tenant-a');
          if (failUpload) throw new Error('Blob indisponível');
          stored.push(pathname);
          return {
            url: `data:image/webp;base64,${bytes.toString('base64')}`,
            pathname: `tenants/marcenaria-horizonte/${pathname}`,
          };
        },
      },
      '@/lib/images/queries': {
        insertImage: async (input) => {
          const image = {
            ...input,
            id: `uploaded-${++seq}`,
            seq,
            status: 'disponivel',
            score: null,
            critique: {},
            description: null,
            createdAt: new Date().toISOString(),
          };
          fixture.data.images.unshift(image);
          return image;
        },
      },
    });
    const { POST } = await loadModule(
      'app/api/admin/[tenant]/images/route.ts',
      {
        '@/lib/auth': { isAuthenticated: async () => true },
        '@/lib/tenant-queries': {
          getTenantBySlug: async (slug) =>
            slug === 'marcenaria-horizonte' ? { id: 'tenant-a' } : null,
        },
        '@/lib/images/upload': { uploadLibraryImage },
        '@/lib/blob/tenant-files': { UploadError },
      },
    );
    const fixture = await handoffFixture({
      imageUpload: (request) =>
        POST(request, {
          params: Promise.resolve({ tenant: 'marcenaria-horizonte' }),
        }),
    });
    fixture.data.images = [];
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    t.after(async () => {
      await browser.close();
      await fixture.server.close();
      await rm(folder, { recursive: true, force: true });
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const file = path.join(folder, 'Foto_da_oficina.png');
    const invalid = path.join(folder, 'Corrompida.png');
    await writeFile(
      file,
      await sharp({
        create: { width: 300, height: 200, channels: 3, background: '#867858' },
      })
        .png()
        .toBuffer(),
    );
    await writeFile(invalid, 'Não é uma imagem');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${fixture.base}/admin/marcenaria-horizonte/imagens`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('input[type=file]');
    assert.match(
      await page.$eval('main', (node) => node.textContent),
      /O acervo ainda está vazio/,
    );
    await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((node) => node.textContent === 'Enviar imagens')
        .focus(),
    );
    const [chooser] = await Promise.all([
      page.waitForFileChooser(),
      page.keyboard.press('Enter'),
    ]);
    assert.equal(chooser.isMultiple(), true);
    await chooser.accept([invalid, file]);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role=alert]')
          ?.textContent.includes('Corrompida.png') &&
        document.querySelector('.admin-image-card'),
    );
    assert.equal(
      await page.$$('.admin-image-card').then((nodes) => nodes.length),
      1,
    );
    assert.match(
      await page.$eval('.admin-image-card', (node) => node.textContent),
      /foto · enviada/,
    );
    assert.match(
      await page.$eval('.admin-image-card', (node) => node.textContent),
      /3:2/,
    );
    const imageLink = await page.$eval('.admin-image-actions a', (node) =>
      node.getAttribute('href'),
    );
    assert.match(decodeURIComponent(imageLink), /imagem #1/);
    assert.match(decodeURIComponent(imageLink), /pedido=/);
    await page.waitForFunction(
      () => document.querySelector('.admin-image').naturalWidth === 300,
    );
    assert.equal(stored.length, 1);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-image-card');
    assert.match(
      await page.$eval('.admin-image-card', (node) => node.textContent),
      /#1/,
    );
    failUpload = true;
    await (await page.$('input[type=file]')).uploadFile(file);
    await page.waitForFunction(() =>
      document
        .querySelector('[role=alert]')
        ?.textContent.includes('Não foi possível salvar'),
    );
    assert.equal(
      await page.$$('.admin-image-card').then((nodes) => nodes.length),
      1,
    );
    failUpload = false;
    await (await page.$('input[type=file]')).uploadFile(file);
    await page.waitForFunction(
      () => document.querySelectorAll('.admin-image-card').length === 2,
    );
    await page.waitForFunction(
      () => !document.querySelector('input[type=file]').disabled,
    );
    await mkdir('outputs/image-upload', { recursive: true });
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 568],
      [667, 375],
    ]) {
      await page.setViewport({
        width,
        height,
        isMobile: width < 700,
        hasTouch: width < 700,
      });
      assert.equal(
        await page.evaluate(() => innerWidth),
        width,
        'viewport real do celular',
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
        `sem overflow em ${width}x${height}`,
      );
      const button = await page.evaluate(() => {
        const node = [...document.querySelectorAll('button')].find(
          (node) => node.textContent === 'Enviar imagens',
        );
        const box = node.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          disabled: node.disabled,
        };
      });
      assert.ok(
        button.width >= 44 && button.height >= 44,
        'upload acessível por toque',
      );
      assert.equal(button.disabled, false);
      await page.screenshot({
        path: `outputs/image-upload/${width}x${height}.png`,
        fullPage: true,
      });
      await page.$eval('.admin-image-collection', (node) =>
        node.scrollIntoView({ block: 'start' }),
      );
      assert.equal(
        await page.$$eval(
          '.admin-image-card, .admin-image-actions > *',
          (nodes) =>
            nodes.every((node) => {
              const box = node.getBoundingClientRect();
              return box.left >= 0 && box.right <= innerWidth;
            }),
        ),
        true,
        'cartões e atalhos cabem na tela',
      );
      await page.screenshot({
        path: `outputs/image-upload/${width}x${height}-collection.png`,
        fullPage: true,
      });
      await page.$eval('.admin-tenant-content', (node) => node.scrollTo(0, 0));
    }
    assert.deepEqual(errors, []);
  },
);
