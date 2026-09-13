import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { editBrowserFixture } from '../helpers/chat-edit-browser-fixture.mjs';

await test(
  'edições mostram etapas e atualizam a prévia antes da resposta e da consulta de estado',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 90_000 },
  async () => {
    const fixture = await editBrowserFixture();
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const published = structuredClone(
      fixture.fixture.pages.map((p) => p.publishedBlocks),
    );
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(fixture.url, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-preview-state="loaded"]');
      const click = async (text) => {
        for (const button of await page.$$('button')) {
          if (
            await button.evaluate(
              (node, text) => node.textContent.trim() === text,
              text,
            )
          ) {
            await button.click();
            return;
          }
        }
        assert.fail(`Botão ausente: ${text}`);
      };
      const send = async (text) => {
        await page.type('textarea', text);
        await click('Enviar');
      };
      const activity = async (label) =>
        page.waitForFunction(
          (label) =>
            document
              .querySelector('.admin-conversation > [data-chat-activity]')
              ?.textContent.includes(label),
          {},
          label,
        );
      const finish = async (turn) => {
        // Após Parar, o contador de networkidle pode reter o SSE cancelado.
        // O contrato é a resposta de estado consumida e renderizada pelo editor.
        const synchronized = page.waitForResponse((response) =>
          new URL(response.url()).pathname.endsWith('/state'),
        );
        turn.finish.resolve();
        turn.state.resolve();
        await (await synchronized).json();
        await page.waitForFunction(
          () => !document.querySelector('[data-chat-activity]'),
        );
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
      };
      await page.$eval('iframe', (frame) =>
        frame.contentWindow.scrollTo(0, 1500),
      );
      await page.waitForFunction(
        () => document.querySelector('iframe').contentWindow.scrollY === 1500,
      );
      const initialReads = fixture.reads().preview;
      const footer = fixture.nextTurn('footer');
      await send('O footer quero em darkmode.');
      await activity('Entendendo seu pedido');
      assert.equal(
        await page.$eval('.admin-conversation > [data-chat-activity]', (node) =>
          node.closest('.admin-thread'),
        ),
        null,
      );
      footer.understanding.resolve();
      await activity('Aplicando alterações em /');
      const preview = fixture.holdPreview();
      footer.apply.resolve();
      await page.waitForSelector('[data-preview-state="loading"]');
      await activity('Preparando a resposta');
      assert.equal(
        fixture.reads().preview,
        initialReads + 1,
        'Prévia recarrega sem esperar a consulta de estado bloqueada.',
      );
      assert.ok(fixture.reads().state > 0);
      preview.resolve();
      await page.waitForSelector('[data-preview-state="loaded"]');
      assert.equal(
        await page.$eval(
          'iframe',
          (frame) =>
            getComputedStyle(frame.contentDocument.querySelector('footer'))
              .backgroundColor,
        ),
        'rgb(20, 22, 26)',
      );
      assert.equal(
        await page.$eval('iframe', (frame) => frame.contentWindow.scrollY),
        1500,
        'Edição do footer preserva posição da prévia.',
      );
      assert.equal(
        await page.$eval(
          'iframe',
          (frame) =>
            getComputedStyle(frame.contentDocument.querySelector('header'))
              .backgroundColor,
        ),
        'rgb(255, 255, 255)',
      );
      await page.click('.admin-conversation-edge-toggle');
      assert.equal(
        await page.$eval(
          '.admin-content > [data-chat-activity]',
          (node) => node.getBoundingClientRect().height > 0,
        ),
        true,
      );
      await mkdir('outputs/chat-edits', { recursive: true });
      await page.screenshot({
        path: 'outputs/chat-edits/footer-desktop.png',
        fullPage: true,
      });
      await page.click('.admin-conversation-edge-toggle');
      await click('Parar');
      await finish(footer);
      assert.equal(
        fixture.reads().preview,
        initialReads + 1,
        'A consulta posterior não repete a recarga já confirmada.',
      );

      // Recibos antigos e tentativas sem mudança não recarregam a prévia.
      for (const invalid of [false, true]) {
        const before = fixture.reads().preview;
        const turn = fixture.nextTurn(invalid ? 'nav' : 'footer', invalid);
        await send(
          invalid
            ? 'Quero o header em darkmode.'
            : 'O footer quero em darkmode.',
        );
        turn.understanding.resolve();
        turn.apply.resolve();
        await activity('Preparando a resposta');
        if (invalid)
          await page.waitForSelector('.admin-tools [data-state="failed"]');
        await finish(turn);
        assert.equal(fixture.reads().preview, before);
      }

      await page.setViewport({ width: 390, height: 844 });
      await click('Conversa');
      const header = fixture.nextTurn('nav');
      await send('Quero o header em darkmode.');
      await activity('Entendendo seu pedido');
      await click('Prévia');
      assert.equal(
        await page.$eval(
          '.admin-content > [data-chat-activity]',
          (node) => node.getBoundingClientRect().height > 0,
        ),
        true,
      );
      header.understanding.resolve();
      fixture.redirectPreview('missing');
      header.apply.resolve();
      await page.waitForSelector('[data-preview-state="error"]');
      assert.equal(
        await page.$eval('[data-preview-state]', (node) =>
          node.textContent.includes('Prévia atualizada'),
        ),
        false,
      );
      fixture.redirectPreview(true);
      await click('Tentar novamente');
      await page.waitForSelector('iframe[src*="reload=1"]');
      await page.waitForSelector('[data-preview-state="error"]');
      fixture.redirectPreview(false);
      await click('Tentar novamente');
      await page.waitForSelector('[data-preview-state="loaded"]');
      await page.$eval('iframe', (frame) => frame.contentWindow.scrollTo(0, 0));
      assert.equal(
        await page.$eval(
          'iframe',
          (frame) =>
            getComputedStyle(frame.contentDocument.querySelector('header'))
              .backgroundColor,
        ),
        'rgb(20, 22, 26)',
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: 'outputs/chat-edits/header-mobile.png',
        fullPage: true,
      });
      await finish(header);
      assert.deepEqual(
        fixture.fixture.pages.map((p) => p.publishedBlocks),
        published,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
);
