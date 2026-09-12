import { cache } from 'react';
import type { Metadata, Viewport } from 'next';
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
import { renderingVibeOf } from '@/lib/design/vibes';
import {
  hasReferenceDirection,
  referenceAspects,
} from '@/lib/design/references';
import { publicPage, publicTenant } from '@/lib/sites/snapshot';
import { currentLogoAsset } from '@/lib/images/logo-schema';
import { logoThemeColor, siteOrigin } from '@/lib/sites/logo-metadata';

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
  const renderedTenant = preview ? tenant : publicTenant(tenant);
  const renderedPage = preview ? page : publicPage(page);
  const seo = preview ? page.seo : (page.publishedSeo ?? {});
  const title = seo.title || renderedPage.title;
  const noindex =
    preview ||
    seo.noindex ||
    renderedPage.type === 'thank_you' ||
    renderedPage.type === 'paid_lp';

  // Canônica absoluta: relativa é ignorada pelos buscadores.
  const host = (await headers()).get('host') ?? `${tenant.slug}.eixu.com.br`;
  const base = siteOrigin(host);
  const asset = currentLogoAsset(renderedTenant.brand);
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
    ...(asset
      ? {
          icons: {
            icon: [
              ...(asset.icon.svg
                ? [{ url: asset.icon.svg, sizes: 'any', type: 'image/svg+xml' }]
                : []),
              { url: asset.icon.png32, sizes: '32x32', type: 'image/png' },
              { url: asset.icon.png192, sizes: '192x192', type: 'image/png' },
            ],
            apple: [
              { url: asset.icon.apple180, sizes: '180x180', type: 'image/png' },
            ],
          },
          manifest: preview
            ? `/manifest.webmanifest?__tenant=${tenant.slug}`
            : '/manifest.webmanifest',
        }
      : {}),
    twitter: {
      card: asset ? 'summary_large_image' : 'summary',
      title,
      description: seo.description,
      ...(asset ? { images: [asset.og.url] } : {}),
    },
    openGraph: {
      url: canonical,
      title,
      description: seo.description,
      type: renderedPage.type === 'post' ? 'article' : 'website',
      locale: renderedTenant.locale.replace('-', '_'),
      siteName: renderedTenant.name,
      ...(asset
        ? {
            images: [
              {
                url: asset.og.url,
                width: 1200,
                height: 630,
                alt: `Logo de ${renderedTenant.name}`,
              },
            ],
          }
        : {}),
    },
  };
}

export async function generateViewport({
  params,
  searchParams,
}: Props): Promise<Viewport> {
  const preview = (await searchParams).preview === '1';
  if (preview && !(await isAuthenticated())) notFound();
  const { tenant: slug, slug: parts } = await params;
  const resolved = await resolve(slug, parts ?? []);
  if (!resolved) return {};
  if (!preview && !resolved.page.publishedBlocks) notFound();
  const tenant = preview ? resolved.tenant : publicTenant(resolved.tenant);
  const blocks = preview
    ? resolved.page.blocks
    : (resolved.page.publishedBlocks ?? []);
  return { themeColor: logoThemeColor(tenant.brand, blocks) };
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
  const renderedTenant = isPreview ? tenant : publicTenant(tenant);
  const renderedPage = isPreview ? page : publicPage(page);
  const referenceDirected = hasReferenceDirection(renderedTenant.brand);
  const designVersion = renderedTenant.brand.design?.version;
  // Nos perfis v4 e v5 a referência modula aspectos e a vibe continua no CSS.
  // Os perfis 2 e 3 mantêm a base neutra com que foram publicados.
  const modulated =
    (designVersion === 4 || designVersion === 5) && referenceDirected;
  const aspects = modulated
    ? [...referenceAspects(renderedTenant.brand)]
        .sort((a, b) => a.localeCompare(b))
        .join(' ')
    : undefined;

  // O painel pede `?preview=1` para ver o rascunho; o público vê o publicado.
  const blocks = isPreview ? page.blocks : (page.publishedBlocks ?? []);
  if (!isPreview && !page.publishedBlocks) notFound();

  const posts = blocks.some((b) => b.type === 'editorial.postList')
    ? await listPublishedPosts(tenant.id)
    : [];
  const pagePath = `/${page.slug}`;
  const base = siteOrigin(
    (await headers()).get('host') ?? `${tenant.slug}.eixu.com.br`,
  );

  return (
    <div
      className="site-theme"
      style={themeVars(renderedTenant.brand) as React.CSSProperties}
      data-variance={
        renderedTenant.dials.variance <= 3 ? 'quiet' : 'expressive'
      }
      data-density={
        renderedTenant.dials.density <= 3
          ? 'airy'
          : renderedTenant.dials.density >= 8
            ? 'compact'
            : 'normal'
      }
      data-motion={renderedTenant.dials.motion <= 3 ? 'still' : 'gentle'}
      data-vibe={renderingVibeOf(renderedTenant.brand)}
      data-reference-direction={referenceDirected ? 'true' : undefined}
      // O seletor continua no contrato visual v4; data-profile-version expõe
      // a versão persistida, e a v5 acrescenta a estrutura sem duplicar CSS.
      data-design-version={
        referenceDirected && !modulated
          ? 'reference'
          : designVersion === 5
            ? 4
            : designVersion
      }
      data-profile-version={designVersion}
      data-structure={renderedTenant.brand.design?.structure}
      data-reference-aspects={aspects || undefined}
      data-hero={renderedTenant.brand.design?.heroComposition}
      data-navigation={renderedTenant.brand.design?.navigation}
      data-rhythm={renderedTenant.brand.design?.rhythm}
      data-imagery={renderedTenant.brand.design?.imageTreatment}
      data-surface={renderedTenant.brand.design?.surfaceStyle}
      data-motif={renderedTenant.brand.design?.motif}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            structuredData(renderedTenant, renderedPage, isPreview, base),
          ).replace(/</g, '\\u003c'),
        }}
      />
      <RenderBlocks
        blocks={blocks}
        ctx={{
          tenant: renderedTenant,
          posts,
          pagePath,
          pageType: renderedPage.type,
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
