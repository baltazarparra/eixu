import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { editPolicyFor } = await j.import('../lib/ai/edit-policy.ts');
const request =
  'quero que o header nav seja fixed e com bg solido darkmode com transparencia';
const baseline = [
  {
    id: 'page',
    slug: '',
    type: 'page',
    title: 'Início',
    seo: {},
    meta: {},
    blocks: [
      {
        id: 'nav',
        type: 'nav.bar',
        props: {
          logoText: 'Ateliê',
          logoHeight: 36,
          links: [{ label: 'Serviços', href: '#servicos' }],
          presentation: { tone: 'paper', width: 'wide' },
        },
      },
      {
        id: 'hero',
        type: 'hero.split',
        props: { headline: 'Título preservado' },
      },
      {
        id: 'gallery',
        type: 'media.gallery',
        props: {
          title: 'Galeria preservada',
          images: [
            { src: 'https://assets.test/a.webp', alt: 'Imagem A' },
            { src: 'https://assets.test/b.webp', alt: 'Imagem B' },
          ],
        },
      },
    ],
  },
];

async function fixture(text = request) {
  const pages = structuredClone(baseline);
  const writes = [];
  const tenant = {
    id: 'fixture',
    slug: 'fixture',
    name: 'Fixture',
    brand: {},
    brief: {},
    dials: {},
    imageGuide: {},
  };
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (_parts, ...values) => {
          writes.push(values);
          pages[0].blocks = JSON.parse(values[0]);
          return [];
        },
    },
    '@/lib/tenant-queries': { getPage: async () => structuredClone(pages[0]) },
    '@/lib/taste/lint': {
      lintPage: () => [],
      formatFindings: () => 'Aprovado',
    },
  });
  const policy = editPolicyFor(text, pages);
  return {
    pages,
    writes,
    tools: buildTools(tenant, { lastUserText: text, editPolicy: policy }),
  };
}

await test('pedido original só permite estilo de nav; ferramentas de reconstrução não existem no runtime', async () => {
  const f = await fixture();
  for (const tool of [
    'set_design',
    'set_brand',
    'build_site',
    'repair_site',
    'set_blocks',
    'insert_block',
    'remove_block',
    'publish_site',
  ])
    assert.equal(f.tools[tool], undefined, tool);
  const result = await f.tools.update_block.execute({
    page: '',
    block: 'nav',
    props: {
      position: 'fixed',
      backgroundOpacity: 88,
      presentation: { tone: 'ink' },
    },
  });
  assert.equal(result.ok, true);
  const expected = structuredClone(baseline);
  Object.assign(expected[0].blocks[0].props, {
    position: 'fixed',
    backgroundOpacity: 88,
  });
  expected[0].blocks[0].props.presentation.tone = 'ink';
  assert.deepEqual(f.pages, expected);
  assert.equal(f.writes.length, 1);
});

await test('nem uma crítica permite modificar hero, galeria, logo ou campos fora do pedido', async () => {
  for (const input of [
    { page: '', block: 'hero', props: { headline: 'Título indevido' } },
    { page: '', block: 'gallery', props: { layout: 'filmstrip' } },
    { page: '', block: 'nav', props: { logoHeight: 80 } },
    { page: '', block: 'nav', props: { presentation: { width: 'narrow' } } },
    { page: '', block: 'nav', props: {}, type: 'hero.split' },
  ]) {
    const f = await fixture();
    assert.ok(
      (await f.tools.update_block.execute(input)).error,
      JSON.stringify(input),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.pages, baseline);
  }
});

await test('props inválidas e desconhecidas são recusadas antes de gravar um bloco', async () => {
  for (const props of [
    { position: 'sticky' },
    { backgroundOpacity: 0 },
    { arbitraryCss: 'position:fixed' },
  ]) {
    const f = await fixture('Ajuste o bloco da home.');
    assert.ok(
      (await f.tools.update_block.execute({ page: '', block: 'nav', props }))
        .error,
    );
    assert.equal(f.writes.length, 0);
  }
});

await test('edição geral conserva ajustes pontuais de marca sem liberar reconstrução', async () => {
  const f = await fixture('Mude a cor primária da marca para #183452.');
  assert.ok(f.tools.set_brand);
  for (const name of ['set_design', 'build_site', 'repair_site', 'set_blocks'])
    assert.equal(f.tools[name], undefined, name);
});

await test('site novo e pedido direto de reconstrução conservam o fluxo próprio', () => {
  assert.equal(editPolicyFor('Crie um site', []), undefined);
  assert.equal(editPolicyFor('Reconstrua o site do zero', baseline), undefined);
  assert.equal(
    editPolicyFor('Não reconstrua o site, apenas o menu', baseline).kind,
    'edit',
  );
  assert.equal(
    editPolicyFor('Mude somente o título do hero', baseline).kind,
    'edit',
  );
  const pages = [
    ...baseline,
    {
      ...baseline[0],
      slug: 'contato',
      blocks: [{ ...baseline[0].blocks[0], id: 'nav-contato' }],
    },
  ];
  assert.equal(editPolicyFor(request, pages).targets.length, 2);
  assert.equal(editPolicyFor(`${request} da home`, pages).targets.length, 1);
});
