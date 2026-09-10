/**
 * Roda o fluxo real de geração num tenant descartável e mede o resultado.
 *
 *   node --env-file=.env.local scripts/eval-site.mjs <caso> [--fresh] [--generate]
 *
 * Sem --generate, a biblioteca é semeada com fotos de um tenant existente e a
 * fase de cenas é pulada: dá para comparar composição sem gerar imagem paga.
 * Com --generate, o fluxo é o de produção, inclusive a geração de cenas.
 *
 * O runner usa as mesmas ferramentas do chat: o que ele exercita é o produto,
 * não uma simulação. Ele escreve no banco, então só aceita slug começando com
 * "eval-".
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { generateText, isStepCount } from 'ai';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { db } = await jiti.import('../lib/db.ts');
const { buildTools } = await jiti.import('../lib/ai/tools.ts');
const { systemPrompt } = await jiti.import('../lib/taste/prompt.ts');
const { PHASE_MESSAGE, PHASE_STEPS, PHASE_TOOLS, nextPhase } =
  await jiti.import('../lib/taste/phases.ts');
const { generationState } = await jiti.import('../lib/sites/generation.ts');
const { siteMetrics, structuralFindings } = await jiti.import(
  '../lib/taste/metrics.ts',
);
const { lintSite } = await jiti.import('../lib/taste/site.ts');
const { lintPage } = await jiti.import('../lib/taste/lint.ts');
const { scenePlan, scenePlanText } = await jiti.import(
  '../lib/images/scene-plan.ts',
);
const { listImages } = await jiti.import('../lib/images/queries.ts');
const { getTenantBySlug, listPages } = await jiti.import(
  '../lib/tenant-queries.ts',
);
const { isDesignProfile } = await jiti.import('../lib/design/profile.ts');

const [caseName, ...flags] = process.argv.slice(2);
if (!caseName) {
  console.error('Informe o caso: node scripts/eval-site.mjs mecanica-sabia');
  process.exit(1);
}
const fresh = flags.includes('--fresh');
const generateScenes = flags.includes('--generate');
const spec = JSON.parse(
  await readFile(
    new URL(`../evals/cases/${caseName}.json`, import.meta.url),
    'utf8',
  ),
);
if (!spec.slug.startsWith('eval-')) {
  console.error('O slug do caso precisa começar com "eval-".');
  process.exit(1);
}

const sql = db();

async function prepareTenant() {
  if (fresh) await sql`delete from tenants where slug = ${spec.slug}`;
  await sql`
    insert into tenants (slug, name, whatsapp, brief)
    values (${spec.slug}, ${spec.name}, ${spec.whatsapp ?? null},
            ${JSON.stringify({ intake: spec.intake })}::jsonb)
    on conflict (slug) do update set name = excluded.name,
      whatsapp = excluded.whatsapp, brief = excluded.brief, updated_at = now()
  `;
  const tenant = await getTenantBySlug(spec.slug);
  if (
    !generateScenes &&
    typeof spec.photos === 'string' &&
    spec.photos.startsWith('reuse:')
  ) {
    const source = await getTenantBySlug(spec.photos.slice('reuse:'.length));
    if (!source) throw new Error(`Tenant de fotos ausente: ${spec.photos}`);
    const existing = await listImages(tenant.id);
    if (!existing.length) {
      const photos = (await listImages(source.id)).filter(
        (image) => image.kind === 'foto' && image.status !== 'rejeitada',
      );
      let seq = 0;
      for (const photo of photos) {
        seq += 1;
        await sql`
          insert into images (tenant_id, seq, batch_id, request_text, target_block, ratio,
                              model, prompt_final, url, blob_path, status, alt, description, kind)
          values (${tenant.id}, ${seq}, gen_random_uuid(), ${photo.requestText},
                  ${photo.targetBlock}, ${photo.ratio}, ${photo.model}, ${photo.requestText},
                  ${photo.url}, ${photo.blobPath}, 'aprovada', ${photo.alt}, ${photo.description}, 'foto')
        `;
      }
      console.log(
        `[eval] biblioteca semeada com ${photos.length} fotos de ${spec.photos}`,
      );
    }
  }
  return getTenantBySlug(spec.slug);
}

async function runPhase(tenant, phase, images) {
  const pages = await listPages(tenant.id);
  const summary = pages
    .map(
      (page) =>
        `- /${page.slug} (${page.type}, ${page.blocks.length} blocos): ${page.title}`,
    )
    .join('\n');
  const imagesSummary = images
    .filter((image) => image.kind === 'foto' && image.status !== 'rejeitada')
    .slice(0, 12)
    .map(
      (image) =>
        `- #${image.seq} ${image.status}, ${image.ratio}, ${image.targetBlock ?? 'livre'}: ${image.url} | ${image.alt ?? image.description ?? 'sem descrição'}`,
    )
    .join('\n');
  const context = { phase };
  if (phase === 'cenas')
    context.scenePlan = scenePlanText(
      scenePlan(
        isDesignProfile(tenant.brand.design) ? tenant.brand.design : undefined,
        3,
      ),
    );
  const tools = buildTools(tenant, { origin: process.env.EIXU_EVAL_ORIGIN });
  const started = Date.now();
  const result = await generateText({
    model: process.env.EIXU_MODEL || 'anthropic/claude-opus-4.5',
    instructions: systemPrompt(tenant, summary, '/', imagesSummary, context),
    messages: [{ role: 'user', content: PHASE_MESSAGE[phase] }],
    tools,
    activeTools: PHASE_TOOLS[phase].filter((name) => name in tools),
    stopWhen: isStepCount(PHASE_STEPS[phase]),
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(
      Number(process.env.EIXU_EVAL_TIMEOUT ?? 280_000),
    ),
  });
  return {
    phase,
    elapsedMs: Date.now() - started,
    usage: result.usage,
    steps: result.steps.length,
    calls: result.steps.flatMap((step) =>
      (step.toolCalls ?? []).map((call) => call.toolName),
    ),
    // Guarda o retorno inteiro das recusas: a mensagem truncada não permitia
    // descobrir qual regra bloqueou o lote.
    rejected: result.steps.flatMap((step) =>
      (step.toolResults ?? [])
        .filter(
          (item) =>
            item.output &&
            typeof item.output === 'object' &&
            ('error' in item.output || item.output.ok === false),
        )
        .map((item) => ({ tool: item.toolName, output: item.output })),
    ),
    text: result.text,
  };
}

const started = Date.now();
let tenant = await prepareTenant();
const report = {
  case: caseName,
  slug: spec.slug,
  model: process.env.EIXU_MODEL || 'anthropic/claude-opus-4.5',
  phases: [],
};
for (let step = 0; step < 6; step += 1) {
  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const state = generationState(tenant, pages, images);
  let next = state.next;
  // Sem --generate a biblioteca já veio semeada. Pular a fase de cenas exige
  // recalcular a próxima, senão o runner volta para a composição toda vez.
  if (next === 'cenas' && !generateScenes)
    next = nextPhase({
      hasDesign: true,
      generatedPhotos: state.targetScenes,
      targetScenes: state.targetScenes,
      organicPages: state.organicPages,
      blockingErrors: state.blockingErrors,
      reviewRounds: state.reviewRounds,
    });
  if (next === 'pronto') break;
  console.log(`[eval] fase ${next}`);
  let outcome;
  try {
    outcome = await runPhase(tenant, next, images);
  } catch (error) {
    const cause = error?.cause ?? error;
    console.error(
      `[eval] fase ${next} falhou:`,
      error?.name,
      error?.message,
      cause?.message ?? '',
    );
    report.phases.push({
      phase: next,
      error: String(error?.message ?? error),
      cause: String(cause?.message ?? ''),
    });
    break;
  }
  report.phases.push(outcome);
  console.log(
    `[eval] ${outcome.phase}: ${outcome.steps} passos, ${outcome.usage.inputTokens} in, ${outcome.usage.outputTokens} out, ${Math.round(outcome.elapsedMs / 1000)}s, ferramentas ${outcome.calls.join(',') || 'nenhuma'}`,
  );
  if (outcome.rejected.length)
    for (const item of outcome.rejected.slice(0, 4))
      console.log(
        `[eval] recusa ${item.tool}:`,
        JSON.stringify(item.output).slice(0, 400),
      );
  tenant = await getTenantBySlug(spec.slug);
}

const [pages, images] = await Promise.all([
  listPages(tenant.id),
  listImages(tenant.id),
]);
report.elapsedMs = Date.now() - started;
report.metrics = siteMetrics(pages, images);
report.site = lintSite(pages, images, 'draft');
report.structural = structuralFindings(pages, images);
report.pageFindings = pages.flatMap((page) =>
  lintPage(page, tenant.brand.design)
    .filter((finding) => finding.level === 'error')
    .map((finding) => ({ page: `/${page.slug}`, ...finding })),
);
report.design = tenant.brand.design ?? null;
report.usage = report.phases.reduce(
  (total, phase) => ({
    inputTokens: total.inputTokens + (phase.usage?.inputTokens ?? 0),
    outputTokens: total.outputTokens + (phase.usage?.outputTokens ?? 0),
  }),
  { inputTokens: 0, outputTokens: 0 },
);

const dir = new URL(
  `../outputs/evals/${new Date().toISOString().slice(0, 10)}/`,
  import.meta.url,
);
await mkdir(dir, { recursive: true });
await writeFile(
  new URL(`${caseName}-${Date.now()}.json`, dir),
  JSON.stringify(report, null, 2),
);

const home = report.metrics.home;
console.log('\n=== resultado');
console.log(
  'páginas orgânicas:',
  report.metrics.organic,
  '| fotos geradas:',
  report.metrics.generatedPhotos,
);
console.log(
  'home: seções',
  home?.sections,
  '| fotos',
  home?.images,
  '| tons',
  home?.tones?.join('/'),
  '| protagonista',
  home?.protagonist,
);
for (const page of report.metrics.pages)
  console.log(
    `  /${page.slug}: ${page.sections} seções, ${page.images} fotos, ${page.words} palavras, motion ${page.motionMoments}`,
  );
console.log(
  'erros de projeto:',
  report.site.filter((f) => f.level === 'error').length,
);
console.log('erros de página:', report.pageFindings.length);
console.log(
  'tokens:',
  report.usage.inputTokens,
  'in /',
  report.usage.outputTokens,
  'out |',
  Math.round(report.elapsedMs / 1000) + 's',
);
