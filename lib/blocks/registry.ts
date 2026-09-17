import { z } from 'zod';
import { textStylesSchema } from './text-style-schema';
import { elementStylesSchema } from './element-style';
import { contrastRatio, gradientContrast } from './contrast';
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
  'social',
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
    decoration: z
      .enum(['vibe', 'none'])
      .optional()
      .describe(
        'vibe mantém a decoração da direção; none remove lavagem, degradê e motivo desta seção sem escolher uma cor. Exemplo: {"decoration":"none"}.',
      ),
    background: z
      .union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal('transparent')])
      .optional()
      .describe(
        'Cor chapada exclusiva desta seção, ou transparent para remover seu fundo. Remove lavagem, brilho e motivo da vibe; prevalece sobre tone sem mudar a marca; texto com contraste automático.',
      ),
    foreground: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe(
        'Cor do texto desta seção; exige background hex explícito e contraste mínimo de 4,5:1. Omita para contraste automático, inclusive com fundo transparente.',
      ),
    backgroundEnd: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe(
        'Segunda cor de um degradê local. Exige background hex e gradient; as duas extremidades precisam aceitar a mesma cor de texto em 4,5:1. Exemplo: {"background":"#27272a","backgroundEnd":"#3f3f46","gradient":"diagonal"}.',
      ),
    gradient: z
      .enum(['down', 'diagonal', 'right'])
      .optional()
      .describe(
        'Direção do degradê entre background e backgroundEnd: down, diagonal ou right.',
      ),
    motion: z.enum(['none', 'reveal', 'stagger', 'image']).optional(),
    width: z.enum(['narrow', 'normal', 'wide', 'full']).optional(),
    spacing: z.enum(['tight', 'normal', 'airy']).optional(),
    spacingTop: z
      .literal('none')
      .optional()
      .describe(
        'Remove somente o espaço acima da seção, sem reordenar conteúdo nem mudar o respiro inferior.',
      ),
    align: z.enum(['left', 'center', 'offset']).optional(),
    textAlign: z
      .enum(['left', 'center', 'right', 'justify'])
      .optional()
      .describe(
        'Alinhamento de todo o texto da seção. Não muda colunas, ordem, mídia nem posição do grupo.',
      ),
    contentAlign: z
      .enum(['start', 'center', 'end'])
      .optional()
      .describe(
        'Alinha o grupo de conteúdo e seus controles no início, centro ou fim da região disponível. Não muda a ordem de leitura.',
      ),
    elements: elementStylesSchema
      .optional()
      .describe(
        'Ajustes precisos e responsivos em partes internas do bloco: container, conteúdo, títulos, textos, ações, listas, cards, mídia, imagens e formulário. Use quando o pedido não cabe em um campo dedicado do bloco.',
      ),
    edge: z.enum(['none', 'line', 'panel', 'bleed']).optional(),
  })
  .superRefine((value, ctx) => {
    const backgroundHex =
      typeof value.background === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(value.background);
    if ((value.backgroundEnd || value.gradient) && !backgroundHex)
      ctx.addIssue({
        code: 'custom',
        path: ['background'],
        message:
          'backgroundEnd e gradient exigem background em hexadecimal; transparent não forma degradê.',
      });
    if (Boolean(value.backgroundEnd) !== Boolean(value.gradient))
      ctx.addIssue({
        code: 'custom',
        path: [value.backgroundEnd ? 'gradient' : 'backgroundEnd'],
        message:
          'Informe backgroundEnd e gradient juntos para formar o degradê.',
      });
    if (
      value.foreground &&
      (!backgroundHex ||
        contrastRatio(value.foreground, value.background!) < 4.5)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['foreground'],
        message:
          'Informe background e foreground com contraste mínimo de 4,5:1; ou omita foreground para usar contraste automático.',
      });
    if (backgroundHex && value.backgroundEnd && value.gradient) {
      const measured = gradientContrast(
        value.background!,
        value.backgroundEnd,
        value.foreground,
      );
      if (!measured.passesAA)
        ctx.addIssue({
          code: 'custom',
          path: ['backgroundEnd'],
          message: value.foreground
            ? `foreground precisa manter contraste mínimo de 4,5:1 nas duas extremidades; menor razão ${measured.ratio.toFixed(2)}:1.${measured.suggestedEnd ? ` Use backgroundEnd ${measured.suggestedEnd} ou retire foreground para cálculo automático.` : ''}`
            : `As extremidades não aceitam a mesma cor de texto em 4,5:1; menor razão ${measured.ratio.toFixed(2)}:1. Use backgroundEnd ${measured.suggestedEnd ?? value.background}.`,
        });
    }
  })
  .optional();

const imagePresentation = z
  .object({
    frame: z
      .enum(['none', 'default'])
      .optional()
      .describe(
        'none remove fundo, borda, arredondamento, sombra e padding da imagem e de seu box, inclusive a moldura herdada da direção do site. Preserva a posição e o conteúdo.',
      ),
    fit: z
      .enum(['natural', 'cover', 'contain'])
      .optional()
      .describe(
        'natural mostra a imagem inteira na proporção original, sem altura mínima ou máxima que a corte.',
      ),
    width: z
      .literal('container')
      .optional()
      .describe(
        'A imagem ocupa 100% da largura do box atual. Não muda a grade nem o layout da seção.',
      ),
    spacingTop: z
      .literal('none')
      .optional()
      .describe(
        'Remove margem e padding superiores da imagem e de seu box; preserva título, texto e demais itens.',
      ),
  })
  .optional();

const carouselSlide = z.object({
  src: z.url().startsWith('http'),
  alt: z.string().min(5).max(140),
  caption: z.string().max(160).optional(),
});

const carousel = z
  .object({
    autoplay: z
      .boolean()
      .optional()
      .describe(
        'Desligado por padrão. Respeita movimento reduzido e pausa durante interação.',
      ),
    interval: z
      .number()
      .int()
      .min(4)
      .max(12)
      .optional()
      .describe('Intervalo do autoplay em segundos, de 4 a 12.'),
  })
  .optional()
  .describe('Comportamento opcional do carrossel de fotos.');

const field = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/, 'use minúsculas, números e underline'),
  label: z.string().min(1).max(60),
  type: z.enum(['text', 'email', 'tel', 'textarea', 'select']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

const leadFormSchema = z.object({
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
});

const evidenceRef = z
  .string()
  .min(3)
  .max(160)
  .describe(
    'Copie exatamente uma evidência confirmada de brief.evidence que contém este fato.',
  );

export const blockSchemas = {
  'hero.landing': z
    .object({
      anchor,
      presentation,
      textStyles: textStylesSchema.optional(),
      layout: z.enum(['stage', 'form']).default('stage'),
      formAnchor: anchor.default('contato'),
      eyebrow: z.string().max(48).optional(),
      headline: z.string().min(4).max(90),
      subtext: z.string().max(160).optional(),
      cta: link,
      secondary: link.optional(),
      badges: z
        .array(
          z.object({ label: z.string().min(3).max(60), evidence: evidenceRef }),
        )
        .max(3)
        .default([]),
      badgesPlacement: z
        .enum(['cta', 'headline'])
        .default('cta')
        .describe(
          'Onde os selos aparecem: cta sob os botões (padrão) ou headline logo abaixo do título, antes do texto de apoio.',
        ),
      image: z.url().startsWith('http').optional(),
      imageAlt: z.string().min(5).max(140).optional(),
      imagePresentation,
      slides: z
        .array(carouselSlide)
        .min(1)
        .max(5)
        .optional()
        .describe(
          'Fotos adicionais do carrossel, na ordem. image continua sendo a primeira foto e a imagem de carregamento prioritário.',
        ),
      carousel,
      form: leadFormSchema
        .omit({
          anchor: true,
          presentation: true,
          textStyles: true,
          layout: true,
        })
        .extend({ fields: z.array(field).min(2).max(4) })
        .optional(),
    })
    .superRefine((value, ctx) => {
      if (value.image && !value.imageAlt)
        ctx.addIssue({
          code: 'custom',
          path: ['imageAlt'],
          message: 'Descreva a imagem da oferta.',
        });
      if (value.layout === 'stage' && (!value.image || !value.imageAlt))
        ctx.addIssue({
          code: 'custom',
          path: ['image'],
          message: 'stage exige imagem e descrição.',
        });
      if (value.layout === 'form' && !value.form)
        ctx.addIssue({
          code: 'custom',
          path: ['form'],
          message: 'form exige formulário curto.',
        });
      if (value.layout === 'stage' && value.form)
        ctx.addIssue({
          code: 'custom',
          path: ['form'],
          message: 'O formulário embutido pertence somente ao layout form.',
        });
      if (value.layout === 'form' && value.slides?.length)
        ctx.addIssue({
          code: 'custom',
          path: ['slides'],
          message:
            'hero.landing form não aceita carrossel. Use media.gallery com layout carousel logo após a abertura.',
        });
    }),
  'proof.strip': z
    .object({
      anchor,
      presentation,
      textStyles: textStylesSchema.optional(),
      layout: z.enum(['logos', 'numbers']).default('numbers'),
      title: z.string().max(80).optional(),
      items: z
        .array(
          z.object({
            value: z.string().min(1).max(40),
            label: z.string().max(60).optional(),
            evidence: evidenceRef,
          }),
        )
        .min(2)
        .max(6),
    })
    .superRefine((value, ctx) => {
      if (
        (value.layout === 'logos' && value.items.length < 3) ||
        (value.layout === 'numbers' && value.items.length > 4)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['items'],
          message: 'Use 3 a 6 marcas ou 2 a 4 números.',
        });
    }),
  'narrative.statement': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['center', 'split']).default('center'),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(8).max(160),
  }),
  'feature.showcase': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['steps', 'tabs']).default('steps'),
    title: z.string().min(4).max(90),
    body: z.string().max(260).optional(),
    items: z
      .array(
        z.object({
          icon,
          title: z.string().min(2).max(48),
          body: z.string().min(20).max(420),
          image: z.url().startsWith('http'),
          imageAlt: z.string().min(5).max(140),
          cta: link.optional(),
        }),
      )
      .min(2)
      .max(4),
  }),
  'proof.testimonials': z
    .object({
      anchor,
      presentation,
      textStyles: textStylesSchema.optional(),
      layout: z.enum(['grid', 'spotlight']).default('grid'),
      title: z.string().max(90).optional(),
      items: z
        .array(
          z.object({
            quote: z.string().min(12).max(240),
            author: z.string().min(2).max(60),
            role: z.string().min(2).max(60),
            result: z.string().min(3).max(100),
            image: z.url().startsWith('http').optional(),
            imageAlt: z.string().min(5).max(140).optional(),
            evidence: evidenceRef,
          }),
        )
        .min(2)
        .max(3),
    })
    .superRefine((value, ctx) => {
      value.items.forEach((item, index) => {
        if (item.image && !item.imageAlt)
          ctx.addIssue({
            code: 'custom',
            path: ['items', index, 'imageAlt'],
            message: 'Descreva a foto real da pessoa.',
          });
      });
    }),
  'nav.bar': z.object({
    stickyCta: z.boolean().optional(),
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

  'hero.split': z
    .object({
      anchor,
      presentation,
      textStyles: textStylesSchema.optional(),
      layout: z
        .enum([
          'brand',
          'brand-frame',
          'info',
          'split',
          'cover',
          'poster',
          'editorial',
          'offset',
          'atelier',
        ])
        .optional(),
      imagePosition: z.enum(['left', 'right']).optional(),
      imageFit: z.enum(['cover', 'contain']).optional(),
      focalPoint: z
        .enum(['center', 'top', 'bottom', 'left', 'right'])
        .optional(),
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
        .describe(
          'Até 3 selos curtos de confiança. bulletsPlacement decide onde.',
        ),
      bulletsPlacement: z
        .enum(['cta', 'headline'])
        .default('cta')
        .describe(
          'Onde os selos aparecem: cta sob os botões (padrão) ou headline logo abaixo do título, antes do texto de apoio.',
        ),
      image: z
        .url()
        .startsWith('http')
        .optional()
        .describe('URL http(s) de uma imagem real. Omita se não tiver.'),
      imageAlt: z.string().max(140).optional(),
      slides: z
        .array(carouselSlide)
        .min(1)
        .max(5)
        .optional()
        .describe(
          'Fotos adicionais do carrossel, na ordem. image continua sendo a primeira foto e a imagem de carregamento prioritário.',
        ),
      carousel,
    })
    .superRefine((value, ctx) => {
      // `cover` já existia antes do perfil v8 e há snapshots sem `imageAlt`.
      // O pre-flight da Comercial nova exige ambos sem invalidar esse legado.
      const imageHero =
        value.layout === 'brand' || value.layout === 'brand-frame';
      if (imageHero && !value.image)
        ctx.addIssue({
          code: 'custom',
          path: ['image'],
          message: `O layout ${value.layout} exige uma imagem de fundo.`,
        });
      if (imageHero && !value.imageAlt)
        ctx.addIssue({
          code: 'custom',
          path: ['imageAlt'],
          message: `Descreva a imagem de fundo do layout ${value.layout}.`,
        });
      if (value.layout === 'info' && (value.image || value.slides?.length))
        ctx.addIssue({
          code: 'custom',
          path: ['image'],
          message:
            'O layout info é uma abertura simples de texto. Use brand ou cover para abrir com fotografia.',
        });
      if (!value.slides?.length) return;
      if (!value.image || !value.imageAlt)
        ctx.addIssue({
          code: 'custom',
          path: ['image'],
          message:
            'O carrossel exige image e imageAlt como primeira foto da abertura.',
        });
      if (!value.layout)
        ctx.addIssue({
          code: 'custom',
          path: ['layout'],
          message:
            'Defina split, poster, editorial ou offset para usar carrossel neste hero.',
        });
      if (
        value.layout === 'brand' ||
        value.layout === 'info' ||
        value.layout === 'cover' ||
        value.layout === 'atelier'
      )
        ctx.addIssue({
          code: 'custom',
          path: ['slides'],
          message: `hero.split ${value.layout} não aceita carrossel. Use media.gallery com layout carousel logo após a abertura.`,
        });
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
    layout: z
      .enum(['mosaic', 'gallery', 'stack', 'showcase', 'featured-masonry'])
      .optional()
      .describe(
        'featured-masonry coloca o primeiro item na largura inteira do container e distribui os demais em colunas masonry responsivas.',
      ),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    items: z
      .array(
        z.object({
          icon,
          title: z.string().max(60),
          body: z.string().max(420),
          href: z
            .string()
            .min(1)
            .optional()
            .describe(
              'Destino opcional do card, como /padaria-e-confeitaria. Quando existe, foto, título e texto formam um único link acessível.',
            ),
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
      arrangement: z
        .enum(['default', 'focus-full'])
        .optional()
        .describe(
          'focus-full coloca o item focus em 100% da largura do container e distribui os demais em colunas masonry logo abaixo, preservando tipo, layout, itens e papéis. Use quando o operador pedir destaque total para um item da seção.',
        ),
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
            imagePresentation,
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

  'cta.band': z
    .object({
      image: z
        .url()
        .startsWith('http')
        .optional()
        .describe(
          'Foto 16:9 da faixa. Em cover, ocupa o fundo inteiro sob uma camada de contraste; nos demais layouts, continua separada do texto.',
        ),
      imageAlt: z.string().min(5).max(140).optional(),
      anchor,
      presentation,
      textStyles: textStylesSchema.optional(),
      layout: z
        .enum(['band', 'poster', 'split', 'minimal', 'cover'])
        .optional()
        .describe(
          'cover aplica image como fundo da faixa; os demais layouts preservam a foto separada do texto.',
        ),
      title: z.string().min(4).max(90),
      body: z.string().max(600).optional(),
      items: z
        .array(
          z.object({
            icon: z
              .enum(ICON_NAMES)
              .describe(
                'Símbolo semântico para identificar o contato ou endereço; não aceita SVG arbitrário.',
              ),
            label: z.string().min(2).max(100),
            href: z
              .string()
              .min(1)
              .optional()
              .describe(
                'Destino opcional, como /go/wa?from=/, tel:+5511999999999 ou uma âncora de localização.',
              ),
          }),
        )
        .min(1)
        .max(4)
        .optional()
        .describe(
          'Até quatro contatos ou referências curtas, cada um com ícone significativo e link opcional.',
        ),
      cta: link,
      whatsapp: z.boolean().default(false),
    })
    .superRefine((value, ctx) => {
      if (value.layout !== 'cover') return;
      if (!value.image)
        ctx.addIssue({
          code: 'custom',
          path: ['image'],
          message: 'O layout cover exige uma imagem de fundo.',
        });
      if (!value.imageAlt)
        ctx.addIssue({
          code: 'custom',
          path: ['imageAlt'],
          message: 'Descreva a imagem de fundo do layout cover.',
        });
    }),

  'form.lead': leadFormSchema,

  'editorial.text': z
    .object({
      anchor,
      presentation,
      textStyles: textStylesSchema.optional(),
      layout: z
        .enum(['narrow', 'lead', 'columns', 'bridge', 'threshold', 'split'])
        .optional(),
      title: z.string().max(90).optional(),
      lead: z
        .string()
        .trim()
        .min(3)
        .max(180)
        .optional()
        .describe(
          'Informação principal da unidade, como endereço confirmado. No bridge fica no painel da marca; não invente dados para preencher.',
        ),
      body: z.string().min(20).max(4000),
      image: z.url().startsWith('http').optional(),
      imageAlt: z.string().trim().min(3).max(140).optional(),
      imagePosition: z.enum(['left', 'right']).optional(),
      imageFit: z.enum(['cover', 'contain']).optional(),
    })
    .superRefine((value, ctx) => {
      if (
        (value.layout === 'bridge' || value.layout === 'threshold') &&
        !value.title?.trim()
      )
        ctx.addIssue({
          code: 'custom',
          path: ['title'],
          message:
            'A ligação institucional exige o nome da unidade ou do negócio.',
        });
      if (value.layout === 'split') {
        for (const field of ['image', 'imageAlt'] as const)
          if (!value[field])
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message:
                'A divisão meio a meio exige imagem e texto alternativo.',
            });
      } else {
        for (const field of [
          'image',
          'imageAlt',
          'imagePosition',
          'imageFit',
        ] as const)
          if (value[field] !== undefined)
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message:
                'Use layout split para exibir a imagem ao lado do texto.',
            });
      }
    }),

  'social.follow': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z.enum(['banner', 'profile', 'gallery']).optional(),
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    body: z.string().max(220).optional(),
    images: z
      .array(
        z.object({
          src: z.url().startsWith('http'),
          alt: z.string().min(3).max(140),
        }),
      )
      .max(6)
      .optional()
      .describe(
        'Até seis fotos do acervo para a variante gallery. Os links das redes vêm somente do cadastro do tenant.',
      ),
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
    layout: z
      .enum(['grid', 'masonry', 'filmstrip', 'collage', 'carousel'])
      .optional(),
    title: z.string().max(90).optional(),
    images: z.array(carouselSlide).min(2).max(8),
  }),

  'media.image': z.object({
    anchor,
    presentation,
    textStyles: textStylesSchema.optional(),
    layout: z
      .enum([
        'wide',
        'bleed',
        'portrait',
        'offset',
        'immersive',
        'statement',
        'caption',
      ])
      .optional(),
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
  'proof.testimonials': {
    family: 'proof',
    label: 'Depoimentos confirmados',
    use: 'Duas a três citações literais, com pessoa, cargo e resultado presentes na mesma evidence. Foto somente enviada e confirmada; nunca gere um cliente.',
  },
  'feature.showcase': {
    family: 'feature',
    label: 'Produto em uso',
    use: 'Duas a quatro aplicações ilustradas; steps alterna texto e foto, tabs permite seleção por teclado. CTAs seguem a ação única.',
  },
  'narrative.statement': {
    family: 'narrative',
    label: 'Problema ou promessa',
    use: 'Uma frase grande explica o problema ou benefício real, sem inventar promessa.',
  },
  'proof.strip': {
    family: 'proof',
    label: 'Faixa de prova',
    use: 'Marcas ou números confirmados. Cada item copia evidence do briefing, incluindo valor e rótulo. Sem evidência, omita.',
  },
  'hero.landing': {
    family: 'hero',
    label: 'Abertura de conversão',
    use: 'Benefício e ação única; stage mostra a imagem abaixo da oferta e aceita slides para um carrossel, mantendo image como primeira foto. form embute o formulário e não aceita carrossel. imagePresentation vale para todas as fotos; frame none remove o box decorativo e fit natural mostra a imagem inteira. Selos somente com evidence do briefing, sob os botões ou sob o título por badgesPlacement.',
    singleton: true,
  },
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
    use: 'Abertura assimétrica com imagem ao lado. brand cobre a tela com a foto e assenta o texto sobre ela; brand-frame emoldura a mesma foto no topo e leva o texto para baixo dela, sobre a cor da marca. Os dois exigem image e imageAlt. split, poster, editorial e offset aceitam slides para carrossel, mantendo image como primeira foto; cover, atelier, brand e brand-frame não aceitam e usam media.gallery carousel como alternativa. imageFit e focalPoint valem para todas as fotos. Selos sob os botões ou sob o título, por bulletsPlacement.',
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
    use: 'Serviços ou diferenciais em grade irregular. gallery distribui os itens em grade regular; stack empilha linhas de largura cheia com a foto ao lado do texto; featured-masonry destaca o primeiro item em largura total e organiza os demais em masonry responsiva. Cada item aceita href para que o card inteiro navegue a uma página ou âncora, sem trocar de bloco.',
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
    use: 'Convite direto para ação. cover usa a foto 16:9 como fundo com contraste; band, split, poster e minimal mantêm a foto separada. items associa até quatro contatos ou endereços a ícones semânticos e links opcionais. O atalho principal usa WhatsApp quando houver.',
  },
  'form.lead': {
    family: 'form',
    label: 'Formulário',
    use: 'Captura de lead com campos configuráveis e consentimento LGPD.',
  },
  'editorial.text': {
    family: 'editorial',
    label: 'Texto',
    use: 'Texto institucional. bridge liga o hero aos setores: nome e lead confirmado em painel da marca, texto ao lado, sem CTA. threshold faz a mesma ligação em outra forma: nome em faixa de largura cheia sobre um fio, lead logo abaixo e o texto em duas colunas; também exige title e não aceita CTA nem imagem. split divide em metades iguais a foto e todo o texto existente, sem trocar o bloco nem exigir botão; image/imageAlt são obrigatórios, imagePosition escolhe o lado e imageFit contain preserva a foto inteira. narrow, lead e columns mantêm o texto corrido.',
  },
  'social.follow': {
    family: 'social',
    label: 'Redes sociais',
    use: 'Presença social usando exclusivamente os perfis cadastrados do tenant. banner é uma faixa direta, profile dá protagonismo aos links e gallery aceita até três fotos do acervo.',
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
    use: 'Duas a oito fotos. carousel mostra uma por vez em 4:3, com controles; grid, masonry, filmstrip e collage preservam suas composições. Fotos do negócio ou cenas geradas identificadas como inspiração na legenda.',
  },
  'media.image': {
    family: 'media',
    label: 'Imagem',
    use: 'Uma foto grande com legenda. Serve para o upload do operador e para a cena gerada que ilustra a página.',
  },
  'media.map': {
    family: 'media',
    label: 'Mapa',
    use: 'Endereço com mapa embutido, carregado sob demanda. Na Comercial v8, renderiza todas as unidades cadastradas com endereço, telefone e horário.',
  },
  'pricing.table': {
    family: 'pricing',
    label: 'Planos',
    use: 'Tabela de preços ou pacotes.',
  },
  'signature.composition': {
    family: 'signature',
    label: 'Composição autoral',
    use: 'Seção exclusiva do cliente. Traduza o elemento-assinatura em uma composição útil com duas fotos da biblioteca, geradas ou enviadas, papéis distintos e conteúdo confirmado. O layout precisa ser o da estrutura escolhida; não copie a mesma organização para outro projeto.',
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
  'proof.testimonials': 'grid',
  'feature.showcase': 'steps',
  'narrative.statement': 'center',
  'proof.strip': 'numbers',
  'hero.landing': 'stage',
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
  'social.follow': 'banner',
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

/**
 * Layout que o visitante realmente vê. Sem `layout` nas props, hero e navegação
 * caem na composição do perfil e os demais no padrão do componente.
 *
 * O renderer e o pre-flight precisam da mesma leitura: o wrapper publica este
 * valor em `data-layout` e o CSS mira por ele, então divergir aqui faria uma
 * regra de composição valer para uma leitura e o estilo para outra.
 */
export function resolveBlockLayout(
  block: { type: string; props: Record<string, unknown> },
  design?: { heroComposition?: string; navigation?: string },
): string {
  if (typeof block.props.layout === 'string' && block.props.layout)
    return block.props.layout;
  if (block.type === 'hero.split') return design?.heroComposition ?? 'split';
  if (block.type === 'nav.bar') return design?.navigation ?? 'bar';
  return isBlockType(block.type)
    ? (DEFAULT_LAYOUT[block.type] ?? 'default')
    : 'default';
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
  'editorial.text': ['split'],
  'hero.landing': ['stage', 'form'],
  'feature.showcase': [],
  'proof.testimonials': [],
  'cta.band': [],
  'hero.split': [
    'brand',
    'brand-frame',
    'split',
    'cover',
    'poster',
    'editorial',
    'offset',
    'atelier',
  ],
  'narrative.split': ['split', 'reverse', 'overlap', 'editorial'],
  'media.image': [
    'wide',
    'bleed',
    'portrait',
    'offset',
    'immersive',
    'statement',
    'caption',
  ],
  'social.follow': [],
  'feature.bento': [],
  'feature.explorer': [],
  'media.gallery': [],
  'editorial.resources': [],
  'signature.composition': [...SIGNATURE_LAYOUTS],
};

/**
 * Variantes que o operador pode escolher para a mesma foto. O plano de
 * pendências oferece só as que existem no schema; hero e assinatura ficam
 * presas à estrutura escolhida e não entram como alternativa.
 */
export function imageLayouts(type: string): string[] {
  if (type.startsWith('hero.') || type === 'signature.composition') return [];
  return [...(IMAGE_LAYOUTS[type as BlockType] ?? [])];
}

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
  expansions: readonly string[] = [],
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
  const expansion = belongs(expansions);
  if (expansion.length)
    roles.push(`aprofundamento da home em ${expansion.join('/')}`);
  return roles.length ? ` [vibe: ${roles.join('; ')}]` : '';
}

/** Catálogo com uso e props de cada bloco, injetado no prompt do agente. */
export function catalogForPrompt(
  options: {
    fullSchema?: boolean;
    vibe?: Vibe;
    design?: { version?: number; structure?: StructureKey };
    expansions?: readonly string[];
  } = {},
): string {
  const { vibe, design, expansions = [] } = options;
  return (
    `Comum a todos: anchor?; textStyles? [{field, size?: -2|-1|0|1|2, color?: #RRGGBB, align?: left|center|right|justify, fontSize?: 10..160, fontWeight?: 300..900, lineHeight?: 0.8..2.2, letterSpacing?: -4..16, transform?, fontStyle?}] (até 40, por campo; contraste ≥4,5:1); presentation? { ${summarize(z.toJSONSchema(presentation.unwrap()) as Record<string, unknown>, 1)} }. presentation.elements ajusta partes internas com target semântico, viewport e propriedades visuais seguras. Exemplos: {"decoration":"none"}; {"background":"#27272a","backgroundEnd":"#3f3f46","gradient":"diagonal"}; {"textAlign":"right","contentAlign":"end"}; {"elements":[{"target":"item","index":1,"viewport":"desktop","order":-1,"widthPercent":50}]}. ? = opcional; ≤ = máximo de caracteres.\n` +
    [...BLOCK_TYPES]
      .sort((a, b) => {
        if (vibe !== 'landing') return 0;
        const first = [
          'nav.bar',
          'hero.landing',
          'proof.strip',
          'narrative.statement',
          'feature.showcase',
          'feature.bento',
          'narrative.steps',
          'proof.testimonials',
          'pricing.table',
          'faq.accordion',
          'form.lead',
          'cta.band',
          'footer.compact',
        ];
        return (
          (first.indexOf(a) < 0 ? 99 : first.indexOf(a)) -
          (first.indexOf(b) < 0 ? 99 : first.indexOf(b))
        );
      })
      .map((type) => {
        const json = z.toJSONSchema(blockSchemas[type]) as Record<
          string,
          unknown
        >;
        // O uso vem junto: sem ele o agente ignora explorer e resources, que são
        // justamente as seções que sustentam uma home com fotos.
        return `${type} · ${blockMeta[type].use}${ratioHint(type)}${vibe ? grammarRole(type, vibe, design, expansions) : ''}\n  ${options.fullSchema ? JSON.stringify(json) : summarize(json)}`;
      })
      .join('\n')
  );
}
