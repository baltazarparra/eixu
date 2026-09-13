import { blockSchemas, type BlockType } from '@/lib/blocks/registry';
import { completeDesignProfile, designSchemaFor } from '@/lib/design/profile';
import { scenePlan } from '@/lib/images/scene-plan';
import type { BlockInstance, Page, Tenant, TenantImage } from '@/lib/types';

export const landingEvidence = [
  '12 acabamentos disponíveis',
  '3 medidas de tampo',
  'Clara, arquiteta: A mesa coube no meu espaço. Resultado: medida adequada.',
  'Rui, designer: O tampo deixou a bancada livre. Resultado: espaço livre.',
  'Essencial R$ 890',
  'Completa R$ 1.290',
];
export const landingImage = (index: number) =>
  `https://assets.test/landing-${index}.svg`;

export function landingInput(layout: 'stage' | 'form' = 'stage') {
  return designSchemaFor('landing').parse({
    brief: {
      audience: 'Pessoas montando um espaço de trabalho em casa',
      offer: 'Mesas de madeira sob medida para escritórios domésticos',
      goal: 'Pedir orçamento pelo formulário desta página',
      personality: ['concreta', 'acolhedora'],
      evidence: landingEvidence,
      gaps: [],
      constraints: ['Fixture sintética, não publicar'],
      pagePlan: [
        {
          slug: '',
          stage: 'conversion',
          intent: 'Escolher a mesa e pedir orçamento com medidas do espaço',
          content:
            'Apresentar as medidas e acabamentos, explicar o pedido e responder dúvidas antes do contato.',
          evidence: landingEvidence,
        },
      ],
      imageScenes: scenePlan(
        { heroComposition: layout, version: 7 },
        1,
        'landing',
      ).map((scene) => ({
        role: scene.role,
        targetBlock: scene.targetBlock,
        page: '',
        request:
          'Mesa de madeira clara em um escritório doméstico, com produto inteiro e fundo limpo.',
      })),
    },
    concept: 'O espaço de trabalho começa pela mesa que cabe na rotina',
    signatureElement: 'A forma alongada do tampo orienta a moldura das imagens',
    accent: '#16814a',
    accentAlt: '#ecfdf5',
    ink: '#0b0b0f',
    paper: '#ffffff',
    surface: '#f6faf7',
    radius: 'md',
    displayFont: 'grotesk',
    bodyFont: 'sans',
    heroComposition: layout,
    navigation: 'minimal',
    rhythm: 'alternating',
    imageTreatment: 'framed',
    surfaceStyle: 'outlined',
    motif: 'none',
    variance: 4,
    motion: 3,
    density: 5,
  });
}

export function landingFixture(
  layout: 'stage' | 'form' = 'stage',
  showcase: 'tabs' | 'steps' = 'tabs',
) {
  const input = landingInput(layout);
  const tenant = {
    id: 'tenant-landing-fixture',
    slug: 'landing-fixture',
    name: 'Linha Clara',
    brand: {
      vibe: 'landing',
      accent: '#16814a',
      accentAlt: '#ecfdf5',
      highlight: '#16814a',
      ink: '#0b0b0f',
      paper: '#ffffff',
      surface: '#f6faf7',
      radius: 'md',
      design: completeDesignProfile(input),
    },
    dials: { variance: 4, motion: 3, density: 5 },
    brief: input.brief,
    imageGuide: {},
    contacts: {},
    whatsapp: null,
    contactEmail: null,
    locale: 'pt-BR',
    status: 'draft',
  } as unknown as Tenant;
  const images = scenePlan(tenant.brand.design, 1, 'landing').map(
    (scene, index) => ({
      id: `image-${index}`,
      tenantId: tenant.id,
      seq: index + 1,
      url: landingImage(index + 1),
      ratio: scene.ratio,
      kind: 'foto',
      status: 'disponivel',
      model: 'upload',
      blobPath: `tenants/${tenant.slug}/uploads/${index}.svg`,
      targetBlock: scene.targetBlock,
      requestText: 'Ilustração sintética de mesa, usada somente nesta fixture',
      critique: {},
      createdAt: '2026-09-13T00:00:00Z',
    }),
  ) as unknown as TenantImage[];
  const cta = {
    label: 'Pedir orçamento',
    href: layout === 'form' ? '#pedido' : '#contato',
  };
  const form = {
    title: 'Conte o que você precisa',
    body: 'Deixe seu contato para conversar sobre a mesa e as medidas do espaço.',
    fields: [
      { name: 'nome', label: 'Seu nome', type: 'text', required: true },
      { name: 'email', label: 'E-mail', type: 'email', required: true },
    ],
    submitLabel: 'Enviar pedido',
    consentText: 'Concordo em receber contato sobre este pedido.',
    whatsappOptIn: false,
    redirectTo: '/obrigado',
  };
  const block = (
    id: string,
    type: BlockType,
    props: Record<string, unknown>,
  ): BlockInstance => ({ id, type, props: blockSchemas[type].parse(props) });
  const blocks = [
    block('nav', 'nav.bar', {
      logoText: 'Linha Clara',
      layout: 'minimal',
      position: 'fixed',
      stickyCta: true,
      links: [
        { label: 'A mesa', href: '#mesa' },
        { label: 'Como pedir', href: '#passos' },
        { label: 'Dúvidas', href: '#duvidas' },
      ],
      cta,
    }),
    block('hero', 'hero.landing', {
      layout,
      headline: 'Uma mesa que cabe na sua rotina',
      subtext:
        'Madeira, medida e acabamento para trabalhar em casa. Conte como é o seu espaço.',
      cta,
      ...(layout === 'form'
        ? { form, formAnchor: 'pedido' }
        : {
            image: landingImage(1),
            imageAlt: 'Ilustração de uma mesa de madeira em um ambiente claro',
          }),
      presentation: { tone: 'paper', motion: 'reveal' },
    }),
    block('proof', 'proof.strip', {
      layout: 'numbers',
      items: [
        {
          value: '12',
          label: 'acabamentos disponíveis',
          evidence: landingEvidence[0],
        },
        { value: '3', label: 'medidas de tampo', evidence: landingEvidence[1] },
      ],
      presentation: { tone: 'soft', spacing: 'tight' },
    }),
    block('statement', 'narrative.statement', {
      title:
        'Seu trabalho precisa de espaço. A mesa não precisa ocupar a casa inteira.',
      presentation: { tone: 'paper', width: 'narrow' },
    }),
    block('showcase', 'feature.showcase', {
      anchor: 'mesa',
      layout: showcase,
      title: 'A medida muda o uso do espaço',
      body: 'Imagine como o computador, os materiais e a luz vão dividir a mesa. As ilustrações deste teste mostram duas possibilidades.',
      items: [
        {
          title: 'Lugar para se concentrar',
          body: 'Comece pelo que você usa todos os dias. Meça o computador e deixe espaço para apoiar os braços. Pense também na posição da cadeira e no caminho até a porta. Essas informações ajudam a escolher uma medida que funcione na sua casa.',
          image: landingImage(2),
          imageAlt: 'Ilustração de mesa estreita com espaço para computador',
          cta,
        },
        {
          title: 'Uma bancada para criar',
          body: 'Quem desenha, escreve ou espalha materiais precisa de outra relação com a superfície. Organize uma lista do que fica sobre a mesa e compare as medidas. O pedido reúne essas escolhas para que a conversa sobre o orçamento tenha um ponto de partida claro.',
          image: landingImage(3),
          imageAlt: 'Ilustração de bancada de madeira com tampo mais largo',
          cta,
        },
      ],
      presentation: { tone: 'soft', width: 'wide' },
    }),
    block('steps', 'narrative.steps', {
      anchor: 'passos',
      layout: 'horizontal',
      title: 'Do seu espaço ao pedido',
      steps: [
        {
          title: 'Meça o espaço',
          body: 'Anote a largura e a profundidade disponíveis. Reserve a passagem e o movimento da cadeira.',
        },
        {
          title: 'Escolha o acabamento',
          body: 'Compare a madeira com a luz e os móveis que você já tem. Leve suas referências para a conversa.',
        },
        {
          title: 'Envie seu pedido',
          body: 'Deixe nome e e-mail no formulário. As medidas e condições finais serão combinadas no orçamento.',
        },
      ],
      presentation: { tone: 'paper' },
    }),
    block('testimonials', 'proof.testimonials', {
      title: 'O que mudou no espaço',
      items: [
        {
          quote: 'A mesa coube no meu espaço.',
          author: 'Clara',
          role: 'arquiteta',
          result: 'medida adequada',
          evidence: landingEvidence[2],
        },
        {
          quote: 'O tampo deixou a bancada livre.',
          author: 'Rui',
          role: 'designer',
          result: 'espaço livre',
          evidence: landingEvidence[3],
        },
      ],
      presentation: { tone: 'soft' },
    }),
    block('pricing', 'pricing.table', {
      layout: 'cards',
      title: 'Um ponto de partida para escolher',
      plans: [
        {
          name: 'Essencial',
          price: 'R$ 890',
          features: ['Confira as medidas na conversa'],
          cta,
        },
        {
          name: 'Completa',
          price: 'R$ 1.290',
          features: ['Confira os acabamentos na conversa'],
          cta,
        },
      ],
      presentation: { tone: 'paper' },
    }),
    block('faq', 'faq.accordion', {
      anchor: 'duvidas',
      layout: 'stack',
      title: 'Antes de pedir',
      items: [
        {
          q: 'O que preciso medir?',
          a: 'Meça o espaço disponível para largura e profundidade. Observe tomadas, rodapés e a abertura das portas. Reserve um lugar para a cadeira e para circular. Se houver uma dúvida sobre a medida, leve essa informação para a conversa antes de confirmar o orçamento.',
        },
        {
          q: 'Como escolher o acabamento?',
          a: 'Considere a luz do ambiente, a cor dos móveis e o uso previsto. Uma referência ajuda a explicar a escolha, mas uma ilustração não representa a textura exata da madeira. Compare as opções disponíveis durante a conversa.',
        },
        {
          q: 'O formulário confirma uma compra?',
          a: 'Não. O formulário abre um pedido de orçamento. A medida, o acabamento e as condições finais precisam ser combinados antes de qualquer confirmação.',
        },
        {
          q: 'Posso começar sem todas as medidas?',
          a: 'Você pode abrir a conversa e explicar o que ainda precisa conferir. Antes de confirmar o orçamento, reúna as informações do espaço para escolher com clareza.',
        },
      ],
      presentation: { tone: 'soft' },
    }),
    layout === 'form'
      ? block('close', 'cta.band', {
          title: 'Vamos encontrar a medida da sua mesa?',
          body: 'Volte ao formulário para deixar seu contato e iniciar o pedido.',
          cta,
          image: landingImage(5),
          imageAlt: 'Ilustração de mesa de madeira em vista frontal',
          presentation: { tone: 'accent' },
        })
      : block('close', 'form.lead', {
          ...form,
          anchor: 'contato',
          layout: 'stack',
          presentation: { tone: 'secondary' },
        }),
    block('footer', 'footer.compact', {
      logoText: 'Linha Clara',
      layout: 'minimal',
      legal: 'Demonstração local com conteúdo fictício. Não publicar.',
    }),
  ];
  const page = (
    slug: string,
    type: 'page' | 'thank_you',
    content: BlockInstance[],
  ) =>
    ({
      id: slug || 'home',
      tenantId: tenant.id,
      slug,
      type,
      title: slug
        ? 'Recebemos seu pedido'
        : 'Mesas sob medida para trabalhar em casa',
      seo: {
        title: slug
          ? 'Pedido recebido'
          : 'Mesas de madeira sob medida | Linha Clara',
        description:
          'Conheça as medidas e acabamentos e abra um pedido de orçamento para sua mesa de trabalho.',
        noindex: Boolean(slug),
      },
      meta: slug
        ? {}
        : {
            inbound: {
              stage: 'conversion',
              intent:
                'Escolher a medida e pedir orçamento de uma mesa para a casa',
            },
          },
      blocks: content,
      navOrder: 0,
      publishedBlocks: null,
      publishedSeo: null,
    }) as unknown as Page;
  const pages = [
    page('', 'page', blocks),
    page('obrigado', 'thank_you', [
      block('thanks', 'hero.statement', {
        headline: 'Recebemos seu pedido',
        subtext: 'Seu contato ficou registrado para a conversa sobre a mesa.',
        cta: { label: 'Voltar ao início', href: '/' },
      }),
    ]),
  ];
  return { input, tenant, images, pages };
}
