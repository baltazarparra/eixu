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
    logoText: z.string().min(1).max(24),
    links: z.array(link).max(5).default([]),
    cta: link.optional(),
  }),

  'hero.split': z.object({
    eyebrow: z.string().max(48).optional(),
    headline: z.string().min(4).max(90),
    subtext: z.string().max(160).optional(),
    cta: link,
    secondary: link.optional(),
    image: z.string().optional(),
    imageAlt: z.string().max(140).optional(),
  }),

  'hero.statement': z.object({
    eyebrow: z.string().max(48).optional(),
    headline: z.string().min(4).max(90),
    subtext: z.string().max(160).optional(),
    cta: link,
  }),

  'proof.logos': z.object({
    title: z.string().max(80).optional(),
    logos: z.array(z.string().max(40)).min(3).max(10),
  }),

  'proof.stats': z.object({
    items: z
      .array(z.object({ value: z.string().max(12), label: z.string().max(60) }))
      .min(2)
      .max(4),
  }),

  'proof.testimonial': z.object({
    quote: z.string().min(20).max(320),
    author: z.string().max(60),
    role: z.string().max(80).optional(),
  }),

  'feature.bento': z.object({
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    items: z
      .array(z.object({ title: z.string().max(60), body: z.string().max(220) }))
      .min(2)
      .max(6),
  }),

  'narrative.steps': z.object({
    eyebrow: z.string().max(48).optional(),
    title: z.string().min(4).max(90),
    steps: z
      .array(z.object({ title: z.string().max(60), body: z.string().max(220) }))
      .min(2)
      .max(5),
  }),

  'faq.accordion': z.object({
    title: z.string().min(4).max(90),
    items: z
      .array(z.object({ q: z.string().max(140), a: z.string().max(600) }))
      .min(2)
      .max(10),
  }),

  'cta.band': z.object({
    title: z.string().min(4).max(90),
    body: z.string().max(200).optional(),
    cta: link,
    whatsapp: z.boolean().default(false),
  }),

  'form.lead': z.object({
    title: z.string().min(4).max(90),
    body: z.string().max(200).optional(),
    fields: z.array(field).min(1).max(8),
    submitLabel: z.string().max(40).default('Enviar'),
    consentText: z.string().max(300).default('Concordo em ser contatado e com o uso dos meus dados conforme a política de privacidade.'),
    whatsappOptIn: z.boolean().default(false),
    redirectTo: z.string().default('/obrigado'),
  }),

  'editorial.text': z.object({
    title: z.string().max(90).optional(),
    body: z.string().min(20).max(4000),
  }),

  'editorial.postList': z.object({
    title: z.string().min(2).max(90),
    limit: z.number().int().min(1).max(24).default(9),
  }),

  'editorial.postBody': z.object({
    body: z.string().min(20).max(30000),
  }),

  'media.gallery': z.object({
    title: z.string().max(90).optional(),
    images: z.array(z.object({ src: z.string(), alt: z.string().max(140) })).min(2).max(8),
  }),

  'media.map': z.object({
    title: z.string().max(90).optional(),
    address: z.string().max(200),
    query: z.string().max(200),
  }),

  'pricing.table': z.object({
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
  'nav.bar': { family: 'nav', label: 'Navegação', use: 'Barra superior. Uma por página.', singleton: true },
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
  'proof.logos': { family: 'proof', label: 'Muro de logos', use: 'Prova social por marcas atendidas. Vai logo abaixo do hero.' },
  'proof.stats': { family: 'proof', label: 'Números', use: 'Dois a quatro números concretos do negócio.' },
  'proof.testimonial': { family: 'proof', label: 'Depoimento', use: 'Uma citação real de cliente com nome e cargo.' },
  'feature.bento': { family: 'feature', label: 'Grade de recursos', use: 'Serviços ou diferenciais em grade irregular.' },
  'narrative.steps': { family: 'narrative', label: 'Passos', use: 'Como funciona, em sequência.' },
  'faq.accordion': { family: 'faq', label: 'Perguntas frequentes', use: 'Dúvidas reais. Ajuda em busca e em conversão.' },
  'cta.band': { family: 'cta', label: 'Faixa de chamada', use: 'Convite direto para ação, com WhatsApp quando houver.' },
  'form.lead': { family: 'form', label: 'Formulário', use: 'Captura de lead com campos configuráveis e consentimento LGPD.' },
  'editorial.text': { family: 'editorial', label: 'Texto', use: 'Bloco de texto corrido para páginas institucionais.' },
  'editorial.postList': { family: 'editorial', label: 'Lista de posts', use: 'Índice do blog. Use na página /blog.', singleton: true },
  'editorial.postBody': { family: 'editorial', label: 'Corpo do post', use: 'Conteúdo de um post. Use apenas em páginas do tipo post.', singleton: true },
  'media.gallery': { family: 'media', label: 'Galeria', use: 'Fotos reais do negócio.' },
  'media.map': { family: 'media', label: 'Mapa', use: 'Endereço com mapa embutido, carregado sob demanda.' },
  'pricing.table': { family: 'pricing', label: 'Planos', use: 'Tabela de preços ou pacotes.' },
  'footer.compact': { family: 'footer', label: 'Rodapé', use: 'Rodapé com links e aviso legal. Uma por página.', singleton: true },
};

export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];

export function isBlockType(value: string): value is BlockType {
  return value in blockSchemas;
}

export function familyOf(type: string): Family | null {
  return isBlockType(type) ? blockMeta[type].family : null;
}

/** Catálogo compacto injetado no prompt da IA. */
export function catalogForPrompt(): string {
  return BLOCK_TYPES.map((type) => {
    const meta = blockMeta[type];
    return `- ${type} (família ${meta.family}): ${meta.use}`;
  }).join('\n');
}
