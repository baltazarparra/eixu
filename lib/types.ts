export type PageType = 'page' | 'paid_lp' | 'post' | 'thank_you';

export type Dials = {
  /** 1 simetria perfeita, 10 caos autoral. */
  variance: number;
  /** 1 estático, 10 cinematográfico. */
  motion: number;
  /** 1 galeria de arte, 10 cockpit. */
  density: number;
};

export type Brand = {
  accent?: string;
  ink?: string;
  paper?: string;
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  font?: 'sans' | 'serif' | 'mono';
  logoText?: string;
  /** URL pública do logo enviado pelo painel. Nav e rodapé usam quando existe. */
  logoUrl?: string;
};

/**
 * Direção de imagem do cliente. Definida uma vez pelo agente a partir do
 * briefing e da marca; todo prompt de geração é composto a partir dela, que é
 * o que mantém as imagens do site coerentes entre si.
 */
export type ImageGuide = {
  estilo?: 'fotografia' | 'ilustracao' | '3d';
  luz?: string;
  paleta?: string[];
  ambientes?: string[];
  sujeitos?: string[];
  /** O que nunca pode aparecer. Vira negativa no prompt e regra do crítico. */
  nunca?: string[];
  notas?: string;
  definedAt?: string;
};

export type ImageStatus = 'candidata' | 'aprovada' | 'rejeitada';

export type Critique = {
  fidelidade?: number;
  coerencia_guia?: number;
  realismo?: number;
  sem_alucinacao?: number;
  autenticidade?: number;
  adequacao_bloco?: number;
  nota?: number;
  aprovado?: boolean;
  tem_texto?: boolean;
  pontos_fortes?: string[];
  problemas?: string[];
  alt_sugerido?: string;
  descricao?: string;
  erro?: string;
};

export type TenantImage = {
  id: string;
  seq: number;
  batchId: string;
  requestText: string;
  targetBlock: string | null;
  ratio: string;
  model: string;
  url: string;
  blobPath: string;
  status: ImageStatus;
  score: number | null;
  critique: Critique;
  alt: string | null;
  description: string | null;
  createdAt: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'published';
  brief: Record<string, unknown>;
  brand: Brand;
  dials: Dials;
  imageGuide: ImageGuide;
  whatsapp: string | null;
  contactEmail: string | null;
  ga4Id: string | null;
  metaPixelId: string | null;
  locale: string;
};

export type Seo = {
  title?: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
};

export type PostMeta = {
  excerpt?: string;
  author?: string;
  date?: string;
  cover?: string;
};

export type BlockInstance = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

export type Page = {
  id: string;
  tenantId: string;
  slug: string;
  type: PageType;
  title: string;
  seo: Seo;
  meta: PostMeta;
  blocks: BlockInstance[];
  publishedBlocks: BlockInstance[] | null;
  publishedSeo: Seo | null;
  publishedAt: string | null;
  navOrder: number;
};

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  referrer?: string;
  landing?: string;
  first?: Record<string, string>;
};
