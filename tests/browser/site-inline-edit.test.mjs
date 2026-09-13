import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { inlineFixtureServer } from '../helpers/inline-edit-fixture.mjs';
import { navigationPage } from '../helpers/navigation-fixture.mjs';

await test(
  'edição na prévia: hidratação, texto puro, partes, estilos, cópias e protocolo',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const fixture = await inlineFixtureServer();
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    t.after(async () => {
      await browser.close();
      await fixture.server.close();
    });
    await mkdir('outputs/inline-edit', { recursive: true });
    for (const width of [1440, 390]) {
      const tab = await navigationPage(browser);
      const errors = [];
      tab.on('pageerror', (e) => errors.push(e.message));
      tab.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await tab.setViewport({ width, height: 900 });
      await tab.goto(fixture.origin + '/?edit=1');
      await tab.waitForSelector('[data-hydrated="true"]');
      await tab.waitForSelector('[data-field="headline"][contenteditable]');
      const headline = '[data-block-id="hero"] [data-field="headline"]';
      await tab.focus(headline);
      await tab.keyboard.down('Control');
      await tab.keyboard.press('a');
      await tab.keyboard.up('Control');
      await tab.keyboard.type('Materiais para sua casa');
      assert.equal(
        await tab.$eval(headline, (e) => e.textContent),
        'Materiais para sua casa',
      );
      await tab.click('[aria-label="Aumentar texto"]');
      const sized = await tab.$eval(headline, (e) => ({
        root: parseFloat(getComputedStyle(e).fontSize),
        child: parseFloat(getComputedStyle(e.firstElementChild).fontSize),
      }));
      assert.ok(
        Math.abs(sized.child / sized.root - 1.15) < 0.01,
        JSON.stringify(sized),
      );
      await tab.click('[aria-label="Cor Tinta"]');
      assert.match(
        await tab.$eval('.site-inline-ratio', (e) => e.textContent),
        /✓/,
      );
      await tab.$eval('[aria-label="Cor hexadecimal"]', (e) => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        ).set.call(e, '#ffffff');
        e.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await tab.waitForSelector('.site-inline-error');
      await tab.click('[aria-label="Cor Tinta"]');
      // Colagem só insere texto; nenhum elemento HTML é criado.
      await tab.focus(headline);
      await tab.evaluate((selector) => {
        const el = document.querySelector(selector),
          data = new DataTransfer();
        data.setData('text/plain', ' seguro');
        data.setData('text/html', '<b> seguro</b>');
        el.dispatchEvent(
          new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
          }),
        );
      }, headline);
      assert.equal(
        await tab.$eval(headline, (e) => e.querySelectorAll('b').length),
        0,
      );
      const paragraph = '[data-block-id="intro"] [data-field="body"]';
      await tab.focus(paragraph);
      await tab.keyboard.press('End');
      await tab.keyboard.press('Enter');
      await tab.keyboard.type('Outro parágrafo com orientação.');
      assert.equal(await tab.$$eval(paragraph, (n) => n.length), 2);
      await tab.evaluate(() => {
        const el = document.activeElement;
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
      await tab.keyboard.press('Backspace');
      assert.equal(await tab.$$eval(paragraph, (n) => n.length), 1);
      await tab.focus(headline);
      await tab.keyboard.press('Enter');
      assert.equal(await tab.$$eval(headline, (n) => n.length), 1);
      // Links e abas continuam na página, incluindo rótulos dentro de MotionLink.
      await tab.$eval(
        '[data-block-id="nav"] [data-field="links.0.label"]',
        (e) => e.click(),
      );
      assert.match(tab.url(), /edit=1/);
      await tab.evaluate(() => {
        const el = document.querySelector(
          '[data-block-id="nav"] [data-field="links.0.label"]',
        );
        el.textContent = 'Ver opções';
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      const copies = await tab.$$eval(
        '[data-block-id="nav"] [data-field="links.0.label"]',
        (els) => els.map((e) => e.textContent),
      );
      assert.ok(copies.length >= 2);
      assert.ok(copies.every((value) => value === 'Ver opções'));
      // Mensagens de outra origem ou janela não podem coletar nem descartar.
      await tab.evaluate(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://outside.test',
            source: window,
            data: { type: 'eixu-edit/1', action: 'discard' },
          }),
        );
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: location.origin,
            source: null,
            data: { type: 'eixu-edit/1', action: 'collect' },
          }),
        );
      });
      assert.equal(
        await tab.evaluate(() =>
          window.__editMessages.some((m) => m.action === 'changes'),
        ),
        false,
      );
      const kept = await tab.$eval(headline, (e) => e.textContent);
      await tab.$eval(headline, (e) => {
        const clone = e.cloneNode(true);
        clone.textContent = 'Valor obsoleto';
        e.replaceWith(clone);
      });
      await tab.waitForFunction(
        (selector, text) =>
          document.querySelector(selector)?.textContent === text,
        {},
        headline,
        kept,
      );
      await tab.focus(headline);
      await tab.keyboard.press('Tab');
      assert.equal(
        await tab.evaluate(() =>
          Boolean(
            document.activeElement?.matches('[contenteditable],button,a,input'),
          ),
        ),
        true,
      );
      await tab.focus(headline);
      await tab.keyboard.press('Escape');
      await tab.waitForSelector('.site-inline-toolbar', { hidden: true });
      await tab.keyboard.down('Control');
      await tab.keyboard.press('s');
      await tab.keyboard.up('Control');
      await tab.waitForFunction(() =>
        window.__editMessages.some((m) => m.action === 'save'),
      );
      await tab.evaluate(() =>
        window.postMessage(
          { type: 'eixu-edit/1', action: 'collect' },
          location.origin,
        ),
      );
      await tab.waitForFunction(() =>
        window.__editMessages.some((m) => m.action === 'changes'),
      );
      const changes = await tab.evaluate(() =>
        window.__editMessages.findLast((m) => m.action === 'changes'),
      );
      assert.deepEqual(changes.blocks.map((b) => b.id).sort(), [
        'hero',
        'intro',
        'nav',
      ]);
      assert.ok(
        changes.blocks
          .find((b) => b.id === 'hero')
          .textStyles.some((s) => s.field === 'headline' && s.size === 1),
      );
      await tab.screenshot({ path: `outputs/inline-edit/editor-${width}.png` });
      assert.equal(
        await tab.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      await tab.close();
    }
  },
);

await test(
  'cinco passos mantêm a tipografia fluida nas quatro vibes',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const f = await inlineFixtureServer();
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox'],
    });
    t.after(async () => {
      await browser.close();
      await f.server.close();
    });
    const tab = await navigationPage(browser);
    for (const vibe of ['comercial', 'artistico', 'moderno', 'ousado'])
      for (const width of [1440, 390]) {
        await tab.setViewport({ width, height: 900 });
        await tab.goto(`${f.origin}/?edit=1&vibe=${vibe}`);
        await tab.waitForSelector('[data-field="headline"][contenteditable]');
        await tab.focus('[data-field="headline"]');
        const initial = await tab.$eval('[data-field="headline"]', (e) =>
          parseFloat(getComputedStyle(e).fontSize),
        );
        for (const [button, expected] of [
          ['Diminuir texto', 0.9],
          ['Diminuir texto', 0.8],
          ['Aumentar texto', 0.9],
          ['Aumentar texto', 1],
          ['Aumentar texto', 1.15],
          ['Aumentar texto', 1.3],
        ]) {
          await tab.click(`[aria-label="${button}"]`);
          await tab.waitForFunction(
            (expected) => {
              const e = document.querySelector('[data-field="headline"]');
              return (
                Math.abs(
                  parseFloat(
                    getComputedStyle(e.firstElementChild ?? e).fontSize,
                  ) /
                    parseFloat(getComputedStyle(e).fontSize) -
                    expected,
                ) < 0.01
              );
            },
            {},
            expected,
          );
          const actual = await tab.$eval('[data-field="headline"]', (e) =>
            parseFloat(getComputedStyle(e.firstElementChild ?? e).fontSize),
          );
          assert.ok(
            Math.abs(actual / initial - expected) < 0.01,
            `${vibe} ${width}: ${actual}/${initial} != ${expected}`,
          );
        }
      }
  },
);

await test(
  'contraste do servidor cobre fundos efetivos com CSS de produção, tons e quatro vibes',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const f = await inlineFixtureServer(),
      browser = await puppeteer.launch({
        executablePath: process.env.EIXU_CHROME_PATH,
        headless: true,
        args: ['--no-sandbox'],
      });
    t.after(async () => {
      await browser.close();
      await f.server.close();
    });
    const tab = await navigationPage(browser);
    let measured = 0;
    for (const vibe of ['comercial', 'artistico', 'moderno', 'ousado'])
      for (const version of [2, 4])
        for (const tone of [
          '',
          'paper',
          'soft',
          'ink',
          'accent',
          'secondary',
          'custom',
        ]) {
          await tab.goto(
            `${f.origin}/?edit=1&all=1&vibe=${vibe}&version=${version}${tone ? '&tone=' + tone : ''}`,
          );
          await tab.waitForSelector('[contenteditable]');
          const result = await tab.evaluate(async () => {
            const { measuredBackground } =
              await import('/lib/blocks/inline-contrast.ts');
            const { contrastRatio } = await import('/lib/blocks/contrast.ts');
            const { editor } = JSON.parse(
              document.getElementById('inline-fixture-data').textContent,
            );
            const errors = [];
            let count = 0;
            for (const node of document.querySelectorAll('[data-field]')) {
              const id = node.closest('[data-block-id]')?.dataset.blockId;
              const field = editor.fields.find(
                (f) => f.block === id && f.path === node.dataset.field,
              );
              if (
                !field?.stylable ||
                !field.backgrounds.length ||
                !node.getClientRects().length
              )
                continue;
              const bg = measuredBackground(node);
              count++;
              for (let n = 0; n < 256; n++) {
                const color = '#' + n.toString(16).padStart(2, '0').repeat(3);
                const server = Math.min(
                  ...field.backgrounds.map((b) => contrastRatio(color, b)),
                );
                const actual = contrastRatio(color, bg);
                // Oklab e a pintura em canvas arredondam o sRGB a canais de oito bits.
                if (server >= 4.5 && actual < 4.47) {
                  errors.push({
                    block: id,
                    path: field.path,
                    color,
                    bg,
                    backgrounds: field.backgrounds,
                    server,
                    actual,
                  });
                  break;
                }
              }
            }
            return { errors, count };
          });
          assert.deepEqual(result.errors, [], `${vibe} v${version} ${tone}`);
          measured += result.count;
        }
    assert.ok(measured > 3000, `${measured} campos medidos`);
  },
);
