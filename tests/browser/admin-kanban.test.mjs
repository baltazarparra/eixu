import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import { kanbanFixture } from '../helpers/admin-kanban-fixture.mjs';

async function clickEditorSave(page) {
  await page.$eval('dialog button.admin-primary', (button) =>
    button.scrollIntoView({ block: 'center' }),
  );
  await page.click('dialog button.admin-primary');
}

await test(
  'Kanban real: criar, editar, mover, reconciliar resposta perdida e operar no celular',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 90_000 },
  async (t) => {
    const fixture = await kanbanFixture();
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
    await page.goto(fixture.base + '/admin/kanban');
    await page.waitForSelector('h1');
    await page.waitForFunction(
      () => document.querySelectorAll('section[data-active]').length === 4,
    );

    await page.click('button[aria-expanded="false"]');
    await page.type('#new-column-title', 'Revisão');
    await page.click('form:has(#new-column-title) button.admin-primary');
    await page.waitForFunction(
      () => document.querySelectorAll('section[data-active]').length === 5,
    );
    assert.equal(fixture.state.columns.at(-1).title, 'Revisão');

    await page.click('section[data-active="true"] button[class*="addCard"]');
    await page.type(
      'section[data-active="true"] input[id^="new-card"]',
      'Conferir briefing',
    );
    await page.click('section[data-active="true"] form button.admin-primary');
    await page.waitForFunction(
      () => document.querySelectorAll('li[data-card-id]').length === 1,
    );
    const cardId = fixture.state.cards[0].id;
    await page.waitForSelector('#card-description');
    await page.type('#card-description', 'Descrição completa');
    await page.select('#card-tenant', fixture.state.tenants[0].id);
    await page.select('#card-priority', 'high');
    await page.$eval('#card-due-date', (input) => {
      Object.getOwnPropertyDescriptor(
        input.ownerDocument.defaultView.HTMLInputElement.prototype,
        'value',
      ).set.call(input, '2026-10-15');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await clickEditorSave(page);
    await page.waitForFunction(
      () =>
        document.querySelector('dialog button.admin-primary')?.disabled ===
        false,
    );
    assert.equal(fixture.descriptions.get(cardId), 'Descrição completa');
    assert.equal(fixture.state.cards[0].tenantName, 'Acme');
    assert.equal(fixture.state.cards[0].priority, 'high');
    assert.equal(fixture.state.cards[0].dueDate, '2026-10-15');
    await page.click('button[aria-label="Fechar cartão"]');

    await page.select(
      'section[aria-label="Filtros do Kanban"] select',
      fixture.state.tenants[0].id,
    );
    assert.equal(
      await page.$eval('section[data-active="true"] [data-card-id]', (node) =>
        node.textContent.includes('Acme'),
      ),
      true,
    );
    await page.evaluate(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent.trim() === 'Limpar filtros')
        ?.click();
    });

    await page.click(`[data-card-id="${cardId}"] button[class*="cardOpen"]`);
    await page.waitForSelector('button[class*="archiveButton"]');
    await page.click('button[class*="archiveButton"]');
    await page.waitForFunction(
      (id) =>
        !document.querySelector(
          `section[data-active] [data-card-id="${id}"]`,
        ) &&
        document.querySelector(
          `section[class*="archived"] [data-card-id="${id}"]`,
        ),
      {},
      cardId,
    );
    assert.equal(fixture.state.archivedCards[0].id, cardId);
    await page.click(
      `section[class*="archived"] [data-card-id="${cardId}"] button`,
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll('dialog button')].some(
        (button) => button.textContent.trim() === 'Restaurar cartão',
      ),
    );
    await page.click('button[class*="archiveButton"]');
    await page.waitForFunction(
      (id) =>
        Boolean(
          document.querySelector(`section[data-active] [data-card-id="${id}"]`),
        ),
      {},
      cardId,
    );
    assert.equal(fixture.state.archivedCards.length, 0);

    await page.click('li[data-card-id] summary');
    await page.evaluate(() => {
      [...document.querySelectorAll('li[data-card-id] details button')]
        .find((button) => button.textContent.trim() === 'Em andamento')
        ?.click();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('li[data-card-id]')
          ?.closest('section')
          ?.querySelector('h2')?.textContent === 'Em andamento',
    );
    assert.equal(fixture.state.cards[0].columnId, fixture.state.columns[1].id);

    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('label[class*="mobilePicker"]'))
          .display !== 'none',
    );
    await page.select(
      'label[class*="mobilePicker"] select',
      fixture.state.columns[1].id,
    );
    assert.equal(
      await page.$eval(
        'section[data-active="true"] h2',
        (node) => node.textContent,
      ),
      'Em andamento',
    );

    fixture.loseResponse();
    await page.click('section[data-active="true"] button[class*="addCard"]');
    await page.type(
      'section[data-active="true"] input[id^="new-card"]',
      'Resposta perdida',
    );
    await page.click('section[data-active="true"] form button.admin-primary');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('li[data-card-id]')].some((item) =>
        item.textContent.includes('Resposta perdida'),
      ),
    );
    assert.equal(
      fixture.state.cards.filter((card) => card.title === 'Resposta perdida')
        .length,
      1,
    );
    if (await page.$('#card-description'))
      await page.click('button[aria-label="Fechar cartão"]');

    await page.click(`[data-card-id="${cardId}"] button[class*="cardOpen"]`);
    await page.waitForSelector('#card-description');
    await page.type('#card-description', ' com meu texto local');
    const unsaved = await page.$eval('#card-description', (node) => node.value);
    const external = await fetch(fixture.base + '/__fixture/edit-card', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: cardId,
        title: 'Edição de outra aba',
        description: 'Texto de outra aba',
      }),
    });
    assert.equal(external.status, 200);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() =>
      document
        .querySelector('dialog [role="alert"]')
        ?.textContent.includes('mudou em outra aba'),
    );
    assert.equal(
      await page.$eval('#card-description', (node) => node.value),
      unsaved,
    );
    assert.equal(
      await page.$eval('dialog button.admin-primary', (node) => node.disabled),
      true,
    );
    assert.equal(await page.$('dialog [role="alert"] button'), null);
    page.once('dialog', (dialog) => void dialog.accept());
    await page.click('button[aria-label="Fechar cartão"]');
    await page.click(`[data-card-id="${cardId}"] button[class*="cardOpen"]`);
    await page.waitForSelector('#card-description');
    assert.equal(
      await page.$eval('#card-description', (node) => node.value),
      'Texto de outra aba',
    );
    assert.equal(
      await page.$eval('dialog button.admin-primary', (node) => node.disabled),
      false,
    );
    assert.deepEqual(errors, []);
  },
);

await test(
  'Kanban real: preserva renomeação aberta após mudança externa e limpa erro após atualizar',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 90_000 },
  async (t) => {
    const fixture = await kanbanFixture();
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
    await page.goto(fixture.base + '/admin/kanban');
    await page.waitForFunction(
      () => document.querySelectorAll('section[data-active]').length === 4,
    );

    const columnId = fixture.state.columns[0].id;
    await page.click('section[data-active="true"] summary');
    await page.evaluate(() => {
      [
        ...document.querySelectorAll(
          'section[data-active="true"] details button',
        ),
      ]
        .find((button) => button.textContent.trim() === 'Renomear')
        ?.click();
    });
    await page.waitForSelector(`#rename-${columnId}`);
    await page.click(`#rename-${columnId}`);
    await page.keyboard.press('End');
    await page.keyboard.type(' local');
    const draft = await page.$eval(`#rename-${columnId}`, (node) => node.value);

    const external = await fetch(fixture.base + '/api/admin/kanban/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'rename_column',
        expectedRevision: fixture.state.revision,
        columnId,
        title: 'A fazer remoto',
      }),
    });
    assert.equal(external.status, 200);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForSelector(`#rename-stale-${columnId}`);
    assert.equal(
      await page.$eval(`#rename-${columnId}`, (node) => node.value),
      draft,
    );
    assert.equal(
      await page.$eval(
        'section[data-active="true"] form button.admin-primary',
        (node) => node.disabled,
      ),
      true,
    );
    assert.equal(fixture.state.columns[0].title, 'A fazer remoto');
    await page.click('section[data-active="true"] form button[type="button"]');

    fixture.failRead();
    await page.evaluate(() => {
      [...document.querySelectorAll('header button')]
        .find((button) => button.textContent.trim() === 'Atualizar')
        ?.click();
    });
    await page.waitForFunction(() =>
      document
        .querySelector('p[role="alert"]')
        ?.textContent.includes('Falha temporária'),
    );
    await page.evaluate(() => {
      [...document.querySelectorAll('header button')]
        .find((button) => button.textContent.trim() === 'Atualizar')
        ?.click();
    });
    await page.waitForFunction(
      () => !document.querySelector('p[role="alert"]'),
    );
    assert.deepEqual(errors, []);
  },
);

await test(
  'Kanban real: reconhece o próprio salvamento e conserva texto digitado enquanto salva',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 30_000 },
  async (t) => {
    const fixture = await kanbanFixture();
    const cardId = randomUUID();
    fixture.state.cards.push({
      id: cardId,
      columnId: fixture.state.columns[0].id,
      title: 'Conferir site',
      position: 0,
      hasDescription: false,
      tenantId: null,
      tenantSlug: null,
      tenantName: null,
      priority: null,
      dueDate: null,
      version: 1,
      archivedAt: null,
    });
    fixture.descriptions.set(cardId, '');
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
    await page.goto(fixture.base + '/admin/kanban');
    fixture.failCardRead();
    await page.click(`[data-card-id="${cardId}"] button[class*="cardOpen"]`);
    await page.waitForSelector('dialog [role="alert"] button');
    await page.click('dialog [role="alert"] button');
    await page.waitForSelector('#card-description');

    fixture.delayBoardRead(900);
    await page.type('#card-description', 'Texto salvo');
    await clickEditorSave(page);
    await page.waitForFunction(
      () =>
        document
          .querySelector('output')
          ?.textContent.includes('Cartão salvo.') &&
        document.querySelector('dialog button.admin-primary')?.disabled ===
          false,
    );
    assert.equal(fixture.descriptions.get(cardId), 'Texto salvo');
    assert.equal(await page.$('dialog [role="alert"]'), null);

    fixture.delayCommandResponse(900);
    await page.type('#card-description', ' antes do pedido');
    await clickEditorSave(page);
    await page.waitForFunction(() =>
      document.querySelector('output')?.textContent.includes('Salvando'),
    );
    await page.type('#card-description', ' depois do pedido');
    await page.waitForFunction(
      () =>
        document
          .querySelector('output')
          ?.textContent.includes('Cartão salvo.') &&
        document.querySelector('dialog button.admin-primary')?.disabled ===
          false,
    );
    assert.equal(
      fixture.descriptions.get(cardId),
      'Texto salvo antes do pedido',
    );
    assert.match(
      await page.$eval('output', (element) => element.textContent),
      /ainda precisa ser salvo/,
    );
    assert.equal(
      await page.$eval('#card-description', (element) => element.value),
      'Texto salvo antes do pedido depois do pedido',
    );

    await page.evaluate(() => {
      window.confirmCalls = [];
      window.confirm = (message) => {
        window.confirmCalls.push(message);
        return false;
      };
    });
    await page.click('button[aria-label="Fechar cartão"]');
    assert.equal((await page.evaluate(() => window.confirmCalls)).length, 1);
    assert.notEqual(await page.$('dialog'), null);

    await clickEditorSave(page);
    await page.waitForFunction(
      () =>
        document
          .querySelector('output')
          ?.textContent.includes('Cartão salvo.') &&
        document.querySelector('dialog button.admin-primary')?.disabled ===
          false,
    );
    assert.equal(
      fixture.descriptions.get(cardId),
      'Texto salvo antes do pedido depois do pedido',
    );
    await page.click('button[aria-label="Fechar cartão"]');
    assert.equal(await page.$('dialog'), null);
  },
);
