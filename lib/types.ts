export type PageType = 'page' | 'paid_lp' | 'post' | 'thank_you';

import type { DesignProfile } from '@/lib/design/profile';
import type { Vibe } from '@/lib/design/vibes';
import type { Contacts } from '@/lib/tenant-contacts';
import type { Inbound } from '@/lib/taste/site';

export type Dials = {
  /** 1 simetria perfeita, 10 caos autoral. */
  variance: number;
  /** 1 estático, 10 cinematográfico. */
  motion: number;
  /** 1 galeria de arte, 10 cockpit. */
  density: number;
};

export type Brand = {
  /** Cor primária: superfícies e seções com a cor da marca. */
  accent?: string;
  /** Cor secundária: o tom complementar das seções. */
  accentAlt?: string;
  /** Cor de acento: botões, links e destaques. Sem ela, usa a primária. */
  highlight?: string;
  /** Sugestão pode ser adaptada; escolha do operador nunca é reescrita. */
  paletteSource?: 'operador' | 'sugerida';
  /** Vibe escolhida no cadastro. Ausente significa o contrato comercial. */
  vibe?: Vibe;
  ink?: string;
  paper?: string;
  surface?: string;
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  font?: 'sans' | 'serif' | 'mono';
  design?: DesignProfile;
  logoText?: string;
  /** URL pública do logo enviado pelo painel. Nav e rodapé usam quando existe. */
  logoUrl?: string;
  /**
   * Versão do logo para superfície escura, derivada ao aplicar o logo ou
   * escolhida na biblioteca. Nav e rodapé a usam quando o papel da seção é
   * escuro (lib/blocks/theme.ts).
   */
  logoDarkUrl?: string;
  /** Versão operacional da aplicação do logo; não compõe o snapshot visual. */
  logoRevision?: string;
  /** Medição por pixel do logo aplicado; só vale enquanto `source` for o logoUrl. */
  logoFit?: LogoFit;
  /** Assets de apresentação; válidos apenas para a URL que os originou. */
  logoAsset?: LogoAsset;
  logoDarkAsset?: LogoRendition;
};

export type LogoRendition = {
  version: 1;
  source: string;
  sourceHash: string;
  background: 'transparent' | 'removed' | 'opaque';
  master: { url: string; width: number; height: number };
  nav: { url: string; width: number; height: number };
  svg?: { url: string; bytes: number; traced: boolean };
  aspect: number;
  displayHeight: 40 | 48 | 56 | 64;
  preparedAt: string;
};

export type LogoAsset = LogoRendition & {
  icon: {
    svg?: string;
    png32: string;
    png192: string;
    png512: string;
    maskable512: string;
    apple180: string;
  };
  og: { url: string; width: 1200; height: 630 };
  mark?: {
    box: [number, number, number, number];
    from: 'componentes' | 'leitura';
  };
  reading?: {
    nome?: string;
    tipo: 'wordmark' | 'simbolo' | 'combinado';
    readAt: string;
  };
};

export type LogoStudioState = {
  status: 'running' | 'done' | 'failed' | 'skipped';
  sourceHash: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  original?: { seq: number };
  proposals: {
    seq: number;
    imageId: string;
    variant: 'fiel' | 'ousada';
    url: string;
    score: number | null;
    aprovado: boolean;
    nomeCorreto: boolean | null;
    fidelidade: number | null;
    aspect: number;
  }[];
  recommended?: number;
  applied?: { seq: number; at: string };
  gate?: string;
};

/** Medição do logo feita ao aplicá-lo (lib/images/logo-measure.ts). */
export type LogoFit = {
  source: string;
  measuredAt: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  /** Fração de pixels transparentes (alfa abaixo de 16). */
  transparentFraction: number;
  /** Luminância relativa média dos pixels opacos, de 0 a 1. */
  opaqueLuminance: number;
  /** Fração dos opacos com luminância acima de 0,85. */
  lightFraction: number;
  /** Fração dos opacos com luminância abaixo de 0,3. */
  darkFraction: number;
  /** Placa: arquivo sem alfa ou retângulo opaco claro em volta da arte. */
  plate: 'light' | 'dark' | null;
};

export type PublishedTenantSnapshot = {
  name: string;
  brand: Brand;
  dials: Dials;
  contacts: Contacts;
  whatsapp: string | null;
  contactEmail: string | null;
  locale: string;
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

/** Candidata e aprovada são estados legados, ambos disponíveis para uso. */
export type ImageStatus = 'disponivel' | 'candidata' | 'aprovada' | 'rejeitada';

export type Critique = {
  fidelidade?: number;
  /** Campos do crítico de logo. */
  legibilidade_48px?: number;
  vetor_flat?: number;
  monocromia_viavel?: number;
  fundo_transparente?: boolean;
  sem_textura_fotografica?: number;
  sem_texto_extra?: boolean;
  nome_lido?: string;
  nome_correto?: boolean;
  fidelidade_original?: number | null;
  variante?: string;
  precheck?: Record<string, unknown>;
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

export type ImageKind = 'foto' | 'logo';

export type TenantImage = {
  id: string;
  seq: number;
  kind: ImageKind;
  referenceUrls: string[];
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
  width?: number;
  height?: number;
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
  /** Telefones, endereços e redes do cadastro, renderizados no site. */
  contacts: Contacts;
  /** WhatsApp principal, derivado de contacts na escrita. */
  whatsapp: string | null;
  contactEmail: string | null;
  ga4Id: string | null;
  metaPixelId: string | null;
  locale: string;
  /** Apresentação pública; ausente em clientes publicados antes do snapshot. */
  publishedSnapshot?: PublishedTenantSnapshot | null;
};

export type Seo = {
  title?: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
};

export type PostMeta = {
  inbound?: Inbound;
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
  publishedTitle?: string | null;
  publishedType?: PageType | null;
  publishedMeta?: PostMeta | null;
  publishedNavOrder?: number | null;
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
