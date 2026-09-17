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
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 120000 },
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
    assert.match(css, /commercial-fade-in/);
    assert.match(css, /commercial-scroll-reveal/);
    assert.match(css, /commercial-image-reveal/);
    assert.doesNotMatch(css, /commercial-copy-arrive/);
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
              // O cliente hidrata a partir da mesma query: ler diferente aqui
              // vira erro de hidratação, que este teste coleta como falha.
              const params = new URL(req.url, 'http://localhost').searchParams;
              const requested = params.get('structure');
              const markup = renderToString(
                createElement(CommercialV8Fixture, {
                  // A página interna não pede estrutura; sem o mesmo padrão do
                  // cliente o render do servidor quebraria e a hidratação
                  // divergiria.
                  structureKey: COMMERCIAL_V8_STRUCTURE_KEYS.includes(requested)
                    ? requested
                    : COMMERCIAL_V8_STRUCTURE_KEYS[0],
                  editing: params.has('editing'),
                  still: params.has('still'),
                  page: params.get('page') === 'interna' ? 'interna' : 'home',
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
            [320, 568],
            [844, 390],
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
            const heroMotion = await page.evaluate(() => {
              const copy = document.querySelector('.site-hero-copy');
              const image = document.querySelector('.site-hero-media img');
              return {
                copyAnimation: copy
                  ? getComputedStyle(copy).animationName
                  : null,
                childAnimations: copy
                  ? [...copy.children].map((child) => ({
                      className: child.className,
                      animation: getComputedStyle(child).animationName,
                    }))
                  : [],
                imageAnimation: image
                  ? getComputedStyle(image).animationName
                  : null,
              };
            });
            await page.waitForSelector('[data-motion-kind="image"]');
            const entrance = await page.evaluate(async () => {
              const card = document.querySelector(
                "[data-block='feature.bento'] article",
              );
              const target = card?.querySelector('[data-motion-kind="reveal"]');
              const imageTarget = card?.querySelector(
                '[data-motion-kind="image"][data-motion-role="image"]',
              );
              if (!target || !imageTarget) return null;
              const previousBehavior =
                document.documentElement.style.scrollBehavior;
              document.documentElement.style.scrollBehavior = 'auto';
              scrollTo(0, 0);
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
              const readTarget = (element) => ({
                opacity: Number.parseFloat(getComputedStyle(element).opacity),
                transform: getComputedStyle(element).transform,
                clip: getComputedStyle(element).clipPath,
                state: element.dataset.motionState,
                kind: element.dataset.motionKind,
                role: element.dataset.motionRole,
                style: element.getAttribute('style') ?? '',
              });
              const read = () => ({
                reveal: readTarget(target),
                image: readTarget(imageTarget),
              });
              const before = read();
              target.scrollIntoView({ block: 'center' });
              const samples = [];
              for (let index = 0; index < 11; index += 1) {
                await new Promise((resolve) => setTimeout(resolve, 80));
                samples.push(read());
              }
              await new Promise((resolve) => setTimeout(resolve, 440));
              const after = read();
              scrollTo(0, 0);
              await new Promise((resolve) => setTimeout(resolve, 100));
              target.scrollIntoView({ block: 'center' });
              await new Promise((resolve) => setTimeout(resolve, 100));
              const afterReentry = read();
              scrollTo(0, 0);
              document.documentElement.style.scrollBehavior = previousBehavior;
              return { before, samples, after, afterReentry };
            });
            const laterImages = await page.evaluate(async () => {
              const images = [
                ...document.querySelectorAll('.site-social-images > img'),
              ];
              document.documentElement.style.scrollBehavior = 'auto';
              scrollTo(
                0,
                images[0].getBoundingClientRect().top +
                  scrollY -
                  innerHeight +
                  80,
              );
              await new Promise((resolve) => setTimeout(resolve, 1200));
              return images
                .filter(
                  (image) => image.getBoundingClientRect().top >= innerHeight,
                )
                .map((image) => image.dataset.motionState);
            });
            assert.ok(laterImages.length > 0);
            assert.ok(
              laterImages.every((state) => state === 'pending'),
              'Fotos fora da viewport precisam aguardar sua própria entrada',
            );
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
              const previousBehavior =
                document.documentElement.style.scrollBehavior;
              document.documentElement.style.scrollBehavior = 'auto';
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
              await new Promise((resolve) => setTimeout(resolve, 1700));
              scrollTo(0, 0);
              await new Promise((resolve) => setTimeout(resolve, 1400));
              document.documentElement.style.scrollBehavior = previousBehavior;
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
              const intro = document.querySelector('.site-text-bridge');
              const introPanel = intro?.querySelector('.site-text-identity');
              const introCopy = intro?.querySelector('.site-text-copy');
              const motionTargets = [
                ...document.querySelectorAll('[data-motion-kind]'),
              ];
              return {
                intro: intro?.getBoundingClientRect().toJSON(),
                introPanel: introPanel?.getBoundingClientRect().toJSON(),
                introCopy: introCopy?.getBoundingClientRect().toJSON(),
                introText: intro?.textContent,
                heroBottom: document
                  .querySelector('.site-hero')
                  ?.getBoundingClientRect().bottom,
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
                  kinds: Object.fromEntries(
                    ['reveal', 'rise', 'image', 'wipe', 'fade'].map((kind) => [
                      kind,
                      motionTargets.filter(
                        (target) => target.dataset.motionKind === kind,
                      ).length,
                    ]),
                  ),
                  nested: motionTargets.filter((target) =>
                    target.parentElement.closest('[data-motion-kind]'),
                  ).length,
                  imageRoleCount: motionTargets.filter(
                    (target) => target.dataset.motionRole === 'image',
                  ).length,
                  imageRolesAreReveals: motionTargets
                    .filter((target) => target.dataset.motionRole === 'image')
                    .every((target) =>
                      ['image', 'wipe'].includes(target.dataset.motionKind),
                    ),
                  categoryTargets: [
                    ...document.querySelectorAll(
                      "[data-block='feature.bento'] .site-bento-item",
                    ),
                  ].map((item) =>
                    [...item.querySelectorAll('[data-motion-kind]')].map(
                      (target) => target.dataset.motionKind,
                    ),
                  ),
                  formKinds: [
                    ...document.querySelectorAll(
                      "[data-block='form.lead'] [data-motion-kind]",
                    ),
                  ].map((target) => target.dataset.motionKind),
                  mapUnitKinds: [
                    ...document.querySelectorAll(
                      "[data-block='media.map'] .site-map-unit",
                    ),
                  ].map((unit) =>
                    [...unit.querySelectorAll('[data-motion-kind]')].map(
                      (target) => target.dataset.motionKind,
                    ),
                  ),
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
            assert.match(report.introText, /Loja Brotas/);
            assert.match(report.introText, /Rua da Praça, 100/);
            assert.ok(
              Math.abs(report.intro.top - report.heroBottom) < 2,
              'ligação deve começar na base do hero',
            );
            if (width >= 768) {
              assert.ok(
                Math.abs(report.introPanel.width - report.introCopy.width) < 1,
              );
              assert.ok(report.introCopy.left >= report.introPanel.right - 1);
            } else
              assert.ok(report.introCopy.top >= report.introPanel.bottom - 1);
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
            assert.equal(
              heroMotion.copyAnimation,
              'none',
              `${structure} ${width}: o contêiner do hero não pode animar`,
            );
            assert.ok(
              heroMotion.childAnimations.some(
                ({ animation }) => animation === 'commercial-fade-in',
              ),
              `${structure} ${width}: ${JSON.stringify(heroMotion)}`,
            );
            assert.ok(
              heroMotion.childAnimations.some(
                ({ animation }) => animation === 'commercial-scroll-reveal',
              ),
              `${structure} ${width}: ${JSON.stringify(heroMotion)}`,
            );
            assert.equal(
              heroMotion.imageAnimation,
              'commercial-image-reveal',
              `${structure} ${width}`,
            );
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
            assert.ok(report.motion.kinds.reveal >= 8, `${structure} ${width}`);
            assert.ok(report.motion.kinds.rise >= 10, `${structure} ${width}`);
            assert.ok(report.motion.kinds.image >= 13, `${structure} ${width}`);
            assert.ok(report.motion.kinds.wipe >= 2, `${structure} ${width}`);
            assert.ok(report.motion.kinds.fade < report.motion.kinds.rise);
            assert.equal(
              report.motion.nested,
              0,
              'Entradas não podem acumular em pais e filhos',
            );
            assert.ok(
              report.motion.imageRoleCount >= 13,
              `${structure} ${width}`,
            );
            assert.equal(
              report.motion.imageRolesAreReveals,
              true,
              `${structure} ${width}`,
            );
            assert.equal(report.motion.categoryTargets.length, 6);
            assert.ok(
              report.motion.categoryTargets.every(
                (kinds) =>
                  kinds.length === 3 &&
                  kinds[0] === 'image' &&
                  kinds[1] === 'reveal' &&
                  kinds[2] === 'rise',
              ),
              `${structure} ${width}: ${JSON.stringify(report.motion.categoryTargets)}`,
            );
            assert.ok(report.motion.formKinds.length >= 3);
            assert.ok(
              ['reveal', 'rise', 'fade'].every((kind) =>
                report.motion.formKinds.includes(kind),
              ),
              `${structure} ${width}: ${JSON.stringify(report.motion.formKinds)}`,
            );
            assert.equal(report.motion.mapUnitKinds.length, 3);
            assert.ok(
              report.motion.mapUnitKinds.every(
                (kinds) =>
                  kinds.length === 2 &&
                  kinds[0] === 'rise' &&
                  kinds[1] === 'fade',
              ),
              `${structure} ${width}: ${JSON.stringify(report.motion.mapUnitKinds)}`,
            );
            assert.ok(entrance, 'Fotos e títulos precisam de reveals');
            for (const kind of ['reveal', 'image']) {
              assert.equal(entrance.before[kind].state, 'pending');
              assert.equal(
                entrance.before[kind].opacity,
                1,
                'Reveal deve revelar por recorte, sem fade',
              );
              assert.match(entrance.before[kind].clip, /100%/);
              const samples = entrance.samples.map(
                (sample) => sample[kind].clip,
              );
              assert.ok(
                samples.some(
                  (clip) =>
                    clip !== 'none' && clip !== entrance.before[kind].clip,
                ),
                JSON.stringify(entrance),
              );
              assert.equal(entrance.after[kind].state, 'complete');
              assert.equal(entrance.after[kind].transform, 'none');
              assert.equal(entrance.after[kind].clip, 'none');
              assert.doesNotMatch(
                entrance.after[kind].style,
                /opacity|transform|clip-path|will-change/,
              );
              assert.equal(entrance.afterReentry[kind].state, 'complete');
              assert.equal(entrance.afterReentry[kind].clip, 'none');
            }
            await page.screenshot({
              path: `outputs/commercial-v8/${structure}-${width}.png`,
              fullPage: true,
            });
          }

          await page.reload({ waitUntil: 'networkidle0' });
          const focus = await page.evaluate(() => {
            const input = document.querySelector('form input[name=nome]');
            const form = input.closest('form');
            const before = form.dataset.motionState;
            input.focus({ preventScroll: true });
            return {
              before,
              after: form.dataset.motionState,
              opacity: getComputedStyle(form).opacity,
              focused: document.activeElement === input,
            };
          });
          assert.equal(focus.before, 'pending');
          assert.equal(focus.after, 'complete');
          assert.equal(focus.opacity, '1');
          assert.equal(focus.focused, true);
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ]);
          await page.waitForFunction(
            () => !document.querySelector('[data-motion-state]'),
          );
          const reduced = await page.evaluate(() => ({
            visible: [...document.querySelectorAll('.site-block')].every(
              (block) => getComputedStyle(block).opacity === '1',
            ),
            states: document.querySelectorAll('[data-motion-state]').length,
            inlineHidden: [
              ...document.querySelectorAll('.site-block [style]'),
            ].filter((element) => element.style.opacity === '0').length,
            clipped: [
              ...document.querySelectorAll('.site-block [style]'),
            ].filter(
              (element) =>
                element.style.clipPath ||
                element.style.getPropertyValue('--site-parallax-y'),
            ).length,
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
            reduced.clipped,
            0,
            'Redução de movimento em runtime deve limpar recortes e parallax',
          );
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
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'no-preference' },
          ]);
          for (const mode of ['editing', 'still']) {
            await page.goto(`${origin}/?structure=${structure}&${mode}`, {
              waitUntil: 'networkidle0',
            });
            assert.equal(
              await page.$$eval(
                '[data-motion-state]',
                (elements) => elements.length,
              ),
              0,
              mode,
            );
            assert.equal(
              await page.$eval(
                '.site-hero',
                (element) => element.getAnimations({ subtree: true }).length,
              ),
              0,
              mode,
            );
          }
          await page.setJavaScriptEnabled(false);
          await page.goto(`${origin}/?structure=${structure}`, {
            waitUntil: 'networkidle0',
          });
          const staticContent = await page.evaluate(() => ({
            hidden: [
              ...document.querySelectorAll(
                'h2, .site-bento-item, .site-social-image, .site-gallery img, form',
              ),
            ].filter(
              (element) =>
                getComputedStyle(element).opacity !== '1' ||
                getComputedStyle(element).clipPath !== 'none',
            ).length,
            inputs: document.querySelectorAll('form input, form textarea')
              .length,
          }));
          assert.equal(staticContent.hidden, 0);
          assert.ok(staticContent.inputs >= 3);
          await page.setJavaScriptEnabled(true);
        });
      assert.deepEqual(errors, []);

      // A contraparte da interna: na home a barra compõe a fachada. Só a
      // interna era medida, então a sobreposição pôde morrer em toda página
      // sem que nenhum teste acusasse — a barra virou um cabeçalho solto no
      // topo, acima do hero. Medir a home fecha os dois lados da regra.
      await t.test('a home sobrepõe a navegação à fachada', async () => {
        for (const [width, height] of [
          [1440, 900],
          [390, 844],
        ]) {
          await page.setViewport({ width, height });
          await page.goto(origin, { waitUntil: 'networkidle0' });
          const report = await page.evaluate(() => {
            const rect = (el) => {
              const r = el.getBoundingClientRect();
              return { top: r.top, bottom: r.bottom, height: r.height };
            };
            const nav = document.querySelector('.site-nav');
            return {
              nav: rect(nav),
              quadro: rect(nav.closest('.site-block')),
              fachada: rect(document.querySelector('.site-hero-brand')),
              headline: rect(document.querySelector('.site-headline')),
              overflow:
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
            };
          });
          const onde = `${width}x${height}`;
          assert.ok(
            report.quadro.height <= 1,
            `a navegação da home reserva cabeçalho próprio em ${onde}: quadro de ${report.quadro.height}px`,
          );
          assert.ok(
            report.nav.top >= report.fachada.top &&
              report.nav.bottom <= report.fachada.bottom,
            `a barra da home não está sobre a fachada em ${onde}: barra ${report.nav.top}–${report.nav.bottom}, fachada ${report.fachada.top}–${report.fachada.bottom}`,
          );
          assert.ok(
            report.headline.top >= report.nav.bottom,
            `a barra cobre o título da home em ${onde}`,
          );
          assert.ok(
            report.overflow <= 1,
            `rolagem horizontal de ${report.overflow}px em ${onde}`,
          );
        }
      });
      assert.deepEqual(errors, []);

      // A navegação v8 é posicionada por cima de um quadro de altura zero, o
      // que só funciona sobre o hero de fachada. A regra valia em toda página e
      // a barra cobria o título das internas. Medir o título não bastaria: o
      // respiro que a correção dá às aberturas internas já o empurra para
      // baixo mesmo com a regra antiga. O que distingue é o quadro da
      // navegação ocupar altura e a abertura começar abaixo dela.
      await t.test('página interna reserva o cabeçalho', async () => {
        for (const [width, height] of [
          [1440, 900],
          [390, 844],
        ]) {
          await page.setViewport({ width, height });
          await page.goto(`${origin}/?page=interna`, {
            waitUntil: 'networkidle0',
          });
          const report = await page.evaluate(() => {
            const rect = (el) => {
              const r = el.getBoundingClientRect();
              return { top: r.top, bottom: r.bottom, height: r.height };
            };
            const nav = document.querySelector('.site-nav');
            return {
              nav: rect(nav),
              quadro: rect(nav.closest('.site-block')),
              abertura: rect(document.querySelector('.site-hero')),
              headline: rect(document.querySelector('.site-headline')),
              overflow:
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
            };
          });
          const onde = `${width}x${height}`;
          assert.ok(
            report.quadro.height >= report.nav.height - 1,
            `o bloco da navegação está colapsado na interna em ${onde}: ${report.quadro.height}px para uma barra de ${report.nav.height}px`,
          );
          assert.ok(
            report.abertura.top >= report.nav.bottom - 1,
            `a abertura interna passa por baixo da barra em ${onde}: seção em ${report.abertura.top}, barra até ${report.nav.bottom}`,
          );
          assert.ok(
            report.headline.top >= report.nav.bottom,
            `a barra cobre o título da interna em ${onde}`,
          );
          assert.ok(
            report.overflow <= 1,
            `rolagem horizontal de ${report.overflow}px em ${onde}`,
          );
        }
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
