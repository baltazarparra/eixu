import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';

await test(
  'cabeçalho fixo reserva espaço e galeria cria só as colunas ocupadas',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const root = process.cwd();
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
    assert.ok(
      css.includes('.site-navigation-frame'),
      'Execute build:vercel antes deste teste.',
    );
    const server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite/site-navigation-test',
      root,
      plugins: [
        react(),
        {
          name: 'site-navigation-fixture',
          configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
              if (request.url?.split('?')[0] !== '/') return next();
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(
                await server.transformIndexHtml(
                  '/',
                  `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css}</style></head><body><div id="root"></div><script type="module" src="/tests/browser/fixtures/navigation.tsx"></script></body></html>`,
                ),
              );
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
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().startsWith('https://assets.test/'))
          void request.respond({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#456b5a"/></svg>',
          });
        else void request.continue();
      });
      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      for (const width of [1440, 390])
        for (const count of [2, 3, 8]) {
          await page.setViewport({ width, height: 900 });
          await page.goto(
            `http://127.0.0.1:${server.httpServer.address().port}/?count=${count}`,
            { waitUntil: 'networkidle0' },
          );
          assert.deepEqual(errors, []);
          assert.equal(
            await page.$eval(
              '.site-navigation-frame',
              (node) => node.dataset.position,
            ),
            'fixed',
          );
          await page.waitForFunction(() =>
            document
              .querySelector('.site-navigation-frame')
              ?.style.getPropertyValue('--navigation-height'),
          );
          const initial = await page.evaluate(() => {
            const nav = document.querySelector('.site-nav');
            const frame = document.querySelector('.site-navigation-frame');
            const list = document.querySelector('.site-gallery ul');
            return {
              top: nav.getBoundingClientRect().top,
              height: nav.getBoundingClientRect().height,
              reserved: frame.getBoundingClientRect().height,
              mainTop: document.querySelector('main').getBoundingClientRect()
                .top,
              columns:
                getComputedStyle(list).gridTemplateColumns.split(' ').length,
              width: list.clientWidth,
              scroll: list.scrollWidth,
              items: [...list.children].map(
                (item) => item.getBoundingClientRect().width,
              ),
              pageWidth: document.documentElement.scrollWidth,
              background: getComputedStyle(nav).backgroundColor,
            };
          });
          assert.equal(initial.columns, count);
          assert.equal(initial.pageWidth, width);
          assert.ok(initial.mainTop >= initial.top + initial.height - 1);
          if (width === 1440 && count === 2) {
            assert.equal(initial.scroll, initial.width);
            assert.ok(
              initial.items.every((item) => item > initial.width * 0.45),
            );
          }
          assert.match(initial.background, /0\.88/);
          await page.evaluate(() =>
            window.scrollTo({ top: 700, behavior: 'instant' }),
          );
          const after = await page.$eval(
            '.site-nav',
            (node) => node.getBoundingClientRect().top,
          );
          assert.ok(
            Math.abs(after - initial.top) <= 1,
            'Cabeçalho deve permanecer no topo após rolagem.',
          );
          if (width === 390) {
            await page.click('.site-mobile-nav summary');
            await page.waitForFunction(
              () =>
                document
                  .querySelector('.site-navigation-frame')
                  .getBoundingClientRect().height >=
                document
                  .querySelector('.site-navigation-content')
                  .getBoundingClientRect().height -
                  1,
            );
            const reserved = await page.$eval(
              '.site-navigation-frame',
              (node) => node.getBoundingClientRect().height,
            );
            assert.ok(
              reserved > initial.reserved,
              'Menu aberto precisa reservar sua nova altura.',
            );
            await page.click('.site-mobile-nav summary');
          }
        }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
