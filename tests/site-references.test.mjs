import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { Output } from 'ai';
import { loadModule } from './helpers/load-module.mjs';
import {
  direction,
  reading,
  referenceDirection,
  referenceTenant,
  url,
} from './helpers/reference-fixture.mjs';
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { designProfileInputSchema, completeDesignProfile } = await j.import(
  '../lib/design/profile.ts',
);
const { referenceDirectionIssues } = await j.import(
  '../lib/design/references.ts',
);
const { renderingVibeOf, vibeOf } = await j.import('../lib/design/vibes.ts');
const { themeVars } = await j.import('../lib/blocks/theme.ts');
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { sourcesText } = await j.import('../lib/generation/context.ts');
const { reviewFingerprint } = await j.import('../lib/review/state.ts');
const { isPublicAddress, publicResource } = await j.import(
  '../lib/references/network.ts',
);

async function toolFixture(tenant, nearest = []) {
  const queries = [];
  let visualCalls = 0;
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          const sql = parts.join('?');
          queries.push({ sql, values });
          return sql.includes("brand ? 'design'") ? nearest : [];
        },
    },
    '@/lib/ai/reference': {
      readReference: async (sourceUrl) => ({
        url: sourceUrl,
        status: 'ok',
        titulo: 'Fonte de estilo',
      }),
    },
    '@/lib/references/read': {
      readReferenceVisual: async (_url, tenantId) => {
        assert.equal(tenantId, tenant.id);
        visualCalls++;
        return { status: 'ok', reading };
      },
    },
  });
  return { tools: buildTools(tenant), queries, visualCalls: () => visualCalls };
}

await test('direção só sai da vibe depois de leitura visual e aplicações concretas; marca e tenant preservados', async () => {
  const tenant = referenceTenant();
  tenant.brief.sources = [];
  const input = designProfileInputSchema.parse({
    ...direction,
    referenceDirection,
  });
  const f = await toolFixture(tenant, [
    { design: completeDesignProfile(input) },
  ]);
  assert.match(
    (await f.tools.set_design.execute(input)).error,
    /Leia as referências/,
  );
  assert.equal(f.queries.length, 0);
  await f.tools.read_reference.execute({ url });
  assert.equal(f.visualCalls(), 1);
  const missing = await f.tools.set_design.execute(
    designProfileInputSchema.parse(direction),
  );
  assert.match(missing.error, /referenceDirection/);
  const result = await f.tools.set_design.execute(input);
  assert.equal(result.error, undefined);
  assert.equal(result.visualAuthority, 'references');
  assert.equal(result.structuralDistance, 0);
  assert.match(result.warning, /home idêntica/);
  const saved = f.queries.find((q) => q.sql.includes('brand ='));
  // A escrita agora envia só a direção; a marca completa segue no contexto
  // do chat. As integrações de logo verificam o merge com SQL real.
  assert.match(saved.sql, /brand = brand \|\|/);
  const brand = (await f.tools.set_brand.execute({})).brand;
  assert.equal(saved.values.at(-1), tenant.id);
  assert.equal(brand.vibe, 'moderno');
  assert.equal(brand.paper, '#ffffff');
  assert.equal(brand.accent, tenant.brand.accent);
  assert.equal(brand.accentAlt, tenant.brand.accentAlt);
  assert.equal(brand.highlight, tenant.brand.highlight);
  assert.deepEqual(brand.design.referenceDirection, referenceDirection);
  const badContrast = await f.tools.set_design.execute({
    ...input,
    ink: '#eeeeee',
  });
  assert.match(badContrast.error, /contraste AA/);
});

await test('fontes alheias, só texto, captura bloqueada e URL removida não autorizam sobrepor a vibe', () => {
  for (const visual of [
    undefined,
    { status: 'inacessivel' },
    { status: 'ok', reading: { ...reading, usable: false } },
  ]) {
    const tenant = referenceTenant();
    tenant.brief.sources[0].visual = visual;
    assert.ok(
      referenceDirectionIssues(tenant.brief, referenceDirection).length,
    );
  }
  const tenant = referenceTenant();
  tenant.brief.intake.references = ['https://other.test/'];
  assert.ok(referenceDirectionIssues(tenant.brief, referenceDirection).length);
  const spoofed = { ...referenceDirection, primaryUrl: 'https://other.test/' };
  assert.ok(referenceDirectionIssues(referenceTenant().brief, spoofed).length);
  const incomplete = {
    ...referenceDirection,
    decisions: referenceDirection.decisions.filter(
      (d) => d.aspect !== 'imagery',
    ),
  };
  assert.match(
    referenceDirectionIssues(referenceTenant().brief, incomplete).join(' '),
    /imagery/,
  );
  // Fragmentos apontam à mesma página e não perdem a evidência.
  tenant.brief.intake.references = [url + '#hero'];
  assert.equal(
    referenceDirectionIssues(tenant.brief, referenceDirection).length,
    0,
  );
});

await test('sem referência verificada permanece a faixa, com lacuna declarada no fallback', async () => {
  const tenant = referenceTenant();
  tenant.brief.sources[0].visual = { status: 'inacessivel' };
  const f = await toolFixture(tenant);
  assert.match(
    (
      await f.tools.set_design.execute(
        designProfileInputSchema.parse(direction),
      )
    ).error,
    /brief.gaps/,
  );
  const result = await f.tools.set_design.execute(
    designProfileInputSchema.parse({
      ...direction,
      brief: { ...direction.brief, gaps: ['Referência visual inacessível'] },
    }),
  );
  assert.match(result.error, /Moderno/);
  assert.equal(f.queries.length, 0);
});

await test('todas as etapas mantêm evidência e prioridade; a referência modula aspectos e a vibe segue no renderer', () => {
  const tenant = referenceTenant();
  tenant.brand.design = completeDesignProfile(
    designProfileInputSchema.parse({ ...direction, referenceDirection }),
  );
  const sources = sourcesText(tenant);
  for (const phase of ['briefing', 'cenas', 'composicao', 'revisao']) {
    const prompt = systemPrompt(tenant, '', '/', '', { phase, sources });
    assert.ok(prompt.includes(reading.rhythm), phase);
    assert.ok(prompt.includes(referenceDirection.adaptations), phase);
    assert.match(prompt, /acima do estilo da vibe/);
    assert.equal(prompt.includes('paper e surface quase pretos'), false);
    assert.equal(prompt.includes('Luz fria e controlada'), false);
    // A silhueta continua sendo da vibe em todas as fases com composição.
    if (phase !== 'briefing' && phase !== 'cenas')
      assert.match(prompt, /Gramática obrigatória da vibe Moderno/, phase);
  }
  assert.equal(vibeOf(tenant.brand), 'moderno');
  // O perfil v4 conserva a vibe no renderer: a referência modula aspectos, e
  // antes qualquer leitura visual derrubava o site para a base comercial.
  assert.equal(tenant.brand.design.version, 4);
  assert.equal(renderingVibeOf(tenant.brand), 'moderno');
  assert.equal(renderingVibeOf({ vibe: 'moderno' }), 'moderno');
  // Perfis já publicados preservam a base neutra com que foram ao ar.
  assert.equal(
    renderingVibeOf({
      ...tenant.brand,
      design: { ...tenant.brand.design, version: 3 },
    }),
    'comercial',
  );
  const artistic = {
    ...tenant.brand,
    vibe: 'artistico',
    paper: '#ffffff',
    surface: '#eeeeee',
    ink: '#111111',
  };
  // A referência documenta superfície, então a lavagem artística não sobrepõe
  // a superfície escolhida na direção.
  assert.equal(themeVars(artistic)['--surface'], '#eeeeee');
  assert.notEqual(
    themeVars({ ...artistic, design: undefined })['--surface'],
    '#eeeeee',
  );
  // Sem o aspecto surface documentado, a lavagem da vibe volta a valer.
  const semSuperficie = {
    ...artistic,
    design: {
      ...artistic.design,
      referenceDirection: {
        ...referenceDirection,
        decisions: referenceDirection.decisions.filter(
          (d) => d.aspect !== 'surface',
        ),
      },
    },
  };
  assert.notEqual(themeVars(semSuperficie)['--surface'], '#eeeeee');
  const old = reviewFingerprint(tenant, [], []);
  tenant.brand.design.referenceDirection.adaptations += ' Ajustar galeria.';
  assert.notEqual(reviewFingerprint(tenant, [], []), old);
});

await test('leitura visual usa pixels multimodais, devolve relatório e declara falha sem inventar estilo', async () => {
  let mode = 'ok';
  let calls = 0;
  const { readReferenceVisual } = await loadModule('lib/references/read.ts', {
    './capture': {
      captureReference: async () => {
        if (mode === 'failed') throw new Error('Captura indisponível');
        return ['desktop', 'mobile'].map((viewport) => ({
          viewport,
          jpeg: Buffer.from('synthetic pixels'),
        }));
      },
    },
    ai: {
      Output,
      generateText: async (input) => {
        calls++;
        const parts = input.messages[0].content;
        assert.equal(parts.filter((p) => p.type === 'file').length, 2);
        assert.ok(
          parts
            .filter((p) => p.type === 'file')
            .every(
              (p) =>
                p.data instanceof Uint8Array && p.mediaType === 'image/jpeg',
            ),
        );
        assert.equal(
          parts
            .filter((p) => p.type === 'text')
            .some((p) => p.text.includes('c3ludGhldGlj')),
          false,
        );
        return {
          output: { ...reading, usable: mode !== 'wall' },
          usage: {},
          steps: [],
        };
      },
    },
  });
  assert.equal((await readReferenceVisual(url, 'fixture')).status, 'ok');
  mode = 'wall';
  assert.equal(
    (await readReferenceVisual(url, 'fixture')).status,
    'inacessivel',
  );
  mode = 'failed';
  const failure = await readReferenceVisual(url, 'fixture');
  assert.equal(failure.status, 'inacessivel');
  assert.equal(failure.reading, undefined);
  assert.equal(calls, 2);
});

await test('crítica recebe plano de referências, leitura persistida e pixels atuais; desvio material continua erro', async () => {
  const tenant = referenceTenant();
  tenant.brand.design = completeDesignProfile({
    ...direction,
    referenceDirection,
  });
  const { critiquePages } = await loadModule('lib/review/critic.ts', {
    ai: {
      Output,
      generateText: async (input) => {
        assert.match(input.instructions, /prevalece sobre a vibe/);
        assert.ok(input.messages[0].content[0].text.includes(reading.layout));
        assert.ok(
          input.messages[0].content[0].text.includes(
            referenceDirection.adaptations,
          ),
        );
        return {
          output: {
            strengths: [],
            findings: [
              {
                page: '/',
                blockId: 'hero',
                level: 'error',
                criterion: 'referencias',
                evidence: 'A abertura ignora a composição documentada.',
                correction:
                  'Restaurar a relação entre título e imagem do plano.',
              },
            ],
          },
          usage: {},
          steps: [],
        };
      },
    },
  });
  const result = await critiquePages(
    tenant,
    [{ slug: '', blocks: [{ id: 'hero' }] }],
    [
      {
        jpeg: Buffer.from('pixels'),
        page: '/',
        viewport: 'desktop',
        width: 1440,
      },
    ],
  );
  assert.equal(result.findings[0].criterion, 'referencias');
  assert.equal(result.findings[0].level, 'error');
});

await test('transporte da captura bloqueia rede privada, metadados, IPv6 mapeado e credenciais antes da conexão', async () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.168.0.1',
    '::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    'fc00::1',
  ])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])
    assert.equal(isPublicAddress(address), true, address);
  for (const source of [
    'http://127.0.0.1/',
    'http://[::ffff:127.0.0.1]/',
    'file:///etc/passwd',
    'https://user:password@example.com/',
    'http://example.com:8080/',
  ])
    await assert.rejects(() => publicResource(source));
});
