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
      otherId = randomUUID(),
      legacyId = randomUUID();
    t.after(async () => {
      try {
        await database.query('delete from tenants where id = any($1)', [
          [tenantId, otherId, legacyId],
        ]);
      } finally {
        await other.close();
        await database.close();
      }
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    await database.query(
      "insert into tenants (id, slug, name) values ($1::uuid, $1::text, 'Fixture geração'), ($2::uuid, $2::text, 'Outro tenant'), ($3::uuid, $3::text, 'Histórico legado')",
      [tenantId, otherId, legacyId],
    );
    const a = await loadModule('lib/generation/runs.ts', {
      '@/lib/db': database,
    });
    const b = await loadModule('lib/generation/runs.ts', { '@/lib/db': other });

    await t.test(
      'feed consulta histórico legado por tenant e canal, sem depender do cursor',
      async () => {
        const history = await loadModule('lib/ai/history.ts', {
          '@/lib/db': database,
        });
        const tenants = await loadModule('lib/tenant-queries.ts', {
          '@/lib/db': database,
        });
        const { GET } = await loadModule(
          'app/api/admin/[tenant]/generation/route.ts',
          {
            '@/lib/auth': { isAuthenticated: async () => true },
            '@/lib/ai/history': history,
            '@/lib/tenant-queries': tenants,
            '@/lib/images/queries': { listImages: async () => [] },
            '@/lib/generation/runs': a,
            '@/lib/generation/start': {
              startGeneration: async () => assert.fail('A leitura não gera'),
            },
          },
        );
        const read = async () =>
          (
            await GET(
              new Request('https://fixture.test/generation?after=999999'),
              { params: Promise.resolve({ tenant: legacyId }) },
            )
          ).json();
        assert.equal((await read()).everRan, false);
        await database.query(
          "insert into chat_messages (tenant_id, role, content, channel) values ($1, 'user', 'Histórico do outro cliente', 'site'), ($2, 'user', 'Estúdio antigo', 'imagens')",
          [otherId, legacyId],
        );
        assert.equal(await history.hasChatHistory(otherId), true);
        assert.equal(await history.hasChatHistory(legacyId), false);
        assert.equal((await read()).everRan, false);

        await database.query(
          'update tenants set brief = \'{"generation":{"phase":"briefing"}}\'::jsonb where id = $1',
          [legacyId],
        );
        assert.equal((await read()).everRan, true);
        await database.query(
          "update tenants set brief = '{}'::jsonb where id = $1",
          [legacyId],
        );
        await database.query(
          "insert into chat_messages (tenant_id, role, content, channel) values ($1, 'user', 'Tentativa anterior no chat', 'site')",
          [legacyId],
        );
        const feed = await read();
        assert.deepEqual(feed.messages, []);
        assert.equal(feed.state.generation.next, 'briefing');
        assert.equal(feed.everRan, true);
      },
    );

    await t.test(
      'falha de entrega só encerra o salto que ainda é dono da execução',
      async () => {
        const run = await a.createRun({
          tenantId: legacyId,
          origin: 'https://fixture.test',
          phase: 'revisao',
        });
        const first = await a.claimStep(run.id, 0);
        await a.saveProgress(run.id, 'revisao', 'revisao:pendente');
        const next = await b.claimStep(run.id, first.hops);
        const before = await b.getRun(run.id);
        assert.equal(
          await a.failReservedStep(run.id, first.hops, 'Resposta perdida'),
          false,
        );
        assert.deepEqual(await b.getRun(run.id), before);
        assert.equal(
          await b.failReservedStep(run.id, next.hops, 'Entrega indisponível'),
          true,
        );
        const failed = await a.getRun(run.id);
        assert.equal(failed.status, 'failed');
        assert.equal(failed.progress, 'revisao:pendente');
        assert.equal(failed.error, 'Entrega indisponível');
        assert.ok(failed.finishedAt);
        assert.equal(
          await a.failReservedStep(run.id, next.hops, 'Erro repetido'),
          false,
        );
        assert.deepEqual(
          JSON.parse(JSON.stringify(await b.getRun(run.id))),
          JSON.parse(JSON.stringify(failed)),
        );
      },
    );

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
              getTenantBySlug: async () => ({ id: tenantId, brief: {} }),
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
