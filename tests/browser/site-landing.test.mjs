import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { landingBrowserFixture } from '../helpers/landing-browser-fixture.mjs';

await test(
  'landing: CSS de produção, teclado, menu, conversão e prévia',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const fixture = await landingBrowserFixture();
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox'],
    });
    t.after(async () => {
      await browser.close();
      await fixture.server.close();
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mkdir('outputs/landing', { recursive: true });
    const visible = (selector) =>
      page.$eval(selector, (node) => Boolean(node.getClientRects().length));
    const open = async (query = '') => {
      await page.goto(fixture.origin + query, { waitUntil: 'networkidle0' });
      await page.waitForFunction(
        () =>
          document
            .querySelector('.site-showcase-tabs[data-enhanced]')
            ?.getAttribute('data-enhanced') === 'true',
      );
    };
    for (const layout of ['stage', 'form'])
      for (const [width, height] of [
        [1440, 1000],
        [390, 844],
        [320, 568],
        [667, 375],
      ])
        await t.test(
          `${layout} ${width}×${height}: controles alcançáveis e nenhuma sobreposição`,
          async () => {
            await page.setViewport({
              width,
              height,
              hasTouch: width < 1024,
              isMobile: width < 1024,
            });
            await open(`/?layout=${layout}`);
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            );
            const tiny = await page.$$eval(
              '.site-menu-toggle,.site-nav-cta,.site-action,.site-submit,.site-showcase-tablist button,.site-faq-summary',
              (nodes) =>
                nodes
                  .filter(
                    (node) =>
                      node.getClientRects().length &&
                      node.getBoundingClientRect().height < 47.5,
                  )
                  .map((n) => n.className),
            );
            assert.deepEqual(tiny, []);
            if (width === 1440) {
              const unused = await page.$eval(
                '.site-pricing-cards > .site-shell > ul',
                (grid) =>
                  grid.getBoundingClientRect().right -
                  grid.lastElementChild.getBoundingClientRect().right,
              );
              assert.ok(
                unused < 2,
                'Os planos devem ocupar a grade sem coluna vazia.',
              );
            }
            if (width < 1024) {
              await page.click('.site-menu-toggle');
              await page.waitForSelector('dialog[open]');
              await page.$eval('dialog[open]', async (dialog) => {
                await Promise.all(
                  dialog.getAnimations().map((animation) => animation.finished),
                );
              });
              assert.equal(await visible('.site-sticky-cta'), false);
              if (width === 390)
                await page.screenshot({
                  path: `outputs/landing/${layout}-menu-390.png`,
                });
              await page.keyboard.press('Tab');
              assert.ok(
                await page.evaluate(() =>
                  Boolean(document.activeElement?.closest('dialog')),
                ),
              );
              await page.keyboard.press('Escape');
              await page.waitForSelector('dialog[open]', { hidden: true });
            }
            if (width < 1024 && height >= 440 && layout === 'stage') {
              await page.waitForFunction(
                () =>
                  document.querySelector('.site-sticky-cta')?.getClientRects()
                    .length,
              );
              const box = await page.$eval('.site-sticky-cta', (n) => ({
                bottom: n.getBoundingClientRect().bottom,
                top: n.getBoundingClientRect().top,
              }));
              assert.ok(Math.abs(box.bottom - height) < 2, JSON.stringify(box));
              await page.click('.site-sticky-cta a');
              await page.waitForFunction(
                () =>
                  document
                    .querySelector('.site-sticky-cta')
                    ?.getAttribute('data-hidden') === 'true',
              );
              assert.equal(await visible('.site-sticky-cta'), false);
            }
            if (height < 440 || width >= 1024)
              assert.equal(await visible('.site-sticky-cta'), false);
            await page.evaluate(() =>
              window.scrollTo({ top: 0, behavior: 'instant' }),
            );
            if (width === 1440 || width === 390) {
              await page.evaluate(() => {
                for (const image of document.images) image.loading = 'eager';
              });
              await page.waitForFunction(() =>
                [...document.images].every(
                  (image) => image.complete && image.naturalWidth > 0,
                ),
              );
              await page.screenshot({
                path: `outputs/landing/${layout}-${width}.png`,
                fullPage: true,
              });
            }
          },
        );
    await t.test(
      'abas: setas, Home/End, seleção e painel; conteúdo preservado sem JS',
      async () => {
        await page.setViewport({ width: 1440, height: 1000 });
        await open();
        await page.focus('[role="tab"]');
        await page.keyboard.press('End');
        assert.equal(
          await page.$eval(
            '[role="tab"][aria-selected="true"]',
            (n) => n.textContent,
          ),
          'Uma bancada para criar',
        );
        await page.keyboard.press('Home');
        assert.equal(
          await page.$eval(
            '[role="tab"][aria-selected="true"]',
            (n) => n.textContent,
          ),
          'Lugar para se concentrar',
        );
        assert.equal(
          await page.$$eval('[role="tabpanel"]:not([hidden])', (n) => n.length),
          1,
        );
        const nojs = await browser.newPage();
        await nojs.setJavaScriptEnabled(false);
        await nojs.goto(fixture.origin, { waitUntil: 'networkidle0' });
        assert.equal(
          await nojs.$$eval(
            '.site-showcase-item',
            (nodes) => nodes.filter((n) => n.getClientRects().length).length,
          ),
          2,
        );
        assert.equal(
          await nojs.$eval(
            '.site-sticky-cta',
            (n) => n.getClientRects().length,
          ),
          0,
        );
        await nojs.close();
      },
    );
    await t.test(
      'form nativo persiste lead, consentimento e atribuição; prévia bloqueia envio',
      async () => {
        await open('/?layout=form');
        await page.type('input[name="nome"]', 'Pessoa de teste');
        await page.type('input[name="email"]', 'landing@example.test');
        await page.click('input[name="consent"]');
        await page.$eval('[data-attribution]', (node) => {
          node.value = JSON.stringify({ utm_source: 'teste-local' });
        });
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0' }),
          page.click('.site-submit'),
        ]);
        assert.match(
          await page.$eval('h1', (n) => n.textContent),
          /Recebemos seu pedido/,
        );
        assert.equal(fixture.writes.length, 2);
        assert.match(fixture.writes[0].sql, /insert into leads/);
        assert.ok(
          fixture.writes[0].values.some(
            (v) => typeof v === 'string' && v.includes('teste-local'),
          ),
        );
        await open('/?preview=1');
        assert.equal(await page.$eval('.site-submit', (n) => n.disabled), true);
        const result = await fetch(`${fixture.origin}/api/form?preview=1`, {
          method: 'POST',
        });
        assert.equal(result.status, 409);
        assert.equal(fixture.writes.length, 2);
      },
    );
    await t.test(
      'papel escuro, movimento reduzido e edição mantêm leitura e conteúdo',
      async () => {
        await page.emulateMediaFeatures([
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ]);
        await open('/?dark=1&layout=form');
        assert.equal(
          await page.$eval(
            '.site-action',
            (n) => getComputedStyle(n).transitionDuration,
          ),
          '0s',
        );
        await page.evaluate(() => {
          for (const image of document.images) image.loading = 'eager';
        });
        await page.waitForFunction(
          () =>
            document.images.length > 0 &&
            [...document.images].every((i) => i.complete && i.naturalWidth > 0),
        );
        const contrast = await page.evaluate(() => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d');
          const rgb = (color) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data];
          };
          const luminance = (values) =>
            values
              .slice(0, 3)
              .map((value) => {
                const c = value / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
                0,
              );
          return [
            ...document.querySelectorAll(
              '.site-landing-subtext,.site-action,.site-submit,.site-landing-form-panel label,.site-cta p',
            ),
          ]
            .filter((n) => n.getClientRects().length)
            .map((node) => {
              const chain = [];
              for (let element = node; element; element = element.parentElement)
                chain.unshift(element);
              let background = [255, 255, 255];
              for (const element of chain) {
                const c = rgb(getComputedStyle(element).backgroundColor);
                background = background.map(
                  (v, i) => (c[i] * c[3]) / 255 + v * (1 - c[3] / 255),
                );
              }
              const foreground = rgb(getComputedStyle(node).color);
              const a = luminance(foreground),
                b = luminance(background);
              return {
                text: node.textContent.trim().slice(0, 60),
                ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
              };
            });
        });
        assert.ok(contrast.length > 5);
        assert.deepEqual(
          contrast.filter((entry) => entry.ratio < 4.5),
          [],
        );
        await page.setViewport({ width: 390, height: 844 });
        await page.focus('input[name="email"]');
        assert.equal(await visible('.site-sticky-cta'), false);
        await page.goto(`${fixture.origin}/?editing=1`, {
          waitUntil: 'networkidle0',
        });
        assert.equal(await page.$('.site-sticky-cta'), null);
        assert.equal(
          await page.$$eval(
            '.site-showcase-item',
            (nodes) => nodes.filter((n) => n.getClientRects().length).length,
          ),
          2,
        );
        assert.ok(await page.$('[data-field="headline"]'));
      },
    );
    assert.deepEqual(errors, []);
  },
);
