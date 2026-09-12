import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import { referenceDirection } from '../helpers/reference-fixture.mjs';

await test(
  'logo e pre-flight seguem o papel do CSS de produção em desktop e celular',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const j = createJiti(import.meta.url, {
      alias: { '@': process.cwd() },
      jsx: { runtime: 'automatic' },
      fsCache: false,
    });
    const { RenderBlocks } = await j.import('../../lib/blocks/render.tsx');
    const { themeVars, surfaceOf } = await j.import(
      '../../lib/blocks/theme.ts',
    );
    const { renderingVibeOf } = await j.import('../../lib/design/vibes.ts');
    const { logoFindings } = await j.import('../../lib/images/logo-fit.ts');
    const sheets = await Promise.all(
      (await readdir('.next/static/chunks'))
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
    );
    const css = sheets
      .filter((sheet) => sheet.includes('.site-theme'))
      .join('\n');
    assert.ok(
      css.includes('.site-nav-contrast'),
      'Execute build:vercel antes do teste.',
    );
    const logo = 'https://assets.test/logo.png';
    const white = 'https://assets.test/branca.png';
    const dark = {
      vibe: 'moderno',
      paper: '#0b0e14',
      ink: '#f5f5f4',
      logoUrl: logo,
      logoDarkUrl: white,
      logoFit: {
        source: logo,
        plate: null,
        opaqueLuminance: 0.01,
        lightFraction: 0,
        darkFraction: 1,
      },
    };
    const light = {
      ...dark,
      vibe: 'comercial',
      paper: '#ffffff',
      ink: '#14161a',
    };
    const cases = [
      ...[2, 3, 4].map((version) => ({
        name: `moderno-v${version}`,
        brand: { ...dark, design: { version } },
        presentation: { tone: 'ink' },
        nav: white,
        footer: white,
      })),
      {
        name: 'referencia-legada',
        brand: { ...dark, design: { version: 3, referenceDirection } },
        presentation: { tone: 'ink' },
        nav: logo,
        footer: logo,
      },
      {
        name: 'referencia-v4',
        brand: { ...dark, design: { version: 4, referenceDirection } },
        presentation: { tone: 'ink' },
        nav: white,
        footer: white,
      },
      {
        name: 'soft-sem-surface',
        brand: light,
        presentation: { tone: 'soft' },
        nav: white,
        footer: white,
      },
      {
        name: 'soft-explicito',
        brand: { ...light, surface: '#eeeeee' },
        presentation: { tone: 'soft' },
        nav: logo,
        footer: logo,
      },
      {
        name: 'lavagem-artistica',
        brand: {
          ...light,
          vibe: 'artistico',
          surface: '#0b0e14',
          accentAlt: '#315b48',
        },
        presentation: { tone: 'soft' },
        nav: logo,
        footer: logo,
      },
      {
        name: 'contraste-pelo-perfil',
        brand: { ...light, design: { navigation: 'contrast' } },
        nav: white,
        footer: logo,
      },
      {
        name: 'layout-local-prevalece',
        brand: { ...light, design: { navigation: 'contrast' } },
        layout: 'bar',
        nav: logo,
        footer: logo,
      },
      {
        name: 'contraste-no-moderno',
        brand: { ...dark, design: { navigation: 'contrast' } },
        presentation: { tone: 'ink' },
        nav: logo,
        footer: white,
      },
      {
        name: 'fundo-local',
        brand: dark,
        presentation: { tone: 'ink', background: '#ffffff' },
        nav: logo,
        footer: logo,
      },
      {
        name: 'contraste-sobre-fundo-local',
        brand: { ...light, design: { navigation: 'contrast' } },
        presentation: { background: '#ffffff' },
        nav: white,
        footer: logo,
      },
    ];
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const tab = await browser.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      await tab.setRequestInterception(true);
      tab.on('request', (request) => {
        if (request.url().startsWith('https://assets.test/'))
          void request.respond({
            status: 200,
            contentType: 'image/svg+xml',
            body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="5" y="45" font-size="48" font-family="sans-serif" font-weight="700" fill="${request.url() === white ? '#ffffff' : '#14161a'}">LOGO</text></svg>`,
          });
        else void request.abort();
      });
      await tab.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      await mkdir('outputs/review-33', { recursive: true });
      for (const scenario of cases) {
        const { brand, presentation, layout } = scenario;
        const tenant = {
          id: 'fixture',
          slug: 'fixture',
          name: 'Fixture',
          brand,
          dials: { motion: 1 },
          contacts: { phones: [], addresses: [], social: [] },
          whatsapp: null,
        };
        const blocks = [
          {
            id: 'nav',
            type: 'nav.bar',
            props: { logoText: 'Fixture', links: [], presentation, layout },
          },
          {
            id: 'footer',
            type: 'footer.compact',
            props: { logoText: 'Fixture', links: [], presentation },
          },
        ];
        const markup = renderToStaticMarkup(
          createElement(
            'div',
            {
              className: 'site-theme',
              'data-vibe': renderingVibeOf(brand),
              'data-design-version':
                brand.design?.referenceDirection && brand.design?.version !== 4
                  ? 'reference'
                  : brand.design?.version,
              'data-reference-aspects':
                brand.design?.referenceDirection?.decisions
                  .map((decision) => decision.aspect)
                  .join(' '),
              style: themeVars(brand),
            },
            createElement(RenderBlocks, {
              blocks,
              ctx: { tenant, pagePath: '/', pageType: 'page', isPreview: true },
            }),
          ),
        );
        // A mesma marca sem variante precisa produzir o aviso nas mesmas superfícies.
        const findings = logoFindings(
          { ...brand, logoDarkUrl: undefined },
          [{ slug: '', blocks }],
          [],
        );
        assert.equal(
          findings.some((finding) => finding.rule === 'logo-fundo-escuro'),
          scenario.nav === white || scenario.footer === white,
          scenario.name,
        );
        for (const width of [1440, 390]) {
          const label = `${scenario.name} ${width}`;
          await tab.setViewport({ width, height: 900 });
          await tab.setContent(
            `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}${css}</style></head><body>${markup}</body></html>`,
          );
          await tab.waitForFunction(() =>
            [
              ...document.querySelectorAll('.site-nav img, .site-footer img'),
            ].every((img) => img.complete && img.naturalWidth > 0),
          );
          const measured = await tab.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const context = canvas.getContext('2d', {
              willReadFrequently: true,
            });
            return ['.site-nav', '.site-footer'].map((selector) => {
              const container = document.querySelector(selector);
              const img = container.querySelector('img');
              // Resolve o papel herdado do CSS, incluindo color-mix, pelo
              // próprio navegador e converte o resultado a um pixel sRGB.
              const probe = document.createElement('span');
              probe.style.backgroundColor = 'var(--paper)';
              container.append(probe);
              context.clearRect(0, 0, 1, 1);
              context.fillStyle = getComputedStyle(probe).backgroundColor;
              context.fillRect(0, 0, 1, 1);
              const paper = [...context.getImageData(0, 0, 1, 1).data].slice(
                0,
                3,
              );
              probe.remove();
              const bounds = img.getBoundingClientRect();
              return {
                src: img.src,
                paper,
                width: bounds.width,
                height: bounds.height,
                right: bounds.right,
              };
            });
          });
          for (const [index, key] of ['nav', 'footer'].entries()) {
            const actual = measured[index];
            assert.equal(actual.src, scenario[key], label);
            const hex = surfaceOf(
              brand,
              presentation?.tone,
              presentation?.background,
              index === 0 ? (layout ?? brand.design?.navigation) : undefined,
            );
            const expected = [1, 3, 5].map((offset) =>
              parseInt(hex.slice(offset, offset + 2), 16),
            );
            assert.ok(
              actual.paper.every(
                (value, channel) => Math.abs(value - expected[channel]) <= 1,
              ),
              `${label} ${key}: CSS ${actual.paper.join(',')}, selector ${expected.join(',')}`,
            );
            assert.ok(
              actual.width > 0 && actual.height > 0 && actual.right <= width,
              label,
            );
          }
          if (scenario.name === 'moderno-v4')
            await tab.screenshot({
              path: `outputs/review-33/logo-corrigido-${width}.png`,
              fullPage: true,
            });
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
