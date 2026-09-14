/** Chamadas reais, executores reais e páginas sintéticas em memória. Sem Neon/Blob/publicação. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
import {
  commercialEditTenant,
  editPages,
  pageEditFixture,
} from '../tests/helpers/page-edit-fixture.mjs';
import {
  recognitionPages,
  recognitionRequest,
} from '../tests/helpers/recognition-fixture.mjs';
import {
  landingFrameData,
  landingFrameRequest,
} from '../tests/helpers/landing-frame-fixture.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { siteAgent } = await j.import('../lib/ai/agent.ts');
const { productModel } = await j.import('../lib/ai/models.ts');
const { usageRecord, sumGatewayCosts } = await j.import('../lib/ai/usage.ts');
const CAROUSEL_REQUEST =
  'No lugar de apenas uma imagem no hero, quero um carrossel com as imagens #4, #6, #7 e #8.';
const carouselImages = [
  [4, '3:2', 'Produto principal em uma bancada clara'],
  [6, '1:1', 'Detalhe lateral do material aplicado'],
  [7, '1:1', 'Acabamento do material visto de perto'],
  [8, '1:1', 'Material em outro ambiente iluminado'],
].map(([seq, ratio, alt]) => ({
  id: `image-${seq}`,
  tenantId: 'edit-fixture',
  seq,
  kind: 'foto',
  ratio,
  model: 'upload',
  status: 'disponivel',
  url: `https://assets.test/foto-${seq}.webp`,
  blobPath: `tenants/edit-fixture/uploads/foto-${seq}.webp`,
  targetBlock: 'livre',
  requestText: alt,
  alt,
  critique: {},
  createdAt: '2026-09-13T00:00:00Z',
}));
const carouselSlides = carouselImages.slice(1).map((image) => ({
  src: image.url,
  alt: image.alt,
}));
function carouselPages(unsupported = false) {
  const pages = editPages();
  pages[0].blocks[1] = unsupported
    ? {
        id: 'hero',
        type: 'hero.split',
        props: {
          layout: 'cover',
          headline: 'Materiais para cada ambiente',
          subtext: 'Compare detalhes e acabamentos antes de escolher.',
          cta: { label: 'Conferir opções', href: '/materiais' },
          image: carouselImages[0].url,
          imageAlt: carouselImages[0].alt,
        },
      }
    : {
        id: 'hero',
        type: 'hero.landing',
        props: {
          layout: 'stage',
          headline: 'Materiais para cada ambiente',
          subtext: 'Compare detalhes e acabamentos antes de escolher.',
          cta: { label: 'Conferir opções', href: '/materiais' },
          image: carouselImages[0].url,
          imageAlt: carouselImages[0].alt,
        },
      };
  pages[0].publishedBlocks = structuredClone(pages[0].blocks);
  return pages;
}
if (!process.argv.includes('--live')) {
  console.log(
    'Use npm run eval:edits -- --live [--case=hero-carousel|hero-carousel-unsupported|text|nested|color|footer-gray|footer-gradient|hero-decoration-off|insert|move|move-within|impossible-move|ambiguous|recognition-image|landing-frame] [--attachment=fixture.png]. Modelo de edição configurado, fixture sintética, executores reais; nenhuma gravação remota.',
  );
  process.exit(0);
}
const cases = [
  {
    id: 'hero-carousel',
    text: CAROUSEL_REQUEST,
    initialPages: carouselPages(),
    images: carouselImages,
    check: (pages, result, run) => {
      const hero = pages[0].blocks.find((block) => block.id === 'hero');
      assert.equal(hero.props.image, carouselImages[0].url);
      assert.deepEqual(hero.props.slides, carouselSlides);
      assert.equal(
        pages[0].blocks.some((block) => block.type === 'media.gallery'),
        false,
      );
      assert.deepEqual(
        run.trace.flatMap((step) => step.calls.map((call) => call.toolName)),
        ['edit_page'],
      );
      assert.equal(run.writes.length, 1);
      assert.doesNotMatch(result.text, /\?/);
    },
  },
  {
    id: 'hero-carousel-unsupported',
    text: CAROUSEL_REQUEST,
    initialPages: carouselPages(true),
    images: carouselImages,
    check: (pages, result, run) => {
      assert.deepEqual(pages, carouselPages(true));
      assert.equal(run.writes.length, 0);
      assert.match(result.text, /media\.gallery|galeria.+carrossel/i);
    },
  },
  {
    id: 'landing-frame',
    text: landingFrameRequest,
    initialPages: landingFrameData().pages,
    initialTenant: landingFrameData().tenant,
    check: (pages) => {
      const expected = landingFrameData().pages;
      const hero = pages[0].blocks.find((block) => block.id === 'hero');
      assert.equal(hero.props.imagePresentation?.frame, 'none');
      assert.equal(hero.props.imagePresentation?.fit, 'natural');
      expected[0].blocks.find(
        (block) => block.id === 'hero',
      ).props.imagePresentation = hero.props.imagePresentation;
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'recognition-image',
    text: recognitionRequest,
    initialPages: recognitionPages(),
    check: (pages) => {
      const expected = recognitionPages();
      const block = pages[0].blocks.find((block) => block.id === 'recognition');
      assert.equal(block.props.presentation.background, 'transparent');
      assert.equal(block.props.presentation.edge, 'none');
      assert.equal(block.props.presentation.spacingTop, 'none');
      assert.deepEqual(block.props.items[0].imagePresentation, {
        frame: 'none',
        fit: 'natural',
        width: 'container',
        spacingTop: 'none',
      });
      expected[0].blocks[2].props.presentation = block.props.presentation;
      expected[0].blocks[2].props.items[0].imagePresentation =
        block.props.items[0].imagePresentation;
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'text',
    text: 'Troque o texto "Escolha com calma." por "Compare os acabamentos.".',
    check: (pages) => {
      const expected = editPages();
      expected[0].blocks[2].props.body =
        expected[0].blocks[2].props.body.replace(
          'Escolha com calma.',
          'Compare os acabamentos.',
        );
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'nested',
    text: 'Na segunda pergunta do bloco de dúvidas, troque a pergunta para "O que considerar no ambiente?". Preserve a resposta.',
    check: (pages) => {
      const expected = editPages();
      expected[0].blocks[3].props.items[1].q = 'O que considerar no ambiente?';
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'color',
    text: 'Altere só o fundo do bloco "Como escolher" para #173f54.',
    check: (pages) => {
      const expected = editPages();
      expected[0].blocks[2].props.presentation.background = '#173f54';
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'footer-gray',
    text: 'Deixa o footer inteiro na cor cinza.',
    initialTenant: commercialEditTenant,
    check: (pages, result, run) => {
      const colors = pages.map(
        (page) =>
          page.blocks.find((block) => block.type === 'footer.compact').props
            .presentation?.background,
      );
      assert.ok(colors.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
      assert.equal(new Set(colors).size, 1);
      assert.match(result.text, new RegExp(colors[0], 'i'));
      assert.ok(
        run.trace
          .flatMap((step) => step.calls)
          .every((call) => call.toolName !== 'set_brand'),
      );
    },
  },
  {
    id: 'footer-gradient',
    text: 'Quero um degradê mais elegante no rodapé.',
    initialTenant: commercialEditTenant,
    check: (pages, result, run) => {
      const presentations = pages.map(
        (page) =>
          page.blocks.find((block) => block.type === 'footer.compact').props
            .presentation,
      );
      const complete = presentations.every(
        (presentation) =>
          /^#[0-9a-f]{6}$/i.test(presentation?.background) &&
          /^#[0-9a-f]{6}$/i.test(presentation?.backgroundEnd) &&
          ['down', 'diagonal', 'right'].includes(presentation?.gradient),
      );
      if (complete) {
        assert.match(result.text, /#[0-9a-f]{6}/i);
        assert.match(result.text, /degrad/i);
      } else {
        assert.deepEqual(pages, editPages());
        assert.match(result.text, /limite|não (?:consigo|foi|pode)|contraste/i);
      }
      assert.ok(
        run.trace
          .flatMap((step) => step.calls)
          .every((call) => call.toolName !== 'set_brand'),
      );
    },
  },
  {
    id: 'hero-decoration-off',
    text: 'Tira o degradê da abertura e deixa o fundo liso.',
    initialTenant: commercialEditTenant,
    check: (pages, _result, run) => {
      assert.ok(
        pages.every(
          (page) =>
            page.blocks.find((block) => block.type.startsWith('hero.')).props
              .presentation?.decoration === 'none',
        ),
      );
      assert.ok(
        run.trace
          .flatMap((step) => step.calls)
          .every((call) => call.toolName !== 'set_brand'),
      );
    },
  },
  {
    id: 'insert',
    text: 'Adicione abaixo do footer um bloco de texto com título "Cuidados com materiais" e texto "Considere as características do material antes de escolher os produtos de limpeza.". Preserve o restante.',
    check: (pages) => {
      const expected = editPages();
      const added = pages[0].blocks.at(-1);
      assert.equal(added.type, 'editorial.text');
      assert.equal(added.props.title, 'Cuidados com materiais');
      assert.equal(
        added.props.body,
        'Considere as características do material antes de escolher os produtos de limpeza.',
      );
      expected[0].blocks.push(added);
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'move',
    text: 'Mova o bloco de dúvidas para logo antes de "Como escolher".',
    check: (pages) => {
      const expected = editPages();
      const [faq] = expected[0].blocks.splice(3, 1);
      expected[0].blocks.splice(2, 0, faq);
      assert.deepEqual(pages, expected);
    },
  },
  {
    // O pedido que motivou a guarda: mover selos dentro do hero.
    id: 'move-within',
    hero: 'bullets',
    text: 'coloque esses selos do hero embaixo do título',
    check: (pages) => {
      const expected = editPages({ hero: 'bullets' });
      expected[0].blocks[1].props.bulletsPlacement = 'headline';
      assert.deepEqual(pages, expected);
    },
  },
  {
    // Reposicionar sem campo para isso: explicar, nunca apagar.
    id: 'impossible-move',
    hero: 'bullets',
    text: 'mova o texto de apoio do hero para dentro do rodapé, na mesma linha do logo',
    check: (pages, result) => {
      assert.deepEqual(pages, editPages({ hero: 'bullets' }));
      assert.ok(result.text.trim().length > 0);
      assert.doesNotMatch(result.text, /removi|apaguei|exclu/i);
    },
  },
  {
    id: 'ambiguous',
    text: 'Troque "Ver materiais" por "Ver opções".',
    check: (pages, result) => {
      assert.deepEqual(pages, editPages());
      assert.ok(result.text.trim().length > 0);
      assert.match(result.text, /\?|qual|cabeçalho|botão|duas|amb[oa]s/i);
    },
  },
];
const selected = process.argv
  .find((arg) => arg.startsWith('--case='))
  ?.slice(7);
if (selected && !cases.some((c) => c.id === selected))
  throw new Error('Caso desconhecido.');
if (!process.argv.includes('--live')) {
  const supported = await pageEditFixture(CAROUSEL_REQUEST, {
    initialPages: carouselPages(),
    images: carouselImages,
  });
  const applied = await supported.tools.edit_page.execute({
    page: '',
    revision: (await j.import('../lib/ai/page-edits.ts')).pageRevision(
      supported.pages[0],
    ),
    operations: [
      { op: 'set', block: 'hero', path: 'slides', value: carouselSlides },
    ],
  });
  assert.equal(applied.ok, true, JSON.stringify(applied));
  assert.equal(supported.writes.length, 1);
  assert.match(applied.summary.join(' '), /carrossel com 4 fotos/);
  cases[0].check(
    supported.pages,
    { text: '' },
    {
      trace: [{ calls: [{ toolName: 'edit_page' }] }],
      writes: supported.writes,
    },
  );

  const unsupported = await pageEditFixture(CAROUSEL_REQUEST, {
    initialPages: carouselPages(true),
    images: carouselImages,
  });
  const refused = await unsupported.tools.edit_page.execute({
    page: '',
    revision: (await j.import('../lib/ai/page-edits.ts')).pageRevision(
      unsupported.pages[0],
    ),
    operations: [
      { op: 'set', block: 'hero', path: 'slides', value: carouselSlides },
    ],
  });
  assert.match(refused.error, /media\.gallery.*carousel/i);
  assert.equal(unsupported.writes.length, 0);
  assert.deepEqual(unsupported.pages, carouselPages(true));
  console.log(
    'Fixtures hero-carousel e hero-carousel-unsupported validadas com executores reais; nenhuma gravação remota.',
  );
  console.log(
    'Use npm run eval:edits -- --live [--case=hero-carousel|hero-carousel-unsupported|text|nested|color|insert|move|move-within|impossible-move|ambiguous|recognition-image|landing-frame] [--attachment=fixture.png] para medir o modelo configurado.',
  );
  process.exit(0);
}
const directory = `outputs/page-edits/${Date.now()}`;
const attachment = process.argv
  .find((arg) => arg.startsWith('--attachment='))
  ?.slice(13);
const attachmentImage = attachment ? await readFile(attachment) : undefined;
await mkdir(directory, { recursive: true });
const report = {
  model: productModel('edit'),
  scope: 'Páginas sintéticas em memória; sem autenticação/Neon/Blob reais.',
  attachment: attachment ?? null,
  runs: [],
};
for (const scenario of cases.filter((c) => !selected || c.id === selected)) {
  const f = await pageEditFixture(scenario.text, {
    hero: scenario.hero,
    initialPages: scenario.initialPages,
    initialTenant: scenario.initialTenant,
    images: scenario.images,
  });
  const trace = [];
  const started = Date.now();
  const agent = siteAgent({
    tenantId: f.tenant.id,
    tools: f.tools,
    instructions: f.instructions,
    modelRole: 'edit',
  });
  try {
    const result = await agent.generate({
      prompt: attachmentImage
        ? [
            {
              role: 'user',
              content: [
                { type: 'text', text: scenario.text },
                { type: 'file', data: attachmentImage, mediaType: 'image/png' },
              ],
            },
          ]
        : scenario.text,
      onStepEnd: (step) => {
        trace.push({
          calls: step.toolCalls,
          results: step.toolResults,
          text: step.text,
        });
        console.log(
          JSON.stringify({
            case: scenario.id,
            step: trace.length,
            tools: step.toolCalls.map((call) => call.toolName),
            rejected: step.content.filter((part) => part.type === 'tool-error')
              .length,
          }),
        );
      },
    });
    scenario.check(f.pages, result, { trace, writes: f.writes });
    const run = {
      case: scenario.id,
      correct: true,
      ...usageRecord(
        result.usage,
        report.model,
        'livre',
        result.steps.length,
        started,
      ),
      costUsd: sumGatewayCosts(
        result.steps.map((step) => step.providerMetadata?.gateway?.cost),
      ),
      calls: result.steps.flatMap((step) =>
        step.toolCalls.map((call) => call.toolName),
      ),
      writes: f.writes.length,
      text: result.text,
    };
    report.runs.push(run);
    console.log(JSON.stringify(run));
  } catch (error) {
    report.runs.push({
      case: scenario.id,
      correct: false,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Falha',
    });
    console.error(
      JSON.stringify({
        case: scenario.id,
        correct: false,
        error: error instanceof Error ? error.name : 'Falha',
      }),
    );
    process.exitCode = 1;
  }
  await writeFile(
    `${directory}/${scenario.id}.json`,
    JSON.stringify({ pages: f.pages, trace }, null, 2),
  );
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`Relatório: ${directory}/report.json`);
