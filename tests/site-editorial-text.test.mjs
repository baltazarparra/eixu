import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const { EditorialText } = await j.import('../lib/blocks/components.tsx');
const { blockImageUrls } = await j.import('../lib/taste/metrics.ts');
const { expectedRatio } = await j.import('../lib/images/ratios.ts');
const { blockFields } = await j.import('../lib/blocks/fields.ts');
const { fieldBackgrounds } = await j.import('../lib/blocks/text-style-lint.ts');
const { themeVars } = await j.import('../lib/blocks/theme.ts');
const props = {
  title: 'Loja Brotas',
  lead: 'Rua da Praça, 100',
  body: 'Um lugar para as compras do dia a dia.\n\nConheça os setores e encontre os produtos para a semana.',
};
const image = {
  image: 'https://assets.test/fachada.webp',
  imageAlt: 'Fachada real do comércio',
};
const block = (p) => ({ id: 'intro', type: 'editorial.text', props: p });

await test('texto legado continua válido e novos layouts não permitem imagens ocultas', () => {
  const schema = blockSchemas['editorial.text'].strict();
  for (const layout of [undefined, 'narrow', 'lead', 'columns', 'bridge']) {
    assert.equal(schema.safeParse({ ...props, layout }).success, true);
    assert.equal(
      schema.safeParse({ ...props, layout, ...image }).success,
      false,
    );
  }
  assert.equal(
    schema.safeParse({ ...props, layout: 'split', ...image }).success,
    true,
  );
  for (const p of [
    { ...props, layout: 'split' },
    { ...props, layout: 'split', image: image.image },
    { ...props, layout: 'split', ...image, imageAlt: '   ' },
    { ...props, layout: 'split', ...image, image: 'javascript:alert(1)' },
    { ...props, layout: 'bridge', title: '' },
  ])
    assert.equal(schema.safeParse(p).success, false, JSON.stringify(p));
  assert.deepEqual(
    blockImageUrls(block({ ...props, layout: 'split', ...image })),
    [image.image],
  );
  assert.deepEqual(
    blockImageUrls(block({ ...props, layout: 'lead', ...image })),
    [],
  );
  assert.equal(expectedRatio('editorial.text', 'split'), '4:3');
});

await test('introdução e foto preservam os parágrafos no HTML e a edição dos campos', () => {
  for (const layout of ['bridge', 'split']) {
    const p = { ...props, layout, ...(layout === 'split' ? image : {}) };
    const markup = renderToStaticMarkup(
      createElement(EditorialText, { ...p, editing: true }),
    );
    assert.match(markup, /Loja Brotas/);
    assert.match(markup, /Rua da Praça, 100/);
    assert.match(markup, /Conheça os setores/);
    assert.doesNotMatch(markup, /<button|<a /);
    assert.equal(markup.includes('site-text-identity'), layout === 'bridge');
    assert.equal(markup.includes('<img'), layout === 'split');
    assert.deepEqual(
      blockFields(block(p)).map((field) => field.path),
      ['title', 'lead', 'body'],
    );
  }
  const brand = {
    vibe: 'comercial',
    accent: '#183e84',
    paper: '#ffffff',
    ink: '#18222d',
  };
  const intro = block({ ...props, layout: 'bridge' });
  for (const field of ['title', 'lead'])
    assert.deepEqual(fieldBackgrounds(intro, field, brand), [
      themeVars(brand)['--accent'],
    ]);
  assert.ok(
    !fieldBackgrounds(intro, 'body', brand).includes(
      themeVars(brand)['--accent'],
    ),
  );
});
