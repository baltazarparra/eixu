import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { handoffFixture } from '../helpers/admin-handoff-fixture.mjs';

await test(
  'handoff: navegação, filtros, acervo, formulário, diálogo e responsivo',
  { skip: !process.env.EIXU_CHROME_PATH },
  async (t) => {
    const fixture = await handoffFixture();
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    t.after(async () => {
      await browser.close();
      await fixture.server.close();
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const open = async (route) => {
      await page.goto(fixture.base + route, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#root > *');
    };
    const clickText = async (text) => {
      const found = await page.evaluate((text) => {
        const node = [...document.querySelectorAll('button')].find(
          (node) => node.textContent.trim() === text,
        );
        node?.click();
        return !!node;
      }, text);
      assert.equal(found, true, `Botão ${text}`);
    };
    await mkdir('outputs/admin-handoff', { recursive: true });
    await page.setViewport({ width: 1440, height: 900 });
    await open('/admin');
    await clickText('Rascunhos');
    assert.equal(
      await page.$$('.admin-client-row').then((rows) => rows.length),
      2,
    );
    await page.type('[aria-label="Buscar clientes"]', 'inexistente');
    await page.waitForSelector('.admin-empty');
    await clickText('Limpar filtros');
    assert.equal(
      await page.$$('.admin-client-row').then((rows) => rows.length),
      5,
    );
    await page.click('.admin-rail-clients a:nth-child(2)');
    await page.waitForFunction(
      () => location.pathname === '/admin/clinica-vertice',
    );
    await page.waitForSelector('.admin-tenant-header');
    assert.match(
      await page.$eval('.admin-tenant-identity', (node) => node.textContent),
      /Clínica Vértice/,
    );
    assert.equal(
      await page
        .$$('.admin-rail-clients [aria-current]')
        .then((rows) => rows.length),
      1,
    );
    assert.equal(
      await page.$$('.admin-tenant-header').then((rows) => rows.length),
      1,
    );
    await clickText('Publicar');
    await page.waitForFunction(() => window.__refreshes === 1);
    await open('/admin/marcenaria-horizonte/imagens');
    assert.equal(
      await page.$$('.admin-image-card').then((rows) => rows.length),
      3,
    );
    assert.deepEqual(
      await page.$$eval('.admin-image-frame', (nodes) =>
        nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
      ),
      [120, 140, 168],
    );
    assert.match(
      await page.$eval('.admin-image-collection', (node) => node.textContent),
      /sem crítica/,
    );
    await clickText('Rejeitadas');
    assert.equal(
      await page.$$('.admin-image-card').then((rows) => rows.length),
      1,
    );
    await open('/admin/marcenaria-horizonte/dados');
    const dirty = () =>
      page.$eval('.admin-save-bar output', (node) => node.textContent);
    await page.type('input[name="name"]', ' nova');
    assert.match(await dirty(), /1 alteração/);
    await clickText('Outro telefone');
    await page.waitForFunction(
      () => document.querySelectorAll('[name="phone"]').length === 2,
    );
    assert.match(await dirty(), /3 alterações/);
    await page.click('[aria-label="Remover fato: Oficina própria"]');
    await page.waitForFunction(
      () =>
        document.querySelector('[name="evidence"]').value ===
        '12 anos de atuação',
    );
    await clickText('Descartar');
    await page.waitForFunction(
      () =>
        document.querySelector('[name="name"]').value ===
        'Marcenaria Horizonte',
    );
    assert.equal(
      await page.$$('[name="phone"]').then((rows) => rows.length),
      1,
    );
    assert.equal(
      await page.$eval('[name="evidence"]', (node) => node.value),
      'Oficina própria\n12 anos de atuação',
    );
    assert.match(await dirty(), /Dados salvos/);
    await page.type('input[name="name"]', ' atualizada');
    fixture.failSave(true);
    await clickText('Salvar dados');
    await page.waitForFunction(() =>
      document.body.textContent.includes('Não foi possível salvar os dados.'),
    );
    assert.match(await dirty(), /1 alteração/);
    fixture.failSave(false);
    await clickText('Salvar dados');
    await page.waitForFunction(
      () =>
        document.querySelector('.admin-save-bar output').textContent ===
        'Dados salvos',
    );
    assert.equal(fixture.writes.at(-1).name, 'Marcenaria Horizonte atualizada');
    assert.equal(fixture.writes.at(-1).contacts.phones.length, 1);
    await page.type('input[name="name"]', ' descartar');
    await clickText('Descartar');
    assert.equal(
      await page.$eval('[name="name"]', (node) => node.value),
      'Marcenaria Horizonte atualizada',
    );
    const trigger = await page.$('.admin-risk button');
    await trigger.click();
    await page.waitForSelector('dialog[open]');
    assert.equal(
      await page.$eval('dialog button[type="submit"]', (node) => node.disabled),
      true,
    );
    await page.type('dialog input[name="confirm"]', 'marcenaria-horizonte');
    assert.equal(
      await page.$eval('dialog button[type="submit"]', (node) => node.disabled),
      false,
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog').open);
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement ===
          document.querySelector('.admin-risk button'),
      ),
      true,
    );
    for (const [route, title] of [
      ['/admin?empty', 'Nenhum cliente cadastrado'],
      ['/admin/marcenaria-horizonte/imagens?empty', 'O acervo ainda está vazio'],
      ['/admin/marcenaria-horizonte/trafego?empty', 'Nenhuma visita'],
    ]) {
      await open(route);
      assert.match(
        await page.$eval('.admin-empty', (node) => node.textContent),
        new RegExp(title),
      );
    }
    await open('/admin?empty');
    await clickText('Cadastrar cliente');
    await page.waitForSelector('#new-client');
    await clickText('+ prova');
    await page.type('[aria-label="Novo fato confirmado"]', 'Oficina própria');
    await clickText('Adicionar');
    assert.equal(
      await page.$eval('[name="evidence"]', (node) => node.value),
      'Oficina própria',
    );
    await page.$eval('[name="primary"]', (node) => {
      node.value = '#zzzzzz';
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal(
      await page.$eval('[name="primary"]', (node) => node.checkValidity()),
      false,
    );
    for (const width of [320, 390, 1280, 1440, 1920]) {
      await page.setViewport({ width, height: 900 });
      for (const [route, name] of [
        ['/admin', 'clientes'],
        ['/admin/marcenaria-horizonte', 'editor'],
        ['/admin/marcenaria-horizonte/imagens', 'imagens'],
        ['/admin/marcenaria-horizonte/trafego', 'trafego'],
        ['/admin/marcenaria-horizonte/dados', 'dados'],
        ['/admin/login', 'entrada'],
      ]) {
        await open(route);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
          `${name} sem overflow em ${width}`,
        );
        assert.equal(
          await page.evaluate(
            () =>
              !!document.querySelector(
                'vite-error-overlay,[data-nextjs-dialog]',
              ),
          ),
          false,
        );
        if (name === 'editor') {
          assert.equal(
            await page.evaluate(() => {
              const select = document
                .querySelector('.admin-page-selector')
                .getBoundingClientRect();
              const devices = document
                .querySelector('.admin-preview-controls fieldset')
                .getBoundingClientRect();
              return (
                select.right <= devices.left || select.bottom <= devices.top
              );
            }),
            true,
            `Controles da prévia sem sobreposição em ${width}`,
          );
        }
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: `outputs/admin-handoff/${name}-${width}.png`,
            fullPage: true,
          });
      }
    }
    await page.setViewport({ width: 390, height: 844 });
    await open('/admin');
    await page.click('.admin-mobile-top button');
    assert.equal(
      await page.$eval('.admin-rail', (node) => getComputedStyle(node).display),
      'flex',
    );
    await page.click('.admin-rail-clients a');
    await page.waitForSelector('.admin-tenant-header');
    assert.equal(
      await page.$eval('.admin-rail', (node) => getComputedStyle(node).display),
      'none',
    );
    await page.emulateMediaFeatures([
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
    await open('/admin');
    assert.equal(
      await page.$eval(
        '[data-pulse]',
        (node) => getComputedStyle(node).animationName,
      ),
      'none',
    );
    assert.deepEqual(errors, []);
  },
);
