import { createJiti } from 'jiti';
import { pageEditFixture } from './page-edit-fixture.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { landingFixture } = await j.import('./landing-data.ts');

export const landingFrameRequest =
  'Você pode remover esse container e deixar apenas a imagem? Eu não quero esse bg branco com essa borda dupla arredondada.';

export function landingFrameData(layout = 'stage') {
  const data = landingFixture(layout, 'steps');
  const hero = data.pages[0].blocks.find((block) => block.id === 'hero');
  hero.props.image = 'https://assets.test/landing-1.svg';
  hero.props.imageAlt =
    'Arte horizontal com uma mesa de madeira e o nome Linha Clara';
  hero.props.badges = [
    {
      label: '12 acabamentos disponíveis',
      evidence: '12 acabamentos disponíveis',
    },
  ];
  for (const page of data.pages) {
    page.publishedBlocks = structuredClone(page.blocks);
    page.publishedSeo = structuredClone(page.seo);
  }
  return data;
}

export const landingFrameOperations = [
  { op: 'set', block: 'hero', path: 'imagePresentation.frame', value: 'none' },
  { op: 'set', block: 'hero', path: 'imagePresentation.fit', value: 'natural' },
];

export function landingFrameFixture(
  layout = 'stage',
  text = landingFrameRequest,
) {
  const { tenant, pages } = landingFrameData(layout);
  return pageEditFixture(text, { initialTenant: tenant, initialPages: pages });
}
