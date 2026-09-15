import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = process.cwd();

export async function kanbanFixture() {
  const columns = ['A fazer', 'Em andamento', 'Concluído'].map(
    (title, position) => ({
      id: randomUUID(),
      title,
      position,
    }),
  );
  const state = {
    board: { id: randomUUID(), title: 'Kanban' },
    revision: 0,
    columns,
    cards: [],
  };
  const descriptions = new Map();
  let loseNextResponse = false;
  let failNextBoardRead = false;
  let failNextCardRead = false;
  let nextBoardReadDelayMs = 0;
  let nextCommandResponseDelayMs = 0;

  function normalizeCards(columnId) {
    state.cards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.position - b.position)
      .forEach((card, position) => {
        card.position = position;
      });
  }

  function reply(res, status, body) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'private, no-store');
    res.end(JSON.stringify(body));
  }

  function apply(command) {
    if (command.expectedRevision !== state.revision)
      return {
        status: 409,
        body: {
          error:
            'O quadro foi atualizado em outra aba. Confira as mudanças e tente novamente.',
          code: 'REVISION_CONFLICT',
          currentRevision: state.revision,
        },
      };
    let changed = true;
    let card;
    switch (command.type) {
      case 'create_column':
        state.columns.push({
          id: command.id,
          title: command.title,
          position: state.columns.length,
        });
        break;
      case 'rename_column': {
        const column = state.columns.find(
          (item) => item.id === command.columnId,
        );
        if (!column)
          return {
            status: 404,
            body: { error: 'Coluna não encontrada.', code: 'NOT_FOUND' },
          };
        changed = column.title !== command.title;
        column.title = command.title;
        break;
      }
      case 'reorder_columns':
        state.columns.sort(
          (a, b) =>
            command.orderedColumnIds.indexOf(a.id) -
            command.orderedColumnIds.indexOf(b.id),
        );
        state.columns.forEach((item, position) => {
          item.position = position;
        });
        break;
      case 'delete_column':
        state.columns.splice(
          state.columns.findIndex((item) => item.id === command.columnId),
          1,
        );
        state.columns.forEach((item, position) => {
          item.position = position;
        });
        break;
      case 'create_card':
        state.cards.push({
          id: command.id,
          columnId: command.columnId,
          title: command.title,
          position: state.cards.filter(
            (item) => item.columnId === command.columnId,
          ).length,
          hasDescription: false,
        });
        descriptions.set(command.id, '');
        break;
      case 'update_card': {
        const item = state.cards.find((entry) => entry.id === command.cardId);
        if (!item)
          return {
            status: 404,
            body: { error: 'Cartão não encontrado.', code: 'NOT_FOUND' },
          };
        changed =
          item.title !== command.title ||
          descriptions.get(item.id) !== command.description;
        item.title = command.title;
        item.hasDescription = Boolean(command.description);
        descriptions.set(item.id, command.description);
        card = { ...item, description: command.description };
        break;
      }
      case 'move_card': {
        const item = state.cards.find((entry) => entry.id === command.cardId);
        if (!item)
          return {
            status: 404,
            body: { error: 'Cartão não encontrado.', code: 'NOT_FOUND' },
          };
        const source = item.columnId;
        const destination = state.cards
          .filter(
            (entry) =>
              entry.columnId === command.targetColumnId && entry.id !== item.id,
          )
          .sort((a, b) => a.position - b.position);
        const index =
          command.beforeCardId === null
            ? destination.length
            : destination.findIndex(
                (entry) => entry.id === command.beforeCardId,
              );
        if (index < 0)
          return {
            status: 404,
            body: { error: 'Destino não encontrado.', code: 'NOT_FOUND' },
          };
        item.columnId = command.targetColumnId;
        destination.splice(index, 0, item);
        destination.forEach((entry, position) => {
          entry.position = position;
        });
        normalizeCards(source);
        break;
      }
      case 'delete_card': {
        const index = state.cards.findIndex(
          (entry) => entry.id === command.cardId,
        );
        if (index < 0)
          return {
            status: 404,
            body: { error: 'Cartão não encontrado.', code: 'NOT_FOUND' },
          };
        const [removed] = state.cards.splice(index, 1);
        descriptions.delete(removed.id);
        normalizeCards(removed.columnId);
        break;
      }
      default:
        return {
          status: 400,
          body: { error: 'Comando inválido.', code: 'VALIDATION_ERROR' },
        };
    }
    if (changed) state.revision += 1;
    return { status: 200, body: { ...state, ...(card ? { card } : {}) } };
  }

  const server = await createServer({
    configFile: false,
    root,
    cacheDir: path.join(root, 'node_modules/.vite-admin-kanban'),
    resolve: { alias: [{ find: '@', replacement: root }] },
    define: { 'process.env': '{}' },
    plugins: [
      react(),
      {
        name: 'eixu-kanban-fixture',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'next/link') return '\0kanban-next-link';
        },
        load(id) {
          if (id === '\0kanban-next-link')
            return `import {createElement} from 'react'; export default function Link({href,children,...rest}){return createElement('a',{href,...rest},children)}`;
        },
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url, 'http://fixture.test');
            if (
              url.pathname === '/__fixture/lose-response' &&
              req.method === 'POST'
            ) {
              loseNextResponse = true;
              res.statusCode = 204;
              res.end();
              return;
            }
            if (
              url.pathname === '/__fixture/edit-card' &&
              req.method === 'POST'
            ) {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const edit = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const item = state.cards.find((entry) => entry.id === edit.id);
              if (!item) {
                reply(res, 404, { error: 'Cartão não encontrado.' });
                return;
              }
              item.title = edit.title;
              item.hasDescription = Boolean(edit.description);
              descriptions.set(item.id, edit.description);
              state.revision += 1;
              reply(res, 200, state);
              return;
            }
            if (url.pathname === '/api/admin/kanban' && req.method === 'GET') {
              if (nextBoardReadDelayMs) {
                const delay = nextBoardReadDelayMs;
                nextBoardReadDelayMs = 0;
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
              if (failNextBoardRead) {
                failNextBoardRead = false;
                reply(res, 503, {
                  error: 'Falha temporária na leitura do quadro.',
                  code: 'SERVICE_UNAVAILABLE',
                });
              } else {
                reply(res, 200, state);
              }
              return;
            }
            if (
              url.pathname.startsWith('/api/admin/kanban/cards/') &&
              req.method === 'GET'
            ) {
              if (failNextCardRead) {
                failNextCardRead = false;
                reply(res, 503, { error: 'Falha temporária na leitura do cartão.' });
                return;
              }
              const id = url.pathname.split('/').at(-1);
              const item = state.cards.find((entry) => entry.id === id);
              reply(
                res,
                item ? 200 : 404,
                item
                  ? {
                      revision: state.revision,
                      card: {
                        ...item,
                        description: descriptions.get(id) ?? '',
                      },
                    }
                  : { error: 'Cartão não encontrado.', code: 'NOT_FOUND' },
              );
              return;
            }
            if (
              url.pathname === '/api/admin/kanban/commands' &&
              req.method === 'POST'
            ) {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const outcome = apply(
                JSON.parse(Buffer.concat(chunks).toString('utf8')),
              );
              if (nextCommandResponseDelayMs) {
                const delay = nextCommandResponseDelayMs;
                nextCommandResponseDelayMs = 0;
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
              if (loseNextResponse) {
                loseNextResponse = false;
                req.socket.destroy();
                return;
              }
              reply(res, outcome.status, outcome.body);
              return;
            }
            if (url.pathname === '/admin/app/kanban') {
              res.setHeader('content-type', 'text/html; charset=utf-8');
              const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script id="fixture-state" type="application/json">${JSON.stringify(state).replaceAll('<', '\\u003c')}</script><script type="module" src="/tests/browser/fixtures/admin-kanban.tsx"></script></body></html>`;
              res.end(await vite.transformIndexHtml(url.pathname, html));
              return;
            }
            next();
          });
        },
      },
    ],
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  return {
    base: `http://127.0.0.1:${server.httpServer.address().port}`,
    server,
    state,
    descriptions,
    loseResponse: () => {
      loseNextResponse = true;
    },
    failRead: () => {
      failNextBoardRead = true;
    },
    failCardRead: () => {
      failNextCardRead = true;
    },
    delayBoardRead: (milliseconds) => {
      nextBoardReadDelayMs = milliseconds;
    },
    delayCommandResponse: (milliseconds) => {
      nextCommandResponseDelayMs = milliseconds;
    },
  };
}
