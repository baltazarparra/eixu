import { z } from 'zod';
import { textStylesSchema } from './text-style-schema';
import { contrastRatio } from './contrast';
import { ICON_NAMES } from '@/lib/design/iconography';
import { structureGrammar, type Vibe } from '@/lib/design/vibes';
import { SIGNATURE_LAYOUTS, type StructureKey } from '@/lib/design/structures';
import { expectedRatio } from '../images/ratios';

/**
 * Famílias de layout. A regra do Taste Skill exige pelo menos 4 famílias
 * distintas em uma página com 8 ou mais seções.
 */
export const FAMILIES = [
  'nav',
  'hero',
  'proof',
  'feature',
  'narrative',
  'faq',
  'cta',
  'form',
  'editorial',
  'media',
  'pricing',
  'signature',
  'footer',
] as const;

export type Family = (typeof FAMILIES)[number];

const icon = z
  .enum(ICON_NAMES)
  .optional()
  .describe(
    'Opcional: omita quando texto ou foto já bastam. Use apenas para distinguir o assunto, evitando símbolos repetidos na lista e nas seções vizinhas. Sem icon, o item não recebe símbolo padrão. Peso e movimento vêm da vibe; não comprova certificação.',
  );

const anchor = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .max(64)
  .optional();

const link = z.object({
  label: z
    .string()
    .min(1)
    .max(40)
    .describe(
      'Ação ou destino em português simples, como Ver serviços ou Falar pelo WhatsApp. Evite Clique aqui, Saiba mais e inglês. O texto deve corresponder ao href.',
    ),
  href: z.string().min(1),
});

const logoHeight = z
  .number()
  .int()
  .min(16)
  .max(160)
  .optional()
  .describe(
    'Altura do logo em pixels; mantém proporção e cabe na largura disponível.',
  );

/**
 * Ritmo visual por seção. São decisões de composição, não CSS livre: o agente
 * ganha variedade sem poder injetar estilos, URLs ou comportamento arbitrário.
 */
const presentation = z
  .object({
    tone: z.enum(['paper', 'soft', 'ink', 'accent', 'secondary']).optional(),
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe(
        'Cor de fundo exclusiva desta seção. Prevalece sobre tone sem mudar a marca; texto com contraste automático.',
      ),
    foreground: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe(
        'Cor do texto desta seção; exige background explícito e contraste mínimo de 4,5:1. Omita para contraste automático.',
      ),
    motion: z.enum(['none', 'reveal', 'stagger', 'image']).optional(),
    width: z.enum(['narrow', 'normal', 'wide', 'full']).optional(),
    spacing: z.enum(['tight', 'normal', 'airy']).optional(),
    align: z.enum(['left', 'center', 'offset']).optional(),
    edge: z.enum(['none', 'line', 'panel', 'bleed']).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.foreground &&
      (!value.background ||
        contrastRatio(value.foreground, value.background) < 4.5)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['foreground'],
        message:
          'Informe background e foreground com contraste mínimo de 4,5:1; ou omita foreground para usar contraste automático.',
      });
  })
  .optional();

const field = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/, 'use minúsculas, números e underline'),
  label: z.string().min(1).max(60),
  type: z.enum(['text', 'email', 'tel', 'textarea', 'select']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const blockSchemas = {
  'nav.bar': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['bar', 'floating', 'minimal', 'split']).optional(),
    position: z
      .enum(['static', 'fixed'])
      .optional()
      .describe(
        'fixed mantém o cabeçalho no topo durante a rolagem, reservando sua altura no conteúdo.',
      ),
    backgroundOpacity: z
      .number()
      .int()
      .min(70)
      .max(100)
      .optional()
      .describe(
        'Opacidade do fundo do cabeçalho em porcentagem. Ex.: 88 para fundo semitransparente; presentation.tone ink usa o tom escuro.',
      ),
    logoText: z
      .string()
      .min(1)
      .max(24)
      .describe('Nome exibido quando o cliente não tem logo enviado.'),
    logoHeight,
    links: z.array(link).max(5).default([]),
    cta: link.optional(),
  }),

  'hero.split': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z
      .enum(['split', 'cover', 'poster', 'editorial', 'offset', 'atelier'])
      .optional(),
    imagePosition: z.enum(['left', 'right']).optional(),
    imageFit: z.enum(['cover', 'contain']).optional(),
    focalPoint: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
    secondaryImage: z.url().startsWith('http').optional(),
    secondaryImageAlt: z.string().max(140).optional(),
    imageCaption: z.string().max(140).optional(),
    secondaryCaption: z.string().max(100).optional(),
    eyebrow: z.string().max(48).optional(),
    headline: z.string().min(4).max(90),
    subtext: z.string().max(160).optional(),
    cta: link,
    secondary: link.optional(),
    bullets: z
      .array(z.string().max(48))
      .max(3)
      .optional()
      .describe('Até 3 selos curtos de confiança sob os botões.'),
    image: z
      .url()
      .startsWith('http')
      .optional()
      .describe('URL http(s) de uma imagem real. Omita se não tiver.'),
    imageAlt: z.string().max(140).optional(),
  }),

  'hero.statement': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['left', 'center', 'oversize', 'framed']).optional(),
    eyebrow: z.string().max(48).optional(),
    headline: z.string().min(4).max(90),
    subtext: z.string().max(160).optional(),
    cta: link,
  }),

  'proof.logos': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['rail', 'grid', 'stamp']).optional(),
    title: z.string().max(80).optional(),
    logos: z.array(z.string().max(40)).min(3).max(10),
  }),

  'proof.stats': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['strip', 'cards', 'editorial']).optional(),
    items: z
      .array(z.object({ value: z.string().max(12), label: z.string().max(60) }))
      .min(2)
      .max(4),
  }),

  'proof.testimonial': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['quote', 'spotlight', 'split']).optional(),
    quote: z.string().min(20).max(320),
    author: z.string().max(60),
    role: z.string().max(80).optional(),
  }),

  'feature.numbered': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['ledger', 'rail', 'cards', 'index']).optional(),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    lead: z.string().max(200).optional(),
    items: z
      .array(
        z.object({
          icon,
          title: z.string().max(60),
          body: z.string().max(160),
          href: z.string().optional(),
        }),
      )
      .min(3)
      .max(8),
  }),

  'feature.bento': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['mosaic', 'gallery', 'stack', 'showcase']).optional(),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    items: z
      .array(
        z.object({
          icon,
          title: z.string().max(60),
          body: z.string().max(220),
          image: z.url().startsWith('http').optional(),
          imageAlt: z.string().max(140).optional(),
        }),
      )
      .min(2)
      .max(6),
  }),

  'narrative.steps': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['timeline', 'cards', 'horizontal', 'chapters']).optional(),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    steps: z
      .array(z.object({ title: z.string().max(60), body: z.string().max(220) }))
      .min(2)
      .max(5),
  }),

  'narrative.split': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['split', 'reverse', 'overlap', 'editorial']).optional(),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    items: z
      .array(
        z.object({
          icon,
          title: z.string().max(60),
          body: z.string().max(160),
          href: z.string().optional(),
        }),
      )
      .min(2)
      .max(6),
    image: z
      .url()
      .startsWith('http')
      .optional()
      .describe('Foto real ao lado da lista. Omita se não tiver.'),
    imageAlt: z.string().max(140).optional(),
  }),

  'feature.explorer': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['showroom', 'panorama']).default('showroom'),
    title: z.string().min(4).max(90),
    body: z.string().max(260).optional(),
    items: z
      .array(
        z.object({
          icon,
          title: z.string().min(2).max(48),
          headline: z.string().min(8).max(100),
          body: z.string().min(20).max(420),
          image: z.url().startsWith('http'),
          imageAlt: z.string().min(5).max(140),
          caption: z.string().max(140).optional(),
          facts: z.array(z.string().min(3).max(80)).max(3).default([]),
          cta: link,
        }),
      )
      .min(2)
      .max(5),
  }),

  'editorial.resources': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['feature', 'list']).default('feature'),
    title: z.string().min(4).max(90),
    body: z.string().max(260).optional(),
    items: z
      .array(
        z.object({
          icon,
          title: z.string().min(4).max(90),
          body: z.string().min(20).max(220),
          category: z.string().max(40),
          href: z.string().startsWith('/'),
          image: z.url().startsWith('http').optional(),
          imageAlt: z.string().max(140).optional(),
        }),
      )
      .min(2)
      .max(4),
  }),

  'signature.composition': z
    .object({
      anchor,
      presentation,
      textStyles: textStylesSchema.optional(),
      layout: z.enum(SIGNATURE_LAYOUTS),
      eyebrow: z.string().max(48).optional(),
      title: z.string().min(4).max(90),
      body: z.string().min(20).max(320),
      items: z
        .array(
          z.object({
            role: z.enum(['focus', 'support', 'detail', 'action']),
            icon,
            label: z.string().max(36).optional(),
            title: z.string().min(2).max(64),
            body: z.string().min(12).max(220),
            image: z.url().startsWith('http').optional(),
            imageAlt: z.string().min(5).max(140).optional(),
            caption: z.string().max(120).optional(),
            cta: link.optional(),
          }),
        )
        .min(3)
        .max(6),
    })
    .superRefine((value, ctx) => {
      const focusCount = value.items.filter(
        (item) => item.role === 'focus',
      ).length;
      if (focusCount !== 1)
        ctx.addIssue({
          code: 'custom',
          path: ['items'],
          message: `A composição precisa de exatamente um item focus; recebeu ${focusCount}.`,
        });
      if (!value.items.some((item) => item.role === 'support'))
        ctx.addIssue({
          code: 'custom',
          path: ['items'],
          message: 'A composição precisa de ao menos um item support.',
        });
      value.items.forEach((item, index) => {
        if (item.image && !item.imageAlt)
          ctx.addIssue({
            code: 'custom',
            path: ['items', index, 'imageAlt'],
            message: 'Descreva a imagem exibida neste item.',
          });
      });
    }),

  'editorial.facts': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['split', 'poster', 'ledger']).optional(),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    body: z.string().max(600).optional(),
    facts: z
      .array(z.object({ label: z.string().max(40), value: z.string().max(80) }))
      .min(2)
      .max(8),
    dark: z.boolean().default(false),
  }),

  'faq.accordion': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['split', 'stack', 'cards']).optional(),
    title: z.string().min(4).max(90),
    items: z
      .array(z.object({ q: z.string().max(140), a: z.string().max(600) }))
      .min(2)
      .max(10),
  }),

  'cta.band': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['band', 'poster', 'split', 'minimal']).optional(),
    title: z.string().min(4).max(90),
    body: z.string().max(200).optional(),
    cta: link,
    whatsapp: z.boolean().default(false),
  }),

  'form.lead': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['split', 'panel', 'stack']).optional(),
    title: z.string().min(4).max(90),
    body: z.string().max(200).optional(),
    fields: z.array(field).min(1).max(8),
    submitLabel: z
      .string()
      .max(40)
      .default('Enviar')
      .describe(
        'Explique o envio em português simples, como Enviar mensagem. Não prometa agendamento ou compra que o formulário não realiza.',
      ),
    consentText: z
      .string()
      .max(300)
      .default(
        'Concordo em ser contatado e com o uso dos meus dados conforme a política de privacidade.',
      ),
    whatsappOptIn: z.boolean().default(false),
    redirectTo: z.string().default('/obrigado'),
  }),

  'editorial.text': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['narrow', 'lead', 'columns']).optional(),
    title: z.string().max(90).optional(),
    body: z.string().min(20).max(4000),
  }),

  'editorial.postList': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['grid', 'list', 'magazine']).optional(),
    title: z.string().min(2).max(90),
    limit: z.number().int().min(1).max(24).default(9),
  }),

  'editorial.postBody': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    body: z.string().min(20).max(30000),
  }),

  'media.gallery': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['grid', 'masonry', 'filmstrip', 'collage']).optional(),
    title: z.string().max(90).optional(),
    images: z
      .array(
        z.object({ src: z.url().startsWith('http'), alt: z.string().max(140) }),
      )
      .min(2)
      .max(8),
  }),

  'media.image': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['wide', 'bleed', 'portrait', 'offset']).optional(),
    src: z.url().startsWith('http'),
    alt: z.string().max(140),
    caption: z.string().max(160).optional(),
  }),

  'media.map': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['split', 'framed', 'wide']).optional(),
    title: z.string().max(90).optional(),
    address: z.string().max(200),
    query: z.string().max(200),
  }),

  'pricing.table': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['cards', 'comparison', 'editorial']).optional(),
    title: z.string().min(4).max(90),
    plans: z
      .array(
        z.object({
          name: z.string().max(40),
          price: z.string().max(24),
          note: z.string().max(80).optional(),
          features: z.array(z.string().max(80)).min(1).max(8),
          cta: link,
          highlight: z.boolean().default(false),
        }),
      )
      .min(2)
      .max(4),
  }),

  'footer.compact': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['split', 'stack', 'minimal']).optional(),
    logoText: z.string().min(1).max(24),
    logoHeight,
    tagline: z.string().max(120).optional(),
    links: z.array(link).max(6).default([]),
    legal: z.string().max(120).optional(),
  }),
} as const;

export type BlockType = keyof typeof blockSchemas;

type Meta = {
  family: Family;
  label: string;
  /** Serve de guia para a IA escolher o bloco certo. */
  use: string;
  /** Faixas de dials em que o bloco funciona bem. */
  variance?: [number, number];
  singleton?: boolean;
};

export const blockMeta: Record<BlockType, Meta> = {
  'feature.explorer': {
    family: 'feature',
    label: 'Explorador visual',
    use: 'Compara aplicações, produtos ou serviços com foto, seleção por abas e CTA específico. Fotos de inspiração precisam de legenda; nunca simule obra executada.',
  },
  'editorial.resources': {
    family: 'editorial',
    label: 'Próxima leitura',
    use: 'Conecta guias, soluções e páginas de consideração com imagens e links. Use para a jornada de inbound, sem cards repetindo a home.',
  },
  'nav.bar': {
    family: 'nav',
    label: 'Navegação',
    use: 'Uma barra por página, com logo, destinos e CTA. No celular, logo e Menu ficam na mesma linha; links e CTA entram no painel acessível. A proporção do logo medido define a altura padrão; logoHeight só a substitui a pedido e é limitado a 48 px no cabeçalho compacto. O renderer recolhe a navegação quando faltar espaço, em todas as variantes.',
    singleton: true,
  },
  'hero.split': {
    family: 'hero',
    label: 'Hero dividido',
    use: 'Abertura assimétrica com imagem ao lado. Padrão para site com identidade visual.',
    variance: [5, 10],
    singleton: true,
  },
  'hero.statement': {
    family: 'hero',
    label: 'Hero declaração',
    use: 'Abertura tipográfica sem imagem. Bom para marcas editoriais ou quando não há foto boa.',
    variance: [1, 7],
    singleton: true,
  },
  'proof.logos': {
    family: 'proof',
    label: 'Muro de logos',
    use: 'Prova social por marcas atendidas. Vai logo abaixo do hero.',
  },
  'proof.stats': {
    family: 'proof',
    label: 'Números',
    use: 'Dois a quatro números concretos do negócio.',
  },
  'proof.testimonial': {
    family: 'proof',
    label: 'Depoimento',
    use: 'Uma citação real de cliente com nome e cargo.',
  },
  'feature.bento': {
    family: 'feature',
    label: 'Grade de recursos',
    use: 'Serviços ou diferenciais em grade irregular.',
  },
  'feature.numbered': {
    family: 'feature',
    label: 'Grade numerada',
    use: 'Lista editorial de problemas ou serviços, sem numeração decorativa.',
  },
  'narrative.steps': {
    family: 'narrative',
    label: 'Passos',
    use: 'Como funciona, em sequência.',
  },
  'narrative.split': {
    family: 'narrative',
    label: 'Lista com foto',
    use: 'Lista de serviços ao lado de uma foto. Cena gerada entra com legenda de inspiração, nunca como registro da equipe.',
  },
  'editorial.facts': {
    family: 'editorial',
    label: 'Sobre com fatos',
    use: 'Bloco "sobre" com parágrafo e pares rótulo e valor: onde atende, horário, contato, marcas. Pode ser escuro.',
  },
  'faq.accordion': {
    family: 'faq',
    label: 'Perguntas frequentes',
    use: 'Dúvidas reais. Ajuda em busca e em conversão.',
  },
  'cta.band': {
    family: 'cta',
    label: 'Faixa de chamada',
    use: 'Convite direto para ação, com WhatsApp quando houver.',
  },
  'form.lead': {
    family: 'form',
    label: 'Formulário',
    use: 'Captura de lead com campos configuráveis e consentimento LGPD.',
  },
  'editorial.text': {
    family: 'editorial',
    label: 'Texto',
    use: 'Bloco de texto corrido para páginas institucionais.',
  },
  'editorial.postList': {
    family: 'editorial',
    label: 'Lista de posts',
    use: 'Índice do blog. Use na página /blog.',
    singleton: true,
  },
  'editorial.postBody': {
    family: 'editorial',
    label: 'Corpo do post',
    use: 'Conteúdo de um post. Use apenas em páginas do tipo post.',
    singleton: true,
  },
  'media.gallery': {
    family: 'media',
    label: 'Galeria',
    use: 'Duas a oito fotos em grade. Fotos do negócio ou cenas geradas identificadas como inspiração na legenda.',
  },
  'media.image': {
    family: 'media',
    label: 'Imagem',
    use: 'Uma foto grande com legenda. Serve para o upload do operador e para a cena gerada que ilustra a página.',
  },
  'media.map': {
    family: 'media',
    label: 'Mapa',
    use: 'Endereço com mapa embutido, carregado sob demanda.',
  },
  'pricing.table': {
    family: 'pricing',
    label: 'Planos',
    use: 'Tabela de preços ou pacotes.',
  },
  'signature.composition': {
    family: 'signature',
    label: 'Composição autoral',
    use: 'Seção exclusiva do cliente. Traduza o elemento-assinatura em uma composição útil com duas fotos geradas, papéis distintos e conteúdo confirmado. O layout precisa ser o da estrutura escolhida; não copie a mesma organização para outro projeto.',
    singleton: true,
  },
  'footer.compact': {
    family: 'footer',
    label: 'Rodapé',
    use: 'Rodapé com links e aviso legal. Uma por página.',
    singleton: true,
  },
};

/**
 * Layout que o componente aplica quando as props não trazem `layout`. A
 * gramática da vibe compara `tipo:layout`, então um bloco sem escolha
 * explícita precisa ser lido pelo que o renderer realmente mostra. Hero e
 * navegação caem na composição do perfil e são resolvidos em lib/taste/metrics.
 */
export const DEFAULT_LAYOUT: Record<BlockType, string> = {
  'nav.bar': 'bar',
  'hero.split': 'split',
  'hero.statement': 'left',
  'proof.logos': 'rail',
  'proof.stats': 'strip',
  'proof.testimonial': 'quote',
  'feature.numbered': 'ledger',
  'feature.bento': 'mosaic',
  'feature.explorer': 'showroom',
  'narrative.steps': 'timeline',
  'narrative.split': 'split',
  'editorial.resources': 'feature',
  'editorial.facts': 'split',
  'editorial.text': 'narrow',
  'editorial.postList': 'grid',
  'editorial.postBody': 'default',
  'faq.accordion': 'split',
  'cta.band': 'band',
  'form.lead': 'split',
  'media.gallery': 'grid',
  'media.image': 'wide',
  'media.map': 'split',
  'pricing.table': 'cards',
  'signature.composition': 'decision-path',
  'footer.compact': 'split',
};

export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];

export function isBlockType(value: string): value is BlockType {
  return value in blockSchemas;
}

export function familyOf(type: string): Family | null {
  return isBlockType(type) ? blockMeta[type].family : null;
}

const typeName = (value: unknown): string => {
  if (value === 'boolean') return 'bool';
  if (value === 'integer') return 'int';
  if (value === 'number') return 'num';
  return typeof value === 'string' ? value : 'valor';
};

/** Resume campos e limites do schema para evitar consultas e tentativas extras. */
function summarize(schema: Record<string, unknown>, depth = 0): string {
  const props = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((schema.required ?? []) as string[]);
  return Object.entries(props)
    .filter(
      ([key]) =>
        key !== 'anchor' && key !== 'presentation' && key !== 'textStyles',
    )
    .map(([key, def]) => {
      const opt = required.has(key) && !('default' in def) ? '' : '?';
      const minItems = typeof def.minItems === 'number' ? def.minItems : 0;
      const maxItems =
        typeof def.maxItems === 'number' ? String(def.maxItems) : '∞';
      const range =
        typeof def.minItems === 'number' || typeof def.maxItems === 'number'
          ? `[${minItems}..${maxItems}]`
          : '[]';
      const choices = Array.isArray(def.enum)
        ? `(${(def.enum as string[]).join('|')})`
        : '';
      if (def.type === 'array' && def.items && typeof def.items === 'object') {
        const items = def.items as Record<string, unknown>;
        if (items.type === 'object')
          return `${key}${opt}${range}{${summarize(items, depth + 1)}}`;
        return `${key}${opt}${range}${items.type === 'string' ? (typeof items.maxLength === 'number' ? `≤${items.maxLength}` : '') : `:${typeName(items.type)}`}`;
      }
      if (def.type === 'object')
        return `${key}${opt}{${summarize(def, depth + 1)}}`;
      if (def.type === 'string')
        return `${key}${opt}${choices}${typeof def.maxLength === 'number' ? `≤${def.maxLength}` : ''}${key === 'subtext' ? '/20palavras' : ''}`;
      if (def.type === 'integer' || def.type === 'number')
        return `${key}${opt}:${typeName(def.type)}[${typeof def.minimum === 'number' ? def.minimum : '-∞'}..${typeof def.maximum === 'number' ? def.maximum : '∞'}]`;
      return `${key}${opt}:${typeName(def.type)}${choices}`;
    })
    .join(depth ? ', ' : '; ');
}

/** Layouts que mudam a proporção exibida. O recorte é object-cover. */
const IMAGE_LAYOUTS: Partial<Record<BlockType, string[]>> = {
  'hero.split': ['split', 'cover', 'poster', 'editorial', 'offset', 'atelier'],
  'narrative.split': ['split', 'reverse', 'overlap', 'editorial'],
  'media.image': ['wide', 'bleed', 'portrait', 'offset'],
  'feature.bento': [],
  'feature.explorer': [],
  'media.gallery': [],
  'editorial.resources': [],
  'signature.composition': [...SIGNATURE_LAYOUTS],
};

/** Diz em que proporção a foto será exibida, por variante de layout. */
function ratioHint(type: BlockType): string {
  const layouts = IMAGE_LAYOUTS[type];
  if (!layouts) return '';
  if (!layouts.length) return ` [foto ${expectedRatio(type)}]`;
  const groups = new Map<string, string[]>();
  for (const layout of layouts) {
    const ratio = expectedRatio(type, layout);
    groups.set(ratio, [...(groups.get(ratio) ?? []), layout]);
  }
  const parts = [...groups].map(
    ([ratio, names]) => `${ratio} em ${names.join('/')}`,
  );
  return ` [foto ${parts.join(', ')}]`;
}

/**
 * Papel do bloco na gramática da vibe. Sem esta marcação o agente escolhia
 * pelo nome e todas as vibes convergiam para as mesmas seções.
 */
function grammarRole(
  type: BlockType,
  vibe: Vibe,
  design?: { version?: number; structure?: StructureKey },
): string {
  const grammar = structureGrammar(vibe, design);
  const belongs = (list: readonly string[]) =>
    list.filter((entry) => entry.startsWith(`${type}:`));
  const roles: string[] = [];
  const opening = belongs(grammar.openings);
  if (opening.length) roles.push(`abertura da home em ${opening.join('/')}`);
  const protagonist = belongs(grammar.protagonists);
  if (protagonist.length)
    roles.push(`protagonista da home em ${protagonist.join('/')}`);
  const inner = belongs(grammar.innerOpenings);
  if (inner.length) roles.push(`abertura interna em ${inner.join('/')}`);
  const closing = belongs(grammar.closings);
  if (closing.length) roles.push(`fechamento em ${closing.join('/')}`);
  const avoid = belongs(grammar.avoid);
  if (avoid.length) roles.push(`evite ${avoid.join('/')}`);
  return roles.length ? ` [vibe: ${roles.join('; ')}]` : '';
}

/** Catálogo com uso e props de cada bloco, injetado no prompt do agente. */
export function catalogForPrompt(
  options: {
    fullSchema?: boolean;
    vibe?: Vibe;
    design?: { version?: number; structure?: StructureKey };
  } = {},
): string {
  const { vibe, design } = options;
  return (
    `Comum a todos: anchor?; textStyles? [{field, size?: -2|-1|0|1|2, color?: #RRGGBB}] (até 40, por campo de texto; contraste ≥4,5:1); presentation? { ${summarize(z.toJSONSchema(presentation.unwrap()) as Record<string, unknown>, 1)} }. ? = opcional; ≤ = máximo de caracteres.\n` +
    BLOCK_TYPES.map((type) => {
      const json = z.toJSONSchema(blockSchemas[type]) as Record<
        string,
        unknown
      >;
      // O uso vem junto: sem ele o agente ignora explorer e resources, que são
      // justamente as seções que sustentam uma home com fotos.
      return `${type} · ${blockMeta[type].use}${ratioHint(type)}${vibe ? grammarRole(type, vibe, design) : ''}\n  ${options.fullSchema ? JSON.stringify(json) : summarize(json)}`;
    }).join('\n')
  );
}
