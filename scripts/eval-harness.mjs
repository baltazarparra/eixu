/** Modelo real, ferramentas reais com I/O em memória, renderer e CSS de produção.
 * Não acessa Neon, não escreve Blob e não publica. Fotos vêm de fixture local.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import { memoryHarness } from './lib/harness-memory.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  // Outros runners usam JSX clássico; não reutilize esse transform em disco.
  fsCache: false,
});
const { siteAgent } = await j.import('../lib/ai/agent.ts');
const { productModel, HARNESS_VERSION, modelSettings } = await j.import(
  '../lib/ai/models.ts',
);
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { PHASE_MESSAGE } = await j.import('../lib/taste/phases.ts');
const { lintPage } = await j.import('../lib/taste/lint.ts');
const { lintSite } = await j.import('../lib/taste/site.ts');
const { currentReview } = await j.import('../lib/review/state.ts');
const { capturePages } = await j.import('../lib/review/capture.ts');
const { RenderBlocks } = await j.import('../lib/blocks/render.tsx');
const { themeVars } = await j.import('../lib/blocks/theme.ts');
const { usageRecord, sumGatewayCosts } = await j.import('../lib/ai/usage.ts');

const flags = process.argv.slice(2);
const option = (key, fallback) =>
  flags.find((value) => value.startsWith(`${key}=`))?.slice(key.length + 1) ??
  fallback;
const caseName = option('--case', 'aquecimento');
if (!['aquecimento', 'pedras', 'mecanica-sabia'].includes(caseName))
  throw new Error('Caso desconhecido');
const assetsPath = option('--assets');
const resumePath = option('--resume');
if (!flags.includes('--live') || !assetsPath) {
  console.log(
    'Uso: npm run eval:harness -- --live --case=aquecimento --assets=<fixture.json> [--repeat=2]. Chamadas pagas; I/O editorial em memória. Fixture: array images com fotos de teste, URLs, alt e ratio.',
  );
  process.exit(flags.includes('--live') ? 1 : 0);
}
if (!process.env.EIXU_CHROME_PATH)
  throw new Error(
    'Configure EIXU_CHROME_PATH para revisar o resultado renderizado.',
  );
if (process.env.EIXU_REVIEW_CAPTURE === '0')
  throw new Error('A avaliação de qualidade exige captura visual habilitada.');
const repetitions = Number(option('--repeat', '1'));
if (![1, 2, 3].includes(repetitions))
  throw new Error('Use 1, 2 ou 3 repetições.');
const assets = JSON.parse(await readFile(assetsPath, 'utf8'));
if (!Array.isArray(assets.images) || assets.images.length < 2)
  throw new Error('Fixture precisa de ao menos duas fotos distintas.');
const spec = JSON.parse(await readFile(`evals/cases/${caseName}.json`, 'utf8'));
const resume = resumePath
  ? JSON.parse(await readFile(resumePath, 'utf8'))
  : null;
if (
  resume &&
  (resume.tenant?.slug !== `eval-quality-${caseName}` ||
    !Array.isArray(resume.pages))
)
  throw new Error('Retome somente o rascunho sintético do mesmo caso.');
const cssFiles = (await readdir('.next/static/chunks')).filter((file) =>
  file.endsWith('.css'),
);
const css = (
  await Promise.all(
    cssFiles.map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
  )
)
  .filter((sheet) => sheet.includes('.site-theme'))
  .join('\n');
if (!css.includes('data-vibe'))
  throw new Error('Execute build:vercel antes do ensaio.');
const fontVars = [
  'sans',
  'serif',
  'mono',
  'geometric',
  'humanist',
  'display-editorial',
]
  .map((name) => {
    const value = css.match(new RegExp(`--font-${name}:([^;}]+)`))?.[1];
    return value ? `--font-${name}:${value};` : '';
  })
  .join('');
const directory = `outputs/harness/${Date.now()}-${caseName}`;
await mkdir(directory, { recursive: true });
const report = {
  case: caseName,
  harness: HARNESS_VERSION,
  model: productModel(),
  critic: productModel('critic'),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  worktree: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }),
  scope:
    'Ferramentas e renderer reais; persistência em memória, fotos de fixture; sem geração de fotos, publicação ou hidratação React.',
  resumedFrom: resumePath,
  runs: [],
};

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const tenant = resume
    ? structuredClone(resume.tenant)
    : {
        id: `eval-quality-${caseName}`,
        slug: `eval-quality-${caseName}`,
        name: spec.name,
        brief: { intake: spec.intake },
        brand: {
          vibe: spec.vibe ?? 'comercial',
          paletteSource: 'operador',
          accent: '#164989',
          accentAlt: '#7e4123',
          highlight: '#ad4025',
        },
        dials: { variance: 5, motion: 4, density: 5 },
        imageGuide: {},
        contacts: {},
        whatsapp: spec.whatsapp,
        contactEmail: null,
      };
  const images = assets.images.map((image, index) => ({
    id: `fixture-image-${index}`,
    tenantId: tenant.id,
    seq: index + 1,
    kind: 'foto',
    status: 'disponivel',
    model: 'openai/gpt-image-2',
    blobPath: `tenants/${tenant.slug}/gerado/fixture-${index}.webp`,
    url: image.url,
    alt: image.alt ?? 'Cena ilustrativa de serviço',
    description: image.description ?? image.alt,
    ratio: image.ratio,
    targetBlock: image.targetBlock ?? 'media.image',
    requestText: image.requestText ?? image.alt,
    critique: {},
  }));
  const state = await memoryHarness(tenant, images);
  if (resume) state.pages.push(...structuredClone(resume.pages));
  const run = {
    repetition,
    phases: [],
    rejected: [],
    startedAt: new Date().toISOString(),
    manualEdits: 0,
  };
  report.runs.push(run);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/_next/static/')) {
        const file = url.pathname.replace('/_next/', '.next/');
        if (file.includes('..')) throw new Error('Caminho inválido');
        response.end(await readFile(file));
        return;
      }
      const slug = url.pathname
        .replace(`/s/${tenant.slug}/`, '')
        .replace(/\/$/, '');
      const page = state.pages.find((page) => page.slug === slug);
      if (!page) {
        response.writeHead(404);
        response.end('Ausente');
        return;
      }
      const design = tenant.brand.design;
      const markup = renderToStaticMarkup(
        createElement(
          'div',
          {
            className: 'site-theme',
            style: themeVars(tenant.brand),
            'data-vibe': tenant.brand.vibe,
            'data-design-version': design?.version,
            'data-hero': design?.heroComposition,
            'data-navigation': design?.navigation,
            'data-rhythm': design?.rhythm,
            'data-imagery': design?.imageTreatment,
            'data-surface': design?.surfaceStyle,
            'data-motif': design?.motif,
            'data-variance':
              tenant.dials.variance <= 3 ? 'quiet' : 'expressive',
            'data-density':
              tenant.dials.density <= 3
                ? 'airy'
                : tenant.dials.density >= 8
                  ? 'compact'
                  : 'normal',
            'data-motion': tenant.dials.motion <= 3 ? 'still' : 'gentle',
          },
          createElement(RenderBlocks, {
            blocks: page.blocks,
            ctx: {
              tenant,
              pagePath: `/${slug}`,
              pageType: page.type,
              isPreview: true,
            },
          }),
        ),
      );
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(
        `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n:root{${fontVars}}</style></head><body>${markup}</body></html>`,
      );
    } catch (error) {
      run.renderErrors ??= [];
      run.renderErrors.push(`${error.name}: ${error.message}`);
      console.error('[eval] render:', error.name, error.message);
      response.writeHead(500);
      response.end('Falha ao renderizar fixture');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  run.origin = origin;
  try {
    if (resume) {
      const preview = await fetch(`${origin}/s/${tenant.slug}/`);
      if (!preview.ok)
        throw new Error(
          'A fixture não renderizou antes da retomada. Confira renderErrors.',
        );
    }
    for (const phase of resume
      ? ['revisao']
      : ['briefing', 'composicao', 'revisao']) {
      const context = { phase, origin };
      const toolset = state.buildTools(context);
      const tools = Object.fromEntries(
        Object.entries(toolset).map(([name, definition]) => [
          name,
          {
            ...definition,
            execute: async (...args) => {
              const output = await definition.execute(...args);
              if (output?.error || output?.ok === false)
                run.rejected.push({ phase, tool: name, output });
              console.log(
                JSON.stringify({
                  repetition,
                  phase,
                  tool: name,
                  rejected: Boolean(output?.error || output?.ok === false),
                }),
              );
              return output;
            },
          },
        ]),
      );
      const summary = state.pages
        .map((page) => `- /${page.slug} (${page.type}): ${page.title}`)
        .join('\n');
      const photos = images
        .map(
          (image) =>
            `#${image.seq} ${image.ratio}, ${image.targetBlock}: ${image.url} | ${image.alt}`,
        )
        .join('\n');
      const agent = siteAgent({
        tenantId: tenant.id,
        instructions: systemPrompt(tenant, summary, '/', photos, { phase }),
        tools,
        phase,
      });
      const started = Date.now();
      const result = await agent.generate({
        prompt: PHASE_MESSAGE[phase],
        onStepEnd: async (step) => {
          for (const part of step.content) {
            if (part.type === 'tool-error')
              run.rejected.push({
                phase,
                tool: part.toolName,
                source: 'sdk',
                error: String(part.error),
              });
          }
          const record = {
            phase,
            finishReason: step.finishReason,
            usage: step.usage,
            tools: step.content.filter((part) =>
              ['tool-call', 'tool-result', 'tool-error'].includes(part.type),
            ),
          };
          run.trace ??= [];
          run.trace.push(record);
          await writeFile(
            `${directory}/output-${repetition}.json`,
            JSON.stringify({ tenant, pages: state.pages, images }, null, 2),
          );
          await writeFile(
            `${directory}/report.json`,
            JSON.stringify(report, null, 2),
          );
        },
      });
      run.phases.push({
        phase,
        settings: modelSettings(phase),
        ...usageRecord(
          result.usage,
          productModel(),
          phase,
          result.steps.length,
          started,
        ),
        finishReason: result.finishReason,
        calls: result.steps.flatMap((step) =>
          step.toolCalls.map((call) => call.toolName),
        ),
        costUsd: sumGatewayCosts(
          result.steps.map((step) => step.providerMetadata?.gateway?.cost),
        ),
        text: result.text,
      });
      await writeFile(
        `${directory}/report.json`,
        JSON.stringify(report, null, 2),
      );
    }
    run.findings = [
      ...lintSite(state.pages, images, 'publish', tenant.brand),
      ...state.pages.flatMap((page) =>
        lintPage(page, tenant.brand.design).map((finding) => ({
          ...finding,
          page: `/${page.slug}`,
        })),
      ),
    ];
    run.review = currentReview(tenant, state.pages, images);
    run.passed =
      run.findings.every((finding) => finding.level !== 'error') &&
      run.review?.complete === true &&
      run.review.errors === 0;
    const shots = await capturePages(
      origin,
      tenant.slug,
      state.pages.map((page) => page.slug),
    );
    for (const shot of shots)
      await writeFile(
        `${directory}/${repetition}-${shot.page.slice(1).replaceAll('/', '-') || 'home'}-${shot.viewport}.jpg`,
        shot.jpeg,
      );
    await writeFile(
      `${directory}/output-${repetition}.json`,
      JSON.stringify({ tenant, pages: state.pages, images }, null, 2),
    );
  } catch (error) {
    run.passed = false;
    run.error = `${error.name}: ${error.message.slice(0, 300)}`;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      repetition,
      passed: run.passed,
      directory,
      error: run.error,
    }),
  );
}
if (report.runs.some((run) => !run.passed)) process.exitCode = 1;
