/** Ensaio pago e delimitado: fontes sintéticas, Chromium/modelo reais e I/O editorial em memória. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createJiti } from 'jiti';
import { memoryHarness } from './lib/harness-memory.mjs';
import { loadModule } from '../tests/helpers/load-module.mjs';
if (!process.argv.includes('--live')) {
  console.log(
    'Uso: node --env-file-if-exists=.env.local scripts/eval-site-sources.mjs --live --assets=arquivo.json [--case=nenhum|atual|referencia|ambos]',
  );
  process.exit(0);
}
const option = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const cases = ['nenhum', 'atual', 'referencia', 'ambos'];
for (const name of ['case', 'skip-case']) {
  if (option(name))
    assert.ok(cases.includes(option(name)), 'Caso desconhecido');
}
const assets = JSON.parse(await readFile(option('assets'), 'utf8'));
assert.ok(assets.images?.length >= 2);
const prepared = option('resume')
  ? JSON.parse(await readFile(option('resume'), 'utf8'))
  : null;
if (prepared) {
  assert.ok(option('case'), '--resume exige --case');
  assert.equal(prepared.tenant?.slug, `eval-sources-${option('case')}`);
}
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { siteAgent } = await j.import('../lib/ai/agent.ts');
const { phaseInstructions } = await j.import('../lib/generation/context.ts');
const { PHASE_MESSAGE } = await j.import('../lib/taste/phases.ts');
const { productModel, HARNESS_VERSION } = await j.import('../lib/ai/models.ts');
const { lintSite } = await j.import('../lib/taste/site.ts');
const { lintPage } = await j.import('../lib/taste/lint.ts');
const { isDesignProfile } = await j.import('../lib/design/profile.ts');
const { captureReference } = await j.import('../lib/references/capture.ts');
const { readReferenceVisual } = await j.import('../lib/references/read.ts');
const { crawlCurrentSite } = await j.import('../lib/current-site/crawl.ts');
const { analyzeCurrentSite } = await j.import('../lib/current-site/analyze.ts');
const schema = await j.import('../lib/current-site/schema.ts');
const { sumGatewayCosts } = await j.import('../lib/ai/usage.ts');
const dir = `outputs/source-eval/${Date.now()}-${option('case') ?? 'matrix'}`;
await mkdir(dir, { recursive: true });
const currentUrl = 'https://cliente.eixu.test/';
const visualUrl = 'https://visual.eixu.test/';
const story =
  'A Aquece Lar instala e faz manutenção de aquecedores residenciais em Bauru. A conversa inicial identifica a necessidade da casa ou apartamento. O cliente envia fotos e explica se precisa instalar um aquecedor ou cuidar de um já instalado. A empresa não informa preço fixo, prazo de atendimento, plantão, marcas atendidas, garantias ou certificações. Quer receber pedidos pelo formulário para avaliar cada caso. Atende somente Bauru, não atende outras cidades. Não há depoimentos nem nomes de clientes confirmados. O operador confirma dois fatos para esta fixture: 12 instalações residenciais concluídas em Bauru; 3 anos de atuação em Bauru. As fotos da biblioteca são ilustrações de serviço, não comprovam a equipe da empresa.';
const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas Editorial — referência sintética</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f1e8;color:#172923;font-family:Arial}nav,footer{padding:28px 6vw;display:flex;justify-content:space-between;border-bottom:1px solid #bbb}main{max-width:1440px;margin:auto}header{display:grid;grid-template-columns:1fr 1fr;gap:6vw;padding:80px 6vw}h1{font:normal 76px/1.06 Georgia;margin:16px 0}p{font-size:18px;line-height:1.6;max-width:460px}.art{height:520px;background:linear-gradient(145deg,#3b6458 35%,#bea284 35%,#bea284 55%,#d9c9b1 55%);border-radius:180px 180px 0 0}.chapter{padding:64px 6vw;background:#d9c9b1}h2{font:48px Georgia}.pair{display:grid;grid-template-columns:1fr 1fr;gap:30px}.pair .art{height:220px;border-radius:0}a{color:inherit}button{padding:18px 28px;border:0;background:#172923;color:#fff}footer{margin-top:40px}@media(max-width:650px){header{grid-template-columns:1fr;padding:38px 24px}h1{font-size:44px}.art{height:330px}.chapter{padding:35px 24px}.pair{grid-template-columns:1fr}nav,footer{padding:24px}}
</style></head><body><nav><b>Atlas Editorial</b><a href="#colecao">Coleção</a></nav><main><header><div><p>Cultura e leitura</p><h1>Histórias para olhar de perto</h1><p>Publicamos livros de arte e catálogos de exposições. Conteúdo apenas da referência sintética.</p><button>Conhecer a coleção</button></div><div class="art" role="img" aria-label="Composição abstrata de cores"></div></header><section class="chapter" id="colecao"><h2>Entre páginas e matéria</h2><div class="pair"><div><div class="art"></div><p>Volumes e recortes da coleção.</p></div><div><div class="art"></div><p>Detalhes para uma leitura próxima.</p></div></div></section></main><footer><b>Atlas Editorial</b><p>Referência de teste</p></footer></body></html>`;
const resource = (body, type = 'text/html; charset=utf-8', status = 200) => ({
  status,
  headers: { 'content-type': type },
  body: Buffer.from(body),
});
const visualRequest = async (url) =>
  new URL(url).hostname === 'visual.eixu.test'
    ? resource(html)
    : resource('', 'text/plain', 404);
const currentRequest = async (url) => {
  const path = new URL(url).pathname;
  if (path === '/sitemap.xml')
    return resource(
      '<urlset><url><loc>https://cliente.eixu.test/servicos</loc></url></urlset>',
      'application/xml',
    );
  if (!['/', '/servicos'].includes(path))
    return resource('', 'text/plain', 404);
  return resource(
    `<html><head><title>Aquece Lar — site atual sintético</title></head><body><h1>Aquece Lar</h1><p>Instalação e manutenção de aquecedores residenciais. Atendemos o Brasil inteiro.</p><p>Para iniciar o atendimento, envie fotos do aparelho e explique a necessidade do imóvel. A avaliação considera o espaço de instalação e a condição do equipamento.</p><a href="/servicos">Serviços</a><script>document.body.insertAdjacentHTML('beforeend','<p>Conversa inicial para entender a instalação residencial.</p>')</script></body></html>`,
  );
};
const report = {
  model: productModel(),
  harness: HARNESS_VERSION,
  scope:
    'Chromium e modelos reais, fontes sintéticas servidas por transporte controlado; fotos de fixture; sem Neon/Blob/publicação.',
  runs: [],
};
let currentReceipt, visualReceipt;
const save = () =>
  writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
for (const [name, current, visual, vibe] of [
  ['nenhum', false, false, 'comercial'],
  ['atual', true, false, 'landing'],
  ['referencia', false, true, 'comercial'],
  ['ambos', true, true, 'landing'],
]) {
  if (option('case') && name !== option('case')) continue;
  if (option('skip-case') === name) continue;
  const tenant = prepared?.tenant ?? {
    id: randomUUID(),
    slug: `eval-sources-${name}`,
    name: 'Aquece Lar',
    brief: {
      intake: {
        story,
        evidence: [
          '12 instalações residenciais concluídas em Bauru',
          '3 anos de atuação em Bauru',
        ],
        currentSiteUrl: current ? currentUrl : '',
        references: visual ? [visualUrl] : [],
        constraints: ['Não publicar. Ensaio sintético de geração.'],
      },
    },
    brand: {
      vibe,
      paletteSource: 'operador',
      accent: '#164989',
      accentAlt: '#7e4123',
      highlight: '#ad4025',
    },
    dials: { variance: 5, motion: 4, density: 5 },
    imageGuide: {},
    contacts: { phones: [], addresses: [], social: [] },
    whatsapp: null,
    contactEmail: null,
  };
  const images = assets.images.map((image, i) => ({
    ...image,
    id: `image-${i}`,
    tenantId: tenant.id,
    seq: i + 1,
    kind: 'foto',
    status: 'disponivel',
    model: 'openai/gpt-image-2',
    blobPath: `tenants/${tenant.slug}/gerado/fixture-${i}.webp`,
    targetBlock: 'livre',
    requestText: image.alt,
    critique: {},
  }));
  const state = await memoryHarness(tenant, images, {
    '@/lib/references/read': {
      readReferenceVisual: async () => {
        visualReceipt ??= await readReferenceVisual(visualUrl, tenant.id, {
          capture: async (_url, signal) =>
            captureReference(visualUrl, visualRequest, { signal }),
        });
        assert.equal(visualReceipt.status, 'ok', JSON.stringify(visualReceipt));
        return visualReceipt;
      },
    },
    '@/lib/current-site/read': {
      readCurrentSite: async (input) => {
        if (!currentReceipt) {
          const { readCurrentSite } = await loadModule(
            'lib/current-site/read.ts',
            {
              './crawl': {
                crawlCurrentSite: async () =>
                  crawlCurrentSite(currentUrl, { request: currentRequest }),
              },
              './analyze': { analyzeCurrentSite },
              './schema': schema,
              './import-image': {
                importCurrentSiteImages: async () => {
                  throw new Error('Este ensaio não importa ativos remotos');
                },
              },
            },
          );
          currentReceipt = await readCurrentSite(input);
          assert.equal(
            currentReceipt.analysisStatus,
            'ok',
            currentReceipt.analysisReason,
          );
          assert.equal(currentReceipt.analysis.identity.matches, true);
          assert.ok(currentReceipt.analysis.conflicts.length);
        }
        return currentReceipt;
      },
    },
  });
  if (prepared) state.pages.push(...prepared.pages);
  const run = {
    name,
    vibe,
    current,
    visual,
    resumedFrom: option('resume'),
    phases: [],
    events: [],
  };
  report.runs.push(run);
  try {
    for (const phase of ['briefing', 'composicao']) {
      if (prepared && phase === 'briefing') {
        assert.ok(isDesignProfile(tenant.brand.design));
        continue;
      }
      const agent = siteAgent({
        tenantId: tenant.id,
        instructions: phaseInstructions({
          tenant,
          pages: state.pages,
          images,
          phase,
        }),
        tools: state.buildTools({ phase }),
        phase,
      });
      const start = Date.now();
      const result = await agent.generate({
        prompt: PHASE_MESSAGE[phase],
        onStepEnd: async (step) => {
          const event = {
            phase,
            finishReason: step.finishReason,
            tools: step.toolResults?.map((r) => ({
              name: r.toolName,
              output: r.output,
            })),
            errors: step.content
              .filter((p) => p.type === 'tool-error')
              .map((p) => String(p.error)),
          };
          run.events.push(event);
          console.log(
            JSON.stringify({
              case: name,
              phase,
              tools: event.tools?.map((t) => ({
                name: t.name,
                error: t.output?.error,
                pendencias: t.output?.pendencias?.filter(
                  (f) => f.level === 'error',
                ),
              })),
              errors: event.errors.map((error) => error.slice(0, 200)),
            }),
          );
          await save();
        },
      });
      run.phases.push({
        phase,
        finishReason: result.finishReason,
        durationMs: Date.now() - start,
        steps: result.steps.length,
        usage: result.usage,
        costUsd: sumGatewayCosts(
          result.steps.map((s) => s.providerMetadata?.gateway?.cost),
        ),
        text: result.text,
      });
      await writeFile(
        `${dir}/${name}.json`,
        JSON.stringify({ tenant, pages: state.pages, images }, null, 2),
      );
      await save();
      assert.ok(
        isDesignProfile(tenant.brand.design),
        'A direção precisa estar salva para compor',
      );
    }
    run.findings = [
      ...lintSite(state.pages, images, 'publish', tenant.brand, tenant.brief),
      ...state.pages.flatMap((p) =>
        lintPage(p, tenant.brand.design).map((f) => ({ ...f, page: p.slug })),
      ),
    ];
    run.pages = state.pages.length;
    run.passed =
      state.pages.length >= (vibe === 'landing' ? 2 : 3) &&
      run.findings.every((f) => f.level !== 'error');
    const content = JSON.stringify(state.pages);
    assert.doesNotMatch(
      content,
      /Atlas Editorial|livros de arte|Brasil inteiro/i,
    );
    if (current && !prepared)
      assert.ok(
        run.events.some((e) =>
          e.tools?.some((t) => t.name === 'read_current_site'),
        ),
      );
    if (visual) assert.ok(tenant.brand.design.referenceDirection);
    assert.ok(run.passed, JSON.stringify(run.findings));
  } catch (error) {
    run.error = error.message;
    run.passed = false;
    console.error(JSON.stringify({ case: name, error: error.message }));
  }
  await save();
}
console.log(
  JSON.stringify({
    directory: dir,
    runs: report.runs.map(({ name, passed, pages, error }) => ({
      name,
      passed,
      pages,
      error,
    })),
  }),
);
if (!report.runs.length || report.runs.some((r) => !r.passed))
  process.exitCode = 1;
