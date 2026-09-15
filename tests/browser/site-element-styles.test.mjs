import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';

const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { RenderBlocks } = await jiti.import('../../lib/blocks/render.tsx');
const { themeVars } = await jiti.import('../../lib/blocks/theme.ts');

const tenant = {
  id: 'element-styles',
  slug: 'element-styles',
  name: 'Ateliê',
  brand: { accent: '#193f47', ink: '#14161a', paper: '#ffffff' },
  brief: {},
  dials: { variance: 5, density: 5, motion: 1 },
  imageGuide: {},
  whatsapp: null,
};

const faq = {
  id: 'faq',
  type: 'faq.accordion',
  props: {
    title: 'Dúvidas sobre materiais',
    items: [
      {
        q: 'Como comparar?',
        a: 'Considere o uso do ambiente e os cuidados de cada material.',
      },
      {
        q: 'Como pedir amostras?',
        a: 'Converse com a equipe e escolha os acabamentos disponíveis.',
      },
      {
        q: 'Como decidir?',
        a: 'Compare as opções lado a lado antes da escolha.',
      },
    ],
    textStyles: [
      {
        field: 'title',
        fontSize: 42,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: -1,
        align: 'right',
      },
    ],
    presentation: {
      elements: [
        {
          target: 'list',
          viewport: 'desktop',
          columns: 2,
          gap: 20,
        },
        {
          target: 'list',
          viewport: 'mobile',
          columns: 1,
          gap: 12,
        },
        {
          target: 'item',
          index: 1,
          viewport: 'desktop',
          widthPercent: 70,
          marginInline: 'end',
          order: -1,
          radius: 18,
          shadow: 'soft',
        },
      ],
    },
  },
};

const hero = {
  id: 'hero',
  type: 'hero.split',
  props: {
    layout: 'editorial',
    headline: 'Materiais para cada ambiente',
    subtext: 'Escolhas cuidadosas para cada espaço do projeto.',
    cta: { label: 'Conferir opções', href: '/materiais' },
    image: 'https://assets.test/hero.webp',
    imageAlt: 'Bancada com amostras de materiais',
    presentation: {
      elements: [
        { target: 'section', minHeight: 100 },
        { target: 'container', maxWidth: 1200 },
        { target: 'content', gap: 24 },
        { target: 'heading', textAlign: 'right' },
        { target: 'body', textAlign: 'right' },
        { target: 'actions', gap: 10 },
        { target: 'media', radius: 20 },
        { target: 'image', radius: 18 },
        { target: 'action', radius: 14 },
      ],
    },
  },
};

const form = {
  id: 'form',
  type: 'form.lead',
  props: {
    title: 'Vamos conversar?',
    fields: [
      { name: 'nome', label: 'Seu nome', type: 'text', required: true },
      { name: 'email', label: 'E-mail', type: 'email', required: true },
    ],
    presentation: {
      elements: [
        { target: 'form', gap: 18 },
        { target: 'field', radius: 12 },
      ],
    },
  },
};

await test(
  'ajustes internos controlam grade, box e tipografia no CSS de produção',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const chunks = await readdir('.next/static/chunks');
    const css = (
      await Promise.all(
        chunks
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
      )
    )
      .filter((sheet) => sheet.includes('.site-theme'))
      .join('\n');
    assert.ok(css.includes('.site-faq'));
    const html = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body><div class="site-theme" data-variance="expressive" data-density="normal" data-motion="still" style="${Object.entries(
      themeVars(tenant.brand),
    )
      .map(([key, value]) => `${key}:${value}`)
      .join(';')}">${renderToStaticMarkup(
      createElement(RenderBlocks, {
        blocks: [hero, faq, form],
        ctx: { tenant, pagePath: '/' },
      }),
    )}</div></body></html>`;
    const server = createServer((_request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(html);
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await mkdir('outputs/element-styles', { recursive: true });
    try {
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 900 });
        await page.goto(`http://127.0.0.1:${server.address().port}`, {
          waitUntil: 'load',
        });
        const measured = await page.evaluate(() => {
          const list = document.querySelector('.site-faq-list');
          const second = list.children[1];
          const title = document.querySelector('.site-h2');
          const titleStyle = getComputedStyle(
            title.querySelector('.site-styled'),
          );
          const headingStyle = getComputedStyle(title);
          const listStyle = getComputedStyle(list);
          const itemStyle = getComputedStyle(second);
          return {
            columns: listStyle.gridTemplateColumns.split(/\s+/).filter(Boolean)
              .length,
            gap: listStyle.gap,
            itemOrder: itemStyle.order,
            itemRadius: itemStyle.borderRadius,
            itemWidth: second.getBoundingClientRect().width,
            listWidth: list.getBoundingClientRect().width,
            fontSize: titleStyle.fontSize,
            fontWeight: titleStyle.fontWeight,
            lineHeight: titleStyle.lineHeight,
            letterSpacing: titleStyle.letterSpacing,
            textAlign: headingStyle.textAlign,
            specs: JSON.parse(
              document.querySelector('[data-block-id="faq"]').dataset
                .elementStyleSpec,
            ).length,
            missingTargets: [
              ...document.querySelectorAll('[data-element-style-spec]'),
            ].flatMap((root) =>
              JSON.parse(root.dataset.elementStyleSpec).flatMap((entry) => {
                if (
                  entry.viewport !== 'all' &&
                  entry.viewport !== (innerWidth <= 767 ? 'mobile' : 'desktop')
                )
                  return [];
                const found = entry.selectors.some((selector) =>
                  root.querySelector(
                    selector.startsWith('>') ? `:scope ${selector}` : selector,
                  ),
                );
                return found ? [] : [`${root.dataset.blockId}:${entry.target}`];
              }),
            ),
            overflow:
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth,
          };
        });
        assert.equal(measured.columns, width === 1440 ? 2 : 1);
        assert.equal(measured.gap, width === 1440 ? '20px' : '12px');
        assert.equal(measured.itemOrder, width === 1440 ? '-1' : '0');
        assert.equal(measured.itemRadius, width === 1440 ? '18px' : '0px');
        assert.ok(
          width === 1440
            ? measured.itemWidth < measured.listWidth / 2
            : measured.itemWidth > measured.listWidth * 0.95,
        );
        assert.equal(measured.fontSize, '42px');
        assert.equal(measured.fontWeight, '700');
        assert.ok(Math.abs(Number.parseFloat(measured.lineHeight) - 46.2) < 1);
        assert.equal(measured.letterSpacing, '-1px');
        assert.equal(measured.textAlign, 'right');
        assert.equal(measured.specs, 3);
        assert.deepEqual(measured.missingTargets, []);
        assert.equal(measured.overflow, false);
        await page.screenshot({
          path: `outputs/element-styles/faq-${width}.png`,
        });
      }
    } finally {
      await browser.close();
      server.close();
    }
  },
);
