import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

/**
 * A cor do operador e o brilho da vibe, medidos no CSS de produção.
 *
 * Reproduz o Skinão: o chat gravou #b80505 no rodapé das quatro páginas
 * ("vermelho chapado sem efeitos", três vezes), o servidor mediu branco sobre
 * vermelho em 7:1 e aprovou, e o navegador pintou creme na metade de cima
 * porque a lavagem da comercial v3/v4 empatava em especificidade e vinha
 * depois. Aqui a medição é no pixel. Ver docs/archive/gradient-technique-plan-2026-09-13.md.
 */

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';

/** Casos reais do banco, com a vibe, o perfil e o motivo efetivamente no ar. */
const CASES = [
  { name: 'skinao', vibe: 'comercial', motif: 'wash', operator: '#b80505' },
  { name: 'uptax', vibe: 'comercial', motif: 'corners', operator: '#2b2f36' },
  { name: 'villa', vibe: 'landing', motif: 'wash', operator: '#0f3d2e' },
  { name: 'fisk', vibe: 'artistico', motif: 'rings', operator: '#3b2a1f' },
  { name: 'comercial-wash', vibe: 'comercial', motif: 'wash' },
  { name: 'comercial-none', vibe: 'comercial', motif: 'none' },
  { name: 'landing-wash', vibe: 'landing', motif: 'wash' },
  { name: 'artistico-rings', vibe: 'artistico', motif: 'rings' },
];

function toRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

function channel(value) {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (
    (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
  );
}

/** Pixels reais de um elemento, em RGB, a partir da captura do navegador. */
async function pixelsOf(handle) {
  const png = await handle.screenshot({ type: 'png' });
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    at(x, y) {
      const i = (y * info.width + x) * 3;
      return [data[i], data[i + 1], data[i + 2]];
    },
  };
}

await test(
  'a cor do operador fica chapada e o brilho da vibe sustenta o texto',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    // Depois de build:vercel: o CSS emitido também prova a precedência entre
    // site.css, as folhas de vibe e operator.css, que é a origem do defeito.
    const directory = path.join(process.cwd(), '.next/static/chunks');
    const css = (
      await Promise.all(
        (await readdir(directory))
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(path.join(directory, file), 'utf8')),
      )
    )
      .filter((sheet) => sheet.includes('.site-theme'))
      .join('\n');
    assert.match(
      css,
      /data-motif=['"]?wash/,
      'Execute npm run build:vercel antes deste teste.',
    );
    assert.match(css, /data-tone=['"]?custom/);

    const jiti = createJiti(import.meta.url, {
      alias: { '@': process.cwd() },
      jsx: { runtime: 'automatic' },
      fsCache: false,
      moduleCache: false,
    });
    const { RenderBlocks } = await jiti.import('../../lib/blocks/render.tsx');
    const { themeVars } = await jiti.import('../../lib/blocks/theme.ts');
    const { blockSchemas } = await jiti.import('../../lib/blocks/registry.ts');

    // Paleta do Skinão: acento amarelo e destaque vermelho, que é a combinação
    // em que a lavagem antiga ficava mais visível.
    const palette = {
      ink: '#1f2937',
      paper: '#ffffff',
      accent: '#ffdd00',
      accentAlt: '#fffbeb',
      highlight: '#b80505',
    };
    const block = (type, props) => ({
      id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      props: blockSchemas[type].parse(props),
    });
    const fixtures = CASES.map((testCase) => {
      const brand = { ...palette, vibe: testCase.vibe };
      const tenant = {
        id: testCase.name,
        slug: testCase.name,
        name: 'Fixture',
        brand,
        contacts: { phones: [], addresses: [], emails: [] },
        dials: { motion: 2, variance: 7, density: 4 },
      };
      const presentation = testCase.operator
        ? { background: testCase.operator }
        : undefined;
      const body =
        'Texto de apoio com tamanho suficiente para medir o fundo sob ele.';
      const blocks = [
        block('hero.split', {
          headline: 'Abertura do cliente',
          subtext: body,
          layout: 'offset',
          image: 'https://assets.test/fixture.png',
          cta: { label: 'Contato', href: '/go/wa' },
          ...(presentation ? { presentation } : {}),
        }),
        block('editorial.text', { title: 'Segunda seção', body }),
        block('editorial.text', { title: 'Terceira seção', body }),
        block('footer.compact', {
          logoText: 'Fixture',
          links: [],
          ...(presentation ? { presentation } : {}),
        }),
      ];
      return createElement(
        'div',
        {
          key: testCase.name,
          'data-case': testCase.name,
          className: 'site-theme',
          'data-vibe': testCase.vibe,
          'data-design-version': '4',
          'data-profile-version': '6',
          'data-motif': testCase.motif,
          'data-motion': 'still',
          style: themeVars(brand),
        },
        createElement(RenderBlocks, {
          blocks,
          ctx: { tenant, pagePath: '/', pageType: 'page' },
        }),
      );
    });

    // Hero cover com fundo escuro do operador: o véu preto negava a cor pedida.
    const coverBrand = { ...palette, vibe: 'comercial' };
    const cover = createElement(
      'div',
      {
        key: 'cover',
        'data-case': 'cover',
        className: 'site-theme',
        'data-vibe': 'comercial',
        'data-design-version': '4',
        'data-motif': 'wash',
        'data-motion': 'still',
        style: themeVars(coverBrand),
      },
      createElement(RenderBlocks, {
        blocks: [
          block('hero.split', {
            headline: 'Banner do cliente',
            subtext: 'Texto branco sobre a foto, sustentado pelo véu.',
            layout: 'cover',
            image: 'https://assets.test/fixture.png',
            cta: { label: 'Contato', href: '/go/wa' },
            presentation: { background: '#4a0303' },
          }),
        ],
        ctx: {
          tenant: {
            id: 'cover',
            slug: 'cover',
            name: 'Cover',
            brand: coverBrand,
            contacts: { phones: [], addresses: [], emails: [] },
            dials: { motion: 2, variance: 7, density: 4 },
          },
          pagePath: '/',
          pageType: 'page',
        },
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
      page.on('request', (request) =>
        request.url() === 'https://assets.test/fixture.png'
          ? request.respond({
              status: 200,
              contentType: 'image/png',
              body: Buffer.from(PNG, 'base64'),
            })
          : request.abort(),
      );
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1200 });
        await page.setContent(
          `<style>${css}</style><style>*{animation:none!important;transition:none!important}</style>` +
            renderToStaticMarkup([...fixtures, cover]),
          { waitUntil: 'load' },
        );

        const measured = await page.evaluate(() =>
          [...document.querySelectorAll('[data-case]')].flatMap((root) =>
            ['.site-hero', '.site-footer', 'main > .site-block:nth-child(3n)']
              .map((selector) => {
                const element = root.querySelector(selector);
                if (!element) return null;
                const style = getComputedStyle(element);
                const block = element.closest('.site-block') ?? element;
                return {
                  fixture: root.dataset.case,
                  selector,
                  tone: block.dataset.tone ?? null,
                  scrim: block.dataset.scrim ?? null,
                  backgroundImage: style.backgroundImage,
                  backgroundColor: style.backgroundColor,
                  blockImage: getComputedStyle(block).backgroundImage,
                  blockColor: getComputedStyle(block).backgroundColor,
                };
              })
              .filter(Boolean),
          ),
        );

        for (const sample of measured) {
          const testCase = CASES.find((c) => c.name === sample.fixture);
          // O hero cover tem véu próprio e é medido depois, à parte.
          if (!testCase) continue;
          const where = `${width}px ${sample.fixture} ${sample.selector}`;
          if (sample.selector === 'main > .site-block:nth-child(3n)') {
            // A seção intermediária nunca recebeu cor do operador nestes casos:
            // ela mostra o brilho da vibe, ou nada quando o motivo não é wash.
            assert.equal(sample.tone, null, where);
            if (testCase.motif === 'wash')
              assert.match(sample.backgroundImage, /radial-gradient/, where);
            else assert.equal(sample.backgroundImage, 'none', where);
            continue;
          }
          if (testCase?.operator) {
            // A cor do operador é chapada: nenhuma lavagem, brilho ou motivo.
            // Ela vive no bloco; o filho fica transparente e não pode repintar.
            assert.equal(sample.tone, 'custom', where);
            assert.equal(sample.backgroundImage, 'none', where);
            assert.equal(sample.blockImage, 'none', where);
            const [r, g, b] = toRgb(testCase.operator);
            assert.equal(sample.blockColor, `rgb(${r}, ${g}, ${b})`, where);
            assert.equal(sample.backgroundColor, 'rgba(0, 0, 0, 0)', where);
            continue;
          }
          // Sem cor do operador, a vibe pinta luz: radial, nunca uma reta nem
          // uma faixa de 1 px.
          assert.match(sample.backgroundImage, /radial-gradient/, where);
          assert.doesNotMatch(sample.backgroundImage, /1px|repeating/, where);
          assert.ok(
            !/linear-gradient/.test(sample.backgroundImage),
            `${where}: ${sample.backgroundImage}`,
          );
        }

        // O véu do hero cover usa o papel da seção, não o preto.
        const scrim = await page.evaluate(() => {
          const root = document.querySelector('[data-case="cover"]');
          const copy = root.querySelector('.site-hero-copy');
          const media = root.querySelector('.site-hero-media');
          return {
            scrim: copy.closest('.site-block').dataset.scrim ?? null,
            before: getComputedStyle(copy, '::before').backgroundImage,
            after: getComputedStyle(media, '::after').backgroundImage,
          };
        });
        assert.equal(scrim.scrim, 'paper', `${width}px véu`);
        // O navegador resolve color-mix(in oklab, …) em oklab. O eixo `a`
        // separa um véu na cor da seção de um véu preto ou cinza: o vermelho
        // escuro do operador tem a ≈ 0,09; preto e cinza têm a = 0.
        for (const [name, value] of Object.entries(scrim).slice(1)) {
          const stop = value.match(
            /oklab\(([\d.]+) (-?[\d.]+) (-?[\d.]+) \/ 0\.78\)/,
          );
          assert.ok(stop, `${width}px véu ${name}: ${value}`);
          assert.ok(
            Number(stop[2]) > 0.05,
            `${width}px véu ${name} não usa a cor da seção: ${value}`,
          );
          assert.doesNotMatch(
            value,
            /rgba\(0, 0, 0, 0\.\d/,
            `${width}px véu ${name} ainda é preto`,
          );
        }

        // Pixels: a faixa superior do rodapé com cor do operador é de uma cor
        // só. Com a lavagem antiga o topo era creme e o fim, vermelho.
        for (const testCase of CASES.filter((c) => c.operator)) {
          const handle = await page.$(
            `[data-case="${testCase.name}"] .site-footer`,
          );
          const pixels = await pixelsOf(handle);
          const expected = toRgb(testCase.operator);
          const columns = [...Array(12)].map((_, i) =>
            Math.round(((i + 0.5) * pixels.width) / 12),
          );
          for (let y = 2; y < Math.min(18, pixels.height); y += 4)
            for (const x of columns) {
              const pixel = pixels.at(Math.min(x, pixels.width - 1), y);
              assert.deepEqual(
                pixel,
                expected,
                `${width}px ${testCase.name}: pixel (${x},${y}) não é a cor gravada`,
              );
            }
        }

        // Pixels sob o texto: com o texto invisível, todo ponto amostrado
        // dentro do retângulo de um texto visível mantém 4,5:1 com a cor
        // computada dele. É a medida que a lavagem antiga reprovava.
        const texts = await page.evaluate(() => {
          const visible = (element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 8 && rect.height > 8;
          };
          return [...document.querySelectorAll('[data-case]')]
            .filter((root) => !root.dataset.case.includes('cover'))
            .flatMap((root) =>
              [...root.querySelectorAll('.site-hero, .site-footer')].flatMap(
                (surface) =>
                  [...surface.querySelectorAll('h1, h2, p, li, span')]
                    .filter(
                      (element) =>
                        visible(element) &&
                        element.textContent.trim().length > 8 &&
                        !element.querySelector('h1, h2, p, li, span'),
                    )
                    .map((element) => {
                      const rect = element.getBoundingClientRect();
                      return {
                        fixture: root.dataset.case,
                        color: getComputedStyle(element).color,
                        x: rect.x + scrollX,
                        y: rect.y + scrollY,
                        width: rect.width,
                        height: rect.height,
                      };
                    }),
              ),
            );
        });
        assert.ok(texts.length > 10, `${width}px: poucos textos medidos`);
        await page.addStyleTag({
          content: '*{color:transparent!important}',
        });
        const shot = await page.screenshot({ type: 'png', fullPage: true });
        const { data, info } = await sharp(shot)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let worst = { ratio: Infinity };
        for (const text of texts) {
          const ink = text.color.match(/\d+/g).slice(0, 3).map(Number);
          for (let row = 1; row <= 4; row += 1)
            for (let column = 1; column <= 6; column += 1) {
              const x = Math.round(text.x + (column / 7) * text.width);
              const y = Math.round(text.y + (row / 5) * text.height);
              if (x < 0 || y < 0 || x >= info.width || y >= info.height)
                continue;
              const i = (y * info.width + x) * 3;
              const measure = ratio(ink, [data[i], data[i + 1], data[i + 2]]);
              if (measure < worst.ratio)
                worst = { ratio: measure, ...text, x, y };
            }
        }
        assert.ok(
          worst.ratio >= 4.5,
          `${width}px: fundo sob o texto em ${worst.ratio?.toFixed(2)}:1 (${worst.fixture}, ${worst.x},${worst.y})`,
        );
        t.diagnostic(
          `${width}px: ${measured.length} superfícies, ${texts.length} textos; pior fundo sob texto ${worst.ratio.toFixed(2)}:1.`,
        );
      }
    } finally {
      await browser.close();
    }
  },
);
