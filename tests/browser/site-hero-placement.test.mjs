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
  id: 'placement',
  slug: 'placement',
  name: 'Ateliê',
  brand: { accent: '#193f47', ink: '#14161a', paper: '#ffffff' },
  brief: {},
  dials: { variance: 5, density: 5, motion: 1 },
  imageGuide: {},
  whatsapp: null,
};

const hero = (placement) => ({
  id: 'hero',
  type: 'hero.split',
  props: {
    layout: 'editorial',
    headline: 'Materiais para cada ambiente',
    subtext: 'Considere o uso e as referências do projeto antes da escolha.',
    cta: { label: 'Conferir opções', href: '/materiais' },
    bulletsPlacement: placement,
    bullets: [
      'Amostras enviadas em 48 horas',
      'Orientação por ambiente',
      'Acabamentos comparados lado a lado',
    ],
    image: 'https://assets.test/hero.webp',
    imageAlt: 'Bancada com amostras de materiais',
  },
});

await test(
  'os selos do hero mudam de lugar com o CSS de produção, sem perder a coluna nem o toque',
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
    assert.ok(
      css.includes('.site-hero-editorial'),
      'Execute build:vercel antes deste teste.',
    );
    const html = (placement) => `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body><div class="site-theme" data-variance="expressive" data-density="normal" data-motion="still" style="${Object.entries(
      themeVars(tenant.brand),
    )
      .map(([key, value]) => `${key}:${value}`)
      .join(';')}">${renderToStaticMarkup(
      createElement(RenderBlocks, {
        blocks: [hero(placement)],
        ctx: { tenant, pagePath: '/' },
      }),
    )}</div></body></html>`;

    const pages = { cta: html('cta'), headline: html('headline') };
    const server = createServer((request, response) => {
      const key = request.url === '/headline' ? 'headline' : 'cta';
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(pages[key]);
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir('outputs/hero-placement', { recursive: true });
    try {
      const measure = async (path, width) => {
        await page.setViewport({ width, height: 900 });
        await page.goto(`${origin}${path}`, { waitUntil: 'load' });
        return page.evaluate(() => {
          const box = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { top: rect.top, left: rect.left, bottom: rect.bottom };
          };
          return {
            title: box('.site-headline'),
            bullets: box('.site-hero-bullets'),
            actions: box('.site-hero-copy .flex.flex-wrap.gap-3'),
            subtext: box('.site-hero-copy p'),
            overflow:
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth,
          };
        });
      };

      for (const width of [1440, 390]) {
        const cta = await measure('/cta', width);
        const headline = await measure('/headline', width);
        assert.equal(cta.overflow, false, `cta ${width}`);
        assert.equal(headline.overflow, false, `headline ${width}`);
        // Sob os botões: a lista vem depois das ações.
        assert.ok(
          cta.bullets.top >= cta.actions.top,
          `cta ${width}: ${JSON.stringify(cta)}`,
        );
        // Sob o título: acima das ações e do texto de apoio.
        assert.ok(
          headline.bullets.top < headline.actions.top,
          `headline ${width}: ${JSON.stringify(headline)}`,
        );
        assert.ok(headline.bullets.top >= headline.title.bottom - 1);
        // No editorial do desktop os selos pedidos sob o título ficam na coluna
        // dele, ao lado do texto de apoio; no celular a grade vira uma coluna.
        if (width === 1440) {
          assert.ok(
            Math.abs(headline.bullets.left - headline.title.left) < 2,
            `coluna do título: ${JSON.stringify(headline)}`,
          );
          assert.ok(headline.bullets.left < headline.subtext.left);
          assert.ok(cta.bullets.left > cta.title.left);
        } else {
          assert.ok(
            headline.bullets.top < headline.subtext.top,
            `headline ${width} subtexto: ${JSON.stringify(headline)}`,
          );
        }
        await page.screenshot({
          path: `outputs/hero-placement/headline-${width}.png`,
        });
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
    }
  },
);
