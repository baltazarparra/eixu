type PreviewContext = {
  previewTenant?: string;
  isPreview?: boolean;
  tenant: { slug: string; whatsapp: string | null };
};

/** Mantém links internos no cliente e no modo que o operador está revisando. */
export function previewHref(href: string, ctx: PreviewContext): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://preview.invalid');
  if (url.pathname === '/go/wa' && ctx.isPreview && ctx.tenant.whatsapp)
    return `https://wa.me/${ctx.tenant.whatsapp.replace(/\D/g, '')}`;
  if (!ctx.previewTenant || /^\/(api|go|s)(\/|$)/.test(url.pathname))
    return href;
  url.pathname = `/s/${ctx.previewTenant}${url.pathname}`;
  url.searchParams.set('__tenant', ctx.previewTenant);
  if (ctx.isPreview) url.searchParams.set('preview', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function previewProps(value: unknown, ctx: PreviewContext): unknown {
  if (!ctx.previewTenant && !ctx.isPreview) return value;
  if (Array.isArray(value)) return value.map((item) => previewProps(item, ctx));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === 'href' && typeof item === 'string'
          ? previewHref(item, ctx)
          : previewProps(item, ctx),
      ]),
    );
  return value;
}
