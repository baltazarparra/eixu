import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadModule } from './helpers/load-module.mjs';
import { localPostgres } from './helpers/local-postgres.mjs';

const localUrl = process.env.EIXU_TEST_POSTGRES_URL;

await test(
  'Kanban: seed idempotente, comandos SQL, revisão e leitura compacta',
  { skip: !localUrl, timeout: 60_000 },
  async (t) => {
    const database = await localPostgres(localUrl);
    t.after(async () => {
      try {
        await database.query('delete from kanban_cards');
        await database.query('delete from kanban_columns');
        await database.query(
          "delete from kanban_boards where key = 'operations'",
        );
      } finally {
        await database.close();
      }
    });
    await database.query('delete from kanban_cards');
    await database.query('delete from kanban_columns');
    await database.query("delete from kanban_boards where key = 'operations'");
    const ddl = await readFile('db/schema.sql', 'utf8');
    await database.query(ddl);
    const dataSource = {
      transaction: database.transaction,
      db: () => ({
        query: async (sql, params) => (await database.query(sql, params)).rows,
      }),
    };
    const queries = await loadModule('lib/kanban/queries.ts', {
      '@/lib/db': dataSource,
    });
    const service = await loadModule('lib/kanban/service.ts', {
      '@/lib/db': dataSource,
      '@/lib/kanban/queries': queries,
    });
    const run = (type, expectedRevision, fields) =>
      service.executeKanbanCommand({ type, expectedRevision, ...fields });

    let board = await queries.readKanbanBoard();
    assert.equal(board.revision, 0);
    assert.deepEqual(
      board.columns.map((column) => column.title),
      ['A fazer', 'Em andamento', 'Em revisão', 'Concluído'],
    );
    await database.query(ddl);
    assert.equal((await queries.readKanbanBoard()).columns.length, 4);

    const extraId = randomUUID();
    board = await run('create_column', 0, { id: extraId, title: 'Revisão' });
    assert.equal(board.revision, 1);
    assert.equal(board.columns.length, 4);
    board = await run('rename_column', 1, {
      columnId: extraId,
      title: 'Revisão',
    });
    assert.equal(board.revision, 1, 'operação idêntica não aumenta revisão');
    const firstColumn = board.columns[0].id;
    const secondColumn = board.columns[2].id;
    const firstCard = randomUUID();
    const secondCard = randomUUID();
    board = await run('create_card', 1, {
      id: firstCard,
      columnId: firstColumn,
      title: 'Primeiro',
    });
    board = await run('create_card', 2, {
      id: secondCard,
      columnId: firstColumn,
      title: 'Segundo',
    });
    assert.equal(board.revision, 3);
    assert.equal(board.cards.length, 2);
    assert.equal(Object.hasOwn(board.cards[0], 'description'), false);
    const updated = await run('update_card', 3, {
      cardId: firstCard,
      title: 'Primeiro editado',
      description: 'Texto privado completo',
    });
    assert.equal(updated.card.description, 'Texto privado completo');
    assert.equal(updated.cards[0].hasDescription, true);
    assert.equal(
      (await queries.readKanbanCard(firstCard)).card.description,
      'Texto privado completo',
    );
    const sameCard = await run('update_card', 4, {
      cardId: firstCard,
      title: 'Primeiro editado',
      description: 'Texto privado completo',
    });
    assert.equal(sameCard.revision, 4);
    assert.equal(sameCard.card.description, 'Texto privado completo');
    assert.equal(
      (
        await run('move_card', 4, {
          cardId: firstCard,
          targetColumnId: firstColumn,
          beforeCardId: firstCard,
        })
      ).revision,
      4,
    );
    board = await run('move_card', 4, {
      cardId: firstCard,
      targetColumnId: firstColumn,
      beforeCardId: null,
    });
    assert.equal(board.revision, 5);
    assert.equal(board.cards.find((card) => card.id === firstCard).position, 1);
    assert.equal(
      board.cards.find((card) => card.id === secondCard).position,
      0,
    );
    board = await run('move_card', 5, {
      cardId: firstCard,
      targetColumnId: firstColumn,
      beforeCardId: secondCard,
    });
    assert.equal(board.revision, 6);
    assert.equal(board.cards.find((card) => card.id === firstCard).position, 0);
    board = await run('move_card', 6, {
      cardId: firstCard,
      targetColumnId: secondColumn,
      beforeCardId: null,
    });
    assert.equal(
      board.cards.find((card) => card.id === firstCard).columnId,
      secondColumn,
    );
    assert.equal(
      board.cards.find((card) => card.id === secondCard).position,
      0,
    );

    await assert.rejects(
      run('delete_column', 7, { columnId: secondColumn }),
      (error) => error.code === 'COLUMN_NOT_EMPTY' && error.status === 409,
    );
    const beforeInvalidMove = await queries.readKanbanBoard();
    await assert.rejects(
      run('move_card', 7, {
        cardId: firstCard,
        targetColumnId: firstColumn,
        beforeCardId: firstCard,
      }),
      (error) => error.code === 'NOT_FOUND' && error.status === 404,
    );
    const afterInvalidMove = await queries.readKanbanBoard();
    assert.equal(afterInvalidMove.revision, beforeInvalidMove.revision);
    assert.equal(
      afterInvalidMove.cards.find((card) => card.id === firstCard).columnId,
      secondColumn,
    );
    await assert.rejects(
      run('create_card', 6, {
        id: randomUUID(),
        columnId: firstColumn,
        title: 'Atrasado',
      }),
      (error) =>
        error.code === 'REVISION_CONFLICT' && error.currentRevision === 7,
    );
    await assert.rejects(
      run('create_card', 7, {
        id: firstCard,
        columnId: firstColumn,
        title: 'Duplicado',
      }),
      (error) => error.code === 'ID_ALREADY_EXISTS' && error.status === 409,
    );
    const foreignBoard = randomUUID();
    const foreignColumn = randomUUID();
    const foreignCard = randomUUID();
    await database.query(
      'insert into kanban_boards (id, key, title) values ($1, $2, $3)',
      [foreignBoard, randomUUID(), 'Outro quadro'],
    );
    try {
      await database.query(
        'insert into kanban_columns (id, board_id, title, position) values ($1, $2, $3, 0)',
        [foreignColumn, foreignBoard, 'Outra coluna'],
      );
      await database.query(
        'insert into kanban_cards (id, column_id, title, position) values ($1, $2, $3, 0)',
        [foreignCard, foreignColumn, 'Outro cartão'],
      );
      await assert.rejects(
        run('create_column', 7, { id: foreignColumn, title: 'Colisão' }),
        (error) => error.code === 'ID_ALREADY_EXISTS' && error.status === 409,
      );
      await assert.rejects(
        run('create_card', 7, {
          id: foreignCard,
          columnId: firstColumn,
          title: 'Colisão',
        }),
        (error) => error.code === 'ID_ALREADY_EXISTS' && error.status === 409,
      );
      for (const [type, fields] of [
        ['rename_column', { columnId: foreignColumn, title: 'Tentativa' }],
        ['delete_column', { columnId: foreignColumn }],
        [
          'update_card',
          { cardId: foreignCard, title: 'Tentativa', description: '' },
        ],
        ['delete_card', { cardId: foreignCard }],
        [
          'move_card',
          {
            cardId: foreignCard,
            targetColumnId: firstColumn,
            beforeCardId: null,
          },
        ],
      ]) {
        await assert.rejects(
          run(type, 7, fields),
          (error) => error.code === 'NOT_FOUND' && error.status === 404,
        );
      }
      assert.equal(
        (
          await database.query('select title from kanban_cards where id = $1', [
            foreignCard,
          ])
        ).rows[0].title,
        'Outro cartão',
      );
    } finally {
      await database.query('delete from kanban_cards where id = $1', [
        foreignCard,
      ]);
      await database.query('delete from kanban_columns where id = $1', [
        foreignColumn,
      ]);
      await database.query('delete from kanban_boards where id = $1', [
        foreignBoard,
      ]);
    }

    const concurrent = await Promise.allSettled([
      run('rename_column', 7, { columnId: extraId, title: 'Pronto' }),
      run('create_card', 7, {
        id: randomUUID(),
        columnId: firstColumn,
        title: 'Concorrente',
      }),
    ]);
    assert.equal(
      concurrent.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      concurrent.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.equal(
      concurrent.find((result) => result.status === 'rejected').reason.code,
      'REVISION_CONFLICT',
    );
    board = await queries.readKanbanBoard();
    assert.equal(board.revision, 8);

    board = await run('delete_card', 8, { cardId: firstCard });
    assert.equal(board.revision, 9);
    assert.equal(await queries.readKanbanCard(firstCard), null);
    board = await run('delete_column', 9, { columnId: secondColumn });
    assert.equal(board.revision, 10);
    assert.equal(board.columns.length, 4);
    board = await run('rename_column', 10, {
      columnId: firstColumn,
      title: 'Entrada',
    });
    assert.equal(board.revision, 11);
    await database.query(ddl);
    const reapplied = await queries.readKanbanBoard();
    assert.equal(reapplied.columns.length, 4);
    assert.equal(
      reapplied.columns.find((column) => column.id === firstColumn).title,
      'Entrada',
    );
    assert.equal(
      reapplied.columns.some((column) => column.title === 'Em revisão'),
      false,
    );
    const ids = reapplied.columns.map((column) => column.id);
    assert.equal(
      (await run('reorder_columns', 11, { orderedColumnIds: ids })).revision,
      11,
    );
    board = await run('reorder_columns', 11, {
      orderedColumnIds: ids.toReversed(),
    });
    assert.equal(board.revision, 12);
    assert.equal(board.columns[0].id, ids.at(-1));
    const currentCards = board.cards.length;
    await database.query(
      `insert into kanban_cards (id, column_id, title, position)
       select gen_random_uuid(), $1, 'Carga local', series
       from generate_series($2::integer, 499) series`,
      [firstColumn, currentCards],
    );
    assert.equal((await queries.readKanbanBoard()).cards.length, 500);
    await assert.rejects(
      run('create_card', 12, {
        id: randomUUID(),
        columnId: firstColumn,
        title: 'Acima do limite',
      }),
      (error) => error.code === 'VALIDATION_ERROR' && error.status === 400,
    );
    await database.query(
      `insert into kanban_columns (id, board_id, title, position)
       select gen_random_uuid(), $1, 'Extra ' || series, series
       from generate_series(4, 7) series`,
      [board.board.id],
    );
    await assert.rejects(
      run('create_column', 12, { id: randomUUID(), title: 'Nona coluna' }),
      (error) => error.code === 'VALIDATION_ERROR' && error.status === 400,
    );
    await database.query('delete from kanban_cards');
    await database.query('delete from kanban_columns where id <> $1', [
      firstColumn,
    ]);
    await assert.rejects(
      run('delete_column', 12, { columnId: firstColumn }),
      (error) => error.code === 'LAST_COLUMN' && error.status === 409,
    );
  },
);

await test(
  'Kanban: cliente, prioridade, prazo, arquivo e versão isolada do cartão',
  { skip: !localUrl, timeout: 60_000 },
  async (t) => {
    const database = await localPostgres(localUrl);
    const tenantId = randomUUID();
    t.after(async () => {
      try {
        await database.query('delete from kanban_cards');
        await database.query('delete from kanban_columns');
        await database.query(
          "delete from kanban_boards where key = 'operations'",
        );
        await database.query('delete from tenants where id = $1', [tenantId]);
      } finally {
        await database.close();
      }
    });
    await database.query('delete from kanban_cards');
    await database.query('delete from kanban_columns');
    await database.query("delete from kanban_boards where key = 'operations'");
    const ddl = await readFile('db/schema.sql', 'utf8');
    await database.query(ddl);
    await database.query(
      'insert into tenants (id, slug, name) values ($1, $2, $3)',
      [tenantId, `kanban-${tenantId}`, 'Cliente do Kanban'],
    );
    const dataSource = {
      transaction: database.transaction,
      db: () => ({
        query: async (sql, params) => (await database.query(sql, params)).rows,
      }),
    };
    const queries = await loadModule('lib/kanban/queries.ts', {
      '@/lib/db': dataSource,
    });
    const service = await loadModule('lib/kanban/service.ts', {
      '@/lib/db': dataSource,
      '@/lib/kanban/queries': queries,
    });
    const run = (type, expectedRevision, fields) =>
      service.executeKanbanCommand({ type, expectedRevision, ...fields });

    let board = await queries.readKanbanBoard();
    const firstColumn = board.columns[0].id;
    const secondColumn = board.columns[1].id;
    const reviewColumn = board.columns[2].id;
    const firstCard = randomUUID();
    const secondCard = randomUUID();
    board = await run('create_card', 0, {
      id: firstCard,
      columnId: firstColumn,
      title: 'Publicar landing page',
      description: 'Conferir a prévia antes do deploy.',
      tenantId,
      priority: 'high',
      dueDate: '2026-10-15',
    });
    assert.equal(board.cards[0].tenantName, 'Cliente do Kanban');
    assert.equal(board.cards[0].priority, 'high');
    assert.equal(board.cards[0].dueDate, '2026-10-15');
    assert.equal(board.cards[0].version, 1);
    assert.equal(
      board.tenants.some((tenant) => tenant.id === tenantId),
      true,
    );
    assert.equal(
      (await queries.readKanbanCard(firstCard)).card.description,
      'Conferir a prévia antes do deploy.',
    );

    board = await run('create_card', 1, {
      id: secondCard,
      columnId: secondColumn,
      title: 'Mudança independente',
    });
    const updated = await run('update_card', 1, {
      cardId: firstCard,
      title: 'Publicar landing page',
      description: 'Pronta para publicar.',
      tenantId,
      priority: 'urgent',
      dueDate: null,
      expectedCardVersion: 1,
    });
    assert.equal(updated.revision, 3);
    assert.equal(updated.card.version, 2);
    assert.equal(updated.card.priority, 'urgent');
    assert.equal(updated.card.dueDate, null);
    await assert.rejects(
      run('update_card', 3, {
        cardId: firstCard,
        title: 'Versão antiga',
        description: '',
        expectedCardVersion: 1,
      }),
      (error) => error.code === 'CARD_VERSION_CONFLICT' && error.status === 409,
    );

    board = await run('archive_card', 3, { cardId: firstCard });
    assert.equal(board.revision, 4);
    assert.equal(
      board.cards.some((card) => card.id === firstCard),
      false,
    );
    assert.equal(board.archivedCards[0].id, firstCard);
    assert.equal(board.archivedCards[0].position, 500);
    assert.equal(
      board.columns.find((column) => column.id === firstColumn)
        .archivedCardCount,
      1,
    );
    await assert.rejects(
      run('delete_column', 4, { columnId: firstColumn }),
      (error) => error.code === 'COLUMN_NOT_EMPTY' && error.status === 409,
    );
    board = await run('restore_card', 4, { cardId: firstCard });
    assert.equal(board.revision, 5);
    assert.equal(board.archivedCards.length, 0);
    assert.equal(board.cards.find((card) => card.id === firstCard).version, 4);

    await database.query('delete from tenants where id = $1', [tenantId]);
    board = await queries.readKanbanBoard();
    assert.equal(
      board.cards.find((card) => card.id === firstCard).tenantId,
      null,
    );
    assert.equal(
      board.tenants.some((tenant) => tenant.id === tenantId),
      false,
    );

    board = await run('delete_column', 5, { columnId: reviewColumn });
    assert.equal(board.revision, 6);
    await database.query(
      "update kanban_boards set schema_version = 1 where key = 'operations'",
    );
    await database.query(ddl);
    board = await queries.readKanbanBoard();
    assert.deepEqual(
      board.columns.map((column) => column.title),
      ['A fazer', 'Em andamento', 'Em revisão', 'Concluído'],
    );
    const upgradedReview = board.columns.find(
      (column) => column.title === 'Em revisão',
    ).id;
    board = await run('delete_column', 6, { columnId: upgradedReview });
    assert.equal(board.revision, 7);
    await database.query(ddl);
    assert.equal(
      (await queries.readKanbanBoard()).columns.some(
        (column) => column.title === 'Em revisão',
      ),
      false,
      'reaplicar o schema não restaura uma etapa removida após o upgrade',
    );
  },
);

await test('Kanban: autenticação, host, Origin, validação e limite do POST', async () => {
  let authenticated = false;
  let executed = 0;
  let reads = 0;
  const auth = { isAuthenticated: async () => authenticated };
  const host = await loadModule('lib/tenant-host.ts');
  const guard = await loadModule('app/api/admin/kanban/guard.ts', {
    '@/lib/auth': auth,
    '@/lib/tenant-host': host,
  });
  const service = {
    executeKanbanCommand: async (command) => {
      executed += 1;
      return { revision: command.expectedRevision + 1, columns: [], cards: [] };
    },
    KanbanError: class KanbanError extends Error {},
  };
  const responses = await loadModule(
    'app/api/admin/kanban/responses.ts',
    {
      '@/lib/kanban/service': service,
      '@/app/api/admin/kanban/guard': guard,
    },
    { crypto: globalThis.crypto },
  );
  const { POST } = await loadModule(
    'app/api/admin/kanban/commands/route.ts',
    {
      '@/lib/kanban/service': service,
      '@/app/api/admin/kanban/guard': guard,
      '@/app/api/admin/kanban/responses': responses,
    },
    { TextDecoder, crypto: globalThis.crypto },
  );
  const queries = {
    readKanbanBoard: async () => {
      reads += 1;
      return { revision: 0, columns: [], cards: [] };
    },
    readKanbanCard: async (id) => {
      reads += 1;
      return { revision: 0, card: { id, title: 'Teste', description: '' } };
    },
  };
  const routes = {
    '@/lib/kanban/queries': queries,
    '@/app/api/admin/kanban/guard': guard,
    '@/app/api/admin/kanban/responses': responses,
  };
  const boardGet = (await loadModule('app/api/admin/kanban/route.ts', routes))
    .GET;
  const cardGet = (
    await loadModule('app/api/admin/kanban/cards/[id]/route.ts', routes)
  ).GET;
  const payload = JSON.stringify({
    type: 'create_column',
    expectedRevision: 0,
    id: randomUUID(),
    title: 'Nova',
  });
  const request = (url, body, origin = 'https://app.eixu.com.br') =>
    new Request(url, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body,
    });
  let response = await POST(
    request('https://app.eixu.com.br/api/admin/kanban/commands', payload),
  );
  assert.equal(response.status, 401);
  assert.equal(
    (await boardGet(new Request('https://app.eixu.com.br/api/admin/kanban')))
      .status,
    401,
  );
  assert.equal(
    (
      await cardGet(
        new Request(
          `https://app.eixu.com.br/api/admin/kanban/cards/${randomUUID()}`,
        ),
        { params: Promise.resolve({ id: randomUUID() }) },
      )
    ).status,
    401,
  );
  assert.equal(reads, 0);
  authenticated = true;
  assert.equal(
    (
      await boardGet(
        new Request('https://cliente.eixu.com.br/api/admin/kanban'),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await cardGet(
        new Request(
          `https://cliente.eixu.com.br/api/admin/kanban/cards/${randomUUID()}`,
        ),
        { params: Promise.resolve({ id: randomUUID() }) },
      )
    ).status,
    403,
  );
  assert.equal(reads, 0);
  response = await POST(
    request(
      'https://cliente.eixu.com.br/api/admin/kanban/commands',
      payload,
      'https://cliente.eixu.com.br',
    ),
  );
  assert.equal(response.status, 403);
  response = await POST(
    request(
      'https://app.eixu.com.br/api/admin/kanban/commands',
      payload,
      'https://evil.test',
    ),
  );
  assert.equal(response.status, 403);
  response = await POST(
    request('https://app.eixu.com.br/api/admin/kanban/commands', '{'),
  );
  assert.equal(response.status, 400);
  response = await POST(
    request(
      'https://app.eixu.com.br/api/admin/kanban/commands',
      JSON.stringify({ ...JSON.parse(payload), title: '' }),
    ),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'VALIDATION_ERROR');
  response = await POST(
    request(
      'https://app.eixu.com.br/api/admin/kanban/commands',
      'x'.repeat(33 * 1024),
    ),
  );
  assert.equal(response.status, 413);
  response = await POST(
    request('https://app.eixu.com.br/api/admin/kanban/commands', payload),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(executed, 1);
  response = await boardGet(
    new Request('https://app.eixu.com.br/api/admin/kanban'),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  response = await cardGet(
    new Request(
      `https://app.eixu.com.br/api/admin/kanban/cards/${randomUUID()}`,
    ),
    { params: Promise.resolve({ id: randomUUID() }) },
  );
  assert.equal(response.status, 200);
  assert.equal(reads, 2);
});

await test('transporte administrativo preserva code, fields e revisão do conflito', async () => {
  let response = Response.json(
    {
      error: 'Coluna inválida.',
      code: 'VALIDATION_ERROR',
      fields: { title: 'Informe o título.' },
    },
    { status: 400 },
  );
  const transport = await loadModule(
    'lib/admin/http.ts',
    {},
    {
      fetch: async () => response,
    },
  );
  await assert.rejects(
    transport.adminFetch('/api/admin/kanban'),
    (error) =>
      error instanceof transport.AdminHttpError &&
      error.status === 400 &&
      error.code === 'VALIDATION_ERROR' &&
      error.fields.title === 'Informe o título.',
  );
  response = Response.json(
    {
      error: 'Quadro atualizado.',
      code: 'REVISION_CONFLICT',
      currentRevision: 12,
    },
    { status: 409 },
  );
  await assert.rejects(
    transport.adminFetch('/api/admin/kanban'),
    (error) =>
      error instanceof transport.AdminHttpError &&
      error.status === 409 &&
      error.code === 'REVISION_CONFLICT' &&
      error.currentRevision === 12,
  );
});

await test('endereço legado do Kanban redireciona para a rota canônica', async () => {
  let destination = '';
  const legacy = await loadModule('app/(admin)/admin/app/kanban/page.tsx', {
    'next/navigation': {
      permanentRedirect: (path) => {
        destination = path;
      },
    },
  });
  legacy.default();
  assert.equal(destination, '/admin/kanban');
});
