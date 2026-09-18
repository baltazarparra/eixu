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
