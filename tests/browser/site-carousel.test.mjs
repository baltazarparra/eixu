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
  'carrosséis preservam SSR, acessibilidade, movimento e responsividade',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 120_000 },
  async () => {
    const root = process.cwd();
    const jiti = createJiti(import.meta.url, {
      alias: { '@': root },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { CarouselFixture } = await jiti.import('./fixtures/carousel.tsx');
    const css = (
      await Promise.all(
        (
          await readdir('.next/static/chunks')
        )
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
      )
    )
      .filter(
        (source) =>
          source.includes('.site-theme') || source.includes('.site-carousel'),
      )
      .join('\n')
      .replaceAll('url(../media/', 'url(/_next/static/media/');
    assert.match(css, /site-carousel-viewport/);

    const propsFrom = (requestUrl) => {
      const params = new URL(requestUrl, 'http://fixture.test').searchParams;
      return {
        vibe: params.get('vibe') || 'comercial',
        editing: params.get('edit') === '1',
        mode: params.get('mode') || 'all',
        autoplay: params.get('autoplay') === '1',
        still: params.get('still') === '1',
      };
    };
    const server = await createServer({
      configFile: false,
      root,
      cacheDir: 'node_modules/.vite/site-carousel',
      optimizeDeps: {
        noDiscovery: true,
        include: [
          'react',
          'react-dom/client',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'framer-motion',
          'zod',
        ],
      },
      resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
      server: { host: '127.0.0.1', port: 0 },
      logLevel: 'error',
      plugins: [
        react(),
        {
          name: 'carousel-fixture',
          configureServer(vite) {
            vite.middlewares.use(async (request, response, next) => {
              const url = new URL(request.url, 'http://fixture.test');
              if (url.pathname.startsWith('/_next/static/media/')) {
                try {
                  response.end(
                    await readFile(
                      path.join(
                        root,
                        '.next/static/media',
                        path.basename(url.pathname),
                      ),
                    ),
                  );
                } catch {
                  response.statusCode = 404;
                  response.end();
                }
                return;
              }
              if (url.pathname !== '/') return next();
              const markup = renderToString(
                createElement(CarouselFixture, propsFrom(request.url)),
              );
              const script =
                url.searchParams.get('static') === '1'
                  ? ''
                  : '<script type="module" src="/tests/browser/fixtures/carousel.tsx"></script>';
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(
                await vite.transformIndexHtml(
                  '/',
                  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:"><style>body{margin:0}${css}</style></head><body><div id="root">${markup}</div>${script}</body></html>`,
                ),
              );
            });
          },
        },
      ],
    });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('request', (request) => requests.push(request.url()));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().startsWith('https://assets.test/'))
          void request.respond({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#d9c8a6"/><path d="M0 690L520 180l300 250 310-210 470 420v260H0z" fill="#7e5949"/></svg>',
          });
        else void request.continue();
      });

      await page.setViewport({ width: 390, height: 844 });
      await page.goto(`${origin}/?mode=landing&static=1&vibe=landing`, {
        waitUntil: 'networkidle0',
      });
      const staticState = await page.$eval('.site-carousel', (node) => {
        const viewport = node.querySelector('.site-carousel-viewport');
        const first = node.querySelector('img');
        return {
          enhanced: node.hasAttribute('data-enhanced'),
          images: node.querySelectorAll('img').length,
          firstVisible:
            first.getBoundingClientRect().left >=
              viewport.getBoundingClientRect().left - 1 &&
            first.getBoundingClientRect().right <=
              viewport.getBoundingClientRect().right + 1,
          scrollable: viewport.scrollWidth > viewport.clientWidth,
          controlsVisible:
            getComputedStyle(node.querySelector('.site-carousel-controls'))
              .display !== 'none',
        };
      });
      assert.deepEqual(staticState, {
        enhanced: false,
        images: 4,
        firstVisible: true,
        scrollable: true,
        controlsVisible: false,
      });

      requests.length = 0;
      await page.goto(`${origin}/?mode=plain`, { waitUntil: 'networkidle0' });
      assert.equal(
        requests.some((url) => /embla-carousel/i.test(url)),
        false,
      );
      requests.length = 0;
      await page.goto(`${origin}/?mode=landing&vibe=landing`, {
        waitUntil: 'networkidle0',
      });
      await page.waitForSelector('.site-carousel[data-enhanced="true"]');
      assert.equal(
        requests.some((url) => /embla-carousel/i.test(url)),
        true,
      );
      const priority = await page.$$eval('.site-carousel-image', (images) =>
        images.map((image) => ({
          loading: image.loading,
          priority: image.fetchPriority,
          width: image.getAttribute('width'),
          height: image.getAttribute('height'),
        })),
      );
      assert.deepEqual(priority.slice(0, 3), [
        { loading: 'eager', priority: 'high', width: '1600', height: '900' },
        { loading: 'eager', priority: 'auto', width: '1600', height: '900' },
        { loading: 'lazy', priority: 'auto', width: '1600', height: '900' },
      ]);
      assert.deepEqual(
        await page.$eval('.site-carousel-image', (image) => ({
          fit: image.dataset.fit,
          objectFit: getComputedStyle(image).objectFit,
        })),
        { fit: 'cover', objectFit: 'cover' },
      );
      assert.equal(
        await page.$$('.site-carousel-dots button').then((x) => x.length),
        4,
      );
      await page.focus('.site-carousel-previous');
      await page.keyboard.press('End');
      await page.waitForFunction(() =>
        document
          .querySelector('.site-carousel-live')
          ?.textContent.includes('Foto 4 de 4'),
      );
      await page.keyboard.press('Home');
      await page.waitForFunction(() =>
        document
          .querySelector('.site-carousel-live')
          ?.textContent.includes('Foto 1 de 4'),
      );
      await page.click('.site-carousel-next');
      await page.waitForFunction(() =>
        document
          .querySelector('.site-carousel-live')
          ?.textContent.includes('Foto 2 de 4'),
      );
      const box = await page.$eval('.site-carousel-viewport', (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, {
        steps: 8,
      });
      await page.mouse.up();
      await page.waitForFunction(() =>
        document
          .querySelector('.site-carousel-live')
          ?.textContent.includes('Foto 3 de 4'),
      );
      const nextTarget = await page.$eval('.site-carousel-next', (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      await page.touchscreen.tap(nextTarget.x, nextTarget.y);
      await page.waitForFunction(() =>
        document
          .querySelector('.site-carousel-live')
          ?.textContent.includes('Foto 4 de 4'),
      );

      for (const vibe of ['comercial', 'artistico', 'moderno', 'landing']) {
        for (const width of [1440, 390, 320]) {
          await page.setViewport({ width, height: 900 });
          await page.goto(`${origin}/?mode=all&vibe=${vibe}`, {
            waitUntil: 'networkidle0',
          });
          await page.waitForFunction(
            () =>
              document.querySelectorAll('.site-carousel[data-enhanced="true"]')
                .length === 6,
          );
          const measured = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            carousels: document.querySelectorAll('.site-carousel').length,
            controls: [
              ...document.querySelectorAll('.site-carousel-control'),
            ].every((control) => {
              const rect = control.getBoundingClientRect();
              return rect.width >= 44 && rect.height >= 44;
            }),
            splitLayouts: ['split', 'poster', 'editorial', 'offset'].every(
              (layout) =>
                document
                  .querySelector(`[data-block-id="split-${layout}"]`)
                  ?.querySelector('.site-carousel[data-enhanced="true"]'),
            ),
          }));
          assert.equal(measured.overflow, false, `${vibe} ${width}`);
          assert.equal(measured.carousels, 6, `${vibe} ${width}`);
          assert.equal(measured.controls, true, `${vibe} ${width}`);
          assert.equal(measured.splitLayouts, true, `${vibe} ${width}`);
        }
      }

      await page.goto(`${origin}/?mode=landing&vibe=landing&edit=1`, {
        waitUntil: 'networkidle0',
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const editing = await page.$eval('.site-carousel', (node) => {
        const viewport = node.querySelector('.site-carousel-viewport');
        return {
          enhanced: node.hasAttribute('data-enhanced'),
          scrollable: viewport.scrollWidth > viewport.clientWidth,
          captions: [...node.querySelectorAll('figcaption')].every((caption) =>
            caption.querySelector('[data-field]'),
          ),
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.deepEqual(editing, {
        enhanced: false,
        scrollable: true,
        captions: true,
        pageOverflow: false,
      });

      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      await page.goto(`${origin}/?mode=landing&vibe=landing&autoplay=1`, {
        waitUntil: 'networkidle0',
      });
      await page.waitForSelector('.site-carousel[data-enhanced="true"]');
      const reduced = await page.$eval('.site-carousel', (node) => ({
        autoplay: node.hasAttribute('data-autoplay'),
        pause: Boolean(node.querySelector('.site-carousel-pause')),
        transition: getComputedStyle(
          node.querySelector('.site-carousel-control'),
        ).transitionDuration,
        live: node
          .querySelector('.site-carousel-live')
          ?.getAttribute('aria-live'),
        target: (() => {
          const rect = node
            .querySelector('.site-carousel-control')
            .getBoundingClientRect();
          return [rect.width, rect.height];
        })(),
      }));
      assert.equal(reduced.autoplay, false);
      assert.equal(reduced.pause, false);
      assert.equal(reduced.transition, '0s');
      assert.equal(reduced.live, 'polite');
      assert.ok(reduced.target.every((value) => value >= 48));
      await new Promise((resolve) => setTimeout(resolve, 4200));
      assert.match(
        await page.$eval('.site-carousel-live', (node) => node.textContent),
        /Foto 1 de 4/,
      );

      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'no-preference' },
      ]);
      await page.goto(
        `${origin}/?mode=landing&vibe=landing&autoplay=1&still=1`,
        { waitUntil: 'networkidle0' },
      );
      await page.waitForSelector('.site-carousel[data-enhanced="true"]');
      assert.deepEqual(
        await page.$eval('.site-carousel', (node) => ({
          autoplay: node.hasAttribute('data-autoplay'),
          transition: getComputedStyle(
            node.querySelector('.site-carousel-control'),
          ).transitionDuration,
        })),
        { autoplay: false, transition: '0s' },
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
