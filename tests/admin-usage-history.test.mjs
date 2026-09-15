import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { generateText, streamText, isStepCount, tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { loadModule } from './helpers/load-module.mjs';
import { localPostgres } from './helpers/local-postgres.mjs';

await test('filtros de consumo validam datas e paginação sem aceitar arrays', async () => {
  const { usageFilters } = await loadModule('lib/admin/usage-history.ts');
  assert.equal(usageFilters({ period: 'all', usagePage: '-1' }).page, 1);
  assert.equal(
    usageFilters({ start: '2026-02-30', end: '2026-03-01' }).page,
    1,
  );
  assert.ok(usageFilters({ start: ['2026-09-01'], end: '2026-09-15' }).error);
  assert.ok(usageFilters({ start: '2026-09-16', end: '2026-09-15' }).error);
  assert.ok(usageFilters({ start: '2024-01-01', end: '2026-09-15' }).error);
  assert.equal(
    usageFilters({ period: 'all', usagePage: '999999999' }).page,
    1_000_000,
  );
});

await test('o segmento de período vem da URL e aceita os links antigos', async () => {
  const { usageFilters } = await loadModule('lib/admin/usage-history.ts');
  assert.equal(usageFilters({}).periodo, '30');
  assert.equal(usageFilters({ periodo: '7' }).periodo, '7');
  assert.equal(usageFilters({ periodo: '90' }).periodo, '90');
  const tudo = usageFilters({ periodo: 'tudo' });
  assert.equal(tudo.periodo, 'tudo');
  assert.equal(tudo.start, undefined);
  assert.equal(tudo.end, undefined);
  // Um valor inventado não vira intervalo: cai no padrão de 30 dias.
  assert.equal(usageFilters({ periodo: 'ontem' }).periodo, '30');
  assert.equal(usageFilters({ periodo: ['7'] }).periodo, '30');
  // Links já emitidos por /dados continuam válidos e acendem o segmento certo.
  assert.equal(usageFilters({ period: 'all' }).periodo, 'tudo');
  assert.equal(
    usageFilters({ start: '2026-01-01', end: '2026-01-10' }).periodo,
    'livre',
  );
  assert.equal(
    usageFilters({ start: '2026-02-30', end: '2026-03-01' }).periodo,
    '30',
  );
});

await test(
  'histórico de IA no PostgreSQL: recibos, isolamento, migração e SDK real',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const a = randomUUID();
    const b = randomUUID();
    t.after(async () => {
      try {
        await database.query('delete from tenants where id = any($1)', [
          [a, b],
        ]);
      } finally {
        await database.close();
      }
    });
    const schema = await readFile('db/schema.sql', 'utf8');
    await database.query(schema);
    await database.query(
      'insert into tenants (id, slug, name) values ($1::uuid, $1::text, $1::text), ($2::uuid, $2::text, $2::text)',
      [a, b],
    );
    const sql = database.db();
    sql.query = async (text, values) =>
      (await database.query(text, values)).rows;
    const mocks = { '@/lib/db': { db: () => sql } };
    const ledger = await loadModule('lib/ai/usage-ledger.ts', mocks);
    const reports = await loadModule('lib/admin/usage-history.ts', mocks);
    const context = { tenantId: a, kind: 'conversa', model: 'fixture/model' };
    const hooks = ledger.usageTracking(context);
    const event = (callId, stepNumber = 0) => ({ callId, stepNumber });
    const finish = (callId, usage, cost, stepNumber = 0) =>
      hooks.onStepEnd({
        ...event(callId, stepNumber),
        usage,
        providerMetadata: { gateway: { cost } },
      });

    await t.test(
      'recibos idempotentes, campos ausentes e custo zero são distintos',
      async () => {
        await hooks.onStepStart(event('first'));
        await finish(
          'first',
          {
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
            inputTokenDetails: {
              cacheReadTokens: 80,
              cacheWriteTokens: 12,
            },
            outputTokenDetails: { reasoningTokens: 5 },
          },
          '0.0012',
        );
        await hooks.onStepStart(event('first'));
        await finish(
          'first',
          {
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
            inputTokenDetails: {
              cacheReadTokens: 80,
              cacheWriteTokens: 12,
            },
            outputTokenDetails: { reasoningTokens: 5 },
          },
          '0.0012',
        );
        await hooks.onStepStart(event('first', 1));
        await finish('first', { inputTokens: 10, outputTokens: 5 }, 0, 1);
        await hooks.onStepStart(event('missing'));
        await finish('missing', { inputTokens: 3, outputTokens: 2 }, undefined);
        await hooks.onStepStart(event('interrupted'));
        const other = ledger.usageTracking({ ...context, tenantId: b });
        await other.onStepStart(event('first'));
        await other.onStepEnd({
          ...event('first'),
          usage: { inputTokens: 999 },
          providerMetadata: { gateway: { cost: '900' } },
        });
        const result = await reports.usageHistory(a, { page: 1 });
        assert.equal(result.totals.calls, 4);
        assert.equal(result.totalRows, 3);
        assert.equal(result.totals.totalTokens, 140);
        assert.equal(result.totals.costUsd, 0.0012);
        assert.equal(result.totals.missingCost, 2);
        assert.equal(result.totals.pending, 1);
        assert.equal(result.totals.cacheReadTokens, 80);
        assert.equal(result.totals.cacheWriteTokens, 12);
        assert.equal(
          result.rows.find((row) => row.operationId === 'first').calls,
          2,
        );
      },
    );

    await t.test(
      'imagens registram custo mesmo sem tokens e conservam falhas',
      async () => {
        await ledger.trackImageUsage(
          { ...context, kind: 'imagem' },
          async () => ({
            usage: {},
            providerMetadata: { gateway: { cost: '0.05' } },
          }),
        );
        await assert.rejects(
          ledger.trackImageUsage({ ...context, kind: 'logo' }, async () => {
            throw new Error('Falha de fixture');
          }),
          /Falha de fixture/,
        );
        const result = await reports.usageHistory(a, { page: 1 });
        assert.equal(result.totals.failed, 1);
        assert.equal(
          result.rows.find((row) => row.kind === 'imagem').costUsd,
          0.05,
        );
        assert.equal(
          result.rows.find((row) => row.kind === 'imagem').totalTokens,
          null,
        );
      },
    );

    await t.test(
      'SDK executa dois passos com uma operação e sem somar o total novamente',
      async () => {
        const startCount = (await reports.usageHistory(a, { page: 1 })).totals
          .calls;
        let calls = 0;
        const model = new MockLanguageModelV4({
          doGenerate: async () => {
            calls++;
            return {
              content:
                calls === 1
                  ? [
                      {
                        type: 'tool-call',
                        toolCallId: 'tool',
                        toolName: 'read',
                        input: '{}',
                      },
                    ]
                  : [{ type: 'text', text: 'Concluído' }],
              finishReason: {
                unified: calls === 1 ? 'tool-calls' : 'stop',
                raw: 'stop',
              },
              usage: {
                inputTokens: { total: 20 },
                outputTokens: { total: 10 },
              },
              providerMetadata: { gateway: { cost: '0.0001' } },
              warnings: [],
            };
          },
        });
        await generateText({
          model,
          ...hooks,
          prompt: 'Fixture',
          tools: {
            read: tool({
              inputSchema: z.object({}),
              execute: async () => 'ok',
            }),
          },
          stopWhen: isStepCount(2),
        });
        const result = await reports.usageHistory(a, { page: 1 });
        assert.equal(result.totals.calls, startCount + 2);
        const row = result.rows.find(
          (item) => item.operationId !== 'first' && item.calls === 2,
        );
        assert.equal(row.totalTokens, 60);
        assert.equal(row.costUsd, 0.0002);
        assert.equal(row.pending, 0);
      },
    );

    await t.test('stream registra recibo e metadados do SDK', async () => {
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: new ReadableStream({
            start(controller) {
              for (const chunk of [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text' },
                { type: 'text-delta', id: 'text', delta: 'Olá' },
                { type: 'text-end', id: 'text' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: { total: 7 },
                    outputTokens: { total: 4 },
                  },
                  providerMetadata: { gateway: { cost: '0.00003' } },
                },
              ])
                controller.enqueue(chunk);
              controller.close();
            },
          }),
        }),
      });
      const result = streamText({ model, ...hooks, prompt: 'Fixture' });
      assert.equal(await result.text, 'Olá');
      const history = await reports.usageHistory(a, { page: 1 });
      assert.ok(
        history.rows.some(
          (row) =>
            row.totalTokens === 11 &&
            row.costUsd === 0.00003 &&
            row.pending === 0,
        ),
      );
    });

    await t.test(
      'filtro usa dias inclusivos de Brasília e resumo não depende da página',
      async () => {
        await database.query(
          "update ai_usage set created_at = '2026-09-15T03:00:00Z' where tenant_id = $1",
          [a],
        );
        await database.query(
          "update ai_usage set created_at = '2026-09-15T02:59:59Z' where tenant_id = $1 and operation_id = 'first'",
          [a],
        );
        const previous = await reports.usageHistory(a, {
          page: 1,
          start: '2026-09-14',
          end: '2026-09-14',
        });
        assert.equal(previous.totals.calls, 2);
        assert.equal(previous.daily[0].day, '2026-09-14');
        for (let i = 0; i < 23; i++)
          await hooks.onStepStart(event(`page-${i}`));
        const first = await reports.usageHistory(a, { page: 1 });
        const last = await reports.usageHistory(a, { page: 999 });
        assert.equal(first.rows.length, 20);
        assert.equal(last.page, last.pages);
        assert.equal(first.totals.calls, last.totals.calls);
        assert.equal(first.rows.length + last.rows.length, first.totalRows);
        assert.ok(
          !last.rows.some((row) =>
            first.rows.some((other) => row.operationId === other.operationId),
          ),
        );
      },
    );

    await t.test(
      'gráfico agrupa por etapa e o resumo do cartão não cruza clientes',
      async () => {
        const history = await reports.usageHistory(a, { page: 1 });
        const chart = history.byOperation;
        assert.ok(chart.length > 1);
        // Cada chamada do período aparece em exatamente uma barra.
        assert.equal(
          chart.reduce((total, row) => total + row.calls, 0),
          history.totals.calls,
        );
        const sizes = chart.map((row) => row.totalTokens ?? 0);
        assert.deepEqual(sizes, [...sizes].sort((one, two) => two - one));
        assert.ok(
          chart.some((row) => row.kind === 'imagem' && row.totalTokens === null),
        );
        const mine = await reports.usageSummary(a);
        const theirs = await reports.usageSummary(b);
        assert.equal(mine.days, 30);
        assert.equal(theirs.costUsd, 900);
        assert.notEqual(mine.costUsd, 900);
      },
    );

    await t.test(
      'migração recupera legado uma vez e ignora resumo já contabilizado',
      async () => {
        const run = randomUUID();
        await database.query(
          "insert into generation_runs (id, tenant_id, origin, status) values ($1, $2, 'fixture', 'done')",
          [run, a],
        );
        const usage = {
          model: 'legacy',
          inputTokens: 1000,
          outputTokens: 100,
          totalTokens: 1100,
          costUsd: 0.2,
        };
        await database.query(
          "insert into generation_events (run_id, tenant_id, phase, kind, label, payload) values ($1, $2, 'briefing', 'phase_end', 'Antigo', $3), ($1, $2, 'composicao', 'phase_end', 'Novo', $4)",
          [
            run,
            a,
            JSON.stringify({ usage }),
            JSON.stringify({ usage, usageLedger: true }),
          ],
        );
        await database.query(schema);
        await database.query(schema);
        const rows = await database.query(
          'select * from ai_usage where tenant_id = $1 and legacy',
          [a],
        );
        assert.equal(rows.rows.length, 1);
        assert.equal(Number(rows.rows[0].total_tokens), 1100);
        assert.equal(Number(rows.rows[0].cost_usd), 0.2);
      },
    );
  },
);
