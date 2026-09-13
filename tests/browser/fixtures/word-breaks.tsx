import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import {
  completeDesignProfile,
  type DesignProfileInput,
} from '@/lib/design/profile';
import type { BlockInstance, Tenant } from '@/lib/types';

const image = (name: string) => `https://assets.test/${name}.svg`;

export const wordBreakTenant = {
  id: 'word-break-fixture',
  slug: 'word-break-fixture',
  name: 'Nexo Energia',
  contactEmail: 'sustentabilidade.operacional@nexoenergia.example',
  brand: {
    vibe: 'comercial',
    ink: '#202722',
    paper: '#fffdf7',
    surface: '#f5f2e9',
    accent: '#486b50',
    accentAlt: '#a66a3f',
    highlight: '#405939',
    radius: 'sm',
    design: completeDesignProfile({
      concept: 'Energia organizada em decisões concretas',
      signatureElement: 'Lentes que conectam cenário, critério e ação',
      structure: 'comercial-vitrine',
      structureRationale:
        'A vitrine organiza aplicações e critérios antes da conversa técnica.',
      displayFont: 'slab',
      bodyFont: 'source',
      heroComposition: 'cover',
      navigation: 'bar',
      rhythm: 'alternating',
      imageTreatment: 'framed',
      surfaceStyle: 'flat',
      motif: 'wash',
    } as DesignProfileInput),
  },
  dials: { motion: 3, variance: 4, density: 5 },
  contacts: {},
  brief: {},
  imageGuide: {},
} as Tenant;

export const wordBreakBlocks: BlockInstance[] = [
  {
    id: 'nav',
    type: 'nav.bar',
    props: {
      logoText: 'Nexo Energia',
      layout: 'bar',
      links: [
        { label: 'Sustentabilidade', href: '#metodo' },
        { label: 'Acompanhamento', href: '#acompanhamento' },
      ],
      cta: { label: 'Conversar', href: '#contato' },
    },
  },
  {
    id: 'hero',
    type: 'hero.split',
    props: {
      layout: 'cover',
      eyebrow: 'Decisão com contexto',
      headline: 'Sustentabilidade orienta decisões de energia com clareza',
      subtext:
        'Organize consumo, prioridades e indicadores antes do próximo passo.',
      image: image('hero'),
      imageAlt: 'Infraestrutura de energia em uma composição editorial',
      cta: { label: 'Entender o diagnóstico', href: '#metodo' },
    },
  },
  {
    id: 'signature',
    type: 'signature.composition',
    props: {
      anchor: 'metodo',
      layout: 'service-lens',
      eyebrow: 'Leitura da operação',
      title: 'Uma lente para cada decisão energética',
      body: 'Cenário, critério e acompanhamento aparecem como partes do mesmo percurso.',
      items: [
        {
          role: 'focus',
          label: 'Cenário',
          title: 'Consumo organizado',
          body: 'O histórico cria uma base legível para a conversa técnica.',
          image: image('focus'),
          imageAlt: 'Painel com indicadores de consumo energético',
        },
        {
          role: 'support',
          label: 'Critério',
          title: 'Prioridades conectadas',
          body: 'Impacto e dependências orientam a ordem das alternativas.',
          image: image('support'),
          imageAlt: 'Detalhe de infraestrutura energética',
        },
        {
          role: 'detail',
          label: 'Rotina',
          title: 'Acompanhamento mensal',
          body: 'Indicadores mantêm as decisões ligadas ao contexto da operação.',
        },
        {
          role: 'action',
          label: 'Próximo passo',
          title: 'Conversa contextualizada',
          body: 'Compartilhe o cenário para avaliar o que merece investigação.',
          cta: { label: 'Preparar a conversa', href: '#contato' },
        },
      ],
    },
  },
  ...(['band', 'split', 'poster', 'minimal'] as const).map(
    (layout, index): BlockInstance => ({
      id: `cta-${layout}`,
      type: 'cta.band',
      props: {
        anchor: index === 0 ? 'acompanhamento' : undefined,
        presentation: index === 1 ? { tone: 'accent' } : undefined,
        layout,
        title:
          index === 2
            ? 'Sustentabilidade operacional começa com contexto compartilhado'
            : 'Acompanhamento para decisões com mais clareza',
        body: 'Reúna as informações disponíveis e inicie uma conversa técnica sobre a operação.',
        cta: {
          label: 'Conversar sobre sustentabilidade',
          href: '#contato',
        },
      },
    }),
  ),
  {
    id: 'form',
    type: 'form.lead',
    props: {
      anchor: 'contato',
      layout: 'split',
      title: 'Conte o contexto da operação',
      fields: [
        { name: 'nome', label: 'Nome completo', type: 'text', required: true },
        {
          name: 'email',
          label: 'E-mail profissional',
          type: 'email',
          required: true,
        },
      ],
      submitLabel: 'Enviar informações',
    },
  },
  {
    id: 'footer',
    type: 'footer.compact',
    props: {
      logoText: 'Nexo Energia',
      tagline: 'Fixture sintética para integridade tipográfica.',
      links: [{ label: 'Sustentabilidade', href: '#metodo' }],
    },
  },
];

export function WordBreakFixture() {
  const version = wordBreakTenant.brand.design?.version;
  return (
    <div
      className="site-theme"
      data-vibe="comercial"
      data-design-version={version === 5 || version === 6 ? 4 : version}
      data-profile-version={version}
      data-structure="comercial-vitrine"
      data-motif="wash"
      data-motion="still"
      style={themeVars(wordBreakTenant.brand)}
    >
      <RenderBlocks
        blocks={wordBreakBlocks}
        ctx={{ tenant: wordBreakTenant, pagePath: '/', isPreview: true }}
      />
    </div>
  );
}

if (typeof document !== 'undefined')
  hydrateRoot(document.getElementById('root')!, <WordBreakFixture />);
