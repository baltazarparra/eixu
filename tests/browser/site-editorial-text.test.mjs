import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import {
  editorialFixture,
  editorialImageOperations,
} from '../helpers/editorial-text-fixture.mjs';

await test(
  'edição 50/50 e ligação institucional renderizam com CSS de produção em telas estreitas e largas',
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
    const { contrastRatio } = await j.import('../../lib/blocks/contrast.ts');
    const css = (
      await Promise.all(
        (
          await readdir('.next/static/chunks')
        )
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
      )
    )
      .filter((sheet) => sheet.includes('.site-theme'))
      .join('\n');
    assert.match(
      css,
      /site-text-bridge/,
      'Execute build:vercel antes do teste.',
    );
    const f = await editorialFixture();
    const result = await f.tools.edit_page.execute({
      page: '',
      revision: pageRevision(f.pages[0]),
      operations: editorialImageOperations,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    const original = f.pages[0].blocks.find((block) => block.id === 'intro');
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    await mkdir('outputs/editorial-text', { recursive: true });
    const hex = (rgb) =>
      '#' +
      rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map((v) => Number(v).toString(16).padStart(2, '0'))
        .join('');
    try {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().startsWith('https://assets.test/'))
          void request.respond({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ccd8d0"/><path d="M0 300L400 0l400 300v300H0Z" fill="#345846"/></svg>',
          });
        else void request.abort();
      });
      for (const vibe of [
        'comercial',
        'moderno',
        'ousado',
        'artistico',
        'landing',
      ]) {
        const tenant = { ...f.tenant, brand: { ...f.tenant.brand, vibe } };
        for (const layout of ['bridge', 'split']) {
          for (const side of layout === 'split'
            ? ['left', 'right']
            : ['left']) {
            const block = structuredClone(original);
            block.props.layout = layout;
            if (layout === 'bridge') {
              for (const key of ['image', 'imageAlt', 'imagePosition'])
                delete block.props[key];
            } else {
              block.props.imagePosition = side;
              block.props.imageFit = 'contain';
            }
            for (const [width, height] of [
              [1440, 900],
              [768, 900],
              [390, 844],
              [320, 640],
              [667, 375],
            ]) {
              await page.setViewport({ width, height });
              const vars = Object.entries(themeVars(tenant.brand))
                .map(([k, v]) => `${k}:${v}`)
                .join(';');
              const markup = renderToStaticMarkup(
                createElement(RenderBlocks, {
                  blocks: [block],
                  ctx: { tenant, pagePath: '/', editing: width === 320 },
                }),
              );
              await page.setContent(
                `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div class="site-theme" data-vibe="${vibe}" data-profile-version="8" data-motion="still" style="${vars}">${markup}</div></body></html>`,
                { waitUntil: 'load' },
              );
              const report = await page.evaluate(() => {
                const copy = document.querySelector('.site-text-copy');
                const media = document.querySelector(
                  '.site-text-media, .site-text-identity',
                );
                const title = document.querySelector('.site-text-identity h2');
                const box = (node) => node.getBoundingClientRect().toJSON();
                return {
                  copy: box(copy),
                  media: box(media),
                  text: document.querySelector('.site-text').textContent,
                  overflow: document.documentElement.scrollWidth > innerWidth,
                  image: document.querySelector('img')?.naturalWidth,
                  fit: document.querySelector('img')
                    ? getComputedStyle(document.querySelector('img')).objectFit
                    : null,
                  titleColor: title ? getComputedStyle(title).color : null,
                  panelColor: title
                    ? getComputedStyle(media).backgroundColor
                    : null,
                  titleSize: title
                    ? parseFloat(getComputedStyle(title).fontSize)
                    : null,
                  leadSize: title
                    ? parseFloat(
                        getComputedStyle(
                          document.querySelector('.site-text-lead-copy'),
                        ).fontSize,
                      )
                    : null,
                };
              });
              const label = `${vibe} ${layout} ${side} ${width}`;
              assert.equal(report.overflow, false, label);
              assert.match(report.text, /Rua da Praça, 100/);
              assert.match(report.text, /Os setores reúnem produtos/);
              if (width >= 768) {
                assert.ok(
                  Math.abs(report.copy.width - report.media.width) < 1,
                  label,
                );
                assert.equal(
                  report.media.left < report.copy.left,
                  side === 'left',
                  label,
                );
              } else {
                assert.ok(report.copy.top >= report.media.bottom - 1, label);
                assert.ok(
                  Math.abs(report.copy.left - report.media.left) < 1,
                  label,
                );
              }
              if (layout === 'split') {
                assert.ok(report.image > 0, label);
                assert.equal(report.fit, 'contain');
              } else {
                assert.ok(
                  report.leadSize > report.titleSize,
                  `${label}: endereço precisa de destaque próprio`,
                );
                assert.ok(
                  contrastRatio(
                    hex(report.titleColor),
                    hex(report.panelColor),
                  ) >= 4.5,
                  label,
                );
              }
              if (
                vibe === 'comercial' &&
                side === 'left' &&
                [1440, 390].includes(width)
              )
                await page.screenshot({
                  path: `outputs/editorial-text/${layout}-${width}.png`,
                  fullPage: true,
                });
            }
          }
        }
      }
    } finally {
      await browser.close();
    }
  },
);
