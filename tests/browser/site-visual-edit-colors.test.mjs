import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';

const BACKGROUND = '#27272a';

await test(
  'cor local vence decoração de vibe em hero, rodapé, explorer e fatos',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const directory = '.next/static/chunks';
    const css = (
      await Promise.all(
        (
          await readdir(directory)
        )
          .filter((file) => file.endsWith('.css'))
          .map((file) => readFile(`${directory}/${file}`, 'utf8')),
      )
    )
      .filter((sheet) => sheet.includes('.site-theme'))
      .join('\n');
    assert.ok(
      css.includes('[data-tone=custom]') ||
        css.includes("[data-tone='custom']"),
      'Execute npm run build:vercel antes deste teste.',
    );

    const jiti = createJiti(import.meta.url, {
      alias: { '@': process.cwd() },
      jsx: { runtime: 'automatic' },
      fsCache: false,
      moduleCache: false,
    });
    const { RenderBlocks } = await jiti.import('../../lib/blocks/render.tsx');
    const { SECTION_SURFACE_RULES, themeVars } = await jiti.import(
      '../../lib/blocks/theme.ts',
    );
    const { sectionBackgrounds } = await jiti.import(
      '../../lib/blocks/section-colors.ts',
    );
    const { inspectText } = await jiti.import('../../lib/review/text.ts');
    const { measureEditedBlocks } = await jiti.import(
      '../../lib/review/capture.ts',
    );
    const { visualBlocks, visualTenant } = await jiti.import(
      './fixtures/visual-system.tsx',
    );
    const byType = (type) =>
      structuredClone(visualBlocks.find((block) => block.type === type));
    const fixtures = {
      hero: byType('hero.statement'),
      footer: byType('footer.compact'),
      explorer: byType('feature.explorer'),
      facts: {
        id: 'facts',
        type: 'editorial.facts',
        props: {
          layout: 'ledger',
          title: 'Fatos que orientam a decisão.',
          body: 'Informações legíveis sobre a superfície escolhida.',
          facts: [
            { label: 'Prazo', value: '30 dias' },
            { label: 'Formato', value: 'Entrega única' },
          ],
        },
      },
    };
    const target = {
      hero: '.site-hero',
      footer: '.site-footer',
      explorer: '.site-explorer-panel',
      facts: '.site-facts-ledger dl',
    };
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    t.after(() => browser.close());
    const page = await browser.newPage();
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 900 });
      for (const vibe of [
        'comercial',
        'moderno',
        'ousado',
        'artistico',
        'landing',
      ])
        for (const version of [2, 4, 'reference'])
          for (const [family, source] of Object.entries(fixtures)) {
            const block = structuredClone(source);
            block.props.presentation = {
              ...block.props.presentation,
              background: BACKGROUND,
            };
            const tenant = visualTenant(vibe);
            const markup = renderToStaticMarkup(
              createElement(
                'div',
                {
                  className: 'site-theme',
                  'data-vibe': vibe,
                  'data-design-version': version,
                  'data-motif': 'grid',
                  style: themeVars(tenant.brand),
                },
                createElement(RenderBlocks, {
                  blocks: [block],
                  ctx: { tenant, pagePath: '/', isPreview: true },
                }),
              ),
            );
            await page.setContent(
              `<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body>${markup}</body></html>`,
              { waitUntil: 'load' },
            );
            const measured = await page.$eval(
              `[data-block-id="${block.id}"]`,
              (wrapper, selector) => {
                const child = wrapper.querySelector(selector);
                return {
                  wrapperColor: getComputedStyle(wrapper).backgroundColor,
                  wrapperImage: getComputedStyle(wrapper).backgroundImage,
                  targetColor: getComputedStyle(child).backgroundColor,
                  targetImage: getComputedStyle(child).backgroundImage,
                };
              },
              target[family],
            );
            const label = `${width}px ${vibe} ${version} ${family}`;
            assert.equal(measured.wrapperColor, 'rgb(39, 39, 42)', label);
            assert.equal(measured.wrapperImage, 'none', label);
            assert.equal(measured.targetColor, 'rgba(0, 0, 0, 0)', label);
            assert.equal(measured.targetImage, 'none', label);
            const inspection = await inspectText(
              page,
              { page: '/', viewport: width === 390 ? 'mobile' : 'desktop' },
              { contrast: true, blockIds: [block.id] },
            );
            assert.ok(inspection.contrasts.length > 0, label);
            for (const sample of inspection.contrasts)
              assert.ok(
                sample.ratio >= 4.5,
                `${label}: ${JSON.stringify(sample)}`,
              );
          }
    }

    const surfaceFixtures = {
      'commercial-hero-glow': {
        block: byType('hero.statement'),
        selector: '.site-hero',
        presentation: {},
        context: { blockType: 'hero.statement' },
      },
      'commercial-footer-glow': {
        block: byType('footer.compact'),
        selector: '.site-footer',
        presentation: {},
        context: { blockType: 'footer.compact' },
      },
      'commercial-accent-cta': {
        block: {
          id: 'cta-surface',
          type: 'cta.band',
          props: {
            title: 'Converse sobre a próxima escolha.',
            cta: { label: 'Conversar', href: '#contato' },
          },
        },
        selector: null,
        presentation: { tone: 'accent' },
        context: { blockType: 'cta.band' },
      },
      'commercial-explorer-panel': {
        block: byType('feature.explorer'),
        selector: '.site-explorer-panel',
        presentation: {},
        context: { blockType: 'feature.explorer' },
      },
      'commercial-proof-numbers': {
        block: {
          id: 'proof-surface',
          type: 'proof.strip',
          props: {
            layout: 'numbers',
            items: [
              {
                value: '12',
                label: 'Escolhas',
                evidence: 'A fixture confirma 12 escolhas.',
              },
              {
                value: '3',
                label: 'Etapas',
                evidence: 'A fixture confirma 3 etapas.',
              },
            ],
          },
        },
        selector: '.site-proof-strip-numbers',
        presentation: {},
        context: { blockType: 'proof.strip', layout: 'numbers' },
      },
      'commercial-facts-ledger': {
        block: structuredClone(fixtures.facts),
        selector: '.site-facts-ledger dl',
        presentation: {},
        context: {
          blockType: 'editorial.facts',
          layout: 'ledger',
        },
      },
    };
    assert.deepEqual(
      Object.keys(surfaceFixtures),
      SECTION_SURFACE_RULES.map((rule) => rule.id),
    );
    const commercial = visualTenant('comercial');
    const toRgb = (hex) => {
      const value = hex.slice(1);
      return `rgb(${[0, 2, 4]
        .map((index) => Number.parseInt(value.slice(index, index + 2), 16))
        .join(', ')})`;
    };
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 900 });
      for (const rule of SECTION_SURFACE_RULES) {
        const fixture = surfaceFixtures[rule.id];
        const block = structuredClone(fixture.block);
        block.props.presentation = fixture.presentation;
        const markup = renderToStaticMarkup(
          createElement(
            'div',
            {
              className: 'site-theme',
              'data-vibe': 'comercial',
              'data-design-version': 4,
              style: themeVars(commercial.brand),
            },
            createElement(
              'main',
              null,
              createElement(RenderBlocks, {
                blocks: [block],
                ctx: { tenant: commercial, pagePath: '/', isPreview: true },
              }),
            ),
          ),
        );
        await page.setContent(
          `<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body>${markup}</body></html>`,
          { waitUntil: 'load' },
        );
        const measured = await page.$eval(
          `[data-block-id="${block.id}"]`,
          (wrapper, selector) => {
            const element = selector
              ? wrapper.querySelector(selector)
              : wrapper;
            const style = getComputedStyle(element);
            const source =
              style.backgroundImage.match(/(?:oklab|rgba?)\([^)]*\)/g) ?? [];
            let surface = element;
            while (surface) {
              const color = getComputedStyle(surface).backgroundColor;
              if (color !== 'rgba(0, 0, 0, 0)') {
                source.push(color);
                break;
              }
              surface = surface.parentElement;
            }
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const painter = canvas.getContext('2d');
            return {
              backgroundColor: style.backgroundColor,
              backgroundImage: style.backgroundImage,
              colors: [
                ...new Set(
                  source.flatMap((color) => {
                    painter.clearRect(0, 0, 1, 1);
                    painter.fillStyle = color;
                    painter.fillRect(0, 0, 1, 1);
                    const [r, g, b, a] = painter.getImageData(0, 0, 1, 1).data;
                    return a ? [`rgb(${r}, ${g}, ${b})`] : [];
                  }),
                ),
              ],
            };
          },
          fixture.selector,
        );
        const expected = sectionBackgrounds(
          fixture.presentation,
          commercial.brand,
          fixture.context,
        ).map(toRgb);
        const closeTo = (color, candidate) => {
          const rgb = color.match(/\d+/g).map(Number);
          const target = candidate.match(/\d+/g).map(Number);
          return rgb.every(
            (channel, index) => Math.abs(channel - target[index]) <= 2,
          );
        };
        assert.ok(
          expected.every((color) =>
            measured.colors.some((candidate) => closeTo(color, candidate)),
          ) &&
            measured.colors.every((color) =>
              expected.some((candidate) => closeTo(color, candidate)),
            ),
          `${width}px ${rule.id}: ${JSON.stringify({ measured, expected })}`,
        );
      }
    }

    const decorationFixtures = [
      {
        vibe: 'artistico',
        motif: 'rings',
        block: byType('hero.statement'),
        selector: '.site-hero',
        pseudo: '::after',
      },
      {
        vibe: 'artistico',
        motif: 'wash',
        block: byType('footer.compact'),
        selector: '.site-footer',
      },
      {
        vibe: 'comercial',
        motif: 'stripes',
        block: surfaceFixtures['commercial-accent-cta'].block,
        selector: '.site-cta',
        pseudo: '::before',
        tone: 'accent',
      },
      {
        vibe: 'comercial',
        motif: 'wash',
        block: surfaceFixtures['commercial-proof-numbers'].block,
        selector: '.site-proof-strip-numbers',
      },
    ];
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 900 });
      for (const fixture of decorationFixtures) {
        const tenant = visualTenant(fixture.vibe);
        const block = structuredClone(fixture.block);
        block.props.presentation = {
          ...(fixture.tone ? { tone: fixture.tone } : {}),
          decoration: 'none',
        };
        const markup = renderToStaticMarkup(
          createElement(
            'div',
            {
              className: 'site-theme',
              'data-vibe': fixture.vibe,
              'data-design-version': 4,
              'data-motif': fixture.motif,
              style: themeVars(tenant.brand),
            },
            createElement(RenderBlocks, {
              blocks: [block],
              ctx: { tenant, pagePath: '/', isPreview: true },
            }),
          ),
        );
        await page.setContent(
          `<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body>${markup}</body></html>`,
          { waitUntil: 'load' },
        );
        const measured = await page.$eval(
          `[data-block-id="${block.id}"]`,
          (wrapper, { selector, pseudo }) => {
            const target = wrapper.querySelector(selector);
            return {
              image: getComputedStyle(target).backgroundImage,
              color: getComputedStyle(target).backgroundColor,
              pseudoDisplay: pseudo
                ? getComputedStyle(target, pseudo).display
                : undefined,
            };
          },
          fixture,
        );
        assert.equal(
          measured.image,
          'none',
          `${width}px ${fixture.vibe} ${fixture.selector}`,
        );
        if (fixture.block.type === 'proof.strip')
          assert.equal(
            measured.color,
            'rgba(0, 0, 0, 0)',
            `${width}px ${fixture.vibe} ${fixture.selector}`,
          );
        if (fixture.pseudo)
          assert.equal(
            measured.pseudoDisplay,
            'none',
            `${width}px ${fixture.motif} ${fixture.pseudo}`,
          );
      }
    }

    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 900 });
      const tenant = visualTenant('comercial');
      const block = byType('footer.compact');
      block.props.presentation = {
        background: '#27272a',
        backgroundEnd: '#3f3f46',
        gradient: 'diagonal',
      };
      const markup = renderToStaticMarkup(
        createElement(
          'div',
          {
            className: 'site-theme',
            'data-vibe': 'comercial',
            'data-design-version': 4,
            style: themeVars(tenant.brand),
          },
          createElement(RenderBlocks, {
            blocks: [block],
            ctx: { tenant, pagePath: '/', isPreview: true },
          }),
        ),
      );
      await page.setContent(
        `<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body>${markup}</body></html>`,
        { waitUntil: 'load' },
      );
      const gradient = await page.$eval(
        `[data-block-id="${block.id}"]`,
        (wrapper) => getComputedStyle(wrapper).backgroundImage,
      );
      assert.match(gradient, /^linear-gradient\(160deg,/);
      const inspection = await inspectText(
        page,
        { page: '/', viewport: width === 390 ? 'mobile' : 'desktop' },
        { contrast: true, blockIds: [block.id] },
      );
      assert.ok(inspection.contrasts.length > 0);
      for (const sample of inspection.contrasts)
        assert.ok(sample.ratio >= 4.5, JSON.stringify(sample));
    }

    await page.setContent(
      '<div data-block-id="photo" style="min-height:120px;color:#fff;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=)"><p>Texto sobre foto</p></div>',
    );
    const photoInspection = await inspectText(
      page,
      { page: '/', viewport: 'desktop' },
      { contrast: true, blockIds: ['photo'] },
    );
    assert.equal(photoInspection.contrasts.length, 1);
    assert.equal(photoInspection.contrasts[0].measurable, false);

    const measuredTenant = visualTenant('comercial');
    measuredTenant.brand.design = {
      ...measuredTenant.brand.design,
      version: 2,
    };
    const measuredHero = byType('hero.statement');
    const measuredFooter = byType('footer.compact');
    measuredFooter.props.presentation = {
      background: '#27272a',
      backgroundEnd: '#3f3f46',
      gradient: 'diagonal',
    };
    const measuredMarkup = renderToStaticMarkup(
      createElement(
        'div',
        {
          className: 'site-theme',
          'data-vibe': 'comercial',
          'data-design-version': 2,
          'data-motif': 'grid',
          style: themeVars(measuredTenant.brand),
        },
        createElement(RenderBlocks, {
          blocks: [measuredHero, measuredFooter],
          ctx: {
            tenant: measuredTenant,
            pagePath: '/',
            isPreview: true,
          },
        }),
      ),
    );
    let responseMarkup = measuredMarkup;
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        `<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body>${responseMarkup}</body></html>`,
      );
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      const result = await measureEditedBlocks(
        `http://127.0.0.1:${address.port}`,
        measuredTenant.slug,
        '',
        [measuredHero.id, measuredFooter.id],
      );
      assert.equal(result.status, 'complete');
      assert.equal(result.ok, false);
      assert.match(result.issues.join(' '), /contraste 3,7:1/i);
      assert.doesNotMatch(result.issues.join(' '), /sem pixels/i);
      assert.deepEqual(
        result.viewports.map((viewport) => viewport.width),
        [1440, 390],
      );
      for (const viewport of result.viewports) {
        const heroSurface = viewport.blocks.find(
          (surface) => surface.blockId === measuredHero.id,
        );
        const footerSurface = viewport.blocks.find(
          (surface) => surface.blockId === measuredFooter.id,
        );
        assert.equal(heroSurface.found, true);
        assert.match(heroSurface.backgroundImage, /linear-gradient/);
        assert.equal(heroSurface.unmeasurableTexts, 0);
        assert.ok(heroSurface.visibleTexts > 0);
        assert.ok(heroSurface.minimumContrast < 4.5);
        assert.equal(footerSurface.found, true);
        assert.match(
          footerSurface.backgroundImage,
          /^linear-gradient\(160deg,/,
        );
        assert.equal(footerSurface.unmeasurableTexts, 0);
        assert.ok(footerSurface.visibleTexts > 0);
        assert.ok(footerSurface.minimumContrast >= 4.5);
      }

      responseMarkup =
        '<div class="site-theme" style="background:#fff"><section data-block-id="photo" style="min-height:120px;color:#fff;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=)"><p>Texto sobre foto</p></section></div>';
      const photoResult = await measureEditedBlocks(
        `http://127.0.0.1:${address.port}`,
        measuredTenant.slug,
        '',
        ['photo'],
      );
      assert.equal(photoResult.status, 'complete');
      assert.equal(photoResult.ok, false);
      assert.match(photoResult.issues.join(' '), /imagem.*sem pixels/i);
      for (const viewport of photoResult.viewports)
        assert.equal(viewport.blocks[0].unmeasurableTexts, 1);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
