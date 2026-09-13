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
import { createJiti } from 'jiti';
import { runEvaluationPhases } from './lib/eval-site-flow.mjs';

const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { siteAgent } = await jiti.import('../lib/ai/agent.ts');
const { productModel, TURN_TIMEOUT_MS } = await jiti.import(
  '../lib/ai/models.ts',
);
const { createSessionToken } = await jiti.import('../lib/auth.ts');
const { db } = await jiti.import('../lib/db.ts');
const { buildTools } = await jiti.import('../lib/ai/tools.ts');
const { systemPrompt } = await jiti.import('../lib/taste/prompt.ts');
const { PHASE_MESSAGE, nextPhase } = await jiti.import(
  '../lib/taste/phases.ts',
);
const { generationState, plannedScenes } = await jiti.import(
  '../lib/sites/generation.ts',
);
const { siteMetrics, structuralFindings } = await jiti.import(
  '../lib/taste/metrics.ts',
);
const { lintSite } = await jiti.import('../lib/taste/site.ts');
const { lintPage } = await jiti.import('../lib/taste/lint.ts');
const { sceneCoverage, scenePlanText, sceneText } = await jiti.import(
  '../lib/images/scene-plan.ts',
);
const { generatedPhotos } = await jiti.import('../lib/taste/metrics.ts');
const { listImages } = await jiti.import('../lib/images/queries.ts');
const { getTenantBySlug, listPages } = await jiti.import(
  '../lib/tenant-queries.ts',
);
const { contactsSchema, primaryWhatsapp } = await jiti.import(
  '../lib/tenant-contacts.ts',
);
const { vibeSchema } = await jiti.import('../lib/design/vibes.ts');

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
  const contacts = contactsSchema.parse(spec.contacts ?? {});
  const vibe = vibeSchema.parse(spec.vibe ?? 'comercial');
  const whatsapp = primaryWhatsapp(contacts) ?? spec.whatsapp ?? null;
  await sql`
    insert into tenants (slug, name, whatsapp, contact_email, brief, brand, contacts)
    values (${spec.slug}, ${spec.name}, ${whatsapp}, ${spec.contactEmail ?? null},
            ${JSON.stringify({ intake: spec.intake })}::jsonb,
            ${JSON.stringify({ vibe })}::jsonb,
            ${JSON.stringify(contacts)}::jsonb)
    on conflict (slug) do update set name = excluded.name,
      whatsapp = excluded.whatsapp, contact_email = excluded.contact_email,
      brief = excluded.brief, contacts = excluded.contacts,
      -- Mescla para uma reexecução não apagar a direção já persistida.
      brand = tenants.brand || excluded.brand, updated_at = now()
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
                  ${photo.url}, ${photo.blobPath}, 'disponivel', ${photo.alt}, ${photo.description}, 'foto')
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
        `- #${image.seq} disponível, ${image.ratio}, ${image.targetBlock ?? 'livre'}: ${image.url} | ${image.alt ?? image.description ?? 'sem descrição'}`,
    )
    .join('\n');
  const context = {
    phase,
    sources: Array.isArray(tenant.brief.sources)
      ? JSON.stringify(tenant.brief.sources)
      : '',
    review: JSON.stringify(tenant.brief.generation?.review ?? null),
  };
  if (phase === 'cenas') {
    const plan = plannedScenes(tenant);
    const { covered, missing } = sceneCoverage(
      plan,
      generatedPhotos(images).filter((image) => image.status !== 'rejeitada'),
    );
    context.scenePlan = scenePlanText(plan);
    context.coverage = `${covered.length} de ${plan.length} vagas já têm foto disponível.`;
    if (missing[0]) context.nextScene = sceneText(missing[0]);
  }
  const tools = buildTools(tenant, {
    origin: process.env.EIXU_EVAL_ORIGIN,
    cookie: `eixu_admin=${await createSessionToken()}`,
    phase,
  });
  const started = Date.now();
  const agent = siteAgent({
    tenantId: tenant.id,
    instructions: systemPrompt(tenant, summary, '/', imagesSummary, context),
    tools,
    phase,
  });
  const result = await agent.generate({
    messages: [{ role: 'user', content: PHASE_MESSAGE[phase] }],
    abortSignal: AbortSignal.timeout(
      Number(process.env.EIXU_EVAL_TIMEOUT ?? TURN_TIMEOUT_MS),
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
  model: productModel(),
  phases: [],
};
report.flow = await runEvaluationPhases({
  readSnapshot: async () => {
    tenant = await getTenantBySlug(spec.slug);
    const [pages, images] = await Promise.all([
      listPages(tenant.id),
      listImages(tenant.id),
    ]);
    return { tenant, pages, images };
  },
  nextPhase: ({ tenant, pages, images }) => {
    const state = generationState(tenant, pages, images);
    // Sem --generate a biblioteca já veio semeada. Recalcula a próxima fase
    // sem exigir geração, preservando a composição e a revisão do produto.
    if (state.next === 'cenas' && !generateScenes)
      return nextPhase({
        hasDesign: true,
        coveredScenes: state.targetScenes,
        targetScenes: state.targetScenes,
        organicPages: state.organicPages,
        blockingErrors: state.blockingErrors,
        reviewRounds: state.reviewRounds,
        reviewComplete: state.reviewComplete,
      });
    return state.next;
  },
  runPhase: async ({ tenant, images }, next) => {
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
      throw error;
    }
    report.phases.push(outcome);
    console.log(
      `[eval] ${outcome.phase}: ${outcome.steps} passos, ${outcome.usage.inputTokens} in, ${outcome.usage.outputTokens} out, ${Math.round(outcome.elapsedMs / 1000)}s, ferramentas ${outcome.calls.join(',') || 'nenhuma'}`,
    );
    for (const item of outcome.rejected.slice(0, 4))
      console.log(
        `[eval] recusa ${item.tool}:`,
        JSON.stringify(item.output).slice(0, 400),
      );
  },
});
if (!report.flow.completed) {
  process.exitCode = 1;
  console.error(
    `[eval] incompleto: ${report.flow.reason}; fase pendente: ${report.flow.next}`,
  );
}

const [pages, images] = await Promise.all([
  listPages(tenant.id),
  listImages(tenant.id),
]);
report.elapsedMs = Date.now() - started;
report.metrics = siteMetrics(pages, images, tenant.brand.design);
report.site = lintSite(pages, images, 'draft', tenant.brand, tenant.brief);
report.structural = structuralFindings(pages, images, tenant.brand);
// A silhueta é o número que mostra se a vibe produziu composição própria.
report.silhouette = report.metrics.silhouette;
report.pageFindings = pages.flatMap((page) =>
  lintPage(page, tenant.brand.design)
    .filter((finding) => finding.level === 'error')
    .map((finding) => ({ page: `/${page.slug}`, ...finding })),
);
report.design = tenant.brand.design ?? null;
report.vibe = tenant.brand.vibe ?? 'comercial';
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
