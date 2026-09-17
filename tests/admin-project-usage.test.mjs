import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseReceipts } from '../lib/usage/receipts.mjs';
import { importReceipts } from '../lib/usage/import.mjs';
import { localPostgres } from './helpers/local-postgres.mjs';
import { loadModule } from './helpers/load-module.mjs';

const stamp = '2026-09-17T01:00:00Z';
const lines = (...events) =>
  events.map((event) => JSON.stringify(event)).join('\n') + '\n';
const counts = (input, output = 20) => ({
  input_tokens: input,
  output_tokens: output,
  total_tokens: input + output,
  cached_input_tokens: 30,
  reasoning_output_tokens: 5,
});
const codex = (total, last, timestamp = stamp) => ({
  type: 'event_msg',
  timestamp,
  payload: {
    type: 'token_count',
    info: { total_token_usage: total, last_token_usage: last },
  },
});
const meta = { type: 'session_meta', payload: { id: 'session' } };
const context = {
  type: 'turn_context',
  payload: { model: 'test-model', turn_id: 'turn-1' },
};

await test('Codex importa chamadas, não acumulados, e ignora repetição de evento', () => {
  const data = parseReceipts(
    lines(
      meta,
      context,
      codex(counts(100), counts(100)),
      codex(counts(100), counts(100)),
      codex(counts(160, 40), counts(60)),
    ),
    'codex',
  );
  assert.equal(data.receipts.length, 2);
  assert.equal(
    data.receipts.reduce((sum, r) => sum + r.inputTokens, 0),
    160,
  );
  assert.equal(data.receipts[0].model, 'test-model');
  assert.equal(data.receipts[0].costUsd, null);
  assert.equal(data.receipts[0].cacheWriteTokens, null);
  assert.deepEqual(
    parseReceipts(
      lines(meta, context, codex(counts(100), counts(100))),
      'codex',
    ).receipts[0],
    data.receipts[0],
  );
});

await test('fork, corrupção e ausência de identidade não são cobrança inventada', () => {
  assert.throws(
    () =>
      parseReceipts(
        lines(
          {
            type: 'session_meta',
            payload: { id: 'fork', forked_from_id: 'parent' },
          },
          codex(counts(100), counts(100)),
        ),
        'codex',
      ),
    /bifurcada/,
  );
  assert.throws(
    () => parseReceipts(lines(codex(counts(100), counts(100))), 'codex'),
    /identidade/,
  );
  assert.throws(
    () => parseReceipts('{broken}\n{}\n', 'codex'),
    /JSON inválido/,
  );
  const partial = parseReceipts(
    lines(meta, context, codex(counts(100), counts(100))) + '{',
    'codex',
  );
  assert.equal(partial.receipts.length, 1);
  assert.match(partial.warnings.join(' '), /incompleta/);
  assert.match(
    parseReceipts('', 'codex').warnings.join(' '),
    /não comprova consumo zero/,
  );
});

const claude = (output = 20) => ({
  type: 'assistant',
  sessionId: 'session',
  timestamp: stamp,
  message: {
    id: 'msg-1',
    model: 'claude-test',
    content: [{ text: 'SENSITIVE CONTENT MUST NOT LEAVE' }],
    usage: {
      input_tokens: 10,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 50,
      output_tokens: output,
      output_tokens_details: { thinking_tokens: 5 },
    },
  },
});
await test('Claude normaliza cache e blocos repetidos/streaming sem duplicar', () => {
  const { receipts } = parseReceipts(
    lines(claude(), claude(40), claude()),
    'claude',
  );
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].inputTokens, 160);
  assert.equal(receipts[0].outputTokens, 40);
  assert.equal(receipts[0].totalTokens, 200);
  assert.equal(receipts[0].reasoningTokens, 5);
  assert.doesNotMatch(JSON.stringify(receipts), /SENSITIVE|content|sessionId/);
});
const external = {
  source: 'external',
  externalId: 'provider:account:call',
  model: 'hosting',
  kind: 'servico-externo',
  occurredAt: stamp,
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  reasoningTokens: null,
  costUsd: 0,
};
await test('serviços preservam custo zero, ausência de tokens e recusam conteúdo/contadores inválidos', () => {
  assert.deepEqual(
    parseReceipts(lines(external), 'external').receipts[0],
    external,
  );
  for (const patch of [
    { costUsd: -1 },
    { inputTokens: -1 },
    { totalTokens: 1.5 },
    { prompt: 'secret' },
    { source: 'codex' },
  ]) {
    assert.throws(() =>
      parseReceipts(lines({ ...external, ...patch }), 'external'),
    );
  }
});

await test(
  'Postgres: importação atômica, atribuição exclusiva, evolução e total vitalício',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const id = randomUUID();
    const other = randomUUID();
    t.after(async () => {
      await database.query('delete from tenants where id = any($1)', [
        [id, other],
      ]);
      await database.close();
    });
    const schema = await readFile('db/schema.sql', 'utf8');
    await database.query(schema);
    await database.query(schema);
    await database.query(
      'insert into tenants (id,slug,name) values ($1::uuid,$1::text,$1::text), ($2::uuid,$2::text,$2::text)',
      [id, other],
    );
    const receipt = { ...external, externalId: randomUUID(), costUsd: 1.25 };
    const input = { tenant: id, lifecycle: 'premium', receipts: [receipt] };
    await importReceipts(database, input);
    await importReceipts(database, input);
    const sql = database.db();
    sql.query = async (text, values) =>
      (await database.query(text, values)).rows;
    const mocks = { '@/lib/db': { db: () => sql } };
    const reports = await loadModule('lib/admin/usage-history.ts', mocks);
    let history = await reports.usageHistory(id, { periodo: 'tudo', page: 1 });
    assert.equal(history.totals.calls, 1);
    assert.equal(Number(history.totals.costUsd), 1.25);
    assert.equal(history.bySource[0].lifecycle, 'premium');
    assert.equal(history.totals.totalTokens, null);
    await assert.rejects(
      importReceipts(database, {
        ...input,
        tenant: other,
        receipts: [{ ...receipt, externalId: randomUUID() }, receipt],
      }),
      /outro cliente/,
    );
    assert.equal(
      (await reports.usageHistory(other, { periodo: 'tudo', page: 1 })).totals
        .calls,
      0,
    );
    await assert.rejects(
      importReceipts(database, { ...input, lifecycle: 'generator' }),
      /outro cliente/,
    );
    await assert.rejects(
      importReceipts(database, {
        ...input,
        receipts: [{ ...receipt, costUsd: 2.5 }],
      }),
      /custo/,
    );
    // Fase capturada no começo, mesmo quando a chamada termina após a conversão.
    const ledger = await loadModule('lib/ai/usage-ledger.ts', mocks);
    const hooks = ledger.usageTracking({
      tenantId: id,
      kind: 'conversa',
      model: 'test',
    });
    await hooks.onStepStart({ callId: 'before-conversion', stepNumber: 0 });
    await database.query(
      "update tenants set maintenance_mode = 'premium' where id = $1",
      [id],
    );
    await hooks.onStepEnd({
      callId: 'before-conversion',
      stepNumber: 0,
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    });
    history = await reports.usageHistory(id, {
      periodo: 'livre',
      start: '2020-01-01',
      end: '2020-01-02',
      page: 1,
    });
    assert.equal(history.totals.calls, 0);
    assert.equal(history.lifetime.calls, 2);
    assert.equal(Number(history.lifetime.costUsd), 1.25);
    assert.equal(history.lifetime.missingCost, 1);
    history = await reports.usageHistory(id, { periodo: 'tudo', page: 1 });
    assert.equal(
      history.bySource.find((r) => r.source === 'gateway').lifecycle,
      'generator',
    );
    const native = parseReceipts(lines(claude()), 'claude').receipts[0];
    native.externalId = randomUUID();
    await importReceipts(database, { ...input, receipts: [native] });
    await importReceipts(database, {
      ...input,
      receipts: [{ ...native, outputTokens: 40, totalTokens: 200 }],
    });
    await importReceipts(database, { ...input, receipts: [native] });
    const { rows } = await database.query(
      'select output_tokens, total_tokens from ai_usage where external_id = $1',
      [native.externalId],
    );
    assert.equal(Number(rows[0].output_tokens), 40);
    assert.equal(Number(rows[0].total_tokens), 200);
  },
);

await test('CLI faz prévia sem banco e recusa destino divergente sem expor log ou credenciais', async (t) => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(path.join(tmpdir(), 'eixu-usage-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'session.jsonl');
  await writeFile(file, lines(claude()));
  const args = [
    'scripts/usage-sync.mjs',
    '--file',
    file,
    '--source',
    'claude',
    '--tenant',
    'fixture',
    '--lifecycle',
    'premium',
  ];
  const env = {
    ...process.env,
    DATABASE_URL: 'postgresql://user:SECRET_CANARY@invalid.example/database',
  };
  const preview = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
  assert.equal(preview.status, 0);
  assert.equal(JSON.parse(preview.stdout).receipts.length, 1);
  assert.doesNotMatch(preview.stdout, /SENSITIVE|SECRET_CANARY/);
  const refused = spawnSync(
    process.execPath,
    [...args, '--apply', '--database-host', 'different.example'],
    { env, encoding: 'utf8' },
  );
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Sincronização recusada/);
  assert.doesNotMatch(
    refused.stderr + refused.stdout,
    /SENSITIVE|SECRET_CANARY/,
  );
});
