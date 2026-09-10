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
import { isAuthenticated } from '@/lib/auth';
import { structuredData } from '@/lib/sites/structured-data';

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

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const preview = (await searchParams).preview === '1';
  if (preview && !(await isAuthenticated())) notFound();
  const { tenant: tenantSlug, slug } = await params;
  const resolved = await resolve(tenantSlug, slug ?? []);
  if (!resolved) return { title: 'Página não encontrada' };
  const { tenant, page } = resolved;
  if (!preview && !page.publishedBlocks) notFound();
  const seo = preview ? page.seo : (page.publishedSeo ?? {});
  const title = seo.title || page.title;
  const noindex =
    preview ||
    seo.noindex ||
    page.type === 'thank_you' ||
    page.type === 'paid_lp';

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

export default async function TenantPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const query = await searchParams;
  const isPreview = query.preview === '1';
  if (isPreview && !(await isAuthenticated())) notFound();
  const resolved = await resolve(
    resolvedParams.tenant,
    resolvedParams.slug ?? [],
  );
  if (!resolved) notFound();
  const { tenant, page } = resolved;

  // O painel pede `?preview=1` para ver o rascunho; o público vê o publicado.
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            structuredData(tenant, page, isPreview),
          ).replace(/</g, '\\u003c'),
        }}
      />
      <RenderBlocks
        blocks={blocks}
        ctx={{
          tenant,
          posts,
          pagePath,
          previewTenant: query.__tenant ? tenant.slug : undefined,
          isPreview,
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
