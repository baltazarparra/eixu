import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import { chatFixture } from '../helpers/chat-fixture.mjs';
import { generationFeedFixture } from '../helpers/generation-feed-fixture.mjs';

/** Estado do servidor entre recargas: é exatamente o que o painel perdia. */
function generationServer(overrides = {}) {
  const { clockSkewMs = 0, phaseStartedAt, ...siteOverrides } = overrides;
  const serverTime = () => new Date(Date.now() + clockSkewMs).toISOString();
  const site = {
    previewRevision: 'v1',
    tenant: { slug: 'stream-fixture', name: 'Fixture', hasDesign: true },
    errors: [],
    warnings: [],
    pages: [],
    ...siteOverrides,
    generation: {
      next: 'cenas',
      photos: 2,
      coveredScenes: 2,
      targetScenes: 5,
      nextScene: null,
      organicPages: 0,
      reviewRounds: 0,
      reviewComplete: false,
      blockingErrors: 0,
      ...siteOverrides.generation,
    },
  };
  const firstPhase = site.generation.next;
  let run = null,
    events = [],
    eventId = 0,
    runId = 0,
    starts = 0,
    everRan = overrides.everRan ?? true;
  const messages = [];
  const add = (kind, label, tool, payload = {}) =>
    events.push({
      id: ++eventId,
      phase: run?.phase ?? firstPhase,
      kind,
      tool: tool ?? null,
      label,
      payload,
      createdAt: serverTime(),
    });
  const saveMessage = (role, text) =>
    messages.push({
      id: `saved-${messages.length + 1}`,
      role,
      parts: [{ type: 'text', text }],
    });
  return {
    site,
    add,
    saveMessage,
    starts: () => starts,
    get run() {
      return run;
    },
    start() {
      starts += 1;
      everRan = true;
      site.generation.next = firstPhase;
      site.generation.reviewComplete = false;
      run = {
        id: `run-${++runId}`,
        tenantId: 'tenant',
        status: 'running',
        phase: firstPhase,
        phaseStartedAt:
          phaseStartedAt === undefined ? serverTime() : phaseStartedAt,
        startedAt: serverTime(),
        heartbeatAt: serverTime(),
        finishedAt: null,
        error: null,
        hops: 1,
        progress: `${firstPhase}:2`,
        origin: 'http://fixture.test',
      };
      events = [];
      add(
        'phase_start',
        firstPhase === 'cenas' ? 'Cenas' : 'Briefing e direção',
      );
      add(
        'tool_start',
        firstPhase === 'cenas' ? 'Gerando a cena' : 'Lendo a referência',
        firstPhase === 'cenas' ? 'prepare_site_images' : 'read_reference',
      );
    },
    finish(reviewComplete = true) {
      site.generation = {
        ...site.generation,
        next: 'pronto',
        coveredScenes: 5,
        reviewComplete,
      };
      add('phase_end', '5 de 5 cenas disponíveis');
      run = { ...run, status: 'done', finishedAt: serverTime() };
      saveMessage('assistant', 'Cenas concluídas.');
    },
    stop() {
      run = { ...run, status: 'stopping' };
      add('note', 'Pausa pedida: a etapa atual termina e a próxima não começa');
    },
    feed(after) {
      const batch = messages
        .filter((message) => Number(message.id.slice(6)) > after)
        .slice(0, 60);
      return {
        run,
        events,
        messages: batch,
        lastMessageId: batch.length ? Number(batch.at(-1).id.slice(6)) : after,
        hasMoreMessages: batch.length === 60,
        everRan,
        serverTime: serverTime(),
        state: site,
      };
    },
  };
}

/** O CSS precisa vir do build: no desenvolvimento um chunk antigo mentia. */
async function builtCss(root) {
  const cssPath = path.join(root, '.next/static/chunks');
  const css = (
    await Promise.all(
      (
        await readdir(cssPath)
      )
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(path.join(cssPath, file), 'utf8')),
    )
  )
    .filter((content) => content.includes('.admin-workspace'))
    .join('\n');
  assert.ok(css.includes('.admin-run'), 'O CSS do painel precisa do build.');
  return css;
}

/** Componentes reais do painel contra um servidor sintético, num Chrome real. */
async function withWorkspace({ backend, chat, readFeed }, body) {
  const root = process.cwd();
  const css = await builtCss(root);
  const counters = { preview: 0, chat: 0 };

  const server = await createServer({
    configFile: false,
    cacheDir: path.join(root, 'node_modules/.vite-admin-generation'),
    root,
    define: { 'process.env': '{}' },
    plugins: [
      react(),
      {
        name: 'eixu-generation-fixture',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const url = new URL(request.url, 'http://fixture.test');
            const pathname = url.pathname;
            const json = (body, status = 200) => {
              response.statusCode = status;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify(body));
            };
            try {
              if (pathname === '/') {
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.end(
                  await server.transformIndexHtml(
                    '/',
                    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>#root{height:100%}${css}</style></head><body><div id="root"></div><script id="fixture-state" type="application/json">${JSON.stringify(backend.site)}</script><script type="module" src="/tests/browser/fixtures/chat.tsx"></script></body></html>`,
                  ),
                );
                return;
              }
              if (
                pathname.endsWith('/generation') &&
                request.method === 'POST'
              ) {
                backend.start();
                json({ run: backend.run }, 202);
                return;
              }
              if (pathname.endsWith('/generation/stop')) {
                backend.stop();
                json({ ok: true });
                return;
              }
              if (pathname.endsWith('/generation')) {
                const after = Number(url.searchParams.get('after') ?? 0);
                json(readFeed ? await readFeed(after) : backend.feed(after));
                return;
              }
              if (pathname.endsWith('/state')) {
                json(backend.site);
                return;
              }
              if (pathname === '/api/chat') {
                counters.chat += 1;
                const chunks = [];
                for await (const chunk of request) chunks.push(chunk);
                const before = chat.writes.length;
                const result = await chat.POST(
                  new Request('http://fixture.test/api/chat', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: Buffer.concat(chunks).toString(),
                  }),
                );
                backend.start();
                for (const row of chat.writes.slice(before))
                  backend.saveMessage(row.role, row.text);
                response.statusCode = result.status;
                result.headers.forEach((value, name) =>
                  response.setHeader(name, value),
                );
                for await (const chunk of result.body) response.write(chunk);
                response.end();
                return;
              }
              if (pathname.startsWith('/s/')) {
                response.setHeader('Content-Type', 'text/html');
                counters.preview += 1;
                response.end(
                  `<html lang="pt-BR"><body>Prévia ${backend.site.previewRevision}</body></html>`,
                );
                return;
              }
              if (pathname.startsWith('/_next/static/media/')) {
                response.end(
                  await readFile(
                    path.join(
                      root,
                      '.next/static/media',
                      path.basename(pathname),
                    ),
                  ),
                );
                return;
              }
              next();
            } catch (error) {
              response.statusCode = 500;
              response.end(error.message);
            }
          });
        },
      },
    ],
    resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  await server.listen();
  const browser = await puppeteer.launch({
    executablePath: process.env.EIXU_CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base, { waitUntil: 'networkidle0' });

    const click = async (text) => {
      for (const handle of await page.$$('button')) {
        if (
          await handle.evaluate(
            (node, text) => node.textContent.trim() === text,
            text,
          )
        ) {
          await handle.click();
          return;
        }
      }
      assert.fail(`Botão ausente: ${text}`);
    };
    /**
     * O botão precisa estar à vista sem rolar: era esse o problema. A espera
     * evita falso negativo quando a máquina está carregada.
     */
    const visible = async (label) => {
      try {
        await page.waitForFunction(
          (label) => {
            const node = [...document.querySelectorAll('button')].find(
              (item) => item.textContent.trim() === label,
            );
            if (!node) return false;
            const box = node.getBoundingClientRect();
            return (
              box.top >= 0 &&
              box.bottom <= innerHeight &&
              box.width > 0 &&
              box.height > 0
            );
          },
          { timeout: 10_000 },
          label,
        );
        return true;
      } catch {
        console.error('Controle não visível', label, {
          errors,
          text: await page.evaluate(() => document.body.innerText),
        });
        return false;
      }
    };
    const headline = () =>
      page.$eval('.admin-run-name', (node) => node.textContent.trim());

    await body({ page, errors, counters, click, visible, headline });
  } finally {
    await browser.close();
    await server.close();
  }
}

await test(
  'geração no servidor: painel acompanha, sobrevive a recarga e controla a execução',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const backend = generationServer();
    const chat = await chatFixture();
    await withWorkspace(
      { backend, chat },
      async ({ page, errors, counters, click, visible, headline }) => {
        assert.equal(await visible('Continuar'), true);
        await click('Continuar');
        await page.waitForFunction(
          () => document.body.innerText.includes('Etapa 2 de 2'),
          { timeout: 10_000 },
        );
        assert.equal(await headline(), 'Criar');
        await page.waitForFunction(() =>
          document.body.innerText.includes('Gerando a cena'),
        );
        // Subprogresso real da etapa, não só o nome dela.
        assert.ok(
          (await page.evaluate(() => document.body.innerText)).includes(
            '2 de 5 cenas prontas',
          ),
        );
        assert.equal(await visible('Pausar'), true);
        assert.equal(
          await page.$eval('textarea', (node) => node.disabled),
          true,
          'O chat espera a geração terminar, e a tela diz isso.',
        );
        // Sem página, a prévia mostra o diamante com a mesma etapa e unidade
        // medida do painel; ele nunca inventa porcentagem.
        assert.equal(
          await page.$eval(
            '.admin-preview-loader:not([data-compact])',
            (node) => node.textContent,
          ),
          'Etapa 2 de 2 · Criar2 de 5 cenas prontasA prévia aparece quando a composição gravar a primeira página.',
        );
        assert.ok(
          ['live', 'fallback'].includes(
            await page.$eval(
              '.admin-preview-loader',
              (node) => node.dataset.state ?? '',
            ),
          ),
          'o diamante declara se renderiza ou caiu no texto',
        );
        await mkdir('outputs/generation', { recursive: true });
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await page.screenshot({
          path: 'outputs/generation/previa-diamante.png',
        });

        // Uma edição com a mesma quantidade de blocos precisa chegar ao iframe.
        backend.site.pages = [
          {
            slug: '',
            type: 'page',
            title: 'Home',
            blocks: 6,
            published: false,
            publishedAt: null,
            dirty: true,
            errors: [],
            warnings: [],
          },
        ];
        backend.site.generation.organicPages = 3;
        await page.waitForFunction(
          () =>
            document
              .querySelector('iframe')
              ?.contentDocument?.body?.innerText.includes('Prévia v1'),
          { timeout: 12000 },
        );
        const beforePreview = counters.preview;
        backend.site.previewRevision = 'v2';
        await page.waitForFunction(
          () =>
            document
              .querySelector('iframe')
              ?.contentDocument?.body?.innerText.includes('Prévia v2'),
          { timeout: 12000 },
        );
        assert.equal(counters.preview, beforePreview + 1);
        // Com página e execução viva, o indicador compacto segue na barra.
        assert.equal(
          await page.$('.admin-preview-loader:not([data-compact])'),
          null,
        );
        assert.ok(await page.$('.admin-preview-loader[data-compact]'));
        await new Promise((resolve) => setTimeout(resolve, 3400));
        assert.equal(
          counters.preview,
          beforePreview + 1,
          'consultas sem alteração não recarregam o iframe',
        );

        // Conclusão e paginação sem recarregar a aba que iniciou o run.
        for (let i = 0; i < 65; i++)
          backend.saveMessage('assistant', `Registro do servidor ${i}`);
        backend.finish();
        await page.waitForFunction(
          () => document.body.innerText.includes('Geração concluída'),
          { timeout: 12000 },
        );
        await page.waitForFunction(
          () =>
            document.body.innerText.includes('Registro do servidor 64') &&
            document.body.innerText.includes('Cenas concluídas.'),
          { timeout: 12000 },
        );
        assert.equal(
          await page.$eval('textarea', (node) => node.disabled),
          false,
        );
        assert.equal(
          await page.$('.admin-preview-loader'),
          null,
          'concluída, a geração leva o indicador junto',
        );

        // O comando textual usa a rota e o stream reais e reativa o acompanhamento.
        await page.type('textarea', 'continuar');
        await page.keyboard.press('Enter');
        await page.waitForFunction(
          () =>
            document.body.innerText.includes('Retomando a geração') &&
            document.querySelector('textarea').disabled,
          { timeout: 12000 },
        );
        assert.equal(counters.chat, 1);
        assert.equal(chat.executions(), 0);

        // Recarregar também precisa preservar o acompanhamento da nova execução.
        const started = Date.now();
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(
          () =>
            document.body.innerText.includes('Etapa 2 de 2') &&
            document.body.innerText.includes('Gerando a cena'),
          { timeout: 10_000 },
        );
        assert.ok(
          Date.now() - started < 10_000,
          'O andamento reaparece sem clique.',
        );
        assert.equal(await visible('Pausar'), true);
        assert.equal(
          counters.chat,
          1,
          'Somente o comando textual disparou uma requisição de chat.',
        );

        // Celular: o andamento acompanha a conversa, com altura de verdade.
        await page.setViewport({ width: 390, height: 844 });
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        );
        await click('Conversa');
        assert.ok(
          await page.evaluate(() => {
            const run = document.querySelector('.admin-run');
            return !!run && run.getBoundingClientRect().height > 0;
          }),
        );
        await mkdir('outputs/generation', { recursive: true });
        await page.screenshot({
          path: 'outputs/generation/painel-mobile.png',
          fullPage: true,
        });
        await page.setViewport({ width: 1440, height: 1000 });
        await page.screenshot({
          path: 'outputs/generation/painel-rodando.png',
          fullPage: true,
        });

        await click('Pausar');
        await page.waitForFunction(() =>
          document.body.innerText.includes('Pausando'),
        );

        backend.finish();
        await page.waitForFunction(
          () => document.body.innerText.includes('Geração concluída'),
          { timeout: 15_000 },
        );
        // A resposta gravada pelo servidor entra na conversa sem recarregar.
        await page.waitForFunction(() =>
          document.body.innerText.includes('Cenas concluídas.'),
        );
        assert.equal(
          await page.$eval('textarea', (node) => node.disabled),
          false,
        );
        await page.screenshot({
          path: 'outputs/generation/painel-concluido.png',
          fullPage: true,
        });
        // Sem run ativo, um erro precisa ficar visível mesmo com revisão pendente.
        backend.site.errors = [
          'A home precisa de uma seção protagonista com fotos.',
        ];
        backend.site.generation.next = 'pronto';
        backend.site.generation.reviewComplete = false;
        backend.site.generation.blockingErrors = 1;
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() =>
          document
            .querySelector('.admin-review')
            ?.innerText.includes(
              'A home precisa de uma seção protagonista com fotos.',
            ),
        );
        assert.equal(
          await page.evaluate(
            () =>
              [...document.querySelectorAll('button')].find(
                (node) => node.innerText === 'Publicar',
              ).disabled,
          ),
          true,
        );
        assert.deepEqual(errors, []);
      },
    );
  },
);

await test(
  'cliente legado com páginas geradas não oferece retomada de revisão após recarga',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const backend = generationServer({
      generation: { next: 'pronto', reviewRounds: 7, reviewComplete: false },
      pages: [
        {
          slug: '',
          type: 'page',
          title: 'Início',
          blocks: 6,
          published: false,
          dirty: true,
          errors: [],
          warnings: [],
        },
      ],
    });
    backend.start();
    backend.finish(false);
    Object.assign(backend.run, {
      status: 'failed',
      phase: 'revisao',
      error: 'A revisão não fechou em 3 rodadas.',
    });
    await withWorkspace(
      { backend, chat: await chatFixture() },
      async ({ page, errors, click }) => {
        for (const width of [1440, 390]) {
          await page.setViewport({ width, height: 900 });
          await page.reload({ waitUntil: 'networkidle0' });
          if (width < 1024) await click('Conversa');
          const text = await page.evaluate(() => document.body.innerText);
          assert.doesNotMatch(
            text,
            /Revisão pendente|Revisão visual.*pendente|Próxima etapa: Conferir|3 rodadas/,
          );
          const buttons = await page.$$eval('button', (nodes) =>
            nodes.map((n) => n.textContent.trim()),
          );
          for (const label of ['Continuar', 'Retomar', 'Tentar novamente'])
            assert.equal(buttons.includes(label), false);
          assert.equal(
            await page.$eval('textarea', (node) => node.disabled),
            false,
          );
          assert.ok(await page.$('iframe'));
        }
        assert.equal(backend.starts(), 1);
        assert.deepEqual(errors, []);
      },
    );
  },
);

await test(
  'cliente novo começa a geração sozinho, sem botão e sem duplicar execução',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const backend = generationServer({
      tenant: { slug: 'stream-fixture', name: 'Fixture', hasDesign: false },
      everRan: false,
      generation: { next: 'briefing', photos: 0, coveredScenes: 0 },
    });
    const chat = await chatFixture();
    await withWorkspace(
      { backend, chat },
      async ({ page, errors, counters, visible, headline }) => {
        // Sem clique: chegar na tela do cliente recém-cadastrado já constrói.
        await page.waitForFunction(
          () => document.body.innerText.includes('Etapa 1 de 2'),
          { timeout: 10_000 },
        );
        assert.equal(await headline(), 'Preparar');
        assert.equal(backend.starts(), 1);
        assert.equal(counters.chat, 0, 'o início não passa pelo chat');
        assert.equal(await visible('Pausar'), true);

        // A pergunta genérica e o botão de gerar saíram da tela.
        const text = await page.evaluate(() => document.body.innerText);
        assert.ok(!text.includes('O que este cliente precisa?'), text);
        assert.ok(!text.includes('Gerar site'), text);

        await mkdir('outputs/generation', { recursive: true });
        await page.screenshot({
          path: 'outputs/generation/painel-inicio-automatico.png',
          fullPage: true,
        });

        // Recarregar acompanha o run existente em vez de abrir outro pago.
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(
          () => document.body.innerText.includes('Etapa 1 de 2'),
          { timeout: 10_000 },
        );
        await new Promise((resolve) => setTimeout(resolve, 3400));
        assert.equal(backend.starts(), 1, 'recarregar não inicia de novo');
        assert.deepEqual(errors, []);
      },
    );
  },
);

await test(
  'cronômetro usa o servidor e avança mesmo com os relógios desencontrados',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const backend = generationServer({
      clockSkewMs: 10 * 60 * 1000,
      phaseStartedAt: null,
    });
    const chat = await chatFixture();
    await withWorkspace({ backend, chat }, async ({ page, click, errors }) => {
      await click('Continuar');
      await page.waitForFunction(
        () => {
          const meta = document.querySelector('.admin-run-meta')?.textContent;
          return (
            meta?.includes('no total') &&
            !meta.startsWith('0:00') &&
            !meta.includes('0:00 no total')
          );
        },
        { timeout: 5_000 },
      );
      const before = await page.$eval(
        '.admin-run-meta',
        (node) => node.textContent,
      );
      await page.waitForFunction(
        (before) =>
          document.querySelector('.admin-run-meta')?.textContent !== before,
        { timeout: 3_000 },
        before,
      );
      assert.deepEqual(errors, []);
    });
  },
);

await test(
  'histórico legado do feed real espera Continuar ao abrir e recarregar',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    for (const previous of [
      {
        brief: {
          generation: { phase: 'briefing', updatedAt: '2026-09-10T12:00:00Z' },
        },
      },
      {
        messages: [
          {
            id: 'saved-7',
            role: 'user',
            parts: [{ type: 'text', text: 'Ainda vou completar o briefing.' }],
          },
        ],
      },
    ]) {
      const feed = await generationFeedFixture(previous);
      const initial = await feed.read();
      const backend = generationServer({ ...initial.state, everRan: false });
      const chat = await chatFixture();
      await withWorkspace(
        { backend, chat, readFeed: feed.read },
        async ({ page, visible, counters, errors }) => {
          assert.equal(await visible('Continuar'), true);
          assert.equal(
            backend.starts(),
            0,
            'abrir não retoma tentativa antiga',
          );
          await page.reload({ waitUntil: 'networkidle0' });
          assert.equal(await visible('Continuar'), true);
          assert.equal(backend.starts(), 0, 'recarregar também não gera');
          assert.equal(counters.chat, 0);
          assert.deepEqual(errors, []);
        },
      );
    }
  },
);

await test(
  'consumo inteiro é acessível durante a composição em desktop e celular',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const backend = generationServer({
      generation: {
        next: 'composicao',
        photos: 5,
        coveredScenes: 5,
        organicPages: 3,
        reviewRounds: 1,
      },
    });
    backend.start();
    const receipt = {
      model: 'fixture',
      steps: 4,
      durationMs: 110_000,
      inputTokens: 10_500,
      outputTokens: 3_200,
      totalTokens: 13_700,
      costUsd: 0.06,
    };
    backend.feed(0).events.splice(
      0,
      Infinity,
      ...['briefing', 'cenas', 'composicao'].map((phase, index) => ({
        id: index + 1,
        phase,
        kind: 'phase_end',
        label: 'Etapa concluída',
        tool: null,
        payload: { usage: { ...receipt, phase } },
        createdAt: new Date().toISOString(),
      })),
    );
    // A lista também precisa suportar uma sessão com vários turnos livres.
    for (let i = 0; i < 12; i++) {
      backend.saveMessage('assistant', `Resposta ${i}`);
      backend.feed(0).messages.at(-1).metadata = {
        usage: { ...receipt, phase: 'livre' },
      };
    }
    const chat = await chatFixture();
    await withWorkspace(
      { backend, chat },
      async ({ page, click, visible, errors }) => {
        for (const [width, height] of [
          [1440, 900],
          [390, 844],
          [375, 667],
        ]) {
          await page.setViewport({ width, height });
          if (width < 1024) await click('Conversa');
          await page.click('.admin-usage summary');
          await page.waitForFunction(
            () => {
              const details = document.querySelector('.admin-usage');
              const box = details.getBoundingClientRect();
              return (
                details.open && box.top >= 0 && box.bottom <= innerHeight + 1
              );
            },
            { timeout: 2000 },
          );

          const region = await page.$('[aria-label="Detalhamento do consumo"]');
          assert.ok(region);
          assert.equal(
            await region.evaluate(
              (node) => node.scrollHeight > node.clientHeight,
            ),
            true,
          );
          await region.focus();
          await page.keyboard.press('End');
          await page.waitForFunction(
            () => {
              const area = document
                .querySelector('[aria-label="Detalhamento do consumo"]')
                .getBoundingClientRect();
              const last = document
                .querySelector('.admin-usage-note')
                .getBoundingClientRect();
              return (
                last.top >= area.top - 1 &&
                last.bottom <= Math.min(area.bottom, innerHeight) + 1
              );
            },
            { timeout: 2000 },
          );
          assert.equal(
            await page.$$('.admin-usage tbody tr').then((rows) => rows.length),
            15,
          );
          await mkdir('outputs/generation', { recursive: true });
          await page.screenshot({
            path: `outputs/generation/consumo-${width}.png`,
            fullPage: true,
          });

          await page.click('.admin-usage summary');
          await page.$eval('.admin-conversation', (node) =>
            node.scrollTo({ top: 0 }),
          );
          assert.equal(await visible('Pausar'), true);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            true,
          );
        }
        assert.deepEqual(errors, []);
      },
    );
  },
);

await test(
  'composição entrega sem revisão automática, libera o chat e não reinicia após recarga',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const backend = generationServer({
      generation: { next: 'composicao', organicPages: 3 },
      pages: ['', 'servicos', 'contato'].map((slug) => ({
        slug,
        type: 'page',
        title: slug || 'Início',
        blocks: 6,
        published: false,
        dirty: true,
        errors: [],
        warnings: [],
      })),
    });
    backend.start();
    await withWorkspace(
      { backend, chat: await chatFixture() },
      async ({ page, errors, click }) => {
        await page.waitForFunction(() =>
          document.body.innerText.includes('Etapa 2 de 2'),
        );
        backend.add('tool_end', 'Projeto salvo', 'build_site');
        backend.finish(false);
        await page.waitForFunction(() =>
          document.body.innerText.includes('Geração concluída'),
        );
        for (const width of [1440, 390]) {
          await page.setViewport({ width, height: 900 });
          await page.reload({ waitUntil: 'networkidle0' });
          if (width < 1024) await click('Conversa');
          await page.waitForFunction(() =>
            document.body.innerText.includes('Geração concluída'),
          );
          const buttons = await page.$$eval('button', (nodes) =>
            nodes.map((node) => node.textContent.trim()),
          );
          assert.equal(buttons.includes('Tentar novamente'), false);
          assert.equal(buttons.includes('Continuar'), false);
          assert.equal(
            await page.$eval('textarea', (node) => node.disabled),
            false,
          );
          assert.ok(await page.$('iframe[src*="/s/stream-fixture/"]'));
          assert.equal(await page.$('.admin-preview-loader'), null);
          assert.equal(await page.$('.admin-run-status'), null);
          assert.equal(await page.$('.admin-bar-review'), null);
          assert.doesNotMatch(
            await page.evaluate(() => document.body.innerText),
            /Revisão visual.*pendente|Próxima etapa: Conferir/,
          );
          assert.equal(
            await page.$eval('.admin-run-name', (node) => node.textContent),
            'Geração concluída',
          );
          await mkdir('outputs/generation', { recursive: true });
          await page.screenshot({
            path: `outputs/generation/entrega-revisao-humana-${width}.png`,
            fullPage: true,
          });
        }
        assert.equal(backend.starts(), 1);
        assert.deepEqual(errors, []);
      },
    );
  },
);

await test(
  'recolher a conversa devolve a largura inteira à prévia acima de 1024 px',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const backend = generationServer({
      generation: { next: 'pronto', organicPages: 3, reviewComplete: true },
      pages: ['', 'servicos', 'contato'].map((slug) => ({
        slug,
        type: 'page',
        title: slug || 'Início',
        blocks: 6,
        published: false,
        dirty: true,
        errors: [],
        warnings: [],
      })),
    });
    await withWorkspace(
      { backend, chat: await chatFixture() },
      async ({ page, errors, click }) => {
        // O grupo PRÉVIA tem duas cópias no DOM; só uma tem caixa por largura.
        const toggle = async () => {
          for (const handle of await page.$$('.admin-conversation-toggle')) {
            if (await handle.boundingBox()) {
              await handle.click();
              return;
            }
          }
          assert.fail('Botão de recolher a conversa ausente ou invisível.');
        };
        const layout = () =>
          page.evaluate(() => {
            const width = (selector) =>
              Math.round(
                document.querySelector(selector)?.getBoundingClientRect()
                  .width ?? 0,
              );
            const toggles = [
              ...document.querySelectorAll('.admin-conversation-toggle'),
            ].filter((node) => node.getClientRects().length > 0);
            return {
              conversation: width('.admin-conversation'),
              content: width('.admin-content'),
              frame: width('.admin-preview-frame'),
              toggles: toggles.length,
              expanded: toggles[0]?.getAttribute('aria-expanded') ?? null,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
        await page.waitForSelector('.admin-preview-frame');
        for (const width of [1440, 1100]) {
          await page.setViewport({ width, height: 900 });
          const before = await layout();
          assert.equal(before.toggles, 1, `${width}: um botão visível`);
          assert.equal(before.expanded, 'true');
          assert.ok(before.conversation >= 300, `${width}: conversa aberta`);
          assert.ok(before.content < width);

          await toggle();
          await page.waitForFunction(
            () =>
              document.querySelector('.admin-conversation').getClientRects()
                .length === 0,
            { timeout: 2000 },
          );
          const after = await layout();
          assert.equal(after.conversation, 0);
          assert.ok(
            Math.abs(after.content - width) <= 1,
            `${width}: prévia com ${after.content} px`,
          );
          assert.ok(after.frame > before.frame, `${width}: iframe cresceu`);
          assert.equal(after.expanded, 'false');
          assert.equal(after.overflow, false);
          assert.equal(
            await page.$eval(
              '.admin-workspace',
              (node) => node.dataset.conversation,
            ),
            'collapsed',
          );
          await mkdir('outputs/generation', { recursive: true });
          await page.screenshot({
            path: `outputs/generation/conversa-recolhida-${width}.png`,
          });

          await toggle();
          await page.waitForFunction(
            () =>
              document.querySelector('.admin-conversation').getClientRects()
                .length > 0,
            { timeout: 2000 },
          );
          assert.equal((await layout()).expanded, 'true');
        }

        // Recolhida no desktop, a conversa continua alcançável no celular,
        // onde as vistas alternam e o botão não existe.
        await toggle();
        await page.setViewport({ width: 390, height: 844 });
        assert.equal((await layout()).toggles, 0);
        await click('Conversa');
        await page.waitForFunction(
          () =>
            document.querySelector('.admin-conversation').getClientRects()
              .length > 0,
          { timeout: 2000 },
        );
        assert.equal(
          await page.$eval(
            'textarea',
            (node) => node.getClientRects().length > 0,
          ),
          true,
        );
        assert.deepEqual(errors, []);
      },
    );
  },
);
