import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadModule } from './helpers/load-module.mjs';
import { localPostgres } from './helpers/local-postgres.mjs';

await test('a última ação vira rótulo e autoria sem perder quem pediu', async () => {
  const { actionLabel, actorLabel } = await loadModule(
    'lib/admin/site-list.ts',
  );
  assert.equal(actionLabel('agent.publish_site'), 'publish_site');
  // Ação do operador não tem prefixo a remover: o identificador aparece inteiro.
  assert.equal(actionLabel('site.publish'), 'site.publish');
  assert.equal(
    actorLabel({ actorType: 'agent', actorName: 'Baltz' }),
    'Agente · a pedido de Baltz',
  );
  assert.equal(actorLabel({ actorType: 'agent', actorName: null }), 'Agente');
  assert.equal(actorLabel({ actorType: 'user', actorName: 'Baltz' }), 'Baltz');
  assert.equal(actorLabel({ actorType: 'system', actorName: null }), 'Sistema');
});

await test('a lista chega ordenada pela data que a linha mostra', async () => {
  const { byLastAction, lastTouch } = await loadModule(
    'lib/admin/site-list.ts',
  );
  const comAcao = {
    slug: 'a',
    updatedAt: '2026-09-01T12:00:00Z',
    lastAction: { at: '2026-09-14T12:00:00Z' },
  };
  const semAcao = { slug: 'b', updatedAt: '2026-09-10T12:00:00Z' };
  const antigo = {
    slug: 'c',
    updatedAt: '2026-09-09T12:00:00Z',
    lastAction: { at: '2026-08-02T12:00:00Z' },
  };
  // Sem ação registrada a data exibida é o updated_at, e é por ela que ordena.
  assert.equal(lastTouch(semAcao), '2026-09-10T12:00:00Z');
  assert.deepEqual(
    [antigo, semAcao, comAcao].sort(byLastAction).map((site) => site.slug),
    ['a', 'b', 'c'],
  );
});

await test(
  'última ação, consumo por cliente e gerações em curso no PostgreSQL real',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const um = { id: randomUUID(), slug: randomUUID(), name: 'Site Um' };
    const dois = { id: randomUUID(), slug: randomUUID(), name: 'Site Dois' };
    t.after(async () => {
      try {
        await database.query('delete from tenants where id = any($1)', [
          [um.id, dois.id],
        ]);
      } finally {
        await database.close();
      }
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    const sql = database.db();
    sql.query = async (text, values) =>
      (await database.query(text, values)).rows;
    const mocks = { '@/lib/db': { db: () => sql } };
    for (const tenant of [um, dois])
      await database.query(
        'insert into tenants (id, slug, name) values ($1, $2, $3)',
        [tenant.id, tenant.slug, tenant.name],
      );

    const activity = await loadModule('lib/admin/activity.ts', mocks);
    for (const registro of [
      {
        tenant: um,
        action: 'agent.set_blocks',
        actorType: 'agent',
        atras: '90 minutes',
      },
      {
        tenant: um,
        action: 'agent.publish_site',
        actorType: 'agent',
        atras: '10 minutes',
      },
      {
        tenant: dois,
        action: 'tenant.settings.update',
        actorType: 'user',
        atras: '40 minutes',
      },
    ])
      await database.query(
        `insert into admin_activity
           (tenant_id, tenant_slug, tenant_name, actor_type, actor_name, action, summary, created_at)
         values ($1, $2, $3, $4, 'Baltz', $5, $6, now() - $7::interval)`,
        [
          registro.tenant.id,
          registro.tenant.slug,
          registro.tenant.name,
          registro.actorType,
          registro.action,
          `${registro.action} em ${registro.tenant.name}`,
          registro.atras,
        ],
      );
    const acoes = await activity.lastSiteActions();
    // Uma linha por site: a mais recente, não a primeira registrada.
    assert.equal(acoes.get(um.id).action, 'agent.publish_site');
    assert.equal(acoes.get(um.id).actorName, 'Baltz');
    assert.equal(acoes.get(dois.id).actorType, 'user');
    assert.match(acoes.get(dois.id).summary, /Site Dois/);

    const ledger = await loadModule('lib/admin/usage-history.ts', mocks);
    for (const recibo of [
      {
        tenant: um,
        operacao: 'op-1',
        custo: 0.5,
        tokens: 1000,
        atras: '0 days',
      },
      {
        tenant: um,
        operacao: 'op-2',
        custo: 1.5,
        tokens: 3000,
        atras: '2 days',
      },
      {
        tenant: dois,
        operacao: 'op-3',
        custo: 1,
        tokens: 2000,
        atras: '1 days',
      },
      {
        tenant: um,
        operacao: 'op-antiga',
        custo: 10,
        tokens: 90000,
        atras: '60 days',
      },
    ])
      await database.query(
        `insert into ai_usage
           (tenant_id, operation_id, step, kind, model, status, cost_usd, total_tokens, created_at)
         values ($1, $2, 0, 'geracao', 'modelo-teste', 'recorded', $3, $4,
                 now() - $5::interval)`,
        [
          recibo.tenant.id,
          recibo.operacao,
          recibo.custo,
          recibo.tokens,
          recibo.atras,
        ],
      );
    const consumo = await ledger.usageByTenant(30);
    // A chamada de 60 dias atrás fica fora do período, no total e nas linhas.
    assert.equal(Number(consumo.costUsd), 3);
    assert.equal(Number(consumo.totalTokens), 6000);
    assert.equal(consumo.rows[0].slug, um.slug);
    assert.equal(Number(consumo.rows[0].costUsd), 2);
    assert.equal(consumo.rows[1].slug, dois.slug);
    assert.equal((await ledger.usageByTenant(30, 1)).rows.length, 1);

    const queries = await loadModule('lib/admin/queries.ts', mocks);
    const vazio = await queries.operationSummary();
    assert.equal(vazio.running, 0);
    assert.equal(vazio.current, null);
    await database.query(
      `insert into generation_runs (tenant_id, status, phase, origin)
       values ($1, 'running', 'cenas', 'teste')`,
      [dois.id],
    );
    const operacao = await queries.operationSummary();
    assert.equal(operacao.running, 1);
    // As fases de cenas e composição aparecem como a mesma etapa de produto.
    assert.equal(operacao.current.stage, 'Criar');
    assert.equal(operacao.current.site, 'Site Dois');
  },
);
