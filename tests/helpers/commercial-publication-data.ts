import { landingFixture } from './landing-data';

/** Versão válida escolhida pelo operador, fora da composição padrão da v8. */
export function commercialPublicationFixture() {
  const fixture = landingFixture();
  fixture.tenant.brand.vibe = 'comercial';
  fixture.tenant.brand.design = {
    ...fixture.tenant.brand.design!,
    version: 8,
    structure: 'comercial-marca',
    structureRationale: 'Uma composição aprovada pelo operador.',
    heroComposition: 'brand',
    navigation: 'bar',
  };
  const hero = fixture.pages[0].blocks.find(
    (block) => block.type === 'hero.landing',
  )!;
  hero.type = 'hero.split';
  hero.props = {
    layout: 'brand',
    headline: hero.props.headline,
    subtext: hero.props.subtext,
    cta: hero.props.cta,
    image: hero.props.image,
    imageAlt: hero.props.imageAlt,
  };
  // A origem e o texto da ilustração permanecem honestos após publicar.
  fixture.images[0].model = 'generated-fixture';
  return fixture;
}
