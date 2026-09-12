import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';

await test(
  'doze composições autorais preservam hierarquia e largura em desktop e mobile',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const root = process.cwd();
    const jiti = createJiti(import.meta.url, {
      alias: { '@': root },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { SignatureStructureFixture } = await jiti.import(
      './fixtures/signature-structures.tsx',
    );
    const { STRUCTURE_KEYS } = await jiti.import(
      '../../lib/design/structures.ts',
    );
    const css = (
      await Promise.all(
        (
          await readdir('.next/static/chunks')
        )
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
      )
    )
      .join('\n')
      .replaceAll('url(../media/', 'url(/_next/static/media/');
    assert.ok(
      css.includes('.site-signature'),
      'Execute build:vercel antes deste teste.',
    );

    const server = await createServer({
      configFile: false,
      root,
      cacheDir: 'node_modules/.vite/site-signature-structures',
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
          name: 'signature-structure-fixture',
          configureServer(vite) {
            vite.middlewares.use(async (req, res, next) => {
              if (req.url?.startsWith('/_next/static/media/')) {
                try {
                  res.end(
                    await readFile(
                      path.join(
                        root,
                        '.next/static/media',
                        path.basename(req.url),
                      ),
                    ),
                  );
                } catch {
                  res.statusCode = 404;
                  res.end();
                }
                return;
              }
              if (req.url?.split('?')[0] !== '/') return next();
              const structure = new URL(
                req.url,
                'http://localhost',
              ).searchParams.get('structure');
              const markup = renderToString(
                createElement(SignatureStructureFixture, {
                  structureKey: structure,
                }),
              );
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(
                await vite.transformIndexHtml(
                  '/',
                  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:"><style>${css}</style></head><body><div id="root">${markup}</div><script type="module" src="/tests/browser/fixtures/signature-structures.tsx"></script></body></html>`,
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
    await mkdir('outputs/signature-structures', { recursive: true });
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
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="#e8dfcf"/><circle cx="590" cy="310" r="220" fill="#6b876f"/><path d="M80 610L430 190L710 610Z" fill="#b88a68"/></svg>',
          });
        else void request.continue();
      });

      for (const structure of STRUCTURE_KEYS)
        await t.test(structure, async () => {
          await page.goto(`${origin}/?structure=${structure}`, {
            waitUntil: 'networkidle0',
          });
          for (const width of [320, 390, 768, 1440]) {
            await page.setViewport({ width, height: 1000 });
            await page.evaluate(
              () =>
                new Promise((resolve) => {
                  requestAnimationFrame(() => requestAnimationFrame(resolve));
                }),
            );
            const report = await page.evaluate(() => ({
              width: window.innerWidth,
              scrollWidth: document.documentElement.scrollWidth,
              focus: document.querySelectorAll('[data-role="focus"]').length,
              support: document.querySelectorAll('[data-role="support"]')
                .length,
              images: [...document.querySelectorAll('.site-signature img')].map(
                (image) => ({
                  complete: image.complete,
                  naturalWidth: image.naturalWidth,
                }),
              ),
              items: [
                ...document.querySelectorAll('.site-signature [data-role]'),
              ].map((item) => {
                const rect = item.getBoundingClientRect();
                return {
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                  height: rect.height,
                };
              }),
              sectionHeight: document
                .querySelector('.site-signature')
                .getBoundingClientRect().height,
              headings: [
                ...document.querySelectorAll('.site-signature h3'),
              ].map((heading) => {
                const rect = heading.getBoundingClientRect();
                return {
                  width: rect.width,
                  fontSize: Number.parseFloat(
                    getComputedStyle(heading).fontSize,
                  ),
                };
              }),
            }));
            assert.ok(
              report.scrollWidth <= width + 1,
              `${structure} ${width}: overflow ${report.scrollWidth}`,
            );
            assert.equal(report.focus, 1, `${structure} ${width}`);
            assert.equal(report.support, 1, `${structure} ${width}`);
            assert.equal(report.images.length, 2, `${structure} ${width}`);
            assert.ok(
              report.images.every(
                (image) => image.complete && image.naturalWidth === 960,
              ),
              `${structure} ${width}: ${JSON.stringify(report.images)}`,
            );
            assert.ok(
              report.items.every(
                (item) =>
                  item.left >= -1 &&
                  item.right <= width + 1 &&
                  item.width > 0 &&
                  item.height >= 80,
              ),
              `${structure} ${width}: ${JSON.stringify(report.items)}`,
            );
            assert.ok(
              report.headings.every(
                (heading) => heading.width / heading.fontSize >= 4.5,
              ),
              `${structure} ${width}: títulos estreitos ${JSON.stringify(report.headings)}`,
            );
            if (width >= 768)
              assert.ok(
                report.sectionHeight <= width * 3,
                `${structure} ${width}: altura ${report.sectionHeight}`,
              );
            if (width === 390 || width === 1440)
              await page.screenshot({
                path: `outputs/signature-structures/${structure}-${width}.png`,
                fullPage: true,
              });
          }
        });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
