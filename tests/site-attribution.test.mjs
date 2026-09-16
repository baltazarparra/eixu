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
const { RenderBlocks } = await j.import('../lib/blocks/render.tsx');
const { themeVars } = await j.import('../lib/blocks/theme.ts');
const { contrastRatio } = await j.import('../lib/blocks/contrast.ts');
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const { attributionRemovalRequested } = await j.import(
  '../lib/ai/edit-policy.ts',
);

const footer = {
  id: 'rodape-cliente',
  type: 'footer.compact',
  props: { logoText: 'Cliente', legal: 'Direitos do cliente' },
};
const tenant = (vibe, version = 6) => ({
  id: 'tenant-teste',
  slug: 'tenant-teste',
  name: 'Cliente',
  brand: {
    vibe,
    ink: '#1f2937',
    paper: '#f8fafc',
    accent: '#116a70',
    design: version ? { version } : undefined,
  },
  contacts: { phones: [], addresses: [], emails: [] },
  whatsapp: null,
  dials: { motion: 1, density: 5, variance: 5 },
});

function render(blocks, ctx = {}) {
  return renderToStaticMarkup(
    createElement(RenderBlocks, {
      blocks,
      ctx: {
        tenant: tenant('comercial'),
        pagePath: '/',
        pageType: 'page',
        ...ctx,
      },
    }),
  );
}

await test('faixa única encerra o fluxo depois dos blocos e preserva o rodapé do cliente', () => {
  const blocks = [
    footer,
    {
      id: 'texto-posterior',
      type: 'editorial.text',
      props: {
        title: 'Texto posterior ao rodapé',
        body: 'Este conteúdo salvo também precede a moldura da plataforma.',
      },
    },
  ];
  const before = structuredClone(blocks);
  const html = render(blocks);
  assert.equal((html.match(/class="site-attribution"/g) ?? []).length, 1);
  assert.equal((html.match(/<footer\b/g) ?? []).length, 1);
  assert.ok(
    html.indexOf('Direitos do cliente') < html.indexOf('site-attribution'),
  );
  assert.ok(
    html.indexOf('Texto posterior ao rodapé') <
      html.indexOf('site-attribution'),
  );
  assert.match(html, /Desenvolvido e hospedado por eixu\.com\.br/);
  assert.match(html, /href="https:\/\/eixu\.com\.br"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer nofollow"/);
  assert.match(html, /aria-label="[^"]*eixu\.com\.br \(abre em nova aba\)"/);
  assert.match(html, /site-attribution-brand" aria-hidden="true"/);
  assert.doesNotMatch(html, /<footer[^>]*site-attribution/);
  assert.deepEqual(blocks, before);
  assert.equal(Object.hasOwn(blockSchemas, 'site.attribution'), false);
});

await test('páginas sem rodapé, posts e obrigado exibem a moldura em público, prévia e edição', () => {
  for (const pageType of ['page', 'post', 'paid_lp', 'thank_you']) {
    for (const mode of [
      { isPreview: false, editing: false },
      { isPreview: true, editing: false },
      { isPreview: true, editing: true },
    ]) {
      const html = render([], { pageType, ...mode });
      assert.equal((html.match(/class="site-attribution"/g) ?? []).length, 1);
      assert.equal((html.match(/<footer\b/g) ?? []).length, 0);
      assert.ok(html.indexOf('</main>') < html.indexOf('site-attribution'));
      assert.doesNotMatch(html, /data-block="site\.attribution"/);
    }
  }
});

await test('vibes e perfis legados usam a mesma assinatura sem alterar snapshots', () => {
  for (const vibe of [
    'comercial',
    'moderno',
    'artistico',
    'ousado',
    'landing',
  ]) {
    for (const version of vibe === 'landing' ? [7] : [2, 3, 4, 5, 6]) {
      const currentTenant = tenant(vibe, version);
      const page = {
        blocks: [structuredClone(footer)],
        publishedBlocks: [structuredClone(footer)],
        publishedSeo: { title: 'Cliente', description: 'Descrição.' },
      };
      const before = structuredClone(page);
      const html = render(page.publishedBlocks, {
        tenant: currentTenant,
        pageType: vibe === 'landing' ? 'thank_you' : 'page',
      });
      assert.equal((html.match(/class="site-attribution"/g) ?? []).length, 1);
      assert.deepEqual(page, before);
    }
  }
});

await test('token da assinatura mantém contraste AA inclusive com tinta ilegível', () => {
  for (const paper of ['#ffffff', '#777777', '#0b0b0f', '#f8fafc']) {
    const vars = themeVars({ paper, ink: paper, accent: '#116a70' });
    assert.ok(
      contrastRatio(vars['--attribution-ink'], vars['--brand-paper']) >= 4.5,
      paper,
    );
  }
});

await test('pedido de remoção da assinatura é distinto do rodapé do cliente', () => {
  for (const request of [
    'Remova a assinatura EIXU do site.',
    'Tire a faixa Desenvolvido e hospedado por eixu.com.br.',
    'Apague o link da eixu.com.br no rodapé.',
  ])
    assert.equal(attributionRemovalRequested(request), true, request);
  for (const request of [
    'Remova o rodapé do cliente.',
    'Não remova a assinatura da EIXU.',
    'Troque a cor da assinatura da EIXU.',
    'Remova EIXU do texto da proposta.',
  ])
    assert.equal(attributionRemovalRequested(request), false, request);
});
