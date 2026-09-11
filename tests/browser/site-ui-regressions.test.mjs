import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';

await test(
  'componentes corrigidos preservam SSR, teclado e estado do navegador',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const root = process.cwd();
    const jiti = createJiti(import.meta.url, {
      alias: { '@': root },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { UiFixture } = await jiti.import('./fixtures/ui.tsx');
    const markup = renderToString(createElement(UiFixture));
    const directory = path.join(root, '.next/static/chunks');
    const css = (
      await Promise.all(
        (
          await readdir(directory)
        )
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(path.join(directory, file), 'utf8')),
      )
    ).join('\n');
    const server = await createServer({
      configFile: false,
      root,
      plugins: [
        react(),
        {
          name: 'eixu-ui-fixture',
          configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
              if (request.url === '/') {
                const html = await server.transformIndexHtml(
                  '/',
                  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="/__fixture.css"></head><body><div id="root">${markup}</div><script type="module" src="/tests/browser/fixtures/ui.tsx"></script></body></html>`,
                );
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.end(html);
                return;
              }
              if (request.url === '/__fixture.css') {
                response.setHeader('Content-Type', 'text/css');
                response.end(css);
                return;
              }
              if (request.url?.startsWith('/_next/static/media/')) {
                const file = path.basename(request.url.split('?')[0]);
                try {
                  response.end(
                    await readFile(path.join(root, '.next/static/media', file)),
                  );
                } catch {
                  response.statusCode = 404;
                  response.end();
                }
                return;
              }
              next();
            });
          },
        },
      ],
      resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
      server: { host: '127.0.0.1', port: 0 },
      logLevel: 'error',
    });
    await server.listen();
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.setViewport({ width: 390, height: 900 });
      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, {
        waitUntil: 'networkidle0',
      });
      await t.test(
        'hidrata no mobile e respeita movimento reduzido e mudanças de largura',
        async () => {
          await page.waitForFunction(
            () => document.querySelector('#mobile')?.textContent === 'true',
          );
          assert.equal(
            await page.$eval('.terminal-typed', (node) => node.textContent),
            'A/gente tira do papel.',
          );
          assert.equal(await page.$('.terminal-cursor'), null);
          await page.setViewport({ width: 1024, height: 900 });
          await page.waitForFunction(
            () => document.querySelector('#mobile')?.textContent === 'false',
          );
        },
      );
      await t.test(
        'label, paginação, grupos e ações têm conteúdo e comportamento nativos',
        async () => {
          await page.click('label[for="email"]');
          assert.equal(
            await page.evaluate(() => document.activeElement?.id),
            'email',
          );
          await page.focus('#addon-action');
          await page.keyboard.press('Enter');
          await page.waitForFunction(
            () => document.querySelector('#clicks')?.textContent === '1',
          );
          assert.equal(
            await page.$eval(
              '[data-slot="pagination-link"]',
              (node) => node.textContent,
            ),
            '2',
          );
          assert.equal(
            await page.$eval(
              '[data-slot="button-group"]',
              (node) => node.tagName,
            ),
            'FIELDSET',
          );
          assert.equal(
            await page.$eval('[data-slot="item-group"]', (node) =>
              [...node.children].every((child) => child.tagName === 'LI'),
            ),
            true,
          );
          assert.equal(
            await page.$eval('[data-slot="breadcrumb-page"]', (node) =>
              node.getAttribute('role'),
            ),
            null,
          );
          assert.equal(
            await page.$eval('[data-slot="spinner"]', (node) => node.tagName),
            'OUTPUT',
          );
          assert.equal(
            await page.$eval('[data-slot="input-otp-separator"]', (node) =>
              node.getAttribute('aria-hidden'),
            ),
            'true',
          );
          assert.match(
            await page.$eval('#charts', (node) => node.textContent),
            /Volume/,
          );
        },
      );
      await t.test(
        'carrossel atualiza limites por clique e teclado',
        async () => {
          await page.waitForFunction(
            () =>
              !document.querySelector('[data-slot="carousel-next"]')?.disabled,
          );
          assert.equal(
            await page.$eval(
              '[data-slot="carousel-previous"]',
              (node) => node.disabled,
            ),
            true,
          );
          await page.click('[data-slot="carousel-next"]');
          await page.waitForFunction(
            () =>
              !document.querySelector('[data-slot="carousel-previous"]')
                ?.disabled,
          );
          await page.focus('[data-slot="carousel-next"]');
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(
            () =>
              document.querySelector('[data-slot="carousel-next"]')?.disabled,
          );
        },
      );
      await t.test(
        'desmonta, altera preferências e retoma sem erros ou hidratação divergente',
        async () => {
          await page.click('#toggle-fixture');
          await page.setViewport({ width: 390, height: 900 });
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'no-preference' },
          ]);
          await page.click('#toggle-fixture');
          await page.waitForFunction(
            () => document.querySelector('#mobile')?.textContent === 'true',
          );
          await page.waitForFunction(
            () =>
              document.querySelector('.terminal-typed')?.textContent ===
                'A/gente tira do papel.' &&
              !document.querySelector('.terminal-cursor'),
            { timeout: 10000 },
          );
          assert.deepEqual(errors, []);
        },
      );
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
