import type { Page, PublishedTenantSnapshot, Tenant } from '@/lib/types';

export function tenantDraftSnapshot(tenant: Tenant): PublishedTenantSnapshot {
  // A medição do logo não é apresentação: medir não pode marcar o rascunho
  // como alterado nem entrar no snapshot publicado.
  const { logoFit: _logoFit, ...brand } = tenant.brand;
  return {
    name: tenant.name,
    brand,
    dials: tenant.dials,
    contacts: tenant.contacts,
    whatsapp: tenant.whatsapp,
    contactEmail: tenant.contactEmail,
    locale: tenant.locale,
  };
}

/** Fallback defensivo para fixtures/importações; a migração preenche publicados. */
export function publicTenant(tenant: Tenant): Tenant {
  const snapshot = tenant.publishedSnapshot;
  return snapshot
    ? {
        ...tenant,
        ...snapshot,
      }
    : tenant;
}

/** Título, tipo e meta seguem o mesmo instante de blocos e SEO. */
export function publicPage(page: Page): Page {
  return {
    ...page,
    title: page.publishedTitle ?? page.title,
    type: page.publishedType ?? page.type,
    meta: page.publishedMeta ?? page.meta,
    navOrder: page.publishedNavOrder ?? page.navOrder,
  };
}
