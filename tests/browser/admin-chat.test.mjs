import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import { chatFixture } from '../helpers/chat-fixture.mjs';

await test(
  'painel real continua após erro recuperável e mantém atividade e recibos',
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
                      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css}</style></head><body><div id="root"></div><script id="fixture-state" type="application/json">${JSON.stringify(fixture.state)}</script><script type="module" src="/tests/browser/fixtures/chat.tsx"></script></body></html>`,
                    ),
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
      await click('Continuar');
      await page.waitForSelector('[data-chat-activity]');
      assert.equal(
        await page.$eval('[data-chat-activity]', (node) =>
          node.textContent.includes('O agente está trabalhando'),
        ),
        true,
      );
      const reads = stateReads;
      await click('Ver progresso');
      await page.waitForFunction(() =>
        document
          .querySelector('[data-chat-activity]')
          ?.textContent.includes('0:01'),
      );
      assert.ok(stateReads > reads);
      assert.equal(fixture.turns.length, 1);
      assert.equal(
        await page.evaluate(() =>
          document.body.innerText.includes('Raciocínio sintético'),
        ),
        false,
      );
      await page.waitForFunction(
        () =>
          document.body.innerText.includes('foi concluída. Confira a prévia'),
        { timeout: 30_000 },
      );
      await page.waitForFunction(
        () => !document.querySelector('[data-chat-activity]'),
      );
      assert.deepEqual(fixture.turns, ['composicao', 'revisao']);
      assert.equal(fixture.executions(), 2);
      assert.ok(
        (await page.evaluate(() => document.body.innerText)).includes(
          'Esta tentativa foi recusada',
        ),
      );
      assert.ok(
        fixture.writes
          .filter((row) => row.role === 'assistant')
          .every((row) => row.text.includes('Progresso salvo')),
      );
      await page.type('textarea', 'travou?');
      await click('Enviar');
      await page.waitForFunction(
        () =>
          [
            ...document.querySelectorAll(
              '.admin-conversation .whitespace-pre-wrap',
            ),
          ].filter((node) => node.textContent.startsWith('Progresso salvo:'))
            .length === 3,
      );
      await page.waitForFunction(
        () => !document.querySelector('[data-chat-activity]'),
      );
      assert.deepEqual(fixture.turns, ['composicao', 'revisao']);
      assert.equal(fixture.writes.length, 6);
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
