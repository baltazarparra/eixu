import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KanbanClient,
  KanbanHttpError,
  createCard,
  moveCard,
  resolveColumn,
  resolveTenant,
  updateCard,
} from '../scripts/kanban.mjs';

const columns = [
  { id: 'todo-id', title: 'A fazer' },
  { id: 'doing-id', title: 'Em andamento' },
  { id: 'review-id', title: 'Em revisão' },
];
const tenants = [
  { id: 'tenant-id', slug: 'eixu', name: 'EIXU' },
  { id: 'other-id', slug: 'outro', name: 'Outro' },
];

await test('cliente do Kanban prefere bearer dedicado sem cookie nem Origin', async () => {
  let observed;
  const client = new KanbanClient({
    baseUrl: 'https://eixu.example',
    token: 'token-dedicado',
    fetchImpl: async (url, init) => {
      assert.ok(url instanceof URL);
      observed = { url: url.href, init };
      return Response.json({ revision: 8 });
    },
  });
  await client.command({
    type: 'delete_card',
    cardId: 'card',
    expectedRevision: 7,
  });
  assert.equal(observed.url, 'https://eixu.example/api/admin/kanban/commands');
  assert.equal(
    observed.init.headers.get('authorization'),
    'Bearer token-dedicado',
  );
  assert.equal(observed.init.headers.get('cookie'), null);
  assert.equal(observed.init.headers.get('origin'), null);
  assert.equal(observed.init.headers.get('content-type'), 'application/json');
});

await test('cliente exige o token dedicado', () => {
  assert.throws(() => new KanbanClient(), /KANBAN_AGENT_TOKEN ausente/);
});

await test('resolução do quadro aceita IDs, nomes e slugs exatos', () => {
  const board = { columns, tenants };
  assert.equal(resolveColumn(board, 'em REVISÃO').id, 'review-id');
  assert.equal(resolveColumn(board, 'todo-id').id, 'todo-id');
  assert.equal(resolveTenant(board, 'EIXU'), 'tenant-id');
  assert.equal(resolveTenant(board, 'outro'), 'other-id');
  assert.equal(resolveTenant(board, 'none'), null);
  assert.throws(() => resolveColumn(board, 'Inexistente'));
  assert.throws(() => resolveTenant(board, 'Inexistente'));
});

await test('criação relê a revisão uma vez e preserva o UUID após conflito', async () => {
  const boards = [
    { revision: 3, columns, tenants },
    { revision: 4, columns, tenants },
  ];
  const commands = [];
  const client = {
    board: async () => boards.shift(),
    command: async (command) => {
      commands.push(command);
      if (commands.length === 1)
        throw new KanbanHttpError(409, {
          error: 'Quadro mudou.',
          code: 'REVISION_CONFLICT',
          currentRevision: 4,
        });
      return { revision: 5, card: { id: command.id, title: command.title } };
    },
  };

  const result = await createCard(client, {
    title: 'Documentar fluxo AI Native',
    column: 'A fazer',
    tenant: 'eixu',
    priority: 'high',
    description: 'Spec verificável.',
  });
  assert.equal(result.revision, 5);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].id, commands[1].id);
  assert.equal(commands[0].expectedRevision, 3);
  assert.equal(commands[1].expectedRevision, 4);
  assert.equal(commands[1].columnId, 'todo-id');
  assert.equal(commands[1].tenantId, 'tenant-id');
});

await test('atualização protege a versão do cartão e preserva campos omitidos', async () => {
  let submitted;
  const client = {
    card: async () => ({
      revision: 11,
      card: {
        id: 'card-id',
        title: 'Título atual',
        description: 'Contexto atual',
        tenantId: 'tenant-id',
        priority: 'medium',
        dueDate: '2026-10-01',
        version: 7,
      },
    }),
    command: async (command) => {
      submitted = command;
      return { revision: 12, card: { ...command, version: 8 } };
    },
  };

  await updateCard(client, 'card-id', {
    title: 'Título final',
    priority: 'urgent',
  });
  assert.deepEqual(submitted, {
    type: 'update_card',
    expectedRevision: 11,
    cardId: 'card-id',
    title: 'Título final',
    description: 'Contexto atual',
    priority: 'urgent',
    dueDate: '2026-10-01',
    expectedCardVersion: 7,
  });
});

await test('movimento usa a revisão corrente e não reordena a coluna atual', async () => {
  let submitted = null;
  const board = {
    revision: 14,
    columns,
    tenants,
    cards: [{ id: 'card-id', columnId: 'todo-id' }],
  };
  const client = {
    board: async () => board,
    command: async (command) => {
      submitted = command;
      return { ...board, revision: 15 };
    },
  };

  assert.equal(await moveCard(client, 'card-id', 'A fazer'), board);
  assert.equal(submitted, null);
  await moveCard(client, 'card-id', 'Em andamento');
  assert.deepEqual(submitted, {
    type: 'move_card',
    expectedRevision: 14,
    cardId: 'card-id',
    targetColumnId: 'doing-id',
    beforeCardId: null,
  });
});

await test('cliente recusa descrição acima do contrato antes de escrever', async () => {
  let reads = 0;
  const client = {
    board: async () => {
      reads += 1;
      return { revision: 0, columns, tenants };
    },
  };
  await assert.rejects(
    createCard(client, {
      title: 'Grande demais',
      description: 'x'.repeat(12_001),
    }),
    /limite é 12000/,
  );
  assert.equal(reads, 0);
});
