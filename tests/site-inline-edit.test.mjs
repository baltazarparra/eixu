import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { inlineBlocks } from './helpers/inline-edit-data.mjs';
import { editTenant, editPages } from './helpers/page-edit-fixture.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { blockFields } = await j.import('../lib/blocks/fields.ts');
const { textStylesSchema } = await j.import(
  '../lib/blocks/text-style-schema.ts',
);
const { lintTextStyles, fieldBackgrounds } = await j.import(
  '../lib/blocks/text-style-lint.ts',
);
const { sectionBackgrounds } = await j.import(
  '../lib/blocks/section-colors.ts',
);
const { surfaceOf, themeVars } = await j.import('../lib/blocks/theme.ts');
const { RenderBlocks } = await j.import('../lib/blocks/render.tsx');
const { lintSite } = await j.import('../lib/taste/site.ts');
const { catalogForPrompt } = await j.import('../lib/blocks/registry.ts');
const blocks = inlineBlocks();
const render = (block, editing) =>
  renderToStaticMarkup(
    createElement(RenderBlocks, {
      blocks: [block],
      ctx: { tenant: editTenant, pagePath: '/', editing },
    }),
  );

await test('schema de estilos: passos, hexadecimal, duplicação, caminho e propriedades estritas', () => {
  assert.equal(
    textStylesSchema.safeParse([
      { field: 'items.0.title', size: 1, color: '#193f47' },
    ]).success,
    true,
  );
  for (const value of [
    [{ field: 'title' }],
    [{ field: 'title', size: 3 }],
    [{ field: 'title', color: 'red' }],
    [{ field: 'title', color: '#fff' }],
    [
      { field: 'title', size: 1 },
      { field: 'title', color: '#000000' },
    ],
    [{ field: '__proto__.x', size: 1 }],
    [{ field: 'title', css: 'display:none', size: 1 }],
    Array.from({ length: 41 }, (_, i) => ({
      field: `items.${i}.title`,
      size: 1,
    })),
  ])
    assert.equal(
      textStylesSchema.safeParse(value).success,
      false,
      JSON.stringify(value),
    );
  assert.match(catalogForPrompt(), /textStyles/);
});

for (const block of blocks)
  await test(`inventário e DOM têm os mesmos caminhos: ${block.type}`, () => {
    const fields = blockFields(block);
    const html = render(block, true);
    const paths = [
      ...new Set([...html.matchAll(/data-field="([^"]+)"/g)].map((m) => m[1])),
    ].sort();
    assert.deepEqual(paths, fields.map((f) => f.path).sort());
    assert.equal(
      fields.some((f) => /imageAlt|href|\.role$/.test(f.path)),
      false,
    );
    const publicHtml = render(block, false);
    assert.doesNotMatch(
      publicHtml,
      /data-field=|data-editing=|site-styled|contenteditable/,
    );
  });

await test('estilo local respeita campo, piso de leitura e contraste em todos os tons e vibes', () => {
  const intro = editPages()[0].blocks[2];
  for (const vibe of ['comercial', 'artistico', 'ousado', 'moderno']) {
    const brand = {
      ...editTenant.brand,
      vibe,
      ...(vibe === 'moderno' ? { paper: '#111111', ink: '#ffffff' } : {}),
    };
    for (const tone of ['paper', 'soft', 'ink', 'accent', 'secondary']) {
      const background = sectionBackgrounds({ tone }, brand)[0];
      assert.equal(background, surfaceOf(brand, tone));
      const block = structuredClone(intro);
      block.props.presentation = { tone };
      block.props.textStyles = [{ field: 'body', color: background }];
      assert.equal(
        lintTextStyles({ blocks: [block] }, brand)[0].rule,
        'texto-contraste',
      );
    }
    assert.deepEqual(sectionBackgrounds(undefined, brand), [
      ...new Set([themeVars(brand)['--paper'], themeVars(brand)['--surface']]),
    ]);
  }
  for (const style of [
    { field: 'body', size: -2 },
    { field: 'unknown', size: 1 },
    { field: 'presentation.tone', size: 1 },
  ]) {
    const block = structuredClone(intro);
    block.props.textStyles = [style];
    assert.ok(lintTextStyles({ blocks: [block] }, editTenant.brand).length);
  }
  const block = structuredClone(intro);
  block.props.presentation = { background: '#ffffff' };
  block.props.textStyles = [{ field: 'body', size: 1, color: '#193f47' }];
  assert.deepEqual(lintTextStyles({ blocks: [block] }, editTenant.brand), []);
  assert.match(
    render(block, false),
    /class="site-styled" data-color="true" data-scale="1" style="color:#193f47"/,
  );
  const cta = editPages()[0].blocks[4];
  cta.props.textStyles = [{ field: 'cta.label', color: '#ffffff' }];
  assert.ok(lintTextStyles({ blocks: [cta] }, editTenant.brand).length);
});

await test('publicação recebe as recusas de estilo e campos sobre fotos não recebem contraste inventado', () => {
  const page = editPages()[0];
  page.blocks[2].props.textStyles = [
    {
      field: 'body',
      color: fieldBackgrounds(page.blocks[2], 'body', editTenant.brand)[0],
    },
  ];
  assert.ok(
    lintSite([page], [], 'publish', editTenant.brand).some(
      (f) => f.rule === 'texto-contraste',
    ),
  );
  const cover = blocks.find((b) => b.type === 'hero.split');
  cover.props.layout = 'cover';
  assert.deepEqual(fieldBackgrounds(cover, 'headline', editTenant.brand), []);
});
