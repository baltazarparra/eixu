import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import { pageEditFixture } from '../helpers/page-edit-fixture.mjs';

await test(
  'edições aparecem na ordem e na cor pedidas em desktop e celular',
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
    const directory = '.next/static/chunks';
    const sheets = await Promise.all(
      (await readdir(directory))
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(`${directory}/${file}`, 'utf8')),
    );
    const css = sheets
      .filter(
        (sheet) =>
          sheet.includes('.site-theme') ||
          sheet.includes('.site-location-title'),
      )
      .join('\n');
    assert.ok(
      css.includes('data-tone'),
      'Execute build:vercel antes do teste.',
    );
    const f = await pageEditFixture();
    const result = await f.tools.edit_page.execute({
      page: '',
      revision: pageRevision(f.pages[0]),
      operations: [
        {
          op: 'replace_text',
          from: 'Escolha com calma.',
          to: 'Compare os acabamentos.',
        },
        ...['intro', 'cta', 'footer'].map((block) => ({
          op: 'set',
          block,
          path: 'presentation.background',
          value: '#173f54',
        })),
        {
          op: 'insert',
          block: {
            type: 'editorial.text',
            props: {
              title: 'Depois do rodapé',
              body: 'Esta seção precisa aparecer depois do rodapé, como foi solicitado na conversa.',
            },
          },
          position: { relation: 'after', block: 'footer' },
        },
      ],
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const tab = await browser.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      await tab.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      await mkdir('outputs/page-edits/browser', { recursive: true });
      for (const vibe of ['comercial', 'artistico', 'moderno']) {
        const tenant = { ...f.tenant, brand: { ...f.tenant.brand, vibe } };
        const markup = renderToStaticMarkup(
          createElement(
            'div',
            {
              className: 'site-theme',
              'data-vibe': vibe,
              style: themeVars(tenant.brand),
            },
            createElement(RenderBlocks, {
              blocks: f.pages[0].blocks,
              ctx: {
                tenant,
                pagePath: '/',
                pageType: 'page',
                isPreview: true,
                previewTenant: tenant.slug,
              },
            }),
          ),
        );
        for (const width of [1440, 390, 320]) {
          await tab.setViewport({ width, height: 900 });
          await tab.setContent(
            `<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}${css}</style></head><body>${markup}</body></html>`,
          );
          const measured = await tab.evaluate(() => {
            const block = (id) =>
              document.querySelector(`[data-block-id="${id}"]`);
            const order = [...document.querySelectorAll('[data-block-id]')].map(
              (el) => el.getAttribute('data-block-id'),
            );
            return {
              order,
              main: document.querySelectorAll('main').length,
              afterFooter:
                block(order.at(-1)).getBoundingClientRect().top >=
                block('footer').getBoundingClientRect().bottom,
              mainBeforeFooter: !document
                .querySelector('main')
                .contains(block('footer')),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              copy: block('intro').textContent,
              colors: ['intro', 'cta', 'footer'].map((id) => {
                const wrapper = block(id);
                const child = wrapper.firstElementChild;
                return {
                  background: getComputedStyle(wrapper).backgroundColor,
                  paper: getComputedStyle(child)
                    .getPropertyValue('--paper')
                    .trim(),
                  color: getComputedStyle(child).color,
                };
              }),
            };
          });
          assert.deepEqual(
            measured.order,
            f.pages[0].blocks.map((b) => b.id),
          );
          assert.equal(measured.main, 1);
          assert.equal(measured.afterFooter, true);
          assert.equal(measured.mainBeforeFooter, true);
          assert.equal(measured.overflow, false, `${vibe} ${width}`);
          assert.match(measured.copy, /Compare os acabamentos/);
          for (const color of measured.colors) {
            assert.equal(color.background, 'rgb(23, 63, 84)');
            assert.equal(color.paper, '#173f54');
            assert.equal(color.color, 'rgb(255, 255, 255)');
          }
          if (vibe === 'comercial' && width !== 320)
            await tab.screenshot({
              path: `outputs/page-edits/browser/edits-${width}.png`,
              fullPage: true,
            });
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
