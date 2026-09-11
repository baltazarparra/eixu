import { contactsOf, whatsappAt } from '@/lib/tenant-contacts';

type PreviewContext = {
  previewTenant?: string;
  isPreview?: boolean;
  tenant: { slug: string; whatsapp: string | null; contacts?: unknown };
};

/** O rodapé pode oferecer um segundo WhatsApp; a prévia precisa do mesmo número. */
function previewWhatsapp(url: URL, ctx: PreviewContext): string | null {
  const index = Number(url.searchParams.get('n'));
  const contacts = contactsOf(ctx.tenant.contacts, ctx.tenant.whatsapp);
  const chosen =
    Number.isInteger(index) && index >= 0 ? whatsappAt(contacts, index) : null;
  return chosen ?? ctx.tenant.whatsapp;
}

/** Mantém links internos no cliente e no modo que o operador está revisando. */
export function previewHref(href: string, ctx: PreviewContext): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://preview.invalid');
  if (url.pathname === '/go/wa' && ctx.isPreview) {
    const number = previewWhatsapp(url, ctx);
    if (number) return `https://wa.me/${number.replace(/\D/g, '')}`;
  }
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
