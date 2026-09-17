import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { handoffFixture } from '../helpers/admin-handoff-fixture.mjs';

await test(
  'Premium: acompanha etapas, preserva o site e entra no CMS ao ativar',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const fixtures = [];
    t.after(async () => {
      await browser.close();
      for (const fixture of fixtures) await fixture.server.close();
    });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const fixture = await handoffFixture();
      fixtures.push(fixture);
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewport(viewport);
      await page.goto(`${fixture.base}/admin/marcenaria-horizonte`, {
        waitUntil: 'networkidle0',
      });
      await page.waitForSelector('button');
      const premium = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(
          (button) => button.textContent.trim() === 'Premium',
        ),
      );
      assert.equal(premium, true);

      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(
          (item) => item.textContent.trim() === 'Premium',
        );
        button.click();
      });
      await page.waitForSelector('.admin-premium-conversion-dialog[open]');
      const dialog = await page.$eval(
        '.admin-premium-conversion-dialog',
        (node) => node.textContent,
      );
      assert.match(dialog, /Mesmo endereço/);
      assert.match(dialog, /alterações em rascunho/i);
      await page.evaluate(() => {
        const button = [
          ...document.querySelectorAll(
            '.admin-premium-conversion-dialog button',
          ),
        ].find((item) => item.textContent.includes('Iniciar conversão'));
        button.click();
      });
      await page.waitForSelector('.admin-premium-conversion');
      const content = await page.evaluate(() => document.body.textContent);
      assert.match(content, /Pedido recebido|A preparação ainda não começou/);
      assert.match(content, /Pedido recebido/);
      assert.match(content, /Preparar o projeto/);
      assert.match(content, /Revisar a entrega/);
      assert.match(content, /O site continua no ar/);
      assert.equal(
        await page.evaluate(() =>
          [...document.querySelectorAll('button')].some(
            (button) => button.textContent.trim() === 'Continuar',
          ),
        ),
        false,
      );
      assert.equal(await page.$('.admin-composer-input'), null);
      assert.equal(
        (await page.$('.admin-premium-conversion-preview iframe')) !== null,
        true,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth === window.innerWidth,
        ),
        true,
      );

      if (viewport.width === 1440) {
        const active = await handoffFixture({ premiumCms: true });
        fixtures.push(active);
        fixture.data.site.tenant.maintenanceMode = 'premium';
        fixture.data.site.tenant.publicRuntime = 'premium';
        fixture.data.site.premium = active.data.site.premium;
        await page.click('.admin-premium-conversion-meta button');
        await page.waitForSelector('.admin-premium-editor');
        assert.equal(await page.$('.admin-premium-conversion'), null);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  },
);

await test(
  'CMS Premium: substitui o chat, atualiza a prévia e publica uma revisão',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const fixture = await handoffFixture({ premiumCms: true });
    t.after(async () => {
      await browser.close();
      await fixture.server.close();
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${fixture.base}/admin/marcenaria-horizonte`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.admin-premium-editor');
    assert.equal(await page.$('.admin-composer'), null);
    assert.match(
      await page.$eval(
        '.admin-premium-editor-head',
        (node) => node.textContent,
      ),
      /layout e os componentes/i,
    );
    await page.waitForFunction(() => {
      const frame = document.querySelector('iframe');
      return (
        frame?.contentDocument?.querySelector('#premium-title')?.textContent ===
        'Marcenaria Horizonte'
      );
    });

    const title = await page.$('.admin-premium-field input');
    await title.click({ count: 3 });
    await title.type('Uma marcenaria feita para durar');
    await page.waitForFunction(
      () =>
        document.querySelector('.admin-premium-preview-meta span')
          ?.textContent === 'Alterações em tempo real',
    );
    await page.waitForFunction(() => {
      const frame = document.querySelector('iframe');
      return (
        frame?.contentDocument?.querySelector('#premium-title')?.textContent ===
        'Uma marcenaria feita para durar'
      );
    });
    assert.ok(fixture.premiumPreviewWrites.length > 0);

    await page.click('.admin-premium-image-field');
    await page.waitForSelector('.admin-premium-image-dialog[open]');
    const imageChoices = await page.$$('.admin-premium-image-grid button');
    assert.equal(imageChoices.length, 2);
    await imageChoices[1].click();

    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find(
        (candidate) => candidate.textContent.includes('Salvar e publicar'),
      );
      button.click();
    });
    await page.waitForFunction(() =>
      document.body.textContent.includes('Revisão 2 publicada.'),
    );
    assert.equal(fixture.premiumContentWrites.length, 1);
    assert.equal(
      fixture.premiumContentWrites[0].values['hero.title'],
      'Uma marcenaria feita para durar',
    );
    assert.equal(
      fixture.premiumContentWrites[0].values['hero.image'],
      '/favicon.svg',
    );

    await page.click('.admin-bar-page');
    await page.waitForSelector('[role="menuitemradio"]');
    await page.evaluate(() => {
      const option = [
        ...document.querySelectorAll('[role="menuitemradio"]'),
      ].find((candidate) => candidate.textContent.includes('/obrigado'));
      option.click();
    });
    await page.waitForFunction(() => {
      const frame = document.querySelector('iframe');
      return (
        frame?.contentDocument?.querySelector('#premium-title')?.textContent ===
        'Recebemos seu pedido'
      );
    });

    await page.setViewport({ width: 390, height: 844 });
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.admin-mobile-views'))
          .display === 'flex',
    );
    await page.evaluate(() => {
      const button = [
        ...document.querySelectorAll('.admin-mobile-views button'),
      ].find((candidate) => candidate.textContent.includes('Prévia'));
      button.click();
    });
    assert.equal(
      await page.$eval(
        '.admin-premium-preview',
        (node) => getComputedStyle(node).display,
      ),
      'flex',
    );
    assert.deepEqual(errors, []);
    await page.close();
  },
);
