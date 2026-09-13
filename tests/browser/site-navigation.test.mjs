import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
import puppeteer from 'puppeteer-core';
import {
  navigationFixtureServer,
  navigationPage,
} from '../helpers/navigation-fixture.mjs';

await test(
  'navegação responsiva: versões, vibes, conteúdo e interação',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const { server, origin } = await navigationFixtureServer();
    const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
    const { inspectNavigation } = await jiti.import(
      '../../lib/review/navigation.ts',
    );
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await navigationPage(browser);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const results = [];
    await mkdir('outputs/mobile-navigation', { recursive: true });
    async function visit(query, width, height = 844) {
      await page.setViewport({ width, height });
      await page.goto(`${origin}/?${query}`, { waitUntil: 'load' });
      await page.waitForFunction(() =>
        document
          .querySelector('.site-navigation-frame')
          ?.style.getPropertyValue('--navigation-height'),
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.querySelectorAll('.site-nav-logo')].map((image) =>
            image.decode().catch(() => {}),
          ),
        );
      });
    }
    async function verify(query, width, height = 844) {
      await visit(query, width, height);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
        query,
      );
      const check = await inspectNavigation(page);
      assert.deepEqual(
        check.navigation.issues,
        [],
        `${query}, ${width}x${height}`,
      );
      if (width < 1024 && (await page.$('.site-menu-toggle'))) {
        assert.equal(check.navigation.compact, true);
        assert.equal(check.navigation.opened && check.navigation.closed, true);
      }
      results.push({ query, width, height, ...check.navigation });
      return check;
    }
    try {
      await t.test(
        'asset recortado reserva a proporção real e respeita a altura compacta',
        async () => {
          for (const width of [1440, 1024, 390, 320]) {
            const check = await verify(
              'asset=1&vibe=comercial&layout=bar&version=5',
              width,
            );
            const image = await page.$eval('.site-nav-logo', (img) => ({
              src: img.currentSrc,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              width: img.width,
              height: img.height,
              renderedHeight: img.getBoundingClientRect().height,
            }));
            assert.equal(image.src, 'https://assets.test/nav-asset.png');
            assert.equal(
              image.naturalWidth / image.naturalHeight,
              image.width / image.height,
            );
            assert.equal(
              image.renderedHeight,
              check.navigation.compact ? 48 : 56,
            );
            if (width === 1440 || width === 390) {
              await mkdir('outputs/logo-studio', { recursive: true });
              await page.screenshot({
                path: `outputs/logo-studio/nav-asset-${width}.png`,
              });
            }
          }
        },
      );
      for (const version of [0, 2, 3, 4]) {
        for (const [vibe, layout] of [
          ['comercial', 'bar'],
          ['moderno', 'minimal'],
          ['ousado', 'contrast'],
          ['artistico', 'floating'],
        ]) {
          await t.test(`${vibe}, perfil ${version || 'legado'}`, async () => {
            for (const width of [320, 390, 768, 1024, 1440]) {
              const check = await verify(
                `vibe=${vibe}&layout=${layout}&version=${version}`,
                width,
              );
              if (version === 4 && width === 390) {
                await page.screenshot({
                  path: `outputs/mobile-navigation/${vibe}-closed.png`,
                });
                await writeFile(
                  `outputs/mobile-navigation/${vibe}-open.jpg`,
                  check.menuJpeg,
                );
              }
            }
            await verify(
              `vibe=${vibe}&layout=${layout}&version=${version}`,
              844,
              390,
            );
          });
        }
      }
      await t.test(
        'layouts explícitos preservam o contrato em todas as vibes',
        async () => {
          for (const vibe of ['comercial', 'moderno', 'ousado', 'artistico'])
            for (const layout of ['bar', 'floating', 'minimal', 'split'])
              await verify(
                `vibe=${vibe}&layout=${layout}&version=4&position=static`,
                390,
              );
        },
      );
      await t.test(
        'logos e textos longos, sem links, sem CTA e sem destinos',
        async () => {
          for (const logo of ['wide', 'square']) {
            for (const width of [320, 390, 1024, 1440]) {
              const check = await verify(
                `vibe=artistico&layout=floating&version=4&logo=${logo}&long`,
                width,
              );
              assert.equal(
                check.navigation.compact,
                true,
                'Textos extensos também recolhem no desktop.',
              );
            }
          }
          for (const option of ['empty', 'nocta', 'empty&nocta'])
            await verify(`layout=bar&${option}`, 320);
        },
      );
      await t.test(
        'logo cresce no desktop sem oscilar perto do limite de largura',
        async () => {
          await visit('layout=bar&logo=square&fit', 1440);
          for (const width of [1024, 1060, 1100, 1180, 1280, 1440]) {
            await page.setViewport({ width, height: 900 });
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            const check = await inspectNavigation(page);
            assert.deepEqual(check.navigation.issues, []);
            const height = await page.$eval(
              '.site-nav-logo',
              (node) => node.getBoundingClientRect().height,
            );
            assert.equal(height, check.navigation.compact ? 48 : 160);
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth),
              width,
            );
          }
        },
      );
      await t.test(
        'medição e captura aguardam a animação do painel',
        async () => {
          await page.emulateMediaFeatures([
            { name: 'prefers-reduced-motion', value: 'no-preference' },
          ]);
          try {
            await visit('layout=bar', 390);
            await page.addStyleTag({
              content:
                '.site-menu-dialog[open] { animation-duration: 400ms !important; }',
            });
            const started = Date.now();
            const check = await inspectNavigation(page);
            assert.ok(Date.now() - started >= 300);
            assert.deepEqual(check.navigation.issues, []);
            assert.ok(check.menuJpeg?.length);
          } finally {
            await page.emulateMediaFeatures([
              { name: 'prefers-reduced-motion', value: 'reduce' },
            ]);
          }
        },
      );
      await t.test(
        'toque abre e fecha; medição recusa um painel que sai da viewport',
        async () => {
          await visit('layout=bar', 390);
          await page.setViewport({
            width: 390,
            height: 844,
            hasTouch: true,
            isMobile: true,
          });
          await page.waitForSelector('.site-menu-toggle');
          await page.tap('.site-menu-toggle');
          await page.waitForSelector('.site-menu-dialog[open]');
          await page.tap('.site-menu-close');
          await page.waitForFunction(
            () => !document.querySelector('dialog[open]'),
          );
          await page.addStyleTag({
            content: '.site-menu-dialog { width: 600px; max-width: none; }',
          });
          const check = await inspectNavigation(page);
          assert.ok(
            check.navigation.issues.includes(
              'Painel do menu sai da área visível.',
            ),
          );
        },
      );
      await t.test(
        'teclado, fundo, âncora, rotação e desmontagem restauram a página',
        async () => {
          await visit(
            'layout=floating&version=4&vibe=artistico&long&logo=wide&panel',
            844,
            390,
          );
          await page.evaluate(() =>
            window.scrollTo({ top: 600, behavior: 'instant' }),
          );
          const originalY = await page.evaluate(() => scrollY);
          await page.focus('.site-menu-toggle');
          await page.keyboard.press('Enter');
          await page.waitForSelector('.site-menu-dialog[open]');
          for (let i = 0; i < 12; i++) {
            await page.keyboard.press('Tab');
            assert.ok(
              await page.evaluate(() =>
                document
                  .querySelector('dialog')
                  .contains(document.activeElement),
              ),
            );
          }
          await page.$eval('.site-menu-body', (node) => {
            node.scrollTop = node.scrollHeight;
          });
          const cta = await page.$eval(
            '.site-menu-dialog .site-nav-cta',
            (node) => {
              const rect = node.getBoundingClientRect();
              return { bottom: rect.bottom, top: rect.top };
            },
          );
          assert.ok(
            cta.bottom <= 390 && cta.top >= 0,
            'CTA alcançável em paisagem.',
          );
          await page.click('.site-menu-close');
          assert.equal(await page.evaluate(() => scrollY), originalY);
          assert.equal(
            await page.evaluate(() => document.body.style.position),
            '',
          );
          await page.click('.site-menu-toggle');
          await page.mouse.click(10, 100);
          await page.waitForFunction(
            () => !document.querySelector('dialog[open]'),
          );
          await page.click('.site-menu-toggle');
          await page.click('.site-menu-dialog a[href="#contato"]');
          await page.waitForFunction(
            () =>
              location.hash === '#contato' &&
              !document.querySelector('dialog[open]'),
          );
          await page.waitForFunction(
            () =>
              Math.abs(
                document.getElementById('contato').getBoundingClientRect().top -
                  parseFloat(
                    getComputedStyle(
                      document.querySelector('.site-theme'),
                    ).getPropertyValue('--navigation-offset'),
                  ),
              ) < 2,
          );
          await visit('layout=bar', 390);
          await page.click('.site-menu-toggle');
          await page.setViewport({ width: 1440, height: 900 });
          await page.waitForFunction(
            () => !document.querySelector('dialog[open]'),
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.style.overflow),
            '',
          );
          await page.setViewport({ width: 390, height: 844 });
          await page.click('.site-menu-toggle');
          await page.$eval('#toggle-navigation', (node) => node.click());
          await page.waitForFunction(
            () => !document.querySelector('.site-nav'),
          );
          assert.equal(
            await page.evaluate(() => document.body.style.position),
            '',
          );
        },
      );
      await t.test(
        'preview mantém o tenant e a página atual; HTML funciona sem JavaScript',
        async () => {
          await visit('preview&layout=bar', 390);
          assert.equal(
            await page.$eval('.site-nav-brand', (node) =>
              node.getAttribute('href'),
            ),
            '/s/fixture/?__tenant=fixture&preview=1',
          );
          await page.click('.site-menu-toggle');
          assert.equal(
            await page.$eval(
              '.site-menu-dialog a[aria-current="page"]',
              (node) => node.textContent,
            ),
            'Início',
          );
          await page.keyboard.press('Escape');
          await page.setJavaScriptEnabled(false);
          await page.reload({ waitUntil: 'load' });
          await page.click('.site-menu-toggle');
          assert.equal(
            await page.$eval('.site-mobile-nav', (node) => node.open),
            true,
          );
          assert.equal(
            await page.$eval(
              '.site-mobile-fallback',
              (node) => node.querySelectorAll('a').length,
            ),
            4,
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth),
            390,
          );
          await page.setJavaScriptEnabled(true);
        },
      );
      await t.test('galeria mantém apenas as colunas ocupadas', async () => {
        for (const count of [2, 3, 8]) {
          await visit(`count=${count}`, 1440);
          const gallery = await page.$eval('.site-gallery ul', (node) => ({
            count: getComputedStyle(node).gridTemplateColumns.split(' ').length,
            client: node.clientWidth,
            scroll: node.scrollWidth,
          }));
          assert.equal(gallery.count, count);
          if (count === 2) assert.equal(gallery.client, gallery.scroll);
        }
      });
      assert.deepEqual(errors, []);
      await writeFile(
        'outputs/mobile-navigation/report.json',
        JSON.stringify(results, null, 2),
      );
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
