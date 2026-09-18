import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

// Exercita a fronteira real do SDK: Zod -> JSON -> Ajv dentro do step.
const { serializeToolSet, resolveSerializableTools } = loadModuleGraph(
  'node_modules/@ai-sdk/workflow/src/serializable-schema.ts',
);

void test('todas as ferramentas atravessam a serialização e compilação do Workflow', () => {
  const { studioTools } = loadModuleGraph('lib/studio/tools.ts');
  const serialized = JSON.parse(JSON.stringify(serializeToolSet(studioTools)));
  const tools = resolveSerializableTools(serialized);
  assert.deepEqual(Object.keys(tools), Object.keys(studioTools));
});

void test('o artefato chega ao Gemini como objeto sem limites combinatórios de listas', () => {
  const { studioTools } = loadModuleGraph('lib/studio/tools.ts');
  const serialized = JSON.parse(JSON.stringify(serializeToolSet(studioTools)));
  const schema = serialized.record_artifact.inputSchema;
  assert.equal(schema.type, 'object');
  assert.deepEqual(schema.required, ['kind', 'payload']);
  assert.deepEqual(schema.properties.kind.enum, [
    'context',
    'art_direction',
    'validation',
  ]);
  assert.equal(schema.properties.payload.anyOf.length, 3);
  assert.doesNotMatch(JSON.stringify(schema), /"maxItems":/);
  assert.doesNotMatch(JSON.stringify(schema), /"const":/);
  const validation = schema.properties.payload.anyOf[2];
  assert.deepEqual(
    validation.properties.checks.items.oneOf.map(
      (check) => check.properties.kind.enum,
    ),
    [['command'], ['manual']],
  );
});

void test('validação exige comandos realmente executados antes de registrar sucesso', async () => {
  const queries = [];
  const { studioTools } = loadModuleGraph('lib/studio/tools.ts', {
    '@/lib/db': {
      db: () => async (parts) => {
        const query = parts.join('?');
        queries.push(query);
        return query.includes('select run.status')
          ? [{ status: 'running' }]
          : [];
      },
    },
  });
  await assert.rejects(
    studioTools.record_artifact.execute(
      {
        kind: 'validation',
        payload: {
          summary: 'Comandos aprovados.',
          ready: true,
          limitations: [],
          checks: ['typecheck', 'build'].map((command) => ({
            kind: 'command',
            command,
            status: 'passed',
            evidence: 'exit 0',
          })),
        },
      },
      { context: {} },
    ),
    /typecheck não foi executado/,
  );
  assert.equal(queries.length, 2);
  assert.match(queries[1], /from studio_events/);
});

function contextInput() {
  return {
    kind: 'context',
    payload: {
      summary: 'Oficina Demo restaura móveis.',
      tone: { voice: 'Direta.', traits: ['clara'], avoid: [] },
      facts: [
        {
          statement: 'A oficina restaura móveis.',
          source: { kind: 'operator', location: '/dados' },
          status: 'confirmed',
        },
      ],
      inferences: [],
      gaps: [],
      constraints: [],
      sitePlan: [{ slug: '/', purpose: 'Apresentação.', content: ['contato'] }],
    },
  };
}

for (const scenario of ['limite de fatos', 'tipo incompatível'])
  void test(`a gravação mantém ${scenario} após a fronteira JSON/Ajv`, async () => {
    const queries = [];
    const { studioTools } = loadModuleGraph('lib/studio/tools.ts', {
      '@/lib/db': {
        db: () => async (parts) => {
          queries.push(parts.join('?'));
          return [{ status: 'running' }];
        },
      },
    });
    const input = contextInput();
    if (scenario === 'limite de fatos')
      input.payload.facts = Array.from(
        { length: 81 },
        () => input.payload.facts[0],
      );
    else input.kind = 'art_direction';

    // The transport remains generatable; canonical validation must still block
    // both a too-large array and a payload for a different artifact kind.
    const transported = resolveSerializableTools(
      JSON.parse(JSON.stringify(serializeToolSet(studioTools))),
    );
    const providerResult =
      await transported.record_artifact.inputSchema.validate(input);
    assert.equal(providerResult.success, true);
    const canonicalResult =
      await studioTools.record_artifact.inputSchema.validate(input);
    assert.equal(canonicalResult.success, false);
    await assert.rejects(
      studioTools.record_artifact.execute(input, { context: {} }),
      (error) => error.name === 'ZodError',
    );
    assert.equal(queries.length, 1);
    assert.match(queries[0], /select run.status/);
  });

for (const source of [
  { kind: 'official', url: 'não é uma URL' },
  { kind: 'official', url: 'https://example.com' },
])
  void test(`gravação revalida URL e procedência antes de persistir: ${source.url}`, async () => {
    const queries = [];
    const { studioTools } = loadModuleGraph('lib/studio/tools.ts', {
      '@/lib/db': {
        db: () => async (parts) => {
          queries.push(parts.join('?'));
          return [{ status: 'running' }];
        },
      },
    });
    await assert.rejects(
      studioTools.record_artifact.execute(
        {
          kind: 'context',
          payload: {
            summary: 'Cliente de teste.',
            tone: { voice: 'Direta.', traits: ['clara'], avoid: [] },
            facts: [
              {
                statement: 'Fato da fonte oficial.',
                source,
                status: 'confirmed',
              },
            ],
            inferences: [],
            gaps: [],
            constraints: [],
            sitePlan: [
              { slug: '/', purpose: 'Apresentação.', content: ['contato'] },
            ],
          },
        },
        { context: {} },
      ),
      /URL inválida|exige status observed/,
    );
    assert.equal(queries.length, 1);
    assert.match(queries[0], /select run.status/);
  });
