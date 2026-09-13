import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import {
  landingFrameFixture,
  landingFrameOperations,
} from '../helpers/landing-frame-fixture.mjs';

await test(
  'retirar o container mantém a abertura e remove ambas as molduras em desktop e celular',
  {
    skip: !process.env.EIXU_CHROME_PATH,
  },
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
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    await mkdir('outputs/landing-frame', { recursive: true });
    const measurements = [];
    try {
      const tab = await browser.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      await tab.setRequestInterception(true);
      tab.on('request', (request) => {
        if (!request.url().startsWith('https://assets.test/'))
          return void request.abort();
        const hero = request.url().includes('landing-1.svg');
        void request.respond({
          status: 200,
          contentType: 'image/svg+xml',
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${hero ? 500 : 900}"><rect width="1200" height="100%" fill="${hero ? '#dfceb7' : '#c6d9cb'}"/><path d="M120 170h480v40H120zM145 210h28v165h-28zM555 210h28v165h-28z" fill="#775f41"/><text x="650" y="220" font-family="sans-serif" font-size="52" fill="#193a28">${hero ? 'Linha Clara' : 'Outra imagem'}</text><text x="650" y="285" font-family="sans-serif" font-size="28" fill="#193a28">${hero ? 'Mesa de madeira sob medida' : 'Preservada na edição'}</text></svg>`,
        });
      });
      const load = async (html) => {
        await tab.setContent(html, { waitUntil: 'load' });
        await tab.evaluate(async () => {
          await Promise.all(
            [...document.images].map(async (image) => {
              image.loading = 'eager';
              await image.decode();
            }),
          );
        });
      };
      const measure = () =>
        tab.evaluate(() => {
          const hero = document.querySelector('[data-block-id="hero"]');
          const image = hero.querySelector('img');
          const figure = hero.querySelector('.site-landing-product');
          const styles = (node) => {
            if (!node) return null;
            const s = getComputedStyle(node),
              r = node.getBoundingClientRect();
            return {
              width: r.width,
              height: r.height,
              background: s.backgroundColor,
              border: s.borderTopWidth,
              radius: s.borderTopLeftRadius,
              padding: s.paddingTop,
              shadow: s.boxShadow,
            };
          };
          return {
            figure: styles(figure),
            image: styles(image),
            copy: styles(hero.querySelector('.site-landing-hero-copy')),
            formPanel: styles(hero.querySelector('.site-landing-form-panel')),
            text: hero.textContent,
            controls: [...hero.querySelectorAll('a, input, button')].map(
              (node) => [
                node.tagName,
                node.getAttribute('href'),
                node.getAttribute('name'),
                node.textContent,
              ],
            ),
            others: [...document.images]
              .filter((node) => !hero.contains(node))
              .map(styles),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
      for (const layout of ['stage', 'form']) {
        const f = await landingFrameFixture(layout);
        const original = structuredClone(f.pages[0].blocks);
        const result = await f.tools.edit_page.execute({
          page: '',
          revision: pageRevision(f.pages[0]),
          operations: landingFrameOperations,
        });
        assert.equal(result.ok, true, JSON.stringify(result));
        const html = (blocks) =>
          `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body>${renderToStaticMarkup(
            createElement(
              'div',
              {
                className: 'site-theme',
                style: themeVars(f.tenant.brand),
                'data-vibe': 'landing',
                'data-design-version': 7,
                'data-profile-version': 7,
                'data-imagery': f.tenant.brand.design.imageTreatment,
                'data-surface': f.tenant.brand.design.surfaceStyle,
                'data-hero': layout,
                'data-motion': 'still',
              },
              createElement(RenderBlocks, {
                blocks,
                ctx: { tenant: f.tenant, pagePath: '/', isPreview: true },
              }),
            ),
          )}</body></html>`;
        for (const width of [1440, 390, 320]) {
          await tab.setViewport({ width, height: 900 });
          await load(html(original));
          const before = await measure();
          assert.ok(
            parseFloat(before.image.border) > 0,
            'A fixture precisa da moldura global.',
          );
          if (layout === 'stage') {
            assert.ok(
              parseFloat(before.figure.border) > 0,
              'A fixture precisa da segunda borda.',
            );
            if (width === 1440) {
              await tab.$eval('.site-landing-product', (node) =>
                node.scrollIntoView(),
              );
              await (
                await tab.$('.site-landing-product')
              ).screenshot({
                path: 'outputs/landing-frame/model-attachment.png',
              });
            }
          }
          if (layout === 'stage' && width !== 320)
            await (
              await tab.$('[data-block-id="hero"]')
            ).screenshot({ path: `outputs/landing-frame/before-${width}.png` });
          await load(html(f.pages[0].blocks));
          const after = await measure();
          assert.equal(after.overflow, false, `${layout} ${width}`);
          for (const key of ['text', 'controls', 'others', 'formPanel'])
            assert.deepEqual(
              after[key],
              before[key],
              `${layout} ${width}: ${key}`,
            );
          if (layout === 'stage') assert.deepEqual(after.copy, before.copy);
          for (const box of [after.figure, after.image].filter(Boolean)) {
            assert.equal(box.border, '0px');
            assert.equal(box.radius, '0px');
            assert.equal(box.background, 'rgba(0, 0, 0, 0)');
            assert.equal(box.padding, '0px');
            assert.equal(box.shadow, 'none');
          }
          assert.ok(
            Math.abs(after.image.width / after.image.height - 2.4) < 0.01,
          );
          if (layout === 'stage') {
            assert.ok(Math.abs(after.image.width - after.figure.width) < 1);
            assert.ok(Math.abs(after.image.height - after.figure.height) < 1);
            if (width !== 320)
              await (
                await tab.$('[data-block-id="hero"]')
              ).screenshot({
                path: `outputs/landing-frame/after-${width}.png`,
              });
          }
          measurements.push({ layout, width, before, after });
        }
      }
      assert.deepEqual(errors, []);
      await writeFile(
        'outputs/landing-frame/measurements.json',
        JSON.stringify(measurements, null, 2),
      );
    } finally {
      await browser.close();
    }
  },
);
