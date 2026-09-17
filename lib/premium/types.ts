import type { Page, PublishedTenantSnapshot, Tenant } from '@/lib/types';
import type { PremiumEditorState } from '@/lib/premium/editor';

export const PREMIUM_CONVERTER_VERSION = '1';

export type PremiumSourceTenant = Pick<
  Tenant,
  | 'id'
  | 'slug'
  | 'name'
  | 'status'
  | 'maintenanceMode'
  | 'publicRuntime'
  | 'brand'
  | 'dials'
  | 'contacts'
  | 'whatsapp'
  | 'contactEmail'
  | 'ga4Id'
  | 'metaPixelId'
  | 'locale'
> & {
  publishedSnapshot: PublishedTenantSnapshot;
};

export type PremiumSourcePage = Pick<
  Page,
  | 'id'
  | 'slug'
  | 'type'
  | 'title'
  | 'seo'
  | 'meta'
  | 'blocks'
  | 'navOrder'
  | 'publishedAt'
>;

/** Conteudo publico congelado; nao inclui rascunho, briefing, leads ou chat. */
export type PremiumSourceSnapshot = {
  version: 1;
  tenant: PremiumSourceTenant;
  pages: PremiumSourcePage[];
  assets: string[];
};

export type PremiumWorkspaceState = {
  maintenanceMode: Tenant['maintenanceMode'];
  publicRuntime: Tenant['publicRuntime'];
  canonicalUrl: string;
  project: null | {
    id: string;
    key: string;
    directory: string;
    status: 'preparing' | 'active' | 'failed' | 'archived';
    vercelProjectName: string | null;
  };
  conversion: null | {
    id: string;
    status:
      | 'queued'
      | 'claimed'
      | 'exported'
      | 'deploying'
      | 'activated'
      | 'failed'
      | 'canceled';
    pullRequestUrl: string | null;
    error: string | null;
    createdAt: string;
  };
  editor: PremiumEditorState | null;
};
