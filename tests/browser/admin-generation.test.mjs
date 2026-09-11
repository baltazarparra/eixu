import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';

/** Estado do servidor entre recargas: é exatamente o que o painel perdia. */
function generationServer() {
  const site = {
    tenant: { slug: 'fixture', name: 'Fixture', hasDesign: true },
    errors: [],
    warnings: [],
    pages: [],
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
    },
  };
  let run = null;
  let events = [];
  let id = 0;
  const add = (kind, label, tool) => {
    events.push({
      id: ++id,
      phase: run?.phase ?? 'cenas',
      kind,
      tool: tool ?? null,
      label,
      payload: {},
      createdAt: new Date().toISOString(),
    });
  };
  return {
    site,
    get run() {
      return run;
    },
    start() {
      run = {
        id: 'run-1',
        tenantId: 'tenant',
        status: 'running',
        phase: 'cenas',
        phaseStartedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
        hops: 1,
        progress: 'cenas:2',
        origin: 'http://fixture.test',
      };
      events = [];
      add('phase_start', 'Cenas');
      add('tool_start', 'Gerando a cena', 'prepare_site_images');
    },
    finish() {
      site.generation = {
        ...site.generation,
        next: 'pronto',
        coveredScenes: 5,
        reviewComplete: true,
      };
      add('phase_end', '5 de 5 cenas disponíveis');
      run = { ...run, status: 'done', finishedAt: new Date().toISOString() };
    },
    stop() {
      run = { ...run, status: 'stopping' };
      add('note', 'Pausa pedida: a etapa atual termina e a próxima não começa');
    },
    feed(after) {
      return {
        run,
        events,
        messages:
          after < 1 && run?.status === 'done'
            ? [
                {
                  id: 'saved-1',
                  role: 'assistant',
                  parts: [{ type: 'text', text: 'Cenas concluídas.' }],
                },
              ]
            : [],
        lastMessageId: run?.status === 'done' ? 1 : 0,
        state: site,
      };
    },
  };
}

await test(
  'geração no servidor: painel acompanha, sobrevive a recarga e controla a execução',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const root = process.cwd();
    const backend = generationServer();
    let chatCalls = 0;
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

    const server = await createServer({
      configFile: false,
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
                  response.setHeader(
                    'Content-Type',
                    'text/html; charset=utf-8',
                  );
                  response.end(
                    await server.transformIndexHtml(
                      '/',
                      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css}</style></head><body><div id="root"></div><script id="fixture-state" type="application/json">${JSON.stringify(backend.site)}</script><script type="module" src="/tests/browser/fixtures/chat.tsx"></script></body></html>`,
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
                  json(
                    backend.feed(Number(url.searchParams.get('after') ?? 0)),
                  );
                  return;
                }
                if (pathname.endsWith('/state')) {
                  json(backend.site);
                  return;
                }
                if (pathname === '/api/chat') {
                  chatCalls += 1;
                  json({ error: 'não deveria ser chamado' }, 409);
                  return;
                }
                if (pathname.startsWith('/s/')) {
                  response.setHeader('Content-Type', 'text/html');
                  response.end('<html lang="pt-BR"><body>Prévia</body></html>');
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
          return false;
        }
      };

      assert.equal(await visible('Continuar'), true);
      await click('Continuar');
      await page.waitForFunction(
        () => document.body.innerText.includes('Gerando: Cenas'),
        { timeout: 10_000 },
      );
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

      // Recarregar era o que matava a geração sem aviso.
      const started = Date.now();
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForFunction(
        () =>
          document.body.innerText.includes('Gerando: Cenas') &&
          document.body.innerText.includes('Gerando a cena'),
        { timeout: 10_000 },
      );
      assert.ok(
        Date.now() - started < 10_000,
        'O andamento reaparece sem clique.',
      );
      assert.equal(await visible('Pausar'), true);
      assert.equal(
        chatCalls,
        0,
        'Nenhum turno de chat é disparado pelo painel.',
      );

      // Celular: a conversa pode estar oculta, mas a execução continua à vista.
      await page.setViewport({ width: 390, height: 844 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      );
      assert.ok(
        await page.evaluate(
          () => !!document.querySelector('.admin-run-bar, .admin-run'),
        ),
      );
      await mkdir('outputs/generation', { recursive: true });
      await page.screenshot({
        path: 'outputs/generation/painel-mobile.png',
        fullPage: true,
      });
      await page.setViewport({ width: 1440, height: 1000 });

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
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
