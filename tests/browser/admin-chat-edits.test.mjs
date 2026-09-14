import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { editBrowserFixture } from '../helpers/chat-edit-browser-fixture.mjs';
import { editPages } from '../helpers/page-edit-fixture.mjs';

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
      const previewScroll = await page.$eval('iframe', (frame) => {
        const top =
          frame.contentDocument.scrollingElement.scrollHeight -
          frame.contentWindow.innerHeight;
        frame.contentWindow.scrollTo(0, top);
        return top;
      });
      assert.ok(previewScroll > 0);
      await page.waitForFunction(
        (top) => document.querySelector('iframe').contentWindow.scrollY === top,
        {},
        previewScroll,
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
      await activity('Aplicando alterações no rodapé de /');
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
        previewScroll,
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

await test(
  'pedido do carrossel faz uma escrita, atualiza a prévia e usa o recibo real',
  { skip: !process.env.EIXU_CHROME_PATH, timeout: 90_000 },
  async () => {
    const pages = editPages();
    pages[0].blocks[1] = {
      id: 'hero',
      type: 'hero.landing',
      props: {
        layout: 'stage',
        headline: 'Materiais para cada ambiente',
        subtext: 'Compare os acabamentos em quatro fotografias.',
        cta: { label: 'Conferir opções', href: '/materiais' },
        image: 'https://assets.test/foto-4.webp',
        imageAlt: 'Material principal aplicado em uma bancada clara',
      },
    };
    pages[0].publishedBlocks = structuredClone(pages[0].blocks);
    const request =
      'No lugar de apenas uma imagem no hero, quero um carrossel com as imagens #4, #6, #7 e #8.';
    const slides = [
      {
        src: 'https://assets.test/foto-6.webp',
        alt: 'Detalhe lateral do material aplicado',
      },
      {
        src: 'https://assets.test/foto-7.webp',
        alt: 'Acabamento do material visto de perto',
      },
      {
        src: 'https://assets.test/foto-8.webp',
        alt: 'Material em outro ambiente iluminado',
      },
    ];
    const fixture = await editBrowserFixture({
      text: request,
      fixtureOptions: { initialPages: pages },
    });
    const browser = await puppeteer.launch({
      executablePath: process.env.EIXU_CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(fixture.url, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-preview-state="loaded"]');
      const beforePreview = fixture.reads().preview;
      const turn = fixture.nextTurn('hero', false, [
        { op: 'set', block: 'hero', path: 'slides', value: slides },
      ]);
      await page.type('textarea', request);
      const send = await Promise.all(
        (await page.$$('button')).map(async (button) => ({
          button,
          label: await button.evaluate((node) => node.textContent.trim()),
        })),
      );
      const submit = send.find((item) => item.label === 'Enviar');
      assert.ok(submit, 'Botão Enviar ausente.');
      await submit.button.click();
      turn.understanding.resolve();
      await page.waitForFunction(() =>
        document
          .querySelector('[data-chat-activity]')
          ?.textContent.includes('Aplicando alterações'),
      );
      const previewResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.startsWith('/s/'),
      );
      turn.apply.resolve();
      await previewResponse;
      await page.waitForSelector('[data-preview-state="loaded"]');
      await page.waitForFunction(() =>
        document
          .querySelector('[data-chat-activity]')
          ?.textContent.includes('Preparando a resposta'),
      );
      const synchronized = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith('/state'),
      );
      turn.finish.resolve();
      turn.state.resolve();
      await synchronized;
      await page.waitForFunction(
        () => !document.querySelector('[data-chat-activity]'),
      );
      const hero = fixture.fixture.pages[0].blocks.find(
        (block) => block.id === 'hero',
      );
      assert.equal(hero.props.image, 'https://assets.test/foto-4.webp');
      assert.deepEqual(hero.props.slides, slides);
      assert.equal(
        fixture.fixture.pages[0].blocks.some(
          (block) => block.type === 'media.gallery',
        ),
        false,
      );
      assert.equal(fixture.fixture.writes.length, 1);
      assert.equal(fixture.reads().preview, beforePreview + 1);
      assert.match(
        await page.$eval('.admin-conversation', (node) => node.textContent),
        /carrossel com 4 fotos/,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
);
