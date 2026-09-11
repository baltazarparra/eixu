import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import { chatFixture } from '../helpers/chat-fixture.mjs';

await test(
  'chat livre mostra atividade, recibo e responde andamento sem novo turno',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const root = process.cwd();
    const fixture = await chatFixture({ delay: 1400 });
    let stateReads = 0;
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
    assert.ok(
      css.includes('.admin-workspace'),
      'O CSS do admin precisa vir do build Next.js.',
    );
    const server = await createServer({
      configFile: false,
      cacheDir: path.join(root, 'node_modules/.vite-admin-chat'),
      root,
      define: { 'process.env': '{}' },
      plugins: [
        react(),
        {
          name: 'eixu-chat-fixture',
          configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
              const pathname = new URL(request.url, 'http://fixture.test')
                .pathname;
              try {
                if (pathname === '/') {
                  response.setHeader(
                    'Content-Type',
                    'text/html; charset=utf-8',
                  );
                  response.end(
                    await server.transformIndexHtml(
                      '/',
                      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>#root{height:100%}${css}</style></head><body><div id="root"></div><script id="fixture-state" type="application/json">${JSON.stringify(fixture.state)}</script><script type="module" src="/tests/browser/fixtures/chat.tsx"></script></body></html>`,
                    ),
                  );
                  return;
                }
                if (pathname.endsWith('/generation')) {
                  const after = Number(
                    new URL(
                      request.url,
                      'http://fixture.test',
                    ).searchParams.get('after') ?? 0,
                  );
                  const messages = fixture.writes
                    .slice(after, after + 60)
                    .map((row, index) => ({
                      id: `saved-${after + index + 1}`,
                      role: row.role,
                      parts: [{ type: 'text', text: row.text }],
                    }));
                  response.setHeader('Content-Type', 'application/json');
                  response.end(
                    JSON.stringify({
                      run: null,
                      events: [],
                      messages,
                      lastMessageId: after + messages.length,
                      hasMoreMessages: messages.length === 60,
                      state: fixture.state,
                    }),
                  );
                  return;
                }
                if (pathname.endsWith('/state')) {
                  stateReads += 1;
                  response.setHeader('Content-Type', 'application/json');
                  response.end(JSON.stringify(fixture.state));
                  return;
                }
                if (pathname === '/api/chat') {
                  const chunks = [];
                  for await (const chunk of request) chunks.push(chunk);
                  const result = await fixture.POST(
                    new Request('http://fixture.test/api/chat', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: Buffer.concat(chunks).toString(),
                    }),
                  );
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
                  response.end(
                    '<html lang="pt-BR"><body>Prévia sintética</body></html>',
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
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, {
        waitUntil: 'networkidle0',
      });
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
      // O laço das etapas saiu do navegador: aqui o alvo é o chat livre —
      // atividade visível, ferramenta recusada e recibo no histórico.
      await page.type('textarea', 'Monte as páginas.');
      await click('Enviar');
      await page.waitForSelector('[data-chat-activity]');
      assert.equal(
        await page.$eval('[data-chat-activity]', (node) =>
          node.textContent.includes('O agente está trabalhando'),
        ),
        true,
      );
      await page.waitForFunction(
        () =>
          document.body.innerText.includes('Projeto salvo') ||
          document.body.innerText.includes('Progresso salvo'),
        { timeout: 30_000 },
      );
      await page.waitForFunction(
        () => !document.querySelector('[data-chat-activity]'),
      );
      assert.equal(fixture.executions(), 1);
      assert.equal(
        await page.evaluate(() =>
          document.body.innerText.includes('Raciocínio sintético'),
        ),
        false,
      );
      const reads = stateReads;
      assert.ok(
        reads > 0,
        'O painel relê o estado ao concluir uma ferramenta.',
      );

      await page.type('textarea', 'travou?');
      await click('Enviar');
      await page.waitForFunction(() =>
        [
          ...document.querySelectorAll(
            '.admin-conversation .whitespace-pre-wrap',
          ),
        ].some((node) => node.textContent.startsWith('Progresso salvo:')),
      );
      await page.waitForFunction(
        () => !document.querySelector('[data-chat-activity]'),
      );
      // A consulta de andamento não abre turno do agente.
      assert.equal(fixture.executions(), 1);

      await page.setViewport({ width: 390, height: 900 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      );
      await mkdir('outputs/chat-recovery', { recursive: true });
      await page.screenshot({
        path: 'outputs/chat-recovery/workspace-mobile.png',
        fullPage: true,
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
