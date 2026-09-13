import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { ToolLoopAgent, isStepCount } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { createJiti } from 'jiti';
import { pageEditFixture } from './page-edit-fixture.mjs';
import { loadModule } from './load-module.mjs';

const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { workspaceState } = await jiti.import('../../lib/admin/state.ts');
const { pageRevision } = await jiti.import('../../lib/ai/page-edits.ts');

/** Rota, SDK, executores, validação e UI reais; banco/modelo isolados em memória. */
export async function editBrowserFixture() {
  const fixture = await pageEditFixture();
  let turn;
  let previewReads = 0;
  let stateReads = 0;
  let previewGate = null;
  let previewRedirect = false;
  const execute = fixture.tools.edit_page.execute;
  fixture.tools.edit_page.execute = async (...args) => {
    await turn.apply.promise;
    return execute(...args);
  };
  const state = () => workspaceState(fixture.tenant, fixture.pages, []);
  const { POST } = await loadModule('app/api/chat/route.ts', {
    '@/lib/auth': { isAuthenticated: async () => true },
    '@/lib/db': { db: () => async () => [] },
    '@/lib/tenant-queries': {
      getTenantBySlug: async () => fixture.tenant,
      listPages: async () => structuredClone(fixture.pages),
    },
    '@/lib/images/queries': { listImages: async () => [] },
    '@/lib/generation/runs': {
      activeRun: async () => null,
      expireStaleRun: async () => null,
    },
    '@/lib/ai/tools': { buildTools: () => fixture.tools },
    '@/lib/ai/agent': {
      siteAgent: ({ tools }) => {
        let step = 0;
        const active = turn;
        return new ToolLoopAgent({
          tools,
          stopWhen: isStepCount(2),
          model: new MockLanguageModelV4({
            doStream: async () => {
              const first = ++step === 1;
              return {
                stream: ReadableStream.from(
                  (async function* () {
                    yield { type: 'stream-start', warnings: [] };
                    yield { type: 'reasoning-start', id: 'thinking' };
                    yield {
                      type: 'reasoning-delta',
                      id: 'thinking',
                      delta: 'Raciocínio privado sintético.',
                    };
                    await (first
                      ? active.understanding.promise
                      : active.finish.promise);
                    yield { type: 'reasoning-end', id: 'thinking' };
                    if (first) {
                      yield {
                        type: 'tool-call',
                        toolCallId: 'edit-1',
                        toolName: 'edit_page',
                        input: JSON.stringify({
                          page: '',
                          revision: pageRevision(fixture.pages[0]),
                          operations: [
                            {
                              op: 'set',
                              block: active.block,
                              path: 'presentation.tone',
                              value: active.invalid ? 'invalido' : 'ink',
                            },
                          ],
                        }),
                      };
                    } else {
                      yield { type: 'text-start', id: 'reply' };
                      yield {
                        type: 'text-delta',
                        id: 'reply',
                        delta: 'Confira o resultado da alteração na prévia.',
                      };
                      yield { type: 'text-end', id: 'reply' };
                    }
                    yield {
                      type: 'finish',
                      finishReason: {
                        unified: first ? 'tool-calls' : 'stop',
                        raw: first ? 'tool-calls' : 'stop',
                      },
                      usage: {
                        inputTokens: {
                          total: 20,
                          noCache: 20,
                          cacheRead: 0,
                          cacheWrite: 0,
                        },
                        outputTokens: { total: 10, text: 5, reasoning: 5 },
                      },
                    };
                  })(),
                ),
              };
            },
          }),
        });
      },
    },
  });
  const root = process.cwd();
  const cssDir = path.join(root, '.next/static/chunks');
  const css = (
    await Promise.all(
      (
        await readdir(cssDir)
      )
        .filter((f) => f.endsWith('.css'))
        .map((f) => readFile(path.join(cssDir, f), 'utf8')),
    )
  )
    .filter((s) => s.includes('.admin-workspace'))
    .join('\n');
  if (!css.includes('.admin-preview-status'))
    throw new Error('Execute build:vercel antes do navegador.');
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: path.join(root, 'node_modules/.vite-chat-edits'),
    define: { 'process.env': '{}' },
    resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
    plugins: [
      react(),
      {
        name: 'chat-edits-fixture',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const pathname = new URL(request.url, 'http://fixture.test')
              .pathname;
            try {
              if (pathname === '/') {
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.end(
                  await server.transformIndexHtml(
                    '/',
                    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>#root{height:100%}${css}</style></head><body><div id="root"></div><script id="fixture-state" type="application/json">${JSON.stringify(state())}</script><script type="module" src="/tests/browser/fixtures/chat.tsx"></script></body></html>`,
                  ),
                );
              } else if (pathname.endsWith('/generation')) {
                response.setHeader('Content-Type', 'application/json');
                response.end(
                  JSON.stringify({
                    run: null,
                    events: [],
                    messages: [],
                    lastMessageId: 0,
                    hasMoreMessages: false,
                    everRan: true,
                    state: state(),
                  }),
                );
              } else if (pathname.endsWith('/state')) {
                stateReads++;
                const snapshot = state();
                await turn?.state.promise;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(snapshot));
              } else if (pathname === '/api/chat') {
                const chunks = [];
                for await (const chunk of request) chunks.push(chunk);
                const result = await POST(
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
              } else if (pathname.startsWith('/s/')) {
                previewReads++;
                await previewGate?.promise;
                if (previewRedirect === 'missing') {
                  response.writeHead(404, { 'Content-Type': 'text/html' });
                  response.end(
                    '<html><body>Página não encontrada</body></html>',
                  );
                  return;
                }
                if (previewRedirect) {
                  response.writeHead(302, { Location: '/admin/login' });
                  response.end();
                  return;
                }
                const blocks = fixture.pages[0].blocks;
                const dark = (id) =>
                  blocks.find((b) => b.id === id)?.props.presentation?.tone ===
                  'ink';
                response.setHeader('Content-Type', 'text/html');
                response.end(
                  `<html><body class="site-theme" style="margin:0;font:24px sans-serif"><header style="padding:40px;background:${dark('nav') ? '#14161a' : '#fff'};color:${dark('nav') ? '#fff' : '#14161a'}">Cabeçalho</header><main style="height:1800px">Conteúdo sintético da prévia</main><footer style="height:160px;padding:40px;background:${dark('footer') ? '#14161a' : '#fff'};color:${dark('footer') ? '#fff' : '#14161a'}">Rodapé</footer></body></html>`,
                );
              } else if (pathname === '/admin/login') {
                response.setHeader('Content-Type', 'text/html');
                response.end('<html><body>Login de teste</body></html>');
              } else if (pathname.startsWith('/_next/static/media/')) {
                response.end(
                  await readFile(
                    path.join(
                      root,
                      '.next/static/media',
                      path.basename(pathname),
                    ),
                  ),
                );
              } else next();
            } catch (error) {
              response.statusCode = 500;
              response.end(error.message);
            }
          });
        },
      },
    ],
  });
  await server.listen();
  return {
    fixture,
    server,
    url: `http://127.0.0.1:${server.httpServer.address().port}`,
    reads: () => ({ preview: previewReads, state: stateReads }),
    holdPreview: () => {
      previewGate = Promise.withResolvers();
      return previewGate;
    },
    redirectPreview: (value) => {
      previewRedirect = value;
    },
    nextTurn: (block, invalid = false) => {
      turn = {
        block,
        invalid,
        understanding: Promise.withResolvers(),
        apply: Promise.withResolvers(),
        finish: Promise.withResolvers(),
        state: Promise.withResolvers(),
      };
      return turn;
    },
    close: async () => {
      previewGate?.resolve();
      if (turn)
        for (const key of ['understanding', 'apply', 'finish', 'state'])
          turn[key].resolve();
      await server.close();
    },
  };
}
