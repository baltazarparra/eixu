import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { landingFixture } = await j.import('./helpers/landing-data.ts');
const { lintSite } = await j.import('../lib/taste/site.ts');

async function fixture({ evidence } = {}) {
  const f = landingFixture();
  if (evidence) f.tenant.brief.evidence = evidence;
  const writes = [];
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          const sql = parts.join('?');
          assert.match(sql, /coalesce\(brief -> 'evidence'/);
          const [next, tenantId, expected] = values;
          assert.equal(tenantId, f.tenant.id);
          if (JSON.stringify(f.tenant.brief.evidence ?? null) !== expected)
            return [];
          f.tenant.brief.evidence = JSON.parse(next);
          writes.push(next);
          return [{ id: tenantId }];
        },
    },
    '@/lib/tenant-queries': {
      ...(await j.import('../lib/tenant-queries.ts')),
      listPages: async () => f.pages,
    },
    '@/lib/images/queries': {
      ...(await j.import('../lib/images/queries.ts')),
      listImages: async () => f.images,
    },
  });
  return {
    ...f,
    writes,
    tools: (operatorText) =>
      buildTools(f.tenant, { operatorText, editPolicy: { kind: 'edit' } }),
  };
}

await test('fato recombinado ou negado não é gravado nem libera o selo no gate real', async () => {
  for (const [operator, fact] of [
    [
      'Temos 10 funcionários e 2 anos de experiência.',
      '10 anos de experiência',
    ],
    ['Não ganhamos o prêmio Estadão 2023.', 'Ganhamos o prêmio Estadão 2023'],
  ]) {
    const f = await fixture();
    f.pages[0].blocks.find((b) => b.type === 'hero.landing').props.badges = [
      { label: fact, evidence: fact },
    ];
    const before = structuredClone(f.tenant.brief);
    const result = await f
      .tools(operator)
      .confirm_evidence.execute({ facts: [fact] });
    assert.match(result.error, /Não encontrei/);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.tenant.brief, before);
    assert.ok(
      lintSite(
        f.pages,
        f.images,
        'publish',
        f.tenant.brand,
        f.tenant.brief,
      ).some((finding) => finding.rule === 'landing-prova'),
    );
  }
});

await test('limite recusa o lote inteiro; repetição no mesmo lote grava um fato só', async () => {
  const full = await fixture({
    evidence: Array.from(
      { length: 12 },
      (_, index) => `Fato confirmado ${index}`,
    ),
  });
  const fact = 'Envase no mesmo dia';
  const result = await full
    .tools(fact)
    .confirm_evidence.execute({ facts: [fact] });
  assert.match(result.error, /até 12 evidências/);
  assert.equal(full.writes.length, 0);
  assert.equal(full.tenant.brief.evidence.length, 12);
  const f = await fixture();
  const saved = await f
    .tools(fact)
    .confirm_evidence.execute({ facts: [fact, fact, `${fact}.`] });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.deepEqual([...saved.added], [fact]);
  assert.equal(
    f.tenant.brief.evidence.filter((value) => value === fact).length,
    1,
  );
  assert.equal(f.writes.length, 1);
});

await test('confirmação concorrente não sobrescreve a evidência recém-gravada', async () => {
  const f = await fixture();
  const first = f.tools('Envase no mesmo dia');
  const stale = f.tools('Três cocos por litro');
  assert.equal(
    (await first.confirm_evidence.execute({ facts: ['Envase no mesmo dia'] }))
      .ok,
    true,
  );
  const refused = await stale.confirm_evidence.execute({
    facts: ['Três cocos por litro'],
  });
  assert.match(refused.error, /mudaram durante a confirmação/);
  assert.ok(f.tenant.brief.evidence.includes('Envase no mesmo dia'));
  assert.equal(f.writes.length, 1);
});
