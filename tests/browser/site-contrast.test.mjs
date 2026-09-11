import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';

await test(
  'hero artístico e localização mantêm contraste no CSS de produção',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    // O comando roda depois de build:vercel. Usar o CSS emitido também testa
    // a precedência entre estilos do site, utilitários e as regras da vibe.
    const directory = path.join(process.cwd(), '.next/static/chunks');
    const files = (await readdir(directory)).filter((file) =>
      file.endsWith('.css'),
    );
    const sheets = await Promise.all(
      files.map((file) => readFile(path.join(directory, file), 'utf8')),
    );
    const css = sheets
      .filter(
        (sheet) =>
          sheet.includes('.site-theme') ||
          sheet.includes('.site-location-title'),
      )
      .join('\n');
    assert.ok(
      css.includes('data-vibe'),
      'Execute npm run build:vercel antes deste teste.',
    );
    assert.ok(css.includes('.site-location-title'));

    const jiti = createJiti(import.meta.url, {
      alias: { '@': process.cwd() },
      jsx: { runtime: 'automatic' },
      fsCache: false,
      moduleCache: false,
    });
    const { RenderBlocks } = await jiti.import('../../lib/blocks/render.tsx');
    const { themeVars } = await jiti.import('../../lib/blocks/theme.ts');
    const { blockSchemas } = await jiti.import('../../lib/blocks/registry.ts');
    const { contactsSchema } = await jiti.import(
      '../../lib/tenant-contacts.ts',
    );
    const contacts = contactsSchema.parse({
      phones: [
        { number: '+1 415 555 2671', whatsapp: false },
        { number: '+55 11 99999-0000', whatsapp: true },
      ],
      addresses: [{ label: 'Loja', text: 'Rua das Flores, 123, Fortaleza' }],
    });
    const tones = ['paper', 'soft', 'ink', 'accent', 'secondary'];
    const palettes = [
      {
        ink: '#14161a',
        paper: '#ffffff',
        surface: '#fffefc',
        accent: '#112233',
        accentAlt: '#000000',
        highlight: '#777777',
      },
      {
        ink: '#14161a',
        paper: '#ffffff',
        surface: '#fffefc',
        accent: '#ffe200',
        accentAlt: '#445566',
        highlight: '#ffffff',
      },
      {
        ink: '#757575',
        paper: '#ffffff',
        surface: '#fffefc',
        accent: '#112233',
        accentAlt: '#000000',
        highlight: '#112233',
      },
    ];
    const fixtures = palettes.flatMap((palette, index) =>
      tones.map((tone) => {
        const brand = { ...palette, vibe: 'artistico' };
        const tenant = {
          id: 'fixture',
          slug: 'fixture',
          name: 'Fixture',
          brand,
          contacts,
          whatsapp: '5511999990000',
          dials: { motion: 2, variance: 7, density: 4 },
        };
        const block = (type, props) => ({
          id: type,
          type,
          props: blockSchemas[type].parse(props),
        });
        const blocks = [
          block('hero.split', {
            headline: 'Conheça o lugar',
            layout: 'offset',
            image: 'https://assets.test/fixture.png',
            cta: { label: 'Contato', href: '/go/wa' },
            presentation: { tone },
          }),
          block('footer.compact', { logoText: 'Fixture', links: [] }),
        ];
        return createElement(
          'div',
          {
            key: `${index}-${tone}`,
            'data-case': `${index}-${tone}`,
            className: 'site-theme',
            'data-vibe': 'artistico',
            style: themeVars(brand),
          },
          createElement(RenderBlocks, {
            blocks,
            ctx: { tenant, pagePath: '/', pageType: 'page' },
          }),
        );
      }),
    );

    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url() === 'https://assets.test/fixture.png') {
          return request.respond({
            status: 200,
            contentType: 'image/png',
            body: Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
              'base64',
            ),
          });
        }
        return request.abort();
      });
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        await page.setContent(
          `<style>${css}</style>${renderToStaticMarkup(fixtures)}`,
          { waitUntil: 'load' },
        );
        const samples = await page.evaluate(() => {
          const canvas = document.createElement('canvas').getContext('2d');
          const luminance = (color) => {
            canvas.fillStyle = color;
            canvas.fillRect(0, 0, 1, 1);
            const [r, g, b] = [...canvas.getImageData(0, 0, 1, 1).data]
              .slice(0, 3)
              .map((v) => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          return [...document.querySelectorAll('[data-case]')].flatMap(
            (root) => {
              return [
                '.site-headline',
                '.site-hero-copy .site-action',
                '.site-location-address',
                '.site-location-route',
              ].map((selector) => {
                const element = root.querySelector(selector);
                const color = getComputedStyle(element).color;
                let background = 'rgba(0, 0, 0, 0)';
                for (
                  let node = element;
                  node && background === 'rgba(0, 0, 0, 0)';
                  node = node.parentElement
                )
                  background = getComputedStyle(node).backgroundColor;
                const first = luminance(color),
                  second = luminance(background);
                return {
                  fixture: root.dataset.case,
                  selector,
                  color,
                  background,
                  ratio:
                    (Math.max(first, second) + 0.05) /
                    (Math.min(first, second) + 0.05),
                };
              });
            },
          );
        });
        for (const sample of samples)
          assert.ok(
            sample.ratio >= 4.5,
            `${width}px ${JSON.stringify(sample)}`,
          );
        assert.equal(
          await page.$eval('a[href^="tel:"]', (link) =>
            link.getAttribute('href'),
          ),
          'tel:+14155552671',
        );
        assert.equal(
          await page.$eval(
            '.site-footer-contacts a[data-track="whatsapp"]',
            (link) => link.getAttribute('href'),
          ),
          '/go/wa?n=0&from=%2F',
        );
        t.diagnostic(
          `${width}px: ${samples.length} pares de texto/fundo, contraste mínimo ${Math.min(...samples.map((sample) => sample.ratio)).toFixed(3)}:1.`,
        );
      }
    } finally {
      await browser.close();
    }
  },
);
