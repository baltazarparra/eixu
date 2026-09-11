import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadModule } from './helpers/load-module.mjs';
import { localPostgres } from './helpers/local-postgres.mjs';

await test(
  'reservas e feed com PostgreSQL local real',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const other = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const tenantId = randomUUID(),
      otherId = randomUUID();
    t.after(async () => {
      try {
        await database.query('delete from tenants where id = any($1)', [
          [tenantId, otherId],
        ]);
      } finally {
        await other.close();
        await database.close();
      }
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    await database.query(
      "insert into tenants (id, slug, name) values ($1::uuid, $1::text, 'Fixture geração'), ($2::uuid, $2::text, 'Outro tenant')",
      [tenantId, otherId],
    );
    const a = await loadModule('lib/generation/runs.ts', {
      '@/lib/db': database,
    });
    const b = await loadModule('lib/generation/runs.ts', { '@/lib/db': other });

    await t.test(
      'duas conexões só criam um run e reservam uma vez cada salto',
      async () => {
        const input = {
          tenantId,
          origin: 'https://fixture.test',
          phase: 'cenas',
        };
        const created = await Promise.all([
          a.createRun(input),
          b.createRun(input),
        ]);
        assert.equal(created.filter(Boolean).length, 1);
        const run = created.find(Boolean);
        const claims = await Promise.all([
          a.claimStep(run.id, 0),
          b.claimStep(run.id, 0),
        ]);
        assert.equal(claims.filter(Boolean).length, 1);
        assert.equal(claims.find(Boolean).hops, 1);
        await a.saveProgress(run.id, 'cenas', 'cenas:3');
        const active = await a.getRun(run.id);
        assert.equal(await b.claimStep(run.id, 0), null);
        assert.deepEqual(
          await a.getRun(run.id),
          active,
          'a repetição não mexe em fase, progresso ou heartbeat',
        );
        assert.equal(
          await b.createRun(input),
          null,
          'o índice continua protegendo o cliente',
        );
        await a.requestStop(run.id);
        const stopped = await b.claimStep(run.id, 1);
        assert.equal(stopped.status, 'stopping');
        await a.finishRun(run.id, 'paused');
        assert.equal(await b.claimStep(run.id, 2), null);
        assert.equal((await a.getRun(run.id)).status, 'paused');
      },
    );

    await t.test(
      'cursor zero, paginação e inserção entre leituras não perdem mensagens',
      async () => {
        const history = await loadModule('lib/ai/history.ts', {
          '@/lib/db': database,
        });
        const inserted = await database.query(
          "insert into chat_messages (tenant_id, role, content, channel) select $1, 'assistant', 'Mensagem ' || n, 'site' from generate_series(1, 65) n returning id",
          [tenantId],
        );
        await database.query(
          "insert into chat_messages (tenant_id, role, content, channel) values ($1, 'assistant', 'Não pertence ao cliente', 'site')",
          [otherId],
        );
        let insertDuringRead = true;
        let lateId;
        const { GET } = await loadModule(
          'app/api/admin/[tenant]/generation/route.ts',
          {
            '@/lib/auth': { isAuthenticated: async () => true },
            '@/lib/ai/history': {
              ...history,
              messagesAfter: async (...args) => {
                const rows = await history.messagesAfter(...args);
                if (insertDuringRead) {
                  insertDuringRead = false;
                  const late = await database.query(
                    "insert into chat_messages (tenant_id, role, content, channel) values ($1, 'assistant', 'Mensagem posterior', 'site') returning id",
                    [tenantId],
                  );
                  lateId = Number(late.rows[0].id);
                }
                return rows;
              },
            },
            '@/lib/tenant-queries': {
              getTenantBySlug: async () => ({ id: tenantId }),
              listPages: async () => [],
            },
            '@/lib/images/queries': { listImages: async () => [] },
            '@/lib/admin/state': { workspaceState: () => ({}) },
            '@/lib/generation/runs': {
              activeRun: async () => null,
              latestRun: async () => null,
              expireStaleRun: async (run) => run,
            },
            '@/lib/generation/start': {
              startGeneration: async () => {
                throw new Error('Não deve gerar');
              },
            },
          },
        );
        const read = async (cursor) =>
          GET(new Request(`https://fixture.test/generation?after=${cursor}`), {
            params: Promise.resolve({ tenant: tenantId }),
          });
        const first = await (await read(0)).json();
        assert.equal(first.messages.length, 60);
        assert.equal(first.lastMessageId, Number(inserted.rows[59].id));
        assert.equal(first.hasMoreMessages, true);
        const second = await (await read(first.lastMessageId)).json();
        assert.equal(second.messages.length, 6);
        assert.equal(second.lastMessageId, lateId);
        assert.equal(second.hasMoreMessages, false);
        const delivered = [...first.messages, ...second.messages];
        assert.equal(new Set(delivered.map((row) => row.id)).size, 66);
        assert.equal(
          delivered.some(
            (row) => row.parts[0].text === 'Não pertence ao cliente',
          ),
          false,
        );
        const empty = await (await read(lateId)).json();
        assert.equal(empty.messages.length, 0);
        assert.equal(empty.lastMessageId, lateId);
        assert.equal((await read(-1)).status, 400);
        assert.equal((await read('NaN')).status, 400);
        const initial = await history.chatHistory(tenantId);
        assert.equal(
          history.messageCursor(initial),
          Number(initial.at(-1).id.slice(6)),
        );
      },
    );
  },
);
