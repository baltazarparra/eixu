import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { SignatureComposition } = await jiti.import(
  '../lib/blocks/components.tsx',
);
const { blockSchemas } = await jiti.import('../lib/blocks/registry.ts');

/** Composição de assinatura como a da home comercial: um focus e três apoios. */
const props = {
  layout: 'service-lens',
  title: 'Variedade para o seu lar',
  body: 'Produtos frescos todos os dias e economia real para a compra da família.',
  items: [
    {
      role: 'focus',
      title: 'Seleção diária de hortifrúti fresco',
      body: 'Frutas, verduras e legumes repostos com frequência na bancada.',
      image: 'https://assets.test/hortifruti.webp',
      imageAlt: 'Bancada iluminada de hortifrúti com frutas selecionadas',
    },
    {
      role: 'support',
      title: 'Açougue com cortes selecionados',
      body: 'Carnes preparadas com higiene para as refeições da semana.',
    },
    {
      role: 'detail',
      title: 'Mercearia abastecida',
      body: 'Itens essenciais com preço para completar as compras do mês.',
    },
  ],
};

await test('o destaque integral é do schema da composição, sem trocar tipo ou layout', () => {
  const parsed = blockSchemas['signature.composition'].safeParse({
    ...props,
    arrangement: 'focus-full',
  });
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  assert.equal(parsed.data.layout, 'service-lens');
  const html = renderToStaticMarkup(
    createElement(SignatureComposition, { ...props, arrangement: 'focus-full' }),
  );
  assert.match(html, /data-arrangement="focus-full"/);
  assert.match(html, /site-signature-service-lens/);
  assert.match(html, /data-role="focus"/);
  // Sem o arranjo, nada muda no HTML da seção.
  const plain = renderToStaticMarkup(
    createElement(SignatureComposition, props),
  );
  assert.doesNotMatch(plain, /data-arrangement/);
});

await test('o CSS do arranjo dá largura total ao focus e distribui o resto em colunas', () => {
  const css = readFileSync(
    new URL('../app/(sites)/creative.css', import.meta.url),
    'utf8',
  );
  const scoped = css.slice(
    css.indexOf(".site-signature[data-arrangement='focus-full']"),
  );
  assert.match(scoped, /column-span: all/);
  assert.match(scoped, /columns: 2/);
  assert.match(scoped, /columns: 3/);
  assert.match(scoped, /@media \(min-width: 768px\)/);
});
