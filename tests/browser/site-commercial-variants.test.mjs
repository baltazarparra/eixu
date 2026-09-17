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

/**
 * As combinações da Comercial v8 e a página interna. O pre-flight só examina a
 * home, então a abertura interna — onde a barra cobria o título — não tem outro
 * validador além deste arquivo.
 */
await test(
  'Comercial v8 compõe todas as combinações e não cobre o título nas internas',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 300000 },
  async (t) => {
    const root = process.cwd();
    const jiti = createJiti(import.meta.url, {
      alias: { '@': root },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { CommercialV8Fixture, parseVariants } = await jiti.import(
      './fixtures/commercial-v8.tsx',
    );
    const { COMMERCIAL_VARIANTS } = await jiti.import(
      '../../lib/design/commercial-variants.ts',
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
    const fontClasses = [...css.matchAll(/\.([\w-]+)\{--font-[\w-]+:/g)]
      .map((match) => match[1])
      .join(' ');

    const server = await createServer({
      configFile: false,
      root,
      cacheDir: 'node_modules/.vite/site-commercial-variants',
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
          name: 'commercial-variants-fixture',
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
              const params = new URL(req.url, 'http://localhost').searchParams;
              const markup = renderToString(
                createElement(CommercialV8Fixture, {
                  structureKey: 'comercial-marca',
                  variants: parseVariants(params.get('variants')),
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

    /** Abre a página, coleta erros de console e devolve o relatório pedido. */
    const open = async (query, width, height, collect) => {
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
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><rect width="1440" height="900" fill="#d8d0b7"/><circle cx="720" cy="450" r="300" fill="#315e45"/></svg>',
          });
        else if (request.url().startsWith('https://maps.google.com/'))
          void request.respond({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>mapa</title>',
          });
        else void request.continue();
      });
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(`${origin}/?${query}`, { waitUntil: 'networkidle0' });
      const report = await page.evaluate(collect);
      await page.close();
      return { report, errors };
    };

    try {
      const combinacoes = [];
      for (const navegacao of COMMERCIAL_VARIANTS.navegacao)
        for (const abertura of COMMERCIAL_VARIANTS.abertura)
          for (const ligacao of COMMERCIAL_VARIANTS.ligacao)
            for (const setores of COMMERCIAL_VARIANTS.setores)
              combinacoes.push({
                navegacao: navegacao.key,
                abertura: abertura.key,
                ligacao: ligacao.key,
                setores: setores.key,
                query: `variants=navegacao:${navegacao.key},abertura:${abertura.key},ligacao:${ligacao.key},setores:${setores.key}`,
                setoresEsperados: setores.items.exact,
                aberturaLayout: abertura.signature.split(':')[1],
                ligacaoLayout: ligacao.signature.split(':')[1],
                navLayout: navegacao.signature.split(':')[1],
                setoresLayout: setores.signature.split(':')[1],
              });
      assert.equal(combinacoes.length, 16);

      for (const combinacao of combinacoes)
        await t.test(
          `${combinacao.navegacao} · ${combinacao.abertura} · ${combinacao.ligacao} · ${combinacao.setores}`,
          async () => {
            for (const [width, height] of [
              [1440, 900],
              [390, 844],
            ]) {
              const { report, errors } = await open(
                combinacao.query,
                width,
                height,
                () => {
                  const nav = document.querySelector('.site-nav');
                  const hero = document.querySelector('.site-hero');
                  const headline = document.querySelector('.site-headline');
                  const bento = document.querySelector('.site-bento');
                  const bridge = document.querySelector('.site-text-grid');
                  const rect = (el) => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { top: r.top, bottom: r.bottom, height: r.height };
                  };
                  return {
                    navClass: nav?.className ?? '',
                    heroClass: hero?.className ?? '',
                    bentoClass: bento?.className ?? '',
                    bridgeClass: bridge?.closest('section')?.className ?? '',
                    itens: document.querySelectorAll('.site-bento-item').length,
                    fotosSetores: document.querySelectorAll(
                      '.site-bento-item img',
                    ).length,
                    nav: rect(nav),
                    headline: rect(headline),
                    overflow:
                      document.documentElement.scrollWidth -
                      document.documentElement.clientWidth,
                    quebradas: [...document.images].filter(
                      (img) => img.complete && img.naturalWidth === 0,
                    ).length,
                  };
                },
              );
              const onde = `${combinacao.query} em ${width}x${height}`;
              assert.deepEqual(errors, [], `erros de console em ${onde}`);
              assert.ok(
                report.navClass.includes(`site-nav-${combinacao.navLayout}`),
                `navegação ${combinacao.navLayout} não renderizou em ${onde}`,
              );
              assert.ok(
                report.heroClass.includes(
                  `site-hero-${combinacao.aberturaLayout}`,
                ),
                `abertura ${combinacao.aberturaLayout} não renderizou em ${onde}`,
              );
              assert.ok(
                report.bridgeClass.includes(
                  `site-text-${combinacao.ligacaoLayout}`,
                ),
                `ligação ${combinacao.ligacaoLayout} não renderizou em ${onde}`,
              );
              assert.ok(
                report.bentoClass.includes(
                  `site-bento-${combinacao.setoresLayout}`,
                ),
                `setores ${combinacao.setoresLayout} não renderizou em ${onde}`,
              );
              assert.equal(
                report.itens,
                combinacao.setoresEsperados,
                `contagem de setores em ${onde}`,
              );
              assert.equal(
                report.fotosSetores,
                combinacao.setoresEsperados,
                `cada setor precisa da sua imagem em ${onde}`,
              );
              assert.equal(report.quebradas, 0, `imagem quebrada em ${onde}`);
              assert.ok(
                report.overflow <= 1,
                `rolagem horizontal de ${report.overflow}px em ${onde}`,
              );
              // A barra só sobrepõe no par flutuante mais fachada de largura
              // cheia; nas outras três ela ocupa altura própria acima do hero.
              const sobrepoe =
                combinacao.navLayout === 'bar' &&
                combinacao.aberturaLayout === 'brand';
              assert.equal(
                report.nav.top < 1 && report.nav.height > 0,
                true,
                `a barra precisa abrir a página em ${onde}`,
              );
              if (!sobrepoe)
                assert.ok(
                  report.headline.top >= report.nav.bottom - 1,
                  `a barra cobre o título da home em ${onde}: título em ${report.headline.top}, barra até ${report.nav.bottom}`,
                );
              else
                assert.ok(
                  report.headline.top >= report.nav.bottom - 1,
                  `mesmo sobreposta a barra não pode cobrir o título em ${onde}`,
                );
            }
          },
        );

      for (const navegacao of COMMERCIAL_VARIANTS.navegacao)
        await t.test(`página interna com ${navegacao.key}`, async () => {
          for (const [width, height] of [
            [1440, 900],
            [390, 844],
          ]) {
            const { report, errors } = await open(
              `page=interna&variants=navegacao:${navegacao.key}`,
              width,
              height,
              () => {
                const nav = document.querySelector('.site-nav');
                const headline = document.querySelector('.site-headline');
                const rect = (el) => {
                  const r = el.getBoundingClientRect();
                  return { top: r.top, bottom: r.bottom, height: r.height };
                };
                return {
                  nav: rect(nav),
                  // O bloco da navegação, que é o que a vibe colapsava para
                  // altura zero em toda página.
                  quadro: rect(nav.closest('.site-block')),
                  abertura: rect(document.querySelector('.site-hero')),
                  headline: rect(headline),
                  overflow:
                    document.documentElement.scrollWidth -
                    document.documentElement.clientWidth,
                };
              },
            );
            const onde = `interna/${navegacao.key} em ${width}x${height}`;
            assert.deepEqual(errors, [], `erros de console em ${onde}`);
            // A asserção que distingue a correção do acaso: numa página interna
            // o bloco da navegação ocupa altura e a abertura começa abaixo
            // dela. Só medir o título passaria mesmo com a barra sobreposta,
            // porque o respiro da abertura interna já o empurra para baixo.
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
              `a barra cobre o título da interna em ${onde}: título em ${report.headline.top}, barra até ${report.nav.bottom}`,
            );
            assert.ok(
              report.overflow <= 1,
              `rolagem horizontal de ${report.overflow}px em ${onde}`,
            );
          }
        });
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
