import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import {
  getPage,
  getTenantBySlug,
  listPublishedPosts,
} from '@/lib/tenant-queries';
import { attributionScript } from '@/lib/tracking';
import type { Page, Tenant } from '@/lib/types';

type Params = { tenant: string; slug?: string[] };
type Props = {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export const dynamic = 'force-dynamic';

const resolve = cache(async (tenantSlug: string, slugParts: string[]) => {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;
  const page = await getPage(tenant.id, slugParts.join('/'));
  if (!page) return null;
  return { tenant, page };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant: tenantSlug, slug } = await params;
  const resolved = await resolve(tenantSlug, slug ?? []);
  if (!resolved) return { title: 'Página não encontrada' };
  const { tenant, page } = resolved;
  const seo = page.publishedSeo ?? page.seo;
  const title = seo.title || page.title;
  const noindex =
    seo.noindex || page.type === 'thank_you' || page.type === 'paid_lp';

  // Canônica absoluta: relativa é ignorada pelos buscadores.
  const host = (await headers()).get('host') ?? `${tenant.slug}.eixu.com.br`;
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const base = `${protocol}://${host}`;
  // Home fica com a barra final; as demais sem barra, para não gerar duas
  // URLs equivalentes para o mesmo conteúdo.
  const canonical =
    seo.canonical || (page.slug ? `${base}/${page.slug}` : `${base}/`);

  return {
    metadataBase: new URL(base),
    title,
    description: seo.description,
    robots: noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical },
    openGraph: {
      title,
      description: seo.description,
      type: page.type === 'post' ? 'article' : 'website',
      locale: tenant.locale.replace('-', '_'),
      siteName: tenant.name,
    },
  };
}

function JsonLd({ tenant, page }: { tenant: Tenant; page: Page }) {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': `#organization`,
      name: tenant.name,
      ...(tenant.whatsapp ? { telephone: tenant.whatsapp } : {}),
    },
  ];
  if (page.type === 'post') {
    graph.push({
      '@type': 'Article',
      headline: page.title,
      description: page.seo.description,
      datePublished: page.meta.date ?? page.publishedAt ?? undefined,
      author: page.meta.author
        ? { '@type': 'Person', name: page.meta.author }
        : { '@id': '#organization' },
      publisher: { '@id': '#organization' },
    });
  }
  const blocks = page.publishedBlocks ?? page.blocks;
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
  return (
    <script
      type="application/ld+json"
      // JSON serializado, sem entrada de usuário não escapada.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': graph,
        }).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export default async function TenantPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const query = await searchParams;
  const resolved = await resolve(
    resolvedParams.tenant,
    resolvedParams.slug ?? [],
  );
  if (!resolved) notFound();
  const { tenant, page } = resolved;

  // O painel pede `?preview=1` para ver o rascunho; o público vê o publicado.
  const isPreview = query.preview === '1';
  const blocks = isPreview ? page.blocks : (page.publishedBlocks ?? []);
  if (!isPreview && !page.publishedBlocks) notFound();

  const posts = blocks.some((b) => b.type === 'editorial.postList')
    ? await listPublishedPosts(tenant.id)
    : [];
  const pagePath = `/${page.slug}`;

  return (
    <div
      className="site-theme"
      style={themeVars(tenant.brand) as React.CSSProperties}
      data-variance={tenant.dials.variance <= 3 ? 'quiet' : 'expressive'}
      data-density={
        tenant.dials.density <= 3
          ? 'airy'
          : tenant.dials.density >= 8
            ? 'compact'
            : 'normal'
      }
      data-motion={tenant.dials.motion <= 3 ? 'still' : 'gentle'}
      data-design-version={tenant.brand.design?.version}
      data-hero={tenant.brand.design?.heroComposition}
      data-navigation={tenant.brand.design?.navigation}
      data-rhythm={tenant.brand.design?.rhythm}
      data-imagery={tenant.brand.design?.imageTreatment}
      data-surface={tenant.brand.design?.surfaceStyle}
      data-motif={tenant.brand.design?.motif}
    >
      <JsonLd tenant={tenant} page={page} />
      <RenderBlocks
        blocks={blocks}
        ctx={{
          tenant,
          posts,
          pagePath,
          previewTenant: query.__tenant ? tenant.slug : undefined,
        }}
      />
      {!isPreview ? (
        <script
          // Rastreamento de primeira parte, sem biblioteca externa.
          dangerouslySetInnerHTML={{
            __html: attributionScript(tenant.slug, pagePath),
          }}
        />
      ) : null}
    </div>
  );
}
