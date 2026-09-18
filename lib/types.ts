import type { Contacts } from '@/lib/tenant-contacts';
import type { StudioDirection } from '@/lib/studio/directions';

export type Brand = {
  accent?: string;
  accentAlt?: string;
  highlight?: string;
  paletteSource?: 'operador' | 'sugerida';
  /** `vibe` permanece somente como alias de leitura para cadastros anteriores. */
  vibe?: StudioDirection;
  direction?: StudioDirection;
  logoUrl?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  brief: Record<string, unknown>;
  brand: Brand;
  contacts: Contacts;
  whatsapp: string | null;
  contactEmail: string | null;
  ga4Id: string | null;
  metaPixelId: string | null;
  locale: string;
};

export type ImageStatus = 'disponivel' | 'candidata' | 'aprovada' | 'rejeitada';
export type ImageKind = 'foto' | 'logo';
export type Critique = Record<string, unknown> & {
  nota?: number;
  alt_sugerido?: string;
  descricao?: string;
};

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
