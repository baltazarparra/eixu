import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { RenderBlocks } = await j.import('../lib/blocks/render.tsx');
const { editPolicyFor, scopedUpdateError } = await j.import(
  '../lib/ai/edit-policy.ts',
);
const { applyPageEdit, pageRevision } = await j.import(
  '../lib/ai/page-edits.ts',
);
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const { elementStyleCss } = await j.import('../lib/blocks/element-style.ts');

const nav = () => ({
  id: 'nav-1',
  type: 'nav.bar',
  props: blockSchemas['nav.bar'].parse({
    layout: 'bar',
    logoText: 'Mercado da Praça',
    links: [{ label: 'Setores', href: '#setores' }],
    cta: { label: 'Falar no WhatsApp', href: '/go/wa' },
  }),
});
const hero = () => ({
  id: 'hero-1',
  type: 'hero.split',
  props: blockSchemas['hero.split'].parse({
    layout: 'brand',
    headline: 'Supermercado do bairro',
    image: 'https://assets.test/fachada.webp',
    imageAlt: 'Fachada com letreiro',
    cta: { label: 'Ver ofertas', href: '#ofertas' },
  }),
});
const page = () => ({
  slug: '',
  type: 'page',
  title: 'Home',
  blocks: [nav(), hero()],
  seo: {},
});
const brand = { vibe: 'comercial', design: { version: 8 } };
const tenant = {
  id: 't',
  slug: 'mercado',
  name: 'Mercado da Praça',
  brand: {
    vibe: 'comercial',
    logoUrl: null,
    design: { version: 8, heroComposition: 'brand', navigation: 'bar' },
  },
  brief: {},
  dials: { variance: 4, motion: 0, density: 5 },
  contacts: { phones: [], addresses: [], social: [] },
  whatsapp: null,
  contactEmail: null,
  locale: 'pt-BR',
};
const apply = (operations, policy) =>
  applyPageEdit(
    page(),
    { page: '', revision: pageRevision(page()), operations },
    policy,
    brand,
  );

/**
 * Um ajuste de cabeçalho restrito ao mobile só cabe em presentation.elements,
 * o único campo do schema com recorte por viewport. A política de cabeçalho o
 * excluía, então o pedido não tinha caminho nenhum e voltava como "campos fora
 * do pedido" — um limite de política lido pelo operador como defeito.
 */
await test('a política de cabeçalho aceita um fundo recortado por tela', () => {
  const policy = editPolicyFor(
    'mude a cor de fundo do header no mobile para #1d4ed8',
    [page()],
    '',
  );
  assert.equal(policy.kind, 'navigation-style');
  const result = apply(
    [
      {
        op: 'set',
        block: 'nav-1',
        path: 'presentation.elements',
        value: [
          { target: 'section', viewport: 'mobile', background: '#1d4ed8' },
        ],
      },
    ],
    policy,
  );
  assert.match(
    result.summary.join(' '),
    /menu superior/i,
    'a edição precisa ser aceita e resumida',
  );
});

await test('a política de cabeçalho não vira reescrita de layout', () => {
  const policy = editPolicyFor(
    'mude a cor de fundo do header no mobile',
    [page()],
    '',
  );
  const block = nav();
  const error = scopedUpdateError(policy, '', block, {
    ...block.props,
    presentation: {
      elements: [{ target: 'section', viewport: 'mobile', columns: 3 }],
    },
  });
  assert.match(
    error ?? '',
    /presentation\.elements\.0\.columns/,
    'medidas e colunas continuam fora de um pedido de estilo',
  );
});

/**
 * O quadro que mede a barra interpõe duas divs entre o bloco e o <header>.
 * O seletor de seção parava nelas: o ajuste era salvo, o chat confirmava e a
 * barra não mudava.
 */
await test('o alvo de seção alcança a navegação através do quadro', () => {
  const css = elementStyleCss('b0', [
    { target: 'section', viewport: 'mobile', background: '#1d4ed8' },
  ]);
  assert.match(
    css ?? '',
    /\.site-navigation-frame > \.site-navigation-content > :is\(header, nav\)/,
    'sem este caminho o ajuste de seção não casa com o cabeçalho',
  );
  assert.match(css ?? '', /@media \(max-width: 767px\)/);
});

/**
 * A cor da marca é o padrão da Comercial v8, não uma trava: a regra lia
 * --commercial-blue do tema e descartava o --paper escolhido pelo operador,
 * enquanto o chat confirmava a troca com o contraste calculado.
 */
await test('a Comercial v8 honra a cor de fundo escolhida no cabeçalho', async () => {
  const css = await readFile('app/(sites)/commercial.css', 'utf8');
  assert.match(
    css,
    /\.site-block\[data-block='nav\.bar'\]\[data-tone='custom'\]\s*\.site-nav\s*{[^}]*background:\s*var\(--paper\)/,
    'a barra precisa usar a cor do operador quando ela existe',
  );
  assert.match(
    css,
    /\.site-block\[data-block='nav\.bar'\]\[data-tone='custom'\]\s*\.site-nav-link\s*{[^}]*color:\s*var\(--ink\)/,
    'o texto do menu precisa seguir o contraste calculado, não o branco fixo',
  );
});

/**
 * A vibe precisa sair da frente só onde a cor do operador vale. Uma primeira
 * versão publicou a marca sem viewport e apagou a cor da marca no desktop por
 * causa de um ajuste que existia apenas no mobile.
 */
await test('a superfície publicada carrega o viewport do ajuste', () => {
  const marcado = (elements) => {
    const html = renderToString(
      createElement(RenderBlocks, {
        blocks: [
          {
            ...nav(),
            props: blockSchemas['nav.bar'].parse({
              ...nav().props,
              presentation: { elements },
            }),
          },
          hero(),
        ],
        ctx: {
          tenant,
          pagePath: '/',
          isPreview: true,
          pageType: 'page',
        },
      }),
    );
    return (
      html
        .match(/data-block="nav\.bar"[^>]*/)?.[0]
        .match(/data-element-surface="([^"]*)"/)?.[1] ?? null
    );
  };
  assert.equal(
    marcado([{ target: 'section', viewport: 'mobile', background: '#1d4ed8' }]),
    'mobile',
  );
  assert.equal(
    marcado([
      { target: 'section', viewport: 'desktop', background: '#1d4ed8' },
    ]),
    'desktop',
  );
  assert.equal(
    marcado([{ target: 'section', viewport: 'mobile', justify: 'center' }]),
    null,
    'um ajuste sem cor não pode desligar a cor da marca',
  );
  assert.equal(
    marcado([
      { target: 'container', viewport: 'mobile', background: '#1d4ed8' },
    ]),
    null,
    'só a seção pinta a barra; o container é a linha interna',
  );
});

await test('a marca sobrevive na largura que o ajuste não cobre', async () => {
  const css = await readFile('app/(sites)/commercial.css', 'utf8');
  assert.match(
    css,
    /@media \(min-width: 768px\)[\s\S]*?data-element-surface~='mobile'[\s\S]*?--commercial-blue/,
    'uma cor só do mobile precisa deixar o desktop na cor da marca',
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?data-element-surface~='desktop'[\s\S]*?--commercial-blue/,
    'uma cor só do desktop precisa deixar o mobile na cor da marca',
  );
});

await test('uma cor de fundo sem recorte de tela continua aceita', () => {
  const policy = editPolicyFor(
    'mude a cor de fundo do header para #1d4ed8',
    [page()],
    '',
  );
  const result = apply(
    [
      {
        op: 'set',
        block: 'nav-1',
        path: 'presentation.background',
        value: '#1d4ed8',
      },
    ],
    policy,
  );
  assert.match(result.summary.join(' '), /#1d4ed8/);
});
