import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { RenderBlocks } = await j.import('../../lib/blocks/render.tsx');
const { themeVars } = await j.import('../../lib/blocks/theme.ts');

const cases = [
  { vibe: 'comercial', paper: '#ffffff', ink: '#1f2937', whatsapp: true },
  { vibe: 'moderno', paper: '#f8fafc', ink: '#172554' },
  { vibe: 'ousado', paper: '#13141c', ink: '#f8fafc' },
  { vibe: 'artistico', paper: '#fffaf0', ink: '#3b2a1f' },
  { vibe: 'landing', paper: '#ffffff', ink: '#0b0b0f' },
];

function htmlFor(testCase, css) {
  const brand = {
    vibe: testCase.vibe,
    paper: testCase.paper,
    ink: testCase.ink,
    accent: '#116a70',
    design: { version: testCase.vibe === 'landing' ? 7 : 6 },
  };
  const tenant = {
    id: 'attribution',
    slug: 'attribution',
    name: 'Cliente',
    brand,
    contacts: { phones: [], emails: [], addresses: [] },
    whatsapp: testCase.whatsapp ? '+5511999999999' : null,
    dials: { motion: 1, density: 5, variance: 5 },
  };
  const blocks = [
    ...(testCase.vibe === 'landing'
      ? [
          {
            id: 'nav',
            type: 'nav.bar',
            props: {
              logoText: 'Cliente',
              layout: 'minimal',
              position: 'fixed',
              stickyCta: true,
              cta: { label: 'Falar', href: '/contato' },
            },
          },
        ]
      : []),
    {
      id: 'footer',
      type: 'footer.compact',
      props: {
        logoText: 'Cliente',
        tagline: 'Um rodapé de cliente com identidade própria.',
        legal: 'Direitos reservados ao cliente.',
      },
    },
  ];
  const content = renderToStaticMarkup(
    createElement(
      'div',
      {
        className: 'site-theme',
        'data-vibe': testCase.vibe,
        'data-design-version': testCase.vibe === 'landing' ? '7' : '4',
        'data-profile-version': testCase.vibe === 'landing' ? '7' : '6',
        'data-motion': 'still',
        'data-motif': 'wash',
        style: themeVars(brand),
      },
      createElement(RenderBlocks, {
        blocks,
        ctx: { tenant, pagePath: '/', pageType: 'page' },
      }),
    ),
  ).replace(
    'class="site-sticky-cta" data-ready="false"',
    'class="site-sticky-cta" data-ready="true"',
  );
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>.site-theme main{min-height:100vh}</style></head><body>${content}</body></html>`;
}

function luminance(rgb) {
  const [r, g, b] = rgb
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number);
  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

await test(
  'faixa no CSS de produção: vibes, contraste, foco, tela estreita e WhatsApp',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
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
    assert.match(
      css,
      /site-attribution/,
      'Execute build:vercel antes deste teste.',
    );
    await mkdir('outputs/attribution', { recursive: true });
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (request) => request.abort());
      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      for (const width of [1440, 390, 320]) {
        await page.setViewport({ width, height: 900 });
        for (const testCase of cases) {
          const where = `${testCase.vibe} ${width}px`;
          await page.setContent(htmlFor(testCase, css), {
            waitUntil: 'domcontentloaded',
          });
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
          );
          const state = await page.evaluate(() => {
            const strip = document.querySelector('.site-attribution');
            const link = strip.querySelector('a');
            const copy = strip.querySelector('.site-attribution-copy');
            const footer = document.querySelector('.site-footer');
            const whatsapp = document.querySelector(
              '.site-motion-root > a[data-track="whatsapp"]',
            );
            const stripRect = strip.getBoundingClientRect();
            const linkRect = link.getBoundingClientRect();
            const footerRect = footer.getBoundingClientRect();
            const whatsappRect = whatsapp?.getBoundingClientRect();
            const sticky = document.querySelector('.site-sticky-cta');
            const stickyRect = sticky?.getBoundingClientRect();
            return {
              text: copy.textContent.trim(),
              surface: getComputedStyle(strip).backgroundColor,
              textColor: getComputedStyle(link).color,
              backgroundImage: getComputedStyle(strip).backgroundImage,
              position: getComputedStyle(strip).position,
              font: getComputedStyle(link).fontFamily,
              themeFont: getComputedStyle(strip.closest('.site-theme'))
                .fontFamily,
              linkHeight: linkRect.height,
              footerBottom: footerRect.bottom,
              stripTop: stripRect.top,
              overflow: document.documentElement.scrollWidth - innerWidth,
              copyOverflow: copy.scrollWidth - copy.clientWidth,
              whatsappOverlap: whatsappRect
                ? Math.max(
                    0,
                    Math.min(linkRect.right, whatsappRect.right) -
                      Math.max(linkRect.left, whatsappRect.left),
                  ) *
                  Math.max(
                    0,
                    Math.min(linkRect.bottom, whatsappRect.bottom) -
                      Math.max(linkRect.top, whatsappRect.top),
                  )
                : 0,
              stickyVisible: sticky
                ? getComputedStyle(sticky).display !== 'none'
                : false,
              stickyOverlap: stickyRect
                ? Math.max(
                    0,
                    Math.min(linkRect.right, stickyRect.right) -
                      Math.max(linkRect.left, stickyRect.left),
                  ) *
                  Math.max(
                    0,
                    Math.min(linkRect.bottom, stickyRect.bottom) -
                      Math.max(linkRect.top, stickyRect.top),
                  )
                : 0,
            };
          });
          assert.equal(
            state.text,
            'Desenvolvido e hospedado por eixu.com.br',
            where,
          );
          assert.ok(contrast(state.textColor, state.surface) >= 4.5, where);
          assert.equal(state.backgroundImage, 'none', where);
          assert.equal(state.position, 'static', where);
          assert.equal(state.font, state.themeFont, where);
          assert.ok(state.linkHeight >= 44, where);
          assert.ok(state.footerBottom <= state.stripTop + 1, where);
          assert.ok(state.overflow <= 1, where);
          assert.ok(state.copyOverflow <= 1, where);
          assert.equal(state.whatsappOverlap, 0, where);
          if (testCase.vibe === 'landing' && width < 1024)
            assert.equal(state.stickyVisible, true, where);
          assert.equal(state.stickyOverlap, 0, where);

          if (width !== 320) {
            await page.screenshot({
              path: `outputs/attribution/${testCase.vibe}-${width}.png`,
              fullPage: false,
            });
          }

          for (let attempt = 0; attempt < 8; attempt += 1) {
            await page.keyboard.press('Tab');
            if (
              await page.evaluate(
                () =>
                  document.activeElement?.classList.contains(
                    'site-attribution-link',
                  ) ?? false,
              )
            )
              break;
          }
          const focus = await page.$eval('.site-attribution-link', (link) => ({
            visible: link.matches(':focus-visible'),
            outline: getComputedStyle(link).outlineStyle,
            width: parseFloat(getComputedStyle(link).outlineWidth),
          }));
          assert.equal(focus.visible, true, where);
          assert.equal(focus.outline, 'solid', where);
          assert.ok(focus.width >= 2, where);
          if (width === 390) {
            await page.screenshot({
              path: `outputs/attribution/${testCase.vibe}-${width}-focus.png`,
              fullPage: false,
            });
          }
        }
      }
    } finally {
      await browser.close();
    }
  },
);
