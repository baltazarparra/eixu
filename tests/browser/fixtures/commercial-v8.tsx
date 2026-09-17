import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import {
  COMMERCIAL_V8_STRUCTURE_KEYS,
  SITE_STRUCTURES,
} from '@/lib/design/structures';
import {
  COMMERCIAL_AREAS,
  COMMERCIAL_VARIANTS,
  commercialFooter,
  commercialSequence,
  resolveCommercialVariants,
  type CommercialVariantKeys,
} from '@/lib/design/commercial-variants';
import type { DesignProfileInput } from '@/lib/design/profile';
import type { BlockInstance, Tenant } from '@/lib/types';

const image = (index: number) =>
  `https://assets.test/commercial-v8-${index}.svg`;

type CommercialStructure = (typeof COMMERCIAL_V8_STRUCTURE_KEYS)[number];

/** `abertura:abertura-painel,setores:setores-lista` vira a seleção do perfil. */
export function parseVariants(
  value: string | null,
): Partial<CommercialVariantKeys> | undefined {
  if (!value) return undefined;
  const keys: Partial<CommercialVariantKeys> = {};
  for (const pair of value.split(',')) {
    const [area, key] = pair.split(':');
    if (
      (COMMERCIAL_AREAS as readonly string[]).includes(area!) &&
      COMMERCIAL_VARIANTS[area as keyof typeof COMMERCIAL_VARIANTS].some(
        (variant) => variant.key === key,
      )
    )
      keys[area as keyof CommercialVariantKeys] = key;
  }
  return Object.keys(keys).length ? keys : undefined;
}

function fixtureTenant(
  structureKey: CommercialStructure,
  variants?: Partial<CommercialVariantKeys>,
): Tenant {
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
        ...(variants ? { commercialVariants: variants } : {}),
        definedAt: '2026-09-17T00:00:00.000Z',
      },
    },
    dials: { motion: 5, variance: 3, density: 5 },
    contacts: {
      phones: [{ number: '5514999999999', whatsapp: true }],
      addresses: [
        {
          label: 'Loja Brotas',
          text: 'Rua da Praça, 100, Centro, Brotas',
          phone: '(14) 3653-4185',
          hours: 'Segunda a sábado, 8h às 21h. Domingo, 8h às 18h.',
        },
        {
          label: 'Loja Dois Córregos',
          text: 'Avenida Central, 1055, Centro, Dois Córregos',
          phone: '(14) 3652-9466',
          hours: 'Segunda a sábado, 8h às 21h. Domingo, 8h às 18h.',
        },
        {
          label: 'Loja Mineiros do Tietê',
          text: 'Rua do Comércio, 319, Centro, Mineiros do Tietê',
          phone: '(14) 3646-9900',
          hours: 'Segunda a sábado, 8h às 21h. Domingo, 8h às 18h.',
        },
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

const SETORES = [
  ['Hortifruti', 'Frutas, verduras e legumes para a rotina da semana.'],
  ['Padaria', 'Pães e preparos para diferentes momentos do dia.'],
  ['Mercearia', 'Itens essenciais organizados para uma escolha rápida.'],
  ['Açougue', 'Cortes selecionados e atendimento próximo.'],
  ['Bebidas', 'Opções para acompanhar refeições e encontros.'],
  ['Frios', 'Queijos, presuntos e acompanhamentos para o dia a dia.'],
] as const;

const SETOR_ALT = [
  'Frutas e verduras organizadas em uma banca',
  'Pães frescos organizados sobre uma bancada',
  'Produtos de mercearia organizados em prateleiras',
  'Cortes de carne organizados no balcão do açougue',
  'Bebidas organizadas em expositores refrigerados',
  'Frios e queijos apresentados no balcão',
] as const;

function propsFor(
  type: string,
  layout: string,
  index: number,
  /** Contagens da combinação; o fixture não pode fixar o que o contrato varia. */
  counts: { setores: number } = { setores: 6 },
): Record<string, unknown> {
  switch (type) {
    case 'hero.split':
      return {
        layout,
        eyebrow: layout.startsWith('brand')
          ? 'Mercado da Praça'
          : 'Perto de você',
        headline: 'Boas escolhas começam por perto',
        subtext: 'Conheça nossa história, categorias e formas de atendimento.',
        cta: { label: 'Ver categorias', href: '#categorias' },
        image: image(1),
        imageAlt:
          'Fachada real do Mercado da Praça com o logo visível no letreiro',
      };
    case 'editorial.text': {
      const ligacao = layout === 'bridge' || layout === 'threshold';
      return {
        anchor: ligacao ? 'unidade' : 'historia',
        layout,
        title: ligacao
          ? 'Loja Brotas'
          : 'Um comércio que faz parte da rotina do bairro',
        ...(ligacao ? { lead: 'Rua da Praça, 100\nCentro, Brotas' } : {}),
        body: 'O Mercado da Praça nasceu para deixar as compras do dia a dia mais simples. A equipe conhece a região e organiza o atendimento com proximidade.\n\nCada categoria é apresentada com clareza para ajudar as pessoas a encontrar o que procuram.',
      };
    }
    case 'feature.bento':
      return {
        anchor: 'categorias',
        layout,
        eyebrow: 'Categorias',
        title: 'Encontre o que precisa',
        items: SETORES.slice(0, counts.setores).map(([title, body], item) => ({
          title,
          body,
          image: image(item + 2),
          imageAlt: SETOR_ALT[item],
        })),
      };
    case 'social.follow':
      return {
        layout,
        eyebrow: 'Redes sociais',
        title: 'Acompanhe as novidades',
        body: 'Veja informações e novidades nos nossos perfis oficiais.',
        images: [2, 3, 4, 5, 6, 7].map((item) => ({
          src: image(item),
          alt: `Cena ${item - 1} do comércio`,
        })),
      };
    case 'media.image':
      return {
        layout,
        src: image(20 + index),
        alt: 'Vista ampla do interior do comércio com produtos organizados',
        ...(layout === 'immersive'
          ? {}
          : {
              caption: 'Um ambiente simples, organizado e pronto para receber.',
            }),
      };
    case 'cta.band':
      return {
        layout,
        anchor:
          layout === 'band'
            ? 'ofertas'
            : layout === 'split'
              ? 'trabalhe-conosco'
              : 'contato',
        title:
          layout === 'band'
            ? 'Ofertas para deixar a rotina mais leve'
            : layout === 'split'
              ? 'Venha fazer parte da nossa equipe'
              : 'Quer falar com a gente?',
        body: 'Confira as informações e escolha o próximo passo.',
        cta: { label: 'Saiba mais', href: '#contato' },
        ...(layout === 'split'
          ? {
              image: image(20 + index),
              imageAlt: 'Equipe trabalhando no ambiente do mercado',
            }
          : {}),
      };
    case 'media.gallery':
      return {
        layout,
        title: 'Nosso dia a dia',
        images: [2, 3, 4, 5, 6, 7].map((item) => ({
          src: image(item),
          alt: `Cena ${item - 1} do comércio`,
        })),
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

const NAV_PROPS = (layout: string) => ({
  layout,
  logoText: 'Mercado da Praça',
  links: [
    { label: 'História', href: '#historia' },
    { label: 'Categorias', href: '#categorias' },
    { label: 'Onde estamos', href: '#onde-estamos' },
  ],
  cta: { label: 'Fale conosco', href: '#contato' },
});

function blocksFrom(
  marks: string[],
  counts: { setores: number },
): BlockInstance[] {
  return marks.map((mark, index) => {
    const [type, layout] = mark.split(':');
    return {
      id: `commercial-${index}`,
      type,
      props:
        type === 'nav.bar'
          ? NAV_PROPS(layout!)
          : propsFor(type!, layout!, index, counts),
    } as BlockInstance;
  });
}

function fixtureBlocks(
  variants?: Partial<CommercialVariantKeys>,
): BlockInstance[] {
  const resolved = resolveCommercialVariants(variants);
  return blocksFrom(
    [
      resolved.navegacao.signature,
      ...commercialSequence(resolved),
      commercialFooter(resolved),
    ],
    { setores: resolved.setores.items?.exact ?? 6 },
  );
}

/**
 * Uma página interna, que é onde a barra cobria o título: o pre-flight v8 só
 * examina a home, então esta composição não tem outro validador além daqui.
 */
function innerBlocks(
  variants?: Partial<CommercialVariantKeys>,
): BlockInstance[] {
  const resolved = resolveCommercialVariants(variants);
  return [
    {
      id: 'inner-nav',
      type: 'nav.bar',
      props: NAV_PROPS(resolved.navegacao.signature.split(':')[1]!),
    },
    {
      id: 'inner-hero',
      type: 'hero.statement',
      props: {
        layout: 'framed',
        eyebrow: 'Sobre nós',
        headline: 'Pioneirismo no varejo alimentar brasileiro',
        subtext: 'Mais de seis décadas de dedicação a alimentos frescos.',
        cta: { label: 'Fale conosco', href: '#contato' },
      },
    },
    {
      id: 'inner-text',
      type: 'editorial.text',
      props: {
        layout: 'narrow',
        title: 'Uma história construída no bairro',
        body: 'O Mercado da Praça nasceu para deixar as compras do dia a dia mais simples.\n\nA equipe conhece a região e organiza o atendimento com proximidade.',
      },
    },
    {
      id: 'inner-footer',
      type: 'footer.compact',
      props: propsFor(
        'footer.compact',
        commercialFooter(resolved).split(':')[1]!,
        90,
      ),
    },
  ] as BlockInstance[];
}

export function CommercialV8Fixture({
  structureKey,
  editing = false,
  still = false,
  variants,
  page = 'home',
}: {
  structureKey: CommercialStructure;
  editing?: boolean;
  still?: boolean;
  variants?: Partial<CommercialVariantKeys>;
  page?: 'home' | 'interna';
}) {
  const structure = SITE_STRUCTURES[structureKey];
  const tenant = fixtureTenant(structureKey, variants);
  if (still) tenant.dials.motion = 0;
  return (
    <div
      className="site-theme"
      data-vibe="comercial"
      data-structure={structure.key}
      data-profile-version="8"
      data-design-version="8"
      data-motion={still ? 'still' : 'gentle'}
      data-editing={editing ? 'true' : undefined}
      data-hero={tenant.brand.design?.heroComposition}
      style={themeVars(tenant.brand)}
    >
      <RenderBlocks
        blocks={
          page === 'interna' ? innerBlocks(variants) : fixtureBlocks(variants)
        }
        ctx={{
          tenant,
          pagePath: page === 'interna' ? '/sobre' : '/',
          isPreview: true,
          pageType: 'page',
          editing,
        }}
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
  const params = new URLSearchParams(location.search);
  hydrateRoot(
    document.getElementById('root')!,
    <CommercialV8Fixture
      structureKey={structureKey}
      editing={params.has('editing')}
      still={params.has('still')}
      variants={parseVariants(params.get('variants'))}
      page={params.get('page') === 'interna' ? 'interna' : 'home'}
    />,
  );
}
