import { z } from 'zod';

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
  'footer',
] as const;

export type Family = (typeof FAMILIES)[number];

const anchor = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .max(64)
  .optional();

const link = z.object({
  label: z.string().min(1).max(40),
  href: z.string().min(1),
});

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
    logoText: z
      .string()
      .min(1)
      .max(24)
      .describe('Nome exibido quando o cliente não tem logo enviado.'),
    links: z.array(link).max(5).default([]),
    cta: link.optional(),
  }),

  'hero.split': z.object({
    anchor,
    layout: z.enum(['split', 'editorial']).optional(),
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
    eyebrow: z.string().max(48).optional(),
    headline: z.string().min(4).max(90),
    subtext: z.string().max(160).optional(),
    cta: link,
  }),

  'proof.logos': z.object({
    anchor,
    title: z.string().max(80).optional(),
    logos: z.array(z.string().max(40)).min(3).max(10),
  }),

  'proof.stats': z.object({
    anchor,
    items: z
      .array(z.object({ value: z.string().max(12), label: z.string().max(60) }))
      .min(2)
      .max(4),
  }),

  'proof.testimonial': z.object({
    anchor,
    quote: z.string().min(20).max(320),
    author: z.string().max(60),
    role: z.string().max(80).optional(),
  }),

  'feature.numbered': z.object({
    anchor,
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    lead: z.string().max(200).optional(),
    items: z
      .array(
        z.object({
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
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    items: z
      .array(
        z.object({
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
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    steps: z
      .array(z.object({ title: z.string().max(60), body: z.string().max(220) }))
      .min(2)
      .max(5),
  }),

  'narrative.split': z.object({
    anchor,
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    items: z
      .array(
        z.object({
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

  'editorial.facts': z.object({
    anchor,
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
    title: z.string().min(4).max(90),
    items: z
      .array(z.object({ q: z.string().max(140), a: z.string().max(600) }))
      .min(2)
      .max(10),
  }),

  'cta.band': z.object({
    anchor,
    title: z.string().min(4).max(90),
    body: z.string().max(200).optional(),
    cta: link,
    whatsapp: z.boolean().default(false),
  }),

  'form.lead': z.object({
    anchor,
    title: z.string().min(4).max(90),
    body: z.string().max(200).optional(),
    fields: z.array(field).min(1).max(8),
    submitLabel: z.string().max(40).default('Enviar'),
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
    title: z.string().max(90).optional(),
    body: z.string().min(20).max(4000),
  }),

  'editorial.postList': z.object({
    anchor,
    title: z.string().min(2).max(90),
    limit: z.number().int().min(1).max(24).default(9),
  }),

  'editorial.postBody': z.object({
    anchor,
    body: z.string().min(20).max(30000),
  }),

  'media.gallery': z.object({
    anchor,
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
    src: z.url().startsWith('http'),
    alt: z.string().max(140),
    caption: z.string().max(160).optional(),
  }),

  'media.map': z.object({
    anchor,
    title: z.string().max(90).optional(),
    address: z.string().max(200),
    query: z.string().max(200),
  }),

  'pricing.table': z.object({
    anchor,
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
    logoText: z.string().min(1).max(24),
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
  'nav.bar': {
    family: 'nav',
    label: 'Navegação',
    use: 'Barra superior. Uma por página.',
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
    use: 'Lista de serviços ao lado de uma foto real. Use quando houver imagem do trabalho ou da equipe.',
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
    use: 'Fotos reais do negócio.',
  },
  'media.image': {
    family: 'media',
    label: 'Imagem',
    use: 'Uma foto grande com legenda. Use quando o operador mandar uma imagem que não é do hero.',
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
  'footer.compact': {
    family: 'footer',
    label: 'Rodapé',
    use: 'Rodapé com links e aviso legal. Uma por página.',
    singleton: true,
  },
};

export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];

export function isBlockType(value: string): value is BlockType {
  return value in blockSchemas;
}

export function familyOf(type: string): Family | null {
  return isBlockType(type) ? blockMeta[type].family : null;
}

const typeName = (value: unknown): string =>
  typeof value === 'string' ? value : 'string';

/** Resume um schema JSON em uma linha legível: `campo: tipo (limites)`. */
function summarize(schema: Record<string, unknown>, depth = 0): string {
  const props = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((schema.required ?? []) as string[]);
  return Object.entries(props)
    .filter(([key]) => key !== 'anchor')
    .map(([key, def]) => {
      const opt = required.has(key) ? '' : '?';
      const limits: string[] = [];
      if (typeof def.minLength === 'number')
        limits.push(`min ${def.minLength}`);
      if (typeof def.maxLength === 'number')
        limits.push(`max ${def.maxLength}`);
      const minItems = typeof def.minItems === 'number' ? def.minItems : 0;
      const maxItems =
        typeof def.maxItems === 'number' ? String(def.maxItems) : '∞';
      if (
        typeof def.minItems === 'number' ||
        typeof def.maxItems === 'number'
      ) {
        limits.push(`${minItems} a ${maxItems} itens`);
      }
      if (Array.isArray(def.enum))
        limits.push((def.enum as string[]).join('|'));
      const lim = limits.length ? ` (${limits.join(', ')})` : '';
      if (def.type === 'array' && def.items && typeof def.items === 'object') {
        const items = def.items as Record<string, unknown>;
        if (items.type === 'object')
          return `${key}${opt}: [{ ${summarize(items, depth + 1)} }]${lim}`;
        return `${key}${opt}: [${typeName(items.type)}]${lim}`;
      }
      if (def.type === 'object')
        return `${key}${opt}: { ${summarize(def, depth + 1)} }`;
      return `${key}${opt}: ${typeName(def.type)}${lim}`;
    })
    .join(depth ? ', ' : '; ');
}

/** Catálogo com uso e props de cada bloco, injetado no prompt do agente. */
export function catalogForPrompt(): string {
  return (
    'Todos aceitam anchor?: identificador minúsculo, letras/números/hífens, até 64. ? = opcional.\n' +
    BLOCK_TYPES.map((type) => {
      const json = z.toJSONSchema(blockSchemas[type]) as Record<
        string,
        unknown
      >;
      return `${type}: ${summarize(json)}`;
    }).join('\n')
  );
}
