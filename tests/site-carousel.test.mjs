import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { blockSchemas, catalogForPrompt, imageLayouts } = await j.import(
  '../lib/blocks/registry.ts',
);
const { blockImageUrls, structuralFindings } = await j.import(
  '../lib/taste/metrics.ts',
);
const { SiteCarousel } = await j.import('../lib/blocks/ui/carousel.tsx');

const urls = [4, 6, 7, 8, 9, 10, 11].map(
  (number) => `https://assets.test/foto-${number}.webp`,
);
const slide = (index) => ({
  src: urls[index],
  alt: `Foto ${index + 1} do produto em ambiente real`,
  caption: `Legenda ${index + 1}`,
});
const landing = {
  layout: 'stage',
  headline: 'Um produto visto por todos os ângulos',
  subtext: 'Compare detalhes e acabamentos antes de conversar com a equipe.',
  cta: { label: 'Falar com a equipe', href: '/go/wa?from=/' },
  image: urls[0],
  imageAlt: 'Produto principal em ambiente iluminado',
  slides: [slide(1), slide(2), slide(3)],
};
const split = {
  layout: 'split',
  headline: 'Materiais para cada ambiente',
  subtext: 'Veja os acabamentos em diferentes aplicações.',
  cta: { label: 'Ver materiais', href: '/materiais' },
  image: urls[0],
  imageAlt: 'Material aplicado em uma bancada clara',
  slides: [slide(1), slide(2)],
};

await test('schemas aceitam somente as composições e limites previstos', () => {
  assert.equal(blockSchemas['hero.landing'].safeParse(landing).success, true);
  const form = blockSchemas['hero.landing'].safeParse({
    ...landing,
    layout: 'form',
    form: {
      title: 'Converse com a equipe',
      fields: [
        { name: 'nome', label: 'Nome', type: 'text' },
        { name: 'email', label: 'E-mail', type: 'email' },
      ],
    },
  });
  assert.equal(form.success, false);
  assert.match(form.error.message, /media\.gallery.*carousel/);

  for (const layout of ['split', 'poster', 'editorial', 'offset'])
    assert.equal(
      blockSchemas['hero.split'].safeParse({ ...split, layout }).success,
      true,
      layout,
    );
  for (const layout of ['cover', 'atelier']) {
    const result = blockSchemas['hero.split'].safeParse({ ...split, layout });
    assert.equal(result.success, false, layout);
    assert.match(result.error.message, /media\.gallery.*carousel/);
  }
  assert.equal(
    blockSchemas['hero.split'].safeParse({ ...split, layout: undefined })
      .success,
    false,
  );
  assert.equal(
    blockSchemas['hero.landing'].safeParse({
      ...landing,
      slides: Array.from({ length: 6 }, (_, index) => slide(index + 1)),
    }).success,
    false,
  );
  assert.equal(
    blockSchemas['hero.landing'].safeParse({
      ...landing,
      slides: [{ ...slide(1), alt: 'curt' }],
    }).success,
    false,
  );
  assert.equal(
    blockSchemas['hero.landing'].safeParse({
      ...landing,
      carousel: { autoplay: true, interval: 4 },
    }).success,
    true,
  );
  assert.equal(
    blockSchemas['hero.landing'].safeParse({
      ...landing,
      carousel: { autoplay: true, interval: 3 },
    }).success,
    false,
  );
  assert.equal(
    blockSchemas['media.gallery'].safeParse({
      layout: 'carousel',
      title: 'Detalhes do produto',
      images: [slide(0), slide(1)],
    }).success,
    true,
  );
});

const image = (index, ratio = '1:1') => ({
  id: `image-${index}`,
  seq: Number(urls[index].match(/(\d+)/)?.[1] ?? index),
  kind: 'foto',
  ratio,
  model: 'upload',
  status: 'disponivel',
  url: urls[index],
  blobPath: `tenants/carousel/uploads/foto-${index}.webp`,
  critique: {},
  targetBlock: 'livre',
  requestText: 'fixture',
  referenceUrls: [],
  batchId: '',
  score: null,
  alt: null,
  description: null,
  createdAt: '2026-09-13T00:00:00Z',
});
const pageWith = (props, type = 'hero.landing') => ({
  slug: '',
  type: 'page',
  title: 'Início',
  seo: {
    title: 'Produto em diferentes ângulos',
    description: 'Conheça materiais, acabamentos e aplicações do produto.',
    noindex: true,
  },
  meta: {},
  blocks: [{ id: 'hero', type, props }],
});

await test('slides participam de imagens, proporção e apresentação inteira', () => {
  const parsed = blockSchemas['hero.landing'].parse(landing);
  assert.deepEqual(
    blockImageUrls({ id: 'hero', type: 'hero.landing', props: parsed }),
    [urls[0], urls[1], urls[2], urls[3]],
  );
  const photos = [0, 1, 2, 3].map((index) => image(index));
  const cropped = structuralFindings([pageWith(parsed)], photos).filter(
    (finding) => finding.rule === 'imagem-proporcao',
  );
  assert.equal(cropped.length, 4);
  assert.equal(
    cropped.every((finding) => finding.level === 'warn'),
    true,
  );
  assert.deepEqual(
    cropped.map((finding) => finding.message.match(/#\d+/)?.[0]),
    ['#4', '#6', '#7', '#8'],
  );
  assert.equal(
    structuralFindings([pageWith(parsed)], photos).some(
      (finding) => finding.rule === 'home-protagonista',
    ),
    true,
    'o carrossel do hero não substitui sozinho a seção protagonista',
  );
  const wholeLanding = blockSchemas['hero.landing'].parse({
    ...landing,
    imagePresentation: { fit: 'contain' },
  });
  assert.equal(
    structuralFindings([pageWith(wholeLanding)], photos).some(
      (finding) => finding.rule === 'imagem-proporcao',
    ),
    false,
  );
  const wholeSplit = blockSchemas['hero.split'].parse({
    ...split,
    imageFit: 'contain',
  });
  assert.equal(
    structuralFindings(
      [pageWith(wholeSplit, 'hero.split')],
      photos.slice(0, 3),
    ).some((finding) => finding.rule === 'imagem-proporcao'),
    false,
  );
});

await test('catálogo ensina o carrossel sem oferecer troca de layout do hero', () => {
  const catalog = catalogForPrompt();
  assert.match(catalog, /hero\.landing[^\n]+carrossel/);
  assert.match(catalog, /hero\.split[^\n]+slides/);
  assert.match(catalog, /media\.gallery[^\n]+carousel/);
  assert.deepEqual(imageLayouts('hero.landing'), []);
  assert.deepEqual(imageLayouts('hero.split'), []);
});

await test('HTML estático preserva todas as fotos, rótulos e prioridade inicial', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteCarousel, {
      label: 'Fotos da abertura',
      slides: [slide(0), slide(1), slide(2)],
      width: 1600,
      height: 900,
    }),
  );
  assert.match(html, /aria-roledescription="carrossel"/);
  assert.match(html, /aria-label="Foto 1 de 3"/);
  assert.match(html, /aria-label="Foto 3 de 3"/);
  assert.match(html, /fetchPriority="high"/);
  assert.match(html, /data-fit="cover"/);
  assert.equal((html.match(/loading="eager"/g) ?? []).length, 2);
  assert.equal((html.match(/loading="lazy"/g) ?? []).length, 1);
  for (const url of urls.slice(0, 3)) assert.match(html, new RegExp(url));
});
