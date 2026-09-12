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
    await page.click('.admin-client-table li:nth-child(2) .admin-client-row');
    await page.waitForFunction(
      () => location.pathname === '/admin/clinica-vertice',
    );
    await page.waitForSelector('.admin-bar');
    assert.match(
      await page.$eval('.admin-bar-identity', (node) => node.textContent),
      /Clínica Vértice/,
    );
    // Sem rail, o retorno à lista e a saída vivem no cabeçalho do cliente.
    assert.equal(
      await page.$eval('.admin-back', (node) => node.getAttribute('href')),
      '/admin',
    );
    assert.equal(await page.$('.admin-rail'), null);
    assert.equal(
      await page
        .$$('[aria-label="Sair do painel"]')
        .then((rows) => rows.length),
      1,
    );
    assert.equal(
      await page.$$('.admin-bar').then((rows) => rows.length),
      1,
    );
    await clickText('Publicar');
    await page.waitForFunction(() => window.__refreshes === 1);
    // Seletor de página na barra: abre pelo teclado com foco itinerante, a
    // escolha troca a prévia e o alvo do ↗, e Esc devolve o foco ao gatilho.
    fixture.data.site.pages.push({
      slug: 'servicos',
      title: 'Serviços',
      type: 'page',
      blocks: 4,
      dirty: false,
      published: true,
      publishedAt: '2026-09-01T00:00:00Z',
      errors: [],
      warnings: [],
    });
    await open('/admin/marcenaria-horizonte');
    const pickerText = () =>
      page.$eval('.admin-bar-page', (node) => node.textContent);
    const pickerFocused = () =>
      page.evaluate(
        () => document.activeElement === document.querySelector('.admin-bar-page'),
      );
    assert.equal(await pickerText(), '/rascunho');
    await page.focus('.admin-bar-page');
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('.admin-bar-menu');
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute('role')),
      'menuitemradio',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.admin-bar-menu'));
    assert.equal(await pickerText(), '/servicos');
    assert.match(
      await page.$eval('iframe', (node) => node.getAttribute('src')),
      /^\/s\/marcenaria-horizonte\/servicos\?preview=1/,
    );
    assert.equal(
      await page.$eval('.admin-bar-open', (node) => node.getAttribute('title')),
      'Abrir /servicos em outra aba',
    );
    assert.equal(await pickerFocused(), true);
    await page.click('.admin-bar-page');
    await page.waitForSelector('.admin-bar-menu');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.admin-bar-menu'));
    assert.equal(await pickerFocused(), true);
    fixture.data.site.pages.pop();
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
      [
        '/admin/marcenaria-horizonte/imagens?empty',
        'O acervo ainda está vazio',
      ],
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
    assert.equal(
      await page.evaluate(() => {
        const summary = [...document.querySelectorAll('summary')].find(
          (node) => node.textContent.trim() === 'Mais contexto e contatos',
        );
        summary?.click();
        return !!summary;
      }),
      true,
    );
    await clickText('+ prova');
    await page.type('[aria-label="Novo fato confirmado"]', 'Oficina própria');
    await clickText('Adicionar');
    assert.equal(
      await page.$eval('[name="evidence"]', (node) => node.value),
      'Oficina própria',
    );
    assert.equal(
      await page.evaluate(() => {
        const summary = [...document.querySelectorAll('summary')].find(
          (node) => node.textContent.trim() === 'Marca, logo e cores',
        );
        summary?.click();
        return !!summary;
      }),
      true,
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
          // A barra única segura tudo dentro da própria largura: nada estoura
          // nem se sobrepõe, em qualquer faixa.
          const bar = await page.evaluate(() => {
            const bar = document.querySelector('.admin-bar');
            const box = bar.getBoundingClientRect();
            // Folhas da barra: grupos diretos, o que o editor injeta nos
            // slots e o botão de sair; o grupo de decisão entra pelos filhos.
            const items = [
              ...bar.querySelectorAll(
                ':scope > *:not(.admin-bar-slot):not(.admin-bar-decide), .admin-bar-decide > *:not(.admin-bar-slot), :scope > .admin-bar-slot > *',
              ),
            ]
              .filter((node) => node.getClientRects().length > 0)
              .map((node) => node.getBoundingClientRect());
            const inside = items.every(
              (item) =>
                item.left >= box.left - 0.5 && item.right <= box.right + 0.5,
            );
            const overlap = items.some((a, i) =>
              items.some(
                (b, j) =>
                  i < j &&
                  a.left < b.right - 0.5 &&
                  b.left < a.right - 0.5 &&
                  a.top < b.bottom - 0.5 &&
                  b.top < a.bottom - 0.5,
              ),
            );
            const pickers = [
              ...document.querySelectorAll('.admin-bar-page'),
            ].filter((node) => node.getClientRects().length > 0).length;
            const back = bar
              .querySelector('.admin-back')
              ?.getBoundingClientRect();
            const conversationNode = bar.querySelector(
              '.admin-conversation-toggle',
            );
            const conversation = conversationNode?.getClientRects().length
              ? conversationNode.getBoundingClientRect()
              : null;
            const conversationBesideBack =
              !conversation ||
              (!!back &&
                conversation.left >= back.right &&
                conversation.left - back.right <= 13);
            return {
              height: Math.round(box.height),
              inside,
              overlap,
              pickers,
              conversationBesideBack,
            };
          });
          assert.equal(bar.inside, true, `Barra sem estouro em ${width}`);
          assert.equal(
            bar.overlap,
            false,
            `Barra sem sobreposição em ${width}`,
          );
          assert.equal(
            bar.pickers,
            1,
            `Um seletor de página visível em ${width}`,
          );
          assert.equal(
            bar.conversationBesideBack,
            true,
            `Conversa ao lado de Voltar em ${width}`,
          );
          // 64 px com o grupo da prévia; 52 px sem a linha do domínio.
          if (width >= 1520) assert.equal(bar.height, 64);
          else if (width >= 1280) assert.equal(bar.height, 64);
          else if (width >= 1024) assert.equal(bar.height, 52);
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
    assert.equal(await page.$('.admin-mobile-top'), null);
    assert.equal(
      await page
        .$$('[aria-label="Sair do painel"]')
        .then((rows) => rows.length),
      1,
    );
    await page.click('.admin-client-row .admin-client-name');
    await page.waitForSelector('.admin-bar');
    // O botão de voltar é o caminho de volta no celular: precisa estar à vista.
    assert.equal(
      await page.$eval('.admin-back', (node) => {
        const box = node.getBoundingClientRect();
        return box.top >= 0 && box.left >= 0 && box.right <= innerWidth;
      }),
      true,
    );
    await page.click('.admin-back');
    await page.waitForFunction(() => location.pathname === '/admin');
    await page.waitForSelector('.admin-client-row');
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
