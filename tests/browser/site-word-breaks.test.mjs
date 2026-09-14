import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';

await test(
  'palavras inteiras e brilho comercial sobrevivem a cinco larguras reais',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const root = process.cwd();
    const jiti = createJiti(import.meta.url, {
      alias: { '@': root },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { WordBreakFixture } = await jiti.import(
      './fixtures/word-breaks.tsx',
    );
    const { inspectText } = await jiti.import('../../lib/review/text.ts');
    const { contrastRatio } = await jiti.import('../../lib/blocks/contrast.ts');
    const css = (
      await Promise.all(
        (
          await readdir('.next/static/chunks')
        )
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
      )
    )
      .filter((source) => source.includes('.site-theme'))
      .join('\n')
      .replaceAll('url(../media/', 'url(/_next/static/media/');
    assert.match(css, /data-motif=['"]?wash/);

    const server = await createServer({
      configFile: false,
      root,
      cacheDir: 'node_modules/.vite/site-word-breaks',
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
      plugins: [
        react(),
        {
          name: 'word-break-fixture',
          configureServer(vite) {
            vite.middlewares.use(async (request, response, next) => {
              if (request.url?.startsWith('/_next/static/media/')) {
                try {
                  response.end(
                    await readFile(
                      path.join(
                        root,
                        '.next/static/media',
                        path.basename(request.url),
                      ),
                    ),
                  );
                } catch {
                  response.statusCode = 404;
                  response.end();
                }
                return;
              }
              if (request.url?.split('?')[0] !== '/') return next();
              const markup = renderToString(createElement(WordBreakFixture));
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(
                await vite.transformIndexHtml(
                  '/',
                  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:"><style>${css}</style></head><body><div id="root">${markup}</div><script type="module" src="/tests/browser/fixtures/word-breaks.tsx"></script></body></html>`,
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
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    await mkdir('outputs/word-breaks', { recursive: true });

    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().startsWith('https://assets.test/'))
          void request.respond({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="#dce8df"/><path d="M0 560L380 220l240 180 340-300v620H0z" fill="#6d8974"/></svg>',
          });
        else void request.continue();
      });
      await page.goto(origin, { waitUntil: 'networkidle0' });
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewport({ width, height: 900 });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        });
        const measured = await page.evaluate(() => {
          const root = document.querySelector('.site-theme');
          const style = getComputedStyle(root);
          const hero = document.querySelector('.site-hero');
          const accentCta = document.querySelector(
            '[data-block="cta.band"][data-tone="accent"]',
          );
          return {
            innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            motif: root.dataset.motif,
            glow: style.getPropertyValue('--glow').trim(),
            glow2: style.getPropertyValue('--glow-2').trim(),
            ink: style.getPropertyValue('--brand-ink').trim(),
            heroBackground: getComputedStyle(hero).backgroundImage,
            footerBackground: getComputedStyle(
              document.querySelector('.site-footer'),
            ).backgroundImage,
            ctaBackground: getComputedStyle(accentCta).backgroundImage,
            serviceLensRight: document
              .querySelector('.site-signature-service-lens')
              .getBoundingClientRect().right,
          };
        });
        assert.ok(
          measured.scrollWidth <= width + 1,
          `${width}px: overflow ${measured.scrollWidth}`,
        );
        assert.equal(measured.motif, 'wash');
        // O hero desta fixture é `cover`: a foto ocupa a caixa inteira
        // (position absolute, inset 0), e um brilho medido contra o papel da
        // marca nunca apareceu sob ela. A vibe não pinta fundo aqui.
        assert.equal(measured.heroBackground, 'none');
        // Luz sobre papel: brilho radial, nunca uma reta entre duas cores.
        assert.match(measured.footerBackground, /radial-gradient/);
        assert.doesNotMatch(measured.footerBackground, /1px|repeating/);
        assert.doesNotMatch(measured.footerBackground, /linear-gradient/);
        assert.match(measured.ctaBackground, /radial-gradient/);
        assert.doesNotMatch(measured.ctaBackground, /linear-gradient/);
        // O brilho é fundo de texto corrido: o piso é AAA, não AA.
        assert.ok(contrastRatio(measured.ink, measured.glow) >= 7);
        assert.ok(contrastRatio(measured.ink, measured.glow2) >= 7);
        assert.ok(measured.serviceLensRight <= width + 1);
        const inspection = await inspectText(page, {
          page: '/',
          viewport: `${width}px`,
        });
        assert.deepEqual(inspection.brokenWords, [], `${width}px`);
        await page.screenshot({
          path: `outputs/word-breaks/comercial-${width}.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
