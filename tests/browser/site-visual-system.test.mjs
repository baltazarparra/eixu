import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';

await test(
  'quatro vibes: fontes reais, ícones, teclado, motion e leitura responsiva',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const root = process.cwd();
    const jiti = createJiti(import.meta.url, {
      alias: { '@': root },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { VisualSystemFixture, VISUAL_PAIRS } = await jiti.import(
      './fixtures/visual-system.tsx',
    );
    const { DISPLAY_TYPE, BODY_TYPE } = await jiti.import(
      '../../lib/design/typography.ts',
    );
    const css = (
      await Promise.all(
        (
          await readdir('.next/static/chunks')
        )
          .filter((f) => f.endsWith('.css'))
          .map((f) => readFile(`.next/static/chunks/${f}`, 'utf8')),
      )
    )
      .filter((s) => s.includes('.site-theme') || s.includes('--font-classic'))
      .join('\n')
      .replaceAll('url(../media/', 'url(/_next/static/media/');
    assert.ok(
      css.includes('--font-classic'),
      'Execute build:vercel antes deste teste.',
    );
    const fontClasses = [...css.matchAll(/\.([\w-]+)\{--font-[\w-]+:/g)]
      .map((m) => m[1])
      .join(' ');
    const server = await createServer({
      configFile: false,
      root,
      cacheDir: 'node_modules/.vite/site-visual-system',
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
          name: 'visual-system-fixture',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
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
              const query = new URL(req.url, 'http://localhost').searchParams;
              const vibe = query.get('vibe') ?? 'comercial';
              const markup = renderToString(
                createElement(VisualSystemFixture, {
                  vibe,
                  display: query.get('display') ?? undefined,
                  body: query.get('body') ?? undefined,
                  testimonialLayout: query.get('testimonial') ?? undefined,
                }),
              );
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(
                await server.transformIndexHtml(
                  '/',
                  `<!doctype html><html lang="pt-BR" class="${fontClasses}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>${css}</style></head><body><div id="root">${markup}</div><script type="module" src="/tests/browser/fixtures/visual-system.tsx"></script></body></html>`,
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
    const reports = [];
    await mkdir('outputs/visual-system', { recursive: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().startsWith('https://assets.test/'))
          void request.respond({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="#e0d9c9"/><circle cx="550" cy="350" r="230" fill="#8c9b88"/><rect x="140" y="360" width="330" height="300" fill="#c4b0a2"/></svg>',
          });
        else void request.continue();
      });
      for (const [vibe, pair] of Object.entries(VISUAL_PAIRS))
        await t.test(vibe, async () => {
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ]);
          await page.setViewport({ width: 1440, height: 1000 });
          await page.goto(`${origin}/?vibe=${vibe}`, {
            waitUntil: 'networkidle0',
          });
          await page.evaluate(() => document.fonts.ready);
          for (const width of [320, 390, 768, 1440, 1920]) {
            await page.setViewport({ width, height: 1000 });
            await page.evaluate(
              () =>
                new Promise((resolve) => {
                  requestAnimationFrame(() => requestAnimationFrame(resolve));
                }),
            );
            const metrics = await page.evaluate(() => {
              const h1 = document.querySelector('h1');
              const body = document.querySelector('.site-text p:last-child');
              const style = getComputedStyle(body);
              return {
                width: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                headlineFont: getComputedStyle(h1).fontFamily,
                bodyFont: style.fontFamily,
                bodySize: parseFloat(style.fontSize),
                lineHeight: parseFloat(style.lineHeight),
                headlineSize: parseFloat(getComputedStyle(h1).fontSize),
                families: [
                  ...new Set(
                    [...document.fonts]
                      .filter(
                        (font) =>
                          font.status === 'loaded' &&
                          !font.family.includes('Fallback'),
                      )
                      .map((font) => font.family.replaceAll('"', '')),
                  ),
                ],
                visibleTabIcon: getComputedStyle(
                  document.querySelector(
                    '.site-explorer-tabs [data-icon="palette"] svg',
                  ),
                ).display,
                icons: document.querySelectorAll('.site-icon').length,
                decorativeIcons: document.querySelectorAll(
                  '.site-eyebrow .site-icon, .site-text .site-icon, .site-gallery .site-icon, .site-step-number .site-icon, .site-explorer-tabs [data-icon="arrow-up-right"], .site-explorer-copy li .site-icon',
                ).length,
                itemIcons: [
                  ...document.querySelectorAll(
                    '.site-item-heading > .site-icon',
                  ),
                ].map((icon) => {
                  const heading = icon.parentElement;
                  const label = icon.nextElementSibling;
                  const svg = icon.querySelector('svg').getBoundingClientRect();
                  const text = label.getBoundingClientRect();
                  const font = parseFloat(getComputedStyle(heading).fontSize);
                  return {
                    title: heading.textContent,
                    ratio: svg.width / font,
                    gap: (text.x - svg.right) / font,
                    top: (svg.y - text.y) / font,
                    right: text.right,
                  };
                }),
              };
            });
            assert.ok(
              metrics.scrollWidth <= width + 1,
              `${vibe} ${width}: overflow ${metrics.scrollWidth}`,
            );
            assert.ok(
              metrics.headlineFont.includes(DISPLAY_TYPE[pair[0]].name),
              JSON.stringify(metrics),
            );
            assert.ok(
              metrics.bodyFont.includes(BODY_TYPE[pair[1]].name),
              JSON.stringify(metrics),
            );
            assert.ok(
              metrics.bodySize >= 16 &&
                metrics.lineHeight / metrics.bodySize >= 1.49,
              JSON.stringify(metrics),
            );
            assert.ok(metrics.headlineSize >= metrics.bodySize * 2);
            assert.notEqual(metrics.visibleTabIcon, 'none');
            assert.deepEqual(
              metrics.families.sort((a, b) => a.localeCompare(b)),
              [DISPLAY_TYPE[pair[0]].name, BODY_TYPE[pair[1]].name].sort(
                (a, b) => a.localeCompare(b),
              ),
            );
            assert.equal(metrics.decorativeIcons, 0);
            assert.ok(metrics.itemIcons.length > 0);
            for (const icon of metrics.itemIcons) {
              assert.ok(
                icon.ratio >= 0.85 && icon.ratio <= 1.05,
                JSON.stringify(icon),
              );
              assert.ok(
                icon.gap >= 0.4 && icon.gap <= 0.6,
                JSON.stringify(icon),
              );
              assert.ok(
                icon.top >= 0 && icon.top <= 0.25,
                JSON.stringify(icon),
              );
              assert.ok(icon.right <= width, JSON.stringify(icon));
            }
            reports.push({ vibe, ...metrics });
            if ([390, 1440].includes(width)) {
              await page.screenshot({
                path: `outputs/visual-system/${vibe}-${width}.png`,
              });
              for (const selector of [
                '.site-text',
                '.site-gallery',
                '.site-services',
              ])
                await (
                  await page.$(selector)
                ).screenshot({
                  path: `outputs/visual-system/icons-${vibe}-${width}-${selector.slice(6)}.png`,
                });
            }
          }
          await page.setViewport({ width: 390, height: 1000 });
          await page.focus('.site-explorer-tabs [role="tab"]');
          await page.keyboard.press('ArrowRight');
          assert.equal(
            await page.$eval(
              '.site-explorer-tabs [aria-selected="true"]',
              (node) => node.textContent.trim(),
            ),
            'Materialidade',
          );
          await page.focus('.site-faq summary');
          await page.keyboard.press('Enter');
          assert.equal(
            await page.$eval('.site-faq details', (node) => node.open),
            true,
          );
          assert.equal(
            await page.$eval(
              '.site-faq .site-icon-svg',
              (node) => getComputedStyle(node).transitionDuration,
            ),
            '0s',
          );
          await page.keyboard.press('Enter');
          assert.equal(
            await page.$eval('.site-faq details', (node) => node.open),
            false,
          );
          await page.setViewport({ width: 1440, height: 1000 });
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'no-preference' },
          ]);
          await page.focus('.site-nav-cta');
          await page.waitForFunction(
            () =>
              getComputedStyle(
                document.querySelector('.site-nav-cta .site-icon-svg'),
              ).transform !== 'none',
          );
          const focusTransform = await page.$eval(
            '.site-nav-cta .site-icon-svg',
            (node) => getComputedStyle(node).transform,
          );
          assert.notEqual(focusTransform, 'none');
          await page.hover('.site-nav-cta');
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ]);
          assert.equal(
            await page.$eval(
              '.site-nav-cta .site-icon-svg',
              (node) => getComputedStyle(node).transform,
            ),
            'none',
          );
          assert.equal(
            await page.$eval(
              '.site-nav-cta .site-icon-svg',
              (node) => getComputedStyle(node).transitionDuration,
            ),
            '0s',
          );
          assert.deepEqual(errors, []);
        });
      await t.test(
        'depoimento mantém texto e autoria em suas colunas',
        async () => {
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ]);
          for (const vibe of Object.keys(VISUAL_PAIRS)) {
            await page.goto(`${origin}/?vibe=${vibe}&testimonial=split`, {
              waitUntil: 'networkidle0',
            });
            for (const width of [390, 1440]) {
              await page.setViewport({ width, height: 1000 });
              const boxes = await page.$eval('.site-testimonial', (section) => {
                const rect = (selector) => {
                  const { x, y, width, bottom, right } = section
                    .querySelector(selector)
                    .getBoundingClientRect();
                  return { x, y, width, bottom, right };
                };
                return {
                  quote: rect('blockquote'),
                  author: rect('figcaption'),
                  icon: rect('.site-icon'),
                };
              });
              assert.ok(
                boxes.icon.bottom <= boxes.quote.y,
                `${vibe}: ícone sobre o texto`,
              );
              if (width === 1440) {
                assert.ok(
                  boxes.quote.width > boxes.author.width * 2,
                  `${vibe}: texto na coluna larga`,
                );
                assert.ok(
                  boxes.quote.right < boxes.author.x,
                  `${vibe}: autoria na segunda coluna`,
                );
                assert.ok(
                  Math.abs(boxes.quote.bottom - boxes.author.bottom) < 2,
                  `${vibe}: autoria alinhada ao texto`,
                );
              } else {
                assert.ok(
                  boxes.author.y >= boxes.quote.bottom,
                  `${vibe}: autoria abaixo do texto no celular`,
                );
                assert.ok(
                  boxes.quote.right <= width,
                  `${vibe}: texto dentro da tela`,
                );
              }
            }
          }
        },
      );
      await t.test(
        'catálogo inteiro carrega fontes com glifos PT-BR reais',
        async () => {
          const pairs = [
            ...Object.keys(DISPLAY_TYPE).map((display) => [display, 'source']),
            ...Object.keys(BODY_TYPE).map((body) => ['sans', body]),
          ];
          for (const [display, body] of pairs) {
            await page.goto(
              `${origin}/?vibe=comercial&display=${display}&body=${body}`,
              { waitUntil: 'networkidle0' },
            );
            const ready = await page.evaluate(
              async (names) => {
                await document.fonts.ready;
                return names.map(
                  (name) =>
                    [...document.fonts].some(
                      (font) =>
                        font.status === 'loaded' &&
                        font.family.replaceAll('"', '') === name,
                    ) &&
                    document.fonts.check(
                      `500 24px "${name}"`,
                      'Ação, equilíbrio e coração',
                    ),
                );
              },
              [DISPLAY_TYPE[display].name, BODY_TYPE[body].name],
            );
            assert.deepEqual(ready, [true, true], `${display}/${body}`);
          }
        },
      );
      await t.test(
        'sem JavaScript, texto, fontes, SVG e disclosure continuam disponíveis',
        async () => {
          await page.setJavaScriptEnabled(false);
          await page.goto(`${origin}/?vibe=artistico`, {
            waitUntil: 'networkidle0',
          });
          assert.equal(
            await page.$eval('h1', (node) => node.textContent),
            'Forma para novas ideias.',
          );
          assert.ok(
            await page.$('.site-icon[data-icon-vibe="artistico"] path'),
          );
          await page.click('.site-faq summary');
          assert.equal(
            await page.$eval('.site-faq details', (node) => node.open),
            true,
          );
        },
      );
      await writeFile(
        'outputs/visual-system/verification.json',
        JSON.stringify({ reports, errors }, null, 2),
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
