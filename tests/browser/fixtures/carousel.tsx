import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import type { BlockInstance, Tenant } from '@/lib/types';
import type { Vibe } from '@/lib/design/vibes';

const photo = (name: string) => `https://assets.test/carousel-${name}.svg`;
const additionalSlides = (prefix: string) =>
  [2, 3, 4].map((number) => ({
    src: photo(`${prefix}-${number}`),
    alt: `Foto ${number} do produto em um ambiente iluminado`,
    caption: `Legenda ${number}`,
  }));

export function carouselTenant(vibe: Vibe): Tenant {
  return {
    id: 'carousel-fixture',
    slug: 'carousel-fixture',
    name: 'Coleção de teste',
    brand: {
      vibe,
      ink: '#18201d',
      paper: '#fffdf8',
      surface: '#f0eee6',
      accent: '#a94932',
      accentAlt: '#d3b663',
      highlight: '#a94932',
      radius: 'md',
    },
    dials: { motion: 5, variance: 5, density: 5 },
    contacts: {},
    brief: {},
    imageGuide: {},
    whatsapp: null,
    contactEmail: null,
  } as Tenant;
}

function heroLanding(autoplay: boolean): BlockInstance {
  return {
    id: 'landing-carousel',
    type: 'hero.landing',
    props: {
      layout: 'stage',
      eyebrow: 'Coleção em contexto',
      headline: 'Veja o produto por todos os ângulos',
      subtext: 'Quatro fotos mostram detalhes, escala e acabamento.',
      cta: { label: 'Conhecer a coleção', href: '#galeria' },
      image: photo('landing-1'),
      imageAlt: 'Produto principal em um ambiente iluminado',
      slides: additionalSlides('landing'),
      carousel: { autoplay, interval: 4 },
    },
  };
}

function splitCarousel(
  layout: 'split' | 'poster' | 'editorial' | 'offset',
): BlockInstance {
  return {
    id: `split-${layout}`,
    type: 'hero.split',
    props: {
      layout,
      eyebrow: `Composição ${layout}`,
      headline: `Uma abertura ${layout} com mais de uma foto`,
      subtext: 'A mídia muda sem reconstruir o conteúdo da abertura.',
      cta: { label: 'Ver detalhes', href: '#galeria' },
      image: photo(`${layout}-1`),
      imageAlt: `Produto na primeira foto da composição ${layout}`,
      imageCaption: `Primeira legenda de ${layout}`,
      slides: additionalSlides(layout),
      focalPoint: 'right',
    },
  };
}

function galleryCarousel(): BlockInstance {
  return {
    id: 'gallery-carousel',
    type: 'media.gallery',
    props: {
      anchor: 'galeria',
      layout: 'carousel',
      title: 'Detalhes da coleção',
      images: [1, 2, 3, 4].map((number) => ({
        src: photo(`gallery-${number}`),
        alt: `Detalhe ${number} da coleção fotografada`,
        caption: `Detalhe ${number}`,
      })),
    },
  };
}

export function carouselBlocks(
  mode: 'all' | 'landing' | 'plain' = 'all',
  autoplay = false,
): BlockInstance[] {
  if (mode === 'plain')
    return [
      {
        id: 'plain',
        type: 'hero.statement',
        props: {
          headline: 'Uma abertura sem carrossel',
          subtext: 'Esta rota mede o carregamento do motor interativo.',
          cta: { label: 'Continuar', href: '#conteudo' },
        },
      },
    ];
  if (mode === 'landing') return [heroLanding(autoplay)];
  return [
    heroLanding(autoplay),
    ...(['split', 'poster', 'editorial', 'offset'] as const).map(splitCarousel),
    galleryCarousel(),
  ];
}

export function CarouselFixture({
  vibe = 'comercial',
  editing = false,
  mode = 'all',
  autoplay = false,
  still = false,
}: {
  vibe?: Vibe;
  editing?: boolean;
  mode?: 'all' | 'landing' | 'plain';
  autoplay?: boolean;
  still?: boolean;
}) {
  const tenant = carouselTenant(vibe);
  return (
    <div
      className="site-theme"
      data-vibe={vibe}
      data-motion={still || editing ? 'still' : 'expressive'}
      data-editing={editing ? 'true' : undefined}
      style={themeVars(tenant.brand)}
    >
      <RenderBlocks
        blocks={carouselBlocks(mode, autoplay)}
        ctx={{
          tenant,
          pagePath: '/',
          pageType: 'page',
          isPreview: true,
          editing,
        }}
      />
    </div>
  );
}

if (typeof document !== 'undefined') {
  const params = new URLSearchParams(location.search);
  hydrateRoot(
    document.getElementById('root')!,
    <CarouselFixture
      vibe={(params.get('vibe') as Vibe) || 'comercial'}
      editing={params.get('edit') === '1'}
      mode={(params.get('mode') as 'all' | 'landing' | 'plain') || 'all'}
      autoplay={params.get('autoplay') === '1'}
      still={params.get('still') === '1'}
    />,
  );
}
