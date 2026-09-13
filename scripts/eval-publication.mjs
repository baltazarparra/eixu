/** Modelo real, ferramentas reais, dados sintéticos; Neon/Blob/publicação negados. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
import { pageEditFixture } from '../tests/helpers/page-edit-fixture.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
if (!process.argv.includes('--live')) {
  console.log(
    'Use node --env-file=/caminho/autorizado/.env.local scripts/eval-publication.mjs --live. Dois casos em memória, sem escrita remota ou imagens pagas.',
  );
  process.exit(0);
}
const { landingFixture } = await j.import('../tests/helpers/landing-data.ts');
const { siteAgent } = await j.import('../lib/ai/agent.ts');
const { productModel } = await j.import('../lib/ai/models.ts');
const { landingClaims, claimSupported } = await j.import(
  '../lib/taste/landing.ts',
);
const { confirmedEvidence } = await j.import('../lib/ai/evidence.ts');
const { createEditReceipt } = await j.import('../lib/ai/edit-receipt.ts');
const directory = `outputs/publication/${Date.now()}`;
await mkdir(directory, { recursive: true });
const report = {
  model: productModel(),
  scope:
    'Dois casos sintéticos em memória; nenhuma escrita em Neon/Blob/publicação.',
  runs: [],
};
for (const missing of [true, false]) {
  const site = landingFixture();
  const hero = site.pages[0].blocks.find(
    (block) => block.type === 'hero.landing',
  );
  hero.props.badges = [
    { label: '12 acabamentos', evidence: 'Redação anterior sem confirmação' },
  ];
  if (missing)
    site.tenant.brief = {
      ...site.tenant.brief,
      evidence: [],
      intake: { ...site.tenant.brief.intake, evidence: [] },
    };
  const text = 'Resolva as pendências de publicação.';
  const f = await pageEditFixture(text, {
    initialPages: site.pages,
    initialTenant: site.tenant,
    images: site.images,
    publication: true,
  });
  const beforeBrief = structuredClone(f.tenant.brief);
  const beforePublished = f.pages.map((page) =>
    structuredClone(page.publishedBlocks),
  );
  const receipt = createEditReceipt();
  const started = Date.now();
  const agent = siteAgent({
    tenantId: f.tenant.id,
    tools: f.tools,
    instructions: f.instructions,
    repairPublication: true,
  });
  const result = await agent.generate({
    prompt: text,
    abortSignal: AbortSignal.timeout(150_000),
    onStepEnd: (step) => {
      for (const call of step.toolCalls) {
        const output = step.toolResults.find(
          (entry) => entry.toolCallId === call.toolCallId,
        )?.output;
        receipt.observe(call.toolName, call.input, output);
      }
      console.log(
        JSON.stringify({
          case: missing ? 'sem-evidencia' : 'referencia-antiga',
          tools: step.toolCalls.map((call) => call.toolName),
        }),
      );
    },
  });
  const evidence = confirmedEvidence(f.tenant.brief);
  assert.ok(
    landingClaims(f.pages[0], site.images).every((claim) =>
      claimSupported(claim, evidence),
    ),
  );
  assert.deepEqual(f.tenant.brief, beforeBrief);
  assert.deepEqual(
    f.pages.map((page) => page.publishedBlocks),
    beforePublished,
  );
  assert.ok(f.writes.length > 0);
  const answer = receipt.text() ?? result.text;
  assert.doesNotMatch(
    answer,
    /precisa escrever|frases exatas|publicação está bloqueada/i,
  );
  const run = {
    case: missing ? 'sem-evidencia' : 'referencia-antiga',
    elapsedMs: Date.now() - started,
    steps: result.steps.length,
    writes: f.writes.length,
    answer,
    usage: result.totalUsage,
    correct: true,
  };
  report.runs.push(run);
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...run, usage: undefined, answer: undefined }));
}
console.log(`Relatório: ${directory}/report.json`);
