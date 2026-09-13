import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import {
  recognitionFixture,
  recognitionOperations,
} from '../helpers/recognition-fixture.mjs';

await test(
  'ajuste de reconhecimento preserva estrutura e remove a moldura herdada no CSS de produção',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const j = createJiti(import.meta.url, {
      alias: { '@': process.cwd() },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { RenderBlocks } = await j.import('../../lib/blocks/render.tsx');
    const { themeVars } = await j.import('../../lib/blocks/theme.ts');
    const { pageRevision } = await j.import('../../lib/ai/page-edits.ts');
    const sheets = await Promise.all(
      (await readdir('.next/static/chunks'))
        .filter((name) => name.endsWith('.css'))
        .map((name) => readFile(`.next/static/chunks/${name}`, 'utf8')),
    );
    const css = sheets
      .filter((sheet) => sheet.includes('.site-theme'))
      .join('\n');
    assert.ok(
      css.includes('data-image-frame'),
      'Execute build:vercel com os controles novos antes do teste.',
    );
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    await mkdir('outputs/faithful-edits', { recursive: true });
    try {
      const tab = await browser.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      await tab.setRequestInterception(true);
      tab.on('request', (request) => {
        const banner = request.url().includes('recognition.svg');
        if (request.url().startsWith('https://assets.test/'))
          void request.respond({
            status: 200,
            contentType: 'image/svg+xml',
            body: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${banner ? 500 : 800}" viewBox="0 0 1200 ${banner ? 500 : 800}"><rect width="1200" height="100%" fill="${banner ? '#e4dfd2' : '#d4ddd3'}"/><rect x="30" y="30" width="1140" height="${banner ? 440 : 740}" rx="0" fill="none" stroke="#687969" stroke-width="2"/><text x="70" y="${banner ? 230 : 350}" font-family="sans-serif" font-size="52" fill="#17382d">${banner ? 'IMAGEM DO RECONHECIMENTO' : 'PRODUTO PRESERVADO'}</text><text x="70" y="${banner ? 300 : 420}" font-family="sans-serif" font-size="28" fill="#365447">Fixture local para conferir proporção e moldura</text></svg>`,
          });
        else void request.abort();
      });
      const measure = () =>
        tab.evaluate(() => {
          const root = document.querySelector('[data-block-id="recognition"]');
          const section = root.querySelector('.site-signature');
          const figure = root.querySelector('.site-signature-media');
          const image = figure.querySelector('img');
          const box = figure.parentElement;
          const styles = (element) => {
            const s = getComputedStyle(element),
              r = element.getBoundingClientRect();
            return {
              width: r.width,
              height: r.height,
              top: r.top,
              background: s.backgroundColor,
              border: s.borderTopWidth,
              padding: s.paddingTop,
              margin: s.marginTop,
            };
          };
          return {
            root: styles(root),
            section: styles(section),
            box: styles(box),
            figure: styles(figure),
            image: styles(image),
            other: styles(
              root.querySelectorAll('.site-signature-media img')[1],
            ),
            imageText: root.textContent,
            order: [...document.querySelectorAll('[data-block-id]')].map(
              (element) => element.dataset.blockId,
            ),
            layout: section.className,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
      const loadImages = () =>
        tab.evaluate(async () => {
          await Promise.all(
            [...document.images].map(async (image) => {
              image.loading = 'eager';
              await image.decode();
            }),
          );
        });
      const measurements = [];
      for (const layout of [
        'editorial-spread',
        'service-lens',
        'proof-route',
        'decision-path',
      ]) {
        const f = await recognitionFixture(layout);
        const original = structuredClone(f.pages[0].blocks);
        const result = await f.tools.edit_page.execute({
          page: '',
          revision: pageRevision(f.pages[0]),
          operations: recognitionOperations,
        });
        assert.equal(result.ok, true, JSON.stringify(result));
        const html = (blocks) =>
          `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body>${renderToStaticMarkup(createElement('div', { className: 'site-theme', 'data-imagery': 'framed', style: themeVars(f.tenant.brand) }, createElement(RenderBlocks, { blocks, ctx: { tenant: f.tenant, pagePath: '/', isPreview: true } })))}</body></html>`;
        for (const width of [1440, 390, 320]) {
          await tab.setViewport({ width, height: 900 });
          await tab.setContent(html(original), { waitUntil: 'load' });
          await loadImages();
          const before = await measure();
          assert.ok(
            parseFloat(before.image.padding) > 0,
            'A fixture precisa reproduzir a moldura global.',
          );
          if (layout === 'editorial-spread' && width !== 320)
            await tab.screenshot({
              path: `outputs/faithful-edits/before-${width}.png`,
              fullPage: true,
            });
          await tab.setContent(html(f.pages[0].blocks), { waitUntil: 'load' });
          await loadImages();
          const after = await measure();
          assert.equal(after.overflow, false, `${layout} ${width}`);
          assert.deepEqual(after.order, before.order);
          assert.equal(after.layout, before.layout);
          assert.equal(after.imageText, before.imageText);
          assert.equal(after.root.background, 'rgba(0, 0, 0, 0)');
          assert.equal(after.section.padding, '0px');
          assert.equal(after.section.border, '0px');
          for (const key of ['box', 'figure', 'image']) {
            assert.equal(
              after[key].background,
              'rgba(0, 0, 0, 0)',
              `${layout} ${width}: ${key}`,
            );
            assert.equal(after[key].border, '0px');
            assert.equal(after[key].padding, '0px');
            assert.equal(after[key].margin, '0px');
          }
          assert.ok(Math.abs(after.image.width - after.figure.width) < 1);
          assert.ok(
            Math.abs(after.image.width / after.image.height - 2.4) < 0.01,
            JSON.stringify(after.image),
          );
          for (const key of [
            'width',
            'height',
            'background',
            'border',
            'padding',
          ])
            assert.equal(
              after.other[key],
              before.other[key],
              `Outra imagem mudou: ${layout} ${width} ${key}`,
            );
          if (layout === 'editorial-spread' && width !== 320)
            await tab.screenshot({
              path: `outputs/faithful-edits/after-${width}.png`,
              fullPage: true,
            });
          measurements.push({ layout, width, after });
        }
      }
      assert.deepEqual(errors, []);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        'outputs/faithful-edits/measurements.json',
        JSON.stringify(measurements, null, 2),
      );
    } finally {
      await browser.close();
    }
  },
);
