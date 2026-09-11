import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadModule } from './helpers/load-module.mjs';
import { localPostgres } from './helpers/local-postgres.mjs';

const { changedFields } = await loadModule('lib/admin/form-changes.ts');
await test('alterações do formulário distinguem edição, remoção e restauração de campos repetidos', () => {
  const before = {
    name: ['Horizonte'],
    phone: ['111', '222'],
    phoneKind: ['whatsapp', 'telefone'],
    evidence: ['Oficina\nEquipe'],
  };
  assert.equal(changedFields(before, { ...before }), 0);
  assert.equal(changedFields(before, { ...before, name: ['Novo nome'] }), 1);
  assert.equal(
    changedFields(before, {
      ...before,
      phone: ['111'],
      phoneKind: ['whatsapp'],
    }),
    2,
  );
  assert.equal(changedFields(before, { ...before, evidence: ['Oficina'] }), 1);
});

await test(
  'série diária e resumo do admin usam PostgreSQL local, isolamento e dias de Brasília',
  { skip: !process.env.EIXU_TEST_POSTGRES_URL },
  async (t) => {
    const database = await localPostgres(process.env.EIXU_TEST_POSTGRES_URL);
    const tenant = randomUUID(),
      other = randomUUID();
    t.after(async () => {
      await database.query('delete from tenants where id = any($1)', [
        [tenant, other],
      ]);
      await database.close();
    });
    await database.query(await readFile('db/schema.sql', 'utf8'));
    await database.query(
      "insert into tenants(id,slug,name) values ($1::uuid,$1::text,'Handoff A'),($2::uuid,$2::text,'Handoff B')",
      [tenant, other],
    );
    const events = [
      [tenant, 'page_view', 'old', '2026-09-10T02:59:59Z'],
      [tenant, 'page_view', 'visitor-a', '2026-09-10T03:00:00Z'],
      [tenant, 'page_view', 'visitor-a', '2026-09-10T04:00:00Z'],
      [tenant, 'whatsapp_click', 'visitor-a', '2026-09-10T04:01:00Z'],
      [tenant, 'whatsapp_click', 'visitor-a', '2026-09-10T04:02:00Z'],
      [tenant, 'form_submit', 'contact-only', '2026-09-10T04:03:00Z'],
      [tenant, 'page_view', null, '2026-09-10T04:04:00Z'],
      [tenant, 'page_view', 'visitor-a', '2026-09-13T02:59:59Z'],
      [tenant, 'page_view', 'tomorrow', '2026-09-13T03:00:00Z'],
      [other, 'page_view', 'foreign', '2026-09-10T05:00:00Z'],
    ];
    for (const row of events)
      await database.query(
        "insert into events(tenant_id,type,session_id,created_at,path) values ($1,$2,$3,$4,'/')",
        row,
      );
    await database.query(
      "insert into campaign_spend(tenant_id,campaign,spend_cents,period_start,period_end) values ($1,'inteiro',10000,'2026-09-10','2026-09-12'),($1,'parcial',5000,'2026-09-09','2026-09-12')",
      [tenant],
    );
    const { trafficReport, periodSchema } = await loadModule(
      'lib/admin/traffic.ts',
      { '@/lib/db': database },
    );
    const report = await trafficReport(tenant, {
      start: '2026-09-10',
      end: '2026-09-12',
    });
    assert.deepEqual(JSON.parse(JSON.stringify(report.series)), [
      { day: '2026-09-10', visitors: 1, contacts: 1 },
      { day: '2026-09-11', visitors: 0, contacts: 0 },
      { day: '2026-09-12', visitors: 1, contacts: 0 },
    ]);
    assert.equal(report.visitors, 1);
    assert.equal(report.forms, 1);
    assert.equal(report.whats, 2);
    assert.equal(report.cents, 10000);
    assert.equal(report.partialSpends, 1);
    assert.equal(
      periodSchema.safeParse({ start: '2020-01-01', end: '2026-01-01' })
        .success,
      false,
    );
    const { railClients, operationSummary } = await loadModule(
      'lib/admin/queries.ts',
      { '@/lib/db': database },
    );
    const rail = await railClients();
    assert.ok(
      rail.some((row) => row.slug === tenant && row.name === 'Handoff A'),
    );
    assert.deepEqual(Object.keys(rail[0]).sort(), ['name', 'slug', 'status']);
    await database.query(
      "insert into leads(tenant_id,created_at) values ($1,now()),($1,now()-interval '31 days')",
      [tenant],
    );
    await database.query(
      "insert into generation_runs(tenant_id,origin,status,phase) values ($1,'http://fixture.test','queued','briefing')",
      [tenant],
    );
    const summary = await operationSummary();
    assert.equal(summary.leads30d, 1);
    assert.equal(summary.running, 1);
  },
);
