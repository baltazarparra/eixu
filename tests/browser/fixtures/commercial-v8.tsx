import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import {
  COMMERCIAL_V8_STRUCTURE_KEYS,
  SITE_STRUCTURES,
} from '@/lib/design/structures';
import type { DesignProfileInput } from '@/lib/design/profile';
import type { BlockInstance, Tenant } from '@/lib/types';

const image = (index: number) =>
  `https://assets.test/commercial-v8-${index}.svg`;

type CommercialStructure = (typeof COMMERCIAL_V8_STRUCTURE_KEYS)[number];

function fixtureTenant(structureKey: CommercialStructure): Tenant {
  const structure = SITE_STRUCTURES[structureKey];
  return {
    id: 'commercial-v8-fixture',
    slug: 'commercial-v8-fixture',
    name: 'Mercado da Praça',
    status: 'draft',
    maintenanceMode: 'generator',
    publicRuntime: 'generator',
    brand: {
      vibe: 'comercial',
      ink: '#17201b',
      paper: '#fffdf8',
      surface: '#f2f3ed',
      accent: '#245c3c',
      accentAlt: '#d7b879',
      highlight: '#d7b879',
      radius: 'sm',
      logoUrl: image(99),
      design: {
        version: 8,
        structure: structure.key,
        structureRationale: structure.intent,
        concept: 'O comércio apresentado por cenas simples e informação direta',
        signatureElement: 'Fotografia ampla entre blocos de leitura calma',
        displayFont: 'humanist',
        bodyFont: 'source',
        heroComposition: structure.openings[0].split(
          ':',
        )[1] as DesignProfileInput['heroComposition'],
        navigation: 'bar',
        rhythm: 'alternating',
        imageTreatment: 'full-bleed',
        surfaceStyle: 'flat',
        motif: 'none',
        signature: structure.key,
        definedAt: '2026-09-17T00:00:00.000Z',
      },
    },
    dials: { motion: 5, variance: 3, density: 5 },
    contacts: {
      phones: [{ number: '5514999999999', whatsapp: true }],
      addresses: [
        { label: 'Loja Centro', text: 'Rua da Praça, 100, Centro, Brotas' },
      ],
      social: [
        'https://www.instagram.com/mercadodapraca/',
        'https://www.facebook.com/mercadodapraca/',
      ],
    },
    whatsapp: '5514999999999',
    contactEmail: 'contato@mercadodapraca.test',
    ga4Id: null,
    metaPixelId: null,
    locale: 'pt-BR',
    brief: {},
    imageGuide: {},
  } as Tenant;
}

function propsFor(type: string, layout: string): Record<string, unknown> {
  switch (type) {
    case 'hero.split':
      return {
        layout,
        eyebrow: layout === 'brand' ? 'Mercado da Praça' : 'Perto de você',
        headline: 'Boas escolhas começam por perto',
        subtext: 'Conheça nossa história, categorias e formas de atendimento.',
        cta: { label: 'Ver categorias', href: '#categorias' },
        ...(layout === 'info'
          ? {}
          : {
              image: image(1),
              imageAlt: 'Fachada clara de um comércio de bairro',
            }),
      };
    case 'editorial.text':
      return {
        anchor: 'historia',
        layout,
        eyebrow: 'Nossa história',
        title: 'Um comércio que faz parte da rotina do bairro',
        body: 'O Mercado da Praça nasceu para deixar as compras do dia a dia mais simples. A equipe conhece a região e organiza o atendimento com proximidade.\n\nCada categoria é apresentada com clareza para ajudar as pessoas a encontrar o que procuram.',
      };
    case 'feature.bento':
      return {
        anchor: 'categorias',
        layout,
        eyebrow: 'Categorias',
        title: 'Encontre o que precisa',
        items: [1, 2, 3].map((item) => ({
          title: ['Hortifruti', 'Padaria', 'Mercearia'][item - 1],
          body: [
            'Frutas, verduras e legumes para a rotina da semana.',
            'Pães e preparos para diferentes momentos do dia.',
            'Itens essenciais organizados para uma escolha rápida.',
          ][item - 1],
          image: image(item + 1),
          imageAlt: [
            'Frutas e verduras organizadas em uma banca',
            'Pães frescos organizados sobre uma bancada',
            'Produtos de mercearia organizados em prateleiras',
          ][item - 1],
        })),
      };
    case 'social.follow':
      return {
        layout,
        eyebrow: 'Redes sociais',
        title: 'Acompanhe as novidades',
        body: 'Veja informações e novidades nos nossos perfis oficiais.',
        ...(layout === 'gallery'
          ? {
              images: [2, 3, 4].map((item) => ({
                src: image(item),
                alt: `Cena ${item - 1} do comércio`,
              })),
            }
          : {}),
      };
    case 'media.image':
      return {
        layout,
        src: image(5),
        alt: 'Vista ampla do interior do comércio com produtos organizados',
        ...(layout === 'immersive'
          ? {}
          : {
              caption: 'Um ambiente simples, organizado e pronto para receber.',
            }),
      };
    case 'form.lead':
      return {
        layout,
        title: 'Fale com a nossa equipe',
        body: 'Envie uma mensagem. Retornaremos pelos canais informados.',
        fields: [
          { name: 'nome', label: 'Nome', type: 'text', required: true },
          { name: 'email', label: 'E-mail', type: 'email', required: true },
          {
            name: 'mensagem',
            label: 'Mensagem',
            type: 'textarea',
            required: true,
          },
        ],
        submitLabel: 'Enviar mensagem',
        redirectTo: '/obrigado',
      };
    case 'media.map':
      return {
        layout,
        title: 'Onde estamos',
        address: 'Endereço substituído pelo cadastro',
        query: 'Endereço substituído pelo cadastro',
      };
    case 'footer.compact':
      return {
        layout,
        logoText: 'Mercado da Praça',
        tagline: 'Boas escolhas começam por perto.',
        links: [
          { label: 'Categorias', href: '#categorias' },
          { label: 'Contato', href: '#contato' },
        ],
        legal: 'Mercado da Praça. Todos os direitos reservados.',
      };
    default:
      throw new Error(`Bloco inesperado: ${type}`);
  }
}

function fixtureBlocks(structureKey: CommercialStructure): BlockInstance[] {
  const structure = SITE_STRUCTURES[structureKey];
  const marks = ['nav.bar:bar', ...structure.sequence, structure.footer!];
  return marks.map((mark, index) => {
    const [type, layout] = mark.split(':');
    return {
      id: `commercial-${index}`,
      type,
      props:
        type === 'nav.bar'
          ? {
              layout,
              logoText: 'Mercado da Praça',
              links: [
                { label: 'História', href: '#historia' },
                { label: 'Categorias', href: '#categorias' },
                { label: 'Onde estamos', href: '#onde-estamos' },
              ],
              cta: { label: 'Fale conosco', href: '#contato' },
            }
          : propsFor(type, layout),
    } as BlockInstance;
  });
}

export function CommercialV8Fixture({
  structureKey,
}: {
  structureKey: CommercialStructure;
}) {
  const structure = SITE_STRUCTURES[structureKey];
  const tenant = fixtureTenant(structureKey);
  return (
    <div
      className="site-theme"
      data-vibe="comercial"
      data-structure={structure.key}
      data-profile-version="8"
      data-design-version="8"
      data-motion="gentle"
      data-hero={tenant.brand.design?.heroComposition}
      style={themeVars(tenant.brand)}
    >
      <RenderBlocks
        blocks={fixtureBlocks(structureKey)}
        ctx={{ tenant, pagePath: '/', isPreview: true, pageType: 'page' }}
      />
    </div>
  );
}

if (typeof document !== 'undefined') {
  const requested = new URLSearchParams(location.search).get('structure');
  const structureKey = COMMERCIAL_V8_STRUCTURE_KEYS.includes(
    requested as CommercialStructure,
  )
    ? (requested as CommercialStructure)
    : COMMERCIAL_V8_STRUCTURE_KEYS[0];
  hydrateRoot(
    document.getElementById('root')!,
    <CommercialV8Fixture structureKey={structureKey} />,
  );
}
