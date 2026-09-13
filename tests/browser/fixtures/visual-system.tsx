import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import {
  completeDesignProfile,
  type DesignProfileInput,
} from '@/lib/design/profile';
import type { Vibe } from '@/lib/design/vibes';
import type { BlockInstance, Tenant } from '@/lib/types';

export const VISUAL_PAIRS = {
  comercial: ['slab', 'source'],
  moderno: ['grotesk', 'source'],
  ousado: ['condensed', 'work'],
  artistico: ['classic', 'literary'],
  landing: ['grotesk', 'sans'],
} as const;

const VISUAL_STRUCTURES = {
  comercial: ['comercial-atendimento', 'split'],
  moderno: ['moderno-editorial', 'editorial'],
  ousado: ['ousado-campanha', 'poster'],
  artistico: ['artistico-revista', 'offset'],
  landing: [undefined, 'stage'],
} as const;

export function visualTenant(
  vibe: Vibe,
  display?: string,
  body?: string,
): Tenant {
  const pair = VISUAL_PAIRS[vibe];
  const [structure, heroComposition] = VISUAL_STRUCTURES[vibe];
  const dark = vibe === 'moderno';
  return {
    id: 'visual-fixture',
    slug: 'visual-fixture',
    name: 'Estudo local',
    brand: {
      vibe,
      ink: dark ? '#f5f5f4' : '#202722',
      paper: dark ? '#0e1112' : '#fffdf7',
      surface: dark ? '#171a1c' : '#f5f2e9',
      accent: '#486b50',
      accentAlt: '#b3a3bc',
      highlight: dark ? '#b8ed91' : '#405939',
      radius: vibe === 'artistico' ? 'lg' : 'sm',
      design: completeDesignProfile({
        concept: 'Matéria e forma em um estudo tipográfico',
        signatureElement: 'Símbolos e contraste entre título e leitura',
        structure,
        structureRationale:
          'A estrutura sustenta o estudo visual e a leitura em diferentes telas.',
        displayFont: display ?? pair[0],
        bodyFont: body ?? pair[1],
        heroComposition,
        navigation: 'minimal',
        rhythm: 'chapters',
        imageTreatment: 'framed',
        surfaceStyle: 'flat',
        motif: 'none',
      } as DesignProfileInput),
    },
    dials: { motion: 5, variance: 5, density: 4 },
    contacts: {},
    brief: {},
    imageGuide: {},
  } as Tenant;
}

export const visualBlocks: BlockInstance[] = [
  {
    id: 'nav',
    type: 'nav.bar',
    props: {
      logoText: 'Estudo local',
      layout: 'minimal',
      links: [
        { label: 'Possibilidades', href: '#servicos' },
        { label: 'Dúvidas', href: '#duvidas' },
      ],
      cta: { label: 'Conversar', href: '#contato' },
    },
  },
  {
    id: 'hero',
    type: 'hero.statement',
    props: {
      layout: 'left',
      eyebrow: 'Matéria, ofício e imaginação',
      headline: 'Forma para novas ideias.',
      subtext:
        'Uma experiência começa nas escolhas: o traço, a palavra e o espaço entre eles.',
      cta: { label: 'Explorar possibilidades', href: '#servicos' },
    },
  },
  {
    id: 'services',
    type: 'feature.numbered',
    props: {
      anchor: 'servicos',
      title: 'Um olhar para cada detalhe.',
      lead: 'Tipografia e símbolos ajudam a encontrar o que importa.',
      layout: 'ledger',
      items: [
        {
          icon: 'compass',
          title: 'Direção e descoberta para cada nova ideia',
          body: 'Entender o contexto antes de desenhar o próximo passo.',
          href: '#contato',
        },
        {
          icon: 'layers',
          title: 'Composição e ritmo',
          body: 'Dar a cada informação seu espaço na página.',
          href: '#contato',
        },
        {
          icon: 'leaf',
          title: 'Matéria e cuidado',
          body: 'Escolher os elementos pelo que eles comunicam.',
          href: '#contato',
        },
      ],
    },
  },
  {
    id: 'text',
    type: 'editorial.text',
    props: {
      title: 'Ensino sólido com espaço acolhedor',
      layout: 'lead',
      presentation: { align: 'center' },
      body: 'Uma boa leitura precisa de ritmo. O título abre a conversa, o parágrafo desenvolve a ideia e a legenda oferece contexto.\n\nA experiência de leitura depende do tamanho das letras, da distância entre as linhas e da largura de cada parágrafo. Acentos como ação, criação, equilíbrio e coração devem aparecer com clareza em todos os tamanhos. O contraste entre famílias ajuda a reconhecer a hierarquia sem exigir esforço de quem lê.',
    },
  },
  {
    id: 'gallery',
    type: 'media.gallery',
    props: {
      title: 'Ambientes desenhados para aprender',
      layout: 'filmstrip',
      images: [
        {
          src: 'https://assets.test/one.svg',
          alt: 'Composição sintética de teste',
        },
        {
          src: 'https://assets.test/two.svg',
          alt: 'Segunda composição sintética',
        },
      ],
    },
  },
  {
    id: 'narrative',
    type: 'narrative.split',
    props: {
      title: 'Aprender começa na descoberta',
      layout: 'editorial',
      items: [
        {
          icon: 'book',
          title: 'Leitura e imaginação em cada etapa',
          body: 'Um texto longo permite conferir a quebra de linha ao lado do símbolo.',
        },
        {
          title: 'Espaço para aprender',
          body: 'Sem escolha de ícone, o texto ocupa seu lugar sem adorno.',
        },
      ],
    },
  },
  {
    id: 'quote',
    type: 'proof.testimonial',
    props: {
      quote: 'A palavra ganha presença quando encontra espaço para respirar.',
      author: 'Texto de demonstração',
      role: 'Estudo local de tipografia',
      layout: 'quote',
    },
  },
  {
    id: 'explorer',
    type: 'feature.explorer',
    props: {
      title: 'Escolha um caminho.',
      layout: 'showroom',
      items: [
        {
          title: 'Composição',
          icon: 'palette',
          headline: 'O encontro entre forma e função.',
          body: 'Uma composição muda conforme a intenção do projeto. Aqui, a navegação oferece espaço para explorar cada possibilidade.',
          image: 'https://assets.test/one.svg',
          imageAlt: 'Composição geométrica sintética para teste',
          facts: ['Leitura e hierarquia', 'Espaço e proporção'],
          cta: { label: 'Ver composição', href: '#contato' },
        },
        {
          title: 'Materialidade',
          icon: 'cube',
          headline: 'Textura que dá sentido ao conjunto.',
          body: 'O conteúdo de demonstração permite testar a seleção das abas por teclado e verificar a resposta visual dos símbolos.',
          image: 'https://assets.test/two.svg',
          imageAlt: 'Segunda composição geométrica para teste',
          facts: ['Traço e contraste'],
          cta: { label: 'Ver materiais', href: '#contato' },
        },
      ],
    },
  },
  {
    id: 'bento',
    type: 'feature.bento',
    props: {
      title: 'Partes de uma mesma ideia.',
      layout: 'mosaic',
      items: [
        {
          icon: 'sun',
          title: 'Luz e presença',
          body: 'Cada elemento tem uma função na composição.',
        },
        {
          icon: 'tools',
          title: 'Ofício e precisão',
          body: 'As escolhas de desenho aparecem nos detalhes.',
        },
      ],
    },
  },
  {
    id: 'steps',
    type: 'narrative.steps',
    props: {
      title: 'Da ideia à forma.',
      steps: [
        { title: 'Entender', body: 'Uma conversa sobre contexto e intenção.' },
        { title: 'Compor', body: 'Escolhas visuais com funções claras.' },
      ],
    },
  },
  {
    id: 'resources',
    type: 'editorial.resources',
    props: {
      title: 'Continue a descoberta.',
      layout: 'list',
      items: [
        {
          icon: 'book',
          category: 'Leitura',
          title: 'A forma das palavras',
          body: 'Um convite para observar o ritmo dos textos na página.',
          href: '/guia',
        },
        {
          icon: 'palette',
          category: 'Referências',
          title: 'As cores do cotidiano',
          body: 'Um olhar sobre relações de cor e contraste.',
          href: '/cores',
        },
      ],
    },
  },
  {
    id: 'pricing',
    type: 'pricing.table',
    props: {
      title: 'Possibilidades de composição.',
      plans: [
        {
          name: 'Estudo',
          price: 'Sob consulta',
          features: ['Conversa inicial', 'Direção visual'],
          cta: { label: 'Conversar', href: '#contato' },
        },
        {
          name: 'Projeto',
          price: 'Sob consulta',
          features: ['Composição completa', 'Revisão visual'],
          highlight: true,
          cta: { label: 'Conhecer', href: '#contato' },
        },
      ],
    },
  },
  {
    id: 'faq',
    type: 'faq.accordion',
    props: {
      title: 'Antes de começar.',
      anchor: 'duvidas',
      items: [
        {
          q: 'Por onde começa a conversa?',
          a: 'Pelo contexto, pelas necessidades e pelo que você já sabe sobre o projeto.',
        },
        {
          q: 'Como escolher uma direção?',
          a: 'As escolhas precisam combinar com o conteúdo e facilitar a leitura.',
        },
      ],
    },
  },
  {
    id: 'form',
    type: 'form.lead',
    props: {
      title: 'Vamos dar forma?',
      anchor: 'contato',
      fields: [
        { name: 'nome', label: 'Seu nome', type: 'text', required: true },
        { name: 'email', label: 'E-mail', type: 'email', required: true },
      ],
      submitLabel: 'Enviar mensagem',
    },
  },
  {
    id: 'footer',
    type: 'footer.compact',
    props: {
      logoText: 'Estudo local',
      tagline: 'Fixture de teste. Nenhuma oferta comercial.',
      links: [],
    },
  },
];

export function VisualSystemFixture({
  vibe = 'comercial',
  display,
  body,
  testimonialLayout,
  blocks = visualBlocks,
}: {
  vibe?: Vibe;
  display?: string;
  body?: string;
  testimonialLayout?: string;
  blocks?: BlockInstance[];
}) {
  const tenant = visualTenant(vibe, display, body);
  return (
    <div
      className="site-theme"
      data-vibe={vibe}
      data-motion="gentle"
      style={themeVars(tenant.brand)}
    >
      <RenderBlocks
        blocks={blocks.map((block) =>
          testimonialLayout && block.type === 'proof.testimonial'
            ? { ...block, props: { ...block.props, layout: testimonialLayout } }
            : block,
        )}
        ctx={{ tenant, pagePath: '/', isPreview: true }}
      />
    </div>
  );
}

if (typeof document !== 'undefined') {
  const query = new URLSearchParams(location.search);
  hydrateRoot(
    document.getElementById('root')!,
    <VisualSystemFixture
      vibe={(query.get('vibe') ?? 'comercial') as Vibe}
      display={query.get('display') ?? undefined}
      body={query.get('body') ?? undefined}
      testimonialLayout={query.get('testimonial') ?? undefined}
    />,
  );
}
