import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { handoffFixture } from '../helpers/admin-handoff-fixture.mjs';

const enabled = { skip: !process.env.EIXU_CHROME_PATH, timeout: 120_000 };
const root = '/admin/marcenaria-horizonte';
const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );

async function setup(t) {
  const fixture = await handoffFixture();
  fixture.data.site.generation.next = 'pronto';
  fixture.data.site.pages.push({
    ...fixture.data.site.pages[0],
    slug: 'servicos',
    title: 'Serviços e projetos planejados',
  });
  const browser = await puppeteer.launch({
    executablePath: process.env.EIXU_CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  t.after(async () => {
    await browser.close();
    await fixture.server.close();
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir('outputs/mobile-admin', { recursive: true });
  const open = async (path = root) => {
    await page.goto(fixture.base + path);
    await page.waitForSelector(
      path === '/admin/login' ? '.admin-login' : '.admin-shell',
    );
    await frames(page);
  };
  return { fixture, page, errors, open };
}

async function phone(page, width = 390, height = 844) {
  await page.setViewport({
    width,
    height,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await frames(page);
}

async function tap(page, selector) {
  const button = await page.$(selector);
  assert.ok(button, selector);
  assert.equal(
    await button.evaluate((node) => {
      const b = node.getBoundingClientRect();
      const hit = document.elementFromPoint(
        b.x + b.width / 2,
        b.y + b.height / 2,
      );
      return (
        b.width >= 43.5 &&
        b.height >= 43.5 &&
        b.top >= 0 &&
        b.bottom <= innerHeight + 1 &&
        (hit === node || node.contains(hit))
      );
    }),
    true,
    `Alvo visível e alcançável por toque: ${selector}`,
  );
  if (await button.evaluate((node) => node.matches('a[href]'))) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      button.tap(),
    ]);
    return;
  }
  await button.tap();
  await frames(page);
}

await test(
  'mobile: prévia fiel, ampliável e preservada ao alternar conversa, página e orientação',
  enabled,
  async (t) => {
    const { page, errors, open } = await setup(t);
    const measurements = [];
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [430, 932],
      [844, 390],
    ]) {
      await phone(page, width, height);
      await open();
      await page.waitForSelector('[data-preview-state="loaded"]');
      await frames(page);
      const measure = await page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        return {
          width: innerWidth,
          height: innerHeight,
          header: document.querySelector('.admin-bar').getBoundingClientRect()
            .height,
          preview: iframe.getBoundingClientRect().height,
          viewport: iframe.contentWindow.innerWidth,
          device: iframe.dataset.device,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(measure.device, 'mobile');
      assert.equal(measure.viewport, Math.min(390, width));
      assert.ok(measure.header <= 64);
      assert.equal(measure.overflow, false);
      assert.ok(
        measure.preview > height / 2,
        'Mais da metade da tela é a prévia',
      );
      measurements.push(measure);
      const src = await page.$eval('iframe', (frame) => frame.src);
      await tap(page, '.admin-content [aria-label="Desktop"]');
      await page.waitForFunction(
        () =>
          document.querySelector('iframe').contentWindow.innerWidth === 1280,
      );
      assert.equal(
        await page.$eval(
          'iframe',
          (frame) => frame.getBoundingClientRect().width <= innerWidth + 1,
        ),
        true,
      );
      await tap(page, '.admin-content [aria-label="Celular"]');
      await tap(page, '.admin-content [aria-label="Ampliar prévia"]');
      const expanded = await page.$eval(
        'iframe',
        (frame) => frame.getBoundingClientRect().height,
      );
      assert.ok(expanded >= measure.preview + 50);
      await page.keyboard.press('Escape');
      await frames(page);
      assert.equal(
        await page.$eval(
          '.admin-bar',
          (bar) => bar.getBoundingClientRect().height,
        ),
        measure.header,
      );
      await page.$eval('iframe', (frame) => {
        frame.contentDocument.body.style.minHeight = '3000px';
        frame.contentWindow.scrollTo(0, 620);
      });
      await page.waitForFunction(
        () => document.querySelector('iframe').contentWindow.scrollY === 620,
      );
      await tap(page, '.admin-mobile-views button:first-child');
      await page.type('textarea', 'Rascunho mantido ao conferir a prévia.');
      await tap(page, '.admin-mobile-views button:last-child');
      assert.equal(await page.$eval('iframe', (frame) => frame.src), src);
      assert.equal(
        await page.$eval('iframe', (frame) => frame.contentWindow.scrollY),
        620,
      );
      await tap(page, '.admin-mobile-views button:first-child');
      assert.equal(
        await page.$eval('textarea', (field) => field.value),
        'Rascunho mantido ao conferir a prévia.',
      );
      await tap(page, '.admin-mobile-views button:last-child');
      await tap(page, '.admin-content .admin-bar-page');
      await tap(page, '.admin-content [role="menuitemradio"]:last-child');
      await page.waitForFunction(() =>
        document.querySelector('iframe').src.includes('/servicos?'),
      );
      await page.screenshot({
        path: `outputs/mobile-admin/preview-${width}.png`,
      });
    }
    await writeFile(
      'outputs/mobile-admin/measurements.json',
      JSON.stringify(measurements, null, 2),
    );
    assert.deepEqual(errors, []);
  },
);

await test(
  'mobile: menu com foco, todas as áreas e formulário utilizável em tela estreita',
  enabled,
  async (t) => {
    const { page, fixture, open, errors } = await setup(t);
    await phone(page);
    await open();
    let publications = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/publish'))
        publications++;
    });
    await tap(page, '.admin-bar-decide .admin-primary');
    await page.waitForFunction(() =>
      document
        .querySelector('.admin-notice')
        ?.textContent.includes('Publicado.'),
    );
    assert.equal(publications, 1);
    await tap(page, '[aria-label="Fechar aviso"]');
    fixture.data.site.errors = ['A página precisa de um contato válido.'];
    await open();
    assert.equal(
      await page.$eval(
        '.admin-bar-decide .admin-primary',
        (node) => node.disabled,
      ),
      true,
    );
    assert.match(
      await page.$eval('.admin-review', (node) => node.textContent),
      /contato válido/,
    );
    fixture.data.site.errors = [];
    await open();
    await tap(page, '[aria-label="Abrir menu do cliente"]');
    assert.equal(
      await page.$eval('dialog', (dialog) => dialog.matches(':modal')),
      true,
    );
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(() =>
          document.querySelector('dialog').contains(document.activeElement),
        ),
        true,
      );
    }
    await page.screenshot({ path: 'outputs/mobile-admin/menu.png' });
    await page.keyboard.press('Escape');
    await frames(page);
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute('aria-label'),
      ),
      'Abrir menu do cliente',
    );
    await tap(page, '[aria-label="Abrir menu do cliente"]');
    await page.touchscreen.tap(8, 8);
    assert.equal(await page.$eval('dialog', (d) => d.open), false);

    for (const area of ['imagens', 'trafego', 'dados', '']) {
      await tap(page, '[aria-label="Abrir menu do cliente"]');
      const path = root + (area ? `/${area}` : '');
      await tap(page, `.admin-mobile-menu nav a[href="${path}"]`);
      await page.waitForFunction(
        (path) => location.pathname === path,
        {},
        path,
      );
      await page.waitForSelector('.admin-bar');
      await frames(page);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (area === 'dados') {
        await page.type('[name="contactEmail"]', '.test');
        const save = await page.$('.admin-save-bar button[type="submit"]');
        await save.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await tap(page, '.admin-save-bar button[type="submit"]');
        await page.waitForFunction(() =>
          document
            .querySelector('.admin-save-bar')
            .textContent.includes('salv'),
        );
        assert.ok(fixture.writes.length > 0);
      }
      await page.screenshot({
        path: `outputs/mobile-admin/${area || 'editor'}.png`,
      });
    }
    await tap(page, '[aria-label="Abrir menu do cliente"]');
    await page.setViewport({
      width: 1280,
      height: 900,
      isMobile: false,
      hasTouch: false,
    });
    await page.waitForFunction(() => !document.querySelector('dialog').open);
    await phone(page, 320, 568);
    await open('/admin');
    for (const selector of ['.admin-primary', '.admin-search input']) {
      const node = await page.$(selector);
      assert.ok(node);
      assert.equal(
        await node.evaluate((el) => el.getBoundingClientRect().height >= 44),
        true,
      );
    }
    await page.click('.admin-page-actions .admin-primary');
    await page.waitForSelector('#new-client');
    assert.equal(
      await page.$eval(
        '[name="name"]',
        (el) => parseFloat(getComputedStyle(el).fontSize) >= 16,
      ),
      true,
    );
    await page.screenshot({
      path: 'outputs/mobile-admin/new-client.png',
      fullPage: true,
    });
    await open('/admin/login');
    assert.equal(
      await page.$eval(
        'input',
        (el) => parseFloat(getComputedStyle(el).fontSize) >= 16,
      ),
      true,
    );
    assert.deepEqual(errors, []);
  },
);

await test(
  'mobile: teclado, texto longo e leitura do histórico conservam controles e rascunho',
  enabled,
  async (t) => {
    const { page, fixture, open, errors } = await setup(t);
    fixture.data.history = Array.from({ length: 32 }, (_, i) => ({
      id: `mobile-${i}`,
      role: i % 2 ? 'assistant' : 'user',
      parts: [
        {
          type: 'text',
          text: `Mensagem ${i}. Contexto de teste para percorrer e conferir o histórico completo da criação.`,
        },
      ],
    }));
    await phone(page);
    await open();
    await tap(page, '.admin-mobile-views button:first-child');
    await page.type('textarea', 'Primeira linha');
    await page.keyboard.press('Enter');
    await page.type('textarea', 'Segunda linha');
    assert.equal(
      await page.$eval('textarea', (el) => el.value),
      'Primeira linha\nSegunda linha',
    );
    assert.equal(
      await page.$eval('textarea', (el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
      16,
    );
    const initialHeight = await page.$eval('textarea', (el) => el.clientHeight);
    await page.type('textarea', '\nMais contexto'.repeat(12));
    assert.ok(
      (await page.$eval('textarea', (el) => el.clientHeight)) > initialHeight,
    );
    await page.$eval('.admin-thread', (node) => node.scrollTo(0, 240));
    await page.waitForSelector('.admin-thread-latest');
    const position = await page.$eval(
      '.admin-thread',
      (node) => node.scrollTop,
    );
    await page.type('textarea', '.');
    assert.equal(
      await page.$eval('.admin-thread', (node) => node.scrollTop),
      position,
    );
    await tap(page, '.admin-mobile-views button:last-child');
    await tap(page, '.admin-mobile-views button:first-child');
    assert.equal(
      await page.$eval('.admin-thread', (node) => node.scrollTop),
      position,
    );
    await tap(page, '.admin-thread-latest');
    await page.waitForFunction(
      () => !document.querySelector('.admin-thread-latest'),
    );
    // A viewport visual encolhe no Safari quando o teclado aparece. A simulação
    // dispara o mesmo evento sem depender de um teclado virtual no CI.
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', {
        configurable: true,
        value: 390,
      });
      Object.defineProperty(visualViewport, 'offsetTop', {
        configurable: true,
        value: 24,
      });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await frames(page);
    assert.equal(
      await page.$eval(
        '.admin-shell',
        (node) => node.getBoundingClientRect().height,
      ),
      390,
    );
    assert.equal(
      await page.$eval(
        '.admin-shell',
        (node) => node.getBoundingClientRect().top,
      ),
      24,
    );
    for (const selector of [
      '.admin-composer-send',
      '.admin-composer-attach',
      '.admin-mobile-views button:last-child',
    ]) {
      assert.equal(
        await page.$eval(selector, (node) => {
          const box = node.getBoundingClientRect();
          return box.top >= 24 && box.bottom <= 415 && box.height >= 44;
        }),
        true,
        selector,
      );
    }
    await page.screenshot({ path: 'outputs/mobile-admin/keyboard.png' });
    await tap(page, '.admin-mobile-views button:last-child');
    assert.notEqual(
      await page.evaluate(() => document.activeElement.tagName),
      'TEXTAREA',
    );
    await page.evaluate(() => {
      delete visualViewport.height;
      delete visualViewport.offsetTop;
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await frames(page);
    await tap(page, '.admin-mobile-views button:first-child');
    assert.match(
      await page.$eval('textarea', (el) => el.value),
      /Primeira linha\nSegunda linha/,
    );
    assert.deepEqual(errors, []);
  },
);
