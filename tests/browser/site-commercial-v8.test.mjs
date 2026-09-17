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
  'Comercial v8 realiza a jornada fixa em desktop, mobile e movimento reduzido',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const root = process.cwd();
    const jiti = createJiti(import.meta.url, {
      alias: { '@': root },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { CommercialV8Fixture } = await jiti.import(
      './fixtures/commercial-v8.tsx',
    );
    const { COMMERCIAL_V8_STRUCTURE_KEYS, SITE_STRUCTURES } = await jiti.import(
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
    assert.match(
      css,
      /\[data-profile-version=(?:["']8["']|8)\]\[data-vibe=(?:["']comercial["']|comercial)\]/,
      'Execute build:vercel antes deste teste.',
    );
    assert.match(css, /commercial-nav-arrive/);
    assert.match(css, /commercial-copy-arrive/);
    assert.match(css, /commercial-hero-image-arrive/);
    const fontClasses = [...css.matchAll(/\.([\w-]+)\{--font-[\w-]+:/g)]
      .map((match) => match[1])
      .join(' ');
    const server = await createServer({
      configFile: false,
      root,
      cacheDir: 'node_modules/.vite/site-commercial-v8',
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
          name: 'commercial-v8-fixture',
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
                createElement(CommercialV8Fixture, {
                  structureKey: structure,
                }),
              );
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(
                await vite.transformIndexHtml(
                  '/',
                  `<!doctype html><html lang="pt-BR" class="${fontClasses}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:"><style>${css}</style></head><body><div id="root">${markup}</div><script type="module" src="/tests/browser/fixtures/commercial-v8.tsx"></script></body></html>`,
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
    await mkdir('outputs/commercial-v8', { recursive: true });
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
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><rect width="1440" height="900" fill="#d8d0b7"/><rect x="70" y="90" width="540" height="720" rx="40" fill="#315e45"/><circle cx="1010" cy="410" r="290" fill="#c58a55"/><path d="M530 840L920 250l430 590Z" fill="#f2e9d5"/></svg>',
          });
        else if (request.url().startsWith('https://maps.google.com/'))
          void request.respond({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>Mapa</title><body style="background:#d9ddd7"></body>',
          });
        else void request.continue();
      });

      for (const structure of COMMERCIAL_V8_STRUCTURE_KEYS)
        await t.test(structure, async () => {
          for (const [width, height] of [
            [390, 844],
            [1440, 1000],
          ]) {
            await page.setViewport({ width, height });
            await page.emulateMediaFeatures([
              { name: 'prefers-reduced-motion', value: 'no-preference' },
            ]);
            await page.goto(`${origin}/?structure=${structure}`, {
              waitUntil: 'networkidle0',
            });
            await page.evaluate(() => document.fonts.ready);
            const entrance =
              width === 1440
                ? await page.evaluate(async () => {
                    const cards = [
                      ...document.querySelectorAll(
                        "[data-block='feature.bento'] article",
                      ),
                    ];
                    const target = cards.at(-1);
                    if (!target) return null;
                    if (target.dataset.motionState !== 'pending')
                      await new Promise((resolve) => {
                        const observer = new MutationObserver(() => {
                          if (target.dataset.motionState !== 'pending') return;
                          observer.disconnect();
                          resolve();
                        });
                        observer.observe(target, {
                          attributes: true,
                          attributeFilter: ['data-motion-state'],
                        });
                      });
                    const previousBehavior =
                      document.documentElement.style.scrollBehavior;
                    document.documentElement.style.scrollBehavior = 'auto';
                    scrollTo(0, 0);
                    await new Promise((resolve) =>
                      requestAnimationFrame(() =>
                        requestAnimationFrame(resolve),
                      ),
                    );
                    const read = () => ({
                      opacity: Number.parseFloat(
                        getComputedStyle(target).opacity,
                      ),
                      transform: getComputedStyle(target).transform,
                      state: target.dataset.motionState,
                      style: target.getAttribute('style') ?? '',
                    });
                    const before = read();
                    target.scrollIntoView({ block: 'center' });
                    const samples = [];
                    for (let index = 0; index < 11; index += 1) {
                      await new Promise((resolve) => setTimeout(resolve, 80));
                      samples.push(read().opacity);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 260));
                    const after = read();
                    scrollTo(0, 0);
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    target.scrollIntoView({ block: 'center' });
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    const afterReentry = read();
                    scrollTo(0, 0);
                    document.documentElement.style.scrollBehavior =
                      previousBehavior;
                    return { before, samples, after, afterReentry };
                  })
                : null;
            const parallax = await page.evaluate(async () => {
              const section = document.querySelector('[data-parallax="true"]');
              const figure = section?.querySelector('figure');
              if (!section || !figure) return null;
              const previousBehavior =
                document.documentElement.style.scrollBehavior;
              document.documentElement.style.scrollBehavior = 'auto';
              section.scrollIntoView({ block: 'center' });
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
              const read = () =>
                Number.parseFloat(
                  getComputedStyle(figure).getPropertyValue(
                    '--site-parallax-y',
                  ) || '0',
                );
              const before = read();
              scrollBy(0, 140);
              const samples = [];
              for (let index = 0; index < 10; index += 1) {
                await new Promise((resolve) => requestAnimationFrame(resolve));
                samples.push(read());
              }
              scrollTo(0, 0);
              document.documentElement.style.scrollBehavior = previousBehavior;
              return { before, samples };
            });
            await page.evaluate(async () => {
              const limit = document.documentElement.scrollHeight - innerHeight;
              const step = Math.max(320, Math.round(innerHeight * 0.75));
              for (let top = 0; top <= limit; top += step) {
                scrollTo(0, top);
                await new Promise((resolve) => setTimeout(resolve, 40));
              }
              scrollTo(0, limit);
              await Promise.all(
                [...document.images].map((image) => {
                  if (image.complete) return Promise.resolve();
                  return new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                  });
                }),
              );
              await new Promise((resolve) => setTimeout(resolve, 1100));
              scrollTo(0, 0);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            });
            const report = await page.evaluate(() => {
              const immersive = [
                ...document.querySelectorAll(
                  "[data-block='media.image'] .site-media-immersive",
                ),
              ];
              const heroMedia = document.querySelector('.site-hero-media');
              const map = document.querySelector("[data-block='media.map']");
              const blocks = [...document.querySelectorAll('.site-block')];
              return {
                width: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                blockTypes: blocks.map((block) => block.dataset.block),
                animated: blocks.filter(
                  (block) => block.dataset.animation !== undefined,
                ).length,
                categoryImages: document.querySelectorAll(
                  "[data-block='feature.bento'] img",
                ).length,
                categoryBoxes: [
                  ...document.querySelectorAll(
                    "[data-block='feature.bento'] .site-bento-item",
                  ),
                ].map((item) => item.getBoundingClientRect().toJSON()),
                categoryImagesLoaded: [
                  ...document.querySelectorAll(
                    "[data-block='feature.bento'] img",
                  ),
                ].every((image) => image.naturalWidth > 0),
                socialLinks: document.querySelectorAll(
                  "[data-block='social.follow'] .site-social-link",
                ).length,
                socialImages: document.querySelectorAll(
                  "[data-block='social.follow'] img",
                ).length,
                galleryImages: document.querySelectorAll(
                  "[data-block='media.gallery'] img",
                ).length,
                immersive: immersive.map((section) =>
                  section.getBoundingClientRect().toJSON(),
                ),
                immersiveLoaded: immersive.every(
                  (section) => section.querySelector('img')?.naturalWidth > 0,
                ),
                heroMedia: heroMedia
                  ? heroMedia.getBoundingClientRect().toJSON()
                  : null,
                mapId: map?.id,
                mapAddress: map?.textContent,
                mapUnits: document.querySelectorAll('.site-map-unit').length,
                mapFrames: document.querySelectorAll('.site-map-unit iframe')
                  .length,
                form: Boolean(
                  document.querySelector('form[action^="/api/form"]'),
                ),
                footer: Boolean(document.querySelector('.site-footer')),
                heroClass: document.querySelector('.site-hero')?.className,
                heroImages: document.querySelectorAll('.site-hero-media img')
                  .length,
                brandLogo: Boolean(
                  document.querySelector('.site-hero-brand-logo'),
                ),
                navLogo: Boolean(document.querySelector('.site-nav-logo')),
                motion: {
                  pending: document.querySelectorAll(
                    '[data-motion-state="pending"]',
                  ).length,
                  running: document.querySelectorAll(
                    '[data-motion-state="running"]',
                  ).length,
                  complete: document.querySelectorAll(
                    '[data-motion-state="complete"]',
                  ).length,
                  runningTargets: [
                    ...document.querySelectorAll(
                      '[data-motion-state="running"]',
                    ),
                  ].map((target) => ({
                    tag: target.tagName,
                    className: target.className,
                    block: target.closest('.site-block')?.dataset.block,
                  })),
                  coverage: blocks
                    .filter(
                      (block) =>
                        block.dataset.block !== 'nav.bar' &&
                        !block.dataset.block?.startsWith('hero.'),
                    )
                    .map((block) => ({
                      block: block.dataset.block,
                      targets: block.querySelectorAll('[data-motion-state]')
                        .length,
                    })),
                },
              };
            });
            assert.ok(
              report.scrollWidth <= width + 1,
              `${structure} ${width}: overflow ${report.scrollWidth}`,
            );
            const expected = [
              'nav.bar',
              ...SITE_STRUCTURES[structure].sequence.map(
                (entry) => entry.split(':')[0],
              ),
              'footer.compact',
            ];
            assert.deepEqual(
              report.blockTypes,
              expected,
              `${structure} ${width}`,
            );
            assert.equal(
              report.animated,
              expected.length,
              `${structure} ${width}`,
            );
            assert.equal(report.categoryImages, 6, `${structure} ${width}`);
            if (width === 1440) {
              const cardWidths = report.categoryBoxes.map((box) => box.width);
              assert.ok(
                Math.max(...cardWidths) - Math.min(...cardWidths) <= 2,
                `${structure}: setores precisam formar uma grade 3 × 2`,
              );
              assert.equal(
                new Set(report.categoryBoxes.map((box) => Math.round(box.top)))
                  .size,
                2,
                `${structure}: setores precisam ocupar duas linhas`,
              );
            }
            assert.equal(
              report.categoryImagesLoaded,
              true,
              `${structure} ${width}`,
            );
            assert.equal(report.socialLinks, 2, `${structure} ${width}`);
            assert.equal(report.socialImages, 6, `${structure} ${width}`);
            assert.equal(report.galleryImages, 6, `${structure} ${width}`);
            assert.equal(report.immersive.length, 2, `${structure} ${width}`);
            for (const rect of report.immersive) {
              assert.ok(
                rect.height >= height * 0.5,
                `${structure} ${width}: faixa ${rect.height}`,
              );
              assert.ok(rect.width >= width - 1, `${structure} ${width}`);
            }
            assert.equal(report.immersiveLoaded, true, `${structure} ${width}`);
            assert.equal(report.mapId, 'onde-estamos', `${structure} ${width}`);
            assert.match(report.mapAddress, /Rua da Praça, 100/);
            assert.match(report.mapAddress, /Dois Córregos/);
            assert.match(report.mapAddress, /Mineiros do Tietê/);
            assert.equal(report.mapUnits, 3, `${structure} ${width}`);
            assert.equal(report.mapFrames, 3, `${structure} ${width}`);
            assert.equal(report.form, true, `${structure} ${width}`);
            assert.equal(report.footer, true, `${structure} ${width}`);
            assert.match(report.heroClass, /site-hero-brand/);
            assert.equal(report.heroImages, 1);
            assert.ok(report.heroMedia.width >= width - 1);
            assert.ok(Math.abs(report.heroMedia.left) <= 1);
            assert.equal(report.brandLogo, false);
            assert.equal(report.navLogo, true);
            assert.ok(parallax);
            assert.notEqual(parallax.before, parallax.samples.at(-1));
            const parallaxDirection = Math.sign(
              parallax.samples.at(-1) - parallax.before,
            );
            for (let index = 1; index < parallax.samples.length; index += 1)
              assert.ok(
                (parallax.samples[index] - parallax.samples[index - 1]) *
                  parallaxDirection >=
                  -0.01,
                JSON.stringify(parallax),
              );
            assert.equal(report.motion.pending, 0, `${structure} ${width}`);
            assert.equal(
              report.motion.running,
              0,
              `${structure} ${width}: ${JSON.stringify(report.motion.runningTargets)}`,
            );
            assert.ok(report.motion.complete >= 20, `${structure} ${width}`);
            assert.ok(
              report.motion.coverage.every(({ targets }) => targets > 0),
              `${structure} ${width}: ${JSON.stringify(report.motion.coverage)}`,
            );
            if (entrance) {
              assert.equal(entrance.before.opacity, 0);
              assert.equal(entrance.before.state, 'pending');
              assert.match(entrance.before.transform, /12/);
              assert.ok(
                entrance.samples.some((opacity) => opacity > 0 && opacity < 1),
                JSON.stringify(entrance),
              );
              for (let index = 1; index < entrance.samples.length; index += 1)
                assert.ok(
                  entrance.samples[index] + 0.015 >=
                    entrance.samples[index - 1],
                  JSON.stringify(entrance),
                );
              assert.equal(entrance.after.opacity, 1);
              assert.equal(entrance.after.state, 'complete');
              assert.equal(entrance.after.transform, 'none');
              assert.doesNotMatch(
                entrance.after.style,
                /opacity|transform|will-change/,
              );
              assert.equal(entrance.afterReentry.opacity, 1);
              assert.equal(entrance.afterReentry.state, 'complete');
            }
            await page.screenshot({
              path:
                width === 1440
                  ? `outputs/commercial-v8/${structure}.png`
                  : `outputs/commercial-v8/${structure}-mobile.png`,
              fullPage: true,
            });
          }

          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ]);
          await page.reload({ waitUntil: 'networkidle0' });
          const reduced = await page.evaluate(() => ({
            visible: [...document.querySelectorAll('.site-block')].every(
              (block) => getComputedStyle(block).opacity === '1',
            ),
            states: document.querySelectorAll('[data-motion-state]').length,
            inlineHidden: [
              ...document.querySelectorAll('.site-block [style]'),
            ].filter((element) => element.style.opacity === '0').length,
            heroAnimations:
              document
                .querySelector('.site-hero')
                ?.getAnimations({ subtree: true }).length ?? 0,
          }));
          assert.equal(
            reduced.visible,
            true,
            `${structure}: movimento reduzido`,
          );
          assert.equal(reduced.states, 0, `${structure}: movimento reduzido`);
          assert.equal(
            reduced.inlineHidden,
            0,
            `${structure}: movimento reduzido`,
          );
          assert.equal(
            reduced.heroAnimations,
            0,
            `${structure}: movimento reduzido`,
          );
        });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
