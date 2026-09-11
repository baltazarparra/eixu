import { contactsOf, phoneE164, socialLinks } from '@/lib/tenant-contacts';
import type { Page, Tenant } from '@/lib/types';

/** SEO e FAQ seguem o mesmo snapshot que o visitante está vendo. */
export function structuredData(tenant: Tenant, page: Page, preview = false) {
  const seo = preview ? page.seo : (page.publishedSeo ?? {});
  const contacts = contactsOf(tenant.contacts, tenant.whatsapp);
  const phone = contacts.phones[0]?.number ?? tenant.whatsapp;
  const social = socialLinks(contacts).map((link) => link.url);
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': `#organization`,
      name: tenant.name,
      ...(phone ? { telephone: phoneE164(phone) } : {}),
      ...(tenant.contactEmail ? { email: tenant.contactEmail } : {}),
      ...(social.length ? { sameAs: social } : {}),
      ...(contacts.addresses.length
        ? {
            address: contacts.addresses.map((item) => ({
              '@type': 'PostalAddress',
              ...(item.label ? { name: item.label } : {}),
              streetAddress: item.text,
            })),
          }
        : {}),
    },
  ];
  if (page.type === 'post') {
    graph.push({
      '@type': 'Article',
      headline: page.title,
      description: seo.description,
      datePublished: page.meta.date ?? page.publishedAt ?? undefined,
      author: page.meta.author
        ? { '@type': 'Person', name: page.meta.author }
        : { '@id': '#organization' },
      publisher: { '@id': '#organization' },
    });
  }
  const blocks = preview ? page.blocks : (page.publishedBlocks ?? []);
  const faq = blocks.find((b) => b.type === 'faq.accordion');
  if (faq) {
    const items = (faq.props.items ?? []) as { q: string; a: string }[];
    graph.push({
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
