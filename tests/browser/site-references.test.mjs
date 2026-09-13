import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import {
  direction,
  referenceDirection,
  referenceTenant,
} from '../helpers/reference-fixture.mjs';

await test(
  'referência assume fontes, superfície e família visual no CSS real mesmo com vibe conflitante',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const j = createJiti(import.meta.url, {
      alias: { '@': process.cwd() },
      jsx: { runtime: 'automatic' },
    });
    const { RenderBlocks } = await j.import('../../lib/blocks/render.tsx');
    const { themeVars } = await j.import('../../lib/blocks/theme.ts');
    const { completeDesignProfile } = await j.import(
      '../../lib/design/profile.ts',
    );
    const { renderingVibeOf } = await j.import('../../lib/design/vibes.ts');
    const { hasReferenceDirection, referenceAspects } = await j.import(
      '../../lib/design/references.ts',
    );
    const { blockSchemas } = await j.import('../../lib/blocks/registry.ts');
    const css = (
      await Promise.all(
        (
          await readdir('.next/static/chunks')
        )
          .filter((f) => f.endsWith('.css'))
          .map((f) => readFile(`.next/static/chunks/${f}`, 'utf8')),
      )
    )
      .filter((s) => s.includes('.site-theme'))
      .join('\n');
    assert.ok(css.includes('data-vibe'));
    const image = 'https://assets.test/materia.svg';
    const block = (type, props) => ({
      id: type,
      type,
      props: blockSchemas[type].parse(props),
    });
    const blocks = [
      block('hero.split', {
        headline: 'A matéria orienta a forma',
        subtext: 'Superfícies e texturas para escolher com cuidado.',
        image,
        imageAlt: 'Composição sintética de matéria',
        layout: 'offset',
        cta: { label: 'Conversar', href: '#contato' },
      }),
      block('editorial.text', {
        title: 'Uma linguagem em cada detalhe',
        body: 'A direção acompanha o conteúdo em todas as páginas. Texturas, proporções e espaço mantêm uma relação contínua entre os capítulos.',
        layout: 'lead',
        presentation: { tone: 'soft' },
      }),
      block('footer.compact', { logoText: 'Matéria', links: [] }),
    ];
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    await mkdir('outputs/references', { recursive: true });
    try {
      const page = await browser.newPage();
      // O fixture não baixa mídia nem fontes externas.
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        void (r.url() === image
          ? r.respond({
              status: 200,
              contentType: 'image/svg+xml',
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#667855"/><circle cx="220" cy="190" r="95" fill="#cab797"/></svg>',
            })
          : r.abort());
      });
      for (const vibe of ['moderno', 'artistico', 'ousado']) {
        const tenant = referenceTenant();
        tenant.brand = {
          ...tenant.brand,
          ...direction,
          vibe,
          design: completeDesignProfile({ ...direction, referenceDirection }),
        };
        const referenceDirected = hasReferenceDirection(tenant.brand);
        const aspects = [...referenceAspects(tenant.brand)]
          .sort((a, b) => a.localeCompare(b))
          .join(' ');
        tenant.dials = { variance: 7, motion: 2, density: 3 };
        const tree = createElement(
          'div',
          {
            className: 'site-theme',
            'data-vibe': renderingVibeOf(tenant.brand),
            'data-reference-direction': referenceDirected ? 'true' : undefined,
            'data-visual-authority':
              tenant.brand.design?.version === 6 && referenceDirected
                ? 'reference'
                : 'vibe',
            'data-design-version':
              tenant.brand.design?.version === 5 ||
              tenant.brand.design?.version === 6
                ? 4
                : tenant.brand.design?.version,
            'data-profile-version': tenant.brand.design?.version,
            'data-reference-aspects': aspects,
            'data-density': 'airy',
            'data-motion': 'still',
            style: {
              ...themeVars(tenant.brand),
              '--font-display-editorial': 'Georgia',
              '--font-sans': 'Arial',
              '--font-mono': 'Courier New',
            },
          },
          createElement(RenderBlocks, {
            blocks,
            ctx: { tenant, pagePath: '/', isPreview: true },
          }),
        );
        for (const width of [390, 1440]) {
          await page.setViewport({ width, height: 1000 });
          await page.setContent(
            `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${renderToStaticMarkup(tree)}</body></html>`,
          );
          const measured = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const theme = document.querySelector('.site-theme');
            const soft = document.querySelector('[data-tone="soft"]');
            const blocks = document.querySelectorAll('main > .site-block');
            const lead = document.querySelector(
              '.site-text-lead .site-shell > div > p:first-child',
            );
            return {
              vibe: theme.dataset.vibe,
              visualAuthority: theme.dataset.visualAuthority,
              designVersion: theme.dataset.designVersion,
              profileVersion: theme.dataset.profileVersion,
              aspects: theme.dataset.referenceAspects,
              width: innerWidth,
              scrollWidth: document.documentElement.scrollWidth,
              surface: getComputedStyle(soft)
                .getPropertyValue('--paper')
                .trim(),
              font: getComputedStyle(h1).fontFamily,
              weight: getComputedStyle(h1).fontWeight,
              heroCopyPosition: getComputedStyle(
                document.querySelector('.site-hero-copy'),
              ).position,
              themeBackgroundImage: getComputedStyle(theme).backgroundImage,
              actionRadius: getComputedStyle(
                document.querySelector('.site-action[data-variant="solid"]'),
              ).borderRadius,
              chapterLine: blocks[1]
                ? getComputedStyle(blocks[1]).borderTopWidth
                : null,
              leadFont: lead ? getComputedStyle(lead).fontFamily : null,
            };
          });
          // O perfil v6 escolheu artistico-revista pela referência. Essa
          // família governa o CSS mesmo quando a vibe cadastrada é outra; o
          // contrato visual continua sendo reutilizado pela versão 4 do CSS.
          assert.equal(measured.vibe, 'artistico');
          assert.equal(measured.visualAuthority, 'reference');
          assert.equal(measured.designVersion, '4');
          assert.equal(measured.profileVersion, '6');
          assert.match(measured.aspects, /surface/);
          assert.equal(measured.themeBackgroundImage, 'none');
          assert.equal(measured.actionRadius, '999px');
          assert.equal(measured.chapterLine, '0px');
          assert.match(measured.leadFont, /Arial/);
          // A superfície documentada vale como está, sem a lavagem artística.
          assert.equal(measured.surface, '#eeeeee');
          assert.match(measured.font, /Georgia/);
          assert.ok(
            measured.scrollWidth <= width + 2,
            `${vibe} ${width}: ${JSON.stringify(measured)}`,
          );
          assert.notEqual(
            measured.heroCopyPosition,
            'absolute',
            'O cartão do hero não pode sair do fluxo e cobrir o conteúdo',
          );
          if (vibe === 'moderno')
            await page.screenshot({
              path: `outputs/references/result-${width}.png`,
              fullPage: true,
            });
        }
      }
    } finally {
      await browser.close();
    }
  },
);
