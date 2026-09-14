import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createJiti } from 'jiti';
import { editBrowserFixture } from '../helpers/chat-edit-browser-fixture.mjs';

const { pageRevision } = await createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
}).import('../../lib/ai/page-edits.ts');

const launch = () =>
  puppeteer.launch({
    executablePath: process.env.EIXU_CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

await test(
  'o painel desfaz a última alteração do rascunho pela versão guardada',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 90_000 },
  async () => {
    const fixture = await editBrowserFixture({
      text: 'remova a seção inteira de dúvidas',
      undoPages: [''],
    });
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(fixture.url, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-preview-state="loaded"]');

      // Uma alteração salva pelo mesmo caminho do servidor, com histórico.
      const home = fixture.fixture.pages[0];
      const before = structuredClone(home.blocks);
      fixture.nextTurn('faq').apply.resolve();
      const saved = await fixture.fixture.tools.edit_page.execute({
        page: '',
        revision: pageRevision(home),
        operations: [{ op: 'remove', block: 'faq' }],
      });
      assert.equal(saved.ok, true, JSON.stringify(saved));
      assert.equal(home.blocks.length, before.length - 1);

      await page.click('.admin-preview-undo');
      await page.waitForFunction(() =>
        document.body.textContent.includes('Alteração desfeita'),
      );
      assert.deepEqual(fixture.fixture.pages[0].blocks, before);
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
);

await test(
  'apontar na prévia leva bloco e item para o pedido, sem depender do anexo',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 90_000 },
  async () => {
    const fixture = await editBrowserFixture({ pointerPreview: true });
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(fixture.url, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.admin-preview-point');
      const frame = page
        .frames()
        .find((candidate) => candidate.url().includes('/s/'));
      await frame.waitForSelector('#card-padaria');
      await page.click('.admin-preview-point');
      // O modo chega à prévia por mensagem: esperar a marca evita clicar antes.
      await frame.waitForFunction(() =>
        document.body.classList.contains('eixu-pointing'),
      );
      // A prévia é renderizada com transform: scale, e um clique por
      // coordenadas cairia fora do elemento. O clique sintético passa pelos
      // mesmos ouvintes reais do componente.
      await frame.evaluate(() =>
        document.querySelector('#card-padaria h3').click(),
      );

      await page.waitForSelector('.admin-composer-anchor');
      const label = await page.$eval(
        '.admin-composer-anchor span',
        (node) => node.textContent,
      );
      assert.match(label, /Padaria e confeitaria/);

      fixture.nextTurn('intro');
      await page.type('textarea', 'remove esse card em anexo');
      for (const button of await page.$$('button'))
        if (
          await button.evaluate((node) => node.textContent.trim() === 'Enviar')
        )
          await button.click();
      await page.waitForFunction(
        () => !document.querySelector('.admin-composer-anchor'),
      );
      const sent = fixture.requests.at(-1);
      assert.equal(sent.anchor.blockId, 'cards');
      assert.match(sent.anchor.text, /Padaria e confeitaria/);
      assert.match(sent.anchor.label, /Padaria e confeitaria/);
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
);
